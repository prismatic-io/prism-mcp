import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { x } from "tinyexec";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { resolvePrismExecutable } from "./findExecutablePath.js";
import { PrismCLIManager } from "./prism-cli-manager.js";

vi.mock("tinyexec", () => ({ x: vi.fn() }));
vi.mock("./findExecutablePath.js", () => ({ resolvePrismExecutable: vi.fn() }));

// Fake tinyexec output; cast via `unknown` since a plain object isn't a full `Output`.
type ExecOutput = Awaited<ReturnType<typeof x>>;
const execResult = (
  overrides: Partial<{ stdout: string; stderr: string; exitCode: number }>,
): ExecOutput => ({ stdout: "", stderr: "", exitCode: 0, ...overrides }) as unknown as ExecOutput;

const optionsOf = (callIndex: number) =>
  vi.mocked(x).mock.calls[callIndex][2] as {
    nodeOptions?: { cwd?: string; env?: NodeJS.ProcessEnv };
  };

let wd: string;
let outside: string;

beforeEach(async () => {
  // realpath so macOS /var -> /private/var doesn't skew comparisons.
  wd = await realpath(await mkdtemp(join(tmpdir(), "prism-mgr-")));
  outside = await realpath(await mkdtemp(join(tmpdir(), "prism-mgr-out-")));
});

afterEach(async () => {
  PrismCLIManager.getInstance(wd).dispose();
  await rm(wd, { recursive: true, force: true });
  await rm(outside, { recursive: true, force: true });
});

describe("executeCommand", () => {
  test("runs the resolved command, injects PRISMATIC_URL, and confines the cwd", async () => {
    vi.mocked(resolvePrismExecutable).mockResolvedValue({ command: "prism", args: [] });
    vi.mocked(x).mockResolvedValue(execResult({ stdout: "hello", stderr: "warn" }));

    const manager = PrismCLIManager.getInstance(wd, "https://custom.example/");
    const result = await manager.executeCommand(["me", "--json"]);

    expect(result).toEqual({ stdout: "hello", stderr: "warn" });
    expect(x).toHaveBeenCalledTimes(1);
    const [command, argv] = vi.mocked(x).mock.calls[0];
    expect(command).toBe("prism");
    expect(argv).toEqual(["me", "--json"]);
    expect(optionsOf(0).nodeOptions?.cwd).toBe(wd);
    expect(optionsOf(0).nodeOptions?.env?.PRISMATIC_URL).toBe("https://custom.example/");
  });

  test("prepends the executable's own args (the bundled bin path) to the argv", async () => {
    vi.mocked(resolvePrismExecutable).mockResolvedValue({
      command: process.execPath,
      args: ["/opt/prism/lib/run.js"],
    });
    vi.mocked(x).mockResolvedValue(execResult({ stdout: "v1" }));

    await PrismCLIManager.getInstance(wd).executeCommand(["--version"]);

    const [command, argv] = vi.mocked(x).mock.calls[0];
    expect(command).toBe(process.execPath);
    expect(argv).toEqual(["/opt/prism/lib/run.js", "--version"]);
  });

  test("throws a wrapped error on a non-zero exit", async () => {
    vi.mocked(resolvePrismExecutable).mockResolvedValue({ command: "prism", args: [] });
    vi.mocked(x).mockResolvedValue(execResult({ exitCode: 1, stderr: "boom" }));

    await expect(PrismCLIManager.getInstance(wd).executeCommand(["me"])).rejects.toThrow(
      /Failed to execute Prismatic CLI command[\s\S]*boom/,
    );
  });

  test("confines a custom cwd to the working directory and never spawns on escape", async () => {
    vi.mocked(resolvePrismExecutable).mockResolvedValue({ command: "prism", args: [] });
    vi.mocked(x).mockResolvedValue(execResult({}));

    await expect(PrismCLIManager.getInstance(wd).executeCommand(["me"], outside)).rejects.toThrow(
      /outside/,
    );
    expect(x).not.toHaveBeenCalled();
  });

  test("throws the not-installed message when nothing resolves", async () => {
    vi.mocked(resolvePrismExecutable).mockResolvedValue(null);

    await expect(PrismCLIManager.getInstance(wd).executeCommand(["me"])).rejects.toThrow(
      /could not be resolved/,
    );
  });

  test("caches the resolved executable across commands", async () => {
    vi.mocked(resolvePrismExecutable).mockResolvedValue({
      command: process.execPath,
      args: ["/opt/prism/lib/run.js"],
    });
    vi.mocked(x).mockResolvedValue(execResult({ stdout: "ok" }));

    const manager = PrismCLIManager.getInstance(wd);
    await manager.executeCommand(["me"]);
    await manager.executeCommand(["logout"]);

    expect(resolvePrismExecutable).toHaveBeenCalledTimes(1);
  });
});
