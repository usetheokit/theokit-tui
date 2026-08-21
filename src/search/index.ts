// Internal barrel for the search domain (ADR 0001 / ADR 0002).
//
// Nothing here is re-exported from src/index.ts — measured, all 8 names appear 0x in
// dist/index.d.ts — so none of this reaches library consumers.
//
// B-066 corrected the rest of this header, which was wrong in a way that taught the wrong thing
// about this codebase. The two real consumers are:
//
//   searchFiles  <- src/chat/chat-composer.tsx:5          (the @-mention menu)
//   fuzzyMatch   <- src/prompts/select-list-model.ts:9    (a DIFFERENT and PUBLIC domain)
//
// and both reach past this barrel with a deep import. So the boundary it declares is CONVENTIONAL,
// not enforceable: nothing in .dependency-cruiser.cjs or tests/lint/structure.test.ts requires a
// sibling to come through here, and measured across the whole tree, no sibling domain imports
// another domain's barrel at all. Deep imports are the house pattern.
//
// The barrel is kept because ADR 0002 makes it the mechanism of privacy — a folder is private BY
// not being re-exported from the root — so zero importers is the expected state here, not a defect.
// knip is told that by the src/**/index.ts entry rule rather than by a list of file names.

export type {
  DirEntryLike,
  FileSystemLike,
  MentionPath,
  SearchOptions,
} from "./file-search.js";
export {
  isPathQuery,
  nodeFileSystem,
  searchFiles,
  splitMentionPath,
} from "./file-search.js";
export type { FuzzyMatch } from "./fuzzy.js";
export { fuzzyMatch, fuzzyRank } from "./fuzzy.js";
