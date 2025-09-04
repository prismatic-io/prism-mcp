import { exec } from "node:child_process";
import { findExecutablePath } from "./findExecutablePath.js";
import { PrismCLIManager } from "./prism-cli-manager.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { promisify } from "node:util";

export const execAsync = promisify(exec);

/**
 * Parse output and format as CallToolResult
 */
export function formatToolResult(stdout: string, dataKey?: string): CallToolResult {
  try {
    const data = JSON.parse(stdout);
    const result = dataKey ? { [dataKey]: data } : data;
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch {
    return {
      content: [
        {
          type: "text",
          text: stdout.trim(),
        },
      ],
    };
  }
}

/**
 * Look up flow URL by ID or name
 */
export async function lookupFlowUrl(
  integrationId: string,
  flowId?: string,
  flowName?: string,
): Promise<string> {
  if (!flowId && !flowName) {
    throw new Error("Either a flow ID or flow name must be provided");
  }

  const manager = PrismCLIManager.getInstance();
  const listCommand = buildCommand(`integrations:flows:list "${integrationId}"`, {
    extended: true,
    output: "json",
  });
  const { stdout: flowsJson } = await manager.executeCommand(listCommand);
  const flows = JSON.parse(flowsJson);

  const flow = flows.find(
    (f: { id: string; name: string; url?: string }) =>
      (flowId && f.id === flowId) || (flowName && f.name === flowName),
  );

  if (!flow) {
    throw new Error(`Flow not found with ${flowId ? `ID: ${flowId}` : `name: ${flowName}`}`);
  }

  const flowUrl = flow.webhookUrl || flow.url;
  if (!flowUrl) {
    throw new Error("Flow does not have a webhook URL");
  }

  return flowUrl;
}

/**
 * Build command with optional flags
 */
export function buildCommand(baseCommand: string, options: Record<string, any>): string {
  let command = baseCommand;

  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined && value !== null) {
      if (typeof value === "boolean" && value) {
        command += ` --${key}`;
      } else if (typeof value === "string") {
        command += ` --${key} "${value}"`;
      } else if (typeof value === "number") {
        command += ` --${key} ${value}`;
      }
    }
  }

  return command;
}

/**
 * Find prism executable path.
 */
export async function findPrismPath(): Promise<string | null> {
  return findExecutablePath("prism", {
    npxFallback: "@prismatic-io/prism",
    logPrefix: "findPrismPath",
  });
}
