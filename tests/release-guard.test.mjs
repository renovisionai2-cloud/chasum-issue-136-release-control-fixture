import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, test } from 'node:test';
import { validateReleaseSha } from '../scripts/release-guard.mjs';

const temporaryDirectories = [];
const guardPath = fileURLToPath(new URL('../scripts/release-guard.mjs', import.meta.url));

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

function tempDirectory() {
  const directory = mkdtempSync(join(tmpdir(), 'release-guard-test-'));
  temporaryDirectories.push(directory);
  return directory;
}

function commit(cwd, label) {
  writeFileSync(join(cwd, 'fixture.txt'), `${label}\n`);
  git(cwd, 'add', 'fixture.txt');
  git(cwd, '-c', 'commit.gpgsign=false', 'commit', '-m', label);
  return git(cwd, 'rev-parse', 'HEAD');
}

function repository() {
  const cwd = tempDirectory();
  git(cwd, 'init', '--initial-branch=main');
  const first = commit(cwd, 'first');
  const second = commit(cwd, 'second');
  return { cwd, first, second };
}

function originAt(cwd, sha) {
  git(cwd, 'remote', 'add', 'origin', join(cwd, 'inert-origin-not-contacted'));
  git(cwd, 'update-ref', 'refs/remotes/origin/main', sha);
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('rejects an existing commit without origin', () => {
  const { cwd, first } = repository();
  assert.throws(() => validateReleaseSha(first, { cwd }), /origin remote is required/);
});

test('normalizes uppercase hex with origin configured', () => {
  const { cwd, first, second } = repository();
  originAt(cwd, second);
  assert.equal(validateReleaseSha(first.toUpperCase(), { cwd }), first);
});

test('rejects missing SHAs, abbreviated SHAs, floating refs, revision expressions, and whitespace', () => {
  const { cwd, first } = repository();
  for (const sha of [
    undefined, null, 123, '', 'main', 'HEAD', 'origin/main', 'refs/heads/main',
    'v1.0.0', 'HEAD~1', `${first}^{commit}`, first.slice(0, 12),
    ` ${first}`, `${first}\n`, 'g'.repeat(40), '-'.repeat(40), 'a'.repeat(41),
  ]) {
    assert.throws(() => validateReleaseSha(sha, { cwd }), /exactly 40 hexadecimal/);
  }
});

test('rejects a full SHA that does not exist', () => {
  const { cwd } = repository();
  assert.throws(() => validateReleaseSha('0'.repeat(40), { cwd }), /existing local Git object/);
});

test('rejects annotated tag, tree, and blob object SHAs', () => {
  const { cwd, first } = repository();
  git(cwd, '-c', 'tag.gpgsign=false', 'tag', '-a', 'fixture-tag', '-m', 'inert tag', first);
  const tag = git(cwd, 'rev-parse', 'refs/tags/fixture-tag');
  const tree = git(cwd, 'rev-parse', 'HEAD^{tree}');
  const blob = git(cwd, 'rev-parse', 'HEAD:fixture.txt');
  for (const [sha, type] of [[tag, 'tag'], [tree, 'tree'], [blob, 'blob']]) {
    assert.throws(() => validateReleaseSha(sha, { cwd }), new RegExp(`commit, not a ${type}`));
  }
});

test('accepts an ancestor of and a commit equal to origin/main', () => {
  const { cwd, first, second } = repository();
  originAt(cwd, second);
  assert.equal(validateReleaseSha(first, { cwd }), first);
  assert.equal(validateReleaseSha(second, { cwd }), second);
});

test('rejects a descendant of origin/main and commits from another branch', () => {
  const { cwd, first, second } = repository();
  originAt(cwd, first);
  assert.throws(() => validateReleaseSha(second, { cwd }), /not an ancestor/);
  git(cwd, 'checkout', '-b', 'side', first);
  const side = commit(cwd, 'side');
  git(cwd, 'update-ref', 'refs/remotes/origin/main', second);
  assert.throws(() => validateReleaseSha(side, { cwd }), /not an ancestor/);
});

test('fails closed when origin is configured but origin/main is missing', () => {
  const { cwd, first } = repository();
  git(cwd, 'remote', 'add', 'origin', join(cwd, 'inert-origin-not-contacted'));
  assert.throws(() => validateReleaseSha(first, { cwd }), /origin\/main is missing/);
});

test('fails closed when origin/main points at a non-commit object', () => {
  const { cwd, first } = repository();
  const blob = git(cwd, 'rev-parse', 'HEAD:fixture.txt');
  originAt(cwd, blob);
  assert.throws(() => validateReleaseSha(first, { cwd }), /Origin\/main must identify a commit/);
});

test('fails closed for a shallow clone even when the candidate equals origin/main', () => {
  const { cwd: source, second } = repository();
  const cwd = tempDirectory();
  git(cwd, 'clone', '--depth=1', '--branch=main', pathToFileURL(source).href, '.');
  assert.equal(git(cwd, 'rev-parse', '--is-shallow-repository'), 'true');
  assert.throws(() => validateReleaseSha(second, { cwd }), /history is shallow/);
});

test('CLI fails closed without origin and emits no SHA', () => {
  const { cwd, first } = repository();
  const result = spawnSync(process.execPath, [guardPath, first], { cwd, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /origin remote is required/);
});

test('CLI emits only the normalized SHA on stdout after validation', () => {
  const { cwd, first, second } = repository();
  originAt(cwd, second);
  const result = spawnSync(process.execPath, [guardPath, first.toUpperCase()], { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, `${first}\n`);
  assert.equal(result.stderr, '');
});

test('CLI fails for floating refs and extra arguments without printing a SHA', () => {
  const { cwd, first } = repository();
  for (const args of [['main'], [], [first, 'extra']]) {
    const result = spawnSync(process.execPath, [guardPath, ...args], { cwd, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /Release guard:/);
  }
});
