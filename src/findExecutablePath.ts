import { execAsync } from "./helpers.js";

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
    // 2. Use npx fallback
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
