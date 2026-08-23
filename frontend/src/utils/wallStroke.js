const EPSILON = 0.001;
const WALL_OUTLINE_WIDTH = 1;
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

export function wallOutlinePathD(item, requestedWidth) {
  const closed = Boolean(item?.closed && item?.type === "pen");
  const points = wallCenterlinePoints(item);
  if (points.length < (closed ? 3 : 2)) return "";

  const totalWidth = Math.max(WALL_MIN_TOTAL_WIDTH, Number(requestedWidth) || WALL_MIN_TOTAL_WIDTH);
  const centerOffset = (totalWidth - WALL_OUTLINE_WIDTH) / 2;
  const left = offsetSide(points, centerOffset, 1, closed);
  const right = offsetSide(points, centerOffset, -1, closed);

  if (closed) {
    return `${pathFromPoints(left, true)} ${pathFromPoints(right, true)}`;
  }
  return pathFromPoints([...left, ...right.reverse()], true);
}

export function supportsWallStroke(item) {
  return !item || ["line", "freehand", "pen"].includes(item.type);
}

export function isWallStroke(item) {
  return item?.strokeStyle === "wall" && supportsWallStroke(item);
}

export const WALL_STROKE_OUTLINE_WIDTH = WALL_OUTLINE_WIDTH;
