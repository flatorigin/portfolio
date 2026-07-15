const MARKUP_CANVAS_W = 1200;
const MARKUP_CANVAS_H = 760;

function markupColor(item) {
  return item?.strokeColor || item?.color || "#0f172a";
}

function markupFill(item) {
  return item?.fillColor ? `${item.fillColor}33` : "rgba(255,255,255,0.14)";
}

function markupBounds(item) {
  const x1 = Math.min(item?.x || 0, item?.x2 ?? item?.x ?? 0);
  const y1 = Math.min(item?.y || 0, item?.y2 ?? item?.y ?? 0);
  const x2 = Math.max(item?.x || 0, item?.x2 ?? item?.x ?? 0);
  const y2 = Math.max(item?.y || 0, item?.y2 ?? item?.y ?? 0);
  return { x1, y1, x2, y2 };
}

function markupLines(text) {
  const words = String(text || "Note").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return ["Note"];
  const lines = [];
  for (let index = 0; index < words.length; index += 5) {
    lines.push(words.slice(index, index + 5).join(" "));
  }
  return lines;
}

export function getMarkupVersion(item) {
  const extraData = item?.extra_data && typeof item.extra_data === "object" ? item.extra_data : {};
  return extraData.markup_version && typeof extraData.markup_version === "object"
    ? extraData.markup_version
    : null;
}

export function getMarkupAnnotations(item) {
  const markupVersion = getMarkupVersion(item);
  return Array.isArray(markupVersion?.annotations) ? markupVersion.annotations : [];
}

export default function MarkupPresetOverlay({ annotations = [], className = "" }) {
  const rawItems = Array.isArray(annotations) ? annotations.filter(Boolean) : [];
  const items = [
    ...rawItems.filter((item) => item.type === "background_eraser"),
    ...rawItems.filter((item) => item.type !== "background_eraser"),
  ];
  if (!items.length) return null;

  return (
    <svg
      className={"pointer-events-none absolute inset-0 h-full w-full " + className}
      viewBox={`0 0 ${MARKUP_CANVAS_W} ${MARKUP_CANVAS_H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <marker id="markup-preset-arrow" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
          <path d="M2,2 L10,6 L2,10 Z" fill="context-stroke" />
        </marker>
      </defs>
      {items.map((item, index) => {
        const key = item.id || `markup-${index}`;
        const stroke = markupColor(item);
        const dash = item.strokeStyle === "dashed" ? "10 8" : undefined;
        const { x1, y1, x2, y2 } = markupBounds(item);

        if (item.type === "rect") {
          return (
            <rect
              key={key}
              x={x1}
              y={y1}
              width={Math.max(1, x2 - x1)}
              height={Math.max(1, y2 - y1)}
              rx="10"
              fill={markupFill(item)}
              stroke={stroke}
              strokeWidth="8"
              strokeDasharray={dash}
            />
          );
        }

        if (item.type === "circle") {
          return (
            <ellipse
              key={key}
              cx={(x1 + x2) / 2}
              cy={(y1 + y2) / 2}
              rx={Math.max(10, Math.abs(x2 - x1) / 2)}
              ry={Math.max(10, Math.abs(y2 - y1) / 2)}
              fill={markupFill(item)}
              stroke={stroke}
              strokeWidth="8"
              strokeDasharray={dash}
            />
          );
        }

        if (item.type === "freehand" || item.type === "background_eraser") {
          const d = (Array.isArray(item.points) ? item.points : [])
            .map((point, pointIndex) => `${pointIndex === 0 ? "M" : "L"} ${point.x} ${point.y}`)
            .join(" ");
          return d ? (
            <path
              key={key}
              d={d}
              fill="none"
              stroke={item.type === "background_eraser" ? "#ffffff" : stroke}
              strokeWidth={item.type === "background_eraser" ? Math.max(18, Number(item.strokeWidth || 34)) : 8}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={dash}
            />
          ) : null;
        }

        if (item.type === "priority") {
          return (
            <g key={key}>
              <circle cx={item.x || 0} cy={item.y || 0} r="34" fill={markupFill(item)} stroke={stroke} strokeWidth="8" />
              <text x={item.x || 0} y={(item.y || 0) + 12} textAnchor="middle" fill={stroke} fontSize="42" fontWeight="700">
                {item.priorityNumber || 1}
              </text>
            </g>
          );
        }

        if (item.type === "arrow" || item.type === "measure") {
          const midX = ((item.x || 0) + (item.x2 || 0)) / 2;
          const midY = ((item.y || 0) + (item.y2 || 0)) / 2;
          return (
            <g key={key}>
              <line
                x1={item.x || 0}
                y1={item.y || 0}
                x2={item.x2 || 0}
                y2={item.y2 || 0}
                stroke={stroke}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={dash}
                markerEnd={item.type === "arrow" ? "url(#markup-preset-arrow)" : undefined}
              />
              {item.type === "measure" ? (
                <text x={midX} y={midY - 22} textAnchor="middle" fill={stroke} fontSize="34" fontWeight="700">
                  {item.text || "measurement"}
                </text>
              ) : null}
            </g>
          );
        }

        const lines = markupLines(item.text || "Note");
        return (
          <g key={key}>
            <rect
              x={(item.x || 0) - 14}
              y={(item.y || 0) - 52}
              width={Math.max(90, Math.max(...lines.map((line) => line.length)) * 18 + 28)}
              height={lines.length * 36 + 20}
              rx="12"
              fill={markupFill(item)}
              stroke={stroke}
              strokeWidth="6"
            />
            <text x={item.x || 0} y={(item.y || 0) - 20} fill={stroke} fontSize="32" fontWeight="700">
              {lines.map((line, lineIndex) => (
                <tspan key={`${key}-line-${lineIndex}`} x={item.x || 0} dy={lineIndex === 0 ? 0 : 36}>
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
