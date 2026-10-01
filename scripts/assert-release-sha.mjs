import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateReleaseSha } from './release-guard.mjs';

const POLICY_PATH = 'release/candidates.json';

function checkedGit(cwd, args, message) {
  const result = spawnSync('git', ['--no-replace-objects', ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    // A partial clone must fail closed rather than lazily retrieving objects.
    env: { ...process.env, GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0' },
  });
  if (result.error || result.status !== 0) throw new Error(message);
  return result.stdout.trim();
}

function exactKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
}

/** Strict schema validation; empty candidates intentionally authorize nothing. */
export function validateCandidatePolicy(policy) {
  if (!exactKeys(policy, ['version', 'candidates']) || policy.version !== 1
    || !Array.isArray(policy.candidates)) {
    throw new Error('Candidate policy must contain only version: 1 and a candidates array.');
  }

  const seen = new Set();
  return policy.candidates.map((candidate, index) => {
    const label = `Candidate policy entry ${index}`;
    if (!exactKeys(candidate, ['sha', 'status', 'expiresAt'])) {
      throw new Error(`${label} must contain only sha, status, and expiresAt.`);
    }
    if (typeof candidate.sha !== 'string' || candidate.sha.length !== 40
      || !/^[0-9a-fA-F]{40}$/.test(candidate.sha)) {
      throw new Error(`${label} sha must be exactly 40 hexadecimal characters.`);
    }
    const sha = candidate.sha.toLowerCase();
    if (seen.has(sha)) throw new Error(`Candidate policy contains duplicate SHA ${sha}.`);
    seen.add(sha);
    if (!['approved', 'revoked'].includes(candidate.status)) {
      throw new Error(`${label} status must be approved or revoked.`);
    }
    if (typeof candidate.expiresAt !== 'string'
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(candidate.expiresAt)) {
      throw new Error(`${label} expiresAt must be a UTC ISO timestamp with seconds and optional milliseconds.`);
    }
    const expiresAtMs = Date.parse(candidate.expiresAt);
    const canonical = candidate.expiresAt.includes('.')
      ? candidate.expiresAt : candidate.expiresAt.replace(/Z$/, '.000Z');
    if (!Number.isFinite(expiresAtMs) || new Date(expiresAtMs).toISOString() !== canonical) {
      throw new Error(`${label} expiresAt must be a valid calendar timestamp.`);
    }
    return { sha, status: candidate.status, expiresAt: candidate.expiresAt, expiresAtMs };
  });
}

/**
 * No network calls. Caller MUST fetch complete origin/main immediately before
 * this check and repeat after any approval wait. Policy comes from that fetched
 * main commit, never the candidate checkout or an uncommitted local file.
 */
export function assertReleaseSha(sha, { cwd = process.cwd(), now = Date.now() } = {}) {
  if (!Number.isFinite(now)) throw new Error('Release guard requires a valid current timestamp.');
  const normalizedSha = validateReleaseSha(sha, { cwd });
  const mainSha = checkedGit(cwd, ['rev-parse', '--verify', 'refs/remotes/origin/main'],
    'Cannot resolve fetched origin/main.');
  // Bind policy and ancestry to the same immutable main object, even if a local
  // process changes the remote-tracking ref between the two checks.
  checkedGit(cwd, ['merge-base', '--is-ancestor', normalizedSha, mainSha],
    'Release SHA is not an ancestor of or equal to the policy origin/main commit.');
  const rawPolicy = checkedGit(cwd, ['show', `${mainSha}:${POLICY_PATH}`],
    `Fetched origin/main must contain ${POLICY_PATH}.`);
  let policy;
  try {
    policy = JSON.parse(rawPolicy);
  } catch {
    throw new Error(`Fetched origin/main:${POLICY_PATH} must be valid JSON.`);
  }
  const candidates = validateCandidatePolicy(policy);
  const candidate = candidates.find((entry) => entry.sha === normalizedSha);
  if (!candidate) throw new Error('Release SHA is unapproved: absent from the fetched main candidate policy.');
  if (candidate.status !== 'approved') throw new Error('Release candidate is revoked.');
  if (candidate.expiresAtMs <= now) throw new Error('Release candidate is stale: approval has expired.');
  return normalizedSha;
}

function main() {
  try {
    if (process.argv.length !== 3) {
      throw new Error('Usage: node scripts/assert-release-sha.mjs <40-character-commit-sha>');
    }
    process.stdout.write(`${assertReleaseSha(process.argv[2])}\n`);
  } catch (error) {
    process.stderr.write(`Release guard: ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
