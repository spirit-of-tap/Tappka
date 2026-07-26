import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const srcRoot = fileURLToPath(new URL("./src", import.meta.url));
const testsRoot = fileURLToPath(new URL("./tests", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // More specific alias first — integration tests import `@/tests/setup/*`.
      "@/tests": testsRoot,
      "@": srcRoot,
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/lib/**/*.test.ts", "tests/unit/**/*.test.ts"],
          globals: true,
        },
      },
      {
        extends: true,
        test: {
          name: "component",
          environment: "jsdom",
          setupFiles: ["tests/setup/component.setup.ts"],
          include: [
            "src/components/**/*.test.tsx",
            "tests/component/**/*.test.tsx",
          ],
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
