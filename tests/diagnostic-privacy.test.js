import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const marker = 'SYNTHETIC_PRIVATE_DIAGNOSTIC_DATA';
let sequence = 0;
async function load(file, dependencies) {
  let source = await readFile(new URL(`../src/${file}`, import.meta.url), 'utf8');
  source = source.replace("import { driveService } from './services/driveService.js';", 'const driveService = deps.driveService;')
    .replace("import { sheetsService } from './services/sheetsService.js';", 'const sheetsService = deps.sheetsService;')
    .replace("import { logger } from './utils/logger.js';", 'const logger = deps.logger;')
    .replace("import { validateConfig } from './config/env.js';", 'const validateConfig = deps.validateConfig;');
  const key = 'diagnosticFixture' + sequence++;
  globalThis[key] = dependencies;
  try {
    return await import(`data:text/javascript;base64,${Buffer.from(`const deps = globalThis[${JSON.stringify(key)}]; const console = deps.console; const process = {env: deps.env || {}, argv: []};\n${source}`).toString('base64')}`);
  } finally { delete globalThis[key]; }
}
function output() {
  const lines = [];
  return { lines, console: { log: (...args) => lines.push(args.join(' ')), error: (...args) => lines.push(args.join(' ')) },
    logger: { info: (...args) => lines.push(args.join(' ')), warn: (...args) => lines.push(args.join(' ')), error: (...args) => lines.push(args.join(' ')) } };
}
test('video diagnostic reports aggregate timezone counts across pages without identifiers', async () => {
  const log = output(), calls = [];
  let initializations = 0;
  const service = { initialize: async () => { initializations++; }, drive: { files: { list: async request => {
    calls.push(request);
    if (calls.length === 1) return { data: { files: [{ id: marker }] } };
    if (calls.length === 2) return { data: { files: [{ createdTime: '2026-01-01T16:00:00Z', name: marker, id: marker }, { createdTime: '2026-01-01T01:00:00Z' }], nextPageToken: 'fixture-next' } };
    return { data: { files: [{ createdTime: marker }] } };
  } } } };
  const mod = await load('debug-video-dates.js', { ...log, driveService: service,
    env: { VIDEO_DATE_DEBUG_FOLDER_ID: 'fixture-parent', VIDEO_DATE_DEBUG_MONTH: '2026-01' } });
  assert.equal(initializations, 0, 'import must not run diagnostics');
  assert.equal(await mod.runVideoDateDiagnostic(), true);
  assert.equal(calls[2].pageToken, 'fixture-next');
  assert.ok(log.lines.includes('動画件数: 3'));
  assert.ok(log.lines.includes('作成日時が不明な件数: 1'));
  assert.ok(log.lines.includes('UTCとJSTで日付が異なる件数: 1'));
  assert.equal(log.lines.join('\n').includes(marker), false);
});
test('video diagnostic refuses missing targets before I/O and masks upstream errors', async () => {
  const log = output(); let calls = 0;
  const service = { initialize: async () => { calls++; throw Object.assign(new Error(marker), { config: { key: marker } }); } };
  const missing = await load('debug-video-dates.js', { ...log, driveService: service });
  assert.equal(await missing.runVideoDateDiagnostic(), false);
  assert.equal(calls, 0);
  const configured = await load('debug-video-dates.js', { ...log, driveService: service, env: { VIDEO_DATE_DEBUG_FOLDER_ID: 'fixture-parent' } });
  assert.equal(await configured.runVideoDateDiagnostic(), false);
  assert.equal(calls, 1);
  assert.equal(log.lines.join('\n').includes(marker), false);
});
test('error-row diagnostic reads only and reports row numbers without stored errors or file names', async () => {
  const log = output(), reads = [];
  const service = { initialize: async () => {}, getSheetData: async name => {
    reads.push(name);
    return [['status', 'drive_file_name', 'error_message'], ['ERROR', marker, marker], ['OK', marker, ''], ['ERROR', marker, marker]];
  } };
  const mod = await load('clear-error-rows.js', { ...log, sheetsService: service, validateConfig() {} });
  assert.deepEqual(reads, []);
  assert.equal(await mod.runErrorRowDiagnostic(), true);
  assert.deepEqual(reads, ['daily_lessons']);
  assert.ok(log.lines.includes('Error row count: 2'));
  assert.ok(log.lines.includes('Error row number: 2'));
  assert.ok(log.lines.includes('Error row number: 4'));
  assert.equal(log.lines.join('\n').includes(marker), false);
});
test('error-row diagnostic masks failures and handles empty or missing status headers', async () => {
  const log = output(); let mode = 'error';
  const service = { initialize: async () => {}, getSheetData: async () => {
    if (mode === 'error') throw new Error(marker);
    return mode === 'empty' ? [] : [['unexpected'], [marker]];
  } };
  const mod = await load('clear-error-rows.js', { ...log, sheetsService: service, validateConfig() {} });
  assert.equal(await mod.runErrorRowDiagnostic(), false);
  mode = 'empty'; assert.equal(await mod.runErrorRowDiagnostic(), true);
  mode = 'header'; assert.equal(await mod.runErrorRowDiagnostic(), true);
  assert.equal(log.lines.join('\n').includes(marker), false);
});
