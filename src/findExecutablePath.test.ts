import { existsSync } from "node:fs";
import { chmod, mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { resolveLocalBin, resolvePrismExecutable } from "./findExecutablePath.js";

let tmp: string;

beforeEach(async () => {
  tmp = await realpath(await mkdtemp(join(tmpdir(), "prism-resolve-")));
  vi.stubEnv("MCP_PRISM_PATH", ""); // "" is treated as absent
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
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

describe("resolveLocalBin", () => {
  const SPECTRAL = "@prismatic-io/spectral";

  const installPackage = async (
    root: string,
    name: string,
    bin: Record<string, string>,
    { withBinFiles = true } = {},
  ): Promise<void> => {
    const pkgDir = join(root, "node_modules", ...name.split("/"));
    await mkdir(pkgDir, { recursive: true });
    await writeFile(join(pkgDir, "package.json"), JSON.stringify({ name, bin }));
    if (withBinFiles) {
      for (const relative of Object.values(bin)) {
        await mkdir(dirname(join(pkgDir, relative)), { recursive: true });
        await writeExecutable(join(pkgDir, relative));
      }
    }
  };

  test("resolves a named bin from an object bin map, invoked via node", async () => {
    await installPackage(tmp, SPECTRAL, {
      "component-manifest": "bin/component-manifest.js",
      "cni-component-manifest": "bin/cni-component-manifest.js",
    });

    expect(await resolveLocalBin(tmp, SPECTRAL, "cni-component-manifest")).toEqual({
      command: process.execPath,
      args: [
        join(tmp, "node_modules", "@prismatic-io", "spectral", "bin", "cni-component-manifest.js"),
      ],
    });
  });

  test("returns null when the package is not installed", async () => {
    expect(await resolveLocalBin(tmp, SPECTRAL, "cni-component-manifest")).toBeNull();
  });

  test("returns null when the requested bin name is absent from the map", async () => {
    await installPackage(tmp, SPECTRAL, { "component-manifest": "bin/component-manifest.js" });

    expect(await resolveLocalBin(tmp, SPECTRAL, "cni-component-manifest")).toBeNull();
  });

  test("returns null when the bin file is missing on disk", async () => {
    await installPackage(
      tmp,
      SPECTRAL,
      { "cni-component-manifest": "bin/cni-component-manifest.js" },
      { withBinFiles: false },
    );

    expect(await resolveLocalBin(tmp, SPECTRAL, "cni-component-manifest")).toBeNull();
  });

  test("honors a string bin only when the requested name matches the package name", async () => {
    const pkgDir = join(tmp, "node_modules", "tool");
    await mkdir(join(pkgDir, "bin"), { recursive: true });
    await writeFile(
      join(pkgDir, "package.json"),
      JSON.stringify({ name: "tool", bin: "bin/tool.js" }),
    );
    await writeExecutable(join(pkgDir, "bin", "tool.js"));

    expect(await resolveLocalBin(tmp, "tool", "tool")).toEqual({
      command: process.execPath,
      args: [join(pkgDir, "bin", "tool.js")],
    });
    expect(await resolveLocalBin(tmp, "tool", "other")).toBeNull();
  });
});
