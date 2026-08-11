/**
 * Route a keypress through modal layers declared in precedence order.
 *
 * A terminal agent has several things on screen at once — a help panel, a running turn, a
 * confirmation gate, a login flow, a composer — and Ctrl-C or Escape means something different in
 * each. The code that decides is invariably a hand-written if-chain whose ORDER is the entire
 * contract and is written down nowhere. The resulting bug is quiet by nature: the key appears to do
 * nothing, or does the other thing, and no test fails.
 *
 * ## What is generic here, and what is not
 *
 * The MECHANISM is generic: layers are tried in declared order, the first whose `when` holds claims
 * the key exclusively, and nothing after it is consulted. The VOCABULARY is not — which states
 * exist, which keys matter and what an action is belong to the product, and arrive as type
 * parameters and as data.
 *
 * That distinction is why this took a second pass to extract. An interface shaped by one product's
 * key states (`hasOpenQuestion`, `backtrackArmed`, `emLogin`) would have given the second consumer
 * something to route around. Here a consumer supplies its own `S`, `K` and `A` and inherits only the
 * ordering rule.
 *
 * ## Why the result names the claiming layer
 *
 * Because precedence that cannot be observed cannot be tested. A router that returns only actions
 * hides which layer answered, and a reordering that changes behaviour looks identical to one that
 * does not. Naming the claimant makes the contract assertable, and it makes "the key did nothing"
 * diagnosable at the moment it happens rather than by reading the chain.
 *
 * @public
 */

/** One modal layer: when it applies, and what a key does inside it. @public */
export interface KeyLayer<S, K, A> {
  /** Reported back as the claimant. Use the name the product's own docs use. */
  readonly name: string;
  /**
   * Whether this layer applies. The first layer for which this holds claims the key EXCLUSIVELY —
   * later layers are not consulted, and their `when` is not even evaluated.
   */
  readonly when: (state: S) => boolean;
  /**
   * What the key does here. An empty result means the key was CONSUMED with no effect, which is a
   * different fact from no layer claiming it — a confirmation gate must absorb Ctrl-C rather than
   * let the composer see it.
   *
   * Called only when `when` returned true, so it may assume its own layer's preconditions.
   */
  readonly route: (key: K, state: S) => readonly A[];
}

/** @public */
export interface RoutedKey<A> {
  /** The layer that claimed the key, or `null` when none did. */
  readonly layer: string | null;
  /** What to do. Empty when the claiming layer swallowed the key, or when nothing claimed it. */
  readonly actions: readonly A[];
}

/**
 * @returns the claiming layer's name and its actions, or `{ layer: null, actions: [] }` when no
 *   layer applies. The actions are a snapshot: a caller may hold the result across keypresses while
 *   the layer reuses its own array.
 * @public
 */
export function routeThroughLayers<S, K, A>(
  layers: readonly KeyLayer<S, K, A>[],
  key: K,
  state: S,
): RoutedKey<A> {
  for (const layer of layers) {
    if (!layer.when(state)) continue;
    return { layer: layer.name, actions: [...layer.route(key, state)] };
  }
  return { layer: null, actions: [] };
}
