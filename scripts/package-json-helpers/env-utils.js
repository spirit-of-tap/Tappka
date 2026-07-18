import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const ROOT_DIR = path.join(__dirname, '..', '..');
export const ENV_LOCAL_PATH = path.join(ROOT_DIR, '.env.local');
export const ENV_EXAMPLE_PATH = path.join(ROOT_DIR, '.env.example');

/**
 * Parses environment variables from a string content.
 * Handles both KEY=value and KEY="value" formats.
 * @param {string} content - The content string to parse
 * @returns {Record<string, string>} Object mapping keys to values
 */
export const parseEnvContent = (content) => {
  const envVars = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const match = trimmed.match(/^([^=]+)=(.*)$/);

    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      envVars[key] = value;
    }
  }

  return envVars;
};

/**
 * Formats environment variables back to .env file format.
 * @param {Record<string, string>} envVars - Object mapping keys to values
 * @returns {string} Formatted string content
 */
export const formatEnvContent = (envVars) => {
  return Object.entries(envVars)
    .map(([key, value]) => `${key}="${value}"`)
    .join('\n');
};

/**
 * Reads and parses .env.local when present.
 * @returns {Record<string, string>} Parsed environment variables
 */
export const readEnvLocal = () => {
  if (!fs.existsSync(ENV_LOCAL_PATH)) {
    return {};
  }

  return parseEnvContent(fs.readFileSync(ENV_LOCAL_PATH, 'utf-8'));
};

/**
 * Writes environment variables to .env.local.
 * @param {Record<string, string>} envVars - Object mapping keys to values
 */
export const writeEnvLocal = (envVars) => {
  fs.writeFileSync(ENV_LOCAL_PATH, `${formatEnvContent(envVars)}\n`);
};

/**
 * Returns whether a secret-like env value is present and non-empty.
 * @param {string | undefined} value - Candidate env value
 * @returns {boolean} True when the value can be used as configured
 */
export const hasEnvValue = (value) => {
  return typeof value === 'string' && value.trim().length > 0;
};
