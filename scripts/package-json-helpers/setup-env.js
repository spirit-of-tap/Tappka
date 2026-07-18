import { execSync } from 'child_process';

import {
  ENV_LOCAL_PATH,
  hasEnvValue,
  readEnvLocal,
  writeEnvLocal,
} from './env-utils.js';
import {
  ENV_WHEN,
  getRequiredDevEnvByWhen,
} from './required-dev-env.js';

// Key mapping from supabase status to Next.js env vars
const keyMapping = {
  API_URL: 'NEXT_PUBLIC_SUPABASE_URL',
  ANON_KEY: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  PUBLISHABLE_KEY: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  SERVICE_ROLE_KEY: 'SUPABASE_SERVICE_ROLE_KEY',
};

// Run supabase status and parse output
const output = execSync('pnpm supabase status -o env', { encoding: 'utf-8' });
const newEnvVars = {};

for (const line of output.split('\n')) {
  const match = line.match(/^(\w+)="(.+)"$/);
  if (match && keyMapping[match[1]]) {
    newEnvVars[keyMapping[match[1]]] = match[2];
  }
}

// Merge: update existing vars with new values, keep others unchanged
const existingEnvVars = readEnvLocal();
const mergedEnvVars = {
  ...existingEnvVars,
  ...newEnvVars,
};

writeEnvLocal(mergedEnvVars);

const missingAfterSupabase = getRequiredDevEnvByWhen(ENV_WHEN.AFTER_SUPABASE)
  .filter((entry) => !hasEnvValue(mergedEnvVars[entry.key]))
  .map((entry) => entry.key);

if (missingAfterSupabase.length > 0) {
  console.error(
    'setup-env wrote .env.local but these required vars are still missing:\n' +
      missingAfterSupabase.map((key) => `  - ${key}`).join('\n') +
      '\nIs local Supabase running? Try: pnpm supabase:start'
  );
  process.exit(1);
}

console.log(`Environment variables updated in ${ENV_LOCAL_PATH}`);
