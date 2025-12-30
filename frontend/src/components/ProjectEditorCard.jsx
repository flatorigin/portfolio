// =======================================
// file: frontend/src/components/ProjectEditorCard.jsx
// Standalone card for creating/editing a project + images
// =======================================
import ImageUploader from "./ImageUploader";
import {
  Card,
  Input,
  Textarea,
  Button,
  GhostButton,
  Badge,
} from "../ui";

export default function ProjectEditorCard({
  mode = "edit",                 // "edit" | "create"
  projectId,                     // id when editing, optional for create
  form,                          // { title, summary, category, ... }
  setForm,                       // setForm(prev => ({...prev, field }))
  coverFile,
  setCoverFile,
  busy = false,
  images = [],                   // [{ id, url, caption, _localCaption, _saving }]
  setImages,                     // setImages(prev => [...])
  onSaveImageCaption,            // (image) => void
  onDeleteImage,                 // (image) => void
  onSubmit,                      // () => void or (event) => void
  onClose,                       // () => void
  onView,                        // () => void (open public project page)
  onAfterUpload,                 // async () => { refresh images + projects }
}) {
  const headerTitle =
    mode === "edit"
      ? projectId
        ? `Editing Project #${projectId}`
        : "Edit Project"
      : "Create Project";

  const submitLabel = mode === "edit" ? "Save Changes" : "Create Project";
  const isJobPosting = !!form.is_job_posting;

  return (
    <Card className="p-5">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-800">
          {headerTitle}
        </div>
        <div className="flex items-center gap-2">
          {onView && projectId && (
            <GhostButton onClick={onView}>View</GhostButton>
          )}
          {onClose && (
            <GhostButton onClick={onClose}>
              {mode === "edit" ? "Close" : "Cancel"}
            </GhostButton>
          )}
        </div>
      </div>

      {/* Job Posting toggle – TOP of card */}
      <div className="mb-4 flex items-center justify-between rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
        <div className="flex items-center gap-3">
          {/* Switch */}
          <button
            type="button"
            onClick={() =>
              setForm((prev) => ({
                ...prev,
                is_job_posting: !prev.is_job_posting,
              }))
            }
            aria-pressed={isJobPosting}
            className={
              "relative inline-flex h-6 w-11 items-center rounded-full border transition " +
              (isJobPosting
                ? "bg-sky-500 border-sky-500"
                : "bg-slate-200 border-slate-300")
            }
          >
            <span
              className={
                "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition " +
                (isJobPosting ? "translate-x-5" : "translate-x-1")
              }
            />
          </button>

          <div className="text-xs">
            <div className="font-semibold text-sky-900">
              Job Posting
            </div>
            <div className="text-[11px] text-sky-700/90">
              Mark this project as a job opportunity clients can respond to.
            </div>
          </div>
        </div>

        <div className="hidden sm:block">
          <Badge
            className={
              isJobPosting
                ? "bg-sky-600 text-white"
                : "bg-slate-200 text-slate-700"
            }
          >
            {isJobPosting ? "On" : "Off"}
          </Badge>
        </div>
      </div>

      {/* Basic info form */}
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Project Info (Draft)
      </div>

      <form
        onSubmit={(e) => {
          // still support Enter-to-submit
          e.preventDefault();
          if (onSubmit) onSubmit(e);
        }}
        className="grid grid-cols-1 gap-3 md:grid-cols-2"
      >
        <div>
          <label className="mb-1 block text-sm text-slate-600">
            Project Name
          </label>
          <Input
            value={form.title}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, title: e.target.value }))
            }
            placeholder="Project name"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-600">
            Category
          </label>
          <Input
            value={form.category}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, category: e.target.value }))
            }
            placeholder="Category"
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-1 block text-sm text-slate-600">
            Summary
          </label>
          <Textarea
            value={form.summary}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, summary: e.target.value }))
            }
            placeholder="Short description..."
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-600">
            Location (not address)
          </label>
          <Input
            value={form.location}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, location: e.target.value }))
            }
            placeholder="City, State"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-600">
            Budget
          </label>
          <Input
            value={form.budget}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, budget: e.target.value }))
            }
            inputMode="numeric"
            placeholder="e.g. 250000"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-600">
            Square Feet
          </label>
          <Input
            value={form.sqf}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, sqf: e.target.value }))
            }
            inputMode="numeric"
            placeholder="e.g. 1800"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-600">
            Highlights (tags / text)
          </label>
          <Input
            value={form.highlights}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                highlights: e.target.value,
              }))
            }
            placeholder="comma-separated tags"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-600">
            Material / tool link (optional)
          </label>
          <Input
            value={form.material_url}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                material_url: e.target.value,
              }))
            }
            placeholder="https://www.example.com/product/123"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-600">
            Material label (title + price)
          </label>
          <Input
            value={form.material_label}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                material_label: e.target.value,
              }))
            }
            placeholder="e.g. Bosch SDS Hammer Drill – $129"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-600">
            Cover (replace)
          </label>
          <input
            type="file"
            onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
          />
          {coverFile && (
            <div className="mt-1 truncate text-xs text-slate-500">
              {coverFile.name}
            </div>
          )}
        </div>

        {/* Public checkbox */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">
            <input
              type="checkbox"
              className="mr-2 align-middle"
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

        {/* Hidden submit so Enter works, but visible button is at bottom of card */}
        <div className="md:col-span-2">
          <button type="submit" className="hidden">
            {submitLabel}
          </button>
        </div>
      </form>

      {/* Images section (edit mode only) */}
      {mode === "edit" && projectId && (
        <>
          <div className="mt-6">
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
                {images.map((it) => (
                  <figure
                    key={it.id ?? it.url}
                    className="rounded-xl border border-slate-200 bg-white p-3"
                  >
                    <img
                      src={it.url}
                      alt=""
                      className="mb-2 h-36 w-full rounded-md object-cover"
                    />
                    <input
                      className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                      placeholder="Caption…"
                      value={it._localCaption}
                      onChange={(e) =>
                        setImages((prev) =>
                          prev.map((x) =>
                            x.id === it.id
                              ? { ...x, _localCaption: e.target.value }
                              : x
                          )
                        )
                      }
                    />
                    <div className="mt-2 flex items-center justify-between">
                      <GhostButton
                        onClick={() => {
                          if (it.id) onDeleteImage(it);
                        }}
                        disabled={!it.id || busy}
                        title={
                          it.id
                            ? "Delete this image"
                            : "This API response has no image id — delete is disabled"
                        }
                      >
                        Delete
                      </GhostButton>
                      <Button
                        onClick={() => onSaveImageCaption(it)}
                        disabled={
                          it._saving || it._localCaption === it.caption
                        }
                      >
                        {it._saving ? "Saving…" : "Save caption"}
                      </Button>
                    </div>
                  </figure>
                ))}
              </div>
            )}
          </div>

          {/* Uploader */}
          <div className="mt-6">
            <div className="mb-2 text-sm font-semibold text-slate-800">
              Add Images
            </div>
            <div className="mb-2 text-xs text-slate-600">
              Drag & drop or click; add captions; upload.
            </div>
            <ImageUploader
              projectId={projectId}
              onUploaded={async () => {
                if (onAfterUpload) {
                  await onAfterUpload();
                }
              }}
            />
          </div>
        </>
      )}

      {/* PRIMARY SUBMIT BUTTON – BOTTOM of card */}
      <div className="mt-6 flex justify-end">
        <Button
          type="button"
          disabled={busy}
          onClick={() => {
            if (onSubmit) onSubmit();
          }}
        >
          {submitLabel}
        </Button>
      </div>
    </Card>
  );
}
