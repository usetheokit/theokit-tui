import { useEffect, useState } from "react";

// The Claude Code working glyph — a cycling sparkle (not a braille spinner).
// Frames advance on a fast cadence while motion is enabled; under reduced-motion
// / non-TTY / monochrome the first frame renders static. Shared by AgentStreaming
// (the indeterminate stream) and ProgressActivity (the determinate task).

export const SPARKLE_FRAMES = ["✳", "✷", "✶", "✵"] as const;
const SPARKLE_INTERVAL_MS = 120;

/** Cycle the sparkle while `active`; the static first frame otherwise. */
export function useSparkle(active: boolean): string {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(
      () => setIndex((current) => (current + 1) % SPARKLE_FRAMES.length),
      SPARKLE_INTERVAL_MS,
    );
    return () => clearInterval(id);
  }, [active]);
  return SPARKLE_FRAMES[active ? index : 0]!;
}
