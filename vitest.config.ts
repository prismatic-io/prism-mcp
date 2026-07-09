import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Reset mock state, restore spied methods, and clear env stubs before every test.
    mockReset: true,
    restoreMocks: true,
    unstubEnvs: true,
  },
});
