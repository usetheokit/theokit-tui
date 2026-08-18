// Public barrel for the layout domain (ADR 0001 / ADR 0002).
// src/index.ts re-exports this file; anything NOT listed here is
// module-internal by construction rather than by comment.

// Universal layout margin API — every public component's props extend
// LayoutMarginProps, so any component accepts margin/marginX/marginY and the
// four sides and applies them to its root layout.
export { LAYOUT_MARGIN_KEYS, omitMargin, pickMargin } from "./layout-props.js";

export type { LayoutMarginProps } from "./layout-props.js";

// Vertical-rhythm primitive: spacing between blocks is a CONTAINER concern —
// wrap a column of surfaces in <Stack gap={1}> instead of putting default
// margins on every component (which would double up inside ChatThread /
// AgentTimeline). The SwiftUI VStack(spacing:) / Braid <Stack> idiom.
export { Stack } from "./stack.js";

export type { StackProps } from "./stack.js";

export { Pager } from "./pager.js";

export type { PagerProps } from "./pager.js";

export {
  pagerReducer,
  scrollPercent,
  visibleRange,
  maxOffset,
} from "./pager-model.js";

export type { PagerState, PagerAction } from "./pager-model.js";

export { CollapsibleBlock } from "./collapsible-block.js";
export { ThinkingBlock } from "./thinking-block.js";

export type { CollapsibleBlockProps } from "./collapsible-block.js";
export type { ThinkingBlockProps } from "./thinking-block.js";
