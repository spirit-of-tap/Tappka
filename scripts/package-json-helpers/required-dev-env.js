/**
 * Source of truth for required local development environment variables.
 *
 * - before-supabase: must be present before `supabase start` (ensure-env)
 * - after-supabase: filled by setup-env from `supabase status`; asserted afterward
 *
 * Optional vars (PostHog, Google Books, CRON_SECRET, etc.) are intentionally omitted.
 */

export const ENV_WHEN = {
  BEFORE_SUPABASE: 'before-supabase',
  AFTER_SUPABASE: 'after-supabase',
};

/** Google Cloud OAuth client creation URL (also documented in CONTRIBUTING.md). */
export const GOOGLE_OAUTH_CLIENT_CREATE_URL =
  'https://console.cloud.google.com/auth/clients/create';

/**
 * @typedef {object} RequiredDevEnvVar
 * @property {string} key - Environment variable name
 * @property {'before-supabase' | 'after-supabase'} when - Validation phase
 * @property {boolean} prompt - Whether ensure-env should interactively ask for a value
 * @property {string} [description] - Prompt / error context shown to the developer
 * @property {boolean} [keepOnEmpty] - Empty input keeps the current or .env.example value
 * @property {string} [helpUrl] - URL to open when the developer asks for more info
 * @property {string} [helpDocPath] - Repo-relative path to open for more info (e.g. CONTRIBUTING.md)
 */

/** @type {RequiredDevEnvVar[]} */
export const REQUIRED_DEV_ENV = [
  {
    key: 'GOOGLE_CLIENT_SECRET',
    when: ENV_WHEN.BEFORE_SUPABASE,
    prompt: true,
    description:
      'Create your own OAuth client at:\n' +
      `${GOOGLE_OAUTH_CLIENT_CREATE_URL}\n` +
      'or ask Tom for his dev credentials. See CONTRIBUTING.md for details.',
    helpUrl: GOOGLE_OAUTH_CLIENT_CREATE_URL,
    helpDocPath: 'CONTRIBUTING.md',
  },
  {
    key: 'GOOGLE_CLIENT_ID',
    when: ENV_WHEN.BEFORE_SUPABASE,
    prompt: true,
    keepOnEmpty: true,
    description: 'Press Enter to keep the default from .env.example.',
  },
  {
    key: 'NEXT_PUBLIC_SUPABASE_URL',
    when: ENV_WHEN.AFTER_SUPABASE,
    prompt: false,
    description: 'Filled by setup-env from local Supabase',
  },
  {
    key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    when: ENV_WHEN.AFTER_SUPABASE,
    prompt: false,
    description: 'Filled by setup-env from local Supabase',
  },
  {
    key: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    when: ENV_WHEN.AFTER_SUPABASE,
    prompt: false,
    description: 'Filled by setup-env from local Supabase',
  },
  {
    key: 'SUPABASE_SERVICE_ROLE_KEY',
    when: ENV_WHEN.AFTER_SUPABASE,
    prompt: false,
    description: 'Filled by setup-env from local Supabase',
  },
];

/**
 * Returns required env entries for a given phase.
 * @param {'before-supabase' | 'after-supabase'} when - Validation phase
 * @returns {RequiredDevEnvVar[]} Matching entries
 */
export const getRequiredDevEnvByWhen = (when) =>
  REQUIRED_DEV_ENV.filter((entry) => entry.when === when);
