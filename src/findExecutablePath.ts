import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

export interface ExecutablePath {
  command: string;
  args: string[];
}

const PRISM_PACKAGE = "@prismatic-io/prism";

/** Explicit `MCP_PRISM_PATH` override; must be a regular file. */
const resolveOverride = async (): Promise<ExecutablePath | null> => {
  const override = process.env.MCP_PRISM_PATH?.trim();
  if (!override) {
    return null;
  }
  try {
    if ((await stat(override)).isFile()) {
      return { command: override, args: [] };
    }
    console.error(`MCP_PRISM_PATH (${override}) is not a file; using the bundled prism CLI.`);
  } catch {
    console.error(`MCP_PRISM_PATH (${override}) does not exist; using the bundled prism CLI.`);
  }
  return null;
};

/** Resolve the prism CLI: an `MCP_PRISM_PATH` override, else the lockfile-pinned bundled dependency. */
export const resolvePrismExecutable = async (): Promise<ExecutablePath | null> => {
  const override = await resolveOverride();
  if (override) {
    return override;
  }

  try {
    const require = createRequire(import.meta.url);
    const pkgJsonPath = require.resolve(`${PRISM_PACKAGE}/package.json`);
    const pkg = JSON.parse(await readFile(pkgJsonPath, "utf8")) as {
      bin?: string | Record<string, string>;
    };
    const binRelative = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.prism;
    if (!binRelative) {
      return null;
    }
    const binPath = join(dirname(pkgJsonPath), binRelative);
    if (!existsSync(binPath)) {
      return null;
    }
    return { command: process.execPath, args: [binPath] };
  } catch {
    return null;
  }
};
