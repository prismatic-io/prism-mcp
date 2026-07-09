import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { snakeCase } from "lodash-es";
import { z } from "zod";

import { resolveLocalBin } from "./findExecutablePath.js";
import {
  generateConfigPage,
  generateConfigVar,
  generateConnectionConfigVar,
  generateDataSourceConfigVar,
  generateFlowFile,
} from "./generate.js";
import { buildArgs, formatToolResult, run } from "./helpers.js";
import { confineToWorkingDir } from "./paths.js";
import { PrismCLIManager } from "./prism-cli-manager.js";

/** A fresh server per call: McpServer.tool() throws on a duplicate name, so the
 * registration functions below cannot be replayed against a shared instance. */
export function createServer(): McpServer {
  return new McpServer({ name: "prism-mcp", version: "1.0.0" });
}

export const VALID_TOOLSETS = ["integration", "component"];
const DEFAULT_TIMEOUT = 300; // 5 minutes

function registerGeneralTools(server: McpServer) {
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
    },
  );

  server.tool(
    "prism_components_list",
    "List the components available in your organization. Searching for 'http' short-circuits with guidance to build a client via @prismatic-io/spectral's createClient instead of using the HTTP component.",
    {
      search: z
        .string()
        .optional()
        .describe(
          "Filter components by name or key; the special value 'http' returns createClient guidance",
        ),
      columns: z
        .string()
        .optional()
        .describe("Comma separated list of columns")
        .default("key,label,public"),
    },
    async ({ search, columns }) => {
      if (search === "http") {
        return formatToolResult(
          JSON.stringify({
            instruction:
              "Users should build clients using @prismatic-io/spectral's createClient instead of using Prismatic's HTTP component.",
          }),
        );
      }

      try {
        const manager = PrismCLIManager.getInstance();
        const fallbackCommand = buildArgs(["components:list"], {
          output: "json",
          columns,
        });

        // If search parameter is provided, try with --search flag first
        if (search) {
          try {
            const command = buildArgs(["components:list"], {
              output: "json",
              search,
              columns,
            });
            const { stdout } = await manager.executeCommand(command);
            return formatToolResult(
              JSON.stringify({
                stdout,
                instruction:
                  "If the desired component is not found, build a client using @prismatic-io/spectral's createClient.",
              }),
            );
          } catch (searchError) {
            // If --search flag is not supported, fall back to command without it
            const { stdout } = await manager.executeCommand(fallbackCommand);
            return formatToolResult(
              JSON.stringify({
                stdout,
                instruction:
                  "If the desired component is not found, build a client using @prismatic-io/spectral's createClient.",
              }),
            );
          }
        } else {
          // No search parameter provided, use regular command
          const { stdout } = await manager.executeCommand(fallbackCommand);
          return formatToolResult(stdout, "components");
        }
      } catch (error) {
        throw new Error(`Failed to list components: ${(error as Error).message}`);
      }
    },
  );
}

function registerIntegrationTools(server: McpServer) {
  server.tool(
    "prism_integrations_list",
    "List all integrations in your organization",
    {
      search: z.string().optional().describe("Filter integrations by name"),
      columns: z
        .string()
        .optional()
        .describe("Comma separated list of columns")
        .default("name,description,version"),
    },
    async ({ search, columns }) => {
      const baseParams = { output: "json", columns };
      try {
        const manager = PrismCLIManager.getInstance();

        // If search parameter is provided, try with --search flag first
        if (search) {
          try {
            const command = buildArgs(["integrations:list"], {
              ...baseParams,
              search,
            });
            const { stdout } = await manager.executeCommand(command);
            return formatToolResult(stdout, "integration");
          } catch (searchError) {
            // If --search flag is not supported, fall back to command without it
            const command = buildArgs(["integrations:list"], baseParams);
            const { stdout } = await manager.executeCommand(command);
            return formatToolResult(stdout, "integration");
          }
        } else {
          // No search parameter provided, use regular command
          const command = buildArgs(["integrations:list"], baseParams);
          const { stdout } = await manager.executeCommand(command);
          return formatToolResult(stdout, "integration");
        }
      } catch (error) {
        throw new Error(`Failed to list integrations: ${(error as Error).message}`);
      }
    },
  );
  server.tool(
    "prism_integrations_init",
    "Initialize a new Prismatic Code Native Integration (CNI)",
    {
      name: z
        .string()
        .min(1)
        .regex(/^[a-zA-Z0-9_-]+$/, "Name must be alphanumeric with hyphens and underscores only")
        .describe("Name for the new Code Native Integration (alphanumeric, hyphens, underscores)"),
    },
    async ({ name }) => {
      try {
        const manager = PrismCLIManager.getInstance();

        try {
          // Try with --clean flag first
          const command = buildArgs(["integrations:init", name], {
            clean: true,
          });
          const { stdout } = await manager.executeCommand(command);
          return formatToolResult(stdout);
        } catch (cleanError) {
          // If --clean flag is not supported, fall back to command without it
          const { stdout } = await manager.executeCommand(["integrations:init", name]);
          return formatToolResult(stdout);
        }
      } catch (error) {
        throw new Error(`Failed to initialize integration: ${(error as Error).message}`);
      }
    },
  );

  server.tool(
    "prism_integrations_convert",
    "Convert an existing Low-Code Integration into a Code Native Integration, scaffolding the generated code in the working directory",
    {
      integrationId: z.string().min(1).describe("ID of the Low-Code Integration to convert"),
      registryPrefix: z
        .string()
        .optional()
        .describe("Registry (npm scope) prefix for the generated integration's package name"),
      registryUrl: z
        .string()
        .optional()
        .describe("Registry URL to use for the generated integration"),
      includeComments: z
        .boolean()
        .optional()
        .describe("Include explanatory inline comments in the generated code"),
    },
    async ({ integrationId, registryPrefix, registryUrl, includeComments }) => {
      try {
        const manager = PrismCLIManager.getInstance();
        const command = buildArgs(["integrations:convert", integrationId], {
          registryPrefix,
          registryUrl,
          includeComments,
        });
        const { stdout } = await manager.executeCommand(command);
        return formatToolResult(stdout);
      } catch (error) {
        throw new Error(`Failed to convert integration: ${(error as Error).message}`);
      }
    },
  );

  server.tool(
    "prism_integrations_flows_list",
    "List flows for an integration",
    {
      integrationId: z.string().min(1).describe("ID of the integration whose flows to list"),
      columns: z.string().optional().describe("Comma separated list of columns"),
    },
    async ({ integrationId, columns }) => {
      try {
        const manager = PrismCLIManager.getInstance();
        const command = buildArgs(["integrations:flows:list", integrationId], {
          columns,
          output: "json",
        });

        const { stdout } = await manager.executeCommand(command);

        return formatToolResult(stdout, "flows");
      } catch (error) {
        throw new Error(`Failed to list flows: ${(error as Error).message}`);
      }
    },
  );

  server.tool(
    "prism_integrations_flows_test",
    "Test a flow in a Prismatic integration. Output is always returned quietly, as JSONL when tailing logs or results.",
    {
      flowName: z
        .string()
        .optional()
        .describe("Name of the flow to test; omit to test the only flow"),
      integrationId: z.string().describe("ID of the integration that owns the flow"),
      filepathToTestPayload: z
        .string()
        .optional()
        .describe("Path to a file whose contents are sent as the trigger payload"),
      payloadContentType: z
        .string()
        .optional()
        .describe("MIME type of the test payload, e.g. application/json"),
      sync: z
        .boolean()
        .optional()
        .describe("Wait synchronously for the run to finish and return its result"),
      tailLogs: z.boolean().optional().describe("Stream execution logs as JSONL"),
      tailResults: z.boolean().optional().describe("Stream step results as JSONL"),
      timeout: z
        .number()
        .positive()
        .describe("Seconds to wait before giving up (default 300)")
        .optional(),
      filepathToStoreResult: z.string().optional().describe("Path to write the run result to"),
      cniAutoEnd: z
        .boolean()
        .optional()
        .describe(
          "Automatically end the code-native test session when the flow completes (default true)",
        ),
    },
    async ({
      flowName,
      integrationId,
      filepathToTestPayload,
      payloadContentType,
      sync,
      tailLogs,
      tailResults,
      timeout = DEFAULT_TIMEOUT,
      filepathToStoreResult,
      cniAutoEnd = true,
    }) => {
      try {
        const manager = PrismCLIManager.getInstance();
        const command = buildArgs(["integrations:flows:test"], {
          "flow-name": flowName,
          "integration-id": integrationId,
          payload: filepathToTestPayload,
          "payload-content-type": payloadContentType,
          sync,
          "tail-logs": tailLogs,
          "tail-results": tailResults,
          timeout,
          "result-file": filepathToStoreResult,
          jsonl: tailLogs || tailResults,
          quiet: true,
          "cni-auto-end": cniAutoEnd,
        });

        const { stdout } = await manager.executeCommand(command);
        return formatToolResult(stdout);
      } catch (error) {
        throw new Error(`Failed to test flow: ${(error as Error).message}`);
      }
    },
  );

  server.tool(
    "prism_integrations_import",
    "Import a Prismatic code-native integration from a specific directory. The directory is built with `npm run build` before importing.",
    {
      directory: z.string().describe("Directory of the integration to build and import"),
      integrationId: z
        .string()
        .optional()
        .describe("ID of an existing integration to update instead of creating a new one"),
      path: z
        .string()
        .optional()
        .describe("Path to the YAML definition of an integration to import. Not applicable to CNI"),
      replace: z
        .boolean()
        .optional()
        .describe(
          "Allows replacing an existing integration regardless of code-native status. Requires integrationId.",
        ),
      iconPath: z
        .string()
        .optional()
        .describe("Path to the PNG icon for the integration. Not applicable for CNI."),
    },
    async ({ directory, integrationId, path, replace, iconPath }) => {
      try {
        if (replace && !integrationId) {
          throw new Error("If replace is true, an integrationId is required.");
        }

        const manager = PrismCLIManager.getInstance();
        const dir = await confineToWorkingDir(directory, manager.getWorkingDirectory());

        // First, run npm build in the integration directory
        await run("npm", ["run", "build"], dir);

        const command = buildArgs(["integrations:import"], {
          integrationId,
          path,
          replace,
          "icon-path": iconPath,
        });

        // Execute import command in the specified directory
        const { stdout } = await manager.executeCommand(command, dir);
        return formatToolResult(stdout);
      } catch (error) {
        throw new Error(`Failed to import integration: ${(error as Error).message}`);
      }
    },
  );

  server.tool(
    "prism_install_component_manifest",
    "If using spectral@10.6.0 or greater, generate a manifest in CNI src.",
    {
      directory: z
        .string()
        .optional()
        .describe(
          "Project directory to run the manifest generator in; defaults to the working directory",
        ),
      isPrivateComponent: z
        .boolean()
        .optional()
        .describe("Generate the manifest for a private component"),
      componentKey: z
        .string()
        .regex(
          /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/,
          "componentKey must start with a letter or digit and contain only letters, digits, hyphens, and underscores",
        )
        .describe("Key of the component to generate a manifest for"),
    },
    async ({ directory, isPrivateComponent, componentKey }) => {
      try {
        // cni-component-manifest ships as a bin inside @prismatic-io/spectral (>= 10.6.0).
        // Resolve it from the project's own install so it matches the project's spectral version.
        const manager = PrismCLIManager.getInstance();
        const dir = await confineToWorkingDir(directory, manager.getWorkingDirectory());
        const executable = await resolveLocalBin(
          dir,
          "@prismatic-io/spectral",
          "cni-component-manifest",
        );
        if (!executable) {
          throw new Error(
            "cni-component-manifest not found. Install @prismatic-io/spectral (>= 10.6.0) in the " +
              "project, or use prism_install_legacy_component_manifest",
          );
        }
        const result = await run(
          executable.command,
          [...executable.args, componentKey, ...(isPrivateComponent ? ["--private"] : [])],
          dir,
          { inheritSecrets: true },
        );

        return formatToolResult(
          JSON.stringify({
            stdout: result.stdout,
            instruction:
              "The AI agent should update the componentRegistry file after installation.",
          }),
        );
      } catch (error) {
        throw new Error(`Failed to generate boilerplate: ${(error as Error).message}.`);
      }
    },
  );

  // NOTE: May be deprecated soon.
  server.tool(
    "prism_install_legacy_component_manifest",
    "Fallback for when prism_install_component_manifest fails. Generates the devDependencies entry that installs a legacy component manifest.",
    {
      componentKey: z.string().describe("Key of the component to install a legacy manifest for"),
    },
    async ({ componentKey }) => {
      try {
        return formatToolResult(
          JSON.stringify({
            code: `"@component-manifests/${snakeCase(componentKey)}": "*"`,
            instruction:
              "The AI agent should update the componentRegistry file after installation.",
          }),
        );
      } catch (error) {
        throw new Error(`Failed to generate boilerplate: ${(error as Error).message}`);
      }
    },
  );

  server.tool(
    "prism_integrations_generate_flow",
    "Generate boilerplate file for a CNI flow. The result should be included in the CNI's list of available flows.",
    {
      name: z.string().describe("Name of the flow to generate"),
    },
    async ({ name }) => {
      try {
        const result = JSON.stringify({ code: generateFlowFile(name) });
        return formatToolResult(result);
      } catch (error) {
        throw new Error(`Failed to create flow boilerplate code: ${(error as Error).message}`);
      }
    },
  );

  server.tool(
    "prism_integrations_generate_config_page",
    "Generate boilerplate code for a CNI config page. The result should be included in the CNI's configPages object.",
    {
      name: z.string().describe("Name of the config page to generate"),
    },
    async ({ name }) => {
      try {
        const result = JSON.stringify({ code: generateConfigPage(name) });
        return formatToolResult(result);
      } catch (error) {
        throw new Error(
          `Failed to create config page boilerplate code: ${(error as Error).message}`,
        );
      }
    },
  );

  server.tool(
    "prism_integrations_generate_config_var",
    "Generate boilerplate code for a config variable. The result should be included in a CNI's existing config page.",
    {
      name: z.string().describe("Name of the config variable to generate"),
      dataType: z
        .string()
        .describe("Prismatic config-var data type, e.g. string, boolean, date, picklist, code"),
    },
    async ({ name, dataType }) => {
      try {
        const result = JSON.stringify({
          code: generateConfigVar(name, dataType),
        });
        return formatToolResult(result);
      } catch (error) {
        throw new Error(
          `Failed to create config var boilerplate code: ${(error as Error).message}`,
        );
      }
    },
  );

  server.tool(
    "prism_integrations_add_connection_config_var",
    "Returns the path to a file that contains a connection wrapper function. If not available, generates boilerplate code for a connection config variable.",
    {
      name: z.string().describe("Name of the connection config variable to add"),
      componentRef: z
        .object({
          componentKey: z.string().describe("Key of the component providing the connection"),
          connectionKey: z.string().describe("Key of the connection on that component"),
        })
        .optional()
        .describe("Component connection to wrap; omit to generate standalone boilerplate"),
      directory: z
        .string()
        .optional()
        .describe(
          "Directory to resolve component manifests from; defaults to the working directory",
        ),
      forceLegacy: z
        .boolean()
        .optional()
        .describe(
          "Emit legacy inline config-var code even when an installed component manifest is found",
        ),
    },
    async ({ name, componentRef, directory, forceLegacy }) => {
      try {
        const manager = PrismCLIManager.getInstance();
        const generatedConnection = generateConnectionConfigVar(
          name,
          componentRef,
          directory || manager.getWorkingDirectory(),
          forceLegacy,
        );

        if (generatedConnection.type === "path") {
          return formatToolResult(
            JSON.stringify({
              path: generatedConnection.response,
              instruction:
                "The file at this path contains a wrapper function that can be used to define a Prismatic connection. The AI agent should use this function in an integration's config page.",
            }),
          );
        }
        return formatToolResult(generatedConnection.response);
      } catch (error) {
        throw new Error(
          `Failed to create connection config var boilerplate code: ${(error as Error).message}`,
        );
      }
    },
  );

  server.tool(
    "prism_integrations_add_datasource_config_var",
    "Returns the path to a file that contains a data source wrapper function. If not available, generates boilerplate code for a data source config variable.",
    {
      name: z.string().describe("Name of the data source config variable to add"),
      dataType: z
        .string()
        .describe(
          "Prismatic config-var data type the data source resolves to, e.g. string, picklist, schedule",
        ),
      componentRef: z
        .object({
          componentKey: z.string().describe("Key of the component providing the data source"),
          dataSourceKey: z.string().describe("Key of the data source on that component"),
        })
        .optional()
        .describe("Component data source to wrap; omit to generate standalone boilerplate"),
      directory: z
        .string()
        .optional()
        .describe(
          "Directory to resolve component manifests from; defaults to the working directory",
        ),
      forceLegacy: z
        .boolean()
        .optional()
        .describe(
          "Emit legacy inline config-var code even when an installed component manifest is found",
        ),
    },
    async ({ name, dataType, componentRef, directory, forceLegacy }) => {
      try {
        const manager = PrismCLIManager.getInstance();
        const generatedDataSource = generateDataSourceConfigVar(
          name,
          dataType,
          componentRef,
          directory || manager.getWorkingDirectory(),
          forceLegacy,
        );

        if (generatedDataSource.type === "path") {
          return formatToolResult(
            JSON.stringify({
              path: generatedDataSource.response,
              instruction:
                "The file at this path contains a wrapper function that can be used to define a Prismatic data source. The AI agent should use this function in an integration's config page.",
            }),
          );
        }

        return formatToolResult(generatedDataSource.response);
      } catch (error) {
        throw new Error(
          `Failed to create datasource config var boilerplate code: ${(error as Error).message}`,
        );
      }
    },
  );

  server.tool(
    "prism_integrations_flows_listen",
    "Set a flow to 'Listening Mode,' allowing you to capture webhook payloads or polling trigger responses and save them as payloads to be used by the integrations:flows:test command. For flows using polling triggers, the user should create the events before invoking this tool. For flows using webhook triggers, the user creates the event while you listen. Listening runs non-interactively (quiet, no prompts).",
    {
      flowName: z
        .string()
        .optional()
        .describe("Name of the flow to listen on; omit for the only flow"),
      integrationId: z.string().describe("ID of the integration that owns the flow"),
      outputDir: z.string().optional().describe("Directory to save captured payloads to"),
      timeout: z
        .number()
        .positive()
        .describe("Seconds to listen before giving up (default 300)")
        .optional(),
    },
    async ({ flowName, integrationId, outputDir, timeout = DEFAULT_TIMEOUT }) => {
      try {
        const manager = PrismCLIManager.getInstance();
        const command = buildArgs(["integrations:flows:listen"], {
          "flow-name": flowName,
          "integration-id": integrationId,
          timeout,
          output: outputDir,
          quiet: true,
          "no-prompt": true,
        });

        const { stdout } = await manager.executeCommand(command);
        return formatToolResult(stdout);
      } catch (error) {
        throw new Error(`Listening mode failed: ${(error as Error).message}`);
      }
    },
  );
}

function registerComponentTools(server: McpServer) {
  server.tool(
    "prism_components_init",
    "Initialize a new Prismatic custom component. Passing a WSDL or OpenAPI spec scaffolds the component from that definition.",
    {
      name: z.string().min(1).describe("Name for the new custom component"),
      wsdlPath: z
        .string()
        .optional()
        .describe("Path to a WSDL file to scaffold the component from"),
      openApiPath: z
        .string()
        .optional()
        .describe("Path to an OpenAPI spec to scaffold the component from"),
    },
    async ({ name, wsdlPath, openApiPath }) => {
      try {
        const manager = PrismCLIManager.getInstance();
        const command = buildArgs(["components:init", name], {
          "wsdl-path": wsdlPath,
          "open-api-path": openApiPath,
        });
        const { stdout } = await manager.executeCommand(command);
        return formatToolResult(stdout);
      } catch (error) {
        throw new Error(`Failed to initialize component: ${(error as Error).message}`);
      }
    },
  );

  server.tool(
    "prism_components_publish",
    "Publish a custom Prismatic component from a specific directory. The directory is built with `npm run build` first and published non-interactively.",
    {
      directory: z.string().describe("Directory of the component to build and publish"),
      comment: z.string().optional().describe("Comment describing this publish"),
      pullRequestUrl: z
        .string()
        .optional()
        .describe("URL of the pull request associated with this publish"),
      repoUrl: z.string().optional().describe("URL of the source repository"),
      noCheckSignature: z
        .boolean()
        .optional()
        .describe("Skip verifying the component's signature before publishing"),
      customer: z
        .string()
        .optional()
        .describe("ID of the customer to scope a customer-specific publish to"),
      commitHash: z.string().optional().describe("Commit hash to record with this publish"),
      commitUrl: z.string().optional().describe("URL of the commit to record with this publish"),
      skipOnSignatureMatch: z
        .boolean()
        .optional()
        .describe("Skip publishing when the signature matches the currently published version"),
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
        const dir = await confineToWorkingDir(directory, manager.getWorkingDirectory());

        // First, run npm build in the component directory
        await run("npm", ["run", "build"], dir);

        const command = buildArgs(["components:publish"], {
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
        const { stdout } = await manager.executeCommand(command, dir);
        return formatToolResult(stdout);
      } catch (error) {
        throw new Error(`Failed to publish component: ${(error as Error).message}`);
      }
    },
  );

  server.tool(
    "prism_components_generate_manifest",
    "Generate the type manifest for a Prismatic component to enable its usage within a Code-Native Integration. The component is built with `npm run build` first, and outputDir gets a `<component dir name>-manifest` subfolder appended.",
    {
      componentDir: z
        .string()
        .describe("Directory of the component to build and generate a manifest for"),
      outputDir: z
        .string()
        .optional()
        .describe(
          "Directory to write the manifest into; a `<component dir name>-manifest` subfolder is appended, falling back to the name param when the directory has no basename",
        ),
      registry: z
        .string()
        .optional()
        .describe("Registry (npm scope) to publish the manifest under"),
      dryRun: z.boolean().optional().describe("Generate the manifest without writing it to disk"),
      skipSignatureVerify: z
        .boolean()
        .optional()
        .describe("Skip verifying the component's signature"),
      name: z
        .string()
        .optional()
        .describe(
          "Manifest name; used for the output subfolder when the directory has no basename",
        ),
    },
    async ({ componentDir, outputDir, registry, dryRun, skipSignatureVerify, name }) => {
      try {
        const manager = PrismCLIManager.getInstance();
        const dir = await confineToWorkingDir(componentDir, manager.getWorkingDirectory());

        // Build the component before attempting to generate the manifest
        await run("npm", ["run", "build"], dir);

        const args = buildArgs(["component-manifest"], {
          "output-dir": outputDir
            ? path.join(outputDir, `${path.basename(dir) || name}-manifest`)
            : undefined,
          registry,
          "dry-run": dryRun,
          "skip-signature-verify": skipSignatureVerify,
          name,
        });

        const { stdout } = await run(args[0], args.slice(1), dir, { inheritSecrets: true });
        return formatToolResult(stdout);
      } catch (error) {
        throw new Error(`Failed to generate component manifest: ${(error as Error).message}`);
      }
    },
  );
}

export function registerTools(server: McpServer, toolsets: string[] = []) {
  if (toolsets && toolsets.length > 0) {
    const invalidToolsets = toolsets.filter((toolset) => !VALID_TOOLSETS.includes(toolset));
    if (invalidToolsets.length > 0) {
      throw Error(
        `Invalid toolset: ${invalidToolsets.join(
          ", ",
        )}. Valid categories are: ${VALID_TOOLSETS.join(", ")}`,
      );
    }
  }

  registerGeneralTools(server);

  if (toolsets.length > 0) {
    // Register each named toolset once; server.tool() rejects a duplicate tool name.
    for (const toolset of new Set(toolsets)) {
      switch (toolset) {
        case "component":
          registerComponentTools(server);
          break;
        case "integration":
          registerIntegrationTools(server);
          break;
        default:
          break;
      }
    }
  } else {
    registerComponentTools(server);
    registerIntegrationTools(server);
  }
}
