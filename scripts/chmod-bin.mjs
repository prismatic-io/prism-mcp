// Make the built CLI entry (a shebang bin) executable.
import { chmod } from "node:fs/promises";

await chmod("dist/index.js", 0o755);
