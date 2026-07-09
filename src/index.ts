#!/usr/bin/env node
import path from "node:path";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { PrismCLIManager } from "./prism-cli-manager.js";
import { createServer, registerTools } from "./tools.js";

async function main() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const workingDirectoryArg = args[0];
    const toolsetsArg = args.slice(1); // Remaining arguments are toolsets

    if (!workingDirectoryArg) {
      console.error("Error: WORKING_DIRECTORY argument is required");
      console.error("Usage: prism-mcp <working-directory> [toolsets...]");
      process.exit(1);
    }

    // Absolute path: a stable confinement anchor for tool cwds.
    const workingDirectory = path.resolve(workingDirectoryArg);

    // Move agent to the working dir
    process.chdir(workingDirectory);

    // Initialize the manager with working directory from command line first
    PrismCLIManager.getInstance(workingDirectory, process.env.PRISMATIC_URL);

    // Then register tools with specified toolsets (or all if none specified)
    const server = createServer();
    registerTools(server, toolsetsArg);
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(`Prism MCP server running in ${workingDirectory}`);
  } catch (error) {
    console.error(
      "Error: Failed to start Prism MCP server:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
