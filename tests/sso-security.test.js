import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readJwtSecret } from '../src/middleware/sso-config.js';

const secret = 'isolated-test-signing-secret-'.repeat(3);
test('missing, short and former public fallback keys fail closed', () => {
  for (const value of [undefined, '', 'short', 'wannav-secret-key-change-in-production']) {
    assert.throws(() => readJwtSecret({ JWT_SECRET: value }), /JWT_SECRET must/);
  }
  assert.equal(readJwtSecret({ JWT_SECRET: secret }), secret);
});
test('middleware import refuses to start without configured signing key', () => {
  const env = { ...process.env }; delete env.JWT_SECRET;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', "await import('./src/middleware/sso-auth.js')"], { cwd: new URL('..', import.meta.url), env, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /JWT_SECRET must/);
});
test('configured HS256 SSO succeeds; fallback and other algorithms fail', async () => {
  process.env.JWT_SECRET = secret;
  const { Hono } = await import('hono');
  const { default: jwt } = await import('jsonwebtoken');
  const { ssoAuthMiddleware } = await import('../src/middleware/sso-auth.js');
  const app = new Hono(); app.use('*', ssoAuthMiddleware);
  app.get('/', c => c.json({ id: c.get('user').id }));
  const payload = { type: 'sso', userId: 42, username: 'test', role: 'admin' };
  const request = token => app.request('http://localhost/', { headers: { Cookie: `wannav_sso=${token}` } });
  const valid = await request(jwt.sign(payload, secret, { expiresIn: '1h' }));
  assert.equal(valid.status, 200); assert.deepEqual(await valid.json(), { id: 42 });
  for (const token of [jwt.sign(payload, 'wannav-secret-key-change-in-production'), jwt.sign(payload, secret, { algorithm: 'HS384' }), jwt.sign({ ...payload, type: 'access' }, secret), jwt.sign(payload, secret, { expiresIn: -1 })]) {
    assert.equal((await request(token)).status, 302);
  }
});
