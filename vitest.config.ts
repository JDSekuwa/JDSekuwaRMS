import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Run test files sequentially to avoid database concurrency conflicts
    fileParallelism: false,
    testTimeout: 30000,
  },
});
