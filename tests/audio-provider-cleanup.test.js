import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import pRetry from 'p-retry';

const source = readFileSync(new URL('../src/services/geminiService.js', import.meta.url), 'utf8');
const loggerSource = readFileSync(new URL('../src/utils/logger.js', import.meta.url), 'utf8');
function fixture({ modelFails = false, deleteFails = false, malformed = false, uploadFailsAfterFirst = false } = {}) {
  const calls = { upload: 0, deletes: [], model: 0, logs: [] };
  const originalError = new Error('SYNTHETIC_PROVIDER_PRIVATE_ERROR');
  const uploadError = new Error('SYNTHETIC_UPLOAD_PRIVATE_ERROR');
  const boundary = loggerSource.slice(loggerSource.indexOf('export function withPrivateErrors'), loggerSource.indexOf('export const logger'))
    .replace('export function', 'function');
  const loggerContext = {};
  runInNewContext(boundary + ';globalThis.boundary=withPrivateErrors;', loggerContext);
  const logger = loggerContext.boundary(Object.fromEntries(['error', 'warn', 'info', 'debug', 'verbose', 'silly'].map(level => [level, message => calls.logs.push(String(message))])));
  class Files {
    async uploadFile() {
      calls.upload++;
      if (uploadFailsAfterFirst && calls.upload > 1) throw uploadError;
      return { file: { name: `synthetic-file-${calls.upload}`, uri: 'synthetic://local-only', mimeType: 'audio/wav' } };
    }
    async deleteFile(name) {
      calls.deletes.push(name);
      if (deleteFails) throw new Error('SYNTHETIC_CLEANUP_PRIVATE_ERROR');
    }
  }
  class AI {
    getGenerativeModel() {
      return { async generateContent() {
        calls.model++;
        if (modelFails) throw originalError;
        return { response: { text: () => malformed ? 'synthetic malformed response' : JSON.stringify({ segments: [{ start_sec: 0, end_sec: 1, text: 'synthetic', speaker: 'A' }] }) } };
      } };
    }
  }
  const context = { Error, config: { googleAiApiKey: 'synthetic-only' }, logger,
    GoogleGenerativeAI: AI, GoogleAIFileManager: Files, readFileSync: () => Buffer.alloc(44),
    pRetry: (run, options) => pRetry(run, { ...options, minTimeout: 1, maxTimeout: 1 }) };
  const code = source.replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
  runInNewContext(code + ';globalThis.service=geminiService;', context);
  return { service: context.service, calls, originalError, uploadError };
}
function privateLogsAbsent(calls) {
  return !calls.logs.some(message => /SYNTHETIC_(?:PROVIDER|UPLOAD|CLEANUP)_PRIVATE_ERROR/.test(message));
}

test('one effective single-file method keeps normal parsing and deletes its uploaded audio', async () => {
  assert.equal((source.match(/async transcribeAudioSingleFile\(/g) || []).length, 1);
  const f = fixture(); await f.service.initialize(); const result = await f.service.transcribeAudioSingleFile('synthetic.wav');
  assert.equal(result.segments.length, 1); assert.equal(result.segments[0].end_ms, 1000);
  assert.equal(f.calls.upload, 1); assert.equal(f.calls.model, 1); assert.equal(f.calls.deletes.length, 1);
});
test('provider failure cleans every retry upload and rethrows original error without private logs', async () => {
  const f = fixture({ modelFails: true }); await f.service.initialize(); let caught;
  try { await f.service.transcribeAudioSingleFile('synthetic.wav'); } catch (error) { caught = error; }
  assert.equal(caught === f.originalError, true); assert.equal(f.calls.upload, 4); assert.equal(f.calls.deletes.length, 4);
  assert.equal(new Set(f.calls.deletes).size, 4); assert.equal(privateLogsAbsent(f.calls), true);
});
test('cleanup failure preserves original provider failure and never exposes cleanup exception', async () => {
  const f = fixture({ modelFails: true, deleteFails: true }); await f.service.initialize(); let caught;
  try { await f.service.transcribeAudioSingleFile('synthetic.wav'); } catch (error) { caught = error; }
  assert.equal(caught === f.originalError, true); assert.equal(f.calls.deletes.length, 4); assert.equal(privateLogsAbsent(f.calls), true);
});
test('successful transcription survives cleanup failure without duplicate AI retries', async () => {
  const f = fixture({ deleteFails: true }); await f.service.initialize(); const result = await f.service.transcribeAudioSingleFile('synthetic.wav');
  assert.equal(result.segments.length, 1); assert.equal(f.calls.upload, 1); assert.equal(f.calls.model, 1); assert.equal(f.calls.deletes.length, 1); assert.equal(privateLogsAbsent(f.calls), true);
});
test('malformed provider result deletes each uploaded file before controlled rejection', async () => {
  const f = fixture({ malformed: true }); await f.service.initialize(); let rejected = false;
  try { await f.service.transcribeAudioSingleFile('synthetic.wav'); } catch { rejected = true; }
  assert.equal(rejected, true); assert.equal(f.calls.upload, 4); assert.equal(f.calls.deletes.length, 4);
});
test('later upload failure never deletes a previous attempt file again', async () => {
  const f = fixture({ modelFails: true, uploadFailsAfterFirst: true }); await f.service.initialize(); let caught;
  try { await f.service.transcribeAudioSingleFile('synthetic.wav'); } catch (error) { caught = error; }
  assert.equal(caught === f.uploadError, true); assert.equal(f.calls.upload, 4); assert.equal(f.calls.model, 1); assert.equal(f.calls.deletes.length, 1); assert.equal(privateLogsAbsent(f.calls), true);
});
