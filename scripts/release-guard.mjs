import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function git(cwd, args) {
  const result = spawnSync('git', ['--no-replace-objects', ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0' },
  });
  if (result.error) throw new Error(`Cannot run Git: ${result.error.message}`);
  return result;
}

function checkedGit(cwd, args, message) {
  const result = git(cwd, args);
  if (result.status !== 0) throw new Error(message);
  return result.stdout.trim();
}

function hasOrigin(cwd) {
  const remotes = checkedGit(cwd, ['remote'], 'Cannot inspect Git remotes.');
  return remotes.split('\n').includes('origin');
}

/** Validate only local Git state. The caller must fetch origin/main first. */
export function validateReleaseSha(sha, { cwd = process.cwd() } = {}) {
  if (typeof sha !== 'string' || sha.length !== 40 || !/^[0-9a-fA-F]{40}$/.test(sha)) {
    throw new Error('Release SHA must be exactly 40 hexadecimal characters; refs are not accepted.');
  }
  const normalizedSha = sha.toLowerCase();
  const promisor = git(cwd, ['config', '--get-regexp', '^remote\\..*\\.promisor$']);
  if (promisor.status !== 0 && promisor.status !== 1) {
    throw new Error('Cannot inspect partial clone configuration.');
  }
  if (promisor.stdout.trim()) {
    throw new Error('Partial clone configuration is not allowed; use a complete local clone before release.');
  }
  const objectType = checkedGit(
    cwd,
    ['cat-file', '-t', normalizedSha],
    'Release SHA does not identify an existing local Git object.',
  );
  if (objectType !== 'commit') {
    throw new Error(`Release SHA must identify a commit, not a ${objectType}.`);
  }

  if (!hasOrigin(cwd)) {
    throw new Error('An origin remote is required; fetch origin/main before release.');
  }
  const shallow = checkedGit(
    cwd,
    ['rev-parse', '--is-shallow-repository'],
    'Cannot determine whether Git history is complete.',
  );
  if (shallow !== 'false') {
    throw new Error('Origin is configured, but Git history is shallow; fetch complete history before release.');
  }
  checkedGit(
    cwd,
    ['show-ref', '--verify', '--quiet', 'refs/remotes/origin/main'],
    'Origin is configured, but origin/main is missing; fetch origin/main before release.',
  );
  const mainType = checkedGit(
    cwd,
    ['cat-file', '-t', 'refs/remotes/origin/main'],
    'Cannot inspect origin/main.',
  );
  if (mainType !== 'commit') throw new Error('Origin/main must identify a commit.');
  const ancestry = git(cwd, [
    'merge-base', '--is-ancestor', normalizedSha, 'refs/remotes/origin/main',
  ]);
  if (ancestry.status === 1) {
    throw new Error('Release SHA is not an ancestor of or equal to origin/main.');
  }
  if (ancestry.status !== 0) throw new Error('Cannot verify release SHA ancestry against origin/main.');

  return normalizedSha;
}

function main() {
  try {
    if (process.argv.length !== 3) {
      throw new Error('Usage: node scripts/release-guard.mjs <40-character-commit-sha>');
    }
    const sha = validateReleaseSha(process.argv[2]);
    process.stdout.write(`${sha}\n`);
  } catch (error) {
    process.stderr.write(`Release guard: ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
