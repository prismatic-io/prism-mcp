import { exec } from "node:child_process";
import { existsSync } from "node:fs";
import * as path from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);

interface FindExecutablePathOptions {
  npxFallback?: string;
  logPrefix?: string;
}

export async function findExecutablePath(
  executable: string,
  options: FindExecutablePathOptions = {},
): Promise<string | null> {
  const { npxFallback, logPrefix = "findExecutablePath" } = options;

  // Try multiple approaches to find the executable
  const approaches = [
    // 1. Try which/where command
    async () => {
      try {
        const cmd = process.platform === "win32" ? `where ${executable}` : `which ${executable}`;
        const { stdout } = await execAsync(cmd);
        const result = stdout.split(/\r?\n/)[0].trim();

        return result || null;
      } catch {
        return null;
      }
    },
    // 2. Try npm config get prefix
    async () => {
      try {
        const { stdout } = await execAsync("npm config get prefix");
        const npmPrefix = stdout.trim();
        const globalBin = path.join(npmPrefix, "bin", executable);

        return existsSync(globalBin) ? globalBin : null;
      } catch {
        return null;
      }
    },
    // 3. Try common macOS locations
    () => {
      const homebrewPath = `/opt/homebrew/bin/${executable}`;

      return existsSync(homebrewPath) ? Promise.resolve(homebrewPath) : Promise.resolve(null);
    },
    // 4. Try user's global npm directory
    () => {
      const userLocalPath = path.join(process.env.HOME || "", ".npm-global", "bin", executable);

      return existsSync(userLocalPath) ? Promise.resolve(userLocalPath) : Promise.resolve(null);
    },
    // 5. Try nvm installation
    () => {
      const nvmPath = path.join(
        process.env.HOME || "",
        ".nvm",
        "versions",
        "node",
        "current",
        "bin",
        executable,
      );

      return existsSync(nvmPath) ? Promise.resolve(nvmPath) : Promise.resolve(null);
    },
    // 6. Try asdf shims
    () => {
      const asdfShim = path.join(process.env.HOME || "", ".asdf", "shims", executable);

      return existsSync(asdfShim) ? Promise.resolve(asdfShim) : Promise.resolve(null);
    },
    // 7. Try asdf Node.js installation
    async () => {
      try {
        const { stdout } = await execAsync("asdf where nodejs");
        const nodejsPath = stdout.trim();

        if (nodejsPath) {
          const execPath = path.join(nodejsPath, "bin", executable);

          return existsSync(execPath) ? execPath : null;
        }
        return null;
      } catch {
        return null;
      }
    },
    // 8. Try npx fallback if provided
    ...(npxFallback
      ? [
          async () => {
            try {
              await execAsync(`npx --yes ${npxFallback} --version`);

              return `npx --yes ${npxFallback}`;
            } catch {
              return null;
            }
          },
        ]
      : []),
  ];

  for (const approach of approaches) {
    try {
      const result = await approach();

      if (result) {
        console.log(`${logPrefix}: Found ${executable} at:`, result);
        return result;
      }
    } catch (error) {
      console.error(`${logPrefix}: Error checking ${executable} path:`, error);
    }
  }

  return null;
}
