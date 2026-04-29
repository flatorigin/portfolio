// frontend/src/components/ImageUploader.jsx
import { useState, useRef, useCallback, useEffect } from "react";
import api from "../api";
import { Button, SymbolIcon } from "../ui";

const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);
const SUPPORTED_IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|heic|heif)$/i;
const BROWSER_PREVIEW_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function toUrl(raw) {
  if (!raw) return "";
  const value = String(raw).trim();
  if (/^(https?:|data:|blob:)/i.test(value)) return value;

  const base = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
  const origin = base.replace(/\/api\/?$/, "");
  return value.startsWith("/") ? `${origin}${value}` : `${origin}/${value}`;
}

export default function ImageUploader({ projectId, onUploaded }) {
  const [files, setFiles] = useState([]); // [{ file, url, caption }]
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef(null);
  const filesRef = useRef([]);
  const [over, setOver] = useState(false);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    return () => {
      filesRef.current.forEach((it) => URL.revokeObjectURL(it.url));
    };
  }, []);

  function uploadErrorMessage(e) {
    const status = e?.response?.status;
    const data = e?.response?.data;
    const prefix = status ? `Upload failed (${status}). ` : "";
    if (!data) return `${prefix}${e?.message || "Could not upload images."}`;
    if (typeof data === "string") {
      const trimmed = data.trim().toLowerCase();
      const message = trimmed.startsWith("<!doctype") || trimmed.startsWith("<html")
        ? "The server could not process that image. Try a JPG, PNG, or WebP file."
        : data;
      return `${prefix}${message}`;
    }
    return `${prefix}${data.detail || data.error || JSON.stringify(data)}`;
  }

  function onPick(fileList) {
    const arr = Array.from(fileList || []);
    const accepted = [];
    const rejected = [];

    arr.forEach((file) => {
      const hasSupportedType = SUPPORTED_IMAGE_TYPES.has(file.type);
      const hasSupportedExtension = SUPPORTED_IMAGE_EXTENSIONS.test(file.name || "");
      if (hasSupportedType || (!file.type && hasSupportedExtension)) {
        accepted.push(file);
      } else {
        rejected.push(file.name || "Selected file");
      }
    });

    if (rejected.length) {
      setErr(
        `Unsupported image format: ${rejected.join(", ")}. Please use JPG, PNG, WebP, HEIC, or HEIF.`
      );
    } else {
      setErr("");
    }

    const next = accepted.map((f) => ({
      id: `${f.name}-${f.size}-${f.lastModified}-${globalThis.crypto?.randomUUID?.() || Date.now()}`,
      file: f,
      url: URL.createObjectURL(f),
      caption: "",
      previewError: false,
      objectUrl: true,
      uploaded: false,
      uploading: false,
    }));
    setFiles((prev) => [...prev, ...next]);
  }
  function onDrop(e) { e.preventDefault(); setOver(false); onPick(e.dataTransfer.files); }

  const submit = useCallback(async () => {
    if (!files.length || !projectId) return;
    const pendingFiles = files.filter((it) => !it.uploaded);
    if (!pendingFiles.length) return;

    setBusy(true); setErr("");
    try {
      const fd = new FormData();
      pendingFiles.forEach((it) => fd.append("images", it.file));
      pendingFiles.forEach((it) => fd.append("captions", it.caption || ""));

      setFiles((prev) =>
        prev.map((it) => (!it.uploaded ? { ...it, uploading: true } : it))
      );

      const { data } = await api.post(`/projects/${projectId}/images/`, fd);
      const savedImages = Array.isArray(data) ? data : [];

      pendingFiles.forEach((it) => {
        if (it.objectUrl) URL.revokeObjectURL(it.url);
      });

      setFiles((prev) => {
        let savedIndex = 0;
        return prev.map((it) => {
          if (it.uploaded) return it;

          const saved = savedImages[savedIndex++] || {};
          const savedUrl = toUrl(saved.url || saved.image || saved.src || saved.file);
          return {
            ...it,
            id: saved.id || it.id,
            file: null,
            url: savedUrl || it.url,
            caption: saved.caption ?? it.caption,
            previewError: false,
            objectUrl: false,
            uploaded: true,
            uploading: false,
          };
        });
      });
      onUploaded?.();
    } catch (e) {
      setFiles((prev) =>
        prev.map((it) => (!it.uploaded ? { ...it, uploading: false } : it))
      );
      setErr(uploadErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [files, projectId, onUploaded]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-2 font-semibold text-slate-700">Add Images</div>
      <div className="mb-2 text-xs text-slate-600">Drag &amp; drop or click; add captions; upload.</div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e)=>{e.preventDefault(); setOver(true);}}
        onDragLeave={()=>setOver(false)}
        onDrop={onDrop}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={`mb-3 flex min-h-[240px] w-full cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-8 text-center transition
          ${over ? "border-slate-400 bg-white" : "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-white"}`}
      >
        <div className="text-center">
          <SymbolIcon
            name="add_photo_alternate"
            className="mb-4 text-[42px] text-slate-400"
            weight={300}
          />
          <div className="text-base font-semibold text-slate-900">Add sample images</div>
          <div className="mt-2 max-w-lg text-sm text-slate-600">
            Upload project images, add captions, and organize the work you want shown on your project card.
          </div>
          <div className="mt-5">
            <Button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
            >
              Browse images
            </Button>
          </div>
        </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
            multiple
            onChange={(e) => onPick(e.target.files)}
            className="hidden"
        />
      </div>

      {files.length > 0 && (
        <>
          <div className="mb-3 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            {files.map((it, i) => (
              <div key={it.id} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="mb-2 flex h-36 w-full items-center justify-center overflow-hidden rounded-md bg-slate-100">
                  {it.previewError ? (
                    <div className="px-3 text-center">
                      <SymbolIcon name="image_not_supported" className="text-[32px] text-slate-400" />
                      <div className="mt-1 truncate text-xs font-medium text-slate-600">
                        {it.file?.name || "Uploaded image"}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        {it.uploaded ? "Preview unavailable" : "Will convert after upload"}
                      </div>
                    </div>
                  ) : (
                    <img
                      src={it.url}
                      alt={it.file.name || ""}
                      className="h-full w-full object-cover"
                      onError={() => {
                        setFiles((prev) =>
                          prev.map((x) => (x.id === it.id ? { ...x, previewError: true } : x))
                        );
                      }}
                    />
                  )}
                </div>
                {it.uploading ? (
                  <div className="mb-2 text-xs font-medium text-slate-500">
                    Uploading and preparing image…
                  </div>
                ) : null}
                <input
                  className="w-full rounded-lg border border-slate-300 px-2 py-1"
                  placeholder="Caption…"
                  value={it.caption}
                  disabled={it.uploaded}
                  onChange={(e) =>
                    setFiles((prev) =>
                      prev.map((x) => (x.id === it.id ? { ...x, caption: e.target.value } : x))
                    )
                  }
                />
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (it.objectUrl) URL.revokeObjectURL(it.url);
                      setFiles((prev) => prev.filter((x) => x.id !== it.id));
                    }}
                    className="rounded-lg border px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={busy || files.every((it) => it.uploaded)}
              className="rounded-xl bg-blue-600 px-4 py-2 text-white disabled:opacity-60"
            >
              Upload {files.filter((it) => !it.uploaded).length} image{files.filter((it) => !it.uploaded).length === 1 ? "" : "s"}
            </button>
            {busy ? (
              <div className="text-xs font-medium text-slate-500">
                Uploading and preparing image…
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => {
                  files.forEach((it) => {
                    if (it.objectUrl) URL.revokeObjectURL(it.url);
                  });
                  setFiles([]);
                }}
                disabled={busy}
              className="rounded-xl border px-3 py-2 text-slate-700 hover:bg-slate-50"
            >
              Clear
            </button>
          </div>
        </>
      )}

      {err && <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{err}</div>}
    </div>
  );
}
