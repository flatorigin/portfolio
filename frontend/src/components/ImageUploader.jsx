// frontend/src/components/ImageUploader.jsx
import { useState, useRef, useCallback } from "react";
import api from "../api";

export default function ImageUploader({ projectId, onUploaded }) {
  const [files, setFiles] = useState([]); // [{ file, url, caption }]
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);

  function onPick(fileList) {
    const arr = Array.from(fileList || []);
    const next = arr.map((f) => ({ file: f, url: URL.createObjectURL(f), caption: "" }));
    setFiles((prev) => [...prev, ...next]);
  }
  function onDrop(e) { e.preventDefault(); setOver(false); onPick(e.dataTransfer.files); }

  const submit = useCallback(async () => {
    if (!files.length || !projectId) return;
    setBusy(true); setErr("");
    try {
      const fd = new FormData();
      files.forEach((it) => fd.append("images", it.file));
      files.forEach((it) => fd.append("captions", it.caption || ""));
      await api.post(`/projects/${projectId}/images/`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setFiles([]);
      onUploaded?.();
    } catch (e) {
      setErr(e?.response?.data ? JSON.stringify(e.response.data) : String(e));
    } finally {
      setBusy(false);
    }
  }, [files, projectId, onUploaded]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-2 font-semibold text-slate-700">Add Images</div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e)=>{e.preventDefault(); setOver(true);}}
        onDragLeave={()=>setOver(false)}
        onDrop={onDrop}
        className={`mb-3 flex h-36 w-full cursor-pointer items-center justify-center rounded-xl border-2 border-dashed p-4 text-slate-500
          ${over ? "border-blue-500 bg-blue-50" : "border-slate-300 hover:bg-slate-50"}`}
      >
        <div className="text-center">
          <div className="text-sm">Drag & drop images here</div>
          <div className="text-xs">or click to browse</div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => onPick(e.target.files)}
          className="hidden"
        />
      </div>

      {files.length > 0 && (
        <>
          <div className="mb-3 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            {files.map((it, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-white p-3">
                <img src={it.url} alt="" className="mb-2 h-36 w-full rounded-md object-cover" />
                <input
                  className="w-full rounded-lg border border-slate-300 px-2 py-1"
                  placeholder="Caption…"
                  value={it.caption}
                  onChange={(e) => setFiles(prev => prev.map((x,idx)=> idx===i ? {...x, caption: e.target.value} : x))}
                />
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setFiles(prev => prev.filter((_,idx)=>idx!==i))}
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
              disabled={busy}
              className="rounded-xl bg-blue-600 px-4 py-2 text-white disabled:opacity-60"
            >
              Upload {files.length} image{files.length > 1 ? "s" : ""}
            </button>
            <button
              type="button"
              onClick={() => setFiles([])}
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
