import { realpath } from "node:fs/promises";
import path from "node:path";

/**
 * Resolve `candidate` under `workingDir` to a canonical absolute path, throwing if it escapes the
 * tree. Both sides are `realpath`-resolved so containment is symlink-proof (the path must exist);
 * an omitted candidate is the working directory itself.
 */
export const confineToWorkingDir = async (
  candidate: string | undefined,
  workingDir: string,
): Promise<string> => {
  const root = await realpath(path.resolve(workingDir));

  let target: string;
  try {
    target = await realpath(path.resolve(root, candidate ?? "."));
  } catch {
    throw new Error(
      `Refusing to operate on '${candidate ?? "."}': it does not exist or is not accessible ` +
        `under ${root}.`,
    );
  }

  const rel = path.relative(root, target);
  if (rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    throw new Error(
      `Refusing to operate on '${candidate ?? "."}': it resolves outside the server ` +
        `working directory (${root}).`,
    );
  }

  return target;
};
