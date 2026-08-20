import { Text } from "ink";
import { describe, expect, it } from "vitest";

import {
  narrowingLayer,
  selectSurface,
  type SurfaceLayer,
} from "./surface-layers.js";

/**
 * B-074 — the RED for `narrowingLayer`.
 *
 * `SurfaceLayer.when` returns `boolean`, so whatever it proves about the state is discarded before
 * `render` sees it. Measured 2026-08-20, that costs NOTHING in this repository — the only example
 * whose `render` touches a field its `when` checked is `<Text>{s.question}</Text>`, and JSX
 * tolerates `undefined`.
 *
 * It costs a CAST in the one real consumer (`TheoCode`, `InputSlot.tsx:110-116`):
 *
 *     when:   (p) => p.pendingApproval !== undefined,
 *     render: (p) => <ApprovalCard approval={p.pendingApproval as PendingApproval} … />
 *
 * That `as` is the shape `status/guard-sink.ts` argues against — a reachability claim with the
 * argument omitted — except the argument is written THREE LINES ABOVE, in the `when` that just
 * proved it, and the type throws it away in between.
 */

interface Chat {
  readonly mode: "chat" | "approval";
  readonly pendingApproval?: { readonly id: string };
}

interface WithApproval extends Chat {
  readonly pendingApproval: { readonly id: string };
}

describe("narrowingLayer (B-074)", () => {
  it("hands_render_the_narrow_type_without_the_caller_writing_a_cast", () => {
    const layer = narrowingLayer<Chat, WithApproval>({
      name: "approval",
      when: (s): s is WithApproval => s.pendingApproval !== undefined,
      // No `as` here, and that is the whole point: `render` receives `WithApproval`, so
      // `s.pendingApproval.id` type-checks without the caller re-asserting what `when` proved.
      render: (s) => <Text>{s.pendingApproval.id}</Text>,
    });

    const selected = selectSurface([layer], {
      mode: "approval",
      pendingApproval: { id: "abc" },
    });

    expect(selected.layer).toBe("approval");
  });

  it("is_assignable_to_SurfaceLayer_so_it_mixes_with_ordinary_layers", () => {
    // The load-bearing property for adoption: a narrowing layer and a wide one must live in the
    // same `readonly SurfaceLayer<S>[]`, or every consumer has to split its list in two.
    const narrow = narrowingLayer<Chat, WithApproval>({
      name: "approval",
      when: (s): s is WithApproval => s.pendingApproval !== undefined,
      render: (s) => <Text>{s.pendingApproval.id}</Text>,
    });
    const wide: SurfaceLayer<Chat> = {
      name: "composer",
      when: () => true,
      render: () => <Text>composer</Text>,
    };

    const layers: readonly SurfaceLayer<Chat>[] = [narrow, wide];

    expect(selectSurface(layers, { mode: "chat" }).layer).toBe("composer");
    expect(
      selectSurface(layers, { mode: "approval", pendingApproval: { id: "x" } })
        .layer,
    ).toBe("approval");
  });

  it("keeps_precedence_and_does_not_evaluate_a_later_when", () => {
    // The precedence contract `surface-layers.ts` documents must survive the wrapper — a factory
    // that quietly evaluated every `when` would break the one property the module guarantees.
    const evaluated: string[] = [];
    const first = narrowingLayer<Chat, WithApproval>({
      name: "first",
      when: (s): s is WithApproval => {
        evaluated.push("first");
        return s.pendingApproval !== undefined;
      },
      render: (s) => <Text>{s.pendingApproval.id}</Text>,
    });
    const second: SurfaceLayer<Chat> = {
      name: "second",
      when: () => {
        evaluated.push("second");
        return true;
      },
      render: () => <Text>second</Text>,
    };

    selectSurface([first, second], {
      mode: "approval",
      pendingApproval: { id: "y" },
    });

    expect(evaluated).toEqual(["first"]);
  });

  it("renders_through_the_selected_surface_rather_than_during_selection", () => {
    // `render` must not run while choosing — the module's reason for existing is that selection is
    // pure. A wrapper that called `render` eagerly would defeat it silently.
    let rendered = 0;
    const layer = narrowingLayer<Chat, WithApproval>({
      name: "approval",
      when: (s): s is WithApproval => s.pendingApproval !== undefined,
      render: (s) => {
        rendered += 1;
        return <Text>{s.pendingApproval.id}</Text>;
      },
    });

    const selected = selectSurface([layer], {
      mode: "approval",
      pendingApproval: { id: "z" },
    });
    expect(rendered).toBe(0);

    selected.render();
    expect(rendered).toBe(1);
  });
});

describe("narrowingLayer refuses what it must (B-074)", () => {
  it("a_non_predicate_when_does_not_compile", () => {
    // THE CASE THAT DECIDES WHETHER THE FACTORY IS WORTH ANYTHING. If a plain boolean `when` were
    // accepted, `render` would receive the WIDE state while being typed for the narrow one — an
    // invisible runtime violation traded for a visible compile error, which is the bivariance hole
    // that ruled out changing `SurfaceLayer` itself.
    //
    // `@ts-expect-error` IS the assertion: it fails the build if the line ever starts compiling.
    // Asserted at compile time because there is no runtime observation to make — the whole property
    // is that this shape never reaches runtime.
    const refused = () =>
      narrowingLayer<Chat, WithApproval>({
        name: "bad",
        // @ts-expect-error — Signature '(s: Chat): boolean' must be a type predicate.
        when: (s) => s.pendingApproval !== undefined,
        render: (s) => <Text>{s.pendingApproval.id}</Text>,
      });

    // Referenced so the closure is not dead code; the assertion above is the point.
    expect(typeof refused).toBe("function");
  });
});
