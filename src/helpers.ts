import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { x } from "tinyexec";

/** Parse `stdout` as JSON (falling back to raw text) and wrap it as a CallToolResult. */
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

/** Build an argv from a base (subcommand + positionals) and an options map, one entry per value. */
export const buildArgs = (base: string[], options: Record<string, unknown>): string[] => {
  const args = [...base];

  for (const [key, value] of Object.entries(options)) {
    if (value === undefined || value === null) {
      continue;
    }
    if (typeof value === "boolean") {
      if (value) {
        args.push(`--${key}`);
      }
    } else if (typeof value === "string") {
      args.push(`--${key}`, value);
    } else if (typeof value === "number") {
      args.push(`--${key}`, String(value));
    }
  }

  return args;
};

/** Run a command without a shell (argv, no quoting), throwing its output on a non-zero exit. */
export const run = async (
  command: string,
  args: string[],
  cwd: string,
): Promise<{ stdout: string; stderr: string }> => {
  const result = await x(command, args, { nodeOptions: { cwd } });

  if (result.exitCode !== 0) {
    const output = [result.stdout, result.stderr]
      .map((stream) => stream.trim())
      .filter(Boolean)
      .join("\n");
    throw new Error(output || `\`${command}\` exited with code ${result.exitCode}`);
  }

  return { stdout: result.stdout, stderr: result.stderr };
};
