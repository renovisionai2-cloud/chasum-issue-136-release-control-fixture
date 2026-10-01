import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const marker = 'chasum-issue-136-disposable';
const required = [
  'fixture', 'VERCEL_ENV', 'VERCEL_GIT_COMMIT_SHA',
  'VERCEL_GIT_COMMIT_REF', 'FIXTURE_ENV_NAME',
];
const allowed = [...required, 'VERCEL_URL'];
const environments = ['production', 'preview', 'development'];

function nullableString(value, name) {
  if (value !== null && (typeof value !== 'string' || value.length === 0)) {
    throw new Error(`${name} must be a nonempty string or null.`);
  }
}

export function validateIdentity(identity) {
  if (identity === null || typeof identity !== 'object' || Array.isArray(identity)) {
    throw new Error('Identity must be a JSON object.');
  }
  if (Object.keys(identity).some((key) => !allowed.includes(key))) {
    throw new Error('Identity contains an unexpected field; refusing a possible data leak.');
  }
  if (required.some((key) => !Object.hasOwn(identity, key))) {
    throw new Error('Identity is missing a required field.');
  }
  if (identity.fixture !== marker) throw new Error('Identity fixture marker does not match.');
  if (identity.VERCEL_ENV !== null && !environments.includes(identity.VERCEL_ENV)) {
    throw new Error('VERCEL_ENV is not a recognized environment.');
  }
  if (identity.VERCEL_GIT_COMMIT_SHA !== null &&
      (typeof identity.VERCEL_GIT_COMMIT_SHA !== 'string' ||
       identity.VERCEL_GIT_COMMIT_SHA.length !== 40 ||
       !/^[0-9a-f]{40}$/.test(identity.VERCEL_GIT_COMMIT_SHA))) {
    throw new Error('VERCEL_GIT_COMMIT_SHA must be a lowercase 40-character SHA or null.');
  }
  nullableString(identity.VERCEL_GIT_COMMIT_REF, 'VERCEL_GIT_COMMIT_REF');
  if (typeof identity.FIXTURE_ENV_NAME !== 'string' || identity.FIXTURE_ENV_NAME.length === 0) {
    throw new Error('FIXTURE_ENV_NAME must be a nonempty synthetic name.');
  }
  if (Object.hasOwn(identity, 'VERCEL_URL')) nullableString(identity.VERCEL_URL, 'VERCEL_URL');
  return identity;
}

/** Verify downloaded JSON only. This module makes no network requests. */
export function verifyIdentity(identity, { sha, env, fixtureEnv, sameAs } = {}) {
  if (typeof sha !== 'string' || sha.length !== 40 || !/^[0-9a-fA-F]{40}$/.test(sha)) {
    throw new Error('Expected SHA must be exactly 40 hexadecimal characters.');
  }
  if (!environments.includes(env)) throw new Error('Expected environment is invalid.');
  if (typeof fixtureEnv !== 'string' || fixtureEnv.length === 0) {
    throw new Error('Expected synthetic fixture environment is required.');
  }
  validateIdentity(identity);
  if (identity.VERCEL_GIT_COMMIT_SHA !== sha.toLowerCase()) {
    throw new Error('Identity SHA does not match the exact expected commit.');
  }
  if (identity.VERCEL_ENV !== env) throw new Error('Identity environment does not match.');
  if (identity.FIXTURE_ENV_NAME !== fixtureEnv) {
    throw new Error('Identity synthetic fixture environment does not match.');
  }
  if (sameAs !== undefined) {
    validateIdentity(sameAs);
    if (allowed.some((key) => Object.hasOwn(identity, key) !== Object.hasOwn(sameAs, key) ||
      identity[key] !== sameAs[key])) {
      throw new Error('Identity changed from the baseline.');
    }
  }
  return identity;
}

function readIdentity(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('Identity file is not valid JSON.');
    throw error;
  }
}

function main() {
  try {
    const usage = 'Usage: node scripts/verify-identity.mjs <file> --sha <sha> --env <production|preview|development> --fixture-env <name> [--same-as <baseline file>]';
    const [path, ...args] = process.argv.slice(2);
    if (!path || path.startsWith('--') || args.length % 2 !== 0) throw new Error(usage);
    const flags = new Map();
    const known = ['--sha', '--env', '--fixture-env', '--same-as'];
    for (let index = 0; index < args.length; index += 2) {
      const [key, value] = args.slice(index, index + 2);
      if (!known.includes(key) || flags.has(key) || !value || value.startsWith('--')) {
        throw new Error(usage);
      }
      flags.set(key, value);
    }
    if (known.slice(0, 3).some((key) => !flags.has(key))) throw new Error(usage);
    verifyIdentity(readIdentity(path), {
      sha: flags.get('--sha'),
      env: flags.get('--env'),
      fixtureEnv: flags.get('--fixture-env'),
      sameAs: flags.has('--same-as') ? readIdentity(flags.get('--same-as')) : undefined,
    });
    process.stdout.write('Fixture identity verified against the exact expected SHA and environment.\n');
  } catch (error) {
    process.stderr.write(`Identity verification failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
