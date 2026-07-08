import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { confineToWorkingDir } from "./paths.js";

let root: string;
let outside: string;

beforeEach(async () => {
  // realpath so macOS /var -> /private/var doesn't skew comparisons.
  root = await realpath(await mkdtemp(join(tmpdir(), "prism-confine-")));
  outside = await realpath(await mkdtemp(join(tmpdir(), "prism-outside-")));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
  await rm(outside, { recursive: true, force: true });
});

describe("confineToWorkingDir", () => {
  test("resolves an omitted candidate to the working directory itself", async () => {
    expect(await confineToWorkingDir(undefined, root)).toBe(root);
    expect(await confineToWorkingDir(".", root)).toBe(root);
  });

  test("allows the root itself", async () => {
    expect(await confineToWorkingDir(root, root)).toBe(root);
  });

  test("allows an existing subdirectory (relative or absolute)", async () => {
    const sub = join(root, "packages", "app");
    await mkdir(sub, { recursive: true });

    expect(await confineToWorkingDir(sub, root)).toBe(sub);
    expect(await confineToWorkingDir("packages/app", root)).toBe(sub);
  });

  test("rejects a path that does not exist", async () => {
    await expect(confineToWorkingDir("dist/out", root)).rejects.toThrow(/does not exist/);
  });

  test("rejects a parent-relative escape", async () => {
    await expect(confineToWorkingDir("..", root)).rejects.toThrow(/outside/);
    await expect(confineToWorkingDir("../..", root)).rejects.toThrow(/outside/);
  });

  test("rejects an absolute path outside the tree", async () => {
    await expect(confineToWorkingDir(outside, root)).rejects.toThrow(/outside/);
  });

  test("rejects an in-tree symlink that points outside the tree", async () => {
    await writeFile(join(outside, "payload"), "malicious");
    await symlink(outside, join(root, "escape"));

    await expect(confineToWorkingDir("escape", root)).rejects.toThrow(/outside/);
    await expect(confineToWorkingDir(join(root, "escape"), root)).rejects.toThrow(/outside/);
  });
});
