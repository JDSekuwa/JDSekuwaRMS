import { defineConfig } from "vitest/config";

if (typeof process.loadEnvFile === "function") {
  process.loadEnvFile();
}

export default defineConfig({
  test: {
    // Run test files sequentially to avoid database concurrency conflicts
    fileParallelism: false,
    testTimeout: 30000,
  },
});
