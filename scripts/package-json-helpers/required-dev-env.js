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

/**
 * @typedef {object} RequiredDevEnvVar
 * @property {string} key - Environment variable name
 * @property {'before-supabase' | 'after-supabase'} when - Validation phase
 * @property {boolean} prompt - Whether ensure-env should interactively ask for a value
 * @property {string} [description] - Prompt / error context shown to the developer
 */

/** @type {RequiredDevEnvVar[]} */
export const REQUIRED_DEV_ENV = [
  {
    key: 'GOOGLE_CLIENT_ID',
    when: ENV_WHEN.BEFORE_SUPABASE,
    prompt: false,
    description: 'Google OAuth client ID (shipped in .env.example)',
  },
  {
    key: 'GOOGLE_CLIENT_SECRET',
    when: ENV_WHEN.BEFORE_SUPABASE,
    prompt: true,
    description: 'OAuth client secret — ask a teammate',
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
