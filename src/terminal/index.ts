/**
 * `@theokit/tui/terminal` — the loop the components run inside.
 *
 * This package ships the widgets. What it did not ship is what every terminal agent has to build
 * before a widget can be drawn safely: a guard so a stray warning cannot corrupt the frame, writes
 * that serialise per file, and log rotation so a long session does not fill the disk. Measured in
 * one consumer at ~120 LoC of exactly that, with no framework coupling — code a second agent CLI
 * would rediscover, most likely after seeing a display corrupt in front of a user.
 *
 * **A separate subpath on purpose.** These reach `node:fs` and `process`, while the main barrel is
 * React components. Putting them in `.` would drag Node built-ins into every bundle that imports a
 * button.
 *
 * **The keypress router lives next door, at `@theokit/tui/keys`.** It was deliberately absent here
 * while its contract was the consumer's vocabulary — which overlays are open, whether a turn is
 * streaming, what "escape" means at each layer. Publishing that would have given the second consumer
 * an interface to route around. What ships instead is the ORDERING RULE alone, with the states, keys
 * and actions as type parameters, so the objection is answered rather than waived.
 *
 * @public
 */

export type { RotateOptions } from "./log-rotation.js";
export { DEFAULT_CAP_BYTES, DEFAULT_KEEP, rotateLog } from "./log-rotation.js";
export { CLEAR_SCREEN_AND_SCROLLBACK } from "./screen.js";
export type { StderrGuardOptions } from "./stderr-guard.js";
export { installStderrGuard } from "./stderr-guard.js";
export type { WriteQueue } from "./write-queue.js";
export { createWriteQueue } from "./write-queue.js";
