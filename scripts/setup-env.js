// scripts/setup-env.js
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Key mapping from supabase status to Next.js env vars
const keyMapping = {
  API_URL: 'NEXT_PUBLIC_SUPABASE_URL',
  ANON_KEY: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  PUBLISHABLE_KEY: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
};

// Run supabase status and parse output
const output = execSync('pnpm supabase status -o env', { encoding: 'utf-8' });
const envVars = {};

for (const line of output.split('\n')) {
  const match = line.match(/^(\w+)="(.+)"$/);
  if (match && keyMapping[match[1]]) {
    envVars[keyMapping[match[1]]] = match[2];
  }
}

// Write to .env.local
const envContent = Object.entries(envVars)
  .map(([key, value]) => `${key}=${value}`)
  .join('\n');

fs.writeFileSync(path.join(__dirname, '..', '.env.local'), envContent + '\n');
console.log('Environment variables written to .env.local');
