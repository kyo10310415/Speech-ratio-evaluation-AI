import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import winston from 'winston';

// Import the real formatting and boundary without env loading, persistent logs or jobs.
async function loadBoundary() {
  const source = await readFile(new URL('../src/utils/logger.js', import.meta.url), 'utf8');
  const head = source.slice(0, source.indexOf('const internalLogger'))
    .replace("import { config } from '../config/env.js';", '')
    .replace("'winston'", JSON.stringify(import.meta.resolve('winston')));
  const boundary = source.slice(source.indexOf('export function withPrivateErrors'), source.indexOf('export const logger'));
  return import(`data:text/javascript;base64,${Buffer.from(`${head}\n${boundary}\nexport { logFormat };`).toString('base64')}`);
}

test('real Winston console and file output discard SDK exceptions and metadata before merging', async () => {
  const { withPrivateErrors, logFormat } = await loadBoundary();
  const directory = await mkdtemp(join(tmpdir(), 'speech-log-privacy-'));
  const filename = join(directory, 'fixture.log');
  const output = [];
  const consoleTransport = new winston.transports.Console({ forceConsole: true,
    format: winston.format.combine(winston.format.colorize(), logFormat) });
  consoleTransport._consoleLog = line => output.push(line);
  consoleTransport._consoleError = line => output.push(line);
  const raw = winston.createLogger({ level: 'debug', format: logFormat,
    transports: [consoleTransport, new winston.transports.File({ filename })] });
  const logger = withPrivateErrors(raw);
  const marker = 'SYNTHETIC_PRIVATE_MARKER';
  const error = Object.assign(new Error(marker), {
    config: { headers: { authorization: marker }, url: marker },
    response: { data: marker }, cause: new Error(marker)
  });
  try {
    logger.error('Drive download failed', error);
    logger.warn('Cleanup failed', error.message, { token: marker });
    logger.error(error);
    logger.error({ message: marker, stack: marker });
    logger.info('Progress retained', { user: marker });
    const finished = once(raw, 'finish');
    raw.end();
    await finished;
    const file = await readFile(filename, 'utf8');
    for (const content of [output.join('\n'), file]) {
      assert.ok(content.includes('Drive download failed'));
      assert.ok(content.includes('Cleanup failed'));
      assert.ok(content.includes('Progress retained'));
      assert.ok(content.includes('Log event details omitted'));
      assert.equal(content.includes(marker), false);
      assert.equal(content.includes('authorization'), false);
      assert.equal(content.includes(' at '), false);
    }
  } finally {
    raw.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('actual dashboard read handlers return generic 500 for SDK failures without network', async () => {
  let source = await readFile(new URL('../src/dashboard/server.js', import.meta.url), 'utf8');
  source = source.replace(/^import .+ from '([^']+)';$/gm, (line, specifier) => {
    if (specifier.includes('config/env')) return 'const config = {}; const validateConfig = () => {};';
    if (specifier.includes('utils/logger')) return 'const logger = new Proxy({}, {get: () => () => {}});';
    if (specifier.includes('services/sheetsService')) return "const sheetsService = { initialize: async () => { throw new Error('SYNTHETIC_PRIVATE_MARKER'); } };";
    if (specifier.includes('scheduler/jobScheduler')) return 'const jobScheduler = {};';
    if (specifier.includes('middleware/sso-auth')) return 'const ssoAuthMiddleware = async (c, next) => next();';
    return line.replace(`'${specifier}'`, JSON.stringify(import.meta.resolve(specifier)));
  });
  const {default: app} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  for (const path of ['/api/tutors', '/api/monthly-summary', '/api/sales-summary', '/api/lessons', '/api/lessons/fixture']) {
    const response = await app.request(`http://localhost${path}`);
    assert.equal(response.status, 500, path);
    const body = await response.json();
    assert.equal(body.error, '処理に失敗しました。管理者にお問い合わせください。');
    assert.equal(JSON.stringify(body).includes('SYNTHETIC_PRIVATE_MARKER'), false);
  }
});
