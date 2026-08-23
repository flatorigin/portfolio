import assert from "node:assert/strict";
import test from "node:test";
import { supportsWallStroke, wallCenterlinePoints, wallOutlinePathD } from "./wallStroke.js";

test("open wall creates parallel boundaries with perpendicular end caps", () => {
  const path = wallOutlinePathD({ type: "line", x: 0, y: 0, x2: 100, y2: 0 }, 6);
  assert.equal(path, "M 0 2.5 L 100 2.5 L 100 -2.5 L 0 -2.5 Z");
});

test("right-angle wall creates one finite mitered perimeter", () => {
  const path = wallOutlinePathD(
    { type: "pen", points: [{ x: 10, y: 10 }, { x: 80, y: 10 }, { x: 80, y: 70 }] },
    8,
  );
  assert.equal((path.match(/M /g) || []).length, 1);
  assert.equal((path.match(/Z/g) || []).length, 1);
  assert.doesNotMatch(path, /NaN|Infinity/);
});

test("closed wall creates separate inner and outer joined loops", () => {
  const path = wallOutlinePathD(
    {
      type: "pen",
      closed: true,
      points: [{ x: 10, y: 10 }, { x: 90, y: 10 }, { x: 90, y: 90 }, { x: 10, y: 90 }],
    },
    10,
  );
  assert.equal((path.match(/M /g) || []).length, 2);
  assert.equal((path.match(/Z/g) || []).length, 2);
  assert.doesNotMatch(path, /NaN|Infinity/);
});

test("curved centerlines are sampled before offsetting", () => {
  const points = wallCenterlinePoints({
    type: "line",
    x: 0,
    y: 0,
    x2: 100,
    y2: 0,
    curvePoint: { x: 50, y: 80 },
  });
  assert.ok(points.length > 6);
  assert.deepEqual(points[0], { x: 0, y: 0 });
  assert.deepEqual(points.at(-1), { x: 100, y: 0 });
});

test("rectangle wall creates rounded inner and outer boundaries", () => {
  const path = wallOutlinePathD(
    { type: "rect", x: 10, y: 20, x2: 110, y2: 80, cornerRadius: 10 },
    6,
  );
  assert.equal((path.match(/M /g) || []).length, 2);
  assert.equal((path.match(/Z/g) || []).length, 2);
  assert.match(path, /Q /);
  assert.doesNotMatch(path, /NaN|Infinity/);
});

test("circle wall creates concentric inner and outer boundaries", () => {
  const path = wallOutlinePathD({ type: "circle", x: 10, y: 20, x2: 110, y2: 80 }, 8);
  assert.equal((path.match(/M /g) || []).length, 2);
  assert.equal((path.match(/A /g) || []).length, 4);
  assert.equal((path.match(/Z/g) || []).length, 2);
  assert.doesNotMatch(path, /NaN|Infinity/);
});

test("wall style is available to every supported geometry-menu drawing tool", () => {
  assert.equal(supportsWallStroke({ type: "rect" }), true);
  assert.equal(supportsWallStroke({ type: "circle" }), true);
  assert.equal(supportsWallStroke({ type: "line" }), true);
});
