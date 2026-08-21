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
  // MEASURED 2026-08-20 (B-074), recorded here because the finding is about THIS signature and
  // this file is the only place it travels to.
  //
  // `boolean` — not a type predicate — so whatever `when` proves about the state is discarded
  // before `render` sees it. In this repository that costs nothing: the only example whose
  // `render` touches a field its `when` checked is `<Text>{s.question}</Text>`, and JSX tolerates
  // `undefined`. Measured against the one real consumer, it costs a cast:
  //
  //     when:   (p) => p.pendingApproval !== undefined,
  //     render: (p) => <ApprovalCard approval={p.pendingApproval as PendingApproval} … />
  //
  // That `as` is the shape `status/guard-sink.ts` already argues against — a reachability claim
  // with the argument left out — except the argument is not missing here. It is written THREE
  // LINES ABOVE, in the `when` that just proved it, and the type throws it away in between.
  //
  // The lesson is about where to look, not about the fix: judged from inside this repository the
  // feature has zero demand and reads as gold-plating. **The repository is not the sample; it is
  // the easiest case.** A library feature justified by its own examples is justified by nothing —
  // the examples are written by the people who already know the shape.
  //
  // Not changed yet: a narrowing form costs callers an explicit type-argument pair, and
  // `src/keys/layer-router.ts:40` carries the same signature, so any design has two sites to
  // satisfy or must say why it covers one.
  /** What this layer draws. Called ONLY through {@link SelectedSurface.render}, never during selection. */
  readonly render: (state: S) => ReactNode;
}

/**
 * A layer whose `when` is a TYPE PREDICATE, so `render` receives the narrowed state (B-074).
 *
 * ## Why this is additive rather than a change to `SurfaceLayer`
 *
 * Two other shapes were measured first and both fail:
 *
 * - A defaulted second type parameter with a union `when` breaks on `strictFunctionTypes`
 *   contravariance for a heterogeneous array. Switching `render` to method shorthand compiles it —
 *   and opens a bivariance hole where a layer with a plain-boolean `when` and a narrowed `render`
 *   type-checks, so `selectSurface` would pass the WIDE state into it. That trades a visible
 *   compile error for an invisible runtime violation.
 * - Making `when` predicate-only breaks 11 existing call sites across `examples/` and `tests/`.
 *
 * So `SurfaceLayer` is untouched, existing layers keep compiling, and this is the opt-in form.
 *
 * ## The one `as`, and why it is here rather than in every consumer
 *
 * `render: (state as T)` is a cast, and this repository argues against casts —
 * `status/guard-sink.ts` records that an `as` is a reachability claim with the argument left out.
 * The argument is not left out here: `when` returned true one line earlier, which is exactly what
 * `state is T` means, and that is locally verifiable at this call site and nowhere else.
 *
 * Without this, the cast does not disappear — it MOVES to every consumer, written by people who
 * cannot see the line that discharges it. Measured in the one real consumer:
 *
 *     when:   (p) => p.pendingApproval !== undefined,
 *     render: (p) => <ApprovalCard approval={p.pendingApproval as PendingApproval} … />
 *
 * One cast in the library, discharged where the proof is, instead of one per layer written where
 * the proof is three lines away and invisible to the type system.
 *
 * ## The honest ergonomic cost
 *
 * Inference does not carry: `S` cannot be deduced from a lone type-predicate parameter, so callers
 * write `narrowingLayer<AppState, NonChat>({ … })` — one explicit type-argument pair. Measured
 * against the three constructs the consumer writes today (a named guard applied on both sides plus
 * an unreachable `null` branch), that is a net reduction and not a free one.
 *
 * `src/keys/layer-router.ts:40` carries the same `when: (state: S) => boolean` signature and is
 * NOT covered here. Its `when` returns actions rather than feeding a `render`, so the narrowing has
 * no consumer there — stated so the omission reads as a decision rather than an oversight.
 *
 * @public
 */
export function narrowingLayer<S, T extends S>(layer: {
  readonly name: string;
  readonly when: (state: S) => state is T;
  readonly render: (state: T) => ReactNode;
}): SurfaceLayer<S> {
  return {
    name: layer.name,
    when: layer.when,
    // Discharged by the predicate the caller was FORCED to supply: `selectSurface` calls `render`
    // only for the layer whose `when` returned true, and `when` returning true IS `state is T`.
    render: (state: S): ReactNode => layer.render(state as T),
  };
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
export function selectSurface<S>(layers: readonly SurfaceLayer<S>[], state: S): SelectedSurface {
  for (const layer of layers) {
    if (!layer.when(state)) continue;
    return { layer: layer.name, render: () => layer.render(state) };
  }
  return { layer: null, render: () => null };
}
