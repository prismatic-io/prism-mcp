import { tmpdir } from "node:os";
import { describe, expect, test } from "vitest";
import { buildArgs, run } from "./helpers.js";

describe("buildArgs", () => {
  test("returns the base argv when there are no options", () => {
    expect(buildArgs(["integrations:list"], {})).toEqual(["integrations:list"]);
  });

  test("keeps positionals as separate argv entries (no quoting)", () => {
    expect(buildArgs(["integrations:flows:list", "id with spaces"], {})).toEqual([
      "integrations:flows:list",
      "id with spaces",
    ]);
  });

  test("emits string flags as two argv entries", () => {
    expect(buildArgs(["components:list"], { output: "json" })).toEqual([
      "components:list",
      "--output",
      "json",
    ]);
  });

  test("emits boolean true as a bare flag and omits false", () => {
    expect(buildArgs(["integrations:init", "name"], { clean: true, quiet: false })).toEqual([
      "integrations:init",
      "name",
      "--clean",
    ]);
  });

  test("emits numbers as stringified values", () => {
    expect(buildArgs(["integrations:flows:test"], { timeout: 300 })).toEqual([
      "integrations:flows:test",
      "--timeout",
      "300",
    ]);
  });

  test("skips undefined and null options", () => {
    expect(
      buildArgs(["integrations:list"], { search: undefined, columns: null, output: "json" }),
    ).toEqual(["integrations:list", "--output", "json"]);
  });

  test("does not shell-interpret values with metacharacters", () => {
    expect(buildArgs(["me"], { note: "$(rm -rf /) `whoami`" })).toEqual([
      "me",
      "--note",
      "$(rm -rf /) `whoami`",
    ]);
  });

  test("emits an empty-string value as an explicit empty argv entry", () => {
    expect(buildArgs(["cmd"], { flag: "" })).toEqual(["cmd", "--flag", ""]);
  });
});

describe("run", () => {
  const cwd = tmpdir();

  test("returns stdout and stderr on success", async () => {
    const result = await run(
      "node",
      ["-e", "process.stdout.write('out'); process.stderr.write('err')"],
      cwd,
    );
    expect(result).toEqual({ stdout: "out", stderr: "err" });
  });

  test("passes args as literal argv without a shell", async () => {
    const result = await run(
      "node",
      ["-e", "process.stdout.write(process.argv[1] ?? '')", "$(whoami)"],
      cwd,
    );
    expect(result.stdout).toBe("$(whoami)");
  });

  test("throws with both stdout and stderr on a non-zero exit", async () => {
    await expect(
      run(
        "node",
        ["-e", "console.log('BUILD-OUT'); console.error('BUILD-ERR'); process.exit(1)"],
        cwd,
      ),
    ).rejects.toThrow(/BUILD-OUT[\s\S]*BUILD-ERR/);
  });

  test("throws a fallback message when there is no output", async () => {
    await expect(run("node", ["-e", "process.exit(3)"], cwd)).rejects.toThrow(/exited with code 3/);
  });
});
