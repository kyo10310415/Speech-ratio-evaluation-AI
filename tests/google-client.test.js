import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { google } from 'googleapis';
import http from 'node:http';
import https from 'node:https';

beforeEach(t => {
  for (const module of [http, https]) {
    t.mock.method(module, 'request', () => { throw new Error('Unexpected external request'); });
    t.mock.method(module, 'get', () => { throw new Error('Unexpected external request'); });
  }
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected external fetch'); });
});

// Load the actual service implementation with inert config/logger imports:
// no dotenv, real credentials, log files, scheduler or external requests.
async function fixtureService(name, exported) {
  let source = await readFile(new URL(`../src/services/${name}.js`, import.meta.url), 'utf8');
  source = source.replace("'googleapis'", JSON.stringify(import.meta.resolve('googleapis')))
    .replace("import { config } from '../config/env.js';", "const config = { googleSheetsId: 'fixture-sheet' };")
    .replace("import { logger } from '../utils/logger.js';", 'const logger = new Proxy({}, { get: () => () => {} });');
  source += `\n//# sourceURL=fixture-${name}.js`;
  return (await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`))[exported];
}

function intercept(client, responses) {
  const requests = [];
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: 'synthetic-offline-fixture', expiry_date: Date.now() + 3600000 });
  auth.transporter.defaults.adapter = async options => {
    requests.push(options);
    assert.ok(responses.length, 'unexpected HTTP operation');
    const { data, status = 200 } = responses.shift();
    return { data, status, statusText: status === 200 ? 'OK' : 'Bad Request', headers: new Headers(), config: options };
  };
  client.context._options.auth = auth;
  return requests;
}

test('real Sheets service preserves read mapping and RAW update/append requests with Google client 150', async () => {
  const service = await fixtureService('sheetsService', 'sheetsService');
  await service.initialize();
  assert.deepEqual(service.sheets.context._options.auth.scopes, ['https://www.googleapis.com/auth/spreadsheets']);
  const requests = intercept(service.sheets, [
    { data: { values: [['Fixture tutor', '', 'https://example.invalid/folder'], ['', '', 'ignored']] } },
    { data: {} }, { data: {} }, { data: {} },
  ]);
  assert.deepEqual(await service.readInputSheet(), [{ tutorName: 'Fixture tutor', folderUrl: 'https://example.invalid/folder' }]);
  await service.writeHeaders('fixture tab', ['drive_file_id', 'result']);
  await service.appendRows('fixture tab', [['synthetic-file', '=not-a-formula']]);
  assert.equal(requests[0].method, 'GET');
  assert.match(decodeURIComponent(String(requests[0].url)), /fixture-sheet\/values\/コピー先URL!A2:D/);
  assert.equal(requests[2].method, 'PUT');
  assert.match(String(requests[2].url), /valueInputOption=RAW/);
  assert.deepEqual(JSON.parse(requests[2].body), { values: [['drive_file_id', 'result']] });
  assert.equal(requests[3].method, 'POST');
  assert.match(String(requests[3].url), /:append\?valueInputOption=RAW/);
  assert.deepEqual(JSON.parse(requests[3].body), { values: [['synthetic-file', '=not-a-formula']] });
  await service.appendRows('fixture tab', []);
  assert.equal(requests.length, 4);
});

test('Sheets missing-tab HTTP 400 remains an empty dataset and other failures propagate', async () => {
  const service = await fixtureService('sheetsService', 'sheetsService');
  await service.initialize();
  intercept(service.sheets, [{ status: 400, data: { error: { message: 'fixture missing tab' } } }, { status: 403, data: { error: { message: 'fixture denied' } } }]);
  assert.deepEqual(await service.getSheetData('missing'), []);
  await assert.rejects(service.getSheetData('denied'), error => error.code === 403);
});

test('Sheets existing tab is reused and new-tab batchUpdate response is parsed', async () => {
  const service = await fixtureService('sheetsService', 'sheetsService');
  await service.initialize();
  const requests = intercept(service.sheets, [
    { data: { sheets: [{ properties: { title: 'existing', sheetId: 7 } }] } },
    { data: { sheets: [] } },
    { data: { replies: [{ addSheet: { properties: { sheetId: 8 } } }] } },
  ]);
  assert.equal(await service.getOrCreateSheet('existing'), 7);
  assert.equal(requests.length, 1);
  assert.equal(await service.getOrCreateSheet('new fixture'), 8);
  assert.equal(requests[2].method, 'POST');
  assert.match(String(requests[2].url), /fixture-sheet:batchUpdate$/);
  assert.deepEqual(JSON.parse(requests[2].body), { requests: [{ addSheet: { properties: { title: 'new fixture' } } }] });
});

test('real Drive service preserves readonly scope, folder query and month filtering', async () => {
  const service = await fixtureService('driveService', 'driveService');
  await service.initialize();
  assert.deepEqual(service.drive.context._options.auth.scopes, ['https://www.googleapis.com/auth/drive.readonly']);
  const requests = intercept(service.drive, [{ data: { files: [{ id: 'fixture-month', name: '2026-10' }, { id: 'ignored', name: 'unrelated' }] } }]);
  assert.deepEqual(await service.listMonthFolders('fixture-parent'), [{ id: 'fixture-month', name: '2026-10', normalizedName: '2026-10' }]);
  const url = new URL(requests[0].url);
  assert.equal(url.origin, 'https://www.googleapis.com');
  assert.equal(url.pathname, '/drive/v3/files');
  assert.equal(url.searchParams.get('q'), "'fixture-parent' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false");
  assert.equal(url.searchParams.get('fields'), 'files(id, name)');
  assert.equal(url.searchParams.get('orderBy'), 'name desc');
});
