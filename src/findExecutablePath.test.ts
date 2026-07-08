import { existsSync } from "node:fs";
import { chmod, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { resolvePrismExecutable } from "./findExecutablePath.js";

let tmp: string;

beforeEach(async () => {
  tmp = await realpath(await mkdtemp(join(tmpdir(), "prism-resolve-")));
  vi.stubEnv("MCP_PRISM_PATH", ""); // "" is treated as absent
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

const writeExecutable = async (path: string): Promise<string> => {
  await writeFile(path, "#!/bin/sh\necho ok\n");
  await chmod(path, 0o755);
  return path;
};

describe("resolvePrismExecutable", () => {
  test("prefers an MCP_PRISM_PATH override that points at a file", async () => {
    const override = await writeExecutable(join(tmp, "my-prism"));
    vi.stubEnv("MCP_PRISM_PATH", override);

    expect(await resolvePrismExecutable()).toEqual({ command: override, args: [] });
  });

  test("falls back to the bundled CLI when MCP_PRISM_PATH does not exist", async () => {
    vi.stubEnv("MCP_PRISM_PATH", join(tmp, "missing"));

    const executable = await resolvePrismExecutable();
    expect(executable?.command).toBe(process.execPath);
    expect(executable?.args[0]).toMatch(/@prismatic-io[/\\]prism[/\\]/);
  });

  test("falls back to the bundled CLI when MCP_PRISM_PATH is a directory, not a file", async () => {
    vi.stubEnv("MCP_PRISM_PATH", tmp);

    expect((await resolvePrismExecutable())?.command).toBe(process.execPath);
  });

  test("resolves the bundled @prismatic-io/prism CLI when no override is set", async () => {
    const executable = await resolvePrismExecutable();

    expect(executable).not.toBeNull();
    expect(executable?.command).toBe(process.execPath);
    expect(executable?.args).toHaveLength(1);
    expect(executable?.args[0]).toMatch(/@prismatic-io[/\\]prism[/\\]/);
    expect(existsSync(executable?.args[0] ?? "")).toBe(true);
  });
});
