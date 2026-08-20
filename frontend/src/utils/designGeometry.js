export const DEFAULT_DESIGN_SETTINGS = {
  ceilingHeight: 8,
  baseCeilingHeight: 8,
  baseFloorWidth: null,
  baseFloorLength: null,
  baseFloorUnit: null,
  wallThickness: 0.5,
  halfWallHeight: 3.5,
  floorThickness: 0.5,
  snapIncrement: 0.25,
  exterior: false,
};

const UNIT_TO_FEET = {
  ft: 1,
  in: 1 / 12,
  m: 3.28084,
};

export function clampDesignNumber(value, min, max, fallback = min) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

export function formatFeet(value) {
  const totalInches = Math.round(Math.max(0, Number(value) || 0) * 12);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet}'${inches ? ` ${inches}\"` : ""}`;
}

export function formatSignedFeet(value) {
  const number = Number(value) || 0;
  if (Math.abs(number) < 1 / 24) return "No change";
  return `${number > 0 ? "+" : "-"}${formatFeet(Math.abs(number))}`;
}

export function isDesignWall(annotation) {
  if (!annotation) return false;
  return annotation.designRole === "wall" || (
    annotation.canvasMode === "rough_plan" &&
    annotation.type === "line" &&
    annotation.designRole !== "note"
  );
}

export function createDesignTransform(annotations, measurementGeometry, roughPlan) {
  const unit = measurementGeometry?.unit || roughPlan?.unit || "ft";
  const unitToFeet = UNIT_TO_FEET[unit] || 1;
  const scale = Math.max(0.0001, Number(measurementGeometry?.scale) || 1);
  const points = (annotations || [])
    .filter((item) => isDesignWall(item) || ["door", "window", "steps"].includes(item?.type))
    .flatMap((item) => [
      { x: Number(item.x) || 0, y: Number(item.y) || 0 },
      { x: Number(item.x2 ?? item.x) || 0, y: Number(item.y2 ?? item.y) || 0 },
    ]);
  const fallbackX = points.length ? Math.min(...points.map((point) => point.x)) : 0;
  const fallbackY = points.length ? Math.min(...points.map((point) => point.y)) : 0;
  const originX = Number.isFinite(Number(measurementGeometry?.designX))
    ? Number(measurementGeometry.designX)
    : fallbackX;
  const originY = Number.isFinite(Number(measurementGeometry?.designY))
    ? Number(measurementGeometry.designY)
    : fallbackY;

  return {
    unit,
    scale,
    unitToFeet,
    originX,
    originY,
    toWorld(point = {}) {
      return {
        x: ((Number(point.x) || 0) - originX) / scale * unitToFeet,
        z: ((Number(point.y) || 0) - originY) / scale * unitToFeet,
      };
    },
    toCanvas(point = {}) {
      return {
        x: originX + ((Number(point.x) || 0) / unitToFeet) * scale,
        y: originY + ((Number(point.z) || 0) / unitToFeet) * scale,
      };
    },
  };
}

function pointSegmentProjection(point, start, end) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  if (!lengthSquared) return { distance: Infinity, offset: 0, point: start };
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared));
  const projected = { x: start.x + dx * t, z: start.z + dz * t };
  return {
    distance: Math.hypot(point.x - projected.x, point.z - projected.z),
    offset: Math.sqrt(lengthSquared) * t,
    point: projected,
  };
}

export function buildDesignGeometry(annotations, measurementGeometry, roughPlan, settings = {}) {
  const resolvedSettings = { ...DEFAULT_DESIGN_SETTINGS, ...(settings || {}) };
  const transform = createDesignTransform(annotations, measurementGeometry, roughPlan);
  const walls = (annotations || []).filter(isDesignWall).map((annotation, index) => {
    const start = transform.toWorld({ x: annotation.x, y: annotation.y });
    const end = transform.toWorld({ x: annotation.x2, y: annotation.y2 });
    const kind = annotation.wallKind || (annotation.designRole === "wall" ? "new" : "existing");
    const defaultHeight = kind === "half" ? resolvedSettings.halfWallHeight : resolvedSettings.ceilingHeight;
    const height = clampDesignNumber(annotation.wallHeight, 0.5, 30, defaultHeight);
    const thickness = clampDesignNumber(annotation.wallThickness, 0.2, 2, resolvedSettings.wallThickness);
    return {
      id: annotation.id,
      annotation,
      label: annotation.wallLabel || `Wall ${index + 1}`,
      kind,
      start,
      end,
      length: Math.hypot(end.x - start.x, end.z - start.z),
      height,
      thickness,
    };
  }).filter((wall) => wall.length > 0.08);

  const activeWalls = walls.filter((wall) => wall.kind !== "remove");

  const openings = (annotations || [])
    .filter((annotation) => annotation?.type === "door" || annotation?.type === "window")
    .map((annotation) => {
      const point = transform.toWorld({ x: annotation.x, y: annotation.y });
      const nearest = activeWalls.reduce((best, wall) => {
        const projection = pointSegmentProjection(point, wall.start, wall.end);
        return !best || projection.distance < best.projection.distance ? { wall, projection } : best;
      }, null);
      if (!nearest || nearest.projection.distance > 3) return null;
      const type = annotation.type;
      return {
        id: annotation.id,
        annotation,
        type,
        wallId: nearest.wall.id,
        point: nearest.projection.point,
        offset: nearest.projection.offset,
        width: clampDesignNumber(annotation.openingWidth, 1, 12, type === "door" ? 3 : 3),
        height: clampDesignNumber(annotation.openingHeight, 1, 12, type === "door" ? 6.67 : 4),
        sillHeight: type === "window" ? clampDesignNumber(annotation.sillHeight, 0, 10, 3) : 0,
      };
    })
    .filter(Boolean);

  const stairs = (annotations || []).filter((annotation) => annotation?.type === "steps").map((annotation) => ({
    id: annotation.id,
    annotation,
    point: transform.toWorld({ x: annotation.x, y: annotation.y }),
    width: clampDesignNumber(annotation.stairWidth, 2, 12, 3.5),
    run: clampDesignNumber(annotation.stairRun, 2, 20, 5),
    rise: clampDesignNumber(annotation.stairRise, 0.5, 15, 3),
  }));

  const allPoints = walls.flatMap((wall) => [wall.start, wall.end]);
  const width = Math.max(
    Number(roughPlan?.width || 0) * (UNIT_TO_FEET[roughPlan?.unit] || 1),
    allPoints.length ? Math.max(...allPoints.map((point) => point.x)) : 0,
    12,
  );
  const length = Math.max(
    Number(roughPlan?.length || 0) * (UNIT_TO_FEET[roughPlan?.unit] || 1),
    allPoints.length ? Math.max(...allPoints.map((point) => point.z)) : 0,
    12,
  );

  return {
    settings: resolvedSettings,
    transform,
    walls,
    openings,
    stairs,
    width,
    length,
    floorWidth: Number(roughPlan?.width || 0) * (UNIT_TO_FEET[roughPlan?.unit] || 1),
    floorLength: Number(roughPlan?.length || 0) * (UNIT_TO_FEET[roughPlan?.unit] || 1),
  };
}

export function designChanges(geometry) {
  const changes = [];
  const ceilingBefore = Number(geometry.settings.baseCeilingHeight) || DEFAULT_DESIGN_SETTINGS.baseCeilingHeight;
  const ceilingNow = Number(geometry.settings.ceilingHeight) || DEFAULT_DESIGN_SETTINGS.ceilingHeight;
  if (Math.abs(ceilingNow - ceilingBefore) > 0.001) {
    changes.push({
      id: "ceiling-height",
      targetId: "floor",
      label: "Ceiling height",
      before: formatFeet(ceilingBefore),
      current: formatFeet(ceilingNow),
      delta: formatSignedFeet(ceilingNow - ceilingBefore),
    });
  }

  const baseFloorFactor = UNIT_TO_FEET[geometry.settings.baseFloorUnit || geometry.transform.unit] || 1;
  [
    ["width", "Floor width", geometry.settings.baseFloorWidth, geometry.floorWidth],
    ["length", "Floor length", geometry.settings.baseFloorLength, geometry.floorLength],
  ].forEach(([key, label, beforeValue, currentValue]) => {
    if (beforeValue === null || beforeValue === undefined || beforeValue === "") return;
    const before = Number(beforeValue) * baseFloorFactor;
    const current = Number(currentValue);
    if (!Number.isFinite(before) || !Number.isFinite(current) || Math.abs(current - before) <= 0.001) return;
    changes.push({
      id: `floor-${key}`,
      targetId: "floor",
      label,
      before: formatFeet(before),
      current: formatFeet(current),
      delta: formatSignedFeet(current - before),
    });
  });

  geometry.walls.forEach((wall) => {
    const baseline = wall.annotation.designBaseline;
    if (["new", "half"].includes(wall.kind) && (!baseline || ["new", "half"].includes(baseline.wallKind))) {
      changes.push({
        id: `${wall.id}-added`,
        targetId: wall.id,
        label: `${wall.kind === "half" ? "Half wall" : "Wall"} added`,
        before: "Not present",
        current: formatFeet(wall.length),
        delta: "New",
      });
      return;
    }
    if (!baseline) return;
    const baselineStart = geometry.transform.toWorld({ x: baseline.x, y: baseline.y });
    const baselineEnd = geometry.transform.toWorld({ x: baseline.x2, y: baseline.y2 });
    const baselineLength = Math.hypot(baselineEnd.x - baselineStart.x, baselineEnd.z - baselineStart.z);
    const baselineHeight = Number(baseline.wallHeight) || geometry.settings.ceilingHeight;
    const baselineThickness = Number(baseline.wallThickness) || geometry.settings.wallThickness;
    if (wall.kind === "remove") {
      changes.push({
        id: `${wall.id}-removed`,
        targetId: wall.id,
        label: `${wall.label} removed`,
        before: formatFeet(baselineLength),
        current: "Removed",
        delta: "Removed",
      });
      return;
    }
    if (Math.abs(wall.length - baselineLength) > 0.02) {
      changes.push({
        id: `${wall.id}-length`,
        targetId: wall.id,
        label: `${wall.label} length`,
        before: formatFeet(baselineLength),
        current: formatFeet(wall.length),
        delta: formatSignedFeet(wall.length - baselineLength),
      });
    }
    const baselineMidpoint = {
      x: (baselineStart.x + baselineEnd.x) / 2,
      z: (baselineStart.z + baselineEnd.z) / 2,
    };
    const midpoint = {
      x: (wall.start.x + wall.end.x) / 2,
      z: (wall.start.z + wall.end.z) / 2,
    };
    const moveX = midpoint.x - baselineMidpoint.x;
    const moveY = midpoint.z - baselineMidpoint.z;
    if (Math.hypot(moveX, moveY) > 0.02) {
      changes.push({
        id: `${wall.id}-position`,
        targetId: wall.id,
        label: `${wall.label} position`,
        before: `X ${formatFeet(baselineMidpoint.x)} / Y ${formatFeet(baselineMidpoint.z)}`,
        current: `X ${formatFeet(midpoint.x)} / Y ${formatFeet(midpoint.z)}`,
        delta: `${formatSignedFeet(moveX)} X, ${formatSignedFeet(moveY)} Y`,
      });
    }
    if (Math.abs(wall.height - baselineHeight) > 0.02) {
      changes.push({
        id: `${wall.id}-height`,
        targetId: wall.id,
        label: `${wall.label} height`,
        before: formatFeet(baselineHeight),
        current: formatFeet(wall.height),
        delta: formatSignedFeet(wall.height - baselineHeight),
      });
    }
    if (Math.abs(wall.thickness - baselineThickness) > 0.02) {
      changes.push({
        id: `${wall.id}-thickness`,
        targetId: wall.id,
        label: `${wall.label} thickness`,
        before: formatFeet(baselineThickness),
        current: formatFeet(wall.thickness),
        delta: formatSignedFeet(wall.thickness - baselineThickness),
      });
    }
    const baselineKind = baseline.wallKind || "existing";
    if (wall.kind !== baselineKind) {
      const kindLabel = (kind) => ({ existing: "Existing wall", new: "New wall", half: "Half wall" }[kind] || kind);
      changes.push({
        id: `${wall.id}-kind`,
        targetId: wall.id,
        label: `${wall.label} type`,
        before: kindLabel(baselineKind),
        current: kindLabel(wall.kind),
        delta: "Changed",
      });
    }
  });

  geometry.openings.forEach((opening) => {
    const baseline = opening.annotation.designBaseline;
    if (!baseline) return;
    const baselinePoint = geometry.transform.toWorld({ x: baseline.x, y: baseline.y });
    const currentPoint = geometry.transform.toWorld({ x: opening.annotation.x, y: opening.annotation.y });
    const typeLabel = opening.type === "window" ? "Window" : "Door";
    const moveX = currentPoint.x - baselinePoint.x;
    const moveY = currentPoint.z - baselinePoint.z;
    if (Math.hypot(moveX, moveY) > 0.02) {
      changes.push({
        id: `${opening.id}-position`,
        targetId: opening.id,
        label: `${typeLabel} position`,
        before: `X ${formatFeet(baselinePoint.x)} / Y ${formatFeet(baselinePoint.z)}`,
        current: `X ${formatFeet(currentPoint.x)} / Y ${formatFeet(currentPoint.z)}`,
        delta: `${formatSignedFeet(moveX)} X, ${formatSignedFeet(moveY)} Y`,
      });
    }
    [
      ["width", "width", Number(baseline.openingWidth) || 3, opening.width],
      ["height", "height", Number(baseline.openingHeight) || (opening.type === "door" ? 6.67 : 4), opening.height],
      ["sill", "sill height", Number(baseline.sillHeight) || 0, opening.sillHeight],
    ].forEach(([key, label, before, current]) => {
      if ((key === "sill" && opening.type !== "window") || Math.abs(current - before) <= 0.02) return;
      changes.push({
        id: `${opening.id}-${key}`,
        targetId: opening.id,
        label: `${typeLabel} ${label}`,
        before: formatFeet(before),
        current: formatFeet(current),
        delta: formatSignedFeet(current - before),
      });
    });
  });

  geometry.stairs.forEach((stair) => {
    const baseline = stair.annotation.designBaseline;
    if (!baseline) return;
    const baselinePoint = geometry.transform.toWorld({ x: baseline.x, y: baseline.y });
    const moveX = stair.point.x - baselinePoint.x;
    const moveY = stair.point.z - baselinePoint.z;
    if (Math.hypot(moveX, moveY) > 0.02) {
      changes.push({
        id: `${stair.id}-position`,
        targetId: stair.id,
        label: "Stair position",
        before: `X ${formatFeet(baselinePoint.x)} / Y ${formatFeet(baselinePoint.z)}`,
        current: `X ${formatFeet(stair.point.x)} / Y ${formatFeet(stair.point.z)}`,
        delta: `${formatSignedFeet(moveX)} X, ${formatSignedFeet(moveY)} Y`,
      });
    }
    [
      ["width", Number(baseline.stairWidth) || 3.5, stair.width],
      ["run", Number(baseline.stairRun) || 5, stair.run],
      ["rise", Number(baseline.stairRise) || 3, stair.rise],
    ].forEach(([label, before, current]) => {
      if (Math.abs(current - before) <= 0.02) return;
      changes.push({
        id: `${stair.id}-${label}`,
        targetId: stair.id,
        label: `Stair ${label}`,
        before: formatFeet(before),
        current: formatFeet(current),
        delta: formatSignedFeet(current - before),
      });
    });
  });

  return changes;
}
