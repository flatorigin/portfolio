export const MARKUP_CANVAS_WIDTH = 1200;
export const MARKUP_CANVAS_HEIGHT = 760;

const DEFAULT_MARKUP_COLOR = "#2563eb";
const DEFAULT_STROKE_WIDTH = 4;
const DEFAULT_ERASER_WIDTH = 34;
const DEFAULT_STROKE_OPACITY = 1;
const DEFAULT_FILL_OPACITY = 0.18;
const MARKUP_LABEL_FONT_SIZE = 10;
const MARKUP_MEASURE_FONT_SIZE = 10;
const MARKUP_SEGMENT_FONT_SIZE = 9;
const STANDARD_FILL_MATERIALS = new Set(["flat", "deck", "gravel", "concrete", "soil"]);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeMarkupText(value) {
  return String(value || "").replace(/[ \t]+$/gm, "").replace(/\s+$/g, "");
}

function formatPlanNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return String(Number.isInteger(number) ? number : Number(number.toFixed(2)));
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

function isFillMaterialKey(value) {
  const key = String(value || "");
  return STANDARD_FILL_MATERIALS.has(key) || key.startsWith("custom-");
}

function styleFor(item) {
  const strokeColor = item.strokeColor || item.color || DEFAULT_MARKUP_COLOR;
  const fillColor = item.fillColor || item.color || strokeColor;
  const fillMaterial = isFillMaterialKey(item.fillMaterial) ? item.fillMaterial : "flat";
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
    strokeDasharray: item.strokeStyle === "dashed" ? "12 8" : undefined,
  };
}

function strokeWidthFor(item) {
  if (item?.type === "background_eraser") {
    return clamp(Number(item.strokeWidth) || DEFAULT_ERASER_WIDTH, 8, 96);
  }
  const fallback = item?.type === "measure" ? 5 : DEFAULT_STROKE_WIDTH;
  return clamp(Number(item?.strokeWidth) || fallback, 1, 18);
}

function markerIdForColor(color) {
  return `arrow-${String(color || DEFAULT_MARKUP_COLOR).replace(/[^a-z0-9]/gi, "")}`;
}

function dotMarkerIdForColor(color) {
  return `dot-${String(color || DEFAULT_MARKUP_COLOR).replace(/[^a-z0-9]/gi, "")}`;
}

function annotationBounds(item) {
  if (["freehand", "pen", "background_eraser"].includes(item?.type) && Array.isArray(item.points) && item.points.length) {
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
    return {
      x1: Math.min(...points.map((point) => point.x)),
      y1: Math.min(...points.map((point) => point.y)),
      x2: Math.max(...points.map((point) => point.x)),
      y2: Math.max(...points.map((point) => point.y)),
    };
  }
  const x = item?.x || 0;
  const y = item?.y || 0;
  const x2 = item?.x2 ?? x;
  const y2 = item?.y2 ?? y;
  return {
    x1: Math.min(x, x2),
    y1: Math.min(y, y2),
    x2: Math.max(x, x2),
    y2: Math.max(y, y2),
  };
}

function curveControlPoint(item) {
  return item?.curvePoint && typeof item.curvePoint === "object"
    ? item.curvePoint
    : {
        x: ((item?.x || 0) + (item?.x2 || item?.x || 0)) / 2,
        y: ((item?.y || 0) + (item?.y2 || item?.y || 0)) / 2,
      };
}

function quadraticPoint(item, t = 0.5) {
  const start = { x: item?.x || 0, y: item?.y || 0 };
  const end = { x: item?.x2 || item?.x || 0, y: item?.y2 || item?.y || 0 };
  if (!item?.curvePoint) {
    return { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t };
  }
  const control = curveControlPoint(item);
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
  const maxRadius = Math.min(Math.max(1, x2 - x1), Math.max(1, y2 - y1)) / 2;
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

function labelBox(text, fontSize = MARKUP_LABEL_FONT_SIZE) {
  const lines = wrappedTextLines(text);
  const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);
  const paddingX = Math.max(6, Math.round(fontSize * 0.58));
  const paddingY = Math.max(4, Math.round(fontSize * 0.38));
  const lineHeight = Math.round(fontSize * 1.28);
  return {
    width: Math.max(34, longest * fontSize * 0.52 + paddingX * 2),
    height: lines.length * lineHeight + paddingY * 2,
    paddingX,
    paddingY,
    lineHeight,
    lines,
  };
}

function formatSegmentLength(pxLength, geometry) {
  if (!Number.isFinite(pxLength) || pxLength <= 0) return "";
  if (!geometry?.scale) return `${Math.round(pxLength)} px`;
  const units = pxLength / geometry.scale;
  if (!Number.isFinite(units) || units <= 0) return "";
  const rounded = units >= 10 ? Math.round(units * 10) / 10 : Math.round(units * 100) / 100;
  return `${formatPlanNumber(rounded)} ${geometry.unit}`;
}

function shouldUseComputedMeasureLabel(text) {
  const normalized = normalizeMarkupText(text).toLowerCase();
  return !normalized || normalized === "measurement" || normalized === "measure";
}

function SegmentLengthLabel({ x, y, label, stroke }) {
  if (!label) return null;
  const box = labelBox(label, MARKUP_SEGMENT_FONT_SIZE);
  const labelX = x - box.width / 2;
  const labelY = y - box.height / 2;
  return (
    <g className="pointer-events-none">
      <rect x={labelX} y={labelY} width={box.width} height={box.height} rx="4" fill="rgba(255,255,255,0.78)" stroke={hexToRgba(stroke, 0.28)} strokeWidth="0.75" />
      <text x={labelX + box.paddingX} y={labelY + box.paddingY + MARKUP_SEGMENT_FONT_SIZE} fill="#0f172a" fontSize={MARKUP_SEGMENT_FONT_SIZE} fontWeight="550">
        {box.lines.map((line, index) => (
          <tspan key={`${label}-${index}`} x={labelX + box.paddingX} dy={index === 0 ? 0 : box.lineHeight}>{line}</tspan>
        ))}
      </text>
    </g>
  );
}

export function renderMarkupAnnotation(item, { selected = false, editing = false, locked = false, calibratedReference = false, onPointerDown, onPointerEnter, onPointerLeave, onDoubleClick, measurementGeometry = null, showSegmentLengths = false, liveLength = false } = {}) {
  const style = styleFor(item);
  const stroke = style.strokeColor;
  const strokeWidth = strokeWidthFor(item);
  const shouldShowLengths = showSegmentLengths || liveLength;
  const common = {
    key: item.id,
    onPointerDown: locked ? undefined : onPointerDown,
    onPointerEnter: locked ? undefined : onPointerEnter,
    onPointerLeave: locked ? undefined : onPointerLeave,
    onDoubleClick: locked ? undefined : onDoubleClick,
    className: locked ? "pointer-events-none cursor-default" : selected ? "cursor-move" : "cursor-pointer",
    opacity: locked ? 0.45 : undefined,
    pointerEvents: locked ? "none" : undefined,
  };

  if (item.type === "rect") {
    const bounds = annotationBounds(item);
    return <g {...common}><path d={roundedRectPath(bounds, rectCornerRadii(item, bounds))} fill={style.fill} fillOpacity={style.svgFillOpacity} stroke={stroke} strokeOpacity={style.strokeOpacity} strokeWidth={strokeWidth} strokeDasharray={style.strokeDasharray} /></g>;
  }

  if (item.type === "circle") {
    const { x1, y1, x2, y2 } = annotationBounds(item);
    return <ellipse {...common} cx={(x1 + x2) / 2} cy={(y1 + y2) / 2} rx={Math.max(10, Math.abs(x2 - x1) / 2)} ry={Math.max(10, Math.abs(y2 - y1) / 2)} fill={style.fill} fillOpacity={style.svgFillOpacity} stroke={stroke} strokeOpacity={style.strokeOpacity} strokeWidth={strokeWidth} strokeDasharray={style.strokeDasharray} />;
  }

  if (item.type === "background_eraser") {
    const d = (Array.isArray(item.points) ? item.points : []).map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
    return <g {...common}><path d={d} fill="none" stroke="transparent" strokeWidth={Math.max(18, strokeWidth + 10)} strokeLinecap="round" strokeLinejoin="round" pointerEvents="stroke" /><path d={d} fill="none" stroke="#ffffff" strokeOpacity={item.strokeOpacity ?? 1} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" /></g>;
  }

  if (item.type === "freehand" || item.type === "pen") {
    const points = Array.isArray(item.points) ? item.points : [];
    const d = item.type === "pen" ? penPathD(item) : points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
    return (
      <g {...common}>
        {item.type === "pen" ? <path d={d} fill="none" stroke="transparent" strokeWidth={Math.max(18, strokeWidth + 10)} strokeLinecap="round" strokeLinejoin="round" pointerEvents="stroke" /> : null}
        <path d={d} fill={item.type === "pen" && item.closed ? style.fill : "none"} fillOpacity={item.type === "pen" && item.closed ? style.svgFillOpacity : undefined} stroke={stroke} strokeOpacity={style.strokeOpacity} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={style.strokeDasharray} markerStart={item.startEndpoint === "arrow" ? `url(#${markerIdForColor(stroke)})` : item.startEndpoint === "dot" ? `url(#${dotMarkerIdForColor(stroke)})` : undefined} markerEnd={item.endEndpoint === "arrow" ? `url(#${markerIdForColor(stroke)})` : item.endEndpoint === "dot" ? `url(#${dotMarkerIdForColor(stroke)})` : undefined} />
        {shouldShowLengths && item.type === "pen" ? points.slice(0, -1).map((point, index) => {
          const nextPoint = points[index + 1];
          return <SegmentLengthLabel key={`${item.id}-segment-label-${index}`} x={(point.x + nextPoint.x) / 2} y={(point.y + nextPoint.y) / 2 - 18} label={formatSegmentLength(Math.hypot(point.x - nextPoint.x, point.y - nextPoint.y), measurementGeometry)} stroke={stroke} />;
        }) : null}
      </g>
    );
  }

  if (item.type === "priority") {
    return <g {...common}><circle cx={item.x || 0} cy={item.y || 0} r="26" fill={style.fill} fillOpacity={style.svgFillOpacity} stroke={stroke} strokeOpacity={style.strokeOpacity} strokeWidth={strokeWidth} strokeDasharray={style.strokeDasharray} /><text x={item.x || 0} y={(item.y || 0) + 7} textAnchor="middle" fill={stroke} fontSize="24" fontWeight="700">{item.priorityNumber || 1}</text></g>;
  }

  if (["line", "arrow", "measure"].includes(item.type)) {
    const markerStart = item.startEndpoint === "arrow" ? `url(#${markerIdForColor(stroke)})` : item.startEndpoint === "dot" ? `url(#${dotMarkerIdForColor(stroke)})` : undefined;
    const markerEnd = item.type === "arrow" || item.endEndpoint === "arrow" ? `url(#${markerIdForColor(stroke)})` : item.endEndpoint === "dot" ? `url(#${dotMarkerIdForColor(stroke)})` : undefined;
    const labelPoint = quadraticPoint(item, 0.5);
    const dx = (item.x2 || 0) - (item.x || 0);
    const dy = (item.y2 || 0) - (item.y || 0);
    const length = Math.hypot(dx, dy) || 1;
    const capX = (-dy / length) * 22;
    const capY = (dx / length) * 22;
    const computedLabel = formatSegmentLength(length, measurementGeometry);
    const label = item.type === "measure" && shouldShowLengths && shouldUseComputedMeasureLabel(item.text) ? computedLabel : item.type === "line" && shouldShowLengths ? computedLabel || item.text || "" : item.text || "measurement";
    const box = labelBox(label, MARKUP_MEASURE_FONT_SIZE);
    const labelX = labelPoint.x - box.width / 2;
    const labelY = labelPoint.y - box.height - 5;
    return (
      <g {...common}>
        {calibratedReference ? <path d={linePathD(item)} fill="none" stroke="#10b981" strokeOpacity="0.95" strokeWidth={Math.max(strokeWidth + 7, 10)} strokeLinecap="round" strokeDasharray="8 6" pointerEvents="none" /> : null}
        <path d={linePathD(item)} fill="none" stroke="transparent" strokeWidth={Math.max(10, strokeWidth + 8)} strokeLinecap="round" pointerEvents="stroke" />
        <path d={linePathD(item)} fill="none" stroke={stroke} strokeOpacity={style.strokeOpacity} strokeWidth={strokeWidth} strokeLinecap="round" markerStart={markerStart} markerEnd={markerEnd} strokeDasharray={style.strokeDasharray} />
        {item.type === "measure" ? <><line x1={(item.x || 0) - capX} y1={(item.y || 0) - capY} x2={(item.x || 0) + capX} y2={(item.y || 0) + capY} stroke={stroke} strokeOpacity={style.strokeOpacity} strokeWidth={strokeWidth} strokeLinecap="square" strokeDasharray={style.strokeDasharray} /><line x1={(item.x2 || 0) - capX} y1={(item.y2 || 0) - capY} x2={(item.x2 || 0) + capX} y2={(item.y2 || 0) + capY} stroke={stroke} strokeOpacity={style.strokeOpacity} strokeWidth={strokeWidth} strokeLinecap="square" strokeDasharray={style.strokeDasharray} /></> : null}
        {((item.type === "measure" && (liveLength || item.text || showSegmentLengths)) || (item.type === "line" && shouldShowLengths)) && !editing && label ? <g><rect x={labelPoint.x - box.width / 2} y={labelY} width={box.width} height={box.height} rx="5" fill="rgba(255,255,255,0.76)" stroke={hexToRgba(stroke, 0.34)} strokeWidth="0.85" /><text x={labelX + box.paddingX} y={labelY + box.paddingY + MARKUP_MEASURE_FONT_SIZE} fill="#0f172a" fontSize={MARKUP_MEASURE_FONT_SIZE} fontWeight="550">{box.lines.map((line, index) => <tspan key={`${item.id}-line-${index}`} x={labelX + box.paddingX} dy={index === 0 ? 0 : box.lineHeight}>{line}</tspan>)}</text></g> : null}
        {calibratedReference ? <SegmentLengthLabel x={labelPoint.x} y={labelY - 18} label="Reference" stroke="#059669" /> : null}
      </g>
    );
  }

  if (["door", "window", "tree", "steps", "fence"].includes(item.type)) {
    const x = item.x || 0;
    const y = item.y || 0;
    if (item.type === "door") return <g {...common}><path d={`M ${x - 26} ${y + 28} L ${x - 26} ${y - 26} L ${x + 28} ${y - 26}`} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" /><path d={`M ${x - 24} ${y + 24} A 54 54 0 0 1 ${x + 28} ${y - 26}`} fill="none" stroke={stroke} strokeWidth={Math.max(2, strokeWidth - 1)} strokeDasharray="7 7" /></g>;
    if (item.type === "window") return <g {...common}><rect x={x - 32} y={y - 12} width="64" height="24" rx="3" fill="rgba(255,255,255,0.9)" stroke={stroke} strokeWidth={strokeWidth} /><line x1={x} y1={y - 12} x2={x} y2={y + 12} stroke={stroke} strokeWidth={Math.max(2, strokeWidth - 1)} /></g>;
    if (item.type === "tree") return <g {...common}><circle cx={x} cy={y - 8} r="28" fill={hexToRgba(stroke, 0.16)} stroke={stroke} strokeWidth={strokeWidth} /><path d={`M ${x} ${y + 20} L ${x} ${y + 36}`} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" /></g>;
    if (item.type === "steps") return <g {...common}>{[0, 1, 2, 3].map((index) => <rect key={`${item.id}-step-${index}`} x={x - 34 + index * 16} y={y - 24 + index * 12} width="48" height="10" fill="rgba(255,255,255,0.92)" stroke={stroke} strokeWidth={Math.max(2, strokeWidth - 1)} />)}</g>;
    return <g {...common}><line x1={x - 34} y1={y - 18} x2={x + 34} y2={y - 18} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" /><line x1={x - 34} y1={y + 18} x2={x + 34} y2={y + 18} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />{[-24, 0, 24].map((offset) => <line key={`${item.id}-post-${offset}`} x1={x + offset} y1={y - 30} x2={x + offset} y2={y + 30} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />)}</g>;
  }

  const label = item.text || "Note";
  const box = labelBox(label, MARKUP_LABEL_FONT_SIZE);
  const labelX = (item.x || 0) - box.paddingX;
  const labelY = (item.y || 0) - box.height + 7;
  if (editing) return <g key={item.id} onPointerDown={locked ? undefined : onPointerDown} onDoubleClick={locked ? undefined : onDoubleClick} className={locked ? "pointer-events-none cursor-default" : selected ? "cursor-move" : "cursor-pointer"} opacity={locked ? 0.45 : undefined} pointerEvents={locked ? "none" : undefined} />;
  return <g {...common}><rect x={labelX} y={labelY} width={box.width} height={box.height} rx="5" fill="rgba(255,255,255,0.76)" stroke={hexToRgba(stroke, 0.34)} strokeWidth="0.85" strokeDasharray={style.strokeDasharray} /><text x={labelX + box.paddingX} y={labelY + box.paddingY + MARKUP_LABEL_FONT_SIZE} fill="#0f172a" fontSize={MARKUP_LABEL_FONT_SIZE} fontWeight="550">{box.lines.map((line, index) => <tspan key={`${item.id}-line-${index}`} x={labelX + box.paddingX} dy={index === 0 ? 0 : box.lineHeight}>{line}</tspan>)}</text></g>;
}

function MarkupCanvasDefs({ colors }) {
  return (
    <defs>
      {colors.map((color) => <g key={color}><marker id={markerIdForColor(color)} markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="strokeWidth"><path d="M2,2 L10,6 L2,10 Z" fill={color} /></marker><marker id={dotMarkerIdForColor(color)} markerWidth="8" markerHeight="8" refX="4" refY="4" markerUnits="strokeWidth"><circle cx="4" cy="4" r="3" fill={color} /></marker></g>)}
      <pattern id="fill-material-deck" width="34" height="34" patternUnits="userSpaceOnUse"><rect width="34" height="34" fill="#fff" /><rect x="0" y="0" width="15" height="34" fill="#f1f5f9" /><rect x="16" y="0" width="16" height="34" fill="#fff" /><line x1="16" y1="0" x2="16" y2="34" stroke="#111827" strokeWidth="2" opacity="0.8" /><line x1="33" y1="0" x2="33" y2="34" stroke="#475569" strokeWidth="1.5" opacity="0.65" /></pattern>
      <pattern id="fill-material-gravel" width="42" height="42" patternUnits="userSpaceOnUse"><rect width="42" height="42" fill="#fff" /><circle cx="8" cy="11" r="3" fill="#111827" opacity="0.72" /><circle cx="23" cy="8" r="2.4" fill="#94a3b8" opacity="0.9" /><circle cx="34" cy="19" r="3.3" fill="#0f172a" opacity="0.58" /><circle cx="15" cy="31" r="2.8" fill="#64748b" opacity="0.78" /><circle cx="31" cy="35" r="2.2" fill="#111827" opacity="0.62" /></pattern>
      <pattern id="fill-material-concrete" width="48" height="48" patternUnits="userSpaceOnUse"><rect width="48" height="48" fill="#f8fafc" /><circle cx="10" cy="14" r="1.2" fill="#64748b" opacity="0.65" /><circle cx="33" cy="11" r="1" fill="#cbd5e1" opacity="0.9" /><circle cx="22" cy="32" r="1.4" fill="#64748b" opacity="0.55" /><path d="M2 40 C 12 35, 20 44, 31 38 S 43 37, 48 33" stroke="#94a3b8" strokeWidth="1" fill="none" opacity="0.8" /></pattern>
      <pattern id="fill-material-soil" width="44" height="44" patternUnits="userSpaceOnUse"><rect width="44" height="44" fill="#fff" /><circle cx="9" cy="12" r="3" fill="#111827" opacity="0.82" /><circle cx="27" cy="10" r="2" fill="#475569" opacity="0.48" /><circle cx="35" cy="28" r="3.4" fill="#0f172a" opacity="0.55" /><circle cx="15" cy="34" r="2.5" fill="#64748b" opacity="0.8" /></pattern>
    </defs>
  );
}

function orderedVisibleItems(annotations, visibleLayers) {
  const rawItems = Array.isArray(annotations) ? annotations.filter(Boolean) : [];
  const visibleItems = rawItems.filter((item) => visibleLayers?.[item.id] !== false);
  return [...visibleItems.filter((item) => item.type === "background_eraser"), ...visibleItems.filter((item) => item.type !== "background_eraser")];
}

function annotationColors(items) {
  return Array.from(new Set([DEFAULT_MARKUP_COLOR, ...items.map((item) => styleFor(item).strokeColor)]));
}

export function getMarkupVersion(item) {
  const extraData = item?.extra_data && typeof item.extra_data === "object" ? item.extra_data : {};
  return extraData.markup_version && typeof extraData.markup_version === "object" ? extraData.markup_version : null;
}

export function getMarkupAnnotations(item) {
  const markupVersion = getMarkupVersion(item);
  return Array.isArray(markupVersion?.annotations) ? markupVersion.annotations : [];
}

export function MarkupCanvasPreview({ version = null, backgroundUrl = "", annotations = null, visibleLayers = null, lockedLayers = null, measurementCalibration = null, className = "", ariaLabel = "Saved project markup" }) {
  const savedAnnotations = annotations || version?.annotations || [];
  const savedVisibleLayers = visibleLayers || version?.visible_layers || {};
  const savedLockedLayers = lockedLayers || version?.locked_layers || {};
  const savedCalibration = measurementCalibration || version?.measurement_calibration || {};
  const resolvedBackgroundUrl = backgroundUrl || version?.background_url || "";
  const items = orderedVisibleItems(savedAnnotations, savedVisibleLayers);
  const measurementGeometry = Number(savedCalibration.scale || 0) > 0 ? { scale: Number(savedCalibration.scale), unit: savedCalibration.unit || "in" } : null;
  const referenceLineId = savedCalibration.referenceLineId || "";
  return (
    <svg className={`block bg-white ${className}`} viewBox={`0 0 ${MARKUP_CANVAS_WIDTH} ${MARKUP_CANVAS_HEIGHT}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={ariaLabel}>
      <MarkupCanvasDefs colors={annotationColors(items)} />
      <rect width={MARKUP_CANVAS_WIDTH} height={MARKUP_CANVAS_HEIGHT} fill="#f8fafc" />
      {resolvedBackgroundUrl ? <image href={resolvedBackgroundUrl} x="0" y="0" width={MARKUP_CANVAS_WIDTH} height={MARKUP_CANVAS_HEIGHT} preserveAspectRatio="xMidYMid meet" /> : null}
      {items.map((item) => renderMarkupAnnotation(item, { locked: !!savedLockedLayers[item.id], calibratedReference: item.id === referenceLineId, measurementGeometry, showSegmentLengths: true, liveLength: ["line", "measure", "pen"].includes(item.type) }))}
    </svg>
  );
}

export default function MarkupPresetOverlay({ annotations = [], visibleLayers = {}, lockedLayers = {}, measurementCalibration = {}, className = "" }) {
  const items = orderedVisibleItems(annotations, visibleLayers);
  if (!items.length) return null;
  const measurementGeometry = Number(measurementCalibration.scale || 0) > 0 ? { scale: Number(measurementCalibration.scale), unit: measurementCalibration.unit || "in" } : null;
  return (
    <svg className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} viewBox={`0 0 ${MARKUP_CANVAS_WIDTH} ${MARKUP_CANVAS_HEIGHT}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <MarkupCanvasDefs colors={annotationColors(items)} />
      {items.map((item) => renderMarkupAnnotation(item, { locked: !!lockedLayers[item.id], calibratedReference: item.id === measurementCalibration.referenceLineId, measurementGeometry, showSegmentLengths: true, liveLength: ["line", "measure", "pen"].includes(item.type) }))}
    </svg>
  );
}
