#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { parseJsonWithFallback, lookupFlowUrl, buildCommand } from "./helpers.js";
import { PrismCLIManager } from "./prism-cli-manager.js";
import { z } from "zod/v4";
import {
  EmptyArgsSchema,
  LoginArgsSchema,
  IntegrationInitArgsSchema,
  IntegrationConvertArgsSchema,
  ComponentInitArgsSchema,
  FlowListArgsSchema,
  FlowTestArgsSchema,
  type EmptyArgs,
  type LoginArgs,
  type IntegrationInitArgs,
  type IntegrationConvertArgs,
  type ComponentInitArgs,
  type FlowListArgs,
  type FlowTestArgs,
} from "./schemas.js";

const server = new Server(
  {
    name: "prism-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

interface PrismTool<T = any> {
  name: string;
  description: string;
  inputSchema: any;
  handler: (args: T) => Promise<any>;
  validate?: (args: any) => T;
}

const prismTools: PrismTool[] = [
  {
    name: "prism_me",
    description: "Check login status and display current user profile information",
    inputSchema: z.toJSONSchema(EmptyArgsSchema),
    validate: (args) => EmptyArgsSchema.parse(args),
    handler: async (_args: EmptyArgs) => {
      try {
        const manager = PrismCLIManager.getInstance();
        const output = await manager.me();
        return { output };
      } catch (error) {
        throw new Error(`Failed to get user info: ${(error as Error).message}`);
      }
    },
  },
  {
    name: "prism_login",
    description: "Authenticate with Prismatic (requires email and password)",
    inputSchema: z.toJSONSchema(LoginArgsSchema),
    validate: (args) => LoginArgsSchema.parse(args),
    handler: async (args: LoginArgs) => {
      try {
        const manager = PrismCLIManager.getInstance();
        // We need to explicitly include email & password for the MCP server version.
        const command = buildCommand("login", {
          email: args.email,
          password: args.password,
        });
        const { stdout } = await manager.executeCommand(command);
        return { output: stdout.trim() };
      } catch (error) {
        throw new Error(`Failed to login: ${(error as Error).message}`);
      }
    },
  },
  {
    name: "prism_logout",
    description: "Log out of Prismatic",
    inputSchema: z.toJSONSchema(EmptyArgsSchema),
    validate: (args) => EmptyArgsSchema.parse(args),
    handler: async () => {
      try {
        const manager = PrismCLIManager.getInstance();
        const output = await manager.logout();
        return { output: output || "Successfully logged out" };
      } catch (error) {
        throw new Error(`Failed to logout: ${(error as Error).message}`);
      }
    },
  },
  {
    name: "prism_integrations_list",
    description: "List all integrations in your organization",
    inputSchema: z.toJSONSchema(EmptyArgsSchema),
    validate: (args) => EmptyArgsSchema.parse(args),
    handler: async () => {
      try {
        const manager = PrismCLIManager.getInstance();
        const command = buildCommand("integrations:list", {
          output: "json",
        });
        const { stdout } = await manager.executeCommand(command);
        return parseJsonWithFallback(stdout, "integrations");
      } catch (error) {
        throw new Error(`Failed to list integrations: ${(error as Error).message}`);
      }
    },
  },
  {
    name: "prism_components_list",
    description: "List all components available in your organization",
    inputSchema: z.toJSONSchema(EmptyArgsSchema),
    validate: (args) => EmptyArgsSchema.parse(args),
    handler: async (args: EmptyArgs) => {
      try {
        const manager = PrismCLIManager.getInstance();
        const command = buildCommand("components:list", {
          output: "json",
        });
        const { stdout } = await manager.executeCommand(command);
        return parseJsonWithFallback(stdout, "components");
      } catch (error) {
        throw new Error(`Failed to list components: ${(error as Error).message}`);
      }
    },
  },
  {
    name: "prism_integrations_init",
    description: "Initialize a new Code Native Integration",
    inputSchema: z.toJSONSchema(IntegrationInitArgsSchema),
    validate: (args) => IntegrationInitArgsSchema.parse(args),
    handler: async (args: IntegrationInitArgs) => {
      try {
        const manager = PrismCLIManager.getInstance();
        const command = buildCommand(`integrations:init ${args.name}`, {
          directory: args.directory,
        });
        const { stdout } = await manager.executeCommand(command);
        return { output: stdout.toString().trim() };
      } catch (error) {
        throw new Error(`Failed to initialize integration: ${(error as Error).message}`);
      }
    },
  },
  {
    name: "prism_components_init",
    description: "Initialize a new Component",
    inputSchema: z.toJSONSchema(ComponentInitArgsSchema),
    validate: (args) => ComponentInitArgsSchema.parse(args),
    handler: async (args: ComponentInitArgs) => {
      try {
        const manager = PrismCLIManager.getInstance();
        const command = buildCommand(`components:init ${args.name}`, {
          "wsdl-path": args.wsdlPath,
          "open-api-path": args.openApiPath,
        });
        const { stdout } = await manager.executeCommand(command);
        return { output: stdout.trim() };
      } catch (error) {
        throw new Error(`Failed to initialize component: ${(error as Error).message}`);
      }
    },
  },
  {
    name: "prism_integrations_convert",
    description: "Convert a Low-Code Integration's YAML file into a Code Native Integration",
    inputSchema: z.toJSONSchema(IntegrationConvertArgsSchema),
    validate: (args) => IntegrationConvertArgsSchema.parse(args),
    handler: async (args: IntegrationConvertArgs) => {
      try {
        const manager = PrismCLIManager.getInstance();
        const command = buildCommand("integrations:convert", {
          yamlFile: args.yamlFile,
          folder: args.folder,
          registryPrefix: args.registryPrefix,
        });
        const { stdout } = await manager.executeCommand(command);
        return { output: stdout.trim() };
      } catch (error) {
        throw new Error(`Failed to convert integration: ${(error as Error).message}`);
      }
    },
  },
  {
    name: "prism_integrations_flows_list",
    description: "List flows for an integration",
    inputSchema: z.toJSONSchema(FlowListArgsSchema),
    validate: (args: any) => FlowListArgsSchema.parse(args),
    handler: async (args: FlowListArgs) => {
      try {
        const manager = PrismCLIManager.getInstance();
        const command = buildCommand(`integrations:flows:list "${args.integrationId}"`, {
          extended: true,
          columns: args.columns,
          output: "json",
        });
        
        const { stdout } = await manager.executeCommand(command);
        
        return parseJsonWithFallback(stdout, "flows");
      } catch (error) {
        throw new Error(`Failed to list flows: ${(error as Error).message}`);
      }
    },
  },
  {
    name: "prism_integrations_flows_test",
    description: "Test a flow in an integration",
    inputSchema: z.toJSONSchema(FlowTestArgsSchema),
    validate: (args: any) => FlowTestArgsSchema.parse(args),
    handler: async (args: FlowTestArgs) => {
      try {
        let flowUrl = args.flowUrl;

        if ((args.tailLogs || args.tailResults) && !args.timeout) {
          throw new Error("If tailing logs or step results via MCP server, a timeout (in seconds) is required.")
        }
        
        // If no direct URL provided, we need to look it up
        if (!flowUrl) {
          if (!args.integrationId) {
            throw new Error("integrationId is required when flowUrl is not provided");
          }
          flowUrl = await lookupFlowUrl(args.integrationId, args.flowId, args.flowName);
        }
        
        // Build the test command
        const manager = PrismCLIManager.getInstance();
        const command = buildCommand(`integrations:flows:test --flow-url "${flowUrl}" --jsonl --succinct`, {
          payload: args.payload,
          "payload-content-type": args.payloadContentType,
          sync: args.sync,
          "tail-logs": args.tailLogs,
          "tail-results": args.tailResults,
          timeout: args.timeout,
          "result-file": args.resultFile,
        });
        
        const { stdout } = await manager.executeCommand(command);
        return { output: stdout.trim() };
      } catch (error) {
        throw new Error(`Failed to test flow: ${(error as Error).message}`);
      }
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: prismTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  const tool = prismTools.find((t) => t.name === name);
  if (!tool) {
    throw new Error(`Tool not found: ${name}`);
  }
  
  try {
    // Validate args if needed
    const validatedArgs = tool.validate ? tool.validate(args || {}) : (args || {});
    const result = await tool.handler(validatedArgs);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${(error as Error).message}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  try {
    // Initialize the manager with working directory from environment
    const manager = PrismCLIManager.getInstance(process.env.WORKING_DIRECTORY, process.env.PRISMATIC_URL);
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(`Prism MCP server running`);
  } catch (error) {
    console.error("Error: Failed to start Prism MCP server:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
