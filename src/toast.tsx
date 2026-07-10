import { Box, Text } from "ink";
import { useEffect, useRef } from "react";

import { useTheoTheme, isMonochrome } from "./theme.js";
import type { TheoTheme } from "./theme.js";

// M24 Toast (plan m24-live-progress-surfaces T4.1, ADR D4, RISK-1): a transient
// message on a BOUNDED one-shot timer — the M12 driver idiom (self-clearing at
// fire, torn down on unmount). `onDismiss` is read through a ref so an inline
// callback does NOT reset the countdown each render; only a `durationMs` change
// re-schedules (clearing the prior timer). The app owns queueing/stacking — the
// lib ships a single self-dismissing toast (callback-only, the M15/M23 rule).

/** Visual severity of a toast. `success`/`error` color the border and prefix a
 * `●` status bullet; `info` (default) keeps the accent border, no bullet. */
export type ToastVariant = "info" | "success" | "error";

export interface ToastProps {
  message: string;
  /** Auto-dismiss delay in ms (default 5000 — the opencode default). */
  durationMs?: number;
  /** Called when the timer fires (the app removes the toast). */
  onDismiss: () => void;
  /** Severity variant (default `info`). */
  variant?: ToastVariant;
}

/** The border + bullet color for a variant (accent for info; status tokens else). */
function variantColor(variant: ToastVariant, theme: TheoTheme): string {
  if (variant === "success") return theme.status.success;
  if (variant === "error") return theme.status.error;
  return theme.accent;
}

export function Toast({
  message,
  durationMs = 5000,
  onDismiss,
  variant = "info",
}: ToastProps) {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const theme = useTheoTheme();

  useEffect(() => {
    const id = setTimeout(() => onDismissRef.current(), durationMs);
    return () => clearTimeout(id);
  }, [durationMs]);

  const mono = isMonochrome(theme);
  const color = variantColor(variant, theme);
  return (
    <Box
      borderStyle={mono ? "single" : "round"}
      paddingX={1}
      {...(mono ? {} : { borderColor: color })}
    >
      {variant !== "info" && <Text {...(mono ? {} : { color })}>{"● "}</Text>}
      <Text>{message}</Text>
    </Box>
  );
}
