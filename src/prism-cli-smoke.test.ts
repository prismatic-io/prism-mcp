import { existsSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { resolvePrismExecutable } from "./findExecutablePath.js";
import { PrismCLIManager } from "./prism-cli-manager.js";

const SPAWN_TIMEOUT = 30_000;
const VERSION = /@prismatic-io\/prism\/\d+\.\d+\.\d+/;

beforeEach(() => {
  vi.stubEnv("MCP_PRISM_PATH", "");
});

afterEach(() => {
  PrismCLIManager.getInstance(process.cwd()).dispose();
  vi.unstubAllEnvs();
});

describe("prism CLI smoke", () => {
  test(
    "resolves the bundled CLI to node + lib/run.js and reports its version",
    async () => {
      const executable = await resolvePrismExecutable();
      expect(executable?.command).toBe(process.execPath);
      expect(executable?.args[0]).toMatch(/@prismatic-io[/\\]prism[/\\].*run\.js$/);
      expect(existsSync(executable?.args[0] ?? "")).toBe(true);

      const version = await PrismCLIManager.getInstance(process.cwd()).version();
      expect(version).toMatch(VERSION);
    },
    SPAWN_TIMEOUT,
  );

  test(
    "routes a flag through the shell-less argv (--help exits 0)",
    async () => {
      const { stdout } = await PrismCLIManager.getInstance(process.cwd()).executeCommand([
        "--help",
      ]);
      expect(stdout).toMatch(/USAGE/);
    },
    SPAWN_TIMEOUT,
  );
});
