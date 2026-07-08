import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

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

/** Resolve `packageName`'s `binName` bin to a `node <bin>` argv, or null if it's missing. */
const resolveBin = async (
  require: ReturnType<typeof createRequire>,
  packageName: string,
  binName: string,
): Promise<ExecutablePath | null> => {
  try {
    const pkgJsonPath = require.resolve(`${packageName}/package.json`);
    const pkg = JSON.parse(await readFile(pkgJsonPath, "utf8")) as {
      bin?: string | Record<string, string>;
    };
    // A string `bin` uses the package's unscoped name; otherwise look it up in the bin map.
    let binRelative: string | undefined;
    if (typeof pkg.bin === "string") {
      binRelative = binName === packageName.split("/").pop() ? pkg.bin : undefined;
    } else {
      binRelative = pkg.bin?.[binName];
    }
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

/** Resolve a bin from `workingDirectory`'s own dependency tree (e.g. spectral's cni-component-manifest). */
export const resolveLocalBin = (
  workingDirectory: string,
  packageName: string,
  binName: string,
): Promise<ExecutablePath | null> =>
  resolveBin(
    createRequire(pathToFileURL(join(resolve(workingDirectory), "noop.js"))),
    packageName,
    binName,
  );

/** Resolve the prism CLI: an `MCP_PRISM_PATH` override, else the lockfile-pinned bundled dependency. */
export const resolvePrismExecutable = async (): Promise<ExecutablePath | null> => {
  const override = await resolveOverride();
  if (override) {
    return override;
  }
  return resolveBin(createRequire(import.meta.url), PRISM_PACKAGE, "prism");
};
