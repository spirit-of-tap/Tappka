// scripts/wait-and-restart-docker.js
/**
 * Waits for 2 seconds
 * Cross-platform compatible delay using Node.js
 */
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const main = async () => {
  console.log('Waiting 2 seconds...');
  await wait(2000);
};

main();
