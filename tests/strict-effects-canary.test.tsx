import { Text } from "ink";
import { render } from "ink-testing-library";
import { StrictMode, useEffect } from "react";
import { describe, expect, it } from "vitest";

// M10 T2.1 (plan D5): the StrictMode confirmation canary — and D5's reason
// to exist: the blueprint's SOURCE-level analysis of react-reconciler 0.33
// predicted the double-invoke gate was gone (flip to 2 creates / 1 destroy);
// the EXPERIMENT refuted it — under ink7's legacy-sync container
// (createContainer isStrictMode=false + updateContainerSync) effects are
// STILL single-invoked in our vitest env (dev build confirmed via
// NODE_ENV=test). The M7 DV-1 claim therefore REMAINS TRUE on ink7. This
// canary pins the OBSERVED behavior so any future ink/react change that
// actually flips it fails loudly here instead of silently invalidating
// hook-test assumptions.

interface Counts {
  creates: number;
  destroys: number;
}

function Probe({ counts }: { counts: Counts }) {
  useEffect(() => {
    counts.creates += 1;
    return () => {
      counts.destroys += 1;
    };
  }, [counts]);
  return <Text>probe</Text>;
}

async function ticks(count = 5): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  }
}

describe("strict-effects canary (M10 D5)", () => {
  it("strict_mode_effect_invocation_pinned_on_ink7", async () => {
    // Sentinel power requires the DEV react build (prod never
    // double-invokes — the flip would be undetectable).
    expect(process.env["NODE_ENV"]).not.toBe("production");
    const counts: Counts = { creates: 0, destroys: 0 };
    const instance = render(
      <StrictMode>
        <Probe counts={counts} />
      </StrictMode>,
    );
    await ticks();
    // OBSERVED on ink7+react19 (empirical — see header): single invoke.
    expect(counts.creates).toBe(1);
    expect(counts.destroys).toBe(0);
    instance.unmount();
  });

  it("no_strict_mode_single_invoke_control", async () => {
    const counts: Counts = { creates: 0, destroys: 0 };
    const instance = render(<Probe counts={counts} />);
    await ticks();
    expect(counts.creates).toBe(1);
    expect(counts.destroys).toBe(0);
    instance.unmount();
  });
});
