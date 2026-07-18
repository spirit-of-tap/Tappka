import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

import {
  ENV_EXAMPLE_PATH,
  ENV_LOCAL_PATH,
  hasEnvValue,
  readEnvExample,
  readEnvLocal,
  writeEnvLocal,
} from './env-utils.js';
import {
  ENV_WHEN,
  getRequiredDevEnvByWhen,
} from './required-dev-env.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');

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
 * Opens a file or URL with the platform default handler (best-effort).
 * @param {string} target - Absolute file path or URL
 */
const openInDefaultApp = (target) => {
  const platform = process.platform;
  const command =
    platform === 'darwin' ? 'open' : platform === 'win32' ? 'cmd' : 'xdg-open';
  const args =
    platform === 'win32' ? ['/c', 'start', '', target] : [target];

  spawn(command, args, { detached: true, stdio: 'ignore' }).unref();
};

/**
 * Offers to open help docs / URLs when an env entry defines them.
 * @param {import('./required-dev-env.js').RequiredDevEnvVar} entry - Required env definition
 * @param {import('readline/promises').Interface} rl - Active readline interface
 */
const offerHelpResources = async (entry, rl) => {
  if (!entry.helpUrl && !entry.helpDocPath) {
    return;
  }

  const targets = [
    entry.helpDocPath,
    entry.helpUrl ? 'Google Cloud Console' : null,
  ]
    .filter(Boolean)
    .join(' and ');

  const answer = (await rl.question(`Need more info? Open ${targets} (y/N): `))
    .trim()
    .toLowerCase();

  if (answer !== 'y' && answer !== 'yes') {
    return;
  }

  if (entry.helpDocPath) {
    const docPath = path.join(REPO_ROOT, entry.helpDocPath);

    if (fs.existsSync(docPath)) {
      openInDefaultApp(docPath);
      console.log(`Opened ${entry.helpDocPath}`);
    } else {
      console.warn(`Could not find ${entry.helpDocPath} at ${docPath}`);
    }
  }

  if (entry.helpUrl) {
    openInDefaultApp(entry.helpUrl);
    console.log(`Opened ${entry.helpUrl}`);
  }
};

/**
 * Resolves the value to keep when the developer presses Enter.
 * Prefers the current .env.local value, then falls back to .env.example.
 * @param {string} key - Environment variable name
 * @param {Record<string, string>} envVars - Current env vars from .env.local
 * @returns {string | undefined} Default value when present
 */
const resolveKeepDefault = (key, envVars) => {
  if (hasEnvValue(envVars[key])) {
    return envVars[key].trim();
  }

  const exampleVars = readEnvExample();

  if (hasEnvValue(exampleVars[key])) {
    return exampleVars[key].trim();
  }

  return undefined;
};

/**
 * Whether ensure-env should interactively prompt for this entry.
 * @param {import('./required-dev-env.js').RequiredDevEnvVar} entry - Required env definition
 * @param {Record<string, string>} envVars - Current env vars from .env.local
 * @param {boolean} oauthSetupIncompleteAtStart - Secret was missing when ensure-env started
 * @returns {boolean} True when a prompt should run
 */
const shouldPromptForEntry = (entry, envVars, oauthSetupIncompleteAtStart) => {
  if (!entry.prompt) {
    return false;
  }

  if (!hasEnvValue(envVars[entry.key])) {
    return true;
  }

  // Re-confirm keepable defaults (e.g. client ID) during the same onboarding
  // run that collects the OAuth secret.
  return Boolean(entry.keepOnEmpty && oauthSetupIncompleteAtStart);
};

/**
 * Prompts for a required env value and writes it to .env.local.
 * @param {import('./required-dev-env.js').RequiredDevEnvVar} entry - Required env definition
 * @param {Record<string, string>} envVars - Current env vars from .env.local
 * @returns {Promise<Record<string, string>>} Updated env vars
 */
const promptForEnvVar = async (entry, envVars) => {
  if (!process.stdin.isTTY) {
    console.error(
      `${entry.key} is missing from .env.local.\n` +
        (entry.description ? `${entry.description}\n` : '') +
        'Add it manually, then re-run. Interactive prompts require a TTY.'
    );
    process.exit(1);
  }

  const description = entry.description
    ? `${entry.description}\n`
    : '';
  const keepDefault = entry.keepOnEmpty
    ? resolveKeepDefault(entry.key, envVars)
    : undefined;

  console.log(`\n${entry.key} is required for local development.\n${description}`);

  const rl = readline.createInterface({ input, output });

  try {
    await offerHelpResources(entry, rl);

    const promptLabel = keepDefault
      ? `${entry.key} [${keepDefault}]: `
      : `${entry.key}: `;
    const rawValue = (await rl.question(promptLabel)).trim();

    let value = rawValue;

    if (!hasEnvValue(value)) {
      if (entry.keepOnEmpty && hasEnvValue(keepDefault)) {
        value = keepDefault;
        console.log(`Keeping ${entry.key} from .env.example / .env.local`);
      } else {
        console.error(`${entry.key} cannot be empty.`);
        process.exit(1);
      }
    }

    const updatedEnvVars = {
      ...envVars,
      [entry.key]: value,
    };

    if (envVars[entry.key] !== value) {
      writeEnvLocal(updatedEnvVars);
      console.log(`Saved ${entry.key} to .env.local`);
    }

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
  const oauthSetupIncompleteAtStart = !hasEnvValue(envVars.GOOGLE_CLIENT_SECRET);
  const requiredBeforeSupabase = getRequiredDevEnvByWhen(ENV_WHEN.BEFORE_SUPABASE);

  for (const entry of requiredBeforeSupabase) {
    if (!shouldPromptForEntry(entry, envVars, oauthSetupIncompleteAtStart)) {
      if (hasEnvValue(envVars[entry.key])) {
        console.log(`${entry.key} is set in .env.local`);
        continue;
      }

      console.error(
        `${entry.key} is missing from .env.local.\n` +
          (entry.description ? `${entry.description}\n` : '') +
          'Copy it from .env.example or ask a teammate, then re-run.'
      );
      process.exit(1);
    }

    envVars = await promptForEnvVar(entry, envVars);
  }
};

main().catch((error) => {
  console.error('Failed to ensure environment credentials:', error.message);
  process.exit(1);
});
