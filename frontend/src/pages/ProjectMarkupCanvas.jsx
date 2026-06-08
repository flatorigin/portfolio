import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../api";
import { SymbolIcon } from "../ui";

const CANVAS_W = 1200;
const CANVAS_H = 760;
const STORAGE_PREFIX = "flatorigin_project_markup";

const TOOLS = [
  { key: "select", label: "Select", icon: "near_me" },
  { key: "measure", label: "Measure", icon: "straighten" },
  { key: "rect", label: "Box", icon: "crop_square" },
  { key: "arrow", label: "Arrow", icon: "arrow_right_alt" },
  { key: "freehand", label: "Freehand", icon: "draw" },
  { key: "text", label: "Text", icon: "title" },
  { key: "circle", label: "Circle", icon: "radio_button_unchecked" },
  { key: "priority", label: "Priority", icon: "looks_one" },
];

const LAYERS = [
  { key: "homeowner", label: "Homeowner", color: "#0f172a" },
  { key: "contractor", label: "Contractor", color: "#2563eb" },
];

const MARKUP_COLORS = [
  "#0f172a",
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#eab308",
  "#9333ea",
];

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
  const normalized = String(hex || "#0f172a").replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return `rgba(15, 23, 42, ${alpha})`;
  const value = parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function styleFor(item) {
  const strokeColor = item.strokeColor || item.color || "#0f172a";
  const fillColor = item.fillColor || item.color || strokeColor;
  const strokeStyle = item.strokeStyle === "dashed" ? "dashed" : "solid";
  return {
    strokeColor,
    fillColor,
    fill: hexToRgba(fillColor, 0.3),
    strokeDasharray: strokeStyle === "dashed" ? "12 8" : undefined,
  };
}

function markerIdForColor(color) {
  return `arrow-${String(color || "#0f172a").replace(/[^a-z0-9]/gi, "")}`;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Could not read image."));
    reader.readAsDataURL(blob);
  });
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
  if (item.type === "freehand" && Array.isArray(item.points) && item.points.length) {
    const xs = item.points.map((point) => point.x);
    const ys = item.points.map((point) => point.y);
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
  return {
    width: Math.max(44, longest * fontSize * 0.52 + 18),
    height: lines.length * (fontSize + 4) + 10,
    lines,
  };
}

function displayBounds(item) {
  if (!item) return { x1: 0, y1: 0, x2: 0, y2: 0 };
  if (item.type === "text") {
    const box = labelBox(item.text || "Note", 18);
    return {
      x1: (item.x || 0) - 10,
      y1: (item.y || 0) - box.height + 7,
      x2: (item.x || 0) - 10 + box.width,
      y2: (item.y || 0) + 7,
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
    return {
      x: ((item.x || 0) + (item.x2 || 0)) / 2,
      y: ((item.y || 0) + (item.y2 || 0)) / 2 - 40,
    };
  }
  if (item.type === "text") {
    return { x: item.x || 0, y: (item.y || 0) - 18 };
  }
  return null;
}

function renderAnnotation(item, { selected = false, editing = false, onPointerDown, onDoubleClick } = {}) {
  const style = styleFor(item);
  const stroke = style.strokeColor;
  const common = {
    key: item.id,
    onPointerDown,
    onDoubleClick,
    className: selected ? "cursor-move" : "cursor-pointer",
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
          fill={style.fill}
          stroke={stroke}
          strokeWidth="2"
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
        stroke={stroke}
        strokeWidth="2"
        strokeDasharray={style.strokeDasharray}
      />
    );
  }

  if (item.type === "freehand") {
    const points = Array.isArray(item.points) ? item.points : [];
    const d = points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");
    return (
      <path
        {...common}
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={style.strokeDasharray}
      />
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
          stroke={stroke}
          strokeWidth="2"
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

  if (item.type === "arrow" || item.type === "measure") {
    const marker = item.type === "arrow" ? `url(#${markerIdForColor(stroke)})` : undefined;
    const midX = ((item.x || 0) + (item.x2 || 0)) / 2;
    const midY = ((item.y || 0) + (item.y2 || 0)) / 2;
    const dx = (item.x2 || 0) - (item.x || 0);
    const dy = (item.y2 || 0) - (item.y || 0);
    const length = Math.hypot(dx, dy) || 1;
    const capX = (-dy / length) * 22;
    const capY = (dx / length) * 22;
    const label = item.text || "measurement";
    const box = labelBox(label, 18);
    return (
      <g {...common}>
        <line
          x1={item.x}
          y1={item.y}
          x2={item.x2}
          y2={item.y2}
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          markerEnd={marker}
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
              strokeWidth="2"
              strokeLinecap="square"
              strokeDasharray={style.strokeDasharray}
            />
            <line
              x1={(item.x2 || 0) - capX}
              y1={(item.y2 || 0) - capY}
              x2={(item.x2 || 0) + capX}
              y2={(item.y2 || 0) + capY}
              stroke={stroke}
              strokeWidth="2"
              strokeLinecap="square"
              strokeDasharray={style.strokeDasharray}
            />
          </>
        ) : null}
        {item.type === "measure" && !editing ? (
          <g>
            <rect
              x={midX - box.width / 2}
              y={midY - box.height - 10}
              width={box.width}
              height={box.height}
              rx="8"
              fill={style.fill}
              stroke={stroke}
              strokeWidth="2"
            />
            <text
              x={midX - box.width / 2 + 10}
              y={midY - box.height + 16}
              fill={stroke}
              fontSize="18"
              fontWeight="200"
            >
              {box.lines.map((line, index) => (
                <tspan key={`${item.id}-line-${index}`} x={midX - box.width / 2 + 10} dy={index === 0 ? 0 : 23}>
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        ) : null}
      </g>
    );
  }

  const label = item.text || "Note";
  const box = labelBox(label, 18);
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
        x={item.x - 10}
        y={item.y - box.height + 7}
        width={box.width}
        height={box.height}
        rx="8"
        fill={style.fill}
        stroke={stroke}
        strokeWidth="2"
        strokeDasharray={style.strokeDasharray}
      />
      <text
        x={item.x}
        y={item.y - box.height + 25}
        fill={stroke}
        fontSize="18"
        fontWeight="200"
      >
        {box.lines.map((line, index) => (
          <tspan key={`${item.id}-line-${index}`} x={item.x} dy={index === 0 ? 0 : 23}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

export default function ProjectMarkupCanvas() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const svgRef = useRef(null);
  const fileRef = useRef(null);
  const sidebarTextRef = useRef(null);
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
  const [savingEditable, setSavingEditable] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState({ past: [], future: [] });
  const [editingTextId, setEditingTextId] = useState("");
  const [focusedSidebarInputId, setFocusedSidebarInputId] = useState("");

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
        if (!alive) return;
        setPlan(data);
        const markup = safeMarkupData(data?.markup_data);
        if (Array.isArray(markup.annotations)) setAnnotations(markup.annotations);
        if (markup.background_url) setBackgroundUrl(markup.background_url);
        if (markup.visible_layers && typeof markup.visible_layers === "object") {
          setVisibleLayers((prev) => ({ ...prev, ...markup.visible_layers }));
        }
        if (markup.active_layer) setActiveLayer(markup.active_layer);
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

  useEffect(() => {
    if (selected?.type === "text" || selected?.type === "measure") {
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

  const color = LAYERS.find((item) => item.key === activeLayer)?.color || "#0f172a";

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
    const nextVersionNumber = existingVersions.length + 1;
    const normalizedAnnotations = annotations.map((item) =>
      item.type === "text" || item.type === "measure"
        ? { ...item, text: normalizeMarkupText(item.text) }
        : item,
    );
    const version = {
      id: `version-${Date.now()}`,
      name: versionOverrides.name || `Markup version ${nextVersionNumber}`,
      created_at: now,
      background_url,
      snapshot_url: versionOverrides.snapshot_url || "",
      snapshot_image_id: versionOverrides.snapshot_image_id || null,
      annotations: normalizedAnnotations,
      visible_layers: visibleLayers,
      annotation_count: normalizedAnnotations.length,
    };

    return {
      schema_version: 1,
      canvas: { width: CANVAS_W, height: CANVAS_H },
      active_layer: activeLayer,
      background_url,
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

  function startDrawing(event) {
    if (!svgRef.current) return;
    svgRef.current.setPointerCapture?.(event.pointerId);
    const point = pointFromEvent(event, svgRef.current);
    setMessage("");

    if (tool === "select") {
      setSelectedId("");
      setEditingTextId("");
      return;
    }

    const id = `mark-${Date.now()}`;
    const nextPriorityNumber =
      annotations.filter((item) => item.type === "priority").length + 1;
    const base = {
      id,
      layer: activeLayer,
      type: tool,
      x: point.x,
      y: point.y,
      x2: point.x,
      y2: point.y,
      color,
      strokeColor: color,
      fillColor: color,
      strokeStyle: "solid",
      points: tool === "freehand" ? [point] : undefined,
      priorityNumber: tool === "priority" ? nextPriorityNumber : undefined,
      text: tool === "text" ? "Add note" : tool === "measure" ? "measurement" : "",
    };

    commitAnnotations([...annotations, base]);
    setSelectedId(id);
    setEditingTextId(tool === "text" ? id : "");
    if (tool === "text" || tool === "priority") return;
    setDraft(id);
  }

  function moveDrawing(event) {
    if (!svgRef.current) return;
    const point = pointFromEvent(event, svgRef.current);

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
    setDraft(null);
    setDrag(null);
  }

  function startMove(event, item) {
    event.stopPropagation();
    if (!svgRef.current) return;
    svgRef.current.setPointerCapture?.(event.pointerId);
    const point = pointFromEvent(event, svgRef.current);
    setTool("select");
    setSelectedId(item.id);
    if (item.id !== editingTextId) setEditingTextId("");
    setHistory((prev) => ({ past: [...prev.past, annotations].slice(-30), future: [] }));
    setDrag({ id: item.id, startX: point.x, startY: point.y, item });
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
    clone.querySelectorAll(".editing-only").forEach((node) => node.remove());
    return new XMLSerializer().serializeToString(clone);
  }

  async function makeSvgStringForPng() {
    const clone = svgRef.current?.cloneNode(true);
    if (!clone) return "";
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
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
    const saved = await saveToPlanner();
    if (saved && planId) navigate(`/dashboard/planner/${planId}`);
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
    if (version.background_url) setBackgroundUrl(version.background_url);
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

  const visibleAnnotations = annotations.filter((item) => visibleLayers[item.layer]);
  const layeredAnnotations = [
    ...visibleAnnotations.filter((item) => item.type !== "text" && item.type !== "measure"),
    ...visibleAnnotations.filter((item) => item.type === "measure"),
    ...visibleAnnotations.filter((item) => item.type === "text"),
  ];
  const selectedLabelPosition = labelPosition(selected);
  const selectedDisplayBounds = selected ? displayBounds(selected) : null;
  const selectedDeletePosition = selectedDisplayBounds
    ? {
        left: `${(clamp(selectedDisplayBounds.x2 + 18, 18, CANVAS_W - 18) / CANVAS_W) * 100}%`,
        top: `${(clamp(selectedDisplayBounds.y1 - 18, 18, CANVAS_H - 18) / CANVAS_H) * 100}%`,
      }
    : null;
  const editingSelectedText =
    selectedLabelPosition &&
    selected &&
    editingTextId === selected.id &&
    (selected.type === "text" || selected.type === "measure");
  const sidebarTextEditorActive =
    !!selected && (editingTextId === selected.id || focusedSidebarInputId === selected.id);
  const selectedTextBox = selected ? labelBox(selected.text || (selected.type === "measure" ? "measurement" : "Note"), 18) : null;
  const selectedStyle = selected ? styleFor(selected) : null;

  return (
    <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] min-h-[calc(100vh-64px)] w-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white/95">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-4">
            <Link
              to={planId ? `/dashboard/planner/${planId}` : "/dashboard"}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              aria-label="Back to planner"
            >
              <SymbolIcon name="arrow_back" className="text-[22px]" />
            </Link>
            <div>
              <h1 className="text-base font-semibold text-slate-950">Markup canvas</h1>
              <p className="text-xs text-slate-500">Mark the area that needs work</p>
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
              onClick={() => saveEditableCanvas()}
              disabled={savingEditable}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <SymbolIcon name="save" className="text-[18px]" />
              {savingEditable ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={saveAndBack}
              disabled={saving}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              <SymbolIcon name="check" className="text-[18px]" />
              {saving ? "Saving..." : "Save & back"}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-4">
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

        <div className="grid items-start gap-4 lg:grid-cols-[288px_minmax(0,1fr)]">
          <div className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-950">Background</div>
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
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-950">Layers</div>
              <div className="mt-3 space-y-2">
                {LAYERS.map((layer) => {
                  const active = activeLayer === layer.key;
                  return (
                    <div
                      key={layer.key}
                      className={`flex h-12 items-center justify-between rounded-xl border px-3 ${
                        active ? "border-slate-950 bg-slate-50" : "border-slate-200 bg-white"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveLayer(layer.key)}
                        className="flex min-w-0 items-center gap-2 text-sm text-slate-700"
                      >
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: layer.color }} />
                        <span>{layer.label}</span>
                        {active ? (
                          <span className="rounded-full bg-slate-950 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
                            Editing
                          </span>
                        ) : null}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setVisibleLayers((prev) => ({ ...prev, [layer.key]: !prev[layer.key] }))
                        }
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
                        aria-label={`${visibleLayers[layer.key] ? "Hide" : "Show"} ${layer.label} layer`}
                      >
                        <SymbolIcon name={visibleLayers[layer.key] ? "visibility" : "visibility_off"} className="text-[18px]" />
                      </button>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50"
                >
                  <SymbolIcon name="ink_eraser" className="text-[18px]" />
                  Clear annotations
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-500">Annotations</div>
                <div className="text-sm font-semibold text-slate-950">{annotations.length}</div>
              </div>
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

                  <div className="mb-2 text-xs font-medium text-slate-500">Stroke color</div>
                  <div className="mb-4 flex flex-wrap gap-2">
                    {MARKUP_COLORS.map((itemColor) => (
                      <button
                        key={`stroke-${itemColor}`}
                        type="button"
                        onClick={() =>
                          updateSelected({
                            color: itemColor,
                            strokeColor: itemColor,
                          })
                        }
                        aria-label={`Set stroke color ${itemColor}`}
                        className={`h-7 w-7 rounded-full border transition ${
                          selectedStyle?.strokeColor === itemColor
                            ? "border-slate-950 ring-2 ring-slate-900/25"
                            : "border-white ring-1 ring-slate-300 hover:scale-105"
                        }`}
                        style={{ backgroundColor: itemColor }}
                      />
                    ))}
                  </div>

                  <div className="mb-2 text-xs font-medium text-slate-500">Fill color</div>
                  <div className="mb-4 flex flex-wrap gap-2">
                    {MARKUP_COLORS.map((itemColor) => (
                      <button
                        key={`fill-${itemColor}`}
                        type="button"
                        onClick={() => updateSelected({ fillColor: itemColor })}
                        aria-label={`Set fill color ${itemColor}`}
                        className={`h-7 w-7 rounded-full border transition ${
                          selectedStyle?.fillColor === itemColor
                            ? "border-slate-950 ring-2 ring-slate-900/25"
                            : "border-white ring-1 ring-slate-300 hover:scale-105"
                        }`}
                        style={{ backgroundColor: hexToRgba(itemColor, 0.3) }}
                      />
                    ))}
                  </div>

                  <div className="mb-2 text-xs font-medium text-slate-500">Stroke format</div>
                  <div className="grid grid-cols-2 gap-2">
                    {["solid", "dashed"].map((itemStyle) => (
                      <button
                        key={itemStyle}
                        type="button"
                        onClick={() => updateSelected({ strokeStyle: itemStyle })}
                        className={
                          "h-9 rounded-xl border px-3 text-sm capitalize transition " +
                          ((selected.strokeStyle || "solid") === itemStyle
                            ? "border-slate-950 bg-slate-950 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")
                        }
                      >
                        {itemStyle}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>

            {savedVersions.length ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-950">Versions</div>
                  <div className="text-sm font-semibold text-slate-950">{savedVersions.length}</div>
                </div>
                <div className="mt-3 max-h-96 space-y-3 overflow-y-auto pr-1">
                  {savedVersions.map((version, index) => {
                    const previewUrl = version.snapshot_url || version.background_url || "";
                    const versionName = version.name || `Markup version ${savedVersions.length - index}`;
                    return (
                      <div
                        key={version.id || `version-${index}`}
                        className="rounded-xl border border-slate-200 p-3 text-xs text-slate-600"
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
                        <div className="mt-1">
                          {version.annotation_count ?? 0} markups
                        </div>
                        <div className="mt-1 text-slate-400">
                          {version.created_at ? new Date(version.created_at).toLocaleString() : "Saved version"}
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteVersion(version.id)}
                          className="mt-3 inline-flex h-8 w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white text-xs font-medium text-rose-700 hover:bg-rose-50"
                        >
                          <SymbolIcon name="delete" className="text-[16px]" />
                          Delete version
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {plan?.images?.length ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-sm font-semibold text-slate-950">Planner images</div>
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
              </section>
            ) : null}

            {planId ? (
              <section className="rounded-2xl border border-rose-100 bg-white p-4 shadow-sm">
                <div className="text-sm font-semibold text-slate-950">Project planner</div>
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
              </section>
            ) : null}
          </div>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="relative mb-3 flex min-h-10 items-center justify-between gap-3 text-sm text-slate-500">
              <span>Planner: <span className="text-slate-700">{plan?.title || "Untitled issue"}</span></span>
              <div className="absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 items-center rounded-xl bg-slate-950 p-1 shadow-xl">
                <div className="flex items-center gap-1">
                  {TOOLS.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setTool(item.key)}
                      title={item.label}
                      aria-label={item.label}
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-white transition ${
                        tool === item.key
                          ? "bg-blue-600 shadow-sm"
                          : "bg-transparent text-white/80 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <SymbolIcon name={item.icon} className="text-[21px]" />
                    </button>
                  ))}
                </div>
              </div>
              <span className="text-xs text-slate-400">{annotations.length} annotations</span>
            </div>
            <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
              <svg
                ref={svgRef}
                viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
                className="block h-auto min-h-[420px] w-full touch-none select-none bg-white"
                onPointerDown={startDrawing}
                onPointerMove={moveDrawing}
                onPointerUp={stopPointer}
                onPointerLeave={stopPointer}
              >
              <defs>
                {MARKUP_COLORS.map((itemColor) => (
                  <marker
                    key={itemColor}
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

              {layeredAnnotations.map((item) =>
                renderAnnotation(item, {
                  selected: item.id === selectedId,
                  editing: item.id === editingTextId,
                  onPointerDown: (event) => startMove(event, item),
                  onDoubleClick: (event) => {
                    event.stopPropagation();
                    if (item.type === "text" || item.type === "measure") {
                      setSelectedId(item.id);
                      setEditingTextId(item.id);
                    }
                  },
                }),
              )}

              {selected ? (() => {
                const { x1, y1, x2, y2 } = displayBounds(selected);
                return (
                  <g className="editing-only">
                    <rect
                      className="pointer-events-none"
                      x={x1 - 8}
                      y={y1 - 8}
                      width={Math.max(16, x2 - x1 + 16)}
                      height={Math.max(16, y2 - y1 + 16)}
                      fill="none"
                      stroke="#38bdf8"
                      strokeDasharray="10 8"
                      strokeWidth="2"
                    />
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
                  className="absolute z-30 min-h-9 w-48 resize rounded-lg border border-white/20 bg-slate-950/80 px-2 py-1 text-left text-sm font-extralight leading-snug text-white shadow-xl outline-none placeholder:text-white/60"
                  placeholder={selected.type === "measure" ? "12 ft" : "Add note"}
                  style={{
                    left: `${(selectedLabelPosition.x / CANVAS_W) * 100}%`,
                    top: `${(selectedLabelPosition.y / CANVAS_H) * 100}%`,
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
