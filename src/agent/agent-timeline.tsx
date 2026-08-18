import { Box, Static, Text } from "ink";
import { memo, useMemo, useRef } from "react";
import type { ReactElement } from "react";

import { AGENT_EVENT_KINDS, isAgentEventKind } from "./agent-event.js";
import type { AgentEvent, AgentToolEvent } from "./agent-event.js";
import { CHAT_ROLES, ChatMessage } from "../chat/chat-message.js";
import { HEADER_SENTINEL_KEY } from "../chat/chat-thread.js";
import { DiffViewer } from "../diff/diff-viewer.js";
import {
  STATUS_INDICATOR_WIDTH,
  TOOL_CALL_STATUSES,
  formatToolName,
} from "../tools/tool-call.js";
import { ToolCallCard } from "../tools/tool-call-card.js";
import { ToolResult } from "../tools/tool-result.js";
import { useTheoTheme } from "../theme/theme.js";
import { unionMessage } from "./union-message.js";
import type { LayoutMarginProps } from "../layout/layout-props.js";

const KIND_UNION_MESSAGE = unionMessage(AGENT_EVENT_KINDS);

export interface AgentTimelineProps extends LayoutMarginProps {
  /**
   * Ordered agent events. ORDERING CONTRACT (plan ADR D2): caller-ordered
   * array; unique ids (duplicates throw) — the tools grouped inside an
   * `explored` block share that SAME id namespace, and such a block must
   * carry at least one tool; graduated events are IMMUTABLE —
   * replace the TAIL event with a new object to stream (rows are memoized by
   * object identity). Always pass a NEW array on update (in-place mutation of
   * the same reference has pinned-but-unsupported hybrid behavior — EC-8).
   */
  events: AgentEvent[];
  /**
   * Events beyond `windowSize + windowOverscan` graduate into Ink `<Static>`
   * (terminal scrollback) and are FROZEN. Mount-time tuning knobs: INCREASING
   * them after events have graduated pulls scrollback rows back into the live
   * tail, visibly duplicating history (M1 window-growth hazard — same wording
   * as ChatThread; D2 occurrence #2 of the windowing knowledge, Rule-of-3
   * extraction deferred until a third windowed surface exists).
   */
  windowSize?: number;
  windowOverscan?: number;
  /**
   * Optional header folded as the FIRST item of the timeline's own
   * `<Static>` — pinned above graduated history (M11; same MOUNT-TIME
   * freeze contract as ChatThread.header: later changes to content,
   * identity and presence are ignored; the id
   * `"__theokit_tui_header__"` is reserved). Size the header explicitly —
   * Static's box is content-sized/absolute; percentage widths may collapse.
   */
  header?: ReactElement;
}

const HEADER_SENTINEL = Symbol("theokit-tui-header");
type TimelineStaticItem = typeof HEADER_SENTINEL | AgentEvent;

/**
 * Structural boundary check (plan ADR D8, EC-1/EC-2): kind membership, id
 * uniqueness, role/status membership, output⊕shell exclusivity and maxLines
 * validity — child-component guards would fire mid-render where Ink's error
 * boundary swallows throws (F10) and name the wrong component. Primitive
 * FIELD TYPES are TypeScript's job (not re-checked at runtime — SEPA F5
 * scope note). Extra/unknown properties are tolerated (EC-12).
 */
function validateMessageEvent(
  event: Extract<AgentEvent, { kind: "message" }>,
): void {
  if (!CHAT_ROLES.includes(event.role)) {
    throw new TypeError(
      `AgentTimeline: message event "${event.id}" — invalid role "${String(event.role)}" — expected ${unionMessage(CHAT_ROLES)}`,
    );
  }
}

function validateToolEvent(event: Extract<AgentEvent, { kind: "tool" }>): void {
  if (!TOOL_CALL_STATUSES.includes(event.status)) {
    throw new TypeError(
      `AgentTimeline: tool event "${event.id}" — invalid status "${String(event.status)}" — expected ${unionMessage(TOOL_CALL_STATUSES)}`,
    );
  }
  const bodyCount =
    (event.output !== undefined ? 1 : 0) +
    (event.shell !== undefined ? 1 : 0) +
    (event.diff !== undefined ? 1 : 0);
  if (bodyCount > 1) {
    throw new TypeError(
      `AgentTimeline: tool event "${event.id}" — provide only one of output | shell | diff`,
    );
  }
  // SEPA F1: ToolResult's own maxLines guard would fire mid-render
  // (swallowed, wrong component name) — mirror it at THIS boundary.
  if (
    event.maxLines !== undefined &&
    (!Number.isInteger(event.maxLines) || event.maxLines < 1)
  ) {
    throw new TypeError(
      `AgentTimeline: tool event "${event.id}" — maxLines must be an integer >= 1 — got ${String(event.maxLines)}`,
    );
  }
}

/**
 * Issue #58 — the `explored` block is a PUBLIC member of the union, so a consumer assembling events
 * by hand (without going through `messagesToAgentEvents`) reaches here. Without this descent, nested
 * entries fell outside EVERY check: duplicate ids showed up only as React's duplicate-`key` warning
 * mid-render — exactly where ink's error boundary swallows the throw and names the wrong component
 * (F10), which is why validation lives at this boundary.
 *
 * `seen` is the set SHARED with the top level: nested and top level share one namespace, and the
 * mutation also feeds M92's incremental cache (the ids of an already-frozen block stay reserved on
 * the following renders).
 */
function validateExploredEvent(
  event: Extract<AgentEvent, { kind: "explored" }>,
  seen: Set<string>,
): void {
  // The `Array.isArray` steps outside "field types are TypeScript's job" for the same reason as the
  // `maxLines` guard (SEPA F1): without it, a missing `tools` arriving from JS blows up with
  // "Cannot read properties of undefined" instead of the contract's message.
  if (!Array.isArray(event.tools) || event.tools.length === 0) {
    throw new TypeError(
      `AgentTimeline: explored event "${event.id}" — tools must be a non-empty array (at least one grouped tool)`,
    );
  }
  for (const tool of event.tools) {
    if (seen.has(tool.id)) {
      throw new TypeError(`AgentTimeline: duplicate event id "${tool.id}"`);
    }
    seen.add(tool.id);
    validateToolEvent(tool);
  }
}

/**
 * One top-level event: reserved key, known kind, unseen id, and the invariants of its own kind.
 *
 * Split from `assertValidEvents` so that function handles only the incremental cache's mechanics
 * (which slice to validate) and this one handles only an event's CONTRACT — the descent into
 * `explored` pushed the single function's cyclomatic complexity above the lint ceiling.
 */
function validateEvent(event: AgentEvent, seen: Set<string>): void {
  if (event.id === HEADER_SENTINEL_KEY) {
    throw new TypeError(
      `AgentTimeline: event id "${HEADER_SENTINEL_KEY}" collides with the reserved header sentinel key`,
    );
  }
  if (!isAgentEventKind(event.kind)) {
    throw new TypeError(
      `AgentTimeline: unknown event kind "${String(event.kind)}" — expected ${KIND_UNION_MESSAGE}`,
    );
  }
  if (seen.has(event.id)) {
    throw new TypeError(`AgentTimeline: duplicate event id "${event.id}"`);
  }
  seen.add(event.id);
  if (event.kind === "message") {
    validateMessageEvent(event);
  }
  if (event.kind === "tool") {
    validateToolEvent(event);
  }
  if (event.kind === "explored") {
    validateExploredEvent(event, seen);
  }
}

/**
 * M92 — validate only the TAIL when the new array is a prefix extension of the previous one.
 *
 * `assertValidEvents` swept the whole history on **every render** — including the lines already
 * frozen in `<Static>`, which by construction do not change. In a long session that is O(N) work per
 * token over data the structure itself guarantees immutable.
 *
 * "Prefix extension" = `next[i] === previous[i]` by identity for every `i < previous.length`. When it
 * is, the already-seen ids are reused and only the remainder is validated. When it is **not**
 * (reordering, edit, reset), it falls back to the full sweep — and the fallback is what guarantees no
 * case goes unvalidated. That is why this variant was preferred over hiding the check behind
 * `NODE_ENV !== 'production'`: that one disables validation exactly where the data is real.
 */
const lastValidation: { events: AgentEvent[]; ids: Set<string> } = {
  events: [],
  ids: new Set(),
};

/**
 * Exported for tests because the alternative was worse.
 *
 * `assertValidEvents` throws during render and ink does not propagate it to the caller — measured:
 * `renderFrame` of an invalid event **resolves**, it does not reject. Without this seam, the only
 * proof that the optimisation did not stop validating would be reading the code, which is exactly the
 * kind of evidence this codebase refuses.
 *
 * `resetIncrementalValidation` exists for the same reason: the state is module-level, and a test that
 * cannot zero it depends on the order of the others.
 */
export function resetIncrementalValidation(): void {
  lastValidation.events = [];
  lastValidation.ids = new Set();
}

export function assertValidEvents(events: AgentEvent[]): void {
  const previous = lastValidation.events;
  let start = 0;
  let seen: Set<string>;
  const isExtension =
    previous.length > 0 &&
    events.length >= previous.length &&
    previous.every((e, i) => events[i] === e);
  if (isExtension) {
    start = previous.length;
    seen = new Set(lastValidation.ids);
  } else {
    seen = new Set<string>();
  }
  for (const event of events.slice(start)) {
    validateEvent(event, seen);
  }
  // Record only AFTER validating everything: an array that threw must not become a trusted prefix,
  // or the next render would skip the check that just failed.
  lastValidation.events = events;
  lastValidation.ids = seen;
}

// Column note (SEPA F6, accepted heritage): message rows use ChatMessage's
// 2-cell "✦ " prefix while thinking/tool rows use the 3-cell indicator —
// same mixed-prefix shape as the gemini timeline; aligning would change the
// M0/M1 public render. Revisit with the M6 theme system.
function ThinkingRow({ text }: { text: string }) {
  const theme = useTheoTheme();
  return (
    <Box>
      <Box minWidth={STATUS_INDICATOR_WIDTH}>
        {/* U+2022 (EAW-Narrow), distinct from the system role's "·" — under
            NO_COLOR the glyph is the ONLY thinking marker (dom-frontend-2;
            codex ReasoningSummaryCell precedent). */}
        <Text color={theme.role.system.prefix}>•</Text>
      </Box>
      <Text dimColor italic>
        {text}
      </Text>
    </Box>
  );
}

// SEPA F2: pass `output` as ToolResult CHILDREN (not pre-split lines) so
// it inherits M2's normalization — CRLF strip (EC-6), trailing-blank pop
// (EC-7). Empty output collapses to the bare row (`null` and `false` are
// equally non-renderable to ToolCallCard's hasRenderableBody).
/**
 * Line budget the inline diff falls back to when the event carries no
 * `maxLines` (issue #57).
 *
 * `DiffViewer` has no default of its own — it only VALIDATES the prop — so an
 * uncapped branch renders every row of a big `apply_patch` result, while the
 * SAME payload sent as `output` stops at ToolResult's 10. Higher than 10
 * because this budget is global and counts the per-file header/stat rows.
 */
const DEFAULT_DIFF_MAX_LINES = 20;

function toolBody(event: Extract<AgentEvent, { kind: "tool" }>) {
  const maxLines =
    event.maxLines !== undefined ? { maxLines: event.maxLines } : {};
  // A unified-diff result (e.g. apply_patch) renders as a Claude-Code-style
  // inline diff (row backgrounds + prose stats + syntax highlight — the card
  // header already names the tool/file); everything else goes through
  // ToolResult (output / shell modes).
  if (event.diff !== undefined && event.diff !== "") {
    return (
      <DiffViewer
        patch={event.diff}
        background
        maxLines={event.maxLines ?? DEFAULT_DIFF_MAX_LINES}
      />
    );
  }
  const hasBody =
    (event.output !== undefined && event.output !== "") ||
    event.shell !== undefined;
  if (!hasBody) return null;
  return (
    <ToolResult
      {...(event.output !== undefined ? { children: event.output } : {})}
      {...(event.shell !== undefined ? { shell: event.shell } : {})}
      {...maxLines}
    />
  );
}

function ToolRow(event: Extract<AgentEvent, { kind: "tool" }>) {
  return (
    <ToolCallCard
      name={event.name}
      status={event.status}
      {...(event.summary !== undefined ? { summary: event.summary } : {})}
    >
      {toolBody(event)}
    </ToolCallCard>
  );
}

interface ExploreArgs {
  path: string | undefined;
  pattern: string | undefined;
}

const searchLabel = ({ pattern }: ExploreArgs): string =>
  pattern !== undefined ? `Search "${pattern}"` : "Search";

/** Per-tool label formatters for the Explored block (extracted from a switch
 * to keep exploreSummary within the complexity gate). */
const EXPLORE_LABELS: Record<string, (args: ExploreArgs) => string> = {
  read_file: ({ path }) => (path !== undefined ? `Read ${path}` : "Read"),
  list_dir: ({ path }) => `List ${path ?? "."}`,
  grep: searchLabel,
  search_text: searchLabel,
  git_diff: () => "Diff",
  glob: ({ pattern }) => (pattern !== undefined ? `Glob ${pattern}` : "Glob"),
};

/** A Codex-style verb+target label for one explored tool ("Read config.mjs",
 * "List agents/tools", 'Search "pattern"'), derived from its input. */
function exploreSummary(tool: AgentToolEvent): string {
  const input = (tool.input ?? {}) as Record<string, unknown>;
  const str = (key: string): string | undefined =>
    typeof input[key] === "string" ? (input[key] as string) : undefined;
  const args: ExploreArgs = {
    path: str("path") ?? str("file") ?? str("dir"),
    pattern: str("pattern") ?? str("query") ?? str("regex"),
  };
  const label = EXPLORE_LABELS[tool.name];
  if (label !== undefined) return label(args);
  // PascalCase display standard for the raw-name fallback (same rule as the
  // ToolCall header — an unmapped explore tool never shows snake_case).
  return args.path ?? args.pattern ?? formatToolName(tool.name);
}

/** A run of read-only exploration collapsed into one "Explored" block (Codex
 * parity): a header + one dim verb+target line per tool, outputs summarized
 * away so exploration does not dominate the transcript. */
function ExploredBlock({ tools }: { tools: readonly AgentToolEvent[] }) {
  const theme = useTheoTheme();
  const token = theme.toolStatus.success;
  return (
    <Box flexDirection="column">
      <Box>
        <Text color={token.color}>
          {token.glyph.padEnd(STATUS_INDICATOR_WIDTH)}
        </Text>
        <Text bold>Explored</Text>
        <Text dimColor>{` (${tools.length})`}</Text>
      </Box>
      {/* Gutter and body in separate columns (DiffViewer's `lineRow` pattern):
          with prefix and summary in the SAME <Text>, a long target wrapped at
          column 0 and the continuation lined up with the block's `⏺` instead of
          the branch (#59 item 5). `flexShrink={0}` keeps the gutter whole under
          pressure. */}
      {tools.map((tool) => (
        <Box key={tool.id}>
          <Box flexShrink={0}>
            <Text dimColor>{"  └ "}</Text>
          </Box>
          <Text dimColor wrap="wrap">
            {exploreSummary(tool)}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

function eventRow(event: AgentEvent) {
  switch (event.kind) {
    case "explored":
      return <ExploredBlock tools={event.tools} />;
    case "message":
      // Claude Code parity: an assistant turn is Markdown (headings, lists, fenced code → CodeBlock with
      // syntax highlight), so render it through MarkdownText. The user echo stays raw (dim) — a user's typed
      // input is not Markdown source; rendering it as such would mangle a literal `#` or `*`.
      return (
        <ChatMessage role={event.role} markdown={event.role === "assistant"}>
          {event.text}
        </ChatMessage>
      );
    case "thinking":
      return <ThinkingRow text={event.text} />;
    case "tool":
      return <ToolRow {...event} />;
    default: {
      // Unreachable through the public API — assertValidEvents screens kinds
      // at the boundary (D8); kept for compile-time exhaustiveness (D3).
      /* v8 ignore next 6 */
      const exhaustive: never = event;
      throw new TypeError(
        `AgentTimeline: unknown event kind "${String((exhaustive as AgentEvent).kind)}" — expected ${KIND_UNION_MESSAGE}`,
      );
    }
  }
}

const Row = memo(
  ({ event, spaced }: { event: AgentEvent; spaced: boolean }) => (
    // Claude Code cadence: one blank line above every block EXCEPT the first
    // rendered one — the transcript breathes (mirrors ChatThread's spacing).
    <Box marginTop={spaced ? 1 : 0} flexDirection="column">
      {eventRow(event)}
    </Box>
  ),
  (prev, next) => prev.event === next.event && prev.spaced === next.spaced,
);
Row.displayName = "AgentTimeline.Row";

/**
 * Ordered agent-turn timeline mixing messages, thinking and tool events
 * (plan ADR D2 — sibling of ChatThread: windowed `<Static>` history +
 * identity-memoized rows + its own kind dispatch).
 *
 * ONE TIMELINE (or ChatThread) PER SCREEN once history graduates: two
 * mounted `<Static>` consumers cannot interleave their frozen output — rows
 * print partitioned by component, not by time (D2 rationale; wire-3).
 * Composing both is safe only while neither exceeds its window.
 */
export function AgentTimeline({
  events,
  windowSize = 8,
  windowOverscan = 4,
  header,
  ...margin
}: AgentTimelineProps) {
  // Boundary validation FIRST, before any hook (F10 — tests invoke this as a
  // plain function; Ink swallows render-time throws).
  assertValidEvents(events);
  // MOUNT-FREEZE (M11 D1 — mirrors ChatThread): constant length
  // contribution; ink Static advances its index by LENGTH only.
  const frozenHeader = useRef(header).current;
  const tailStart = Math.max(
    0,
    events.length - Math.max(0, windowSize) - Math.max(0, windowOverscan),
  );
  const prefix = useMemo(() => events.slice(0, tailStart), [events, tailStart]);
  const items = useMemo<TimelineStaticItem[]>(
    () => (frozenHeader === undefined ? prefix : [HEADER_SENTINEL, ...prefix]),
    [frozenHeader, prefix],
  );
  const tail = events.slice(tailStart);

  return (
    <>
      {items.length > 0 && (
        <Static items={items}>
          {(item, index) =>
            item === HEADER_SENTINEL ? (
              <Box key={HEADER_SENTINEL_KEY} flexDirection="column">
                {frozenHeader}
              </Box>
            ) : (
              // Space every block except the first rendered element (index 0).
              <Row key={item.id} event={item} spaced={index > 0} />
            )
          }
        </Static>
      )}
      {/* Margin lands on the LIVE region. The `<Static>` history is append-only
          terminal scrollback and is not margined (a graduated row's position is
          frozen); the consumer margin spaces the timeline's on-screen tail. */}
      <Box flexDirection="column" {...margin}>
        {tail.map((event, index) => (
          // First tail block is the timeline's first ONLY when nothing graduated
          // into Static above it (items empty).
          <Row
            key={event.id}
            event={event}
            spaced={items.length > 0 || index > 0}
          />
        ))}
      </Box>
    </>
  );
}
