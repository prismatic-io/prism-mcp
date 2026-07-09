import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { PrismCLIManager } from "./prism-cli-manager.js";
import { createServer, registerTools } from "./tools.js";

/** Connect an in-memory MCP client to a freshly-registered server. */
async function connectClient(toolsets?: string[]) {
  const server = createServer();
  registerTools(server, toolsets);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "tools-contract-test", version: "1.0.0" });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return {
    client,
    async close() {
      await client.close();
      await server.close();
    },
  };
}

describe("CLI argv the tools hand to prism", () => {
  let manager: PrismCLIManager;
  let executeCommand: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    manager = PrismCLIManager.getInstance(process.cwd());
    executeCommand = vi
      .spyOn(manager, "executeCommand")
      .mockResolvedValue({ stdout: "{}", stderr: "" });
  });

  afterEach(() => {
    manager.dispose();
  });

  test("prism_components_list forwards the default columns without a search term", async () => {
    const { client, close } = await connectClient();
    try {
      await client.callTool({
        name: "prism_components_list",
        arguments: {},
      });
    } finally {
      await close();
    }

    expect(executeCommand).toHaveBeenCalledTimes(1);
    const argv = executeCommand.mock.calls[0][0] as string[];
    expect(argv).toContain("--columns");
    expect(argv).toContain("key,label,public");
  });

  test("prism_integrations_convert passes a positional id with its flags", async () => {
    const { client, close } = await connectClient();
    try {
      await client.callTool({
        name: "prism_integrations_convert",
        arguments: { integrationId: "ABC123", registryPrefix: "@acme", includeComments: true },
      });
    } finally {
      await close();
    }

    expect(executeCommand).toHaveBeenCalledTimes(1);
    const argv = executeCommand.mock.calls[0][0] as string[];
    expect(argv).toEqual([
      "integrations:convert",
      "ABC123",
      "--registryPrefix",
      "@acme",
      "--includeComments",
    ]);
  });
});

describe("tool surface documentation", () => {
  test("every registered tool parameter carries a description", async () => {
    const { client, close } = await connectClient();
    let tools: Awaited<ReturnType<Client["listTools"]>>["tools"];
    try {
      ({ tools } = await client.listTools());
    } finally {
      await close();
    }

    type ParamSchema = {
      description?: string;
      properties?: Record<string, ParamSchema>;
      items?: ParamSchema;
    };

    const collect = (prefix: string, schema: ParamSchema, out: string[]): void => {
      for (const [name, prop] of Object.entries(schema.properties ?? {})) {
        const path = `${prefix}.${name}`;
        if (!prop.description || prop.description.trim() === "") {
          out.push(path);
        }
        collect(path, prop, out);
        if (prop.items) {
          collect(`${path}[]`, prop.items, out);
        }
      }
    };

    const undocumented: string[] = [];
    for (const tool of tools) {
      collect(tool.name, tool.inputSchema as ParamSchema, undocumented);
    }

    expect(undocumented).toEqual([]);
  });

  test("prism_components_generate_manifest exposes exactly its supported parameters", async () => {
    const { client, close } = await connectClient();
    let tools: Awaited<ReturnType<Client["listTools"]>>["tools"];
    try {
      ({ tools } = await client.listTools());
    } finally {
      await close();
    }

    const tool = tools.find((t) => t.name === "prism_components_generate_manifest");
    const params = Object.keys((tool?.inputSchema?.properties ?? {}) as Record<string, unknown>);
    expect(new Set(params)).toEqual(
      new Set(["componentDir", "outputDir", "registry", "dryRun", "skipSignatureVerify", "name"]),
    );
  });

  test("prism_integrations_add_datasource_config_var describes a data source", async () => {
    const { client, close } = await connectClient();
    let tools: Awaited<ReturnType<Client["listTools"]>>["tools"];
    try {
      ({ tools } = await client.listTools());
    } finally {
      await close();
    }

    const tool = tools.find((t) => t.name === "prism_integrations_add_datasource_config_var");
    expect(tool).toBeDefined();
    expect(tool?.description ?? "").toMatch(/data source/i);
  });
});
