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

/**
 * Parses environment variables from a string content
 * Handles both KEY=value and KEY="value" formats
 * @param content - The content string to parse
 * @returns Object mapping keys to values
 */
const parseEnvContent = (content) => {
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
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      envVars[key] = value;
    }
  }
  return envVars;
};

/**
 * Formats environment variables back to .env file format
 * @param envVars - Object mapping keys to values
 * @returns Formatted string content
 */
const formatEnvContent = (envVars) => {
  return Object.entries(envVars)
    .map(([key, value]) => `${key}="${value}"`)
    .join('\n');
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

// Read existing .env.local if it exists
const envLocalPath = path.join(__dirname, '..', '.env.local');
let existingEnvVars = {};

if (fs.existsSync(envLocalPath)) {
  const existingContent = fs.readFileSync(envLocalPath, 'utf-8');
  existingEnvVars = parseEnvContent(existingContent);
}

// Merge: update existing vars with new values, keep others unchanged
const mergedEnvVars = {
  ...existingEnvVars,
  ...newEnvVars,
};

// Write merged content to .env.local
const envContent = formatEnvContent(mergedEnvVars);
fs.writeFileSync(envLocalPath, envContent + '\n');
console.log('Environment variables updated in .env.local');
