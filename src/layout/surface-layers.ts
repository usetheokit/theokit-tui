import type { ReactNode } from "react";

/**
 * One candidate surface in a precedence-ordered list.
 *
 * The render twin of `KeyLayer` (`src/keys/layer-router.ts`), and deliberately NOT the same type:
 * a key layer returns actions and distinguishes "claimed with no effect" from "unclaimed", because
 * a confirmation gate must absorb Ctrl-C rather than let the composer see it. A surface that
 * renders nothing and no surface at all are the same pixel, so that distinction has no analogue
 * here and importing it would add a state no caller can observe (ADR D3).
 */
export interface SurfaceLayer<S> {
  /** Reported back as the claimant. Use the name the product's own docs use. */
  readonly name: string;
  /**
   * Whether this layer applies. The first layer for which this holds claims the surface
   * EXCLUSIVELY — later layers are not consulted, and their `when` is not even evaluated.
   *
   * Overlapping predicates are legal and only the first renders: that is precedence working, not a
   * defect. A predicate that throws is not caught — the failure belongs to the caller's state and
   * swallowing it here would hide it (`.claude/rules/error-handling.md` § 2).
   */
  readonly when: (state: S) => boolean;
  /** What this layer draws. Called ONLY through {@link SelectedSurface.render}, never during selection. */
  readonly render: (state: S) => ReactNode;
}

/** @public */
export interface SelectedSurface {
  /** The layer that claimed the surface, or `null` when none did. */
  readonly layer: string | null;
  /** Draws the claimant. Returns `null` when nothing claimed. */
  readonly render: () => ReactNode;
}

/**
 * Which surface owns the region right now — decided without drawing anything.
 *
 * Every terminal agent has a confirmation gate, a login prompt, a question and a composer competing
 * for one row, and the answer is invariably a nested ternary inside JSX. The ordering IS the
 * contract there, and it is recorded nowhere: reading it means following the chain, and in the one
 * measured consumer it spans seven surfaces across two files.
 *
 * **The reason this is a function and not a component.** Selection is pure, so a test can ask which
 * surface wins from a state object alone. Inside a ternary the same question is only answerable by
 * MOUNTING, and mounting the alternatives drags in whatever they import — measured in that consumer
 * as `@theocode/agent/config`, `/ask`, `/auth`, `@theocode/shared/agent` and `node:os`. Its key
 * precedence, which this package already made a list, IS tested; its render precedence is not.
 *
 * `render` is a thunk for the same reason: building the node eagerly would invoke the winner's
 * render at selection time, so a caller that only wants the claimant would pay for it.
 */
export function selectSurface<S>(
  layers: readonly SurfaceLayer<S>[],
  state: S,
): SelectedSurface {
  for (const layer of layers) {
    if (!layer.when(state)) continue;
    return { layer: layer.name, render: () => layer.render(state) };
  }
  return { layer: null, render: () => null };
}
