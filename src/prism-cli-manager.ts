import { x } from "tinyexec";
import { type ExecutablePath, resolvePrismExecutable } from "./findExecutablePath.js";

export const DEFAULT_PRISMATIC_URL = "https://app.prismatic.io/";

const NOT_INSTALLED_MESSAGE =
  "The bundled Prismatic CLI (@prismatic-io/prism) could not be resolved. This indicates a " +
  "broken prism-mcp installation; reinstall it or its dependencies.";

export class PrismCLIManager {
  private static instance: PrismCLIManager | null = null;
  private prismaticUrl: string;
  private workingDirectory: string;
  private cachedExecutable: ExecutablePath | null = null;

  /**
   * Private constructor
   * @param {string} workingDirectory - The working directory for CLI commands
   * @param {string} [prismaticUrl] - The URL to the Prismatic instance
   */
  private constructor(workingDirectory: string, prismaticUrl?: string) {
    this.workingDirectory = workingDirectory;
    this.prismaticUrl = prismaticUrl || DEFAULT_PRISMATIC_URL;
  }

  /**
   * Gets the singleton instance of PrismCLIManager.
   * @param {string} [workingDirectory] - The working directory for CLI commands (uses env var if not provided)
   * @param {string} [prismaticUrl] - The URL to the Prismatic instance
   * @returns {PrismCLIManager} The singleton instance of PrismCLIManager
   */
  public static getInstance(workingDirectory?: string, prismaticUrl?: string): PrismCLIManager {
    if (PrismCLIManager.instance) {
      if (prismaticUrl) {
        PrismCLIManager.instance.prismaticUrl = prismaticUrl;
      }
      return PrismCLIManager.instance;
    }

    // For new instance creation, require working directory
    if (!workingDirectory) {
      throw new Error("A working directory must be provided.");
    }

    const url = prismaticUrl || process.env.PRISMATIC_URL;
    PrismCLIManager.instance = new PrismCLIManager(workingDirectory, url);
    return PrismCLIManager.instance;
  }

  /** Resolves the prism CLI executable, caching it for the instance's lifetime. */
  private async getExecutable(): Promise<ExecutablePath> {
    if (this.cachedExecutable) {
      return this.cachedExecutable;
    }

    const executable = await resolvePrismExecutable();
    if (!executable) {
      throw new Error(NOT_INSTALLED_MESSAGE);
    }

    this.cachedExecutable = executable;
    return executable;
  }

  /**
   * Executes a Prismatic CLI command without a shell (args are passed as argv).
   * @param {string[]} args - The command argv (subcommand, positionals, and flags)
   * @param {string} [customCwd] - Optional custom working directory
   * @returns {Promise<{stdout: string, stderr: string}>} A promise that resolves to an object containing stdout and stderr
   * @throws {Error} If the CLI cannot be resolved or command execution fails
   */
  public async executeCommand(
    args: string[],
    customCwd?: string,
  ): Promise<{ stdout: string; stderr: string }> {
    const executable = await this.getExecutable();

    try {
      const result = await x(executable.command, [...executable.args, ...args], {
        nodeOptions: {
          cwd: customCwd || this.workingDirectory,
          env: {
            ...process.env,
            PRISMATIC_URL: this.prismaticUrl,
          },
        },
      });

      if (result.exitCode !== 0) {
        throw new Error(result.stderr.trim() || `exited with code ${result.exitCode}`);
      }

      return { stdout: result.stdout, stderr: result.stderr };
    } catch (error) {
      throw new Error(
        `Failed to execute Prismatic CLI command: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Checks if the user is currently logged in to Prismatic.
   * @returns {Promise<boolean>} A promise that resolves to true if logged in, false otherwise
   */
  public async isLoggedIn(): Promise<{ result: string; isLoggedIn: boolean }> {
    try {
      const result = await this.me();

      return { result, isLoggedIn: !result.includes("Error: You are not logged") };
    } catch (error) {
      return { result: error instanceof Error ? error.message : String(error), isLoggedIn: false };
    }
  }

  /**
   * Logs out the current user from Prismatic.
   * @returns {Promise<string>} A promise that resolves to the logout confirmation message
   */
  public async logout(): Promise<string> {
    const { stdout } = await this.executeCommand(["logout"]);

    return stdout.trim();
  }

  /**
   * Retrieves information about the currently logged-in user.
   * @returns {Promise<string>} A promise that resolves to the user information
   */
  public async me(): Promise<string> {
    const { stdout } = await this.executeCommand(["me"]);

    return stdout.trim();
  }

  /**
   * Retrieves the version of the installed Prism CLI.
   * @returns {Promise<string>} A promise that resolves to the CLI version
   */
  public async version(): Promise<string> {
    const { stdout } = await this.executeCommand(["--version"]);

    return stdout.trim();
  }

  /**
   * Gets the working directory.
   * @returns {string} The working directory
   */
  public getWorkingDirectory(): string {
    return this.workingDirectory;
  }

  /**
   * Disposes of the PrismCLIManager instance.
   */
  public dispose(): void {
    this.cachedExecutable = null;
    PrismCLIManager.instance = null;
  }
}
