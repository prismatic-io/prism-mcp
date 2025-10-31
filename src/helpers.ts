import { exec } from "node:child_process";
import { findExecutable } from "./findExecutablePath.js";
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
  const result = await findExecutable("prism", {
    npxPackage: "@prismatic-io/prism",
    logPrefix: "findPrismPath",
  });

  if (!result) {
    return null;
  }

  if (result.isNpx) {
    return `${result.command} ${result.args.join(' ')}`;
  }

  return result.command;
}
