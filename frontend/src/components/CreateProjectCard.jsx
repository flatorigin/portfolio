// =======================================
// file: frontend/src/components/CreateProjectCard.jsx
// Collapsible "Create Project" card + image fields + job posting toggle
// =======================================
import { useState } from "react";
import { Card, Input, Textarea, Button, Badge } from "../ui";

export default function CreateProjectCard({
  ownedCount = 0,
  form,
  setForm,
  cover,
  setCover,
  busy = false,
  error,
  success,
  onSubmit,          // (event) => void  — same createProject handler
  defaultOpen = false,
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Local images (preview only for now)
  const [images, setImages] = useState([]);

  const toggleOpen = () => setIsOpen((v) => !v);

  const jobOn = !!form.is_job_posting;

  const toggleJobPosting = () =>
    setForm((prev) => ({
      ...prev,
      is_job_posting: !prev.is_job_posting,
    }));

  const handleAddImages = (files) => {
    if (!files || !files.length) return;
    const arr = Array.from(files);

    const newImages = arr.map((file) => ({
      id: Math.random().toString(36).slice(2),
      url: URL.createObjectURL(file),
      caption: "",
      _file: file,
    }));

    setImages((prev) => [...prev, ...newImages]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer?.files;
    handleAddImages(files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleImageCaptionChange = (id, caption) => {
    setImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, caption } : img))
    );
  };

  const handleDeleteImage = (image) => {
    setImages((prev) => prev.filter((img) => img.id !== image.id));
  };

  return (
    <Card className="p-5">
      {/* Collapsible header (matches Dashboard style) */}
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-800">
          Create Project
        </div>
        <div className="flex items-center gap-2">
          <Badge>{ownedCount} owned</Badge>
        </div>
      </div>

      <Button type="button" className="mb-3" onClick={toggleOpen}>
        {isOpen ? "Hide form" : "Create new project"}
      </Button>

      {isOpen && (
        <>
          {/* 🔹 Job Posting banner at the very top (same idea as editor card) */}
          <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-900">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-900/80">
                Job Posting
              </div>
              <button
                type="button"
                onClick={toggleJobPosting}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition 
                  ${jobOn ? "bg-sky-500 shadow-sm" : "bg-sky-200"}`}
                role="switch"
                aria-checked={jobOn}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition
                    ${jobOn ? "translate-x-6" : "translate-x-1"}`}
                />
              </button>
            </div>
            <p className="mt-1 text-[11px] text-sky-800">
              Mark this project as a job opportunity clients can respond to.
            </p>
          </div>

          {/* Section label – same as ProjectEditorCard */}
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Project Info (Draft)
          </div>

          <form onSubmit={onSubmit} className="space-y-6">
            {/* Project basics (same fields & order) */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-slate-600">
                  Project Name
                </label>
                <Input
                  placeholder="e.g. Deck renovation"
                  value={form.title}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, title: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">
                  Category
                </label>
                <Input
                  placeholder="e.g. Outdoor space"
                  value={form.category}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, category: e.target.value }))
                  }
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-600">
                Summary
              </label>
              <Textarea
                placeholder="One or two sentences…"
                value={form.summary}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, summary: e.target.value }))
                }
              />
            </div>

            {/* Location / Budget / Sq Ft / Highlights – same order */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-slate-600">
                  Location (not address)
                </label>
                <Input
                  placeholder="City, State (optional)"
                  value={form.location}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, location: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">
                  Budget
                </label>
                <Input
                  placeholder="e.g. 250000"
                  inputMode="numeric"
                  value={form.budget}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, budget: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-slate-600">
                  Square Feet
                </label>
                <Input
                  placeholder="e.g. 300"
                  inputMode="numeric"
                  value={form.sqf}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, sqf: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">
                  Highlights (tags / text)
                </label>
                <Input
                  placeholder="comma-separated: cedar, cable-rail"
                  value={form.highlights}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      highlights: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            {/* Material / tool link + label – same as editor card */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-slate-600">
                  Material / tool link (optional)
                </label>
                <Input
                  placeholder="https://www.example.com/product/123"
                  value={form.material_url}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      material_url: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">
                  Material label (title + price)
                </label>
                <Input
                  placeholder="e.g. Bosch SDS Hammer Drill – $129"
                  value={form.material_label}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      material_label: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            {/* Cover upload + public toggle – same layout */}
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex-1">
                <label className="mb-1 block text-sm text-slate-600">
                  Cover (optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setCover(e.target.files?.[0] || null)
                  }
                  className="block w-full text-sm"
                />
                {cover && (
                  <div className="mt-1 truncate text-xs text-slate-500">
                    {cover.name}
                  </div>
                )}
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  className="mr-2 h-4 w-4 align-middle"
                  checked={!!form.is_public}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      is_public: e.target.checked,
                    }))
                  }
                />
                Public
              </label>
            </div>

            {/* Images list – same structure, just local preview */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">
                  Images
                </span>
                {images.length > 0 && (
                  <span className="text-xs text-slate-500">
                    {images.length} total
                  </span>
                )}
              </div>

              {images.length > 0 ? (
                <div className="space-y-4">
                  {images.map((image) => (
                    <div
                      key={image.id}
                      className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 md:flex-row md:items-center"
                    >
                      <div className="h-32 w-full overflow-hidden rounded-md bg-slate-100 md:w-56">
                        <img
                          src={image.url}
                          alt={image.caption || "Project image"}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-center">
                        <input
                          type="text"
                          className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm"
                          placeholder="Caption..."
                          value={image.caption || ""}
                          onChange={(e) =>
                            handleImageCaptionChange(image.id, e.target.value)
                          }
                        />
                        <div className="flex gap-2">
                          {/* Just a UI button here – no API yet, so keep it non-submitting */}
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {}}
                          >
                            Save caption
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => handleDeleteImage(image)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No images yet.</p>
              )}
            </div>

            {/* Add images – drag & drop area (same placement as editor card’s uploader) */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-700">
                Add Images
              </div>
              <div className="text-xs text-slate-500">
                Drag &amp; drop or click; add captions; upload.
              </div>
              <div
                className="mt-1 flex min-h-[120px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 px-4 text-center text-sm text-slate-500"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  id="create-project-add-images-input"
                  onChange={(e) => handleAddImages(e.target.files)}
                />
                <label
                  htmlFor="create-project-add-images-input"
                  className="cursor-pointer"
                >
                  <div>Drag &amp; drop images here</div>
                  <div className="mt-1 text-xs text-slate-400">
                    or click to browse
                  </div>
                </label>
              </div>
            </div>

            {/* 🔻 FINAL FOOTER: messages + primary action at the very bottom */}
            <div className="space-y-2">
              {error && (
                <div className="text-sm text-red-700">
                  {error}
                </div>
              )}
              {success && !error && (
                <div className="text-sm text-green-700">
                  Project created.
                </div>
              )}
              <Button disabled={busy}>Create Project</Button>
            </div>
          </form>
        </>
      )}
    </Card>
  );
}
