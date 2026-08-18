import { Box } from "ink";
import type { ReactNode } from "react";

import type { LayoutMarginProps } from "./layout-props.js";
import { pickMargin } from "./layout-props.js";

// Stack — the vertical-rhythm primitive. Spacing between transcript blocks is a
// CONTAINER concern, not a per-component one: a component that carried its own
// default top margin would double up inside a container that already spaces
// (ChatThread / AgentTimeline) and break the no-op margin invariant. Instead,
// wrap a column of blocks (banner, notices, timeline, the working indicator, the
// footer) in one <Stack> and every child is separated by the same `gap` —
// regardless of type. Ergonomic name over Ink's `<Box flexDirection="column"
// gap>` (the SwiftUI VStack(spacing:) / Braid <Stack> idiom); `gap` is only
// applied BETWEEN children, never as leading/trailing padding.

export interface StackProps extends LayoutMarginProps {
  /** Blank rows between adjacent children. Default 1 (the Claude Code cadence). */
  gap?: number;
  children?: ReactNode;
}

export function Stack({ gap = 1, children, ...margin }: StackProps) {
  return (
    <Box flexDirection="column" gap={gap} {...pickMargin(margin)}>
      {children}
    </Box>
  );
}
