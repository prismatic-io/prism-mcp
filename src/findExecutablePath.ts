import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

interface FindExecutablePathOptions {
  npxPackage?: string;
  logPrefix?: string;
}

export interface ExecutablePath {
  command: string;
  args: string[];
  isNpx: boolean;
}

export async function findExecutable(
  executable: string,
  options: FindExecutablePathOptions = {},
): Promise<ExecutablePath | null> {
  const { npxPackage, logPrefix = "findExecutable" } = options;
  const prismPath = process.env.MCP_PRISM_PATH;

  if (prismPath) {
    try {
      await execAsync(`"${prismPath}" --version`);

      return {
        command: prismPath,
        args: [],
        isNpx: false,
      };
    } catch (error) {
      console.error(
        `${logPrefix}: MCP_PRISM_PATH (${prismPath}) is not valid or executable:`,
        error,
      );
      // Continue to fallback methods
    }
  }

  // Test if the package is available via npx
  if (npxPackage) {
    try {
      await execAsync(`npx ${npxPackage} --version`);

      return {
        command: "npx",
        args: [npxPackage],
        isNpx: true,
      };
    } catch (error) {
      console.error(
        `${logPrefix}: npx package ${npxPackage} not available:`,
        error,
      );
      return null;
    }
  }

  // Fallback to which/where for direct executable lookup
  try {
    const cmd =
      process.platform === "win32"
        ? `where ${executable}`
        : `which ${executable}`;

    const { stdout } = await execAsync(cmd);

    const result = stdout.split(/\r?\n/)[0].trim();

    if (result) {
      return {
        command: result,
        args: [],
        isNpx: false,
      };
    }
  } catch (error) {
    console.error(`${logPrefix}: Error finding ${executable}:`, error);
  }

  return null;
}

