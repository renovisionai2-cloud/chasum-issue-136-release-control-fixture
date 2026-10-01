import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GET, dynamic, runtime } from '../app/api/identity/route.ts';

const keys = ['VERCEL_ENV', 'VERCEL_GIT_COMMIT_SHA', 'VERCEL_GIT_COMMIT_REF',
  'FIXTURE_ENV_NAME', 'VERCEL_URL', 'VERCEL_TOKEN'];

function withEnvironment(values, callback) {
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) {
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  }
  try { return callback(); } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

test('actual identity route returns only public request-time metadata and never credentials', async () => {
  const response = withEnvironment({
    VERCEL_ENV: 'production',
    VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
    VERCEL_GIT_COMMIT_REF: 'main',
    FIXTURE_ENV_NAME: 'fixture-production',
    VERCEL_URL: 'disposable.example.invalid',
    VERCEL_TOKEN: 'synthetic-do-not-return',
  }, GET);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(await response.json(), {
    fixture: 'chasum-issue-136-disposable',
    VERCEL_ENV: 'production',
    VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
    VERCEL_GIT_COMMIT_REF: 'main',
    FIXTURE_ENV_NAME: 'fixture-production',
    VERCEL_URL: 'disposable.example.invalid',
  });
  assert.equal(dynamic, 'force-dynamic');
  assert.equal(runtime, 'nodejs');
});

test('actual identity route supplies local defaults without inventing Git metadata', async () => {
  const response = withEnvironment({}, GET);
  assert.deepEqual(await response.json(), {
    fixture: 'chasum-issue-136-disposable',
    VERCEL_ENV: null,
    VERCEL_GIT_COMMIT_SHA: null,
    VERCEL_GIT_COMMIT_REF: null,
    FIXTURE_ENV_NAME: 'local',
  });
});
