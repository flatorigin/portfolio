import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import api from "../api";
import ImageUploader from "./ImageUploader";
import { Badge, Button, GhostButton, Input, Textarea } from "../ui";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function getFocusableElements(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll(focusableSelector));
}

function defaultForm() {
  return {
    title: "",
    summary: "",
    category: "",
    is_public: true,
    location: "",
    budget: "",
    sqf: "",
    highlights: "",
  };
}

export function ProjectEditModal({
  projectId,
  isOpen,
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState(defaultForm);
  const [cover, setCover] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [images, setImages] = useState([]);
  const [imagesBusy, setImagesBusy] = useState(false);
  const modalRef = useRef(null);
  const lastFocusedRef = useRef(null);

  const projectLabel = useMemo(() => {
    if (!projectId) return "Project";
    return `Project #${projectId}`;
  }, [projectId]);

  const refreshImages = useCallback(async (pid) => {
    if (!pid) return;
    const { data } = await api.get(`/projects/${pid}/images/`);
    const nextImages = (data || [])
      .map((item) => ({
        id: item.id,
        url: item.url || item.image || item.src || item.file,
        caption: item.caption || "",
        _localCaption: item.caption || "",
        _saving: false,
      }))
      .filter((item) => !!item.url);
    setImages(nextImages);
  }, []);

  useEffect(() => {
    if (!isOpen || !projectId) return;
    let isActive = true;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const [{ data }] = await Promise.all([
          api.get(`/projects/${projectId}/`),
          refreshImages(projectId),
        ]);
        if (!isActive) return;
        setForm({
          title: data?.title || "",
          summary: data?.summary || "",
          category: data?.category || "",
          is_public: !!data?.is_public,
          location: data?.location || "",
          budget: data?.budget ?? "",
          sqf: data?.sqf ?? "",
          highlights: data?.highlights || "",
        });
        setCover(null);
      } catch (err) {
        if (!isActive) return;
        const msg = err?.response?.data
          ? (typeof err.response.data === "string"
              ? err.response.data
              : JSON.stringify(err.response.data))
          : (err?.message || String(err));
        setError(msg);
      } finally {
        if (isActive) setLoading(false);
      }
    })();
    return () => {
      isActive = false;
    };
  }, [isOpen, projectId, refreshImages]);

  useEffect(() => {
    if (!isOpen) return;
    lastFocusedRef.current = document.activeElement;
    const focusFirst = () => {
      const focusables = getFocusableElements(modalRef.current);
      if (focusables.length) {
        focusables[0].focus();
      } else {
        modalRef.current?.focus();
      }
    };
    const id = window.setTimeout(focusFirst, 0);
    return () => window.clearTimeout(id);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        if (!saving) {
          event.preventDefault();
          onClose?.();
        }
        return;
      }

      if (event.key !== "Tab") return;
      const focusables = getFocusableElements(modalRef.current);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, saving, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    return () => {
      if (lastFocusedRef.current instanceof HTMLElement) {
        lastFocusedRef.current.focus();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleSave(event) {
    event?.preventDefault?.();
    if (!projectId) return;
    setSaving(true);
    setError("");
    try {
      if (cover) {
        const fd = new FormData();
        Object.entries(form).forEach(([key, value]) => fd.append(key, value ?? ""));
        fd.append("cover_image", cover);
        await api.patch(`/projects/${projectId}/`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        await api.patch(`/projects/${projectId}/`, form);
      }
      await onSaved?.(projectId);
      onClose?.();
    } catch (err) {
      const msg = err?.response?.data
        ? (typeof err.response.data === "string"
            ? err.response.data
            : JSON.stringify(err.response.data))
        : (err?.message || String(err));
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function saveImageCaption(image) {
    if (!projectId || !image?.id) return;
    if (image._localCaption === image.caption) return;
    setImages((prev) => prev.map((item) => (
      item.id === image.id ? { ...item, _saving: true } : item
    )));
    try {
      await api.patch(`/projects/${projectId}/images/${image.id}/`, { caption: image._localCaption });
      await refreshImages(projectId);
    } catch (err) {
      alert(err?.response?.data ? JSON.stringify(err.response.data) : String(err));
      setImages((prev) => prev.map((item) => (
        item.id === image.id ? { ...item, _saving: false } : item
      )));
    }
  }

  async function deleteImage(image) {
    if (!projectId || !image?.id) return;
    if (!window.confirm("Delete this image? This cannot be undone.")) return;
    setImagesBusy(true);
    try {
      await api.delete(`/projects/${projectId}/images/${image.id}/`);
      await refreshImages(projectId);
    } finally {
      setImagesBusy(false);
    }
  }

  const disableClose = saving;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !disableClose) {
          onClose?.();
        }
      }}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-edit-modal-title"
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl outline-none"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3
              id="project-edit-modal-title"
              className="text-lg font-semibold text-slate-900"
            >
              Edit Project Content
            </h3>
            <p className="text-sm text-slate-500">{projectLabel}</p>
          </div>
          <button
            type="button"
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
            onClick={() => {
              if (!disableClose) onClose?.();
            }}
            aria-label="Close edit modal"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5">
          {loading ? (
            <div className="text-sm text-slate-600">Loading project details…</div>
          ) : (
            <div className="space-y-8">
              <form onSubmit={handleSave} className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-slate-600">Project Name</label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Project name"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-600">Category</label>
                  <Input
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="Category"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm text-slate-600">Summary</label>
                  <Textarea
                    value={form.summary}
                    onChange={(e) => setForm({ ...form, summary: e.target.value })}
                    placeholder="Short description..."
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-slate-600">Location (not address)</label>
                  <Input
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="City, State"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-600">Budget</label>
                  <Input
                    value={form.budget}
                    onChange={(e) => setForm({ ...form, budget: e.target.value })}
                    inputMode="numeric"
                    placeholder="e.g. 250000"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-600">Square Feet</label>
                  <Input
                    value={form.sqf}
                    onChange={(e) => setForm({ ...form, sqf: e.target.value })}
                    inputMode="numeric"
                    placeholder="e.g. 1800"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-600">Highlights (tags / text)</label>
                  <Input
                    value={form.highlights}
                    onChange={(e) => setForm({ ...form, highlights: e.target.value })}
                    placeholder="comma-separated tags"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-slate-600">Cover (replace)</label>
                  <input type="file" onChange={(e) => setCover(e.target.files?.[0] || null)} />
                  {cover && <div className="mt-1 truncate text-xs text-slate-500">{cover.name}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-600">
                    <input
                      type="checkbox"
                      className="mr-2 align-middle"
                      checked={!!form.is_public}
                      onChange={(e) => setForm({ ...form, is_public: e.target.checked })}
                    />
                    Public
                  </label>
                </div>

                {error && (
                  <div className="md:col-span-2 text-sm text-red-700">
                    {error}
                  </div>
                )}
              </form>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm text-slate-600">Images</div>
                  <Badge>{images.length} total</Badge>
                </div>
                {images.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    No images yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
                    {images.map((item) => (
                      <figure key={item.id ?? item.url} className="rounded-xl border border-slate-200 bg-white p-3">
                        <img src={item.url} alt="" className="mb-2 h-36 w-full rounded-md object-cover" />
                        <input
                          className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                          placeholder="Caption…"
                          value={item._localCaption}
                          onChange={(e) => setImages((prev) => prev.map((img) => (
                            img.id === item.id ? { ...img, _localCaption: e.target.value } : img
                          )))}
                        />
                        <div className="mt-2 flex items-center justify-between">
                          <GhostButton
                            onClick={() => { if (item.id) deleteImage(item); }}
                            disabled={!item.id || imagesBusy}
                            title={item.id ? "Delete this image" : "This API response has no image id — delete is disabled"}
                          >
                            Delete
                          </GhostButton>
                          <Button
                            onClick={() => saveImageCaption(item)}
                            disabled={item._saving || item._localCaption === item.caption}
                          >
                            {item._saving ? "Saving…" : "Save caption"}
                          </Button>
                        </div>
                      </figure>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-2 text-sm font-semibold text-slate-800">Add Images</div>
                <div className="mb-2 text-xs text-slate-600">Drag & drop or click; add captions; upload.</div>
                <ImageUploader
                  projectId={projectId}
                  onUploaded={async () => {
                    await refreshImages(projectId);
                    await onSaved?.(projectId);
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <GhostButton
            type="button"
            onClick={() => {
              if (!disableClose) onClose?.();
            }}
            disabled={disableClose}
          >
            Cancel
          </GhostButton>
          <Button
            type="button"
            onClick={handleSave}
            disabled={loading || saving}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function EditProjectContentButton({
  projectId,
  onOpen,
  onClose,
  onSaved,
  variant = "primary",
  children = "Edit Content",
  className = "",
  ...props
}) {
  const [open, setOpen] = useState(false);
  const ButtonComponent = variant === "ghost" ? GhostButton : Button;

  return (
    <>
      <ButtonComponent
        type="button"
        className={className}
        onClick={() => {
          setOpen(true);
          onOpen?.();
        }}
        {...props}
      >
        {children}
      </ButtonComponent>
      <ProjectEditModal
        projectId={projectId}
        isOpen={open}
        onClose={() => {
          setOpen(false);
          onClose?.();
        }}
        onSaved={onSaved}
      />
    </>
  );
}
