import { useEffect, useRef, useState } from "react";
import { Button, SymbolIcon } from "../ui";

const TOOLS = [
  { key: "select", label: "Select", icon: "near_me" },
  { key: "freehand", label: "Pencil", icon: "draw" },
  { key: "arrow", label: "Arrow", icon: "arrow_right_alt" },
  { key: "line", label: "Line", icon: "horizontal_rule" },
  { key: "rect", label: "Rectangle", icon: "crop_square" },
  { key: "circle", label: "Circle", icon: "radio_button_unchecked" },
  { key: "measure", label: "Measure", icon: "straighten" },
  { key: "text", label: "Text", icon: "title" },
];

function canvasPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function drawArrowHead(ctx, from, to, color, width) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const size = Math.max(16, width * 4);
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - size * Math.cos(angle - Math.PI / 6), to.y - size * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(to.x - size * Math.cos(angle + Math.PI / 6), to.y - size * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawAnnotation(ctx, item) {
  const color = item.color || "#2563eb";
  const width = Number(item.width || 6);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;

  if (item.type === "freehand" && item.points?.length) {
    ctx.beginPath();
    item.points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
  }

  if (item.type === "arrow" || item.type === "line" || item.type === "measure") {
    ctx.beginPath();
    ctx.moveTo(item.x, item.y);
    ctx.lineTo(item.x2, item.y2);
    ctx.stroke();
    if (item.type === "arrow") {
      drawArrowHead(ctx, { x: item.x, y: item.y }, { x: item.x2, y: item.y2 }, color, width);
    }
    if (item.type === "measure") {
      const text = String(item.text || "Measure").trim();
      const midX = (item.x + item.x2) / 2;
      const midY = (item.y + item.y2) / 2;
      ctx.font = `600 ${Math.max(16, width * 3)}px Inter, system-ui, sans-serif`;
      const metrics = ctx.measureText(text);
      ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
      ctx.strokeStyle = "rgba(15, 23, 42, 0.22)";
      ctx.lineWidth = 1;
      ctx.fillRect(midX - metrics.width / 2 - 8, midY - 28, metrics.width + 16, 28);
      ctx.strokeRect(midX - metrics.width / 2 - 8, midY - 28, metrics.width + 16, 28);
      ctx.fillStyle = color;
      ctx.fillText(text, midX - metrics.width / 2, midY - 8);
    }
  }

  if (item.type === "rect") {
    const x = Math.min(item.x, item.x2);
    const y = Math.min(item.y, item.y2);
    const w = Math.abs(item.x2 - item.x);
    const h = Math.abs(item.y2 - item.y);
    ctx.fillStyle = "rgba(37, 99, 235, 0.08)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
  }

  if (item.type === "circle") {
    const cx = (item.x + item.x2) / 2;
    const cy = (item.y + item.y2) / 2;
    const rx = Math.abs(item.x2 - item.x) / 2;
    const ry = Math.abs(item.y2 - item.y) / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(rx, 4), Math.max(ry, 4), 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(37, 99, 235, 0.08)";
    ctx.fill();
    ctx.stroke();
  }

  if (item.type === "text") {
    const text = String(item.text || "").trim();
    if (text) {
      const fontSize = Math.max(18, width * 4);
      ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
      const metrics = ctx.measureText(text);
      const padX = 10;
      const padY = 7;
      const boxW = metrics.width + padX * 2;
      const boxH = fontSize + padY * 2;
      ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
      ctx.strokeStyle = "rgba(15, 23, 42, 0.22)";
      ctx.lineWidth = 1;
      ctx.fillRect(item.x, item.y - boxH + padY, boxW, boxH);
      ctx.strokeRect(item.x, item.y - boxH + padY, boxW, boxH);
      ctx.fillStyle = color;
      ctx.fillText(text, item.x + padX, item.y);
    }
  }

  ctx.restore();
}

function annotationBounds(item) {
  if (!item) return null;
  if (item.type === "freehand" && item.points?.length) {
    const xs = item.points.map((point) => point.x);
    const ys = item.points.map((point) => point.y);
    return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
  }
  if (item.type === "text") {
    const text = String(item.text || "");
    return { x1: item.x, y1: item.y - 44, x2: item.x + Math.max(120, text.length * 12), y2: item.y + 10 };
  }
  return {
    x1: Math.min(item.x, item.x2),
    y1: Math.min(item.y, item.y2),
    x2: Math.max(item.x, item.x2),
    y2: Math.max(item.y, item.y2),
  };
}

function pointInBounds(point, bounds, pad = 18) {
  return (
    bounds &&
    point.x >= bounds.x1 - pad &&
    point.x <= bounds.x2 + pad &&
    point.y >= bounds.y1 - pad &&
    point.y <= bounds.y2 + pad
  );
}

function moveAnnotation(item, dx, dy) {
  if (item.type === "freehand") {
    return { ...item, points: item.points.map((point) => ({ x: point.x + dx, y: point.y + dy })) };
  }
  if (item.type === "text") return { ...item, x: item.x + dx, y: item.y + dy };
  return { ...item, x: item.x + dx, y: item.y + dy, x2: item.x2 + dx, y2: item.y2 + dy };
}

function hitAnnotation(annotations, point) {
  for (let index = annotations.length - 1; index >= 0; index -= 1) {
    if (pointInBounds(point, annotationBounds(annotations[index]))) return annotations[index];
  }
  return null;
}

function drawSelection(ctx, item) {
  const bounds = annotationBounds(item);
  if (!bounds) return;
  ctx.save();
  ctx.setLineDash([8, 6]);
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 2;
  ctx.strokeRect(bounds.x1 - 8, bounds.y1 - 8, bounds.x2 - bounds.x1 + 16, bounds.y2 - bounds.y1 + 16);
  ctx.restore();
}

function drawMarkup(canvas, image, annotations, draft, selectedId) {
  const ctx = canvas.getContext("2d");
  if (!ctx || !image) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  annotations.forEach((item) => drawAnnotation(ctx, item));
  if (draft) drawAnnotation(ctx, draft);
  const selected = annotations.find((item) => item.id === selectedId);
  if (selected) drawSelection(ctx, selected);
}

export default function ImageMarkupModal({ open, file, onClose, onSave }) {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const [imageUrl, setImageUrl] = useState("");
  const [tool, setTool] = useState("select");
  const [color, setColor] = useState("#2563eb");
  const [width, setWidth] = useState(6);
  const [annotations, setAnnotations] = useState([]);
  const [draft, setDraft] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [drag, setDrag] = useState(null);

  useEffect(() => {
    if (!open || !file) return undefined;
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setAnnotations([]);
    setDraft(null);
    setSelectedId("");
    setDrag(null);
    return () => URL.revokeObjectURL(url);
  }, [file, open]);

  useEffect(() => {
    if (!open || !imageUrl) return;
    const image = new Image();
    image.onload = () => {
      imageRef.current = image;
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = image.naturalWidth || image.width;
      canvas.height = image.naturalHeight || image.height;
      drawMarkup(canvas, image, annotations, draft, selectedId);
    };
    image.src = imageUrl;
  }, [annotations, draft, imageUrl, open, selectedId]);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (canvas && imageRef.current) drawMarkup(canvas, imageRef.current, annotations, draft, selectedId);
  }, [annotations, draft, open, selectedId]);

  if (!open) return null;

  function startDraw(event) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const point = canvasPoint(event, canvas);
    if (tool === "select") {
      const hit = hitAnnotation(annotations, point);
      setSelectedId(hit?.id || "");
      if (hit) setDrag({ id: hit.id, start: point, original: hit });
      return;
    }
    if (tool === "text") {
      const text = window.prompt("Text note");
      const clean = String(text || "").trim();
      if (clean) {
        const id = `message-markup-${Date.now()}`;
        setAnnotations((prev) => [...prev, { id, type: "text", text: clean, x: point.x, y: point.y, color, width }]);
        setSelectedId(id);
      }
      return;
    }
    if (tool === "freehand") {
      setDraft({ id: `message-markup-${Date.now()}`, type: "freehand", points: [point], color, width });
      return;
    }
    setDraft({ id: `message-markup-${Date.now()}`, type: tool, x: point.x, y: point.y, x2: point.x, y2: point.y, color, width });
  }

  function moveDraw(event) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const point = canvasPoint(event, canvas);
    if (drag?.id) {
      const dx = point.x - drag.start.x;
      const dy = point.y - drag.start.y;
      setAnnotations((prev) => prev.map((item) => (item.id === drag.id ? moveAnnotation(drag.original, dx, dy) : item)));
      return;
    }
    if (!draft) return;
    setDraft((prev) => {
      if (!prev) return prev;
      if (prev.type === "freehand") return { ...prev, points: [...prev.points, point] };
      return { ...prev, x2: point.x, y2: point.y };
    });
  }

  function finishDraw() {
    if (drag) {
      setDrag(null);
      return;
    }
    if (!draft) return;
    const nextDraft = draft.type === "measure" ? { ...draft, text: window.prompt("Measurement label", "Measure") || "Measure" } : draft;
    setAnnotations((prev) => [...prev, nextDraft]);
    setSelectedId(nextDraft.id);
    setDraft(null);
  }

  function deleteSelected() {
    if (!selectedId) return;
    setAnnotations((prev) => prev.filter((item) => item.id !== selectedId));
    setSelectedId("");
  }

  async function saveImage() {
    const sourceCanvas = canvasRef.current;
    if (!sourceCanvas || !imageRef.current) return;
    drawMarkup(sourceCanvas, imageRef.current, annotations, null, "");
    const blob = await new Promise((resolve) => sourceCanvas.toBlob(resolve, "image/png", 0.95));
    if (!blob) return;
    const baseName = String(file?.name || "marked-image").replace(/\.[^.]+$/, "");
    const markedFile = new File([blob], `${baseName}-marked.png`, { type: "image/png" });
    onSave?.(markedFile);
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 px-3 py-4">
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-slate-950">Markup image</div>
            <div className="text-xs text-slate-500">Draw simple notes before sending this attachment.</div>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100">
            <SymbolIcon name="close" className="text-[20px]" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
          {TOOLS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTool(item.key)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium ${
                tool === item.key ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <SymbolIcon name={item.icon} className="text-[17px]" />
              {item.label}
            </button>
          ))}
          <input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="ml-auto h-9 w-11 rounded-lg border border-slate-200 bg-white p-1" aria-label="Markup color" />
          <input type="range" min="2" max="18" value={width} onChange={(event) => setWidth(Number(event.target.value) || 6)} className="w-28 accent-blue-600" aria-label="Stroke width" />
          <button type="button" onClick={deleteSelected} disabled={!selectedId} className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40">
            <SymbolIcon name="delete" className="text-[16px]" />
            Delete
          </button>
          <button type="button" onClick={() => {
            setAnnotations((prev) => prev.slice(0, -1));
            setSelectedId("");
          }} disabled={!annotations.length} className="inline-flex h-9 items-center rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40">
            Undo
          </button>
          <button type="button" onClick={() => {
            setAnnotations([]);
            setSelectedId("");
          }} disabled={!annotations.length} className="inline-flex h-9 items-center rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40">
            Clear
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-3">
          <canvas
            ref={canvasRef}
            className="mx-auto block max-h-[68vh] max-w-full touch-none bg-white shadow-sm"
            onPointerDown={startDraw}
            onPointerMove={moveDraw}
            onPointerUp={finishDraw}
            onPointerLeave={finishDraw}
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <button type="button" onClick={onClose} className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <Button type="button" onClick={saveImage}>
            Use marked image
          </Button>
        </div>
      </div>
    </div>
  );
}
