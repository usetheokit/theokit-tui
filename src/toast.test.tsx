import { render } from "ink-testing-library";
import { act } from "react";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { Toast } from "./toast.js";

// M24 T4.1 — the Toast auto-dismiss timer (blueprint ADR D4, RISK-1). Fake-timer
// oracles (the M12/M14 discipline): fires onDismiss at exactly durationMs; an
// unmount before the deadline clears the timer (no post-unmount onDismiss);
// re-scheduling (durationMs change) clears the prior timer.

describe("Toast (M24 T4.1)", () => {
  beforeAll(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });
  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
  });
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("renders_the_message", () => {
    let instance!: ReturnType<typeof render>;
    act(() => {
      instance = render(<Toast message="saved!" onDismiss={() => {}} />);
    });
    expect(instance.lastFrame()).toContain("saved!");
    act(() => {
      instance.unmount();
    });
  });

  it("fires_onDismiss_at_exactly_durationMs", () => {
    let dismissed = 0;
    let instance!: ReturnType<typeof render>;
    act(() => {
      instance = render(
        <Toast
          message="x"
          durationMs={5000}
          onDismiss={() => {
            dismissed++;
          }}
        />,
      );
    });
    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(dismissed).toBe(0); // not before the deadline
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(dismissed).toBe(1); // fired at exactly durationMs
    act(() => {
      instance.unmount();
    });
  });

  it("unmount_before_the_deadline_clears_the_timer", () => {
    let dismissed = 0;
    let instance!: ReturnType<typeof render>;
    act(() => {
      instance = render(
        <Toast
          message="x"
          durationMs={5000}
          onDismiss={() => {
            dismissed++;
          }}
        />,
      );
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    act(() => {
      instance.unmount();
    });
    act(() => {
      vi.advanceTimersByTime(10000); // past the original deadline
    });
    expect(dismissed).toBe(0); // the timer was cleared on unmount
  });

  it("an_inline_onDismiss_does_not_reset_the_timer_each_render", () => {
    let dismissed = 0;
    let instance!: ReturnType<typeof render>;
    act(() => {
      instance = render(
        <Toast
          message="v1"
          durationMs={5000}
          onDismiss={() => {
            dismissed++;
          }}
        />,
      );
    });
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    // A re-render with a NEW inline onDismiss must NOT restart the countdown.
    act(() => {
      instance.rerender(
        <Toast
          message="v2"
          durationMs={5000}
          onDismiss={() => {
            dismissed++;
          }}
        />,
      );
    });
    act(() => {
      vi.advanceTimersByTime(2000); // total 5000 from the original mount
    });
    expect(dismissed).toBe(1);
    act(() => {
      instance.unmount();
    });
  });
});
