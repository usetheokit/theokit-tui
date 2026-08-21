/**
 * Lint test — the codebase is English-only. Bans Portuguese in source and
 * tests: identifiers, comments, JSDoc and string literals alike.
 *
 * Why this is a gate and not a style preference:
 *
 * - JSDoc on an exported symbol is emitted into the published `.d.ts`, so a
 *   Portuguese comment ships to every consumer and shows up on editor hover.
 *   `CLAUDE.md` makes the exported types the canonical public contract; a
 *   contract nobody outside this repo can read is not a contract.
 * - A Portuguese identifier in the public surface is worse still — one shipped
 *   in `@theokit/sdk/compaction` for several releases before this gate existed,
 *   and renaming it was a breaking change. The cost compounds with every
 *   release that carries it.
 * - Test names are executable documentation (`.claude/rules/testing.md` § 3).
 *
 * Detection is two-tier so precision is auditable:
 *
 * - Tier 1 (near-deterministic): Latin letters carrying diacritics that
 *   Portuguese uses and English does not. Loanwords English genuinely borrows
 *   are in `WORD_ALLOWLIST`.
 * - Tier 2 (lexical): unaccented Portuguese words with no English homograph.
 *   Deliberately conservative — short words and cross-language homographs
 *   (`com`, `para`, `mais`, `de`, `os`, `em`, `no`) are NOT listed, because a
 *   false BLOCK on a lint gate is worse than a miss. A Portuguese comment
 *   written entirely without accents can slip past tier 1; tier 2 narrows that
 *   gap without closing it. Stated honestly rather than claimed complete.
 *
 *   `logo` was removed from the lexicon after it flagged `logo.png`: it is a
 *   common English noun as well as Portuguese, and a lexicon entry that fires
 *   on ordinary English is a gate that teaches people to ignore it.
 *
 * @internal
 */

import type { Dirent } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..");

/**
 * Scanned roots, relative to the repository root. `"."` means the whole repository.
 *
 * It scans the whole tree rather than an explicit list because the first version listed
 * `sdk/{src,tests}` and `sdk-tools/{src,tests}` — and silently missed `sdk-pty` and `sdk-budget`,
 * which carried 60 Portuguese lines nobody was watching. A gate whose coverage is a hand-kept list
 * decays the moment a package is added.
 *
 * The root moved out of `packages/` for the same reason, one level up: scoped to packages, the gate
 * could not see `docs/`, `tools/`, `scripts/`, `examples/` or the root `README.md` / `CHANGELOG.md`,
 * so nothing stopped a Portuguese document from landing there. It found exactly that — a 2156-line
 * course under `docs/course/`, invisible for as long as the scope was narrower than the repository.
 */
const SCAN_ROOTS = ["."];

/**
 * Loanwords English legitimately borrows with their diacritics. `façade` is a
 * locked term in `CLAUDE.md` ("Agent façade"), so it is not a violation.
 */
const WORD_ALLOWLIST = new Set(["façade", "façades", "naïve", "café", "résumé"]);

/** Files exempt from the scan, relative to the repository root. */
/** B-065 — every CHANGELOG, root or per package. Released entries are immutable (Rule 6). */
const isChangelog = (rel: string): boolean =>
  rel === "CHANGELOG.md" || rel.endsWith("/CHANGELOG.md");

const FILE_ALLOWLIST = new Set<string>([
  // This file names Portuguese words in order to ban them.
  "tests/lint/no-ptbr.test.ts",
  // B-027 — same reason, one file over: its fixtures QUOTE Portuguese in order to prove the
  // [Unreleased] gate reports it. One of them is real text from the shipped 0.60.0 entry, so
  // translating it would break the Rule-6 case it exists to pin.
  "tests/lint/changelog-unreleased-english.test.ts",
  // B-065 — the repository CHANGELOG. Entries for a RELEASED version are immutable (Unbreakable
  // Rule 6): translating one would rewrite a record of what shipped, which is the discipline this
  // gate exists to serve rather than to override. This sweep cannot tell a released entry from a
  // fresh one, so the whole file is exempt HERE.
  //
  // B-027 — the other half of the rule is enforced by `tests/lint/changelog-unreleased-english.test.ts`,
  // which reads ONLY the `[Unreleased]` section. It used to be enforced by this comment, and this
  // comment let seven consecutive releases ship in Portuguese (0.54.0 through 0.60.0) written by an
  // author who had read it. A convention stated inside the exemption that disables its enforcement
  // is a note, not a rule.
  "CHANGELOG.md",
  // B-065 — one comment QUOTES the Portuguese word it replaced, to explain why the fixture reads as
  // it does. Translating the quotation would delete the explanation and leave a comment that says
  // a rename happened without saying what from. Linting a citation is linting the wrong thing.
  "tests/agent-events-validation.test.ts",
  // A recall probe whose assertion is what a model ANSWERS. It matches both spellings of a Brazilian
  // city because a model replying in Portuguese uses the accented one; dropping that alternative to
  // satisfy this gate would narrow what the probe accepts and weaken the audit it exists to run.
  // Same category as the skipped session transcripts: linting the user's own words, not our prose.
  // The `docs/course/theokit-agent-ai-course.md` exemption was removed on 2026-08-06, on the
  // condition its own comment set: "delete this entry the day the course becomes English". The
  // course was decomposed into the `wiki/` bundle in English, so the gate now covers every word
  // that replaced it and there is no exempt prose left in the repository.
]);

/**
 * Portuguese words with no English homograph. Every entry earns its place by
 * being unambiguous — see the honesty note in the file header for what is
 * deliberately excluded.
 */
const PT_LEXICON = new Set([
  "nao",
  "sao",
  "estao",
  "entao",
  "tambem",
  "porque",
  "porem",
  "apenas",
  "somente",
  "sempre",
  "agora",
  "aqui",
  "ainda",
  "quando",
  "onde",
  "quem",
  "isso",
  "isto",
  "esse",
  "essa",
  "aquele",
  "aquilo",
  "muito",
  "deve",
  "pode",
  "fazer",
  "usar",
  "precisa",
  "garante",
  "devolve",
  "retorna",
  "chama",
  "cria",
  "criar",
  "grava",
  "gravar",
  "escreve",
  "arquivo",
  "arquivos",
  "erro",
  "erros",
  "falha",
  "falhas",
  "dono",
  "chave",
  "caminho",
  "linha",
  "mesmo",
  "outro",
  "depois",
  "antes",
  "sobre",
  "durante",
  "atraves",
  "pelo",
  "pela",
  "pelos",
  "pelas",
  "nesse",
  "neste",
  "nessa",
  "desta",
  "deste",
  "disso",
  "seu",
  "sua",
  "seus",
  "suas",
  "nosso",
  "nossa",
  "voce",
  "eles",
  "elas",
  "cada",
  "usuario",
  "funcao",
  "nivel",
  "versao",
  "razao",
  "opcao",
  "acao",
  "persistencia",
  "obsolescencia",
  "robustez",
  "correcao",
  "correcoes",
  "possivel",
  "adquirir",
  "soltar",
  "propria",
  "proprio",
  "apos",
  "conteudo",
  "leitura",
  "escrita",
  "sessao",
  "sessoes",
  "janela",
  "motivo",
  "reclamavel",
  "tentativa",
  "teto",
  "montar",
  "parsear",
  "descartar",
  "compartilhado",
  "declarada",
  "efetiva",
  "quebra",
  "pendente",
  "pendencia",
  "resposta",
  "pergunta",
  "saida",
  "entrada",
  "tamanho",
  "vazio",
  "aviso",
  "checar",
  "validar",
  "limpar",
  "buscar",
  "juntar",
  "separar",
  "calcular",
  "aplicar",
  "anterior",
  "proximo",
  "primeiro",
  "ultimo",
  "senao",
  "assim",
  "ambos",
  "ambas",
  "ainda",
  "pois",
  "atual",
  "atualmente",
  "bruto",
  "vistos",
  "espera",
  "trecho",
]);

/**
 * Latin letters carrying diacritics that Portuguese uses. Excludes the
 * mathematical `×` (U+00D7) and `÷` (U+00F7), which fall inside the naive
 * Latin-1 range and would otherwise produce false positives.
 */
const DIACRITIC = /[À-ÖØ-öø-ÿ]/;

const WORD = /[A-Za-zÀ-ÿ]+/g;

/**
 * Identifiers that are not prose and must not be tokenized as words.
 *
 * IANA timezone ids are the live case: `America/Sao_Paulo` is a standardized key, and splitting it
 * yields `Sao`, which the lexicon reads as an unaccented `são`. Mutilating the lexicon to hide that
 * would blind the gate to the real word, so the noise is removed from the line instead.
 */
const NOT_PROSE =
  /\b(?:Africa|America|Antarctica|Asia|Atlantic|Australia|Europe|Indian|Pacific)\/[A-Za-z_]+/g;

/**
 * Inline code spans — a symbol NAME is not prose in the language its letters happen to spell.
 *
 * The live case is the CHANGELOG announcing the renames this gate motivated: you cannot write
 * "`sessaoTemEscritor` is now `sessionHasWriter`" without naming the symbol being retired. Flagging
 * that would make the gate forbid documenting its own outcome, and the workaround people would reach
 * for — describing the rename without naming it — produces a changelog nobody can act on.
 *
 * Same trade already accepted for {@link NOT_PROSE}: strip the non-prose token from the line rather
 * than weaken the lexicon, so the gate stays sharp on the surrounding sentence. The cost is stated:
 * Portuguese written inside backticks is invisible here. That is the correct call for identifiers
 * and the wrong one for a Portuguese sentence someone chose to wrap in code formatting — a gap this
 * accepts knowingly rather than trading for false positives on every rename note.
 */
const INLINE_CODE = /`[^`\n]*`/g;

/**
 * B-027 — exported so `changelog-unreleased-english.test.ts` can report the same shape. The
 * CHANGELOG gate reuses this classifier rather than growing a second Portuguese lexicon that would
 * drift from this one.
 */
export interface Offender {
  file: string;
  line: number;
  tier: "diacritic" | "lexicon";
  words: string[];
  text: string;
}

/**
 * Extensions the gate reads. `.md` and `.mjs` are in scope because `package.json` `files[]`
 * publishes README, docs and the claude-template to npm — Portuguese there reaches consumers
 * exactly like Portuguese in a `.d.ts` does. Scanning only `.ts` left them unwatched.
 */
const SCANNED_EXT = /\.(?:ts|mts|cts|js|mjs|cjs|md)$/;

/**
 * Directories that hold build output, dependencies or local runtime state — never source we own.
 *
 * Dot-directories are skipped wholesale: inside a package they are tool or runtime state
 * (`.theokit/memory/sessions/` holds real conversation transcripts, which are Portuguese because
 * the user writes Portuguese). Linting a session transcript would be linting the user.
 */
const SKIP_DIRS = new Set(["node_modules", "dist", "coverage", "docs-json"]);

const isSkippedDir = (name: string): boolean => name.startsWith(".") || SKIP_DIRS.has(name);

/**
 * `withFileTypes` matters here, not as a micro-optimization: the first version called `stat` once
 * per entry while walking the whole monorepo, and the test blew a 20 s timeout. A gate slow enough
 * to time out is a gate someone disables.
 */
async function walk(dir: string, out: string[] = []): Promise<string[]> {
  // `Dirent[]` and NOT `Awaited<ReturnType<typeof readdir>>`: `readdir` is overloaded, and the type
  // query collapses to ONE overload — the buffer one — so the annotation contradicted the call every
  // time. `Dirent` defaults its name type to `string`, which is what a string path actually yields.
  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    // A scan root that does not exist is not a violation — packages come and go.
    return out;
  }
  // A directory carrying its own `.git` is ANOTHER REPOSITORY, and its prose is not this gate's
  // jurisdiction. `modelo/TheoCode` is the live case: a sibling product of ours, checked out here
  // to be read and co-evolved, whose own `BACKLOG.md` and `tools/check-english-only.mjs` are
  // written in Portuguese by its own policy. Sweeping it reported 5 offenders this repository
  // cannot fix and must not rewrite — editing another repo's history to satisfy our linter.
  //
  // Structural on purpose, NOT a name in `SKIP_DIRS`. This file already argues that a gate whose
  // coverage is a hand-kept list decays the moment someone adds a package; the inverse decays the
  // same way — a hand-kept EXCLUSION list goes stale the moment a second checkout appears under a
  // different name. "Contains .git" cannot go stale, and it costs nothing: the `Dirent[]` is
  // already in hand, so this adds no syscall.
  //
  // The repository root is exempt from its own rule, or the gate would scan nothing at all.
  if (dir !== REPO_ROOT && entries.some((e) => e.name === ".git")) return out;
  const subdirs: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!isSkippedDir(entry.name)) subdirs.push(full);
    } else if (SCANNED_EXT.test(full) && !full.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  await Promise.all(subdirs.map((d) => walk(d, out)));
  return out;
}

/** Split an identifier into its camelCase / PascalCase / snake_case parts. */
function identifierParts(word: string): string[] {
  return word.split(/[_$]/).flatMap((p) => p.match(/[A-Z]?[a-z]+|[A-Z]+(?![a-z])/g) ?? []);
}

function stripDiacritics(word: string): string {
  return word.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Every word-part of a line, with allowlisted loanwords already dropped. */
function candidateParts(line: string): string[] {
  return (line.replace(INLINE_CODE, " ").replace(NOT_PROSE, " ").match(WORD) ?? [])
    .filter((token) => !WORD_ALLOWLIST.has(token.toLowerCase()))
    .flatMap(identifierParts)
    .filter((part) => !WORD_ALLOWLIST.has(part.toLowerCase()));
}

/** Tier 1 wins over tier 2 so each line reports its strongest signal once. */
function classifyLine(line: string): Pick<Offender, "tier" | "words"> | undefined {
  const parts = candidateParts(line);

  const diacritic = parts.filter((p) => DIACRITIC.test(p));
  if (diacritic.length > 0) return { tier: "diacritic", words: [...new Set(diacritic)] };

  const lexical = parts.filter((p) => !DIACRITIC.test(p) && PT_LEXICON.has(stripDiacritics(p)));
  if (lexical.length > 0) return { tier: "lexicon", words: [...new Set(lexical)] };

  return undefined;
}

export function scanText(rel: string, text: string): Offender[] {
  const offenders: Offender[] = [];

  text.split("\n").forEach((line, index) => {
    const hit = classifyLine(line);
    if (hit === undefined) return;
    offenders.push({
      file: rel,
      line: index + 1,
      ...hit,
      text: line.trim().slice(0, 120),
    });
  });

  return offenders;
}

/** Filenames themselves must be English — a test file name is documentation. */
function scanFilename(rel: string): Offender | undefined {
  const base = rel.split(sep).pop() ?? rel;
  const hits = identifierParts(base.replace(/\.[^.]+$/, "").replace(/[.-]/g, "_")).filter(
    (p) => PT_LEXICON.has(stripDiacritics(p)) || DIACRITIC.test(p),
  );
  if (hits.length === 0) return undefined;
  return {
    file: rel,
    line: 0,
    tier: "lexicon",
    words: [...new Set(hits)],
    text: base,
  };
}

async function scanFile(file: string): Promise<Offender[]> {
  const rel = relative(REPO_ROOT, file).split(sep).join("/");
  if (FILE_ALLOWLIST.has(rel) || isChangelog(rel)) return [];

  const named = scanFilename(rel);
  const inside = scanText(rel, await readFile(file, "utf8"));
  return named === undefined ? inside : [named, ...inside];
}

async function collectOffenders(): Promise<Offender[]> {
  const files: string[] = [];
  for (const root of SCAN_ROOTS) files.push(...(await walk(join(REPO_ROOT, root))));
  const perFile = await Promise.all(files.map(scanFile));
  return perFile.flat();
}

/**
 * A filesystem sweep of every workspace package, not a unit test — the default 20 s budget is sized
 * for the latter and this blew it twice while the scope widened. Stating the real cost is honest;
 * silently shrinking the scan to fit a unit-test budget would trade coverage for a green clock.
 */
const SWEEP_TIMEOUT_MS = 120_000;

describe("codebase is English-only (no PT-BR)", () => {
  it(
    "packages source and tests carry no Portuguese",
    async () => {
      expect(await collectOffenders()).toEqual([]);
    },
    SWEEP_TIMEOUT_MS,
  );
});

describe("the sweep stops at another repository's edge", () => {
  /**
   * Pins the nested-checkout guard in `walk`, which is otherwise untestable BY OBSERVATION: the
   * repository-wide assertion above is green whether or not the guard exists, as long as nobody
   * has a foreign checkout on disk. Deleting `modelo/` would make the real regression invisible
   * and the guard would be removed as dead code the next time someone tidied.
   *
   * The fixture is built in the OS temp directory rather than under the repository, because a
   * fixture inside `src/` or `tests/` would be swept by the very gate it is describing.
   */
  it("does_not_descend_into_a_directory_that_carries_its_own_git", async () => {
    const root = await mkdtemp(join(tmpdir(), "no-ptbr-nested-"));
    try {
      const foreign = join(root, "vendored-product");
      await mkdir(foreign, { recursive: true });
      // A `.git` FILE, not a directory — that is what a worktree or a submodule leaves behind, and
      // the guard reads the entry name so both shapes must count.
      await writeFile(join(foreign, ".git"), "gitdir: ../elsewhere\n", "utf8");
      await writeFile(
        join(foreign, "leia-me.md"),
        "Este arquivo nao esta em ingles, porem pertence a outro repositorio.\n",
        "utf8",
      );
      // A sibling that is NOT a checkout, proving the guard excludes the checkout and nothing else.
      const ours = join(root, "ours");
      await mkdir(ours, { recursive: true });
      await writeFile(join(ours, "readme.md"), "This one is ours.\n", "utf8");

      const walked = (await walk(root)).map((f) => relative(root, f));

      expect(
        walked,
        "a directory carrying .git is another repository — sweeping it reports offenders this repo cannot fix and must not rewrite",
      ).toEqual([join("ours", "readme.md")]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
