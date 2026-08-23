import assert from "node:assert/strict";
import test from "node:test";
import {
  enforceLockedEraserOpacity,
  eraserStrokeOpacity,
  lockedAnnotationGroupOpacity,
} from "./markupLock.js";

test("locked erasers bypass the generic locked-layer dimming", () => {
  assert.equal(lockedAnnotationGroupOpacity({ type: "background_eraser" }, true), undefined);
  assert.equal(lockedAnnotationGroupOpacity({ type: "freehand" }, true), 0.45);
});

test("locked erasers always render at full stroke opacity", () => {
  assert.equal(eraserStrokeOpacity({ type: "background_eraser", strokeOpacity: 0.2 }, true), 1);
  assert.equal(eraserStrokeOpacity({ type: "background_eraser", strokeOpacity: 0.2 }, false), 0.2);
});

test("locking an eraser normalizes its persisted opacity without changing other attributes", () => {
  const eraser = { id: "eraser-1", type: "background_eraser", strokeOpacity: 0.3, strokeWidth: 42 };
  assert.deepEqual(enforceLockedEraserOpacity(eraser, true), {
    ...eraser,
    strokeOpacity: 1,
  });
  assert.equal(enforceLockedEraserOpacity(eraser, false), eraser);
});
