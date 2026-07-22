import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";

import { ChatComposer } from "./chat-composer.js";
import { TheoTUIProvider } from "./theme.js";

const tick = () => new Promise((r) => setTimeout(r, 0));
const settle = () => new Promise((r) => setTimeout(r, 50));

/**
 * M54 (agent-builder backtrack) — `onChange` reports buffer text so the host can enforce a
 * composer-empty precondition (Codex `is_normal_backtrack_mode`).
 */
describe("ChatComposer onChange", () => {
  it("fires_with_current_text_as_the_buffer_changes", async () => {
    const onChange = vi.fn();
    const inst = render(
      <TheoTUIProvider>
        <ChatComposer onSubmit={() => {}} onChange={onChange} />
      </TheoTUIProvider>,
    );
    await tick();
    await tick();
    inst.stdin.write("hi");
    await settle();
    // o último onChange reflete o texto digitado
    const calls = onChange.mock.calls.map((c) => c[0]);
    expect(calls.at(-1)).toBe("hi");
    inst.unmount();
  });
});
