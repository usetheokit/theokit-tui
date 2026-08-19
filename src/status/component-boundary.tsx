import { Text } from "ink";
import { Component, type ErrorInfo, type ReactNode } from "react";

import { recordGuardFailure } from "./guard-sink.js";

/**
 * Contains a component failure so it takes its own subtree and nothing else.
 *
 * **What it fixes, measured against `ink@7.1.0` + `react@19.2.7` with a real `render()`.** A
 * component that throws from a prop guard — which 21 components in this package do — takes the
 * WHOLE application down, prints ink's `ERROR` panel to the end user with an absolute source path
 * and a source excerpt, and leaves the process exiting **0**. A CLI that died reports success to
 * its shell, so any script, CI job or supervisor treats the crash as a clean run.
 *
 * Wrapped, the same failure renders one dim line, the siblings survive, and the process exits
 * non-zero:
 *
 * ```tsx
 * <ComponentBoundary component="SelectList">
 *   <SelectList items={items} window={window} onSubmit={onSubmit} />
 * </ComponentBoundary>
 * ```
 *
 * **It does not hide the failure.** The throw is still recorded by `reportGuardFailure` BEFORE this
 * ever sees it — that is a different mechanism, and this writes no second record. What changes is
 * that the user keeps their session and the shell learns the truth.
 *
 * **It is opt-in, deliberately.** This package does not wrap its own components: a boundary renders
 * a FALLBACK, so wrapping automatically would change what 21 public components render on failure,
 * and whether to keep going after a failure is a policy the consumer owns — an agent CLI
 * mid-conversation may prefer to lose one panel where a one-shot script prefers to die.
 */
export class ComponentBoundary extends Component<
  {
    /** Named in the fallback and in the exit-code rationale. Use the component's own name. */
    readonly component: string;
    readonly children: ReactNode;
    /** Replaces the default one-line fallback. Must not render a stack — the user is not a developer. */
    readonly fallback?: ReactNode;
    /**
     * Called with the caught error. The boundary ALREADY writes a durable record; this is for
     * consumers who route errors somewhere of their own. It does not suppress the record.
     */
    readonly onError?: (error: Error, info: ErrorInfo) => void;
  },
  { readonly failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // REVIEW FIX (F-arch-2). This took NO parameters, so the error was discarded: a failure from a
    // consumer's own subtree produced a fallback line, a non-zero exit code, and nothing anywhere
    // saying what happened. Measured — `"consumer bug: cannot read 'name' of undefined"` appeared in
    // no frame, no log and no stream. That is the swallow `.claude/rules/error-handling.md` § 5
    // forbids, introduced by the component meant to make failures visible.
    //
    // A contained GUARD failure now leaves two records — one when it fired, one when it was
    // contained. Different facts, not duplication (§ 3.1, "never deduplicate").
    recordGuardFailure(this.props.component, error);
    this.props.onError?.(error, info);

    // REVIEW FIX (F-arch-1). This assigned unconditionally and destroyed a NARROWER code the
    // consumer had already set: a CLI exiting 2 for a usage error, then hitting a contained guard
    // failure, exited 1 and lost the reason. D1's mitigation only covered writes AFTER the catch,
    // which a consumer cannot schedule. A code that is already non-zero is already the truth.
    //
    // `exitCode`, never `exit()`: setting the code lets the process finish normally — flushing
    // output, running teardown, unmounting — while telling the shell the truth. `process.exit(1)`
    // would truncate in-flight stdout and skip teardown, turning a CONTAINED failure back into an
    // abrupt one, which is the behaviour being replaced.
    if (!process.exitCode) process.exitCode = 1;
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      this.props.fallback ?? (
        <Text dimColor>[{this.props.component} unavailable]</Text>
      )
    );
  }
}
