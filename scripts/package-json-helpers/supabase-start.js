import { spawn } from 'child_process';

import { readEnvLocal } from './env-utils.js';

/**
 * Starts local Supabase with environment variables from .env.local.
 * Required so config.toml env(...) substitutions resolve.
 * Extra CLI args are forwarded, e.g.:
 *   pnpm supabase:start -- -x studio -x analytics -x edge-runtime
 */
const main = () => {
  const envFromLocal = readEnvLocal();

  const child = spawn('pnpm', ['supabase', 'start', ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: {
      ...process.env,
      ...envFromLocal,
    },
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 1);
  });
};

main();
