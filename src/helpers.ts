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

/** Credential vars (read by the prism CLI) withheld from subprocesses that don't authenticate. */
const SENSITIVE_ENV = ["PRISM_REFRESH_TOKEN", "PRISM_ACCESS_TOKEN"];

/**
 * `process.env` with credential vars set to `undefined` (not removed): tinyexec re-spreads
 * `process.env`, so the keys must be overridden for spawn to drop them.
 */
const scrubbedEnv = (): NodeJS.ProcessEnv =>
  Object.fromEntries([
    ...Object.entries(process.env).filter(([key]) => !SENSITIVE_ENV.includes(key)),
    ...SENSITIVE_ENV.map((key): [string, undefined] => [key, undefined]),
  ]);

/**
 * Run a command without a shell (argv, no quoting), throwing its output on a non-zero exit.
 * Credential vars are withheld from the child unless `inheritSecrets` is set.
 */
export const run = async (
  command: string,
  args: string[],
  cwd: string,
  { inheritSecrets = false }: { inheritSecrets?: boolean } = {},
): Promise<{ stdout: string; stderr: string }> => {
  const result = await x(command, args, {
    nodeOptions: { cwd, env: inheritSecrets ? process.env : scrubbedEnv() },
  });

  if (result.exitCode !== 0) {
    const output = [result.stdout, result.stderr]
      .map((stream) => stream.trim())
      .filter(Boolean)
      .join("\n");
    throw new Error(output || `\`${command}\` exited with code ${result.exitCode}`);
  }

  return { stdout: result.stdout, stderr: result.stderr };
};
