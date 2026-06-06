// =======================================
// file: frontend/src/pages/ProjectMarkupCanvas.jsx
// Redesigned project markup canvas (annotation editor)
// =======================================
import { useCallback, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SymbolIcon } from "../ui";

const TOOLS = [
  { id: "select", icon: "arrow_selector_tool", label: "Select" },
  { id: "measure", icon: "straighten", label: "Measure" },
  { id: "rect", icon: "crop_square", label: "Rectangle" },
  { id: "arrow", icon: "north_east", label: "Arrow" },
  { id: "text", icon: "title", label: "Text" },
  { id: "circle", icon: "circle", label: "Ellipse" },
];

const LAYER_COLORS = {
  homeowner: "#2563eb",
  contractor: "#0f766e",
};

function uid() {
  return `a_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export default function ProjectMarkupCanvas() {
  const navigate = useNavigate();
  const svgRef = useRef(null);

  const [tool, setTool] = useState("select");
  const [activeLayer, setActiveLayer] = useState("homeowner");
  const [layerVisible, setLayerVisible] = useState({ homeowner: true, contractor: true });
  const [background, setBackground] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [history, setHistory] = useState([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [draft, setDraft] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const fileInputRef = useRef(null);

  const pushHistory = useCallback(
    (next) => {
      const trimmed = history.slice(0, historyIndex + 1);
      const newHistory = [...trimmed, next];
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      setAnnotations(next);
    },
    [history, historyIndex]
  );

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const idx = historyIndex - 1;
      setHistoryIndex(idx);
      setAnnotations(history[idx]);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const idx = historyIndex + 1;
      setHistoryIndex(idx);
      setAnnotations(history[idx]);
    }
  }, [history, historyIndex]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  function getPoint(e) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 1000,
      y: ((e.clientY - rect.top) / rect.height) * 750,
    };
  }

  function handlePointerDown(e) {
    if (tool === "select") {
      setSelectedId(null);
      return;
    }
    const p = getPoint(e);
    setDraft({
      id: uid(),
      type: tool,
      layer: activeLayer,
      color: LAYER_COLORS[activeLayer],
      x1: p.x,
      y1: p.y,
      x2: p.x,
      y2: p.y,
      label: tool === "measure" ? '0"' : tool === "text" ? "Text" : "",
    });
  }

  function handlePointerMove(e) {
    if (!draft) return;
    const p = getPoint(e);
    setDraft((d) => {
      const next = { ...d, x2: p.x, y2: p.y };
      if (d.type === "measure") {
        const dist = Math.round(Math.hypot(p.x - d.x1, p.y - d.y1) / 10);
        next.label = `${dist}"`;
      }
      return next;
    });
  }

  function handlePointerUp() {
    if (!draft) return;
    const dragged = Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1) > 5;
    if (dragged || draft.type === "text") {
      pushHistory([...annotations, draft]);
    }
    setDraft(null);
    setTool("select");
  }

  function clearAnnotations() {
    if (annotations.length === 0) return;
    pushHistory([]);
  }

  function handleUploadBackground(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setBackground(url);
  }

  const visibleAnnotations = useMemo(
    () => annotations.filter((a) => layerVisible[a.layer]),
    [annotations, layerVisible]
  );

  function renderAnnotation(a, isDraft = false) {
    const stroke = a.color || "#0f172a";
    const opacity = isDraft ? 0.7 : 1;
    const selected = a.id === selectedId;
    const common = {
      stroke,
      strokeWidth: selected ? 4 : 3,
      fill: "none",
      opacity,
      style: { cursor: tool === "select" ? "pointer" : "crosshair" },
      onClick: (e) => {
        if (tool === "select") {
          e.stopPropagation();
          setSelectedId(a.id);
        }
      },
    };

    const minX = Math.min(a.x1, a.x2);
    const minY = Math.min(a.y1, a.y2);
    const w = Math.abs(a.x2 - a.x1);
    const h = Math.abs(a.y2 - a.y1);

    switch (a.type) {
      case "rect":
        return <rect key={a.id} x={minX} y={minY} width={w} height={h} rx={6} {...common} />;
      case "circle":
        return (
          <ellipse
            key={a.id}
            cx={(a.x1 + a.x2) / 2}
            cy={(a.y1 + a.y2) / 2}
            rx={w / 2}
            ry={h / 2}
            {...common}
          />
        );
      case "arrow":
        return (
          <g key={a.id}>
            <defs>
              <marker
                id={`arrow-${a.id}`}
                markerWidth="10"
                markerHeight="10"
                refX="8"
                refY="3"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M0,0 L8,3 L0,6 Z" fill={stroke} />
              </marker>
            </defs>
            <line
              x1={a.x1}
              y1={a.y1}
              x2={a.x2}
              y2={a.y2}
              markerEnd={`url(#arrow-${a.id})`}
              {...common}
            />
          </g>
        );
      case "measure":
        return (
          <g key={a.id} opacity={opacity}>
            <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} stroke={stroke} strokeWidth={2} />
            <line x1={a.x1} y1={a.y1 - 8} x2={a.x1} y2={a.y1 + 8} stroke={stroke} strokeWidth={2} />
            <line x1={a.x2} y1={a.y2 - 8} x2={a.x2} y2={a.y2 + 8} stroke={stroke} strokeWidth={2} />
            <g transform={`translate(${(a.x1 + a.x2) / 2}, ${(a.y1 + a.y2) / 2})`}>
              <rect x={-22} y={-14} width={44} height={24} rx={6} fill="#0f172a" />
              <text textAnchor="middle" dy={3} fill="#fff" fontSize={14} fontWeight={600}>
                {a.label}
              </text>
            </g>
          </g>
        );
      case "text":
        return (
          <g key={a.id} opacity={opacity} onClick={common.onClick}>
            <rect
              x={a.x1}
              y={a.y1 - 18}
              width={Math.max(60, (a.label?.length || 4) * 9)}
              height={26}
              rx={6}
              fill="#0f172a"
              opacity={0.92}
            />
            <text x={a.x1 + 8} y={a.y1 - 1} fill="#fff" fontSize={14}>
              {a.label}
            </text>
          </g>
        );
      default:
        return null;
    }
  }

  const annotationCount = annotations.length;

  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col bg-slate-100">
      {/* Top action bar */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              aria-label="Back to planner"
            >
              <SymbolIcon name="arrow_back" className="text-[22px]" />
            </button>
            <div>
              <h1 className="text-lg font-bold leading-tight text-slate-900">Markup canvas</h1>
              <p className="text-xs text-slate-500">Mark the area that needs work</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Undo / Redo */}
            <div className="flex items-center rounded-xl border border-slate-200 bg-white p-0.5">
              <button
                type="button"
                onClick={undo}
                disabled={!canUndo}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 disabled:opacity-30"
                aria-label="Undo"
              >
                <SymbolIcon name="undo" className="text-[20px]" />
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={!canRedo}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 disabled:opacity-30"
                aria-label="Redo"
              >
                <SymbolIcon name="redo" className="text-[20px]" />
              </button>
            </div>

            <button
              type="button"
              className="hidden h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:inline-flex"
            >
              <SymbolIcon name="download" className="text-[18px]" />
              Export
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              <SymbolIcon name="check" className="text-[18px]" />
              Save &amp; back
            </button>
          </div>
        </div>
      </div>

      {/* Main workspace */}
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-4 p-4 sm:px-6 lg:flex-row">
        {/* Left control rail */}
        <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-72">
          {/* Background */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-1 text-sm font-semibold text-slate-900">Background</h2>
            <p className="mb-3 text-xs text-slate-500">Use a room photo, floor plan, or sketch.</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUploadBackground}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              <SymbolIcon name="upload" className="text-[18px]" />
              Upload background
            </button>
            {background && (
              <button
                type="button"
                onClick={() => setBackground(null)}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
              >
                <SymbolIcon name="delete" className="text-[18px]" />
                Remove background
              </button>
            )}
          </section>

          {/* Layers */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Layers</h2>
            <div className="space-y-2">
              {["homeowner", "contractor"].map((layer) => {
                const isActive = activeLayer === layer;
                return (
                  <div
                    key={layer}
                    className={
                      "flex items-center justify-between rounded-xl border px-3 py-2.5 transition " +
                      (isActive ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white")
                    }
                  >
                    <button
                      type="button"
                      onClick={() => setActiveLayer(layer)}
                      className="flex flex-1 items-center gap-2.5 text-left"
                    >
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: LAYER_COLORS[layer] }}
                      />
                      <span className="text-sm font-medium capitalize text-slate-800">{layer}</span>
                      {isActive && (
                        <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                          Editing
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setLayerVisible((v) => ({ ...v, [layer]: !v[layer] }))
                      }
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-200"
                      aria-label={`Toggle ${layer} visibility`}
                    >
                      <SymbolIcon
                        name={layerVisible[layer] ? "visibility" : "visibility_off"}
                        className="text-[18px]"
                      />
                    </button>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={clearAnnotations}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <SymbolIcon name="ink_eraser" className="text-[18px]" />
              Clear annotations
            </button>
          </section>

          {/* Stats */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Annotations</span>
              <span className="text-sm font-semibold text-slate-900">{annotationCount}</span>
            </div>
          </section>
        </aside>

        {/* Canvas area */}
        <main className="flex min-h-[60vh] flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Canvas header + floating toolbar */}
          <div className="relative flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-medium text-slate-600">Planner: Untitled issue</span>

            {/* Floating toolbar */}
            <div className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-2xl bg-slate-900 p-1.5 shadow-lg">
              {TOOLS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTool(t.id)}
                  title={t.label}
                  className={
                    "inline-flex h-9 w-9 items-center justify-center rounded-xl transition " +
                    (tool === t.id
                      ? "bg-blue-600 text-white"
                      : "text-slate-300 hover:bg-white/10 hover:text-white")
                  }
                  aria-label={t.label}
                  aria-pressed={tool === t.id}
                >
                  <SymbolIcon name={t.icon} className="text-[20px]" fill={t.id === "circle" ? 0 : 0} />
                </button>
              ))}
            </div>

            <span className="text-sm text-slate-400">{annotationCount} annotations</span>
          </div>

          {/* Drawing surface */}
          <div className="relative flex flex-1 items-center justify-center bg-slate-50 p-4">
            <div className="relative w-full max-w-4xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              {background ? (
                <img
                  src={background}
                  alt="Markup background"
                  className="pointer-events-none block w-full select-none"
                />
              ) : (
                <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 bg-slate-100 text-slate-400">
                  <SymbolIcon name="add_photo_alternate" className="text-[48px]" />
                  <p className="text-sm">Upload a background to start marking up</p>
                </div>
              )}

              <svg
                ref={svgRef}
                viewBox="0 0 1000 750"
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full"
                style={{ cursor: tool === "select" ? "default" : "crosshair", touchAction: "none" }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              >
                {visibleAnnotations.map((a) => renderAnnotation(a))}
                {draft && renderAnnotation(draft, true)}
              </svg>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
