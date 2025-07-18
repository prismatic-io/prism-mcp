#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { snakeCase } from "lodash-es";
import path from "node:path";
import { z } from "zod";

import { formatToolResult, lookupFlowUrl, buildCommand } from "./helpers.js";
import { execAsync, PrismCLIManager } from "./prism-cli-manager.js";
import {
  generateConfigPage,
  generateConfigVar,
  generateConnectionConfigVar,
  generateDataSourceConfigVar,
  generateFlowFile,
} from "./generate.js";

const server = new McpServer({
  name: "prism-mcp",
  version: "1.0.0",
});

const VALID_TOOLSETS = ["integration", "component"];

function registerGeneralTools() {
  server.tool(
    "prism_me",
    "Check Prismatic login status and display current user profile information",
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
        throw new Error(
          `Failed to list components: ${(error as Error).message}`
        );
      }
    }
  );
}

function registerIntegrationTools() {
  server.tool(
    "prism_integrations_list",
    "List all integrations in your organization",
    {},
    async () => {
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
    "prism_integrations_init",
    "Initialize a new Prismatic Code Native Integration (CNI)",
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
    "Test a flow in a Prismatic integration",
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
          testUrl = await lookupFlowUrl(integrationId, flowId, flowName);
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

  server.tool(
    "prism_integrations_import",
    "Import a Prismatic code-native integration from a specific directory",
    {
      directory: z.string(),
      integrationId: z.string().optional(),
      path: z
        .string()
        .optional()
        .describe(
          "Path to the YAML definition of an integration to import. Not applicable to CNI"
        ),
      replace: z
        .boolean()
        .optional()
        .describe(
          "Allows replacing an existing integration regardless of code-native status. Requires integrationId."
        ),
      iconPath: z
        .string()
        .optional()
        .describe(
          "Path to the PNG icon for the integration. Not applicable for CNI."
        ),
    },
    async ({ directory, integrationId, path, replace, iconPath }) => {
      try {
        if (replace && !integrationId) {
          throw new Error("If replace is true, an integrationId is required.");
        }

        const manager = PrismCLIManager.getInstance();

        // First, run npm build in the integration directory
        await execAsync("npm run build", { cwd: directory });

        const command = buildCommand("integrations:import", {
          integrationId,
          path,
          replace,
          "icon-path": iconPath,
        });

        // Execute import command in the specified directory
        const { stdout } = await manager.executeCommand(command, directory);
        return formatToolResult(stdout);
      } catch (error) {
        throw new Error(
          `Failed to import integration: ${(error as Error).message}`
        );
      }
    }
  );

  // NOTE: May be deprecated soon.
  server.tool(
    "prism_install_component_manifest",
    "Generate line to add to a CNI's devDependencies that installs a Prismatic component manifest. Run `npm update --save` afterwards to fetch the correct version.",
    {
      name: z.string(),
    },
    async ({ name }) => {
      try {
        const result = JSON.stringify({
          code: `"@component-manifests/${snakeCase(name)}": "*"`,
        });
        return formatToolResult(result);
      } catch (error) {
        throw new Error(
          `Failed to create flow boilerplate code: ${(error as Error).message}`
        );
      }
    }
  );

  server.tool(
    "prism_integrations_generate_flow",
    "Generate boilerplate file for a CNI flow. The result should be included in the CNI's list of available flows.",
    {
      name: z.string(),
    },
    async ({ name }) => {
      try {
        const result = JSON.stringify({ code: generateFlowFile(name) });
        return formatToolResult(result);
      } catch (error) {
        throw new Error(
          `Failed to create flow boilerplate code: ${(error as Error).message}`
        );
      }
    }
  );

  server.tool(
    "prism_integrations_generate_config_page",
    "Generate boilerplate code for a CNI config page. The result should be included in the CNI's configPages object.",
    {
      name: z.string(),
    },
    async ({ name }) => {
      try {
        const result = JSON.stringify({ code: generateConfigPage(name) });
        return formatToolResult(result);
      } catch (error) {
        throw new Error(
          `Failed to create config page boilerplate code: ${
            (error as Error).message
          }`
        );
      }
    }
  );

  server.tool(
    "prism_integrations_generate_config_var",
    "Generate boilerplate code for a config variable. The result should be included in a CNI's existing config page.",
    {
      name: z.string(),
      dataType: z.string(),
    },
    async ({ name, dataType }) => {
      try {
        const result = JSON.stringify({
          code: generateConfigVar(name, dataType),
        });
        return formatToolResult(result);
      } catch (error) {
        throw new Error(
          `Failed to create config var boilerplate code: ${
            (error as Error).message
          }`
        );
      }
    }
  );

  server.tool(
    "prism_integrations_generate_connection_config_var",
    "Generate boilerplate code for a connection config variable. The result should be included in a CNI's existing config page.",
    {
      name: z.string(),
      componentRef: z
        .object({
          component: z.string(),
          key: z.string(),
        })
        .optional(),
    },
    async ({ name, componentRef }) => {
      try {
        const result = JSON.stringify({
          code: generateConnectionConfigVar(name, componentRef),
        });
        return formatToolResult(result);
      } catch (error) {
        throw new Error(
          `Failed to create connection config var boilerplate code: ${
            (error as Error).message
          }`
        );
      }
    }
  );

  server.tool(
    "prism_integrations_generate_datasource_config_var",
    "Generate boilerplate code for a datasource config variable. The result should be included in a CNI's existing config page.",
    {
      name: z.string(),
      dataType: z.string(),
      componentRef: z
        .object({
          component: z.string(),
          key: z.string(),
        })
        .optional(),
    },
    async ({ name, dataType, componentRef }) => {
      try {
        const result = JSON.stringify({
          code: generateDataSourceConfigVar(name, dataType, componentRef),
        });
        return formatToolResult(result);
      } catch (error) {
        throw new Error(
          `Failed to create connection config var boilerplate code: ${
            (error as Error).message
          }`
        );
      }
    }
  );
}

function registerComponentTools() {
  server.tool(
    "prism_components_init",
    "Initialize a new Prismatic custom component",
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
    "prism_components_publish",
    "Publish a custom Prismatic component from a specific directory",
    {
      directory: z.string(),
      comment: z.string().optional(),
      pullRequestUrl: z.string().optional(),
      repoUrl: z.string().optional(),
      noCheckSignature: z.boolean().optional(),
      customer: z.string().optional(),
      commitHash: z.string().optional(),
      commitUrl: z.string().optional(),
      skipOnSignatureMatch: z.boolean().optional(),
    },
    async ({
      directory,
      comment,
      pullRequestUrl,
      repoUrl,
      noCheckSignature,
      customer,
      commitHash,
      commitUrl,
      skipOnSignatureMatch,
    }) => {
      try {
        const manager = PrismCLIManager.getInstance();

        // First, run npm build in the component directory
        await execAsync("npm run build", { cwd: directory });

        const command = buildCommand("components:publish", {
          comment,
          pullRequestUrl,
          repoUrl,
          "no-confirm": true,
          "no-check-signature": noCheckSignature,
          customer,
          commitHash,
          commitUrl,
          "skip-on-signature-match": skipOnSignatureMatch,
        });

        // Execute publish command in the specified directory
        const { stdout } = await manager.executeCommand(command, directory);
        return formatToolResult(stdout);
      } catch (error) {
        throw new Error(
          `Failed to publish component: ${(error as Error).message}`
        );
      }
    }
  );

  server.tool(
    "prism_components_generate_manifest",
    "Generate the type manifest for a Prismatic component to enable its usage within a Code-Native Integration",
    {
      componentDir: z.string(),
      outputDir: z.string().optional(),
      registry: z.string().optional(),
      dryRun: z.boolean().optional(),
      skipSignatureVerify: z.boolean().optional(),
      version: z.string().optional(),
      name: z.string().optional(),
    },
    async ({
      componentDir,
      outputDir,
      registry,
      dryRun,
      skipSignatureVerify,
      version,
      name,
    }) => {
      try {
        // Build the component before attempting to generate the manifest
        await execAsync("npm run build", { cwd: componentDir });

        const command = buildCommand("component-manifest", {
          "output-dir": outputDir
            ? path.join(
                outputDir,
                `${path.basename(componentDir) || name}-manifest`
              )
            : "",
          registry,
          "dry-run": dryRun,
          "skip-signature-verify": skipSignatureVerify,
          version,
          name,
        });

        const { stdout } = await execAsync(command, { cwd: componentDir });
        return formatToolResult(stdout);
      } catch (error) {
        throw new Error(
          `Failed to generate component manifest: ${(error as Error).message}`
        );
      }
    }
  );
}

function registerTools(toolset?: string) {
  if (toolset && !VALID_TOOLSETS.includes(toolset)) {
    throw Error(
      `Invalid toolset: ${toolset}. Valid categories are: ${VALID_TOOLSETS.join(", ")}`
    );
  }

  registerGeneralTools();

  switch (toolset) {
    case "component":
      registerComponentTools();
      break;
    case "integration":
      registerIntegrationTools();
      break;
    default:
      registerComponentTools();
      registerIntegrationTools();
      break;
  }
}

registerTools(process.env.TOOLSET);

async function main() {
  try {
    // Initialize the manager with working directory from environment
    const manager = PrismCLIManager.getInstance(
      process.env.WORKING_DIRECTORY,
      process.env.PRISMATIC_URL
    );
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Prism MCP server running");
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
