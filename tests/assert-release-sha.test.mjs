import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, test } from 'node:test';
import { assertReleaseSha, validateCandidatePolicy } from '../scripts/assert-release-sha.mjs';

const directories = [];
const guardPath = fileURLToPath(new URL('../scripts/assert-release-sha.mjs', import.meta.url));
const now = Date.parse('2026-10-01T12:00:00Z');
const approved = (sha, expiresAt = '2026-10-02T12:00:00Z') => ({ sha, status: 'approved', expiresAt });
const policy = (...candidates) => ({ version: 1, candidates });

function git(cwd, ...args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_AUTHOR_NAME: 'Disposable Fixture Test',
      GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
      GIT_COMMITTER_NAME: 'Disposable Fixture Test',
      GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
    },
  }).trim();
}

function commit(cwd, message) {
  git(cwd, 'add', '.');
  git(cwd, '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-m', message);
  return git(cwd, 'rev-parse', 'HEAD');
}

function setPolicy(cwd, value) {
  writeFileSync(join(cwd, 'release', 'candidates.json'), JSON.stringify(value));
  const main = commit(cwd, 'set candidate policy');
  git(cwd, 'update-ref', 'refs/remotes/origin/main', main);
  return main;
}

function repository() {
  const cwd = mkdtempSync(join(tmpdir(), 'assert-release-sha-'));
  directories.push(cwd);
  git(cwd, 'init', '--initial-branch=main');
  mkdirSync(join(cwd, 'release'));
  writeFileSync(join(cwd, 'release', 'candidates.json'), JSON.stringify(policy()));
  const sha = commit(cwd, 'candidate');
  git(cwd, 'remote', 'add', 'origin', join(cwd, 'inert-origin-not-contacted'));
  git(cwd, 'update-ref', 'refs/remotes/origin/main', sha);
  return { cwd, sha };
}

afterEach(() => {
  for (const cwd of directories.splice(0)) rmSync(cwd, { recursive: true, force: true });
});

test('accepts an approved ancestor using only committed origin/main policy', () => {
  const { cwd, sha } = repository();
  setPolicy(cwd, policy(approved(sha.toUpperCase())));
  git(cwd, 'checkout', '--detach', sha);
  // Candidate commit contains an empty policy; uncommitted file is invalid too.
  writeFileSync(join(cwd, 'release', 'candidates.json'), '{');
  assert.equal(assertReleaseSha(sha.toUpperCase(), { cwd, now }), sha);
});

test('rejects unapproved, revoked, expired, and exactly-expiring candidates', () => {
  const { cwd, sha } = repository();
  assert.throws(() => assertReleaseSha(sha, { cwd, now }), /unapproved/);
  setPolicy(cwd, policy({ ...approved(sha), status: 'revoked' }));
  assert.throws(() => assertReleaseSha(sha, { cwd, now }), /revoked/);
  for (const expiresAt of ['2026-09-30T12:00:00Z', '2026-10-01T12:00:00.000Z']) {
    setPolicy(cwd, policy(approved(sha, expiresAt)));
    assert.throws(() => assertReleaseSha(sha, { cwd, now }), /stale.*expired/);
  }
});

test('new fetched policy revokes an approval even when candidate-local policy still approves', () => {
  const { cwd, sha } = repository();
  const oldMain = setPolicy(cwd, policy(approved(sha)));
  assert.equal(assertReleaseSha(sha, { cwd, now }), sha);
  setPolicy(cwd, policy({ ...approved(sha), status: 'revoked' }));
  git(cwd, 'checkout', '--detach', oldMain);
  assert.throws(() => assertReleaseSha(sha, { cwd, now }), /revoked/);
});

test('approved candidates still require ancestry, existing commit, complete history and origin', () => {
  const { cwd, sha } = repository();
  const main = setPolicy(cwd, policy(approved(sha)));
  git(cwd, 'checkout', '-b', 'side', sha);
  const side = commit(cwd, 'side commit');
  git(cwd, 'checkout', 'main');
  setPolicy(cwd, policy(approved(sha), approved(side), approved('0'.repeat(40))));
  assert.throws(() => assertReleaseSha(side, { cwd, now }), /not an ancestor/);
  assert.throws(() => assertReleaseSha('0'.repeat(40), { cwd, now }), /existing local Git object/);
  git(cwd, 'config', 'remote.origin.promisor', 'true');
  assert.throws(() => assertReleaseSha(sha, { cwd, now }), /Partial clone/);
  git(cwd, 'config', '--unset', 'remote.origin.promisor');
  writeFileSync(join(cwd, '.git', 'shallow'), `${main}\n`);
  assert.throws(() => assertReleaseSha(sha, { cwd, now }), /history is shallow/);
  rmSync(join(cwd, '.git', 'shallow'));
  git(cwd, 'remote', 'remove', 'origin');
  assert.throws(() => assertReleaseSha(sha, { cwd, now }), /origin remote is required/);
});

test('rejects missing or malformed committed policies', () => {
  const { cwd, sha } = repository();
  for (const raw of ['{', 'null', '[]', '{"version":2,"candidates":[]}']) {
    writeFileSync(join(cwd, 'release', 'candidates.json'), raw);
    const main = commit(cwd, 'malformed policy');
    git(cwd, 'update-ref', 'refs/remotes/origin/main', main);
    assert.throws(() => assertReleaseSha(sha, { cwd, now }), /valid JSON|Candidate policy/);
  }
  rmSync(join(cwd, 'release', 'candidates.json'));
  const main = commit(cwd, 'missing policy');
  git(cwd, 'update-ref', 'refs/remotes/origin/main', main);
  assert.throws(() => assertReleaseSha(sha, { cwd, now }), /must contain release\/candidates.json/);
});

test('policy schema rejects duplicate SHAs, unknown fields, wrong types and status', () => {
  const sha = 'a'.repeat(40);
  for (const value of [
    {}, null, [], { version: 1, candidates: [], unexpected: true },
    { version: 1, candidates: {} }, { version: '1', candidates: [] },
    policy(null), policy({ ...approved(sha), extra: true }),
    policy({ sha, status: 'approved' }), policy(approved('main')),
    policy(approved(`${sha}\n`)), policy({ ...approved(sha), status: 'pending' }),
    policy(approved(sha), approved(sha.toUpperCase())),
  ]) assert.throws(() => validateCandidatePolicy(value), /Candidate policy/);
  assert.deepEqual(validateCandidatePolicy(policy()), []);
});

test('policy requires real UTC calendar timestamps', () => {
  const sha = 'a'.repeat(40);
  for (const invalid of [
    null, 123, 'forever', '2026-10-02', '2026-10-02T12:00:00+00:00',
    '2026-02-30T12:00:00Z', '2026-13-02T12:00:00Z',
    '2026-10-02T24:00:00Z', '2026-10-02T12:00:00.1Z',
    '2026-10-02T12:00:00Z\n',
  ]) assert.throws(() => validateCandidatePolicy(policy(approved(sha, invalid))), /expiresAt/);
  for (const valid of ['2026-10-02T12:00:00Z', '2026-10-02T12:00:00.123Z']) {
    const [candidate] = validateCandidatePolicy(policy(approved(sha, valid)));
    assert.equal(candidate.expiresAtMs, Date.parse(valid));
  }
});

test('CLI emits only normalized SHA and fails closed for invalid invocation', () => {
  const { cwd, sha } = repository();
  setPolicy(cwd, policy(approved(sha, '9999-12-31T23:59:59Z')));
  const result = spawnSync(process.execPath, [guardPath, sha.toUpperCase()], { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, `${sha}\n`);
  assert.equal(result.stderr, '');
  for (const args of [[], ['main'], ['origin/main'], [sha.slice(0, 12)], [`${sha}\n`], [sha, 'extra']]) {
    const failure = spawnSync(process.execPath, [guardPath, ...args], { cwd, encoding: 'utf8' });
    assert.equal(failure.status, 1);
    assert.equal(failure.stdout, '');
    assert.match(failure.stderr, /Release guard:/);
  }
});

test('invalid current time fails closed', () => {
  assert.throws(() => assertReleaseSha('a'.repeat(40), { now: NaN }), /valid current timestamp/);
});
