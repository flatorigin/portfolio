const EPSILON = 0.001;
const WALL_OUTLINE_WIDTH = 1;
const WALL_MIN_OUTLINE_WIDTH = 0.5;
const WALL_MAX_OUTLINE_WIDTH = 6;
const WALL_MIN_HOLLOW_WIDTH = 1;
const WALL_MIN_TOTAL_WIDTH = 3;
const WALL_MITER_LIMIT = 4;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function finitePoint(point) {
  return point && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y))
    ? { x: Number(point.x), y: Number(point.y) }
    : null;
}

function distance(pointA, pointB) {
  return Math.hypot(pointB.x - pointA.x, pointB.y - pointA.y);
}

function unitVector(pointA, pointB) {
  const length = distance(pointA, pointB);
  if (length <= EPSILON) return null;
  return {
    x: (pointB.x - pointA.x) / length,
    y: (pointB.y - pointA.y) / length,
  };
}

function normalFor(direction, side) {
  return { x: -direction.y * side, y: direction.x * side };
}

function cleanPoints(points, closed = false) {
  const cleaned = [];
  (Array.isArray(points) ? points : []).forEach((rawPoint) => {
    const point = finitePoint(rawPoint);
    if (!point) return;
    if (!cleaned.length || distance(cleaned[cleaned.length - 1], point) > EPSILON) {
      cleaned.push(point);
    }
  });
  if (closed && cleaned.length > 2 && distance(cleaned[0], cleaned[cleaned.length - 1]) <= EPSILON) {
    cleaned.pop();
  }
  return cleaned;
}

function sampleCount(...points) {
  const estimate = points.slice(0, -1).reduce(
    (length, point, index) => length + distance(point, points[index + 1]),
    0,
  );
  return clamp(Math.ceil(estimate / 14), 6, 28);
}

function sampleQuadratic(start, control, end) {
  const steps = sampleCount(start, control, end);
  return Array.from({ length: steps }, (_, index) => {
    const t = (index + 1) / steps;
    const inverse = 1 - t;
    return {
      x: inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x,
      y: inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * end.y,
    };
  });
}

function sampleCubic(start, control1, control2, end) {
  const steps = sampleCount(start, control1, control2, end);
  return Array.from({ length: steps }, (_, index) => {
    const t = (index + 1) / steps;
    const inverse = 1 - t;
    return {
      x:
        inverse * inverse * inverse * start.x +
        3 * inverse * inverse * t * control1.x +
        3 * inverse * t * t * control2.x +
        t * t * t * end.x,
      y:
        inverse * inverse * inverse * start.y +
        3 * inverse * inverse * t * control1.y +
        3 * inverse * t * t * control2.y +
        t * t * t * end.y,
    };
  });
}

function appendSegment(samples, start, end, control) {
  if (control?.type === "cubic") {
    const control1 = finitePoint(control.c1);
    const control2 = finitePoint(control.c2);
    if (control1 && control2) {
      samples.push(...sampleCubic(start, control1, control2, end));
      return;
    }
  }
  const quadraticControl = finitePoint(control);
  if (quadraticControl) {
    samples.push(...sampleQuadratic(start, quadraticControl, end));
    return;
  }
  samples.push(end);
}

export function wallCenterlinePoints(item) {
  if (!item || typeof item !== "object") return [];

  if (["line", "arrow", "measure"].includes(item.type)) {
    const start = finitePoint({ x: item.x, y: item.y });
    const end = finitePoint({ x: item.x2 ?? item.x, y: item.y2 ?? item.y });
    if (!start || !end) return [];
    const control = finitePoint(item.curvePoint);
    return cleanPoints(control ? [start, ...sampleQuadratic(start, control, end)] : [start, end]);
  }

  const sourcePoints = cleanPoints(item.points, Boolean(item.closed));
  if (sourcePoints.length < 2 || item.type !== "pen") return sourcePoints;

  const curves = item.curvePoints && typeof item.curvePoints === "object" ? item.curvePoints : {};
  const samples = [sourcePoints[0]];
  sourcePoints.slice(1).forEach((point, index) => {
    appendSegment(samples, sourcePoints[index], point, curves[index]);
  });
  if (item.closed && sourcePoints.length > 2) {
    appendSegment(samples, sourcePoints[sourcePoints.length - 1], sourcePoints[0], curves[sourcePoints.length - 1]);
  }
  return cleanPoints(samples, Boolean(item.closed));
}

function offsetVertex(points, index, offset, side, closed) {
  const point = points[index];
  const lastIndex = points.length - 1;
  const previous = index === 0 ? (closed ? points[lastIndex] : null) : points[index - 1];
  const next = index === lastIndex ? (closed ? points[0] : null) : points[index + 1];

  if (!previous && next) {
    const direction = unitVector(point, next);
    const normal = normalFor(direction, side);
    return { x: point.x + normal.x * offset, y: point.y + normal.y * offset };
  }
  if (previous && !next) {
    const direction = unitVector(previous, point);
    const normal = normalFor(direction, side);
    return { x: point.x + normal.x * offset, y: point.y + normal.y * offset };
  }

  const previousDirection = unitVector(previous, point);
  const nextDirection = unitVector(point, next);
  if (!previousDirection || !nextDirection) return point;
  const previousNormal = normalFor(previousDirection, side);
  const nextNormal = normalFor(nextDirection, side);
  const miterX = previousNormal.x + nextNormal.x;
  const miterY = previousNormal.y + nextNormal.y;
  const miterMagnitude = Math.hypot(miterX, miterY);
  if (miterMagnitude <= EPSILON) {
    return { x: point.x + nextNormal.x * offset, y: point.y + nextNormal.y * offset };
  }

  const miter = { x: miterX / miterMagnitude, y: miterY / miterMagnitude };
  const denominator = miter.x * nextNormal.x + miter.y * nextNormal.y;
  if (Math.abs(denominator) <= EPSILON) {
    return { x: point.x + nextNormal.x * offset, y: point.y + nextNormal.y * offset };
  }
  const miterLength = clamp(offset / denominator, -offset * WALL_MITER_LIMIT, offset * WALL_MITER_LIMIT);
  return { x: point.x + miter.x * miterLength, y: point.y + miter.y * miterLength };
}

function offsetSide(points, offset, side, closed) {
  return points.map((_, index) => offsetVertex(points, index, offset, side, closed));
}

function pathFromPoints(points, close = false) {
  if (!points.length) return "";
  const commands = points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`);
  if (close) commands.push("Z");
  return commands.join(" ");
}

function shapeBounds(item) {
  const start = finitePoint({ x: item?.x, y: item?.y });
  const end = finitePoint({ x: item?.x2 ?? item?.x, y: item?.y2 ?? item?.y });
  if (!start || !end) return null;
  return {
    x1: Math.min(start.x, end.x),
    y1: Math.min(start.y, end.y),
    x2: Math.max(start.x, end.x),
    y2: Math.max(start.y, end.y),
  };
}

function rectangleRadii(item, bounds) {
  const maxRadius = Math.max(0, Math.min(bounds.x2 - bounds.x1, bounds.y2 - bounds.y1) / 2);
  const raw = item?.cornerRadii || {};
  const fallback = item?.cornerRadius ?? 10;
  return {
    tl: clamp(Number(raw.tl ?? fallback) || 0, 0, maxRadius),
    tr: clamp(Number(raw.tr ?? fallback) || 0, 0, maxRadius),
    br: clamp(Number(raw.br ?? fallback) || 0, 0, maxRadius),
    bl: clamp(Number(raw.bl ?? fallback) || 0, 0, maxRadius),
  };
}

function adjustedRadii(radii, offset, maxRadius) {
  return Object.fromEntries(
    Object.entries(radii).map(([corner, radius]) => [
      corner,
      clamp(radius > 0 ? radius + offset : 0, 0, maxRadius),
    ]),
  );
}

function roundedRectanglePath(bounds, radii) {
  const maxRadius = Math.max(0, Math.min(bounds.x2 - bounds.x1, bounds.y2 - bounds.y1) / 2);
  const tl = clamp(radii.tl || 0, 0, maxRadius);
  const tr = clamp(radii.tr || 0, 0, maxRadius);
  const br = clamp(radii.br || 0, 0, maxRadius);
  const bl = clamp(radii.bl || 0, 0, maxRadius);
  return [
    `M ${bounds.x1 + tl} ${bounds.y1}`,
    `L ${bounds.x2 - tr} ${bounds.y1}`,
    tr ? `Q ${bounds.x2} ${bounds.y1} ${bounds.x2} ${bounds.y1 + tr}` : `L ${bounds.x2} ${bounds.y1}`,
    `L ${bounds.x2} ${bounds.y2 - br}`,
    br ? `Q ${bounds.x2} ${bounds.y2} ${bounds.x2 - br} ${bounds.y2}` : `L ${bounds.x2} ${bounds.y2}`,
    `L ${bounds.x1 + bl} ${bounds.y2}`,
    bl ? `Q ${bounds.x1} ${bounds.y2} ${bounds.x1} ${bounds.y2 - bl}` : `L ${bounds.x1} ${bounds.y2}`,
    `L ${bounds.x1} ${bounds.y1 + tl}`,
    tl ? `Q ${bounds.x1} ${bounds.y1} ${bounds.x1 + tl} ${bounds.y1}` : `L ${bounds.x1} ${bounds.y1}`,
    "Z",
  ].join(" ");
}

function rectangleWallPathD(item, centerOffset) {
  const bounds = shapeBounds(item);
  if (!bounds || bounds.x2 - bounds.x1 <= EPSILON || bounds.y2 - bounds.y1 <= EPSILON) return "";
  const radii = rectangleRadii(item, bounds);
  const outerBounds = {
    x1: bounds.x1 - centerOffset,
    y1: bounds.y1 - centerOffset,
    x2: bounds.x2 + centerOffset,
    y2: bounds.y2 + centerOffset,
  };
  const innerBounds = {
    x1: bounds.x1 + centerOffset,
    y1: bounds.y1 + centerOffset,
    x2: bounds.x2 - centerOffset,
    y2: bounds.y2 - centerOffset,
  };
  if (innerBounds.x2 <= innerBounds.x1 || innerBounds.y2 <= innerBounds.y1) return "";
  const outerMaxRadius = Math.min(outerBounds.x2 - outerBounds.x1, outerBounds.y2 - outerBounds.y1) / 2;
  const innerMaxRadius = Math.min(innerBounds.x2 - innerBounds.x1, innerBounds.y2 - innerBounds.y1) / 2;
  return [
    roundedRectanglePath(outerBounds, adjustedRadii(radii, centerOffset, outerMaxRadius)),
    roundedRectanglePath(innerBounds, adjustedRadii(radii, -centerOffset, innerMaxRadius)),
  ].join(" ");
}

function ellipsePath(cx, cy, rx, ry) {
  if (rx <= EPSILON || ry <= EPSILON) return "";
  return [
    `M ${cx + rx} ${cy}`,
    `A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy}`,
    `A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy}`,
    "Z",
  ].join(" ");
}

function circleWallPathD(item, centerOffset) {
  const bounds = shapeBounds(item);
  if (!bounds) return "";
  const cx = (bounds.x1 + bounds.x2) / 2;
  const cy = (bounds.y1 + bounds.y2) / 2;
  const rx = Math.max(10, (bounds.x2 - bounds.x1) / 2);
  const ry = Math.max(10, (bounds.y2 - bounds.y1) / 2);
  const innerRx = rx - centerOffset;
  const innerRy = ry - centerOffset;
  if (innerRx <= EPSILON || innerRy <= EPSILON) return "";
  return `${ellipsePath(cx, cy, rx + centerOffset, ry + centerOffset)} ${ellipsePath(cx, cy, innerRx, innerRy)}`;
}

export function wallOutlinePathD(item, requestedWidth) {
  const totalWidth = Math.max(WALL_MIN_TOTAL_WIDTH, Number(requestedWidth) || WALL_MIN_TOTAL_WIDTH);
  const outlineWidth = wallOutlineWidthFor(item, totalWidth);
  const centerOffset = (totalWidth - outlineWidth) / 2;
  if (item?.type === "rect") return rectangleWallPathD(item, centerOffset);
  if (item?.type === "circle") return circleWallPathD(item, centerOffset);

  const closed = Boolean(item?.closed && item?.type === "pen");
  const points = wallCenterlinePoints(item);
  if (points.length < (closed ? 3 : 2)) return "";
  const left = offsetSide(points, centerOffset, 1, closed);
  const right = offsetSide(points, centerOffset, -1, closed);

  if (closed) {
    return `${pathFromPoints(left, true)} ${pathFromPoints(right, true)}`;
  }
  return pathFromPoints([...left, ...right.reverse()], true);
}

export function supportsWallStroke(item) {
  return !item || ["rect", "circle", "line", "freehand", "pen"].includes(item.type);
}

export function isWallStroke(item) {
  return item?.strokeStyle === "wall" && supportsWallStroke(item);
}

export function wallOutlineMaxWidth(requestedWidth) {
  const totalWidth = Math.max(WALL_MIN_TOTAL_WIDTH, Number(requestedWidth) || WALL_MIN_TOTAL_WIDTH);
  return clamp(
    (totalWidth - WALL_MIN_HOLLOW_WIDTH) / 2,
    WALL_MIN_OUTLINE_WIDTH,
    WALL_MAX_OUTLINE_WIDTH,
  );
}

export function wallOutlineWidthFor(item, requestedWidth) {
  const requestedOutline = Number(item?.wallOutlineWidth ?? WALL_OUTLINE_WIDTH);
  return clamp(
    Number.isFinite(requestedOutline) ? requestedOutline : WALL_OUTLINE_WIDTH,
    WALL_MIN_OUTLINE_WIDTH,
    wallOutlineMaxWidth(requestedWidth),
  );
}

export const WALL_STROKE_OUTLINE_WIDTH = WALL_OUTLINE_WIDTH;
