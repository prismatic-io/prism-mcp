import { execAsync, findPrismPath } from "./helpers.js";

export const DEFAULT_PRISMATIC_URL = "https://app.prismatic.io/";

// Define schemas for validation
export class PrismCLIManager {
  private static instance: PrismCLIManager | null = null;
  private prismPath: string;
  private prismaticUrl: string;
  private workingDirectory: string;

  /**
   * Private constructor
   * @param {string} workingDirectory - The working directory for CLI commands
   * @param {string} [prismaticUrl] - The URL to the Prismatic instance
   */
  private constructor(workingDirectory: string, prismaticUrl?: string) {
    this.workingDirectory = workingDirectory;
    this.prismaticUrl = prismaticUrl || DEFAULT_PRISMATIC_URL;
    this.prismPath = "";
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

  /**
   * Checks if the Prismatic CLI is properly installed.
   * @param {string} [cwd] - Optional working directory for the check
   * @returns {Promise<boolean>} A promise that resolves to true if CLI is installed, false otherwise
   */
  private async checkCLIInstallation(cwd?: string): Promise<boolean | string> {
    try {
      const path = await this.getPrismPath();
      await execAsync(`${path} --version`, { cwd: cwd || this.workingDirectory });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Executes a Prismatic CLI command.
   * @param {string} command - The command to execute
   * @param {string} [customCwd] - Optional custom working directory
   * @returns {Promise<{stdout: string, stderr: string}>} A promise that resolves to an object containing stdout and stderr
   * @throws {Error} If CLI is not installed or command execution fails
   */
  public async executeCommand(
    command: string,
    customCwd?: string,
  ): Promise<{ stdout: string; stderr: string }> {
    const workingDir = customCwd || this.workingDirectory;
    const isInstalled = await this.checkCLIInstallation(workingDir);

    if (isInstalled !== true) {
      throw new Error(
        "Prismatic CLI is not properly installed. Please ensure @prismatic-io/prism is installed in your project dependencies.",
      );
    }

    const path = await this.getPrismPath();

    try {
      const execOptions: any = {
        cwd: workingDir,
        env: {
          ...process.env,
          PRISMATIC_URL: this.prismaticUrl,
        },
      };

      const { stdout, stderr } = await execAsync(`${path} ${command}`, execOptions);
      return { stdout: stdout.toString(), stderr: stderr.toString() };
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
    const { stdout } = await this.executeCommand("logout");

    return stdout.trim();
  }

  /**
   * Retrieves information about the currently logged-in user.
   * @returns {Promise<string>} A promise that resolves to the user information
   */
  public async me(): Promise<string> {
    const { stdout } = await this.executeCommand("me");

    return stdout.trim();
  }

  /**
   * Retrieves the version of the installed Prism CLI.
   * @returns {Promise<string>} A promise that resolves to the CLI version
   */
  public async version(): Promise<string> {
    const { stdout } = await this.executeCommand("--version");

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
    PrismCLIManager.instance = null;
  }

  /**
   * Finds the path to the Prismatic CLI.
   * @returns {string} The path to the Prismatic CLI
   */
  public async getPrismPath(): Promise<string> {
    if (this.prismPath) {
      return this.prismPath;
    }

    const foundPath = await findPrismPath();
    if (foundPath) {
      this.prismPath = foundPath;
      return foundPath;
    }

    throw new Error("Prismatic CLI not found. Please ensure @prismatic-io/prism is installed.");
  }
}
