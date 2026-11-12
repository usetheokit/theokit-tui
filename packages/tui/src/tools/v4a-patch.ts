/**
 * Files named by a V4A patch (`*** Begin Patch ... *** End Patch`), the envelope the framework's
 * `apply_patch` tool takes. The input comes from a model, so nothing here throws.
 */
export type V4AFileOp = "add" | "update" | "delete" | "move";

export interface V4AFile {
  path: string;
  op: V4AFileOp;
  /** The original path, set only when `op` is `"move"`. */
  from?: string;
}

const MARKERS: readonly (readonly [string, Exclude<V4AFileOp, "move">])[] = [
  ["*** Add File:", "add"],
  ["*** Update File:", "update"],
  ["*** Delete File:", "delete"],
];
const MOVE = "*** Move to:";

/** Files named by a V4A patch, in order. Never throws; non-V4A text returns []. */
export function parseV4APatchFiles(patch: string): V4AFile[] {
  if (typeof patch !== "string") return [];
  const files: V4AFile[] = [];
  for (const raw of patch.split("\n")) {
    const line = raw.trim();
    if (!line.startsWith("***")) continue;
    const marker = MARKERS.find(([prefix]) => line.startsWith(prefix));
    if (marker !== undefined) {
      const path = line.slice(marker[0].length).trim();
      if (path.length > 0) files.push({ path, op: marker[1] });
      continue;
    }
    if (line.startsWith(MOVE)) {
      const last = files[files.length - 1];
      const target = line.slice(MOVE.length).trim();
      if (last !== undefined && last.op === "update" && target.length > 0) {
        files[files.length - 1] = { path: target, op: "move", from: last.path };
      }
    }
  }
  return files;
}
