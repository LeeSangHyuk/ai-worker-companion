import test from "node:test";
import assert from "node:assert/strict";
import { updateOpenTuiTextNode } from "../../integrations/opencode/.opencode/plugins/agent-companion.js";

test("an actual OpenTUI text node changes its displayed Last Check", {
  skip: !process.versions.bun && "OpenTUI 0.2.16 requires Bun or Node with FFI",
}, async () => {
  const { TextRenderable } = await import("@opentui/core");
  const { createTestRenderer } = await import("@opentui/core/testing");
  const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 50, height: 3 });
  const node = new TextRenderable(renderer, { id: "awc-last-check", content: "Last Check: 10:07:00 PM" });
  const solidAdapter = {
    setProp(target, name, value) {
      target[name] = value;
    },
  };

  try {
    renderer.root.add(node);
    await renderOnce();
    assert.match(captureCharFrame(), /Last Check: 10:07:00 PM/);

    updateOpenTuiTextNode(solidAdapter, node, "Last Check: 10:07:05 PM");
    await renderOnce();
    const updatedFrame = captureCharFrame();
    assert.match(updatedFrame, /Last Check: 10:07:05 PM/);
    assert.doesNotMatch(updatedFrame, /Last Check: 10:07:00 PM/);
  } finally {
    renderer.destroy();
  }
});
