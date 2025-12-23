import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "./index.js";
import os from "node:os";

describe("prism-mcp server", () => {
  let client: Client;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    // Create linked transports for in-memory communication
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    // Create and connect the server
    const server = createServer({
      workingDirectory: os.tmpdir(),
      toolsets: ["integration"],
    });
    await server.connect(serverTransport);

    // Create and connect the test client
    client = new Client(
      { name: "test-client", version: "1.0.0" },
      { capabilities: {} },
    );
    await client.connect(clientTransport);

    cleanup = async () => {
      await client.close();
      await server.close();
    };
  });

  afterAll(async () => {
    await cleanup?.();
  });

  it("should list available tools", async () => {
    const result = await client.listTools();

    expect(result.tools).toBeDefined();
    expect(Array.isArray(result.tools)).toBe(true);
    expect(result.tools.length).toBeGreaterThan(0);

    // Check that some expected tools are present
    const toolNames = result.tools.map((t) => t.name);
    expect(toolNames).toContain("prism_me");
    expect(toolNames).toContain("prism_integrations_list");
  });

  it("should only register requested toolsets", async () => {
    // Create a separate server with only component toolset
    const [clientTransport2, serverTransport2] = InMemoryTransport.createLinkedPair();

    const componentServer = createServer({
      workingDirectory: os.tmpdir(),
      toolsets: ["component"],
    });
    await componentServer.connect(serverTransport2);

    const componentClient = new Client(
      { name: "test-client-2", version: "1.0.0" },
      { capabilities: {} },
    );
    await componentClient.connect(clientTransport2);

    const result = await componentClient.listTools();
    const toolNames = result.tools.map((t) => t.name);

    // Should have component tools
    expect(toolNames).toContain("prism_components_init");
    expect(toolNames).toContain("prism_components_publish");

    // Should NOT have integration-specific tools
    expect(toolNames).not.toContain("prism_integrations_list");
    expect(toolNames).not.toContain("prism_integrations_init");

    // Should still have general tools
    expect(toolNames).toContain("prism_me");

    await componentClient.close();
    await componentServer.close();
  });
});
