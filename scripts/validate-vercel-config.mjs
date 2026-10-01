import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const schema = 'https://openapi.vercel.sh/vercel.json';

function object(value, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} must be a JSON object.`);
  }
}

function keys(value, allowed, name) {
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new Error(`${name} contains an unsupported property.`);
  }
}

/**
 * A deliberately narrow, offline schema-style validator for this fixture.
 * This is not an implementation of the complete upstream Vercel schema.
 * Supporting only these two configurations prevents accidentally blocking Preview.
 */
export function validateVercelConfig(config) {
  object(config, 'Vercel configuration');
  keys(config, ['$schema', 'git'], 'Vercel configuration');
  if (config.$schema !== schema) {
    throw new Error('Vercel configuration must declare the expected $schema URL.');
  }
  if (Object.hasOwn(config, 'git')) {
    object(config.git, 'git');
    keys(config.git, ['deploymentEnabled'], 'git');
    object(config.git.deploymentEnabled, 'git.deploymentEnabled');
    keys(config.git.deploymentEnabled, ['main'], 'git.deploymentEnabled');
    if (config.git.deploymentEnabled.main !== false) {
      throw new Error('The only allowed deployment rule is git.deploymentEnabled.main=false.');
    }
  }
  return config;
}

export function validateVercelConfigFile(path) {
  let config;
  try {
    config = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('Vercel configuration is not valid JSON.');
    throw error;
  }
  return validateVercelConfig(config);
}

function main() {
  try {
    if (process.argv.length > 3) {
      throw new Error('Usage: node scripts/validate-vercel-config.mjs [path]');
    }
    const path = process.argv[2] ?? 'vercel.json';
    validateVercelConfigFile(path);
    process.stdout.write(`Valid fixture Vercel configuration: ${path}\n`);
  } catch (error) {
    process.stderr.write(`Configuration validation failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
