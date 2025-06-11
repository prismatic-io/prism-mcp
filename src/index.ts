#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { formatToolResult, lookupFlowUrl, buildCommand } from "./helpers.js";
import { PrismCLIManager } from "./prism-cli-manager.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const server = new McpServer({
  name: "prism-mcp",
  version: "1.0.0",
});

server.tool(
  "prism_me",
  "Check login status and display current user profile information",
  {},
  async () => {
    try {
      const manager = PrismCLIManager.getInstance();
      const output = await manager.me();
      return formatToolResult(output);
    } catch (error) {
      throw new Error(`Failed to get user info: ${(error as Error).message}`);
    }
  }
);

server.tool(
  "prism_integrations_list",
  "List all integrations in your organization",
  {},
  async ({}) => {
    try {
      const manager = PrismCLIManager.getInstance();
      const command = buildCommand("integrations:list", {
        output: "json",
      });
      const { stdout } = await manager.executeCommand(command);
      return formatToolResult(stdout, "integrations");
    } catch (error) {
      throw new Error(
        `Failed to list integrations: ${(error as Error).message}`
      );
    }
  }
);

server.tool(
  "prism_components_list",
  "List all components available in your organization",
  {},
  async () => {
    try {
      const manager = PrismCLIManager.getInstance();
      const command = buildCommand("components:list", {
        output: "json",
      });
      const { stdout } = await manager.executeCommand(command);
      return formatToolResult(stdout, "components");
    } catch (error) {
      throw new Error(`Failed to list components: ${(error as Error).message}`);
    }
  }
);

server.tool(
  "prism_integrations_init",
  "Initialize a new Code Native Integration",
  {
    name: z
      .string()
      .min(1)
      .regex(
        /^[a-zA-Z0-9_-]+$/,
        "Name must be alphanumeric with hyphens and underscores only"
      ),
    directory: z.string().optional(),
  },
  async ({ name, directory }) => {
    try {
      const manager = PrismCLIManager.getInstance();
      const command = buildCommand(`integrations:init ${name}`, {
        directory: directory,
      });
      const { stdout } = await manager.executeCommand(command);
      return formatToolResult(stdout);
    } catch (error) {
      throw new Error(
        `Failed to initialize integration: ${(error as Error).message}`
      );
    }
  }
);

server.tool(
  "prism_components_init",
  "Initialize a new Component",
  {
    name: z.string().min(1),
    wsdlPath: z.string().optional(),
    openApiPath: z.string().optional(),
  },
  async ({ name, wsdlPath, openApiPath }) => {
    try {
      const manager = PrismCLIManager.getInstance();
      const command = buildCommand(`components:init ${name}`, {
        "wsdl-path": wsdlPath,
        "open-api-path": openApiPath,
      });
      const { stdout } = await manager.executeCommand(command);
      return formatToolResult(stdout);
    } catch (error) {
      throw new Error(
        `Failed to initialize component: ${(error as Error).message}`
      );
    }
  }
);

server.tool(
  "prism_integrations_convert",
  "Convert a Low-Code Integration's YAML file into a Code Native Integration",
  {
    yamlFile: z.string(),
    folder: z.string().optional(),
    registryPrefix: z.string().optional(),
  },
  async ({ yamlFile, folder, registryPrefix }) => {
    try {
      const manager = PrismCLIManager.getInstance();
      const command = buildCommand("integrations:convert", {
        yamlFile: yamlFile,
        folder: folder,
        registryPrefix: registryPrefix,
      });
      const { stdout } = await manager.executeCommand(command);
      return formatToolResult(stdout);
    } catch (error) {
      throw new Error(
        `Failed to convert integration: ${(error as Error).message}`
      );
    }
  }
);

server.tool(
  "prism_integrations_flows_list",
  "List flows for an integration",
  { integrationId: z.string().min(1), columns: z.string().optional() },
  async ({ integrationId, columns }) => {
    try {
      const manager = PrismCLIManager.getInstance();
      const command = buildCommand(
        `integrations:flows:list "${integrationId}"`,
        {
          extended: true,
          columns,
          output: "json",
        }
      );

      const { stdout } = await manager.executeCommand(command);

      return formatToolResult(stdout, "flows");
    } catch (error) {
      throw new Error(`Failed to list flows: ${(error as Error).message}`);
    }
  }
);

server.tool(
  "prism_integrations_flows_test",
  "Test a flow in an integration",
  {
    flowUrl: z.string().optional(),
    flowId: z.string().optional(),
    flowName: z.string().optional(),
    integrationId: z.string().optional(),
    payload: z.string().optional(),
    payloadContentType: z.string().optional(),
    sync: z.boolean().optional(),
    tailLogs: z.boolean().optional(),
    tailResults: z.boolean().optional(),
    timeout: z.number().positive().optional().describe("In seconds"),
    resultFile: z.string().optional(),
  },
  async ({
    flowUrl,
    flowId,
    flowName,
    integrationId,
    payload,
    payloadContentType,
    sync,
    tailLogs,
    tailResults,
    timeout,
    resultFile,
  }) => {
    try {
      let testUrl = flowUrl;

      if ((tailLogs || tailResults) && !timeout) {
        throw new Error(
          "If tailing logs or step results via MCP server, a timeout (in seconds) is required."
        );
      }

      // If no direct URL provided, we need to look it up
      if (!testUrl) {
        if (!integrationId) {
          throw new Error(
            "integrationId is required when flowUrl is not provided"
          );
        }
        testUrl = await lookupFlowUrl(
          integrationId,
          flowId,
          flowName
        );
      }

      // Build the test command
      const manager = PrismCLIManager.getInstance();
      const command = buildCommand(`integrations:flows:test`, {
        "flow-url": flowUrl,
        payload,
        "payload-content-type": payloadContentType,
        sync,
        "tail-logs": tailLogs,
        "tail-results": tailResults,
        timeout,
        "result-file": resultFile,
        jsonl: true,
        quiet: true,
      });

      const { stdout } = await manager.executeCommand(command);
      return formatToolResult(stdout);
    } catch (error) {
      throw new Error(`Failed to test flow: ${(error as Error).message}`);
    }
  }
);

async function main() {
  try {
    // Initialize the manager with working directory from environment
    const manager = PrismCLIManager.getInstance(
      process.env.WORKING_DIRECTORY,
      process.env.PRISMATIC_URL
    );
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(`Prism MCP server running`);
  } catch (error) {
    console.error(
      "Error: Failed to start Prism MCP server:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
