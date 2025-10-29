import { execAsync } from "./helpers.js";

interface FindExecutablePathOptions {
  npxFallback?: string;
  logPrefix?: string;
  forceNpx?: boolean;
}

export async function findExecutablePath(
  executable: string,
  options: FindExecutablePathOptions = {},
): Promise<string | null> {
  const { npxFallback, logPrefix = "findExecutablePath", forceNpx = false } = options;

  // Try multiple approaches to find the executable
  const approaches = [
    // 1. Check for user-defined PRISM_PATH environment variable (highest priority)
    async () => {
      if (executable === "prism" && process.env.PRISM_PATH) {
        try {
          // Verify the path works by testing version
          await execAsync(`"${process.env.PRISM_PATH}" --version`);
          console.log(`${logPrefix}: Using PRISM_PATH environment variable:`, process.env.PRISM_PATH);
          return process.env.PRISM_PATH;
        } catch (error) {
          console.warn(`${logPrefix}: PRISM_PATH verification failed:`, error);
          return null;
        }
      }
      return null;
    },
    // 2. Try which/where command with better error handling
    async () => {
      try {
        const cmd = process.platform === "win32" ? `where ${executable}` : `which ${executable}`;
        const { stdout } = await execAsync(cmd);
        const result = stdout.split(/\r?\n/)[0].trim();

        return result || null;
      } catch (error: any) {
        // Check for specific shell errors and log them
        const errorMessage = error.message || String(error);
        const isShellError = errorMessage.includes("spawn /bin/sh ENOENT") ||
                           errorMessage.includes("ENOENT") ||
                           error.code === "ENOENT";

        if (isShellError) {
          console.warn(`${logPrefix}: Shell command failed (${errorMessage}), trying npx fallback`);
        } else {
          console.warn(`${logPrefix}: Command failed:`, errorMessage);
        }
        return null;
      }
    },
    // 3. Use npx fallback
    ...(npxFallback
      ? [
          async () => {
            try {
              console.log(`${logPrefix}: Attempting npx fallback for ${executable}`);
              await execAsync(`npx --yes ${npxFallback} --version`);

              return `npx --yes ${npxFallback}`;
            } catch (error) {
              console.warn(`${logPrefix}: npx fallback failed:`, error);
              return null;
            }
          },
        ]
      : []),
  ];

  // If forceNpx is true, skip directly to npx approach
  const approachesToTry = forceNpx && npxFallback ? [approaches[approaches.length - 1]] : approaches;

  for (const approach of approachesToTry) {
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
