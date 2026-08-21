/**
 * Clear the screen AND the scrollback, then home the cursor.
 *
 * The name is longer than the value on purpose. This package holds a second clear-screen sequence
 * — private, inside the output engine — that deliberately KEEPS scrollback, because a full redraw
 * owns the screen and erasing history would destroy output the engine did not write. The two differ
 * by three characters and mean opposite things.
 *
 * Choosing wrong is invisible: `\x1b[2J\x1b[H` leaves a blank screen and a cursor at home, which is
 * exactly what a correct reset looks like. The difference appears only when someone scrolls up and
 * finds the conversation they were told was cleared, and that can be the next second or the next
 * week. No test in this package can see it — every assertion here is on the rendered frame, and
 * scrollback is what the terminal keeps outside it.
 *
 * So what ships is the NAME. Reach for this when a session is reset — `/clear`, a fork, a new
 * conversation — and the previous one must not be recoverable by scrolling.
 */
export const CLEAR_SCREEN_AND_SCROLLBACK = "\u001B[2J\u001B[3J\u001B[H";
