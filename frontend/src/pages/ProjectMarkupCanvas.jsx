import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../api";
import { SymbolIcon } from "../ui";

const CANVAS_W = 1200;
const CANVAS_H = 760;
const STORAGE_PREFIX = "flatorigin_project_markup";

const BASE_TOOLS = {
  select: { key: "select", label: "Select", icon: "near_me" },
  curve: { key: "curve", label: "Curve", icon: "gesture" },
  hand: { key: "hand", label: "Hand", icon: "pan_tool" },
  zoomIn: { key: "zoom_in", label: "Zoom in", icon: "zoom_in" },
  zoomOut: { key: "zoom_out", label: "Zoom out", icon: "zoom_out" },
  text: { key: "text", label: "Text", icon: "title" },
  arrow: { key: "arrow", label: "Arrow", icon: "arrow_right_alt" },
  line: { key: "line", label: "Line", icon: "horizontal_rule" },
  freehand: { key: "freehand", label: "Pencil", icon: "draw" },
  pen: { key: "pen", label: "Pen", icon: "polyline" },
  penAdd: { key: "pen_add", label: "Add node", icon: "add" },
  penRemove: { key: "pen_remove", label: "Remove node", icon: "remove" },
  rect: { key: "rect", label: "Rectangle", icon: "crop_square" },
  circle: { key: "circle", label: "Circle", icon: "radio_button_unchecked" },
  measure: { key: "measure", label: "Measure", icon: "straighten" },
  delete: { key: "delete", label: "Delete", icon: "delete" },
};

const SYMBOL_TOOLS = [
  { key: "door", label: "Door", icon: "door_front" },
  { key: "window", label: "Window", icon: "window" },
  { key: "tree", label: "Tree", icon: "park" },
  { key: "steps", label: "Steps", icon: "stairs" },
  { key: "fence", label: "Fence", icon: "fence" },
];

const MARKUP_COLORS = [
  { key: "blue", label: "General notes", color: "#2563eb" },
  { key: "red", label: "Problems/repairs", color: "#dc2626" },
  { key: "green", label: "New additions", color: "#16a34a" },
  { key: "yellow", label: "Warnings/access", color: "#ca8a04" },
];

const FILL_MATERIALS = [
  { key: "flat", label: "Flat" },
  { key: "deck", label: "Deck slats" },
  { key: "gravel", label: "Gravel" },
  { key: "concrete", label: "Concrete" },
  { key: "soil", label: "Soil" },
];

const TEXTURE_LIBRARY_STORAGE_KEY = "flatorigin_fill_texture_library";

const DEFAULT_MARKUP_COLOR = "#2563eb";
const DEFAULT_STROKE_WIDTH = 4;
const DEFAULT_STROKE_OPACITY = 1;
const DEFAULT_FILL_OPACITY = 0.18;
const CURVE_HANDLE_OFFSET = 34;
const LINE_ENDPOINT_OPTIONS = [
  { key: "none", label: "None" },
  { key: "arrow", label: "Arrow" },
  { key: "dot", label: "Dot" },
];
const ROUGH_GRID_SIZE = 40;
const ROUGH_SOFT_SNAP_DISTANCE = 9;
const ROUGH_PLAN_DEFAULTS = { width: "20", length: "30", unit: "ft", snap: true, zoom: 100 };
const ROUGH_PLAN_PADDING = 82;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeError(err, fallback) {
  const data = err?.response?.data;
  return data?.detail || data?.message || (data ? JSON.stringify(data) : "") || err?.message || fallback;
}

function safeMarkupData(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function isPersistableUrl(value) {
  return !!value && !String(value).startsWith("blob:");
}

function normalizeMarkupText(value) {
  return String(value || "").replace(/[ \t]+$/gm, "").replace(/\s+$/g, "");
}

function hexToRgba(hex, alpha = 1) {
  const normalized = String(hex || DEFAULT_MARKUP_COLOR).replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return `rgba(15, 23, 42, ${alpha})`;
  const value = parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function isHexColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || ""));
}

function safeHexColor(value, fallback = DEFAULT_MARKUP_COLOR) {
  return isHexColor(value) ? value : fallback;
}

function isFillMaterialKey(value) {
  const key = String(value || "");
  return FILL_MATERIALS.some((material) => material.key === key) || key.startsWith("custom-");
}

function styleFor(item) {
  const strokeColor = item.strokeColor || item.color || DEFAULT_MARKUP_COLOR;
  const fillColor = item.fillColor || item.color || strokeColor;
  const fillMaterial = isFillMaterialKey(item.fillMaterial) ? item.fillMaterial : "flat";
  const strokeStyle = item.strokeStyle === "dashed" ? "dashed" : "solid";
  const strokeOpacity = clamp(Number(item.strokeOpacity ?? DEFAULT_STROKE_OPACITY), 0, 1);
  const fillOpacity = clamp(Number(item.fillOpacity ?? DEFAULT_FILL_OPACITY), 0, 1);
  return {
    strokeColor,
    fillColor,
    fillMaterial,
    strokeOpacity,
    fillOpacity,
    fill: fillMaterial === "flat" ? hexToRgba(fillColor, fillOpacity) : `url(#fill-material-${fillMaterial})`,
    svgFillOpacity: fillMaterial === "flat" ? 1 : fillOpacity,
    strokeDasharray: strokeStyle === "dashed" ? "12 8" : undefined,
  };
}

function strokeWidthFor(item) {
  const fallback = item?.type === "measure" ? 5 : DEFAULT_STROKE_WIDTH;
  return clamp(Number(item?.strokeWidth) || fallback, 1, 18);
}

function markerIdForColor(color) {
  return `arrow-${String(color || DEFAULT_MARKUP_COLOR).replace(/[^a-z0-9]/gi, "")}`;
}

function dotMarkerIdForColor(color) {
  return `dot-${String(color || DEFAULT_MARKUP_COLOR).replace(/[^a-z0-9]/gi, "")}`;
}

function svgToDataUrl(svg) {
  try {
    return `data:image/svg+xml;base64,${window.btoa(unescape(encodeURIComponent(svg)))}`;
  } catch {
    return "";
  }
}

function fillMaterialPreviewStyle(material, fillColor, fillOpacity) {
  if (!material || material.key === "flat") return { backgroundColor: hexToRgba(fillColor, fillOpacity) };
  if (material.key.startsWith("custom-")) {
    const previewUrl = svgToDataUrl(material.svg);
    return {
      backgroundColor: "#fff",
      backgroundImage: previewUrl ? `url("${previewUrl}")` : undefined,
      backgroundSize: "cover",
      backgroundPosition: "center",
      filter: "grayscale(1) contrast(1.15)",
    };
  }
  if (material.key === "deck") {
    return {
      background:
        "repeating-linear-gradient(90deg, #fff 0 13px, #111827 13px 15px, #f1f5f9 15px 28px, #475569 28px 29px)",
    };
  }
  if (material.key === "gravel") {
    return {
      backgroundColor: "#fff",
      backgroundImage:
        "radial-gradient(circle at 25% 30%, #111827 0 2px, transparent 2px), radial-gradient(circle at 66% 24%, #64748b 0 2px, transparent 2px), radial-gradient(circle at 76% 70%, #0f172a 0 3px, transparent 3px), radial-gradient(circle at 34% 78%, #94a3b8 0 2px, transparent 2px)",
    };
  }
  if (material.key === "concrete") {
    return {
      backgroundColor: "#f8fafc",
      backgroundImage:
        "radial-gradient(circle at 28% 36%, #64748b 0 1px, transparent 1px), radial-gradient(circle at 70% 26%, #cbd5e1 0 1px, transparent 1px), linear-gradient(135deg, transparent 0 58%, #94a3b8 58% 60%, transparent 60%)",
    };
  }
  return {
    backgroundColor: "#fff",
    backgroundImage:
      "radial-gradient(circle at 24% 28%, #111827 0 3px, transparent 3px), radial-gradient(circle at 68% 26%, #64748b 0 2px, transparent 2px), radial-gradient(circle at 76% 70%, #0f172a 0 3px, transparent 3px), radial-gradient(circle at 34% 78%, #94a3b8 0 2px, transparent 2px)",
  };
}

function annotationLayerLabel(item, index) {
  const fallback = `Layer ${index + 1}`;
  if (!item) return fallback;
  if (item.type === "text") return normalizeMarkupText(item.text) || "Text note";
  if (item.type === "measure") return normalizeMarkupText(item.text) || "Measurement";
  if (item.type === "pen") return item.closed ? "Pen shape" : "Pen path";
  if (item.type === "freehand") return "Pencil drawing";
  if (item.type === "rect") return "Rectangle";
  if (item.type === "circle") return "Circle";
  if (item.type === "arrow") return "Arrow";
  if (item.type === "line") return "Line";
  if (item.type === "priority") return `Priority ${item.priorityNumber || index + 1}`;
  if (["door", "window", "tree", "steps", "fence"].includes(item.type)) {
    return item.type.charAt(0).toUpperCase() + item.type.slice(1);
  }
  return fallback;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Could not read image."));
    reader.readAsDataURL(blob);
  });
}

function pointFromEvent(event, svg, viewBox = { x: 0, y: 0, width: CANVAS_W, height: CANVAS_H }) {
  const rect = svg.getBoundingClientRect();
  const x = viewBox.x + ((event.clientX - rect.left) / rect.width) * viewBox.width;
  const y = viewBox.y + ((event.clientY - rect.top) / rect.height) * viewBox.height;
  return {
    x: clamp(Math.round(x), 0, CANVAS_W),
    y: clamp(Math.round(y), 0, CANVAS_H),
  };
}

function softSnapPoint(point, enabled, geometry = null) {
  if (!enabled) return point;
  const gridSize = geometry?.scale || ROUGH_GRID_SIZE;
  const snapDistance = Math.max(ROUGH_SOFT_SNAP_DISTANCE, Math.min(18, gridSize * 0.25));
  const originX = geometry?.x || 0;
  const originY = geometry?.y || 0;
  const snap = (value, origin) => {
    const nearest = origin + Math.round((value - origin) / gridSize) * gridSize;
    return Math.abs(nearest - value) <= snapDistance ? nearest : value;
  };
  return { x: clamp(Math.round(snap(point.x, originX)), 0, CANVAS_W), y: clamp(Math.round(snap(point.y, originY)), 0, CANVAS_H) };
}

function distanceBetween(pointA, pointB) {
  if (!pointA || !pointB) return Infinity;
  return Math.hypot((pointA.x || 0) - (pointB.x || 0), (pointA.y || 0) - (pointB.y || 0));
}

function distanceToSegment(point, start, end) {
  if (!point || !start || !end) return Infinity;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;
  if (!lengthSq) return distanceBetween(point, start);
  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq, 0, 1);
  return distanceBetween(point, { x: start.x + dx * t, y: start.y + dy * t });
}

function nearestPenHit(item, point, tolerance = 18) {
  const points = Array.isArray(item?.points) ? item.points : [];
  if (!points.length) return null;
  const nodeHits = points
    .map((node, index) => ({ type: "node", index, distance: distanceBetween(point, node) }))
    .sort((a, b) => a.distance - b.distance);
  if (nodeHits[0]?.distance <= tolerance) return nodeHits[0];

  let bestSegment = null;
  for (let index = 0; index < points.length - 1; index += 1) {
    const distance = distanceToSegment(point, points[index], points[index + 1]);
    if (!bestSegment || distance < bestSegment.distance) {
      bestSegment = { type: "segment", index, distance };
    }
  }
  if (item?.closed && points.length > 2) {
    const closingIndex = points.length - 1;
    const distance = distanceToSegment(point, points[closingIndex], points[0]);
    if (!bestSegment || distance < bestSegment.distance) {
      bestSegment = { type: "segment", index: closingIndex, distance };
    }
  }
  return bestSegment?.distance <= tolerance ? bestSegment : null;
}

function roughPlanGeometry(roughPlan) {
  const widthUnits = Math.max(1, Number(roughPlan?.width) || 1);
  const lengthUnits = Math.max(1, Number(roughPlan?.length) || 1);
  const availableW = CANVAS_W - ROUGH_PLAN_PADDING * 2;
  const availableH = CANVAS_H - ROUGH_PLAN_PADDING * 2;
  const scale = Math.min(availableW / widthUnits, availableH / lengthUnits);
  const widthPx = widthUnits * scale;
  const heightPx = lengthUnits * scale;
  const x = (CANVAS_W - widthPx) / 2;
  const y = (CANVAS_H - heightPx) / 2;
  return {
    x,
    y,
    widthPx,
    heightPx,
    widthUnits,
    lengthUnits,
    scale,
    unit: roughPlan?.unit || "ft",
  };
}

function annotationBounds(item) {
  if ((item.type === "freehand" || item.type === "pen") && Array.isArray(item.points) && item.points.length) {
    const curvePoints =
      item.type === "pen" && item.curvePoints && typeof item.curvePoints === "object"
        ? Object.values(item.curvePoints).flatMap((point) =>
            point?.type === "cubic"
              ? [point.c1, point.c2].filter(Boolean)
              : point && typeof point === "object"
                ? [point]
                : [],
          )
        : [];
    const points = [...item.points, ...curvePoints];
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    return {
      x1: Math.min(...xs),
      y1: Math.min(...ys),
      x2: Math.max(...xs),
      y2: Math.max(...ys),
    };
  }
  if (item.type === "priority") {
    const radius = 26;
    return {
      x1: (item.x || 0) - radius,
      y1: (item.y || 0) - radius,
      x2: (item.x || 0) + radius,
      y2: (item.y || 0) + radius,
    };
  }
  if (["door", "window", "tree", "steps", "fence"].includes(item.type)) {
    const size = item.type === "tree" ? 70 : 64;
    return {
      x1: (item.x || 0) - size / 2,
      y1: (item.y || 0) - size / 2,
      x2: (item.x || 0) + size / 2,
      y2: (item.y || 0) + size / 2,
    };
  }
  if (isLineLike(item) && item.curvePoint) {
    const x1 = Math.min(item.x, item.x2 ?? item.x, item.curvePoint.x);
    const y1 = Math.min(item.y, item.y2 ?? item.y, item.curvePoint.y);
    const x2 = Math.max(item.x, item.x2 ?? item.x, item.curvePoint.x);
    const y2 = Math.max(item.y, item.y2 ?? item.y, item.curvePoint.y);
    return { x1, y1, x2, y2 };
  }
  const x1 = Math.min(item.x, item.x2 ?? item.x);
  const y1 = Math.min(item.y, item.y2 ?? item.y);
  const x2 = Math.max(item.x, item.x2 ?? item.x);
  const y2 = Math.max(item.y, item.y2 ?? item.y);
  return { x1, y1, x2, y2 };
}

function wrappedTextLines(text) {
  const paragraphs = normalizeMarkupText(text)
    .split("\n")
    .map((line) => line.trimEnd());

  const lines = [];
  (paragraphs.length ? paragraphs : [""]).forEach((paragraph) => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      return;
    }
    for (let index = 0; index < words.length; index += 6) {
      lines.push(words.slice(index, index + 6).join(" "));
    }
  });
  return lines.length ? lines : ["Note"];
}

function labelBox(text, fontSize = 18) {
  const lines = wrappedTextLines(text);
  const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);
  const paddingX = 14;
  const paddingY = 9;
  const lineHeight = Math.round(fontSize * 1.28);
  return {
    width: Math.max(56, longest * fontSize * 0.52 + paddingX * 2),
    height: lines.length * lineHeight + paddingY * 2,
    paddingX,
    paddingY,
    lineHeight,
    lines,
  };
}

function displayBounds(item) {
  if (!item) return { x1: 0, y1: 0, x2: 0, y2: 0 };
  if (item.type === "text") {
    const box = labelBox(item.text || "Note", 18);
    const labelX = (item.x || 0) - box.paddingX;
    const labelY = (item.y || 0) - box.height + 7;
    return {
      x1: labelX,
      y1: labelY,
      x2: labelX + box.width,
      y2: labelY + box.height,
    };
  }
  if (item.type === "measure") {
    const base = annotationBounds(item);
    const label = labelPosition(item);
    const box = labelBox(item.text || "measurement", 18);
    return {
      x1: Math.min(base.x1, label.x - box.width / 2),
      y1: Math.min(base.y1, label.y - box.height / 2),
      x2: Math.max(base.x2, label.x + box.width / 2),
      y2: Math.max(base.y2, label.y + box.height / 2),
    };
  }
  return annotationBounds(item);
}

function labelPosition(item) {
  if (!item) return null;
  if (item.type === "measure") {
    const point = quadraticPoint(item, 0.5);
    return { x: point.x, y: point.y - 40 };
  }
  if (item.type === "text") {
    return { x: item.x || 0, y: (item.y || 0) - 18 };
  }
  return null;
}

function isLineLike(item) {
  return item?.type === "line" || item?.type === "arrow" || item?.type === "measure";
}

function curveControlPoint(item) {
  return item?.curvePoint && typeof item.curvePoint === "object"
    ? item.curvePoint
    : {
        x: ((item?.x || 0) + (item?.x2 || item?.x || 0)) / 2,
        y: ((item?.y || 0) + (item?.y2 || item?.y || 0)) / 2,
      };
}

function offsetCurvePoint(item, point) {
  return offsetSegmentCurvePoint(
    { x: item?.x || 0, y: item?.y || 0 },
    { x: item?.x2 || item?.x || 0, y: item?.y2 || item?.y || 0 },
    point,
  );
}

function offsetSegmentCurvePoint(start, end, point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  return {
    x: clamp(Math.round(point.x - (dy / length) * CURVE_HANDLE_OFFSET), 0, CANVAS_W),
    y: clamp(Math.round(point.y + (dx / length) * CURVE_HANDLE_OFFSET), 0, CANVAS_H),
  };
}

function constrainOrthogonalPoint(anchor, point) {
  if (!anchor || !point) return point;
  const dx = point.x - anchor.x;
  const dy = point.y - anchor.y;
  return Math.abs(dx) >= Math.abs(dy)
    ? { x: point.x, y: anchor.y }
    : { x: anchor.x, y: point.y };
}

function quadraticPoint(item, t = 0.5) {
  const start = { x: item?.x || 0, y: item?.y || 0 };
  const end = { x: item?.x2 || item?.x || 0, y: item?.y2 || item?.y || 0 };
  const control = curveControlPoint(item);
  if (!item?.curvePoint) {
    return {
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t,
    };
  }
  const oneMinusT = 1 - t;
  return {
    x: oneMinusT * oneMinusT * start.x + 2 * oneMinusT * t * control.x + t * t * end.x,
    y: oneMinusT * oneMinusT * start.y + 2 * oneMinusT * t * control.y + t * t * end.y,
  };
}

function linePathD(item) {
  if (!item?.curvePoint) {
    return `M ${item.x || 0} ${item.y || 0} L ${item.x2 || item.x || 0} ${item.y2 || item.y || 0}`;
  }
  const control = curveControlPoint(item);
  return `M ${item.x || 0} ${item.y || 0} Q ${control.x} ${control.y} ${item.x2 || item.x || 0} ${item.y2 || item.y || 0}`;
}

function penPathD(item) {
  const points = Array.isArray(item?.points) ? item.points : [];
  if (!points.length) return "";
  const curves = item?.curvePoints && typeof item.curvePoints === "object" ? item.curvePoints : {};
  const openPath = points.slice(1).reduce((path, point, index) => {
    const control = curves[index];
    if (control?.type === "cubic" && control.c1 && control.c2) {
      return `${path} C ${control.c1.x} ${control.c1.y} ${control.c2.x} ${control.c2.y} ${point.x} ${point.y}`;
    }
    return control && typeof control === "object"
      ? `${path} Q ${control.x} ${control.y} ${point.x} ${point.y}`
      : `${path} L ${point.x} ${point.y}`;
  }, `M ${points[0].x} ${points[0].y}`);
  if (!item?.closed || points.length < 3) return openPath;
  const closingControl = curves[points.length - 1];
  if (closingControl?.type === "cubic" && closingControl.c1 && closingControl.c2) {
    return `${openPath} C ${closingControl.c1.x} ${closingControl.c1.y} ${closingControl.c2.x} ${closingControl.c2.y} ${points[0].x} ${points[0].y} Z`;
  }
  return closingControl && typeof closingControl === "object"
    ? `${openPath} Q ${closingControl.x} ${closingControl.y} ${points[0].x} ${points[0].y} Z`
    : `${openPath} Z`;
}

function penSegmentAnchor(item, segmentIndex) {
  const points = Array.isArray(item?.points) ? item.points : [];
  const start = points[segmentIndex];
  const end = points[segmentIndex + 1];
  if (!start || !end) return null;
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
}

function semicirclePenCurveControls(item, segmentIndex, point) {
  const points = Array.isArray(item?.points) ? item.points : [];
  const start = points[segmentIndex];
  const end = points[segmentIndex + 1];
  if (!start || !end) return point;
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const chordX = end.x - start.x;
  const chordY = end.y - start.y;
  const chordLength = Math.hypot(chordX, chordY);
  if (!chordLength) return point;
  const normal = { x: -chordY / chordLength, y: chordX / chordLength };
  const projection = (point.x - mid.x) * normal.x + (point.y - mid.y) * normal.y;
  const sign = projection < 0 ? -1 : 1;
  const rawDepth = Math.abs(projection);
  const halfChord = chordLength / 2;
  const depth =
    rawDepth <= halfChord
      ? rawDepth * 2
      : chordLength + (rawDepth - halfChord);
  const cappedDepth = clamp(depth, 0, chordLength * 2.75);
  const handleLength = cappedDepth * (2 / 3);
  return {
    type: "cubic",
    c1: {
      x: clamp(Math.round(start.x + normal.x * sign * handleLength), 0, CANVAS_W),
      y: clamp(Math.round(start.y + normal.y * sign * handleLength), 0, CANVAS_H),
    },
    c2: {
      x: clamp(Math.round(end.x + normal.x * sign * handleLength), 0, CANVAS_W),
      y: clamp(Math.round(end.y + normal.y * sign * handleLength), 0, CANVAS_H),
    },
  };
}

function remapCurvePointsForReverse(curvePoints, pointCount) {
  if (!curvePoints || typeof curvePoints !== "object") return {};
  return Object.entries(curvePoints).reduce((next, [key, point]) => {
    const index = Number(key);
    if (!Number.isInteger(index) || !point || typeof point !== "object") return next;
    const reversedIndex = pointCount - 2 - index;
    if (reversedIndex >= 0) next[reversedIndex] = point;
    return next;
  }, {});
}

function remapCurvePointsForInsert(curvePoints, segmentIndex) {
  if (!curvePoints || typeof curvePoints !== "object") return {};
  return Object.entries(curvePoints).reduce((next, [key, point]) => {
    const index = Number(key);
    if (!Number.isInteger(index) || !point || typeof point !== "object") return next;
    if (index < segmentIndex) next[index] = point;
    if (index > segmentIndex) next[index + 1] = point;
    return next;
  }, {});
}

function remapCurvePointsForRemove(curvePoints, pointIndex) {
  if (!curvePoints || typeof curvePoints !== "object") return {};
  return Object.entries(curvePoints).reduce((next, [key, point]) => {
    const index = Number(key);
    if (!Number.isInteger(index) || !point || typeof point !== "object") return next;
    if (index === pointIndex - 1 || index === pointIndex) return next;
    if (index > pointIndex) next[index - 1] = point;
    else next[index] = point;
    return next;
  }, {});
}

function rectCornerRadii(item, bounds) {
  const maxRadius = Math.max(0, Math.min(Math.abs(bounds.x2 - bounds.x1), Math.abs(bounds.y2 - bounds.y1)) / 2);
  const raw = item?.cornerRadii || {};
  const fallback = item?.cornerRadius ?? 10;
  return {
    tl: clamp(Number(raw.tl ?? fallback) || 0, 0, maxRadius),
    tr: clamp(Number(raw.tr ?? fallback) || 0, 0, maxRadius),
    br: clamp(Number(raw.br ?? fallback) || 0, 0, maxRadius),
    bl: clamp(Number(raw.bl ?? fallback) || 0, 0, maxRadius),
  };
}

function roundedRectPath(bounds, radii) {
  const { x1, y1, x2, y2 } = bounds;
  const width = Math.max(1, x2 - x1);
  const height = Math.max(1, y2 - y1);
  const maxRadius = Math.min(width, height) / 2;
  const tl = clamp(radii.tl || 0, 0, maxRadius);
  const tr = clamp(radii.tr || 0, 0, maxRadius);
  const br = clamp(radii.br || 0, 0, maxRadius);
  const bl = clamp(radii.bl || 0, 0, maxRadius);
  return [
    `M ${x1 + tl} ${y1}`,
    `L ${x2 - tr} ${y1}`,
    tr ? `Q ${x2} ${y1} ${x2} ${y1 + tr}` : `L ${x2} ${y1}`,
    `L ${x2} ${y2 - br}`,
    br ? `Q ${x2} ${y2} ${x2 - br} ${y2}` : `L ${x2} ${y2}`,
    `L ${x1 + bl} ${y2}`,
    bl ? `Q ${x1} ${y2} ${x1} ${y2 - bl}` : `L ${x1} ${y2}`,
    `L ${x1} ${y1 + tl}`,
    tl ? `Q ${x1} ${y1} ${x1 + tl} ${y1}` : `L ${x1} ${y1}`,
    "Z",
  ].join(" ");
}

function controlHandlesFor(item, mode = "select") {
  if (!item) return [];
  const bounds = annotationBounds(item);
  if (isLineLike(item)) {
    const control = curveControlPoint(item);
    return [
      { key: "start", label: "Start point", x: item.x || 0, y: item.y || 0, kind: "endpoint", target: "start" },
      { key: "end", label: "End point", x: item.x2 || item.x || 0, y: item.y2 || item.y || 0, kind: "endpoint", target: "end" },
      { key: "curve", label: "Curve", x: control.x, y: control.y, kind: "curve" },
    ];
  }
  if (item.type === "rect") {
    const radii = rectCornerRadii(item, bounds);
    const handleOffset = (radius) => clamp((Number(radius) || 0) + 18, 24, 72);
    const tlOffset = handleOffset(radii.tl);
    const trOffset = handleOffset(radii.tr);
    const brOffset = handleOffset(radii.br);
    const blOffset = handleOffset(radii.bl);
    return [
      { key: "nw", label: "Top left", x: bounds.x1, y: bounds.y1, kind: "corner", target: "nw" },
      { key: "ne", label: "Top right", x: bounds.x2, y: bounds.y1, kind: "corner", target: "ne" },
      { key: "sw", label: "Bottom left", x: bounds.x1, y: bounds.y2, kind: "corner", target: "sw" },
      { key: "se", label: "Bottom right", x: bounds.x2, y: bounds.y2, kind: "corner", target: "se" },
      { key: "radius-tl", label: "Top left radius", x: bounds.x1 + tlOffset, y: bounds.y1 + tlOffset, kind: "cornerRadius", target: "tl" },
      { key: "radius-tr", label: "Top right radius", x: bounds.x2 - trOffset, y: bounds.y1 + trOffset, kind: "cornerRadius", target: "tr" },
      { key: "radius-br", label: "Bottom right radius", x: bounds.x2 - brOffset, y: bounds.y2 - brOffset, kind: "cornerRadius", target: "br" },
      { key: "radius-bl", label: "Bottom left radius", x: bounds.x1 + blOffset, y: bounds.y2 - blOffset, kind: "cornerRadius", target: "bl" },
    ];
  }
  if (item.type === "circle") {
    return [
      { key: "nw", label: "Top left", x: bounds.x1, y: bounds.y1, kind: "corner", target: "nw" },
      { key: "ne", label: "Top right", x: bounds.x2, y: bounds.y1, kind: "corner", target: "ne" },
      { key: "sw", label: "Bottom left", x: bounds.x1, y: bounds.y2, kind: "corner", target: "sw" },
      { key: "se", label: "Bottom right", x: bounds.x2, y: bounds.y2, kind: "corner", target: "se" },
    ];
  }
  if (item.type === "pen" && Array.isArray(item.points)) {
    if (mode === "curve") {
      const curves = item.curvePoints && typeof item.curvePoints === "object" ? item.curvePoints : {};
      return Object.entries(curves)
        .map(([segmentIndex, point]) => ({ segmentIndex: Number(segmentIndex), point }))
        .filter(({ segmentIndex, point }) =>
          Number.isInteger(segmentIndex) &&
          segmentIndex >= 0 &&
          segmentIndex < item.points.length - 1 &&
          point &&
          typeof point === "object",
        )
        .flatMap(({ segmentIndex, point }) =>
          point.type === "cubic" && point.c1 && point.c2
            ? [
                {
                  key: `pen-cubic-start-${segmentIndex}`,
                  label: `Start curve handle ${segmentIndex + 1}`,
                  x: point.c1.x,
                  y: point.c1.y,
                  kind: "penCubic",
                  target: "c1",
                  index: segmentIndex,
                },
                {
                  key: `pen-cubic-end-${segmentIndex}`,
                  label: `End curve handle ${segmentIndex + 1}`,
                  x: point.c2.x,
                  y: point.c2.y,
                  kind: "penCubic",
                  target: "c2",
                  index: segmentIndex,
                },
              ]
            : [{
                key: `pen-curve-${segmentIndex}`,
                label: `Curve segment ${segmentIndex + 1}`,
                x: point.x,
                y: point.y,
                kind: "penCurve",
                index: segmentIndex,
              }],
        );
    }
    return item.points.map((point, index) => ({
      key: `point-${index}`,
      label: `Point ${index + 1}`,
      x: point.x,
      y: point.y,
      kind: "point",
      index,
    }));
  }
  if (item.type === "freehand" && Array.isArray(item.points) && item.points.length > 1) {
    return [
      { key: "point-start", label: "Start point", x: item.points[0].x, y: item.points[0].y, kind: "point", index: 0 },
      {
        key: "point-end",
        label: "End point",
        x: item.points[item.points.length - 1].x,
        y: item.points[item.points.length - 1].y,
        kind: "point",
        index: item.points.length - 1,
      },
    ];
  }
  return [];
}

function applyHandleDrag(drag, item, point) {
  const handle = drag.handle;
  if (!handle) return item;
  if (handle.kind === "endpoint") {
    return handle.target === "start"
      ? { ...item, x: point.x, y: point.y }
      : { ...item, x2: point.x, y2: point.y };
  }
  if (handle.kind === "corner") {
    const bounds = annotationBounds(drag.item);
    const next = { ...item };
    if (handle.target.includes("w")) next.x = point.x;
    else next.x2 = point.x;
    if (handle.target.includes("n")) next.y = point.y;
    else next.y2 = point.y;
    if (!handle.target.includes("w")) next.x = bounds.x1;
    if (!handle.target.includes("e")) next.x2 = bounds.x2;
    if (!handle.target.includes("n")) next.y = bounds.y1;
    if (!handle.target.includes("s")) next.y2 = bounds.y2;
    return next;
  }
  if (handle.kind === "curve") {
    return { ...item, curvePoint: point };
  }
  if (handle.kind === "penCurve") {
    const curvePoint = drag.deepCurve ? semicirclePenCurveControls(item, handle.index, point) : point;
    return {
      ...item,
      curvePoints: {
        ...(item.curvePoints || {}),
        [handle.index]: curvePoint,
      },
    };
  }
  if (handle.kind === "penCubic") {
    if (drag.deepCurve) {
      return {
        ...item,
        curvePoints: {
          ...(item.curvePoints || {}),
          [handle.index]: semicirclePenCurveControls(item, handle.index, point),
        },
      };
    }
    const current = item.curvePoints?.[handle.index];
    if (!current || current.type !== "cubic") return item;
    return {
      ...item,
      curvePoints: {
        ...(item.curvePoints || {}),
        [handle.index]: {
          ...current,
          [handle.target]: point,
        },
      },
    };
  }
  if (handle.kind === "cornerRadius") {
    const bounds = annotationBounds(drag.item);
    const width = Math.max(1, Math.abs(bounds.x2 - bounds.x1));
    const height = Math.max(1, Math.abs(bounds.y2 - bounds.y1));
    const maxRadius = Math.min(width, height) / 2;
    const current = rectCornerRadii(item, bounds);
    const nextRadius = {
      tl: Math.max(Math.abs(point.x - bounds.x1), Math.abs(point.y - bounds.y1)),
      tr: Math.max(Math.abs(bounds.x2 - point.x), Math.abs(point.y - bounds.y1)),
      br: Math.max(Math.abs(bounds.x2 - point.x), Math.abs(bounds.y2 - point.y)),
      bl: Math.max(Math.abs(point.x - bounds.x1), Math.abs(bounds.y2 - point.y)),
    }[handle.target];
    return {
      ...item,
      cornerRadii: {
        ...current,
        [handle.target]: clamp(nextRadius, 0, maxRadius),
      },
    };
  }
  if (handle.kind === "point" && Array.isArray(item.points)) {
    const points = item.points.map((pointItem, index) => (index === handle.index ? point : pointItem));
    const first = points[0] || item;
    const last = points[points.length - 1] || item;
    return { ...item, points, x: first.x ?? item.x, y: first.y ?? item.y, x2: last.x ?? item.x2, y2: last.y ?? item.y2 };
  }
  return item;
}

function renderAnnotation(item, { selected = false, editing = false, onPointerDown, onDoubleClick } = {}) {
  const style = styleFor(item);
  const stroke = style.strokeColor;
  const strokeWidth = strokeWidthFor(item);
  const common = {
    key: item.id,
    onPointerDown,
    onDoubleClick,
    className: selected ? "cursor-move" : "cursor-pointer",
  };

  if (item.type === "rect") {
    const { x1, y1, x2, y2 } = annotationBounds(item);
    const radii = rectCornerRadii(item, { x1, y1, x2, y2 });
    return (
      <g {...common}>
        <path
          d={roundedRectPath({ x1, y1, x2, y2 }, radii)}
          fill={style.fill}
          fillOpacity={style.svgFillOpacity}
          stroke={stroke}
          strokeOpacity={style.strokeOpacity}
          strokeWidth={strokeWidth}
          strokeDasharray={style.strokeDasharray}
        />
      </g>
    );
  }

  if (item.type === "circle") {
    const { x1, y1, x2, y2 } = annotationBounds(item);
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    return (
      <ellipse
        {...common}
        cx={cx}
        cy={cy}
        rx={Math.max(10, Math.abs(x2 - x1) / 2)}
        ry={Math.max(10, Math.abs(y2 - y1) / 2)}
        fill={style.fill}
        fillOpacity={style.svgFillOpacity}
        stroke={stroke}
        strokeOpacity={style.strokeOpacity}
        strokeWidth={strokeWidth}
        strokeDasharray={style.strokeDasharray}
      />
    );
  }

  if (item.type === "freehand" || item.type === "pen") {
    const points = Array.isArray(item.points) ? item.points : [];
    const d =
      item.type === "pen"
        ? penPathD(item)
        : points
            .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
            .join(" ");
    return (
      <g {...common}>
        {item.type === "pen" ? (
          <path
            d={d}
            fill="none"
            stroke="transparent"
            strokeWidth={Math.max(18, strokeWidth + 10)}
            strokeLinecap="round"
            strokeLinejoin="round"
            pointerEvents="stroke"
          />
        ) : null}
        <path
          d={d}
          fill={item.type === "pen" && item.closed ? style.fill : "none"}
          fillOpacity={item.type === "pen" && item.closed ? style.svgFillOpacity : undefined}
          stroke={stroke}
          strokeOpacity={style.strokeOpacity}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={style.strokeDasharray}
          markerStart={item.startEndpoint === "arrow" ? `url(#${markerIdForColor(stroke)})` : item.startEndpoint === "dot" ? `url(#${dotMarkerIdForColor(stroke)})` : undefined}
          markerEnd={item.endEndpoint === "arrow" ? `url(#${markerIdForColor(stroke)})` : item.endEndpoint === "dot" ? `url(#${dotMarkerIdForColor(stroke)})` : undefined}
        />
      </g>
    );
  }

  if (item.type === "priority") {
    const radius = 26;
    return (
      <g {...common}>
        <circle
          cx={item.x}
          cy={item.y}
          r={radius}
              fill={style.fill}
              fillOpacity={style.svgFillOpacity}
              stroke={stroke}
          strokeOpacity={style.strokeOpacity}
          strokeWidth={strokeWidth}
          strokeDasharray={style.strokeDasharray}
        />
        <text
          x={item.x}
          y={item.y + 7}
          textAnchor="middle"
          fill={stroke}
          fontSize="24"
          fontWeight="700"
        >
          {item.priorityNumber || 1}
        </text>
      </g>
    );
  }

  if (item.type === "line" || item.type === "arrow" || item.type === "measure") {
    const markerStart = item.startEndpoint === "arrow" ? `url(#${markerIdForColor(stroke)})` : item.startEndpoint === "dot" ? `url(#${dotMarkerIdForColor(stroke)})` : undefined;
    const markerEnd =
      item.type === "arrow" || item.endEndpoint === "arrow"
        ? `url(#${markerIdForColor(stroke)})`
        : item.endEndpoint === "dot"
          ? `url(#${dotMarkerIdForColor(stroke)})`
          : undefined;
    const labelPoint = quadraticPoint(item, 0.5);
    const midX = labelPoint.x;
    const midY = labelPoint.y;
    const dx = (item.x2 || 0) - (item.x || 0);
    const dy = (item.y2 || 0) - (item.y || 0);
    const length = Math.hypot(dx, dy) || 1;
    const capX = (-dy / length) * 22;
    const capY = (dx / length) * 22;
    const label = item.text || "measurement";
    const box = labelBox(label, 18);
    const labelX = midX - box.width / 2;
    const labelY = midY - box.height - 10;
    return (
      <g {...common}>
        <path
          d={linePathD(item)}
          fill="none"
          stroke={stroke}
          strokeOpacity={style.strokeOpacity}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          markerStart={markerStart}
          markerEnd={markerEnd}
          strokeDasharray={style.strokeDasharray}
        />
        {item.type === "measure" ? (
          <>
            <line
              x1={(item.x || 0) - capX}
              y1={(item.y || 0) - capY}
              x2={(item.x || 0) + capX}
              y2={(item.y || 0) + capY}
              stroke={stroke}
              strokeOpacity={style.strokeOpacity}
              strokeWidth={strokeWidth}
              strokeLinecap="square"
              strokeDasharray={style.strokeDasharray}
            />
            <line
              x1={(item.x2 || 0) - capX}
              y1={(item.y2 || 0) - capY}
              x2={(item.x2 || 0) + capX}
              y2={(item.y2 || 0) + capY}
              stroke={stroke}
              strokeOpacity={style.strokeOpacity}
              strokeWidth={strokeWidth}
              strokeLinecap="square"
              strokeDasharray={style.strokeDasharray}
            />
          </>
        ) : null}
        {item.type === "measure" && !editing ? (
          <g>
            <rect
              x={midX - box.width / 2}
              y={labelY}
              width={box.width}
              height={box.height}
              rx="8"
              fill="rgba(255,255,255,0.88)"
              stroke={hexToRgba(stroke, 0.52)}
              strokeWidth="1.5"
              filter="url(#label-shadow)"
            />
            <text
              x={labelX + box.paddingX}
              y={labelY + box.paddingY + 16}
              fill="#0f172a"
              fontSize="18"
              fontWeight="600"
            >
              {box.lines.map((line, index) => (
                <tspan key={`${item.id}-line-${index}`} x={labelX + box.paddingX} dy={index === 0 ? 0 : box.lineHeight}>
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        ) : null}
      </g>
    );
  }

  if (["door", "window", "tree", "steps", "fence"].includes(item.type)) {
    const x = item.x || 0;
    const y = item.y || 0;
    if (item.type === "door") {
      return (
        <g {...common}>
          <path d={`M ${x - 26} ${y + 28} L ${x - 26} ${y - 26} L ${x + 28} ${y - 26}`} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
          <path d={`M ${x - 24} ${y + 24} A 54 54 0 0 1 ${x + 28} ${y - 26}`} fill="none" stroke={stroke} strokeWidth={Math.max(2, strokeWidth - 1)} strokeDasharray="7 7" />
        </g>
      );
    }
    if (item.type === "window") {
      return (
        <g {...common}>
          <rect x={x - 32} y={y - 12} width="64" height="24" rx="3" fill="rgba(255,255,255,0.9)" stroke={stroke} strokeWidth={strokeWidth} />
          <line x1={x} y1={y - 12} x2={x} y2={y + 12} stroke={stroke} strokeWidth={Math.max(2, strokeWidth - 1)} />
        </g>
      );
    }
    if (item.type === "tree") {
      return (
        <g {...common}>
          <circle cx={x} cy={y - 8} r="28" fill={hexToRgba(stroke, 0.16)} stroke={stroke} strokeWidth={strokeWidth} />
          <path d={`M ${x} ${y + 20} L ${x} ${y + 36}`} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
        </g>
      );
    }
    if (item.type === "steps") {
      return (
        <g {...common}>
          {[0, 1, 2, 3].map((index) => (
            <rect key={`${item.id}-step-${index}`} x={x - 34 + index * 16} y={y - 24 + index * 12} width="48" height="10" fill="rgba(255,255,255,0.92)" stroke={stroke} strokeWidth={Math.max(2, strokeWidth - 1)} />
          ))}
        </g>
      );
    }
    return (
      <g {...common}>
        <line x1={x - 34} y1={y - 18} x2={x + 34} y2={y - 18} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
        <line x1={x - 34} y1={y + 18} x2={x + 34} y2={y + 18} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
        {[-24, 0, 24].map((offset) => (
          <line key={`${item.id}-post-${offset}`} x1={x + offset} y1={y - 30} x2={x + offset} y2={y + 30} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
        ))}
      </g>
    );
  }

  const label = item.text || "Note";
  const box = labelBox(label, 18);
  const labelX = (item.x || 0) - box.paddingX;
  const labelY = (item.y || 0) - box.height + 7;
  if (editing) {
    return (
      <g
        key={item.id}
        onPointerDown={onPointerDown}
        onDoubleClick={onDoubleClick}
        className={selected ? "cursor-move" : "cursor-pointer"}
      />
    );
  }
  return (
    <g {...common}>
      <rect
        x={labelX}
        y={labelY}
        width={box.width}
        height={box.height}
        rx="8"
        fill="rgba(255,255,255,0.88)"
        stroke={hexToRgba(stroke, 0.52)}
        strokeWidth="1.5"
        strokeDasharray={style.strokeDasharray}
        filter="url(#label-shadow)"
      />
      <text
        x={labelX + box.paddingX}
        y={labelY + box.paddingY + 16}
        fill="#0f172a"
        fontSize="18"
        fontWeight="600"
      >
        {box.lines.map((line, index) => (
          <tspan key={`${item.id}-line-${index}`} x={labelX + box.paddingX} dy={index === 0 ? 0 : box.lineHeight}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function CollapsibleSection({
  id,
  title,
  open,
  pinned,
  onToggle,
  onPin,
  count = null,
  danger = false,
  children,
}) {
  return (
    <section className={`rounded-2xl border bg-white shadow-sm ${danger ? "border-rose-100" : "border-slate-200"}`}>
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => onToggle(id)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={open}
        >
          <SymbolIcon
            name={open ? "expand_more" : "chevron_right"}
            className="text-[18px] text-slate-400"
          />
          <span className={`truncate text-sm font-semibold ${danger ? "text-slate-950" : "text-slate-950"}`}>
            {title}
          </span>
          {count != null ? (
            <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
              {count}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onPin(id);
          }}
          className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition ${
            pinned ? "bg-slate-950 text-white" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          }`}
          aria-label={pinned ? `Unpin ${title}` : `Pin ${title}`}
          title={pinned ? "Unpin section" : "Pin section open"}
        >
          <SymbolIcon name="keep" className="text-[18px]" />
        </button>
      </div>
      {open ? <div className="border-t border-slate-100 p-4">{children}</div> : null}
    </section>
  );
}

function ToolIcon({ item, className = "" }) {
  if (["pen", "pen_add", "pen_remove"].includes(item?.key)) {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={className || "h-5 w-5"}
        fill="none"
      >
        <path
          d="M12 3.2 5.6 9.6l1.7 9.2L12 21l4.7-2.2 1.7-9.2L12 3.2Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M12 3.2v9.1"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <circle cx="12" cy="13.2" r="1.7" fill="currentColor" />
        {item.key === "pen_add" ? (
          <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18.2 2.6V8" />
            <path d="M15.5 5.3h5.4" />
          </g>
        ) : null}
        {item.key === "pen_remove" ? (
          <path d="M15.5 5.3h5.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        ) : null}
      </svg>
    );
  }
  if (item?.key === "curve") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={className || "h-5 w-5"}
        fill="none"
      >
        <circle cx="12" cy="16.5" r="2.15" fill="currentColor" />
        <path
          d="M6.5 14.5A8.5 8.5 0 0 1 18.8 7"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return <SymbolIcon name={item.icon} className={className} />;
}

export default function ProjectMarkupCanvas() {
  const { planId, projectId, imageId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const svgRef = useRef(null);
  const fileRef = useRef(null);
  const sketchFileRef = useRef(null);
  const textureFileRef = useRef(null);
  const sidebarTextRef = useRef(null);
  const modeRequestHandledRef = useRef(false);
  const [plan, setPlan] = useState(null);
  const [projectImage, setProjectImage] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(Boolean(planId || projectId));
  const [backgroundUrl, setBackgroundUrl] = useState("");
  const [annotations, setAnnotations] = useState([]);
  const [tool, setTool] = useState("select");
  const [canvasMode, setCanvasMode] = useState("photo");
  const [activeColor, setActiveColor] = useState(DEFAULT_MARKUP_COLOR);
  const [activeFillColor, setActiveFillColor] = useState(DEFAULT_MARKUP_COLOR);
  const [activeFillMaterial, setActiveFillMaterial] = useState("flat");
  const [fillTextureLibrary, setFillTextureLibrary] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(TEXTURE_LIBRARY_STORAGE_KEY) || "[]");
      return Array.isArray(saved) ? saved.filter((item) => item?.key?.startsWith("custom-") && item.svg) : [];
    } catch {
      return [];
    }
  });
  const [activeStrokeWidth, setActiveStrokeWidth] = useState(DEFAULT_STROKE_WIDTH);
  const [activeStrokeOpacity, setActiveStrokeOpacity] = useState(DEFAULT_STROKE_OPACITY);
  const [activeFillOpacity, setActiveFillOpacity] = useState(DEFAULT_FILL_OPACITY);
  const [roughPlan, setRoughPlan] = useState(ROUGH_PLAN_DEFAULTS);
  const [expanded, setExpanded] = useState(false);
  const [visibleLayers, setVisibleLayers] = useState({});
  const [draggingLayerId, setDraggingLayerId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState(null);
  const [penDraftId, setPenDraftId] = useState("");
  const [drag, setDrag] = useState(null);
  const [viewportZoom, setViewportZoom] = useState(1);
  const [viewportOrigin, setViewportOrigin] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [savingEditable, setSavingEditable] = useState(false);
  const [sketchBusy, setSketchBusy] = useState(false);
  const [sketchStatus, setSketchStatus] = useState({ phase: "idle", progress: 0, fileName: "" });
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState({ past: [], future: [] });
  const [editingTextId, setEditingTextId] = useState("");
  const [focusedSidebarInputId, setFocusedSidebarInputId] = useState("");
  const [openSidebarSection, setOpenSidebarSection] = useState("mode");
  const [pinnedSidebarSections, setPinnedSidebarSections] = useState(() => new Set());

  const isProjectImageMode = Boolean(projectId && imageId);
  const storageKey = `${STORAGE_PREFIX}:${planId ? `plan:${planId}` : isProjectImageMode ? `project:${projectId}:${imageId}` : "standalone"}`;
  const selectedImageId = useMemo(() => new URLSearchParams(location.search).get("image") || "", [location.search]);
  const requestedCanvasMode = useMemo(() => new URLSearchParams(location.search).get("mode") || "", [location.search]);
  const sketchUploadRequested = useMemo(() => new URLSearchParams(location.search).get("sketch") === "1", [location.search]);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || "{}");
      if (saved.backgroundUrl) setBackgroundUrl(saved.backgroundUrl);
      if (Array.isArray(saved.annotations)) setAnnotations(saved.annotations);
      if (saved.canvasMode === "rough_plan" || saved.canvasMode === "photo") setCanvasMode(saved.canvasMode);
      if (saved.roughPlan && typeof saved.roughPlan === "object") {
        setRoughPlan((prev) => ({ ...prev, ...saved.roughPlan }));
      }
      if (saved.activeStrokeWidth) setActiveStrokeWidth(clamp(Number(saved.activeStrokeWidth) || DEFAULT_STROKE_WIDTH, 1, 18));
      if (saved.activeColor) setActiveColor(saved.activeColor);
      if (saved.activeFillColor) setActiveFillColor(saved.activeFillColor);
      if (isFillMaterialKey(saved.activeFillMaterial)) setActiveFillMaterial(saved.activeFillMaterial);
      if (saved.activeStrokeOpacity != null) setActiveStrokeOpacity(clamp(Number(saved.activeStrokeOpacity), 0, 1));
      if (saved.activeFillOpacity != null) setActiveFillOpacity(clamp(Number(saved.activeFillOpacity), 0, 1));
      if (saved.visibleLayers && typeof saved.visibleLayers === "object") setVisibleLayers(saved.visibleLayers);
    } catch {
      // Ignore broken session drafts.
    }
  }, [storageKey]);

  useEffect(() => {
    sessionStorage.setItem(
      storageKey,
      JSON.stringify({ backgroundUrl, annotations, canvasMode, roughPlan, activeColor, activeFillColor, activeFillMaterial, activeStrokeWidth, activeStrokeOpacity, activeFillOpacity, visibleLayers }),
    );
  }, [activeColor, activeFillColor, activeFillMaterial, activeFillOpacity, activeStrokeOpacity, activeStrokeWidth, annotations, backgroundUrl, canvasMode, roughPlan, storageKey, visibleLayers]);

  useEffect(() => {
    localStorage.setItem(TEXTURE_LIBRARY_STORAGE_KEY, JSON.stringify(fillTextureLibrary));
  }, [fillTextureLibrary]);

  useEffect(() => {
    if (!planId) return;
    let alive = true;
    setLoadingPlan(true);
    api
      .get(`/project-plans/${planId}/`)
      .then(({ data }) => {
        if (!alive) return;
        setPlan(data);
        const markup = safeMarkupData(data?.markup_data);
        const selectedImage = selectedImageId
          ? (data?.images || []).find((image) => String(image.id) === String(selectedImageId))
          : null;
        const selectedImageVersion =
          selectedImage && Array.isArray(markup.versions)
            ? markup.versions.find((version) => {
                if (version.source_image_id && String(version.source_image_id) === String(selectedImage.id)) return true;
                return version.background_url && version.background_url === selectedImage.image_url;
              })
            : null;

        if (selectedImageVersion) {
          setAnnotations(Array.isArray(selectedImageVersion.annotations) ? selectedImageVersion.annotations : []);
          setBackgroundUrl(selectedImageVersion.background_url || selectedImage.image_url || "");
          setCanvasMode(selectedImageVersion.version_type === "rough_plan" ? "rough_plan" : "photo");
          if (selectedImageVersion.rough_plan && typeof selectedImageVersion.rough_plan === "object") {
            setRoughPlan((prev) => ({ ...prev, ...selectedImageVersion.rough_plan }));
          }
          if (selectedImageVersion.visible_layers && typeof selectedImageVersion.visible_layers === "object") {
            setVisibleLayers((prev) => ({ ...prev, ...selectedImageVersion.visible_layers }));
          }
        } else if (selectedImage) {
          setAnnotations([]);
          setBackgroundUrl(selectedImage.image_url || "");
          setCanvasMode("photo");
        } else {
          if (Array.isArray(markup.annotations)) setAnnotations(markup.annotations);
          if (markup.background_url) setBackgroundUrl(markup.background_url);
          if (markup.canvas_mode === "rough_plan" || markup.version_type === "rough_plan") setCanvasMode("rough_plan");
          if (markup.rough_plan && typeof markup.rough_plan === "object") {
            setRoughPlan((prev) => ({ ...prev, ...markup.rough_plan }));
          }
          if (markup.visible_layers && typeof markup.visible_layers === "object") {
            setVisibleLayers((prev) => ({ ...prev, ...markup.visible_layers }));
          }
        }
      })
      .catch((err) => {
        if (alive) setMessage(normalizeError(err, "Could not load this project plan."));
      })
      .finally(() => {
        if (alive) setLoadingPlan(false);
      });
    return () => {
      alive = false;
    };
  }, [planId, selectedImageId]);

  useEffect(() => {
    if (!isProjectImageMode) return;
    let alive = true;
    setLoadingPlan(true);
    api
      .get(`/projects/${projectId}/images/`)
      .then(({ data }) => {
        if (!alive) return;
        const image = (Array.isArray(data) ? data : []).find((item) => String(item.id) === String(imageId));
        if (!image) {
          setMessage("Could not find this project image.");
          setProjectImage(null);
          return;
        }

        setProjectImage(image);
        const url = image.url || image.image || image.image_url || image.file || "";
        const markupVersion = image.extra_data?.markup_version;
        if (markupVersion && typeof markupVersion === "object") {
          setAnnotations(Array.isArray(markupVersion.annotations) ? markupVersion.annotations : []);
          setBackgroundUrl(markupVersion.background_url || url || "");
          setCanvasMode(markupVersion.version_type === "rough_plan" ? "rough_plan" : "photo");
          if (markupVersion.rough_plan && typeof markupVersion.rough_plan === "object") {
            setRoughPlan((prev) => ({ ...prev, ...markupVersion.rough_plan }));
          }
          if (markupVersion.visible_layers && typeof markupVersion.visible_layers === "object") {
            setVisibleLayers((prev) => ({ ...prev, ...markupVersion.visible_layers }));
          }
        } else {
          setAnnotations([]);
          setBackgroundUrl(url || "");
          setCanvasMode("photo");
        }
      })
      .catch((err) => {
        if (alive) setMessage(normalizeError(err, "Could not load this project image."));
      })
      .finally(() => {
        if (alive) setLoadingPlan(false);
      });
    return () => {
      alive = false;
    };
  }, [imageId, isProjectImageMode, projectId]);

  useEffect(() => {
    if (loadingPlan || requestedCanvasMode !== "rough_plan" || modeRequestHandledRef.current) return;
    modeRequestHandledRef.current = true;
    setCanvasMode("rough_plan");
    setBackgroundUrl("");
    setOpenSidebarSection("mode");
    if (sketchUploadRequested) {
      setAnnotations([]);
      setSelectedId("");
      setEditingTextId("");
      setMessage("Upload a sketch in the Create from sketch panel. AI will create an editable rough plan for review.");
    }
  }, [loadingPlan, requestedCanvasMode, sketchUploadRequested]);

  const selected = useMemo(
    () => annotations.find((item) => item.id === selectedId) || null,
    [annotations, selectedId],
  );

  useEffect(() => {
    if (selected?.type === "text" || selected?.type === "measure") {
      setOpenSidebarSection("annotations");
      const frame = requestAnimationFrame(() => {
        sidebarTextRef.current?.focus();
        const length = sidebarTextRef.current?.value?.length ?? 0;
        sidebarTextRef.current?.setSelectionRange(length, length);
        setFocusedSidebarInputId(selected.id);
      });
      return () => cancelAnimationFrame(frame);
    }
    setFocusedSidebarInputId("");
    return undefined;
  }, [selected?.id, selected?.type]);

  useEffect(() => {
    if (!penDraftId) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finishPenPath({ exitTool: true });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [penDraftId]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const target = event.target;
      const isTextInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;
      const modifier = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (modifier && key === "z" && !isTextInput) {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (modifier && key === "y" && !isTextInput) {
        event.preventDefault();
        redo();
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedId && !isTextInput) {
        event.preventDefault();
        deleteSelected();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [history, annotations, selectedId]);

  const isRoughPlan = canvasMode === "rough_plan";
  const modeLabel = isRoughPlan ? "Rough Plan" : "Photo Markup";
  const roughGeometry = useMemo(() => roughPlanGeometry(roughPlan), [roughPlan]);
  const viewport = useMemo(() => {
    const zoom = clamp(viewportZoom, 1, 4);
    const width = CANVAS_W / zoom;
    const height = CANVAS_H / zoom;
    return {
      x: clamp(viewportOrigin.x, 0, Math.max(0, CANVAS_W - width)),
      y: clamp(viewportOrigin.y, 0, Math.max(0, CANVAS_H - height)),
      width,
      height,
      zoom,
    };
  }, [viewportOrigin.x, viewportOrigin.y, viewportZoom]);
  const selectedColorMeta = MARKUP_COLORS.find((item) => item.color === activeColor) || MARKUP_COLORS[0];
  const toolGroups = useMemo(
    () => [
      { key: "select", tools: [BASE_TOOLS.select, BASE_TOOLS.curve] },
      { key: "view", tools: [BASE_TOOLS.hand, BASE_TOOLS.zoomIn, BASE_TOOLS.zoomOut] },
      { key: "text", tools: [BASE_TOOLS.text] },
      { key: "draw", tools: [BASE_TOOLS.freehand, BASE_TOOLS.pen, BASE_TOOLS.penAdd, BASE_TOOLS.penRemove] },
      { key: "geometry", tools: [BASE_TOOLS.rect, BASE_TOOLS.circle, BASE_TOOLS.arrow, BASE_TOOLS.line, BASE_TOOLS.measure] },
      ...(isRoughPlan ? [{ key: "symbols", tools: SYMBOL_TOOLS }] : []),
      { key: "delete", tools: [BASE_TOOLS.delete] },
    ],
    [isRoughPlan],
  );
  const markerColors = useMemo(
    () => Array.from(new Set([...MARKUP_COLORS.map((item) => item.color), ...annotations.map((item) => styleFor(item).strokeColor)])),
    [annotations],
  );

  const savedVersions = useMemo(() => {
    const markup = safeMarkupData(plan?.markup_data);
    return Array.isArray(markup.versions) ? markup.versions : [];
  }, [plan]);

  function makeMarkupPayload(previousMarkup = {}, versionOverrides = {}) {
    const now = new Date().toISOString();
    const background_url = isPersistableUrl(backgroundUrl) ? backgroundUrl : "";
    const existingVersions = Array.isArray(previousMarkup.versions)
      ? previousMarkup.versions
      : [];
    const sourceImage = (plan?.images || []).find((image) => image.image_url && image.image_url === background_url);
    const nextVersionNumber = existingVersions.length + 1;
    const normalizedAnnotations = annotations.map((item) => ({
      ...item,
      layer: item.id,
      text: item.type === "text" || item.type === "measure" ? normalizeMarkupText(item.text) : item.text,
    }));
    const version = {
      id: `version-${Date.now()}`,
      name: versionOverrides.name || `${modeLabel} ${nextVersionNumber}`,
      version_type: isRoughPlan ? "rough_plan" : "photo_markup",
      type_label: modeLabel,
      created_at: now,
      background_url: isRoughPlan ? "" : background_url,
      source_image_id: sourceImage?.id || null,
      snapshot_url: versionOverrides.snapshot_url || "",
      snapshot_image_id: versionOverrides.snapshot_image_id || null,
      annotations: normalizedAnnotations,
      rough_plan: isRoughPlan ? roughPlan : undefined,
      visible_layers: visibleLayers,
      annotation_count: normalizedAnnotations.length,
    };

    return {
      schema_version: 1,
      canvas: { width: CANVAS_W, height: CANVAS_H },
      canvas_mode: canvasMode,
      version_type: isRoughPlan ? "rough_plan" : "photo_markup",
      rough_plan: isRoughPlan ? roughPlan : undefined,
      background_url: isRoughPlan ? "" : background_url,
      annotations: normalizedAnnotations,
      visible_layers: visibleLayers,
      updated_at: now,
      versions: [version, ...existingVersions].slice(0, 8),
    };
  }

  function updateSelected(patch) {
    if (!selectedId) return;
    setAnnotations((prev) =>
      prev.map((item) => (item.id === selectedId ? { ...item, ...patch } : item)),
    );
  }

  function toggleAnnotationLayerVisibility(annotationId) {
    setVisibleLayers((prev) => ({ ...prev, [annotationId]: prev[annotationId] === false }));
  }

  function moveAnnotationLayer(annotationId, direction) {
    setAnnotations((prev) => {
      const index = prev.findIndex((item) => item.id === annotationId);
      if (index < 0) return prev;
      const nextIndex = direction === "up" ? index + 1 : index - 1;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function moveAnnotationLayerTo(annotationId, targetId) {
    if (!annotationId || !targetId || annotationId === targetId) return;
    setAnnotations((prev) => {
      const draggedIndex = prev.findIndex((item) => item.id === annotationId);
      const targetIndex = prev.findIndex((item) => item.id === targetId);
      if (draggedIndex < 0 || targetIndex < 0) return prev;
      const next = [...prev];
      const [dragged] = next.splice(draggedIndex, 1);
      const targetIndexAfterRemoval = next.findIndex((item) => item.id === targetId);
      next.splice(targetIndexAfterRemoval + 1, 0, dragged);
      return next;
    });
  }

  async function patchMarkupData(nextMarkup, successMessage = "") {
    if (!planId) return null;
    const { data } = await api.patch(`/project-plans/${planId}/`, {
      markup_data: nextMarkup,
    });
    setPlan(data);
    if (successMessage) setMessage(successMessage);
    return data;
  }

  function commitAnnotations(nextAnnotations) {
    setHistory((prev) => ({ past: [...prev.past, annotations].slice(-30), future: [] }));
    setAnnotations(nextAnnotations);
  }

  function undo() {
    setHistory((prev) => {
      if (!prev.past.length) return prev;
      const previous = prev.past[prev.past.length - 1];
      setAnnotations(previous);
      setSelectedId("");
      return {
        past: prev.past.slice(0, -1),
        future: [annotations, ...prev.future].slice(0, 30),
      };
    });
  }

  function redo() {
    setHistory((prev) => {
      if (!prev.future.length) return prev;
      const next = prev.future[0];
      setAnnotations(next);
      setSelectedId("");
      return {
        past: [...prev.past, annotations].slice(-30),
        future: prev.future.slice(1),
      };
    });
  }

  function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setBackgroundUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return url;
    });
    event.target.value = "";
  }

  async function handleSketchPlanUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!planId) {
      setSketchStatus({ phase: "error", progress: 0, fileName: file.name || "" });
      setMessage("Open this from a saved project planner before creating a plan from a sketch.");
      return;
    }
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setSketchStatus({ phase: "error", progress: 0, fileName: file.name || "" });
      setMessage("Upload a JPG, PNG, or WebP sketch.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setSketchStatus({ phase: "error", progress: 0, fileName: file.name || "" });
      setMessage("Sketch images must be 15MB or smaller.");
      return;
    }
    if (annotations.length && !window.confirm("Replace the current canvas with an AI rough plan from this sketch? Save first if you need this version.")) {
      return;
    }

    setSketchBusy(true);
    setSketchStatus({ phase: "uploading", progress: 0, fileName: file.name || "Sketch image" });
    setMessage("");
    try {
      const formData = new FormData();
      formData.append("sketch", file);
      formData.append("width", roughPlan.width || "20");
      formData.append("length", roughPlan.length || "30");
      formData.append("unit", roughPlan.unit || "ft");
      const { data } = await api.post(`/project-plans/${planId}/sketch-to-rough-plan/`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          const total = progressEvent.total || file.size || 0;
          const progress = total ? Math.min(100, Math.round((progressEvent.loaded / total) * 100)) : 0;
          setSketchStatus({
            phase: progress >= 100 ? "analyzing" : "uploading",
            progress,
            fileName: file.name || "Sketch image",
          });
        },
      });
      setSketchStatus({ phase: "drafting", progress: 100, fileName: file.name || "Sketch image" });
      setCanvasMode("rough_plan");
      setBackgroundUrl("");
      setRoughPlan((prev) => ({ ...prev, ...(data.rough_plan || {}), snap: data.rough_plan?.snap ?? true }));
      commitAnnotations(Array.isArray(data.annotations) ? data.annotations : []);
      setSelectedId("");
      setEditingTextId("");
      setOpenSidebarSection("annotations");
      const notes = Array.isArray(data.uncertainty_notes) && data.uncertainty_notes.length
        ? ` Review note: ${data.uncertainty_notes.slice(0, 2).join(" ")}`
        : "";
      setSketchStatus({ phase: "ready", progress: 100, fileName: file.name || "Sketch image" });
      setMessage(`AI rough plan created. Review and edit it before saving.${notes}`);
    } catch (err) {
      setSketchStatus((prev) => ({ phase: "error", progress: prev.progress || 0, fileName: file.name || "Sketch image" }));
      setMessage(normalizeError(err, "Could not create a rough plan from this sketch."));
    } finally {
      setSketchBusy(false);
    }
  }

  function sanitizeTextureSvg(svgText) {
    const parsed = new DOMParser().parseFromString(svgText, "image/svg+xml");
    const svg = parsed.querySelector("svg");
    if (!svg || parsed.querySelector("parsererror")) return "";
    svg.querySelectorAll("script, foreignObject, iframe, object, embed").forEach((node) => node.remove());
    svg.querySelectorAll("*").forEach((node) => {
      Array.from(node.attributes).forEach((attr) => {
        const name = attr.name.toLowerCase();
        const value = String(attr.value || "").trim().toLowerCase();
        if (name.startsWith("on") || value.startsWith("javascript:")) node.removeAttribute(attr.name);
      });
    });
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    return new XMLSerializer().serializeToString(svg);
  }

  function handleTextureUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.type && file.type !== "image/svg+xml" && !file.name.toLowerCase().endsWith(".svg")) {
      setMessage("Upload an SVG texture file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const svg = sanitizeTextureSvg(String(reader.result || ""));
      if (!svg) {
        setMessage("Could not read that SVG texture.");
        return;
      }
      const id = `custom-${Date.now()}`;
      const label = file.name.replace(/\.svg$/i, "").slice(0, 32) || "Custom texture";
      const nextTexture = { key: id, label, svg, visibility: "private", publishRequested: false };
      setFillTextureLibrary((prev) => [...prev, nextTexture]);
      changeFillMaterial(id);
      setMessage("Texture added to your fill texture library.");
    };
    reader.readAsText(file);
  }

  function canvasPointFromEvent(event) {
    const point = pointFromEvent(event, svgRef.current, viewport);
    return softSnapPoint(point, isRoughPlan && roughPlan.snap, roughGeometry);
  }

  function zoomViewport(direction) {
    const factor = direction === "in" ? 1.25 : 0.8;
    setViewportZoom((prevZoom) => {
      const nextZoom = clamp(prevZoom * factor, 1, 4);
      const currentWidth = CANVAS_W / prevZoom;
      const currentHeight = CANVAS_H / prevZoom;
      const centerX = viewportOrigin.x + currentWidth / 2;
      const centerY = viewportOrigin.y + currentHeight / 2;
      const nextWidth = CANVAS_W / nextZoom;
      const nextHeight = CANVAS_H / nextZoom;
      setViewportOrigin({
        x: clamp(centerX - nextWidth / 2, 0, Math.max(0, CANVAS_W - nextWidth)),
        y: clamp(centerY - nextHeight / 2, 0, Math.max(0, CANVAS_H - nextHeight)),
      });
      return nextZoom;
    });
  }

  function handleToolSelect(toolKey) {
    if (toolKey === "zoom_in") {
      zoomViewport("in");
      return;
    }
    if (toolKey === "zoom_out") {
      zoomViewport("out");
      return;
    }
    selectTool(toolKey);
  }

  function switchCanvasMode(nextMode) {
    if (nextMode === canvasMode) return;
    if (annotations.length && !window.confirm("Switch modes and clear the current unsaved annotations? Save first if you need this version.")) {
      return;
    }
    commitAnnotations([]);
    setSelectedId("");
    setEditingTextId("");
    setCanvasMode(nextMode);
    setTool("select");
    if (nextMode === "rough_plan") setBackgroundUrl("");
  }

  function finishPenPath({ exitTool = false, closed = false } = {}) {
    if (!penDraftId) return;
    setAnnotations((prev) =>
      prev.map((item) => {
        if (item.id !== penDraftId || !Array.isArray(item.points)) return item;
        const last = item.points[item.points.length - 1];
        const beforeLast = item.points[item.points.length - 2];
        const hasPreviewPoint =
          item.points.length > 1 &&
          last &&
          beforeLast &&
          last.x === beforeLast.x &&
          last.y === beforeLast.y;
        const points = hasPreviewPoint ? item.points.slice(0, -1) : item.points;
        const finalPoint = points[points.length - 1] || item;
        const canClose = closed && points.length >= 3;
        return {
          ...item,
          points,
          closed: canClose,
          fillOpacity: canClose ? activeFillOpacity : 0,
          x2: canClose ? points[0]?.x ?? item.x2 : finalPoint.x ?? item.x2,
          y2: canClose ? points[0]?.y ?? item.y2 : finalPoint.y ?? item.y2,
        };
      }),
    );
    setDraft(null);
    setPenDraftId("");
    if (exitTool) setTool("select");
  }

  function finishPenPathFromDoubleClick(event) {
    if (!penDraftId || tool !== "pen" || !svgRef.current) return;
    const point = canvasPointFromEvent(event);
    const currentPen = annotations.find((item) => item.id === penDraftId);
    const fixedPoints = Array.isArray(currentPen?.points) && currentPen.points.length
      ? currentPen.points.slice(0, -1)
      : [];
    const lastFixedPoint = fixedPoints[fixedPoints.length - 1];
    const firstFixedPoint = fixedPoints[0];
    if (firstFixedPoint && fixedPoints.length >= 3 && distanceBetween(point, firstFixedPoint) <= 18) {
      event.preventDefault();
      finishPenPath({ exitTool: true, closed: true });
      return;
    }
    if (lastFixedPoint && fixedPoints.length >= 3 && distanceBetween(point, lastFixedPoint) <= 18) {
      event.preventDefault();
      finishPenPath({ exitTool: true, closed: true });
    }
  }

  function selectTool(nextTool) {
    if (nextTool !== "pen") finishPenPath();
    setTool(nextTool);
  }

  function continuePenFromExisting(event, item) {
    event.stopPropagation();
    if (!svgRef.current || item.type !== "pen") return;
    const point = canvasPointFromEvent(event);
    const hit = nearestPenHit(item, point);
    if (!hit) return;
    finishPenPath();

    if (hit.type === "segment") {
      if (event.detail < 2) {
        setSelectedId(item.id);
        setEditingTextId("");
        return;
      }
      setHistory((prev) => ({ past: [...prev.past, annotations].slice(-30), future: [] }));
      setAnnotations((prev) =>
        prev.map((current) =>
          current.id === item.id && Array.isArray(current.points)
            ? {
                ...current,
                points: [
                  ...current.points.slice(0, hit.index + 1),
                  point,
                  ...current.points.slice(hit.index + 1),
                ],
                curvePoints: remapCurvePointsForInsert(current.curvePoints, hit.index),
                closed: false,
                fillOpacity: 0,
              }
            : current,
        ),
      );
      setSelectedId(item.id);
      return;
    }

    const points = Array.isArray(item.points) ? item.points : [];
    const clickedPoint = points[hit.index];
    if (!clickedPoint) return;
    const isEndpoint = hit.index === 0 || hit.index === points.length - 1;

    if (isEndpoint) {
      const orientedPoints = hit.index === 0 ? [...points].reverse() : [...points];
      const draftPoints = [...orientedPoints, clickedPoint];
      const nextCurvePoints = hit.index === 0 ? remapCurvePointsForReverse(item.curvePoints, points.length) : item.curvePoints || {};
      setHistory((prev) => ({ past: [...prev.past, annotations].slice(-30), future: [] }));
      setAnnotations((prev) =>
        prev.map((current) =>
          current.id === item.id
            ? {
                ...current,
                points: draftPoints,
                curvePoints: nextCurvePoints,
                closed: false,
                fillOpacity: 0,
                x: draftPoints[0].x,
                y: draftPoints[0].y,
                x2: clickedPoint.x,
                y2: clickedPoint.y,
              }
            : current,
        ),
      );
      setSelectedId("");
      setPenDraftId(item.id);
      setDraft(null);
      setTool("pen");
      return;
    }

    const id = `mark-${Date.now()}`;
    const next = {
      ...item,
      id,
      x: clickedPoint.x,
      y: clickedPoint.y,
      x2: clickedPoint.x,
      y2: clickedPoint.y,
      points: [clickedPoint, clickedPoint],
      curvePoints: {},
      closed: false,
      fillOpacity: 0,
    };
    commitAnnotations([...annotations, next]);
    setSelectedId("");
    setPenDraftId(id);
    setDraft(null);
    setTool("pen");
  }

  function continuePenFromNode(event, item, nodeIndex) {
    event.stopPropagation();
    if (!item || item.type !== "pen" || !Array.isArray(item.points)) return;
    const clickedPoint = item.points[nodeIndex];
    if (!clickedPoint) return;
    finishPenPath();
    const isEndpoint = nodeIndex === 0 || nodeIndex === item.points.length - 1;
    if (!isEndpoint && event.detail < 2) {
      setSelectedId(item.id);
      return;
    }
    if (isEndpoint) {
      const orientedPoints = nodeIndex === 0 ? [...item.points].reverse() : [...item.points];
      const draftPoints = [...orientedPoints, clickedPoint];
      const nextCurvePoints = nodeIndex === 0 ? remapCurvePointsForReverse(item.curvePoints, item.points.length) : item.curvePoints || {};
      setHistory((prev) => ({ past: [...prev.past, annotations].slice(-30), future: [] }));
      setAnnotations((prev) =>
        prev.map((current) =>
          current.id === item.id
            ? { ...current, points: draftPoints, curvePoints: nextCurvePoints, closed: false, fillOpacity: 0, x: draftPoints[0].x, y: draftPoints[0].y, x2: clickedPoint.x, y2: clickedPoint.y }
            : current,
        ),
      );
      setSelectedId("");
      setPenDraftId(item.id);
      setDraft(null);
      setTool("pen");
      return;
    }
    const id = `mark-${Date.now()}`;
    commitAnnotations([
      ...annotations,
      { ...item, id, x: clickedPoint.x, y: clickedPoint.y, x2: clickedPoint.x, y2: clickedPoint.y, points: [clickedPoint, clickedPoint], curvePoints: {}, closed: false, fillOpacity: 0 },
    ]);
    setSelectedId("");
    setPenDraftId(id);
    setDraft(null);
    setTool("pen");
  }

  function addPenNode(event, item) {
    event.stopPropagation();
    if (!svgRef.current || item.type !== "pen" || !Array.isArray(item.points)) return;
    const point = canvasPointFromEvent(event);
    const hit = nearestPenHit(item, point);
    finishPenPath();
    setTool("pen_add");
    setSelectedId(item.id);
    setEditingTextId("");
    if (hit?.type !== "segment") return;
    setHistory((prev) => ({ past: [...prev.past, annotations].slice(-30), future: [] }));
    setAnnotations((prev) =>
      prev.map((current) =>
        current.id === item.id && Array.isArray(current.points)
          ? {
              ...current,
              points: [
                ...current.points.slice(0, hit.index + 1),
                point,
                ...current.points.slice(hit.index + 1),
              ],
              curvePoints: remapCurvePointsForInsert(current.curvePoints, hit.index),
            }
          : current,
      ),
    );
  }

  function removePenNode(event, item, nodeIndex = null) {
    event.stopPropagation();
    if (!item || item.type !== "pen" || !Array.isArray(item.points)) return;
    const point = svgRef.current && nodeIndex == null ? canvasPointFromEvent(event) : null;
    const hit = nodeIndex == null && point ? nearestPenHit(item, point, 22) : null;
    const index = nodeIndex ?? (hit?.type === "node" ? hit.index : null);
    if (index == null) {
      setTool("pen_remove");
      setSelectedId(item.id);
      setEditingTextId("");
      return;
    }
    const minPoints = item.closed ? 3 : 2;
    if (item.points.length <= minPoints) return;
    finishPenPath();
    setTool("pen_remove");
    setSelectedId(item.id);
    setEditingTextId("");
    setHistory((prev) => ({ past: [...prev.past, annotations].slice(-30), future: [] }));
    setAnnotations((prev) =>
      prev.map((current) => {
        if (current.id !== item.id || !Array.isArray(current.points)) return current;
        const points = current.points.filter((_, pointIndex) => pointIndex !== index);
        const first = points[0] || current;
        const last = points[points.length - 1] || current;
        return {
          ...current,
          points,
          curvePoints: remapCurvePointsForRemove(current.curvePoints, index),
          closed: current.closed && points.length >= 3,
          x: first.x ?? current.x,
          y: first.y ?? current.y,
          x2: current.closed && points.length >= 3 ? first.x ?? current.x2 : last.x ?? current.x2,
          y2: current.closed && points.length >= 3 ? first.y ?? current.y2 : last.y ?? current.y2,
        };
      }),
    );
  }

  function startDrawing(event) {
    if (!svgRef.current) return;
    svgRef.current.setPointerCapture?.(event.pointerId);
    const point = canvasPointFromEvent(event);
    setMessage("");

    if (tool === "hand") {
      finishPenPath();
      setDrag({
        mode: "pan",
        startClientX: event.clientX,
        startClientY: event.clientY,
        viewport,
      });
      return;
    }

    if (tool === "delete") {
      deleteSelected();
      return;
    }

    if (tool === "select") {
      finishPenPath();
      setSelectedId("");
      setEditingTextId("");
      return;
    }

    if (tool === "curve") {
      finishPenPath();
      setSelectedId("");
      setEditingTextId("");
      return;
    }

    if (tool === "pen_add" || tool === "pen_remove") {
      finishPenPath();
      setSelectedId("");
      setEditingTextId("");
      return;
    }

    if (tool === "pen") {
      if (penDraftId) {
        const currentPen = annotations.find((item) => item.id === penDraftId);
        const fixedPoints = Array.isArray(currentPen?.points) && currentPen.points.length
          ? currentPen.points.slice(0, -1)
          : [];
        const lastFixedPoint = fixedPoints[fixedPoints.length - 1];
        const firstFixedPoint = fixedPoints[0];
        const nextPoint = event.shiftKey && lastFixedPoint ? constrainOrthogonalPoint(lastFixedPoint, point) : point;
        if (
          event.detail >= 2 &&
          fixedPoints.length >= 3 &&
          ((firstFixedPoint && distanceBetween(point, firstFixedPoint) <= 18) ||
            (lastFixedPoint && distanceBetween(point, lastFixedPoint) <= 18))
        ) {
          event.preventDefault();
          finishPenPath({ exitTool: true, closed: true });
          return;
        }
        setAnnotations((prev) =>
          prev.map((item) => {
            if (item.id !== penDraftId || !Array.isArray(item.points)) return item;
            return {
              ...item,
              points: [...fixedPoints, nextPoint, nextPoint],
              closed: false,
              x2: nextPoint.x,
              y2: nextPoint.y,
            };
          }),
        );
        setDraft(null);
        return;
      }
    }

    const id = `mark-${Date.now()}`;
    const nextPriorityNumber =
      annotations.filter((item) => item.type === "priority").length + 1;
    const base = {
      id,
      layer: id,
      type: tool,
      x: point.x,
      y: point.y,
      x2: point.x,
      y2: point.y,
      color: activeColor,
      strokeColor: activeColor,
      fillColor: activeFillColor,
      fillMaterial: activeFillMaterial,
      colorLabel: selectedColorMeta.label,
      strokeWidth: activeStrokeWidth,
      strokeOpacity: activeStrokeOpacity,
      fillOpacity: tool === "pen" ? 0 : activeFillOpacity,
      strokeAlign: "center",
      startEndpoint: "none",
      endEndpoint: tool === "arrow" ? "arrow" : "none",
      strokeStyle: "solid",
      points: tool === "freehand" ? [point] : tool === "pen" ? [point, point] : undefined,
      priorityNumber: tool === "priority" ? nextPriorityNumber : undefined,
      text: tool === "text" ? "Add note" : tool === "measure" ? "measurement" : "",
      canvasMode,
    };

    commitAnnotations([...annotations, base]);
    setSelectedId(id);
    setEditingTextId(tool === "text" ? id : "");
    if (tool === "pen") {
      setSelectedId("");
      setPenDraftId(id);
      setDraft(null);
      return;
    }
    if (tool === "text" || tool === "priority" || ["door", "window", "tree", "steps", "fence"].includes(tool)) return;
    setDraft(id);
  }

  function moveDrawing(event) {
    if (!svgRef.current) return;
    const point = canvasPointFromEvent(event);

    if (drag?.mode === "pan") {
      const rect = svgRef.current.getBoundingClientRect();
      const dx = ((event.clientX - drag.startClientX) / rect.width) * drag.viewport.width;
      const dy = ((event.clientY - drag.startClientY) / rect.height) * drag.viewport.height;
      setViewportOrigin({
        x: clamp(drag.viewport.x - dx, 0, Math.max(0, CANVAS_W - drag.viewport.width)),
        y: clamp(drag.viewport.y - dy, 0, Math.max(0, CANVAS_H - drag.viewport.height)),
      });
      return;
    }

    if (penDraftId) {
      setAnnotations((prev) =>
        prev.map((item) =>
          item.id === penDraftId && item.type === "pen" && Array.isArray(item.points)
            ? (() => {
                const fixedPoints = item.points.slice(0, -1);
                const anchor = fixedPoints[fixedPoints.length - 1];
                const nextPoint = event.shiftKey && anchor ? constrainOrthogonalPoint(anchor, point) : point;
                return {
                  ...item,
                  points: item.points.map((pointItem, index) =>
                    index === item.points.length - 1 ? nextPoint : pointItem,
                  ),
                  x2: nextPoint.x,
                  y2: nextPoint.y,
                };
              })()
            : item,
        ),
      );
      return;
    }

    if (draft) {
      setAnnotations((prev) =>
        prev.map((item) =>
          item.id === draft
            ? item.type === "freehand"
              ? { ...item, points: [...(item.points || []), point], x2: point.x, y2: point.y }
              : { ...item, x2: point.x, y2: point.y }
            : item,
        ),
      );
      return;
    }

    if (drag?.id && drag.handle) {
      setAnnotations((prev) =>
        prev.map((item) =>
          item.id === drag.id
            ? applyHandleDrag(
                {
                  ...drag,
                  deepCurve: ["penCurve", "penCubic"].includes(drag.handle?.kind) && event.shiftKey,
                },
                item,
                point,
              )
            : item,
        ),
      );
      return;
    }

    if (drag?.id) {
      const dx = point.x - drag.startX;
      const dy = point.y - drag.startY;
      setAnnotations((prev) =>
        prev.map((item) =>
          item.id === drag.id
            ? {
                ...item,
                x: drag.item.x + dx,
                y: drag.item.y + dy,
                x2: item.x2 == null ? item.x2 : drag.item.x2 + dx,
                y2: item.y2 == null ? item.y2 : drag.item.y2 + dy,
                points: Array.isArray(drag.item.points)
                  ? drag.item.points.map((pointItem) => ({
                      x: pointItem.x + dx,
                      y: pointItem.y + dy,
                    }))
                  : item.points,
                curvePoints: drag.item.curvePoints && typeof drag.item.curvePoints === "object"
                  ? Object.fromEntries(
                      Object.entries(drag.item.curvePoints).map(([key, pointItem]) => [
                        key,
                        pointItem?.type === "cubic"
                          ? {
                              ...pointItem,
                              c1: { x: pointItem.c1.x + dx, y: pointItem.c1.y + dy },
                              c2: { x: pointItem.c2.x + dx, y: pointItem.c2.y + dy },
                            }
                          : {
                              x: pointItem.x + dx,
                              y: pointItem.y + dy,
                            },
                      ]),
                    )
                  : item.curvePoints,
              }
            : item,
        ),
      );
    }
  }

  function stopPointer(event) {
    if (svgRef.current && event?.pointerId != null) {
      try {
        svgRef.current.releasePointerCapture?.(event.pointerId);
      } catch {
        // Pointer may already be released by the browser.
      }
    }
    if (!penDraftId && tool !== "pen") setDraft(null);
    setDrag(null);
  }

  function startMove(event, item) {
    event.stopPropagation();
    if (!svgRef.current) return;
    svgRef.current.setPointerCapture?.(event.pointerId);
    const point = canvasPointFromEvent(event);
    finishPenPath();
    setTool("select");
    setSelectedId(item.id);
    if (item.id !== editingTextId) setEditingTextId("");
    setHistory((prev) => ({ past: [...prev.past, annotations].slice(-30), future: [] }));
    setDrag({ id: item.id, startX: point.x, startY: point.y, item });
  }

  function startCurveEdit(event, item) {
    event.stopPropagation();
    if (!svgRef.current) return;
    svgRef.current.setPointerCapture?.(event.pointerId);
    const point = canvasPointFromEvent(event);
    finishPenPath();
    setTool("curve");
    setSelectedId(item.id);
    if (item.id !== editingTextId) setEditingTextId("");
    setHistory((prev) => ({ past: [...prev.past, annotations].slice(-30), future: [] }));

    if (isLineLike(item)) {
      const curvedItem = { ...item, curvePoint: offsetCurvePoint(item, point) };
      setAnnotations((prev) =>
        prev.map((current) => (current.id === item.id ? curvedItem : current)),
      );
      setDrag(null);
      return;
    }

    if (item.type === "pen" && Array.isArray(item.points)) {
      const hit = nearestPenHit(item, point);
      if (hit?.type === "segment") {
        const start = item.points[hit.index];
        const end = item.points[hit.index + 1];
        const curvedItem = {
          ...item,
          curvePoints: {
            ...(item.curvePoints || {}),
            [hit.index]: event.shiftKey
              ? semicirclePenCurveControls(item, hit.index, point)
              : offsetSegmentCurvePoint(start, end, point),
          },
        };
        setAnnotations((prev) =>
          prev.map((current) => (current.id === item.id ? curvedItem : current)),
        );
      }
      setDrag(null);
      return;
    }

    setDrag(null);
  }

  function startCurveHandleActivation(event, handle) {
    event.stopPropagation();
    if (!selected) return;
    finishPenPath();
    setTool("curve");
    setSelectedId(selected.id);
    setHistory((prev) => ({ past: [...prev.past, annotations].slice(-30), future: [] }));

    if (isLineLike(selected)) {
      const point = { x: handle.x, y: handle.y };
      const curvedItem = { ...selected, curvePoint: offsetCurvePoint(selected, point) };
      setAnnotations((prev) =>
        prev.map((current) => (current.id === selected.id ? curvedItem : current)),
      );
      setDrag(null);
      return;
    }

    if (selected.type === "rect" && handle.kind === "corner") {
      const targetMap = { nw: "tl", ne: "tr", se: "br", sw: "bl" };
      const radiusTarget = targetMap[handle.target];
      if (!radiusTarget) return;
      const bounds = annotationBounds(selected);
      const current = rectCornerRadii(selected, bounds);
      setAnnotations((prev) =>
        prev.map((currentItem) =>
          currentItem.id === selected.id
            ? {
                ...currentItem,
                cornerRadii: {
                  ...current,
                  [radiusTarget]: Math.max(current[radiusTarget] || 0, 12),
                },
              }
            : currentItem,
        ),
      );
    }
    setDrag(null);
  }

  function startHandleMove(event, handle, options = {}) {
    event.stopPropagation();
    if (!svgRef.current || !selected) return;
    svgRef.current.setPointerCapture?.(event.pointerId);
    const point = canvasPointFromEvent(event);
    finishPenPath();
    if (!options.preserveTool) setTool("select");
    setHistory((prev) => ({ past: [...prev.past, annotations].slice(-30), future: [] }));
    setDrag({ id: selected.id, startX: point.x, startY: point.y, item: selected, handle });
  }

  function deleteSelected() {
    if (!selectedId) return;
    commitAnnotations(annotations.filter((item) => item.id !== selectedId));
    setSelectedId("");
    setEditingTextId("");
  }

  function clearCanvas() {
    if (!window.confirm("Clear all annotations on this canvas?")) return;
    commitAnnotations([]);
    setSelectedId("");
    setEditingTextId("");
  }

  function makeSvgString() {
    const clone = svgRef.current?.cloneNode(true);
    if (!clone) return "";
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("viewBox", `0 0 ${CANVAS_W} ${CANVAS_H}`);
    clone.querySelectorAll(".editing-only").forEach((node) => node.remove());
    return new XMLSerializer().serializeToString(clone);
  }

  async function makeSvgStringForPng() {
    const clone = svgRef.current?.cloneNode(true);
    if (!clone) return "";
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
    clone.setAttribute("viewBox", `0 0 ${CANVAS_W} ${CANVAS_H}`);
    clone.querySelectorAll(".editing-only").forEach((node) => node.remove());

    const imageNodes = Array.from(clone.querySelectorAll("image"));
    await Promise.all(
      imageNodes.map(async (node) => {
        const href =
          node.getAttribute("href") ||
          node.getAttribute("xlink:href") ||
          node.getAttributeNS("http://www.w3.org/1999/xlink", "href");
        if (!href || href.startsWith("data:")) return;
        try {
          const response = await fetch(href, { credentials: "include" });
          if (!response.ok) return;
          const dataUrl = await blobToDataUrl(await response.blob());
          node.setAttribute("href", dataUrl);
          node.setAttributeNS("http://www.w3.org/1999/xlink", "href", dataUrl);
        } catch {
          // If inlining fails, keep the original href so SVG export still behaves normally.
        }
      }),
    );

    return new XMLSerializer().serializeToString(clone);
  }

  function downloadSvg() {
    const svg = makeSvgString();
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `flatorigin-markup-${planId || "canvas"}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function downloadPng() {
    try {
      const blob = await svgToPngBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `flatorigin-markup-${planId || "canvas"}.png`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setMessage(normalizeError(err, "Could not export PNG. Try SVG instead."));
    }
  }

  async function svgToPngBlob() {
    const svg = await makeSvgStringForPng();
    if (!svg) throw new Error("Canvas is not ready.");
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    try {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.drawImage(img, 0, 0);
      return await new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Could not export image."));
        }, "image/png");
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function saveToPlanner() {
    if (isProjectImageMode) {
      if (!projectId || !projectImage?.id) {
        setMessage("Open this canvas from a project image before saving a markup snapshot.");
        return false;
      }
      setSaving(true);
      setMessage("");
      try {
        const blob = await svgToPngBlob();
        const formData = new FormData();
        formData.append("images", new File([blob], `project-markup-${Date.now()}.png`, { type: "image/png" }));
        formData.append("captions", `Marked up: ${projectImage.caption || "Project image"}`);
        const { data: uploadedImages } = await api.post(`/projects/${projectId}/images/`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        const savedImage = Array.isArray(uploadedImages) ? uploadedImages[0] : null;
        const snapshotUrl = savedImage?.url || savedImage?.image || "";
        const snapshotImageId = savedImage?.id || null;

        const savedOriginal = await saveEditableCanvas({
          quiet: true,
          versionSnapshotUrl: snapshotUrl,
          versionSnapshotImageId: snapshotImageId,
        });
        if (snapshotImageId) {
          await api.patch(`/projects/${projectId}/images/${snapshotImageId}/`, {
            extra_data: {
              source: "project_image_markup_snapshot",
              source_project_image_id: projectImage.id,
              is_markup_snapshot: true,
            },
          });
        }
        setMessage("Marked-up image added to this project.");
        return true;
      } catch (err) {
        setMessage(normalizeError(err, "Could not save the marked-up image to this project."));
        return false;
      } finally {
        setSaving(false);
      }
    }

    if (!planId) {
      setMessage("Open this canvas from a project planner to save it back to the project file.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const blob = await svgToPngBlob();
      const formData = new FormData();
      formData.append("images", new File([blob], `markup-${Date.now()}.png`, { type: "image/png" }));
      formData.append("captions", "Project markup canvas");
      const { data: uploadedImages } = await api.post(`/project-plans/${planId}/images/`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const snapshotUrl = Array.isArray(uploadedImages) ? uploadedImages[0]?.image_url : "";
      const snapshotImageId = Array.isArray(uploadedImages) ? uploadedImages[0]?.id : null;
      await saveEditableCanvas({ quiet: true, versionSnapshotUrl: snapshotUrl, versionSnapshotImageId: snapshotImageId });
      setMessage("Editable markup and image snapshot saved to this project planner.");
      return true;
    } catch (err) {
      setMessage(normalizeError(err, "Could not save this markup. Try downloading SVG instead."));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveAndBack() {
    if (isProjectImageMode) {
      const saved = await saveToPlanner();
      if (saved && projectId) navigate(`/projects/${projectId}`);
      return;
    }

    const saved = await saveToPlanner();
    if (saved && planId) navigate(`/dashboard/planner/${planId}`);
  }

  async function handleSave() {
    if (isProjectImageMode) {
      await saveEditableCanvas();
      return;
    }
    await saveToPlanner();
  }

  async function deletePlanner() {
    if (!planId) {
      setMessage("Open this canvas from a saved project planner before deleting.");
      return;
    }
    if (
      !window.confirm(
        "Delete this project planner? This removes the planner, saved canvas versions, and planner images.",
      )
    ) {
      return;
    }
    setDeleting(true);
    setMessage("");
    try {
      await api.delete(`/project-plans/${planId}/`);
      navigate("/dashboard");
    } catch (err) {
      setMessage(normalizeError(err, "Could not delete this project planner."));
    } finally {
      setDeleting(false);
    }
  }

  async function saveEditableCanvas({ quiet = false, versionSnapshotUrl = "", versionSnapshotImageId = null } = {}) {
    if (isProjectImageMode) {
      if (!projectImage?.id) {
        setMessage("Open this canvas from a project image before saving markup.");
        return null;
      }
      setSavingEditable(true);
      if (!quiet) setMessage("");
      try {
        const now = new Date().toISOString();
        const normalizedAnnotations = annotations.map((item) =>
          item.type === "text" || item.type === "measure"
            ? { ...item, text: normalizeMarkupText(item.text) }
            : item,
        );
        const previousExtraData =
          projectImage.extra_data && typeof projectImage.extra_data === "object"
            ? projectImage.extra_data
            : {};
        const markupVersion = {
          id: previousExtraData.markup_version?.id || `project-image-markup-${Date.now()}`,
          name: previousExtraData.markup_version?.name || modeLabel,
          version_type: isRoughPlan ? "rough_plan" : "photo_markup",
          type_label: modeLabel,
          created_at: previousExtraData.markup_version?.created_at || now,
          updated_at: now,
          source_image_id: projectImage.id,
          background_url: isRoughPlan ? "" : isPersistableUrl(backgroundUrl) ? backgroundUrl : (projectImage.url || ""),
          snapshot_url: versionSnapshotUrl || previousExtraData.markup_version?.snapshot_url || "",
          snapshot_image_id: versionSnapshotImageId || previousExtraData.markup_version?.snapshot_image_id || null,
          annotations: normalizedAnnotations,
          rough_plan: isRoughPlan ? roughPlan : undefined,
          visible_layers: visibleLayers,
          annotation_count: normalizedAnnotations.length,
        };
        const { data } = await api.patch(`/projects/${projectId}/images/${projectImage.id}/`, {
          extra_data: {
            ...previousExtraData,
            source: previousExtraData.source || "project_image_markup",
            markup_version: markupVersion,
          },
        });
        setProjectImage(data);
        if (!quiet) setMessage("Markup saved to this project image.");
        return data;
      } catch (err) {
        if (!quiet) setMessage(normalizeError(err, "Could not save markup to this project image."));
        if (quiet) throw err;
        return null;
      } finally {
        setSavingEditable(false);
      }
    }

    if (!planId) {
      setMessage("Open this canvas from a project planner to save editable layer data.");
      return null;
    }
    setSavingEditable(true);
    if (!quiet) setMessage("");
    try {
      const previousMarkup = safeMarkupData(plan?.markup_data);
      const markupData = makeMarkupPayload(previousMarkup, {
        snapshot_url: versionSnapshotUrl,
        snapshot_image_id: versionSnapshotImageId,
      });
      const data = await patchMarkupData(markupData);
      if (!quiet) {
        setMessage(
          backgroundUrl?.startsWith("blob:")
            ? "Editable markup saved. The uploaded background itself is temporary until you also save an image snapshot."
            : "Editable markup saved.",
        );
      }
      return data;
    } catch (err) {
      if (!quiet) setMessage(normalizeError(err, "Could not save editable markup."));
      if (quiet) throw err;
      return null;
    } finally {
      setSavingEditable(false);
    }
  }

  function restoreVersion(version) {
    if (!version) return;
    if (Array.isArray(version.annotations)) commitAnnotations(version.annotations);
    const nextMode = version.version_type === "rough_plan" ? "rough_plan" : "photo";
    setCanvasMode(nextMode);
    if (nextMode === "rough_plan") {
      setBackgroundUrl("");
      if (version.rough_plan && typeof version.rough_plan === "object") {
        setRoughPlan((prev) => ({ ...prev, ...version.rough_plan }));
      }
    } else if (version.background_url) {
      setBackgroundUrl(version.background_url);
    }
    if (version.visible_layers && typeof version.visible_layers === "object") {
      setVisibleLayers((prev) => ({ ...prev, ...version.visible_layers }));
    }
    setSelectedId("");
    setEditingTextId("");
    setMessage("Version restored locally. Save editable canvas to keep it as the current version.");
  }

  async function renameVersion(versionId, name) {
    if (!planId || !versionId) return;
    const markup = safeMarkupData(plan?.markup_data);
    const versions = Array.isArray(markup.versions) ? markup.versions : [];
    const nextMarkup = {
      ...markup,
      versions: versions.map((version) =>
        version.id === versionId
          ? { ...version, name: normalizeMarkupText(name) || "Untitled markup" }
          : version,
      ),
      updated_at: new Date().toISOString(),
    };
    try {
      await patchMarkupData(nextMarkup);
    } catch (err) {
      setMessage(normalizeError(err, "Could not rename this version."));
    }
  }

  async function deleteVersion(versionId) {
    if (!planId || !versionId) return;
    if (!window.confirm("Delete this saved markup version?")) return;
    const markup = safeMarkupData(plan?.markup_data);
    const versions = Array.isArray(markup.versions) ? markup.versions : [];
    const versionToDelete = versions.find((version) => version.id === versionId);
    const nextMarkup = {
      ...markup,
      versions: versions.filter((version) => version.id !== versionId),
      updated_at: new Date().toISOString(),
    };
    try {
      if (versionToDelete?.snapshot_image_id) {
        await api.delete(`/project-plans/${planId}/images/${versionToDelete.snapshot_image_id}/`);
      }
      await patchMarkupData(nextMarkup, "Saved markup version deleted.");
    } catch (err) {
      setMessage(normalizeError(err, "Could not delete this version."));
    }
  }

  const visibleAnnotations = annotations.filter((item) => visibleLayers[item.id] !== false);
  const layeredAnnotations = visibleAnnotations;
  const annotationLayers = annotations
    .map((item, index) => ({
      item,
      index,
      label: annotationLayerLabel(item, index),
    }))
    .reverse();
  const penDraft = penDraftId ? annotations.find((item) => item.id === penDraftId) || null : null;
  const selectedForEditing = selected?.id === penDraftId ? null : selected;
  const selectedLabelPosition = labelPosition(selectedForEditing);
  const selectedDisplayBounds = selectedForEditing ? displayBounds(selectedForEditing) : null;
  const selectedControlHandles = selectedForEditing ? controlHandlesFor(selectedForEditing, tool) : [];
  const visibleControlHandles =
    tool === "curve"
      ? selectedControlHandles.filter((handle) =>
          isLineLike(selectedForEditing)
            ? handle.kind === "curve"
            : selectedForEditing?.type === "rect"
              ? handle.kind === "cornerRadius" || handle.kind === "corner"
              : selectedForEditing?.type === "pen"
                ? handle.kind === "penCurve" || handle.kind === "penCubic"
              : false,
        )
      : selectedControlHandles;
  const selectedDeletePosition = selectedDisplayBounds
    ? {
        left: `${((clamp(selectedDisplayBounds.x2 + 18, viewport.x + 18, viewport.x + viewport.width - 18) - viewport.x) / viewport.width) * 100}%`,
        top: `${((clamp(selectedDisplayBounds.y1 - 18, viewport.y + 18, viewport.y + viewport.height - 18) - viewport.y) / viewport.height) * 100}%`,
      }
    : null;
  const editingSelectedText =
    selectedLabelPosition &&
    selectedForEditing &&
    editingTextId === selectedForEditing.id &&
    (selectedForEditing.type === "text" || selectedForEditing.type === "measure");
  const sidebarTextEditorActive =
    !!selectedForEditing && (editingTextId === selectedForEditing.id || focusedSidebarInputId === selectedForEditing.id);
  const selectedTextBox = selectedForEditing ? labelBox(selectedForEditing.text || (selectedForEditing.type === "measure" ? "measurement" : "Note"), 18) : null;
  const selectedStyle = selectedForEditing ? styleFor(selectedForEditing) : null;
  const currentStrokeWidth = selectedForEditing ? strokeWidthFor(selectedForEditing) : activeStrokeWidth;
  const currentStrokeColor = safeHexColor(selectedStyle?.strokeColor || activeColor);
  const currentFillColor = safeHexColor(selectedStyle?.fillColor || activeFillColor);
  const currentFillMaterial = selectedStyle?.fillMaterial || activeFillMaterial;
  const currentStrokeOpacity = selectedStyle?.strokeOpacity ?? activeStrokeOpacity;
  const currentFillOpacity = selectedStyle?.fillOpacity ?? activeFillOpacity;
  const currentStrokeStyle = selectedForEditing?.strokeStyle || "solid";
  const currentStrokeAlign = selectedForEditing?.strokeAlign || "center";
  const currentStartEndpoint = selectedForEditing?.startEndpoint || "none";
  const currentEndEndpoint = selectedForEditing?.endEndpoint || (selectedForEditing?.type === "arrow" ? "arrow" : "none");
  const fillMaterialLibrary = useMemo(
    () => [...FILL_MATERIALS, ...fillTextureLibrary],
    [fillTextureLibrary],
  );
  const currentFillMaterialOption =
    fillMaterialLibrary.find((material) => material.key === currentFillMaterial) || FILL_MATERIALS[0];
  const selectedSupportsEndpoints =
    !selectedForEditing || ["line", "arrow", "measure", "freehand", "pen"].includes(selectedForEditing.type);

  function changeStrokeWidth(nextWidth) {
    const width = clamp(Number(nextWidth) || DEFAULT_STROKE_WIDTH, 1, 18);
    setActiveStrokeWidth(width);
    if (selectedForEditing) updateSelected({ strokeWidth: width });
  }

  function changeStrokeColor(nextColor) {
    if (!isHexColor(nextColor)) return;
    setActiveColor(nextColor);
    if (selectedForEditing) updateSelected({ color: nextColor, strokeColor: nextColor });
  }

  function changeFillColor(nextColor) {
    if (!isHexColor(nextColor)) return;
    setActiveFillColor(nextColor);
    if (selectedForEditing) updateSelected({ fillColor: nextColor });
  }

  function changeFillMaterial(nextMaterial) {
    const material = isFillMaterialKey(nextMaterial) ? nextMaterial : "flat";
    setActiveFillMaterial(material);
    if (selectedForEditing) updateSelected({ fillMaterial: material });
  }

  function toggleTexturePublishRequest(textureKey) {
    setFillTextureLibrary((prev) =>
      prev.map((texture) =>
        texture.key === textureKey
          ? {
              ...texture,
              publishRequested: !texture.publishRequested,
              visibility: texture.publishRequested ? "private" : "review_requested",
            }
          : texture,
      ),
    );
  }

  function removeCustomTexture(textureKey) {
    setFillTextureLibrary((prev) => prev.filter((texture) => texture.key !== textureKey));
    setAnnotations((prev) =>
      prev.map((item) => (item.fillMaterial === textureKey ? { ...item, fillMaterial: "flat" } : item)),
    );
    if (currentFillMaterial === textureKey) changeFillMaterial("flat");
  }

  function changeStrokeOpacity(nextOpacity) {
    const opacity = clamp(Number(nextOpacity), 0, 1);
    setActiveStrokeOpacity(opacity);
    if (selectedForEditing) updateSelected({ strokeOpacity: opacity });
  }

  function changeFillOpacity(nextOpacity) {
    const opacity = clamp(Number(nextOpacity), 0, 1);
    setActiveFillOpacity(opacity);
    if (selectedForEditing) updateSelected({ fillOpacity: opacity });
  }

  function changeStrokeStyle(nextStyle) {
    if (selectedForEditing) updateSelected({ strokeStyle: nextStyle });
  }

  function changeStrokeAlign(nextAlign) {
    if (selectedForEditing) updateSelected({ strokeAlign: nextAlign });
  }

  function changeEndpoint(position, value) {
    if (!selectedForEditing) return;
    updateSelected(position === "start" ? { startEndpoint: value } : { endEndpoint: value });
  }

  function isSidebarSectionOpen(sectionId) {
    return openSidebarSection === sectionId || pinnedSidebarSections.has(sectionId);
  }

  function toggleSidebarSection(sectionId) {
    setOpenSidebarSection((prev) => (prev === sectionId && !pinnedSidebarSections.has(sectionId) ? "" : sectionId));
  }

  function toggleSidebarPin(sectionId) {
    setPinnedSidebarSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  const sketchPhase = sketchStatus.phase || "idle";
  const sketchProgress = clamp(Number(sketchStatus.progress) || 0, 0, 100);
  const sketchSteps = [
    {
      key: "upload",
      label: "Upload sketch",
      active: sketchPhase === "uploading",
      done: sketchProgress >= 100 && ["analyzing", "drafting", "ready"].includes(sketchPhase),
    },
    {
      key: "analyze",
      label: "AI reading sketch",
      active: sketchPhase === "analyzing",
      done: ["drafting", "ready"].includes(sketchPhase),
    },
    {
      key: "draft",
      label: "Draft editable plan",
      active: sketchPhase === "drafting",
      done: sketchPhase === "ready",
    },
    {
      key: "ready",
      label: "Ready to review",
      active: sketchPhase === "ready",
      done: sketchPhase === "ready",
    },
  ];

  return (
    <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] min-h-[calc(100vh-64px)] w-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-4">
            <Link
              to={isProjectImageMode ? `/projects/${projectId}` : planId ? `/dashboard/planner/${planId}` : "/dashboard"}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              aria-label={isProjectImageMode ? "Back to project" : "Back to planner"}
            >
              <SymbolIcon name="arrow_back" className="text-[22px]" />
            </Link>
            <div>
              <h1 className="text-base font-semibold text-slate-950">Markup canvas</h1>
              <p className="text-xs text-slate-500">
                {isProjectImageMode ? "Markup will stay on this project image" : `${modeLabel}: mark the area that needs work`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white">
              <button
                type="button"
                onClick={undo}
                disabled={!history.past.length}
                className="inline-flex h-9 w-9 items-center justify-center text-slate-400 hover:bg-slate-50 disabled:opacity-40"
                aria-label="Undo"
              >
                <SymbolIcon name="undo" className="text-[18px]" />
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={!history.future.length}
                className="inline-flex h-9 w-9 items-center justify-center text-slate-400 hover:bg-slate-50 disabled:opacity-40"
                aria-label="Redo"
              >
                <SymbolIcon name="redo" className="text-[18px]" />
              </button>
            </div>
            <button
              type="button"
              onClick={downloadSvg}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <SymbolIcon name="download" className="text-[18px]" />
              SVG
            </button>
            <button
              type="button"
              onClick={downloadPng}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <SymbolIcon name="image" className="text-[18px]" />
              PNG
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={savingEditable || saving}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <SymbolIcon name="save" className="text-[18px]" />
              {savingEditable || saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={saveAndBack}
              disabled={saving || savingEditable}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              <SymbolIcon name="check" className="text-[18px]" />
              {saving || savingEditable ? "Saving..." : "Save & back"}
            </button>
          </div>
        </div>
      </div>

      <div className={`${expanded ? "fixed inset-0 z-50 overflow-auto bg-slate-50 px-4 py-4" : "mx-auto max-w-7xl px-6 py-4"}`}>
        {loadingPlan ? (
          <div className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
            Loading planner...
          </div>
        ) : null}

        {message ? (
          <div className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
            {message}
          </div>
        ) : null}

        <div className="grid items-start gap-4 lg:grid-cols-[286px_minmax(0,1fr)]">
          <div className="space-y-4">
            <CollapsibleSection
              id="mode"
              title="Markup mode"
              open={isSidebarSectionOpen("mode")}
              pinned={pinnedSidebarSections.has("mode")}
              onToggle={toggleSidebarSection}
              onPin={toggleSidebarPin}
            >
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => switchCanvasMode("photo")}
                  className={`h-10 rounded-xl border px-3 text-sm font-medium ${
                    !isRoughPlan ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Photo Markup
                </button>
                <button
                  type="button"
                  onClick={() => switchCanvasMode("rough_plan")}
                  className={`h-10 rounded-xl border px-3 text-sm font-medium ${
                    isRoughPlan ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Create Plan
                </button>
              </div>
              {isRoughPlan ? (
                <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-sm font-semibold text-slate-900">Create from sketch</div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Upload a simple sketch image and AI will draft editable rough-plan lines, labels, and symbols.
                    </p>
                    <input
                      ref={sketchFileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleSketchPlanUpload}
                    />
                    <button
                      type="button"
                      disabled={sketchBusy}
                      onClick={() => sketchFileRef.current?.click()}
                      className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      <SymbolIcon name="upload" className="text-[18px]" />
                      {sketchBusy ? "Creating plan..." : "Upload sketch"}
                    </button>
                    {sketchPhase !== "idle" ? (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold text-slate-800">
                              {sketchStatus.fileName || "Sketch image"}
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-500">
                              {sketchPhase === "uploading"
                                ? `Uploading ${sketchProgress}%`
                                : sketchPhase === "analyzing"
                                  ? "Upload complete. AI is reading the sketch."
                                  : sketchPhase === "drafting"
                                    ? "Building editable rough-plan elements."
                                    : sketchPhase === "ready"
                                      ? "Editable rough plan is ready."
                                      : "Could not create the rough plan."}
                            </div>
                          </div>
                          {sketchBusy ? (
                            <SymbolIcon name="hourglass_empty" className="shrink-0 animate-spin text-[18px] text-blue-600" />
                          ) : sketchPhase === "ready" ? (
                            <SymbolIcon name="check_circle" className="shrink-0 text-[18px] text-emerald-600" />
                          ) : sketchPhase === "error" ? (
                            <SymbolIcon name="error" className="shrink-0 text-[18px] text-rose-600" />
                          ) : null}
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full transition-all ${
                              sketchPhase === "error" ? "bg-rose-500" : sketchPhase === "ready" ? "bg-emerald-500" : "bg-blue-600"
                            }`}
                            style={{ width: `${sketchPhase === "error" ? Math.max(8, sketchProgress) : sketchProgress}%` }}
                          />
                        </div>
                        <div className="mt-3 grid gap-2">
                          {sketchSteps.map((step) => (
                            <div key={step.key} className="flex items-center gap-2 text-xs">
                              <span
                                className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                                  step.done
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : step.active
                                      ? "border-blue-200 bg-blue-50 text-blue-700"
                                      : sketchPhase === "error"
                                        ? "border-slate-200 bg-slate-50 text-slate-400"
                                        : "border-slate-200 bg-white text-slate-400"
                                }`}
                              >
                                {step.done ? (
                                  <SymbolIcon name="check" className="text-[14px]" />
                                ) : step.active ? (
                                  <SymbolIcon name="hourglass_empty" className="animate-spin text-[13px]" />
                                ) : (
                                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                )}
                              </span>
                              <span
                                className={
                                  step.done
                                    ? "font-medium text-emerald-700"
                                    : step.active
                                      ? "font-medium text-blue-700"
                                      : "text-slate-500"
                                }
                              >
                                {step.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-slate-500">Width</span>
                      <input
                        type="number"
                        min="1"
                        value={roughPlan.width}
                        onChange={(event) => setRoughPlan((prev) => ({ ...prev, width: event.target.value }))}
                        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-slate-500">Length</span>
                      <input
                        type="number"
                        min="1"
                        value={roughPlan.length}
                        onChange={(event) => setRoughPlan((prev) => ({ ...prev, length: event.target.value }))}
                        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-500">Unit</span>
                    <select
                      value={roughPlan.unit}
                      onChange={(event) => setRoughPlan((prev) => ({ ...prev, unit: event.target.value }))}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
                    >
                      <option value="ft">ft</option>
                      <option value="in">in</option>
                      <option value="m">m</option>
                    </select>
                  </label>
                  <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600">
                    <span>Soft snap</span>
                    <input
                      type="checkbox"
                      checked={roughPlan.snap}
                      onChange={(event) => setRoughPlan((prev) => ({ ...prev, snap: event.target.checked }))}
                      className="h-4 w-4 align-middle accent-blue-600"
                    />
                  </label>
                  <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                    This is a rough planning tool to help explain your project area. It is not intended for design, engineering, or construction drawings.
                  </p>
                </div>
              ) : null}
            </CollapsibleSection>

            {!isRoughPlan ? (
            <CollapsibleSection
              id="background"
              title="Background"
              open={isSidebarSectionOpen("background")}
              pinned={pinnedSidebarSections.has("background")}
              onToggle={toggleSidebarSection}
              onPin={toggleSidebarPin}
            >
              <p className="mt-1 text-xs text-slate-500">Use a room photo, floor plan, or sketch.</p>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
              <button
                type="button"
                className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800"
                onClick={() => fileRef.current?.click()}
              >
                <SymbolIcon name="upload" className="text-[18px]" />
                Upload background
              </button>
              {backgroundUrl ? (
                <button
                  type="button"
                  className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
                  onClick={() => setBackgroundUrl("")}
                >
                  Remove background
                </button>
              ) : null}
            </CollapsibleSection>
            ) : null}

            <CollapsibleSection
              id="layers"
              title="Layers"
              open={isSidebarSectionOpen("layers")}
              pinned={pinnedSidebarSections.has("layers")}
              onToggle={toggleSidebarSection}
              onPin={toggleSidebarPin}
            >
              <div className="mt-3 space-y-2">
                {annotationLayers.length ? annotationLayers.map(({ item, index, label }, stackIndex) => {
                  const active = selectedId === item.id;
                  const visible = visibleLayers[item.id] !== false;
                  const topLayer = stackIndex === 0;
                  const bottomLayer = stackIndex === annotationLayers.length - 1;
                  return (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={(event) => {
                        setDraggingLayerId(item.id);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", item.id);
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const draggedId = event.dataTransfer.getData("text/plain") || draggingLayerId;
                        moveAnnotationLayerTo(draggedId, item.id);
                        setDraggingLayerId("");
                      }}
                      onDragEnd={() => setDraggingLayerId("")}
                      className={`flex min-h-14 items-center gap-2 rounded-xl border px-2 py-2 ${
                        active ? "border-slate-950 bg-slate-50" : "border-slate-200 bg-white"
                      }`}
                    >
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                        aria-label={`Drag ${label} layer`}
                      >
                        <SymbolIcon name="drag_indicator" className="text-[18px]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="block truncate text-sm font-medium text-slate-700">{label}</span>
                        <span className="block truncate text-[11px] text-slate-400">
                          {topLayer ? "Top" : bottomLayer ? "Bottom" : `Stack ${annotationLayers.length - stackIndex}`}
                        </span>
                      </button>
                      {active ? (
                        <span className="rounded-full bg-slate-950 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
                          Editing
                        </span>
                      ) : null}
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveAnnotationLayer(item.id, "up")}
                          disabled={topLayer}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-35"
                          aria-label={`Move ${label} up`}
                        >
                          <SymbolIcon name="keyboard_arrow_up" className="text-[18px]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveAnnotationLayer(item.id, "down")}
                          disabled={bottomLayer}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-35"
                          aria-label={`Move ${label} down`}
                        >
                          <SymbolIcon name="keyboard_arrow_down" className="text-[18px]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleAnnotationLayerVisibility(item.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                          aria-label={`${visible ? "Hide" : "Show"} ${label} layer`}
                        >
                          <SymbolIcon name={visible ? "visibility" : "visibility_off"} className="text-[18px]" />
                        </button>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-400">
                    Draw an annotation to create its layer.
                  </div>
                )}
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              id="stroke"
              title="Stroke settings"
              open={isSidebarSectionOpen("stroke")}
              pinned={pinnedSidebarSections.has("stroke")}
              onToggle={toggleSidebarSection}
              onPin={toggleSidebarPin}
            >
              <div className="mt-3 space-y-4">
                <label className="block">
                  <span className="mb-2 block text-xs font-medium text-slate-500">Stroke color</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentStrokeColor}
                      onChange={(event) => changeStrokeColor(event.target.value)}
                      className="h-10 w-12 rounded-lg border border-slate-200 bg-white p-1"
                      aria-label="Stroke color"
                    />
                    <input
                      value={currentStrokeColor}
                      onChange={(event) => changeStrokeColor(event.target.value)}
                      className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
                      aria-label="Stroke color value"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-2 flex items-center justify-between text-xs font-medium text-slate-500">
                    <span>Stroke</span>
                    <span className="text-slate-700">{currentStrokeWidth}px</span>
                  </span>
                  <div className="grid grid-cols-[1fr_64px] gap-2">
                    <input
                      type="range"
                      min="1"
                      max="18"
                      step="1"
                      value={currentStrokeWidth}
                      onChange={(event) => changeStrokeWidth(event.target.value)}
                      className="w-full accent-blue-600"
                      aria-label="Stroke width"
                    />
                    <input
                      type="number"
                      min="1"
                      max="18"
                      value={currentStrokeWidth}
                      onChange={(event) => changeStrokeWidth(event.target.value)}
                      className="h-9 rounded-lg border border-slate-200 px-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
                      aria-label="Stroke width number"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-2 flex items-center justify-between text-xs font-medium text-slate-500">
                    <span>Stroke opacity</span>
                    <span className="text-slate-700">{Math.round(currentStrokeOpacity * 100)}%</span>
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={currentStrokeOpacity}
                    onChange={(event) => changeStrokeOpacity(event.target.value)}
                    className="w-full accent-blue-600"
                    aria-label="Stroke opacity"
                  />
                </label>

                <div>
                  <div className="mb-2 text-xs font-medium text-slate-500">Line style</div>
                  <div className="grid grid-cols-2 gap-2">
                    {["solid", "dashed"].map((itemStyle) => (
                      <button
                        key={itemStyle}
                        type="button"
                        onClick={() => changeStrokeStyle(itemStyle)}
                        disabled={!selectedForEditing}
                        className={
                          "h-9 rounded-xl border px-3 text-sm capitalize transition disabled:opacity-50 " +
                          (currentStrokeStyle === itemStyle
                            ? "border-slate-950 bg-slate-950 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")
                        }
                      >
                        {itemStyle}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-xs font-medium text-slate-500">Stroke alignment</div>
                  <div className="grid grid-cols-3 gap-2">
                    {["inside", "center", "outside"].map((align) => (
                      <button
                        key={align}
                        type="button"
                        onClick={() => changeStrokeAlign(align)}
                        disabled={!selectedForEditing}
                        className={
                          "h-8 rounded-lg border px-2 text-xs capitalize transition disabled:opacity-50 " +
                          (currentStrokeAlign === align
                            ? "border-slate-950 bg-slate-950 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")
                        }
                      >
                        {align}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedSupportsEndpoints ? (
                  <div>
                    <div className="mb-2 text-xs font-medium text-slate-500">Endpoints</div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="mb-1 block text-[11px] text-slate-400">Start</span>
                        <select
                          value={currentStartEndpoint}
                          onChange={(event) => changeEndpoint("start", event.target.value)}
                          disabled={!selectedForEditing}
                          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none disabled:opacity-50"
                        >
                          {LINE_ENDPOINT_OPTIONS.map((item) => (
                            <option key={item.key} value={item.key}>{item.label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[11px] text-slate-400">End</span>
                        <select
                          value={currentEndEndpoint}
                          onChange={(event) => changeEndpoint("end", event.target.value)}
                          disabled={!selectedForEditing}
                          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none disabled:opacity-50"
                        >
                          {LINE_ENDPOINT_OPTIONS.map((item) => (
                            <option key={item.key} value={item.key}>{item.label}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                ) : null}

                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <div
                    className="rounded-full"
                    style={{ height: `${currentStrokeWidth}px`, maxHeight: "18px", backgroundColor: hexToRgba(currentStrokeColor, currentStrokeOpacity) }}
                  />
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              id="fill"
              title="Fill"
              open={isSidebarSectionOpen("fill")}
              pinned={pinnedSidebarSections.has("fill")}
              onToggle={toggleSidebarSection}
              onPin={toggleSidebarPin}
            >
              <div className="mt-3 space-y-4">
                <input ref={textureFileRef} type="file" accept=".svg,image/svg+xml" className="hidden" onChange={handleTextureUpload} />
                <label className="block">
                  <span className="mb-2 block text-xs font-medium text-slate-500">Fill color</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentFillColor}
                      onChange={(event) => changeFillColor(event.target.value)}
                      className="h-10 w-12 rounded-lg border border-slate-200 bg-white p-1"
                      aria-label="Fill color"
                    />
                    <input
                      value={currentFillColor}
                      onChange={(event) => changeFillColor(event.target.value)}
                      className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
                      aria-label="Fill color value"
                    />
                  </div>
                </label>
                <label className="block">
                  <span className="mb-2 flex items-center justify-between text-xs font-medium text-slate-500">
                    <span>Fill opacity</span>
                    <span className="text-slate-700">{Math.round(currentFillOpacity * 100)}%</span>
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={currentFillOpacity}
                    onChange={(event) => changeFillOpacity(event.target.value)}
                    className="w-full accent-blue-600"
                    aria-label="Fill opacity"
                  />
                </label>
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-500">Fill texture library</span>
                    <button
                      type="button"
                      onClick={() => textureFileRef.current?.click()}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      <SymbolIcon name="upload" className="text-[16px]" />
                      Add SVG
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {fillMaterialLibrary.map((material) => {
                      const active = currentFillMaterial === material.key;
                      const isCustom = material.key.startsWith("custom-");
                      const previewStyle = fillMaterialPreviewStyle(material, currentFillColor, currentFillOpacity);

                      return (
                        <div
                          key={material.key}
                          className={`rounded-xl border p-2 transition ${
                            active ? "border-slate-950 bg-slate-50" : "border-slate-200 bg-white"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => changeFillMaterial(material.key)}
                            className="block w-full text-left"
                          >
                            <span className="block h-12 rounded-lg border border-slate-200" style={previewStyle} />
                            <span className="mt-2 block truncate text-xs font-medium text-slate-700">{material.label}</span>
                            <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-slate-400">
                              {isCustom ? (material.publishRequested ? "Public review requested" : "Private") : "Public"}
                            </span>
                          </button>
                          {isCustom ? (
                            <div className="mt-2 flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => toggleTexturePublishRequest(material.key)}
                                className="h-7 flex-1 rounded-lg border border-slate-200 px-2 text-[11px] font-medium text-slate-500 hover:bg-slate-50"
                              >
                                {material.publishRequested ? "Keep private" : "Request public"}
                              </button>
                              <button
                                type="button"
                                onClick={() => removeCustomTexture(material.key)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                                aria-label={`Remove ${material.label} texture`}
                              >
                                <SymbolIcon name="delete" className="text-[15px]" />
                              </button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[11px] leading-4 text-slate-400">
                    Uploaded SVG textures are saved to your local texture library. Public textures require a review flow before they can be shared.
                  </p>
                </div>
                <div
                  className="h-10 rounded-lg border border-slate-200"
                  style={fillMaterialPreviewStyle(currentFillMaterialOption, currentFillColor, currentFillOpacity)}
                />
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              id="annotations"
              title="Annotations"
              count={annotations.length}
              open={isSidebarSectionOpen("annotations")}
              pinned={pinnedSidebarSections.has("annotations")}
              onToggle={toggleSidebarSection}
              onPin={toggleSidebarPin}
            >
              <button
                type="button"
                onClick={clearCanvas}
                disabled={!annotations.length}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50 disabled:opacity-50"
              >
                <SymbolIcon name="ink_eraser" className="text-[18px]" />
                Clear annotations
              </button>
              {selected ? (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  {selected.type === "text" || selected.type === "measure" ? (
                    <label className="mb-4 block">
                      <span className="mb-2 flex items-center justify-between gap-2 text-xs font-medium text-slate-500">
                        <span>{selected.type === "measure" ? "Measurement text" : "Note text"}</span>
                        {sidebarTextEditorActive ? (
                          <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                            Editing
                          </span>
                        ) : null}
                      </span>
                      <textarea
                        ref={sidebarTextRef}
                        value={selected.text || ""}
                        onChange={(event) => updateSelected({ text: event.target.value })}
                        onFocus={() => setFocusedSidebarInputId(selected.id)}
                        onBlur={(event) => {
                          updateSelected({ text: normalizeMarkupText(event.target.value) });
                          setFocusedSidebarInputId("");
                        }}
                        rows={selected.type === "text" ? 4 : 2}
                        className={
                          "w-full resize-y rounded-xl border bg-white px-3 py-2 text-left text-sm leading-5 text-slate-900 outline-none transition " +
                          (sidebarTextEditorActive
                            ? "border-blue-500 ring-4 ring-blue-500/20"
                            : "border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15")
                        }
                        placeholder={selected.type === "measure" ? "12 ft" : "Add note"}
                      />
                      <span className="mt-1 block text-[11px] leading-4 text-slate-400">
                        You can also double-click the label on the image to edit it in place.
                      </span>
                    </label>
                  ) : null}
                  {selected.type === "priority" ? (
                    <label className="mb-4 block">
                      <span className="mb-2 block text-xs font-medium text-slate-500">
                        Priority number
                      </span>
                      <input
                        type="number"
                        min="1"
                        value={selected.priorityNumber || 1}
                        onChange={(event) =>
                          updateSelected({
                            priorityNumber: Math.max(1, Number(event.target.value) || 1),
                          })
                        }
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
                      />
                    </label>
                  ) : null}

                </div>
              ) : null}
            </CollapsibleSection>

            {savedVersions.length ? (
              <CollapsibleSection
                id="versions"
                title="Versions"
                count={savedVersions.length}
                open={isSidebarSectionOpen("versions")}
                pinned={pinnedSidebarSections.has("versions")}
                onToggle={toggleSidebarSection}
                onPin={toggleSidebarPin}
              >
                <div className="mt-3 grid max-h-[28rem] grid-cols-1 gap-3 overflow-y-auto pr-1">
                  {savedVersions.map((version, index) => {
                    const previewUrl = version.snapshot_url || version.background_url || "";
                    const versionName = version.name || `Markup version ${savedVersions.length - index}`;
                    const versionType = version.type_label || (version.version_type === "rough_plan" ? "Rough Plan" : "Photo Markup");
                    return (
                      <div
                        key={version.id || `version-${index}`}
                        className="group rounded-xl border border-slate-200 p-3 text-xs text-slate-600"
                      >
                        <button
                          type="button"
                          onClick={() => restoreVersion(version)}
                          className="group relative block w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-left hover:border-slate-300"
                        >
                          {previewUrl ? (
                            <img
                              src={previewUrl}
                              alt=""
                              className="h-24 w-full object-cover"
                              onError={(event) => {
                                event.currentTarget.style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="flex h-16 items-center px-3 text-xs text-slate-500">
                              Save with image snapshot to create a preview.
                            </div>
                          )}
                          <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700 shadow-sm">
                            {versionType}
                          </span>
                          <span className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-950/85 text-white shadow-sm">
                            <SymbolIcon name="edit_note" className="text-[16px]" />
                          </span>
                        </button>
                        <input
                          defaultValue={versionName}
                          onBlur={(event) => renameVersion(version.id, event.target.value)}
                          className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-semibold text-slate-900 outline-none focus:border-slate-400"
                          aria-label="Version name"
                        />
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <span>{version.annotation_count ?? 0} markups</span>
                          <span>{versionType}</span>
                        </div>
                        <div className="mt-1 text-slate-400">
                          {version.created_at ? new Date(version.created_at).toLocaleString() : "Saved version"}
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteVersion(version.id)}
                          className="mt-3 inline-flex h-8 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-500 opacity-80 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 group-hover:opacity-100"
                        >
                          <SymbolIcon name="delete" className="text-[16px]" />
                          Delete version
                        </button>
                      </div>
                    );
                  })}
                </div>
              </CollapsibleSection>
            ) : null}

            {!isRoughPlan && plan?.images?.length ? (
              <CollapsibleSection
                id="planner-images"
                title="Planner images"
                count={plan.images.length}
                open={isSidebarSectionOpen("planner-images")}
                pinned={pinnedSidebarSections.has("planner-images")}
                onToggle={toggleSidebarSection}
                onPin={toggleSidebarPin}
              >
                <div className="mt-2 max-h-44 space-y-2 overflow-y-auto pr-1">
                  {plan.images.map((image) => (
                    <button
                      key={image.id}
                      type="button"
                      onClick={() => setBackgroundUrl(image.image_url)}
                      className="flex w-full items-center gap-2 rounded-lg border border-slate-200 p-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                    >
                      <img src={image.image_url} alt="" className="h-10 w-12 rounded object-cover" />
                      <span className="line-clamp-2">{image.caption || "Use this image"}</span>
                    </button>
                  ))}
                </div>
              </CollapsibleSection>
            ) : null}

            {planId ? (
              <CollapsibleSection
                id="project-planner"
                title="Project planner"
                open={isSidebarSectionOpen("project-planner")}
                pinned={pinnedSidebarSections.has("project-planner")}
                onToggle={toggleSidebarSection}
                onPin={toggleSidebarPin}
                danger
              >
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Delete this planner and every image, canvas layer, and saved version attached to it.
                </p>
                <button
                  type="button"
                  onClick={deletePlanner}
                  disabled={deleting}
                  className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                >
                  <SymbolIcon name="delete" className="text-[18px]" />
                  {deleting ? "Deleting..." : "Delete project planner"}
                </button>
              </CollapsibleSection>
            ) : null}
          </div>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="relative mb-3 flex min-h-10 items-center justify-between gap-3 text-sm text-slate-500">
              <span>Planner: <span className="text-slate-700">{plan?.title || "Untitled issue"}</span></span>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{Math.round(viewport.zoom * 100)}%</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{modeLabel}</span>
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => !prev)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  aria-label={expanded ? "Exit expanded canvas" : "Expand canvas"}
                >
                  <SymbolIcon name={expanded ? "close_fullscreen" : "open_in_full"} className="text-[18px]" />
                </button>
              </div>
            </div>
            {isRoughPlan ? (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <span className="font-semibold text-slate-800">{roughPlan.width || 0} x {roughPlan.length || 0} {roughPlan.unit}</span>
                <span>Area: {(Number(roughPlan.width) || 0) * (Number(roughPlan.length) || 0)} sq {roughPlan.unit}</span>
                <span>Grid scale: 1 square = 1 {roughGeometry.unit}</span>
                <span>Soft snap: {roughPlan.snap ? "on" : "off"}</span>
                <span>Zoom: {Math.round(viewport.zoom * 100)}%</span>
              </div>
            ) : null}
            <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
              <div className="absolute left-3 top-3 z-20 flex max-w-[calc(100%-1.5rem)] flex-row flex-wrap gap-1 rounded-xl bg-slate-950/95 p-1 shadow-xl lg:bottom-auto lg:left-3 lg:top-1/2 lg:max-w-none lg:-translate-y-1/2 lg:flex-col">
                {toolGroups.map((group) => {
                  const activeItem = group.tools.find((item) => item.key === tool) || group.tools[0];
                  const groupActive = group.tools.some((item) => item.key === tool);
                  const hasFlyout = group.tools.length > 1;
                  return (
                    <div key={group.key} className="group/tool relative">
                      <button
                        type="button"
                        onClick={() => {
                          if (activeItem.key === "delete") {
                            deleteSelected();
                            return;
                          }
                          handleToolSelect(activeItem.key);
                        }}
                        title={activeItem.label}
                        aria-label={activeItem.label}
                        className={`relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-white transition ${
                          groupActive
                            ? "bg-blue-600 shadow-sm"
                            : activeItem.key === "delete"
                              ? "bg-transparent text-white/70 hover:bg-red-600 hover:text-white"
                              : "bg-transparent text-white/80 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <ToolIcon item={activeItem} className="h-[21px] w-[21px] text-[21px]" />
                        {hasFlyout ? (
                          <SymbolIcon name="arrow_drop_down" className="absolute -bottom-1 -right-1 text-[15px] text-white/80" />
                        ) : null}
                      </button>
                      {hasFlyout ? (
                        <div className="pointer-events-none absolute left-8 top-0 z-30 min-w-max pl-2 opacity-0 transition group-hover/tool:pointer-events-auto group-hover/tool:opacity-100 lg:left-8">
                          <div className="flex gap-1 rounded-xl bg-slate-950/95 p-1 shadow-xl ring-1 ring-white/10">
                            {group.tools.map((item) => (
                              <button
                                key={item.key}
                                type="button"
                                onClick={() => handleToolSelect(item.key)}
                                title={item.label}
                                aria-label={item.label}
                                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-white transition ${
                                  tool === item.key ? "bg-blue-600" : "text-white/80 hover:bg-white/10 hover:text-white"
                                }`}
                              >
                                <ToolIcon item={item} className="h-[21px] w-[21px] text-[21px]" />
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <svg
                ref={svgRef}
                viewBox={`${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`}
                className={`block h-auto w-full touch-none select-none bg-white ${tool === "hand" ? "cursor-grab active:cursor-grabbing" : ""} ${expanded ? "min-h-[calc(100vh-190px)]" : "min-h-[560px]"}`}
                onPointerDown={startDrawing}
                onPointerMove={moveDrawing}
                onPointerUp={stopPointer}
                onPointerLeave={stopPointer}
                onDoubleClick={finishPenPathFromDoubleClick}
              >
              <defs>
                {markerColors.map((itemColor) => (
                  <g key={itemColor}>
                    <marker
                      id={markerIdForColor(itemColor)}
                      markerWidth="12"
                      markerHeight="12"
                      refX="10"
                      refY="6"
                      orient="auto"
                      markerUnits="strokeWidth"
                    >
                      <path d="M2,2 L10,6 L2,10 Z" fill={itemColor} />
                    </marker>
                    <marker
                      id={dotMarkerIdForColor(itemColor)}
                      markerWidth="8"
                      markerHeight="8"
                      refX="4"
                      refY="4"
                      markerUnits="strokeWidth"
                    >
                      <circle cx="4" cy="4" r="3" fill={itemColor} />
                    </marker>
                  </g>
                ))}
                <filter id="texture-bw-filter">
                  <feColorMatrix type="saturate" values="0" />
                  <feComponentTransfer>
                    <feFuncR type="linear" slope="1.15" intercept="-0.04" />
                    <feFuncG type="linear" slope="1.15" intercept="-0.04" />
                    <feFuncB type="linear" slope="1.15" intercept="-0.04" />
                  </feComponentTransfer>
                </filter>
                <pattern id="fill-material-deck" width="34" height="34" patternUnits="userSpaceOnUse">
                  <rect width="34" height="34" fill="#fff" />
                  <rect x="0" y="0" width="15" height="34" fill="#f1f5f9" />
                  <rect x="16" y="0" width="16" height="34" fill="#fff" />
                  <line x1="16" y1="0" x2="16" y2="34" stroke="#111827" strokeWidth="2" opacity="0.8" />
                  <line x1="33" y1="0" x2="33" y2="34" stroke="#475569" strokeWidth="1.5" opacity="0.65" />
                </pattern>
                <pattern id="fill-material-gravel" width="42" height="42" patternUnits="userSpaceOnUse">
                  <rect width="42" height="42" fill="#fff" />
                  <circle cx="8" cy="11" r="3" fill="#111827" opacity="0.72" />
                  <circle cx="23" cy="8" r="2.4" fill="#94a3b8" opacity="0.9" />
                  <circle cx="34" cy="19" r="3.3" fill="#0f172a" opacity="0.58" />
                  <circle cx="15" cy="31" r="2.8" fill="#64748b" opacity="0.78" />
                  <circle cx="31" cy="35" r="2.2" fill="#111827" opacity="0.62" />
                </pattern>
                <pattern id="fill-material-concrete" width="48" height="48" patternUnits="userSpaceOnUse">
                  <rect width="48" height="48" fill="#f8fafc" />
                  <circle cx="10" cy="14" r="1.2" fill="#64748b" opacity="0.65" />
                  <circle cx="33" cy="11" r="1" fill="#cbd5e1" opacity="0.9" />
                  <circle cx="22" cy="32" r="1.4" fill="#64748b" opacity="0.55" />
                  <path d="M2 40 C 12 35, 20 44, 31 38 S 43 37, 48 33" stroke="#94a3b8" strokeWidth="1" fill="none" opacity="0.8" />
                </pattern>
                <pattern id="fill-material-soil" width="44" height="44" patternUnits="userSpaceOnUse">
                  <rect width="44" height="44" fill="#fff" />
                  <circle cx="9" cy="12" r="3" fill="#111827" opacity="0.82" />
                  <circle cx="27" cy="10" r="2" fill="#475569" opacity="0.48" />
                  <circle cx="35" cy="28" r="3.4" fill="#0f172a" opacity="0.55" />
                  <circle cx="15" cy="34" r="2.5" fill="#64748b" opacity="0.8" />
                </pattern>
                {fillTextureLibrary.map((texture) => {
                  const href = svgToDataUrl(texture.svg);
                  return href ? (
                    <pattern key={texture.key} id={`fill-material-${texture.key}`} width="56" height="56" patternUnits="userSpaceOnUse">
                      <rect width="56" height="56" fill="#fff" />
                      <image href={href} x="0" y="0" width="56" height="56" preserveAspectRatio="xMidYMid slice" filter="url(#texture-bw-filter)" />
                    </pattern>
                  ) : null;
                })}
                <filter id="label-shadow" x="-20%" y="-30%" width="140%" height="160%">
                  <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#0f172a" floodOpacity="0.13" />
                </filter>
	              </defs>
	              <rect width={CANVAS_W} height={CANVAS_H} fill="#f8fafc" />
	              {isRoughPlan ? (
                  <g>
                    <rect x="0" y="0" width={CANVAS_W} height={CANVAS_H} fill="#ffffff" />
                    <rect
                      x={roughGeometry.x}
                      y={roughGeometry.y}
                      width={roughGeometry.widthPx}
                      height={roughGeometry.heightPx}
                      fill="#f8fafc"
                      stroke="#334155"
                      strokeWidth="3"
                    />
                    {Array.from({ length: Math.floor(roughGeometry.widthUnits) + 1 }).map((_, index) => {
                      const x = roughGeometry.x + index * roughGeometry.scale;
                      return (
                        <line
                          key={`rough-grid-x-${index}`}
                          x1={x}
                          y1={roughGeometry.y}
                          x2={x}
                          y2={roughGeometry.y + roughGeometry.heightPx}
                          stroke={index % 5 === 0 ? "#94a3b8" : "#cbd5e1"}
                          strokeWidth={index % 5 === 0 ? "1.5" : "1"}
                        />
                      );
                    })}
                    {Array.from({ length: Math.floor(roughGeometry.lengthUnits) + 1 }).map((_, index) => {
                      const y = roughGeometry.y + index * roughGeometry.scale;
                      return (
                        <line
                          key={`rough-grid-y-${index}`}
                          x1={roughGeometry.x}
                          y1={y}
                          x2={roughGeometry.x + roughGeometry.widthPx}
                          y2={y}
                          stroke={index % 5 === 0 ? "#94a3b8" : "#cbd5e1"}
                          strokeWidth={index % 5 === 0 ? "1.5" : "1"}
                        />
                      );
                    })}
                    <text x="36" y="54" fill="#64748b" fontSize="20" fontWeight="700">
                      Plan: {roughPlan.width || 0} x {roughPlan.length || 0} {roughPlan.unit}
                    </text>
                  </g>
	              ) : backgroundUrl ? (
	                <image href={backgroundUrl} x="0" y="0" width={CANVAS_W} height={CANVAS_H} preserveAspectRatio="xMidYMid meet" />
	              ) : (
	                <g>
	                  <rect x="0" y="0" width={CANVAS_W} height={CANVAS_H} fill="#f8fafc" />
	                  <text x="600" y="355" textAnchor="middle" fill="#64748b" fontSize="30" fontWeight="700">
	                    Upload a photo, floor plan, or sketch
	                  </text>
                  <text x="600" y="395" textAnchor="middle" fill="#94a3b8" fontSize="20">
                    Then draw boxes, arrows, notes, and measurements over it.
	                  </text>
	                </g>
	              )}

	              {layeredAnnotations.map((item) =>
                renderAnnotation(item, {
                  selected: item.id === selectedForEditing?.id,
                  editing: item.id === editingTextId,
                  onPointerDown:
                    item.id === penDraftId
                      ? undefined
                      : tool === "curve"
                        ? (event) => startCurveEdit(event, item)
                      : tool === "pen_add" && item.type === "pen"
                        ? (event) => addPenNode(event, item)
                      : tool === "pen_remove" && item.type === "pen"
                        ? (event) => removePenNode(event, item)
                      : tool === "pen" && item.type === "pen"
                        ? (event) => continuePenFromExisting(event, item)
                        : (event) => startMove(event, item),
                  onDoubleClick: item.id === penDraftId ? undefined : (event) => {
                    event.stopPropagation();
                    if (item.type === "text" || item.type === "measure") {
                      setSelectedId(item.id);
                      setEditingTextId(item.id);
                    }
                  },
                }),
              )}

              {penDraft && Array.isArray(penDraft.points) ? (
                <g className="editing-only pointer-events-none">
                  {penDraft.points.map((point, index) => {
                    const isStart = index === 0;
                    const isPreview = index === penDraft.points.length - 1;
                    return (
                      <g key={`pen-draft-node-${index}`}>
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r={isStart ? 10 : 7}
                          fill={isPreview && !isStart ? "#ffffff" : "#2563eb"}
                          stroke={isStart ? "#ffffff" : "#2563eb"}
                          strokeWidth={isStart ? "4" : "2"}
                        />
                        {isStart ? (
                          <circle
                            cx={point.x}
                            cy={point.y}
                            r="14"
                            fill="none"
                            stroke="#2563eb"
                            strokeWidth="2"
                            strokeDasharray="5 5"
                          />
                        ) : null}
                      </g>
                    );
                  })}
                </g>
              ) : null}

              {selectedForEditing ? (() => {
                const { x1, y1, x2, y2 } = displayBounds(selectedForEditing);
                return (
                  <g className="editing-only">
                    <rect
                      className="pointer-events-none"
                      x={x1 - 8}
                      y={y1 - 8}
                      width={Math.max(16, x2 - x1 + 16)}
                      height={Math.max(16, y2 - y1 + 16)}
                      fill="rgba(37,99,235,0.06)"
                      stroke="#2563eb"
                      strokeDasharray="12 8"
                      strokeWidth="3"
                    />
                    {visibleControlHandles.map((handle) => (
                      <g key={handle.key}>
                        {(handle.kind === "curve" && isLineLike(selectedForEditing)) || (["penCurve", "penCubic"].includes(handle.kind) && selectedForEditing?.type === "pen") ? (() => {
                          const penPoints = Array.isArray(selectedForEditing?.points) ? selectedForEditing.points : [];
                          let anchor = quadraticPoint(selectedForEditing, 0.5);
                          if (handle.kind === "penCurve") {
                            anchor = penSegmentAnchor(selectedForEditing, handle.index);
                          }
                          if (handle.kind === "penCubic") {
                            anchor = handle.target === "c1" ? penPoints[handle.index] : penPoints[handle.index + 1];
                          }
                          if (!anchor) return null;
                          return (
                            <line
                              className="pointer-events-none"
                              x1={anchor.x}
                              y1={anchor.y}
                              x2={handle.x}
                              y2={handle.y}
                              stroke="#2563eb"
                              strokeWidth="2"
                              strokeDasharray="6 5"
                              opacity="0.75"
                            />
                          );
                        })() : null}
                        <circle
                          className="cursor-pointer"
                          cx={handle.x}
                          cy={handle.y}
                          r={handle.kind === "curve" || handle.kind === "penCurve" || handle.kind === "penCubic" ? "14" : handle.kind === "cornerRadius" ? "10" : "11"}
                          fill={handle.kind === "curve" || handle.kind === "penCurve" || handle.kind === "penCubic" ? "#eff6ff" : handle.kind === "cornerRadius" ? "#fef3c7" : "#ffffff"}
                          stroke={handle.kind === "cornerRadius" ? "#d97706" : "#2563eb"}
                          strokeWidth={handle.kind === "curve" || handle.kind === "penCurve" || handle.kind === "penCubic" ? "4" : "3"}
                          aria-label={["penCurve", "penCubic"].includes(handle.kind) ? "Curve handle. Hold Shift for semicircle curve." : handle.label}
                          onPointerDown={(event) =>
                            tool === "curve" && ["endpoint", "corner"].includes(handle.kind)
                              ? startCurveHandleActivation(event, handle)
                              : tool === "pen_remove" && selectedForEditing?.type === "pen" && handle.kind === "point"
                              ? removePenNode(event, selectedForEditing, handle.index)
                              : tool === "pen" && selectedForEditing?.type === "pen" && handle.kind === "point"
                              ? continuePenFromNode(event, selectedForEditing, handle.index)
                              : startHandleMove(event, handle, {
                                  preserveTool: tool === "curve",
                                })
                          }
                        />
                        <circle
                          className="pointer-events-none"
                          cx={handle.x}
                          cy={handle.y}
                          r="3"
                          fill={handle.kind === "cornerRadius" ? "#d97706" : "#2563eb"}
                        />
                      </g>
                    ))}
                  </g>
                );
              })() : null}
              </svg>
              {selectedDeletePosition ? (
                <button
                  type="button"
                  aria-label="Delete selected element"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    deleteSelected();
                  }}
                  className="absolute z-30 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-slate-950/85 text-white shadow-xl ring-1 ring-white/20 transition hover:bg-red-600"
                  style={selectedDeletePosition}
                >
                  <SymbolIcon name="delete" className="text-[18px]" />
                </button>
              ) : null}
              {editingSelectedText ? (
                <textarea
                  value={selected.text || ""}
                  onChange={(event) => updateSelected({ text: event.target.value })}
                  rows={selected.type === "text" ? 3 : 1}
                  className="absolute z-30 min-h-9 w-48 resize rounded-lg border border-blue-300 bg-white/95 px-3 py-2 text-left text-sm font-semibold leading-snug text-slate-950 shadow-xl outline-none ring-4 ring-blue-500/15 placeholder:text-slate-400"
                  placeholder={selected.type === "measure" ? "12 ft" : "Add note"}
                  style={{
                    left: `${((selectedLabelPosition.x - viewport.x) / viewport.width) * 100}%`,
                    top: `${((selectedLabelPosition.y - viewport.y) / viewport.height) * 100}%`,
                    transform: "translate(-50%, -50%)",
                    width: selectedTextBox ? `${Math.max(160, selectedTextBox.width + 22)}px` : undefined,
                    minHeight: selectedTextBox ? `${Math.max(38, selectedTextBox.height + 12)}px` : undefined,
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  onPointerMove={(event) => event.stopPropagation()}
                  onPointerUp={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  onDoubleClick={(event) => event.stopPropagation()}
                  onBlur={(event) => {
                    updateSelected({ text: normalizeMarkupText(event.target.value) });
                    setEditingTextId("");
                  }}
                />
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
