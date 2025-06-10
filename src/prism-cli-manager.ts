import { exec } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execAsync = promisify(exec);

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
    this.prismPath = this.findPrismPath();
  }

  /**
   * Gets the singleton instance of PrismCLIManager.
   * @param {string} [workingDirectory] - The working directory for CLI commands (uses env var if not provided)
   * @param {string} [prismaticUrl] - The URL to the Prismatic instance
   * @returns {PrismCLIManager} The singleton instance of PrismCLIManager
   */
  public static getInstance(workingDirectory?: string, prismaticUrl?: string): PrismCLIManager {
    // Use provided working directory or fall back to environment variable
    const workDir = workingDirectory || process.env.WORKING_DIRECTORY;
    const url = prismaticUrl || process.env.PRISMATIC_URL;
    if (!workDir) {
      throw new Error(`WORKING_DIRECTORY must be provided or set as environment variable. Provided: ${workDir}`);
    }

    if (!PrismCLIManager.instance) {
      PrismCLIManager.instance = new PrismCLIManager(workDir, url);
    } else if (prismaticUrl) {
      // Update the URL if a new one is provided
      PrismCLIManager.instance.prismaticUrl = prismaticUrl;
    }

    return PrismCLIManager.instance;
  }

  /**
   * Checks if the Prismatic CLI is properly installed.
   * @returns {Promise<boolean>} A promise that resolves to true if CLI is installed, false otherwise
   */
  private async checkCLIInstallation(): Promise<boolean | string> {
    try {
      await execAsync(`${this.prismPath} --version`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Executes a Prismatic CLI command.
   * @param {string} command - The command to execute
   * @returns {Promise<{stdout: string, stderr: string}>} A promise that resolves to an object containing stdout and stderr
   * @throws {Error} If CLI is not installed or command execution fails
   */
  public async executeCommand(
    command: string,
  ): Promise<{ stdout: string; stderr: string }> {
    const isInstalled = await this.checkCLIInstallation();

    if (isInstalled !== true) {
      throw new Error(
        `Prismatic CLI is not properly installed. Please ensure @prismatic-io/prism is installed in your project dependencies.`
      );
    }

    try {
      const execOptions: any = {
        cwd: this.workingDirectory,
        env: {
          ...process.env,
          PRISMATIC_URL: this.prismaticUrl,
        },
      };

      const { stdout, stderr } = await execAsync(
        `${this.prismPath} ${command}`,
        execOptions
      );

      return { stdout: stdout.toString(), stderr: stderr.toString() };
    } catch (error) {
      throw new Error(
        `Failed to execute Prismatic CLI command: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Checks if the user is currently logged in to Prismatic.
   * @returns {Promise<boolean>} A promise that resolves to true if logged in, false otherwise
   */
  public async isLoggedIn(): Promise<{ result: string, isLoggedIn: boolean }> {
    try {
      const result = await this.me();

      return { result, isLoggedIn: !result.includes("Error: You are not logged") };
    } catch(error) {
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
   * Disposes of the PrismCLIManager instance.
   */
  public dispose(): void {
    PrismCLIManager.instance = null;
  }

  /**
  * Finds the path to the Prismatic CLI.
  * @returns {string} The path to the Prismatic CLI
  */
  private findPrismPath(): string {
    // Check if custom path is set via environment variable
    if (process.env.PRISM_PATH && existsSync(process.env.PRISM_PATH)) {
      return process.env.PRISM_PATH;
    }

    // Otherwise use local node_modules installation
    const localBin = path.join(
      __dirname,
      "..",
      "node_modules",
      "@prismatic-io",
      "prism",
      "lib",
      "run.js"
    );

    if (existsSync(localBin)) {
      return localBin;
    }

    throw new Error("Prismatic CLI not found. Please ensure @prismatic-io/prism is installed or set PRISM_PATH environment variable.");
  }
}
