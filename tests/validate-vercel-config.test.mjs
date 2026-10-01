import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { validateVercelConfig, validateVercelConfigFile } from '../scripts/validate-vercel-config.mjs';

const schema = 'https://openapi.vercel.sh/vercel.json';
const validPath = fileURLToPath(new URL('../fixtures/vercel-main-disabled.json', import.meta.url));
const invalidPath = fileURLToPath(new URL('../fixtures/vercel-malformed.json', import.meta.url));
const scriptPath = fileURLToPath(new URL('../scripts/validate-vercel-config.mjs', import.meta.url));

test('accepts the initial config without any deployment rule', () => {
  assert.deepEqual(validateVercelConfig({ $schema: schema }), { $schema: schema });
});

test('accepts the stored main-only disabled variant', () => {
  assert.deepEqual(validateVercelConfigFile(validPath), {
    $schema: schema,
    git: { deploymentEnabled: { main: false } },
  });
});

test('the intentionally malformed stored sample fails JSON parsing', () => {
  assert.throws(() => validateVercelConfigFile(invalidPath), /not valid JSON/);
});

test('parseable but invalid shapes, typos, global blocks, and Preview blocks fail', () => {
  const invalid = [
    null, [], 'config', {}, { $schema: 'other' },
    { $schema: schema, crons: [] },
    { $schema: schema, git: null },
    { $schema: schema, git: [] },
    { $schema: schema, git: {} },
    { $schema: schema, git: { deploymentEnabled: false } },
    { $schema: schema, git: { deploymentEnabled: true } },
    { $schema: schema, git: { deploymentEnabled: { '*': false } } },
    { $schema: schema, git: { deploymentEnabled: { main: false, preview: false } } },
    { $schema: schema, git: { deploymentEnabled: {} } },
    { $schema: schema, git: { deploymentEnabled: { main: true } } },
    { $schema: schema, git: { deploymentEnabled: { main: 'false' } } },
    { $schema: schema, git: { deploymentEnabled: { main: false }, typo: true } },
  ];
  for (const config of invalid) assert.throws(() => validateVercelConfig(config));
});

test('CLI returns failure for the stored malformed sample and success for valid variant', () => {
  const valid = spawnSync(process.execPath, [scriptPath, validPath], { encoding: 'utf8' });
  assert.equal(valid.status, 0, valid.stderr);
  const invalid = spawnSync(process.execPath, [scriptPath, invalidPath], { encoding: 'utf8' });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /not valid JSON/);
});
