import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, test } from "vitest";
import { VALID_TOOLSETS, createServer, registerTools } from "./tools.js";

/** Lists the tool names a client sees over a real in-memory tools/list. */
const listToolNames = async (toolsets?: string[]): Promise<Set<string>> => {
  const server = createServer();
  registerTools(server, toolsets);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "tool-surface-test", version: "1.0.0" });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

  try {
    const { tools } = await client.listTools();
    return new Set(tools.map((tool) => tool.name));
  } finally {
    await client.close();
    await server.close();
  }
};

/** The registered surface: the tools every toolset shares, plus each toolset's own additions. */
const surface = async () => {
  const [all, integration, component] = await Promise.all([
    listToolNames(),
    listToolNames(["integration"]),
    listToolNames(["component"]),
  ]);
  const general = integration.intersection(component);
  return {
    all,
    integration,
    component,
    general,
    integrationOnly: integration.difference(general),
    componentOnly: component.difference(general),
  };
};

describe("registered tool surface", () => {
  test("default registration is the union of every toolset", async () => {
    const { all, integration, component } = await surface();
    expect(all).toEqual(integration.union(component));
  });

  test("general tools are shared by every toolset", async () => {
    const { general } = await surface();
    expect(general.size).toBeGreaterThan(0);
    for (const toolset of VALID_TOOLSETS) {
      expect(general.isSubsetOf(await listToolNames([toolset]))).toBe(true);
    }
  });

  test("each toolset contributes a non-empty set of tools", async () => {
    const { integrationOnly, componentOnly } = await surface();
    expect(integrationOnly.size).toBeGreaterThan(0);
    expect(componentOnly.size).toBeGreaterThan(0);
  });

  test("selecting a toolset excludes the other's tools", async () => {
    const readme = await readFile(fileURLToPath(new URL("../README.md", import.meta.url)), "utf8");
    const [integration, component] = await Promise.all([
      listToolNames(["integration"]),
      listToolNames(["component"]),
    ]);
    expect(integration.isDisjointFrom(documentedUnder(readme, "Component Tools"))).toBe(true);
    expect(component.isDisjointFrom(documentedUnder(readme, "Integration Tools"))).toBe(true);
  });

  test("an omitted toolsets argument matches an empty one", async () => {
    expect(await listToolNames(undefined)).toEqual(await listToolNames([]));
  });

  test("naming every toolset is the same as naming none", async () => {
    expect(await listToolNames([...VALID_TOOLSETS])).toEqual(await listToolNames());
  });

  test("repeating a toolset registers its tools once", async () => {
    expect(await listToolNames(["integration", "integration"])).toEqual(
      await listToolNames(["integration"]),
    );
  });

  test("every tool is namespaced under prism_", async () => {
    const names = await listToolNames();
    expect([...names].filter((name) => !name.startsWith("prism_"))).toEqual([]);
  });

  test("an unknown toolset is rejected", async () => {
    expect(() => registerTools(createServer(), ["bogus"])).toThrow(
      "Invalid toolset: bogus. Valid categories are: integration, component",
    );
  });
});

/** The bold tool names documented under a README h3 section (e.g. "General Tools"). */
const documentedUnder = (readme: string, heading: string): Set<string> => {
  const section = readme.split(/^### /m).find((chunk) => chunk.startsWith(heading)) ?? "";
  return new Set([...section.matchAll(/\*\*(prism_\w+)\*\*/g)].map((match) => match[1]));
};

describe("README", () => {
  const readReadme = () =>
    readFile(fileURLToPath(new URL("../README.md", import.meta.url)), "utf8");

  test("documents exactly the registered tools, each under the right toolset", async () => {
    const readme = await readReadme();
    const { all, general, integrationOnly, componentOnly } = await surface();

    expect(documentedUnder(readme, "General Tools")).toEqual(general);
    expect(documentedUnder(readme, "Integration Tools")).toEqual(integrationOnly);
    expect(documentedUnder(readme, "Component Tools")).toEqual(componentOnly);
    // Nothing is documented outside those sections.
    const documented = new Set(
      [...readme.matchAll(/\*\*(prism_\w+)\*\*/g)].map((match) => match[1]),
    );
    expect(documented).toEqual(all);
  });
});
