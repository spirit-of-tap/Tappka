import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": root,
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["lib/**/*.test.ts", "tests/unit/**/*.test.ts"],
          globals: true,
        },
      },
      {
        extends: true,
        test: {
          name: "component",
          environment: "jsdom",
          setupFiles: ["tests/setup/component.setup.ts"],
          include: ["components/**/*.test.tsx", "tests/component/**/*.test.tsx"],
          globals: true,
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          globalSetup: ["tests/setup/testdb.ts"],
          include: ["tests/integration/**/*.int.test.ts"],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 120_000,
          globals: true,
        },
      },
    ],
  },
});
