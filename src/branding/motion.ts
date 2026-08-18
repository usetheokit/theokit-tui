// M24 motion gate (plan m24-live-progress-surfaces T1.1, ADR D6): the reduced-
// motion predicate extracted from M12's inlined `isRevealEligible`
// (welcome-banner.tsx) once a third animated consumer appeared (Rule-of-3 —
// phrase-cycler + shimmer + Toast). Pure: env + stdout + monochrome injected, no
// module state. Motion is enabled iff the end-user has NOT set
// `THEOKIT_TUI_NO_MOTION` (any non-empty value disables), stdout is a real TTY
// (a pipe never animates), and the theme is not monochrome (no color to animate).

/** True iff animations should run for this env / terminal / theme. */
export function isMotionEnabled(
  env: NodeJS.ProcessEnv,
  stdout: { isTTY?: boolean } | undefined,
  monochrome: boolean,
): boolean {
  return (
    (env["THEOKIT_TUI_NO_MOTION"] ?? "") === "" &&
    stdout?.isTTY === true &&
    !monochrome
  );
}
