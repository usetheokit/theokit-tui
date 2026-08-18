// Internal barrel for the search domain (ADR 0001 / ADR 0002).
//
// Nothing here is re-exported from src/index.ts — file search and fuzzy ranking
// are consumed by src/chat (the @-mention menu), not by library consumers. The
// barrel exists so that boundary is explicit and enforceable rather than
// implied by whichever deep import a sibling happens to reach for.

export {
  isPathQuery,
  nodeFileSystem,
  searchFiles,
  splitMentionPath,
} from "./file-search.js";
export type {
  DirEntryLike,
  FileSystemLike,
  MentionPath,
  SearchOptions,
} from "./file-search.js";

export { fuzzyMatch, fuzzyRank } from "./fuzzy.js";
export type { FuzzyMatch } from "./fuzzy.js";
