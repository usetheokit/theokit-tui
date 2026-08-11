/**
 * `@theokit/tui/keys` — deciding what a keypress means when several things are on screen.
 *
 * A terminal agent has a help panel, a running turn, a confirmation gate, a login flow and a
 * composer, often at once. Ctrl-C and Escape mean something different in each, and the code that
 * decides is invariably a hand-written if-chain whose ORDER is the whole contract and is recorded
 * nowhere. The failure is quiet: the key appears to do nothing, or does the other thing.
 *
 * **Why this ships now, when `./terminal` said it would not.** That module deferred the router with a
 * real objection: an interface shaped by one product's key states would give the second consumer
 * something to route around. The objection stands and this design answers it — what is published is
 * the ORDERING RULE, not the vocabulary. The states, the keys and the actions are type parameters
 * supplied by the consumer, exactly as the security floor takes its permissiveness order as data.
 * Nothing here names an overlay, a mode, or a keystroke.
 *
 * **A separate subpath from `./terminal`** because these are pure: no `node:fs`, no `process`, no
 * React. A consumer routing keys in a test should not pull in file handles to do it.
 */

export { routeThroughLayers, type KeyLayer, type RoutedKey } from "./layer-router.js";
