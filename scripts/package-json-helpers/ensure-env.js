import fs from 'fs';
import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

import {
  ENV_EXAMPLE_PATH,
  ENV_LOCAL_PATH,
  hasEnvValue,
  readEnvLocal,
  writeEnvLocal,
} from './env-utils.js';
import {
  ENV_WHEN,
  getRequiredDevEnvByWhen,
} from './required-dev-env.js';

/**
 * Copies .env.example to .env.local when .env.local is missing.
 */
const ensureEnvLocalExists = () => {
  if (fs.existsSync(ENV_LOCAL_PATH)) {
    return;
  }

  if (!fs.existsSync(ENV_EXAMPLE_PATH)) {
    console.error(
      `Missing ${ENV_EXAMPLE_PATH}. Cannot create .env.local without an example file.`
    );
    process.exit(1);
  }

  fs.copyFileSync(ENV_EXAMPLE_PATH, ENV_LOCAL_PATH);
  console.log('Created .env.local from .env.example');
};

/**
 * Prompts for a missing required env value and writes it to .env.local.
 * @param {import('./required-dev-env.js').RequiredDevEnvVar} entry - Required env definition
 * @param {Record<string, string>} envVars - Current env vars from .env.local
 * @returns {Promise<Record<string, string>>} Updated env vars
 */
const promptForEnvVar = async (entry, envVars) => {
  if (!process.stdin.isTTY) {
    console.error(
      `${entry.key} is missing from .env.local.\n` +
        'Add it manually, then re-run. Interactive prompts require a TTY.'
    );
    process.exit(1);
  }

  const description = entry.description
    ? `${entry.description}\n`
    : '';

  console.log(`\n${entry.key} is required for local development.\n${description}`);

  const rl = readline.createInterface({ input, output });

  try {
    const value = (await rl.question(`${entry.key}: `)).trim();

    if (!hasEnvValue(value)) {
      console.error(`${entry.key} cannot be empty.`);
      process.exit(1);
    }

    const updatedEnvVars = {
      ...envVars,
      [entry.key]: value,
    };

    writeEnvLocal(updatedEnvVars);
    console.log(`Saved ${entry.key} to .env.local`);

    return updatedEnvVars;
  } finally {
    rl.close();
  }
};

/**
 * Ensures .env.local exists and all before-supabase required vars are set.
 */
const main = async () => {
  ensureEnvLocalExists();

  let envVars = readEnvLocal();
  const requiredBeforeSupabase = getRequiredDevEnvByWhen(ENV_WHEN.BEFORE_SUPABASE);

  for (const entry of requiredBeforeSupabase) {
    if (hasEnvValue(envVars[entry.key])) {
      console.log(`${entry.key} is set in .env.local`);
      continue;
    }

    if (entry.prompt) {
      envVars = await promptForEnvVar(entry, envVars);
      continue;
    }

    console.error(
      `${entry.key} is missing from .env.local.\n` +
        (entry.description ? `${entry.description}\n` : '') +
        'Copy it from .env.example or ask a teammate, then re-run.'
    );
    process.exit(1);
  }
};

main().catch((error) => {
  console.error('Failed to ensure environment credentials:', error.message);
  process.exit(1);
});
