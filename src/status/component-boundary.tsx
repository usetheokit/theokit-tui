import { Text } from "ink";
import { Component, type ReactNode } from "react";

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
  },
  { readonly failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(): void {
    // `exitCode`, never `exit()`. Setting the code lets the process finish normally — flushing
    // output, running teardown, unmounting — while telling the shell the truth. `process.exit(1)`
    // here would truncate in-flight stdout and skip teardown, turning a CONTAINED failure back into
    // an abrupt one, which is the behaviour being replaced.
    //
    // A consumer who disagrees can set it back: this is a default, not a seizure.
    process.exitCode = 1;
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
