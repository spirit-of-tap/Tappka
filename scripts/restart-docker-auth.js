// scripts/restart-docker-auth.js
/**
 * Restarts the Supabase auth Docker container
 * Cross-platform compatible script that reads container name from environment variable
 * @param {string} containerName - Docker container name (defaults to SUPABASE_AUTH_CONTAINER env var or fallback)
 */
import { execSync } from 'child_process';

const CONTAINER_NAME = process.env.SUPABASE_AUTH_CONTAINER || 'supabase_auth_Tappka';

const main = () => {
  try {
    console.log(`Restarting Docker container: ${CONTAINER_NAME}`);
    execSync(`docker restart ${CONTAINER_NAME}`, { stdio: 'inherit' });
    console.log(`Successfully restarted ${CONTAINER_NAME}`);
  } catch (error) {
    console.error(`Failed to restart container ${CONTAINER_NAME}:`, error.message);
    process.exit(1);
  }
};

main();
