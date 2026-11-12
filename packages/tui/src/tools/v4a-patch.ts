/**
 * The files a V4A patch (`*** Begin Patch ... *** End Patch`) names. The presentation layer uses
 * this so a header and an approval prompt can say WHAT will change. Input is hostile: this never
 * throws, and text without V4A markers yields `[]`.
 */
export type V4AFileOp = "add" | "update" | "delete" | "move";

export interface V4AFile {
  path: string;
  op: V4AFileOp;
  /** The original path, for a `move`. */
  from?: string;
}

const FILE_MARKER = /^\*\*\* (Add|Update|Delete) File:\s*(.+?)\s*$/;
const MOVE_MARKER = /^\*\*\* Move to:\s*(.+?)\s*$/;

/** Files named by a V4A patch, in order. Never throws; non-V4A text returns []. */
export function parseV4APatchFiles(patch: string): V4AFile[] {
  if (typeof patch !== "string") return [];
  const files: V4AFile[] = [];
  for (const line of patch.split(/\r?\n/)) {
    const file = FILE_MARKER.exec(line);
    if (file) {
      const op = (file[1] as string).toLowerCase() as V4AFileOp;
      files.push({ path: file[2] as string, op });
      continue;
    }
    const move = MOVE_MARKER.exec(line);
    const last = files[files.length - 1];
    if (move && last?.op === "update") {
      files[files.length - 1] = { path: move[1] as string, op: "move", from: last.path };
    }
  }
  return files;
}
