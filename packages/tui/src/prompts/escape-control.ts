// Show C0/C1 control characters and DEL as visible escapes, so what a prompt displays is what
// would run: `npm test\rrm -rf x` must not render as `rm -rf x` over `npm test`.
const NAMED: Record<string, string> = { "\r": "\\r", "\n": "\\n", "\t": "\\t" };

export function escapeControl(text: string): string {
  return text.replace(/[\u0000-\u001f\u007f-\u009f]/g, (c) => {
    const named = NAMED[c];
    if (named !== undefined) return named;
    return `\\x${c.charCodeAt(0).toString(16).padStart(2, "0")}`;
  });
}
