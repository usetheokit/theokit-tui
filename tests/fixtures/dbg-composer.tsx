import { render } from "ink-testing-library";

import { ChatComposer } from "../../src/chat-composer.js";

const tick = async () => new Promise((r) => setTimeout(r, 0));
const i = render(<ChatComposer onSubmit={() => {}} />);
await tick();
await tick();
i.stdin.write("hi");
await tick();
await tick();
console.log("FRAMES:", JSON.stringify(i.frames));
i.stdin.write("X");
await tick();
console.log("LAST2:", JSON.stringify(i.lastFrame()));
i.unmount();
