import { Box, Text } from "ink";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import Yoga from "yoga-layout";

import {
  clearContainerChildren,
  createHostReconciler,
  createRootNode,
  type RootNode,
} from "./host-config.js";

// M18 T1.1 (plan m18-yoga-layout, ADR D1): the host-config yoga tree. Every
// box/top-level-text node gains a yoga node wired into the parent's yoga tree;
// nested text is virtual (no yoga node); removal frees the WASM node (no leak).
// Tested through a direct reconciler harness that inspects the built tree.

function mount(element: ReactNode): {
  root: RootNode;
  render: (e: ReactNode) => void;
} {
  const root = createRootNode();
  const reconciler = createHostReconciler(() => {});
  const container = reconciler.createContainer(
    root,
    0,
    null,
    false,
    null,
    "test",
    () => {},
    () => {},
    () => {},
    () => {},
  );
  const render = (e: ReactNode): void => {
    reconciler.updateContainerSync(e, container, null, () => {});
    reconciler.flushSyncWork();
  };
  render(element);
  return { root, render };
}

describe("host-config yoga tree (M18 T1.1)", () => {
  it("box_gets_yoga_node_and_attaches_children", () => {
    const { root } = mount(
      <Box>
        <Text>x</Text>
      </Box>,
    );
    const box = root.children[0]!;
    expect(box.type).toBe("ink-box");
    expect(box.yogaNode).toBeDefined();
    // The box holds one yoga child: the top-level ink-text.
    expect(box.yogaNode!.getChildCount()).toBe(1);
    // The root holds the box.
    expect(root.yogaNode!.getChildCount()).toBe(1);
  });

  it("text_inside_text_has_no_yoga_node", () => {
    const { root } = mount(
      <Text>
        a<Text>b</Text>
      </Text>,
    );
    const outer = root.children[0]!;
    expect(outer.type).toBe("ink-text");
    expect(outer.yogaNode).toBeDefined();
    // Neither child of the outer text has a yoga node (both virtual): the
    // #text "a" and the nested ink-text "b".
    expect(outer.yogaNode!.getChildCount()).toBe(0);
    const innerText = outer.children.find((c) => c.type === "ink-text");
    expect(innerText).toBeDefined();
    expect(innerText!.yogaNode).toBeUndefined();
  });

  it("removal_frees_and_detaches_from_yoga_tree", () => {
    const { root, render } = mount(
      <Box>
        <Text key="a">a</Text>
        <Text key="b">b</Text>
      </Box>,
    );
    const box = root.children[0]!;
    expect(box.yogaNode!.getChildCount()).toBe(2);
    const textA = box.children[0]!;
    let freed = false;
    const realFree = textA.yogaNode!.freeRecursive.bind(textA.yogaNode);
    textA.yogaNode!.freeRecursive = () => {
      freed = true;
      realFree();
    };
    render(
      <Box>
        <Text key="b">b</Text>
      </Box>,
    );
    expect(freed).toBe(true); // WASM node freed — no leak
    expect(box.yogaNode!.getChildCount()).toBe(1); // detached from yoga tree
  });

  it("insert_before_places_yoga_child_at_correct_index", () => {
    const { root, render } = mount(
      <Box flexDirection="column">
        <Text key="a">a</Text>
        <Text key="c">c</Text>
      </Box>,
    );
    // Insert "b" BETWEEN a and c — its yoga index must count the preceding
    // yoga sibling "a" (exercises yogaIndexOf's increment).
    render(
      <Box flexDirection="column">
        <Text key="a">a</Text>
        <Text key="b">b</Text>
        <Text key="c">c</Text>
      </Box>,
    );
    const box = root.children[0]!;
    expect(box.yogaNode!.getChildCount()).toBe(3);
    expect(box.children.map((c) => c.children[0]!.text)).toEqual(["a", "b", "c"]);
  });

  it("commit_update_reapplies_styles_to_yoga_node", () => {
    const { root, render } = mount(<Box flexDirection="column" />);
    const box = root.children[0]!;
    expect(box.yogaNode!.getFlexDirection()).toBe(Yoga.FLEX_DIRECTION_COLUMN);
    // Change the same box's prop → commitUpdate re-applies styles to its yoga node.
    render(<Box flexDirection="row" />);
    expect(box.yogaNode!.getFlexDirection()).toBe(Yoga.FLEX_DIRECTION_ROW);
  });

  it("text_node_measure_func_sizes_text_on_layout", () => {
    // The bound measure func (T2.1) lets yoga size a text node during
    // calculateLayout — the ink-text computes to the text's width.
    const { root } = mount(
      <Box>
        <Text>hello</Text>
      </Box>,
    );
    root.yogaNode!.setWidth(40);
    root.yogaNode!.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
    const inkText = root.children[0]!.children[0]!;
    expect(inkText.type).toBe("ink-text");
    expect(inkText.yogaNode!.getComputedWidth()).toBe(5); // "hello"
    expect(inkText.yogaNode!.getComputedHeight()).toBe(1);
  });

  it("commit_update_resets_removed_style_key", () => {
    // A style key present last render and ABSENT this render must reset to the
    // yoga default (Ink's diff-with-undefined-deletes) — not keep the stale
    // value. Regression guard for the M18 review port-fidelity finding.
    const { root, render } = mount(<Box paddingLeft={4} />);
    const box = root.children[0]!;
    expect(box.yogaNode!.getPadding(Yoga.EDGE_LEFT).value).toBe(4);
    render(<Box />); // paddingLeft removed
    expect(box.yogaNode!.getPadding(Yoga.EDGE_LEFT).value).toBe(0);
  });

  it("clear_container_children_removes_and_frees_all", () => {
    const { root } = mount(
      <Box>
        <Text>x</Text>
      </Box>,
    );
    expect(root.yogaNode!.getChildCount()).toBe(1);
    clearContainerChildren(root);
    expect(root.children).toHaveLength(0);
    expect(root.yogaNode!.getChildCount()).toBe(0);
  });
});
