import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { validateIdentity, verifyIdentity } from '../scripts/verify-identity.mjs';

const sha = 'abcdef01'.repeat(5);
const expected = { sha, env: 'production', fixtureEnv: 'fixture-production' };
const identity = {
  fixture: 'chasum-issue-136-disposable',
  VERCEL_ENV: 'production',
  VERCEL_GIT_COMMIT_SHA: sha,
  VERCEL_GIT_COMMIT_REF: 'main',
  FIXTURE_ENV_NAME: 'fixture-production',
  VERCEL_URL: 'synthetic-deployment.invalid',
};

test('verifies exact SHA and environments, normalizing expected SHA case', () => {
  assert.equal(verifyIdentity(identity, expected), identity);
  assert.equal(verifyIdentity(identity, { ...expected, sha: sha.toUpperCase() }), identity);
});

test('local null Vercel metadata has valid shape but cannot pass production verification', () => {
  const local = {
    fixture: identity.fixture, VERCEL_ENV: null, VERCEL_GIT_COMMIT_SHA: null,
    VERCEL_GIT_COMMIT_REF: null, FIXTURE_ENV_NAME: 'local',
  };
  assert.equal(validateIdentity(local), local);
  assert.throws(() => verifyIdentity(local, expected), /SHA does not match/);
});

test('rejects unexpected fields that could leak environment secrets', () => {
  assert.throws(() => validateIdentity({ ...identity, EXTRA_SECRET: 'do-not-print' }), /unexpected field/);
});

test('rejects invalid identity shapes and marker', () => {
  for (const value of [null, [], 'identity', {},
    { ...identity, fixture: 'other' },
    { ...identity, VERCEL_ENV: 'unknown' },
    { ...identity, VERCEL_GIT_COMMIT_SHA: 'main' },
    { ...identity, VERCEL_GIT_COMMIT_SHA: sha.toUpperCase() },
    { ...identity, VERCEL_GIT_COMMIT_REF: {} },
    { ...identity, FIXTURE_ENV_NAME: null },
    { ...identity, VERCEL_URL: false }]) {
    assert.throws(() => validateIdentity(value));
  }
});

test('rejects wrong SHA, wrong environment, wrong synthetic name, and floating refs', () => {
  assert.throws(() => verifyIdentity(identity, { ...expected, sha: '1'.repeat(40) }), /SHA does not match/);
  assert.throws(() => verifyIdentity(identity, { ...expected, env: 'preview' }), /environment does not match/);
  assert.throws(() => verifyIdentity(identity, { ...expected, fixtureEnv: 'different' }), /synthetic fixture environment/);
  for (const value of ['main', sha.slice(0, 39), `${sha}\n`, '', undefined]) {
    assert.throws(() => verifyIdentity(identity, { ...expected, sha: value }), /40 hexadecimal/);
  }
});

test('compares every field and optional-field presence with baseline, independent of order', () => {
  const reversed = Object.fromEntries(Object.entries(identity).reverse());
  assert.equal(verifyIdentity(identity, { ...expected, sameAs: reversed }), identity);
  for (const field of ['VERCEL_GIT_COMMIT_REF', 'VERCEL_URL']) {
    assert.throws(() => verifyIdentity(identity, {
      ...expected, sameAs: { ...identity, [field]: 'different' },
    }), /changed from the baseline/);
  }
  const { VERCEL_URL, ...withoutUrl } = identity;
  assert.throws(() => verifyIdentity(identity, { ...expected, sameAs: withoutUrl }), /changed from the baseline/);
  assert.throws(() => verifyIdentity(identity, {
    ...expected, sameAs: { ...identity, hidden: 'no' },
  }), /unexpected field/);
});

test('CLI reads only supplied JSON files, supports baseline, and rejects bad arguments', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'fixture-identity-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, 'identity.json');
  const baselinePath = join(directory, 'baseline.json');
  writeFileSync(path, JSON.stringify(identity));
  writeFileSync(baselinePath, JSON.stringify(identity));
  const scriptPath = fileURLToPath(new URL('../scripts/verify-identity.mjs', import.meta.url));
  const args = [path, '--sha', sha, '--env', 'production', '--fixture-env', 'fixture-production'];
  const run = (extra = []) => spawnSync(process.execPath, [scriptPath, ...args, ...extra], { encoding: 'utf8' });
  const success = run(['--same-as', baselinePath]);
  assert.equal(success.status, 0, success.stderr);
  for (const extra of [['--sha', sha], ['--unknown', 'x'], ['--same-as']]) {
    assert.equal(run(extra).status, 1);
  }
  writeFileSync(baselinePath, JSON.stringify({ ...identity, VERCEL_URL: 'changed.invalid' }));
  assert.equal(run(['--same-as', baselinePath]).status, 1);
  writeFileSync(path, '{ invalid json');
  const malformed = run();
  assert.equal(malformed.status, 1);
  assert.match(malformed.stderr, /not valid JSON/);
});
