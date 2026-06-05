import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api";
import { Button, Card, GhostButton, Input, SymbolIcon } from "../ui";

const CANVAS_W = 1200;
const CANVAS_H = 760;
const STORAGE_PREFIX = "flatorigin_project_markup";

const TOOLS = [
  { key: "select", label: "Select", icon: "near_me" },
  { key: "rect", label: "Box", icon: "crop_square" },
  { key: "circle", label: "Circle", icon: "radio_button_unchecked" },
  { key: "arrow", label: "Arrow", icon: "arrow_right_alt" },
  { key: "measure", label: "Measure", icon: "straighten" },
  { key: "text", label: "Note", icon: "title" },
];

const LAYERS = [
  { key: "homeowner", label: "Homeowner", color: "#0f172a" },
  { key: "contractor", label: "Contractor", color: "#2563eb" },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeError(err, fallback) {
  const data = err?.response?.data;
  return data?.detail || data?.message || (data ? JSON.stringify(data) : "") || err?.message || fallback;
}

function pointFromEvent(event, svg) {
  const rect = svg.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * CANVAS_W;
  const y = ((event.clientY - rect.top) / rect.height) * CANVAS_H;
  return {
    x: clamp(Math.round(x), 0, CANVAS_W),
    y: clamp(Math.round(y), 0, CANVAS_H),
  };
}

function annotationBounds(item) {
  const x1 = Math.min(item.x, item.x2 ?? item.x);
  const y1 = Math.min(item.y, item.y2 ?? item.y);
  const x2 = Math.max(item.x, item.x2 ?? item.x);
  const y2 = Math.max(item.y, item.y2 ?? item.y);
  return { x1, y1, x2, y2 };
}

function renderAnnotation(item, { selected = false, onPointerDown } = {}) {
  const stroke = item.color || "#0f172a";
  const common = {
    key: item.id,
    onPointerDown,
    className: onPointerDown ? "cursor-move" : "",
  };

  if (item.type === "rect") {
    const { x1, y1, x2, y2 } = annotationBounds(item);
    return (
      <g {...common}>
        <rect
          x={x1}
          y={y1}
          width={Math.max(1, x2 - x1)}
          height={Math.max(1, y2 - y1)}
          rx="10"
          fill="rgba(255,255,255,0.08)"
          stroke={stroke}
          strokeWidth={selected ? 6 : 4}
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
        fill="rgba(255,255,255,0.08)"
        stroke={stroke}
        strokeWidth={selected ? 6 : 4}
      />
    );
  }

  if (item.type === "arrow" || item.type === "measure") {
    const marker = item.type === "arrow" ? `url(#arrow-${item.layer})` : undefined;
    const midX = ((item.x || 0) + (item.x2 || 0)) / 2;
    const midY = ((item.y || 0) + (item.y2 || 0)) / 2;
    return (
      <g {...common}>
        <line
          x1={item.x}
          y1={item.y}
          x2={item.x2}
          y2={item.y2}
          stroke={stroke}
          strokeWidth={selected ? 6 : 4}
          strokeLinecap="round"
          markerEnd={marker}
        />
        {item.type === "measure" ? (
          <text
            x={midX}
            y={midY - 10}
            textAnchor="middle"
            paintOrder="stroke"
            stroke="white"
            strokeWidth="8"
            fill={stroke}
            fontSize="30"
            fontWeight="700"
          >
            {item.text || "measurement"}
          </text>
        ) : null}
      </g>
    );
  }

  return (
    <text
      {...common}
      x={item.x}
      y={item.y}
      paintOrder="stroke"
      stroke="white"
      strokeWidth="8"
      fill={stroke}
      fontSize="32"
      fontWeight="700"
    >
      {item.text || "Note"}
    </text>
  );
}

export default function ProjectMarkupCanvas() {
  const { planId } = useParams();
  const svgRef = useRef(null);
  const fileRef = useRef(null);
  const [plan, setPlan] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(Boolean(planId));
  const [backgroundUrl, setBackgroundUrl] = useState("");
  const [annotations, setAnnotations] = useState([]);
  const [tool, setTool] = useState("rect");
  const [activeLayer, setActiveLayer] = useState("homeowner");
  const [visibleLayers, setVisibleLayers] = useState({ homeowner: true, contractor: true });
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState(null);
  const [drag, setDrag] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const storageKey = `${STORAGE_PREFIX}:${planId || "standalone"}`;

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || "{}");
      if (saved.backgroundUrl) setBackgroundUrl(saved.backgroundUrl);
      if (Array.isArray(saved.annotations)) setAnnotations(saved.annotations);
    } catch {
      // Ignore broken session drafts.
    }
  }, [storageKey]);

  useEffect(() => {
    sessionStorage.setItem(
      storageKey,
      JSON.stringify({ backgroundUrl, annotations }),
    );
  }, [annotations, backgroundUrl, storageKey]);

  useEffect(() => {
    if (!planId) return;
    let alive = true;
    setLoadingPlan(true);
    api
      .get(`/project-plans/${planId}/`)
      .then(({ data }) => {
        if (alive) setPlan(data);
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
  }, [planId]);

  const selected = useMemo(
    () => annotations.find((item) => item.id === selectedId) || null,
    [annotations, selectedId],
  );

  const color = LAYERS.find((item) => item.key === activeLayer)?.color || "#0f172a";

  function updateSelected(patch) {
    if (!selectedId) return;
    setAnnotations((prev) =>
      prev.map((item) => (item.id === selectedId ? { ...item, ...patch } : item)),
    );
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

  function startDrawing(event) {
    if (!svgRef.current) return;
    const point = pointFromEvent(event, svgRef.current);
    setMessage("");

    if (tool === "select") {
      setSelectedId("");
      return;
    }

    const id = `mark-${Date.now()}`;
    const base = {
      id,
      layer: activeLayer,
      type: tool,
      x: point.x,
      y: point.y,
      x2: point.x,
      y2: point.y,
      color,
      text: tool === "text" ? "Add note" : tool === "measure" ? "measurement" : "",
    };

    setAnnotations((prev) => [...prev, base]);
    setSelectedId(id);
    if (tool === "text") return;
    setDraft(id);
  }

  function moveDrawing(event) {
    if (!svgRef.current) return;
    const point = pointFromEvent(event, svgRef.current);

    if (draft) {
      setAnnotations((prev) =>
        prev.map((item) => (item.id === draft ? { ...item, x2: point.x, y2: point.y } : item)),
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
              }
            : item,
        ),
      );
    }
  }

  function stopPointer() {
    setDraft(null);
    setDrag(null);
  }

  function startMove(event, item) {
    event.stopPropagation();
    if (!svgRef.current) return;
    const point = pointFromEvent(event, svgRef.current);
    setTool("select");
    setSelectedId(item.id);
    setDrag({ id: item.id, startX: point.x, startY: point.y, item });
  }

  function deleteSelected() {
    if (!selectedId) return;
    setAnnotations((prev) => prev.filter((item) => item.id !== selectedId));
    setSelectedId("");
  }

  function clearCanvas() {
    if (!window.confirm("Clear all annotations on this canvas?")) return;
    setAnnotations([]);
    setSelectedId("");
  }

  function makeSvgString() {
    const clone = svgRef.current?.cloneNode(true);
    if (!clone) return "";
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.querySelectorAll(".editing-only").forEach((node) => node.remove());
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

  async function svgToPngBlob() {
    const svg = makeSvgString();
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
      await api.post(`/project-plans/${planId}/images/`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessage("Markup saved to this project planner.");
    } catch (err) {
      setMessage(normalizeError(err, "Could not save this markup. Try downloading SVG instead."));
    } finally {
      setSaving(false);
    }
  }

  const visibleAnnotations = annotations.filter((item) => visibleLayers[item.layer]);

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Link
            to={planId ? `/dashboard/planner/${planId}` : "/dashboard"}
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            {planId ? "Back to planner" : "Dashboard"}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Project markup canvas</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Upload a photo or plan, mark the area that needs work, and save the annotated image with the project.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <GhostButton type="button" onClick={downloadSvg}>Download SVG</GhostButton>
          <Button type="button" onClick={saveToPlanner} disabled={saving}>
            {saving ? "Saving..." : "Save to project"}
          </Button>
        </div>
      </div>

      {loadingPlan ? (
        <Card className="p-4 text-sm text-slate-500 shadow-none">Loading planner...</Card>
      ) : null}

      {message ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[260px,1fr]">
        <Card className="space-y-5 p-4 shadow-none">
          <div>
            <div className="text-sm font-semibold text-slate-900">Background</div>
            <p className="mt-1 text-xs text-slate-500">Use a room photo, floor plan, sketch, or screenshot.</p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            <Button type="button" className="mt-3 w-full" onClick={() => fileRef.current?.click()}>
              Upload background
            </Button>
            {backgroundUrl ? (
              <GhostButton type="button" className="mt-2 w-full" onClick={() => setBackgroundUrl("")}>
                Remove background
              </GhostButton>
            ) : null}
          </div>

          {plan?.images?.length ? (
            <div>
              <div className="text-sm font-semibold text-slate-900">Planner images</div>
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
            </div>
          ) : null}

          <div>
            <div className="text-sm font-semibold text-slate-900">Tools</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {TOOLS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTool(item.key)}
                  className={`inline-flex items-center justify-center gap-1 rounded-xl border px-2 py-2 text-xs font-medium transition ${
                    tool === item.key
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <SymbolIcon name={item.icon} className="text-[17px]" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-slate-900">Layer</div>
            <div className="mt-2 space-y-2">
              {LAYERS.map((layer) => (
                <div key={layer.key} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 p-2">
                  <button
                    type="button"
                    onClick={() => setActiveLayer(layer.key)}
                    className={`rounded-lg px-2 py-1 text-xs font-medium ${
                      activeLayer === layer.key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {layer.label}
                  </button>
                  <label className="flex items-center gap-2 text-xs text-slate-500">
                    <input
                      type="checkbox"
                      checked={!!visibleLayers[layer.key]}
                      onChange={() =>
                        setVisibleLayers((prev) => ({ ...prev, [layer.key]: !prev[layer.key] }))
                      }
                    />
                    show
                  </label>
                </div>
              ))}
            </div>
          </div>

          {selected ? (
            <div>
              <div className="text-sm font-semibold text-slate-900">Selected markup</div>
              {(selected.type === "text" || selected.type === "measure") ? (
                <Input
                  className="mt-2"
                  value={selected.text || ""}
                  onChange={(event) => updateSelected({ text: event.target.value })}
                  placeholder={selected.type === "measure" ? "12 ft" : "Add note"}
                />
              ) : null}
              <div className="mt-2 flex gap-2">
                <GhostButton type="button" className="flex-1" onClick={deleteSelected}>
                  Delete
                </GhostButton>
              </div>
            </div>
          ) : null}

          <GhostButton type="button" onClick={clearCanvas} className="w-full">
            Clear annotations
          </GhostButton>
        </Card>

        <Card className="overflow-hidden p-3 shadow-none">
          <div className="mb-3 flex items-center justify-between gap-3 text-xs text-slate-500">
            <span>{plan?.title ? `Planner: ${plan.title}` : "Layer-ready project markup"}</span>
            <span>{annotations.length} annotation{annotations.length === 1 ? "" : "s"}</span>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
              className="block h-auto w-full touch-none select-none bg-white"
              onPointerDown={startDrawing}
              onPointerMove={moveDrawing}
              onPointerUp={stopPointer}
              onPointerLeave={stopPointer}
            >
              <defs>
                {LAYERS.map((layer) => (
                  <marker
                    key={layer.key}
                    id={`arrow-${layer.key}`}
                    markerWidth="12"
                    markerHeight="12"
                    refX="10"
                    refY="6"
                    orient="auto"
                    markerUnits="strokeWidth"
                  >
                    <path d="M2,2 L10,6 L2,10 Z" fill={layer.color} />
                  </marker>
                ))}
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width={CANVAS_W} height={CANVAS_H} fill="#f8fafc" />
              {backgroundUrl ? (
                <image href={backgroundUrl} x="0" y="0" width={CANVAS_W} height={CANVAS_H} preserveAspectRatio="xMidYMid meet" />
              ) : (
                <g>
                  <rect x="0" y="0" width={CANVAS_W} height={CANVAS_H} fill="url(#grid)" />
                  <text x="600" y="355" textAnchor="middle" fill="#64748b" fontSize="30" fontWeight="700">
                    Upload a photo, floor plan, or sketch
                  </text>
                  <text x="600" y="395" textAnchor="middle" fill="#94a3b8" fontSize="20">
                    Then draw boxes, arrows, notes, and measurements over it.
                  </text>
                </g>
              )}
              <rect width={CANVAS_W} height={CANVAS_H} fill="url(#grid)" opacity="0.22" />

              {visibleAnnotations.map((item) =>
                renderAnnotation(item, {
                  selected: item.id === selectedId,
                  onPointerDown: (event) => startMove(event, item),
                }),
              )}

              {selected ? (() => {
                const { x1, y1, x2, y2 } = annotationBounds(selected);
                return (
                  <rect
                    className="editing-only pointer-events-none"
                    x={x1 - 8}
                    y={y1 - 8}
                    width={Math.max(16, x2 - x1 + 16)}
                    height={Math.max(16, y2 - y1 + 16)}
                    fill="none"
                    stroke="#38bdf8"
                    strokeDasharray="10 8"
                    strokeWidth="3"
                  />
                );
              })() : null}
            </svg>
          </div>
        </Card>
      </div>
    </div>
  );
}
