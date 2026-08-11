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
 * **What is deliberately NOT here:** the keypress router. Its mechanism generalises — a pure
 * function from state and keypress to an ordered list of actions — but its contract is the
 * consumer's vocabulary (which overlays are open, whether a turn is streaming, what "escape" means
 * at each layer). Publishing one shaped by a single application would give the second consumer an
 * interface to route around rather than to use, and a public API cannot be taken back. It stays a
 * design question until there is more than one example to design against.
 *
 * @public
 */

export { DEFAULT_CAP_BYTES, DEFAULT_KEEP, rotateLog } from "./log-rotation.js";
export type { RotateOptions } from "./log-rotation.js";
export { installStderrGuard } from "./stderr-guard.js";
export type { StderrGuardOptions } from "./stderr-guard.js";
export { createWriteQueue } from "./write-queue.js";
export type { WriteQueue } from "./write-queue.js";
