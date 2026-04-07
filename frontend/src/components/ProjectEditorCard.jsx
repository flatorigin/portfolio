// ============================================================================
// file: frontend/src/components/ProjectEditorCard.jsx
// Edit Project + Job Posting form fields (Public vs Private draft)
// Action menu: Save Draft / Publish / Send to Contractor
// ============================================================================
import { useMemo, useState } from "react";
import ImageUploader from "./ImageUploader";
import { Card, Input, Textarea, Button, GhostButton, Badge } from "../ui";

function toggleInArray(arr, value) {
  const list = Array.isArray(arr) ? arr : [];
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

function JobPostingHelp({ text }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block">
      <button
        type="button"
        className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-[11px] text-slate-700 hover:bg-slate-50"
        aria-label="Help"
        onClick={() => setOpen((v) => !v)}
      >
        ?
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-50 w-80 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-xl">
          <div className="font-semibold text-slate-900">Private posting</div>
          <div className="mt-1 whitespace-pre-line">{text}</div>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-medium text-slate-800 hover:bg-slate-200"
              onClick={() => setOpen(false)}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </span>
  );
}

export default function ProjectEditorCard({
  mode = "edit",
  projectId,
  form,
  setForm,
  busy = false,
  images = [],
  setImages,
  onSaveImageCaption,
  onDeleteImage,
  onSubmit, // saves project info
  onClose,
  onView,
  onAfterUpload,
  onMakeCover,
  onDeleteProject,
  onSendPrivate, // OPTIONAL: (username, payload) => void (later)
}) {
  const isJobPosting = !!form.is_job_posting;

  // ✅ Fix for your crash: submitLabel is used in JSX, so define it.
  const submitLabel = mode === "edit" ? "Save Changes" : "Create Project";

  const privateHelpText = useMemo(
    () =>
      [
        "Private posts are visible only to the owner and the invited contractor.",
        "When ready, send the job post to a specific contractor username so they can review it and bid.",
        "Private jobs do not appear in public listings or search.",
        "Optional: enable email notifications to get alerted when there’s activity on this post.",
      ].join("\n"),
    []
  );

  const currentCoverId = images.find((img) => Number(img.order) === 0)?.id ?? null;

  const ensureJobDefaults = () => {
    setForm((prev) => ({
      ...prev,
      job_summary: prev.job_summary || "",
      service_categories: Array.isArray(prev.service_categories)
        ? prev.service_categories
        : [],
      part_of_larger_project: !!prev.part_of_larger_project,
      larger_project_details: prev.larger_project_details || "",
      required_expertise: prev.required_expertise || "",
      permit_required: !!prev.permit_required,
      permit_responsible_party: prev.permit_responsible_party || "",
      compliance_confirmed: !!prev.compliance_confirmed,
      post_privacy: prev.post_privacy || "public",
      private_contractor_username: prev.private_contractor_username || "",
      notify_by_email: !!prev.notify_by_email,
    }));
  };

  const toggleJobPosting = () => {
    setForm((p) => ({ ...p, is_job_posting: !p.is_job_posting }));
    ensureJobDefaults();
  };

  // NOTE: Dashboard saves using state; we set form first, then trigger save.
  const saveDraft = async () => {
    ensureJobDefaults();
    setForm((p) => ({ ...p, is_public: false }));
    await new Promise((resolve) => {
      setTimeout(async () => {
        await onSubmit?.();
        resolve();
      }, 0);
    });
  };

  const publishProject = async () => {
    ensureJobDefaults();
    if (isJobPosting && !form.compliance_confirmed) {
      alert("Please confirm compliance before publishing.");
      return;
    }
    if (isJobPosting && (form.post_privacy || "public") !== "public") {
      alert("Private posts are not published. Use Send to Contractor.");
      return;
    }
    setForm((p) => ({ ...p, is_public: true }));
    await new Promise((resolve) => {
      setTimeout(async () => {
        await onSubmit?.();
        resolve();
      }, 0);
    });
  };

  const sendToContractor = async () => {
    ensureJobDefaults();
    const u = (form.private_contractor_username || "").trim();
    if (!isJobPosting) return alert("Turn on Job Posting first.");
    if ((form.post_privacy || "public") !== "private")
      return alert("Set Post Privacy to Private first.");
    if (!u) return alert("Enter a contractor username to send this private post.");
    if (!form.compliance_confirmed)
      return alert("Please confirm compliance before sending.");

    setForm((p) => ({ ...p, is_public: false, post_privacy: "private" }));
    await new Promise((resolve) => {
      setTimeout(async () => {
        await onSubmit?.();
        resolve();
      }, 0);
    });

    if (onSendPrivate) onSendPrivate(u, { ...form, is_public: false, post_privacy: "private" });
  };

  return (
    <Card className="p-5">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-800">
          {mode === "edit" ? `Editing Project #${projectId}` : "Create Project"}
        </div>
        <div className="flex items-center gap-2">
          {onView && projectId && <GhostButton onClick={onView}>View</GhostButton>}
          {onClose && <GhostButton onClick={onClose}>Close</GhostButton>}
        </div>
      </div>

      {/* Job Posting toggle + Public toggle */}
      <div
        className={
          "mb-4 flex items-center justify-between rounded-lg border px-3 py-2 " +
          (isJobPosting ? "border-sky-300 bg-sky-50" : "border-slate-200 bg-slate-50/70")
        }
      >
        {/* LEFT: Job Posting switch + label */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleJobPosting}
            aria-pressed={isJobPosting}
            className={
              "relative inline-flex h-6 w-11 items-center rounded-full border transition " +
              (isJobPosting ? "bg-sky-500 border-sky-500" : "bg-slate-200 border-slate-300")
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
            <div className="font-semibold text-slate-900">Job Posting</div>
            <div className="text-[11px] text-slate-700/90">
              {isJobPosting
                ? "This project is treated as a job post and can receive bids."
                : "Mark this project as a job opportunity."}
            </div>
          </div>
        </div>

        {/* RIGHT: Public toggle */}
        <div className="flex items-center gap-2">
          <div className="text-[11px] font-semibold text-sky-900/80">Public</div>
          <button
            type="button"
            onClick={() => setForm((p) => ({ ...p, is_public: !p.is_public }))}
            aria-pressed={!!form.is_public}
            className={
              "relative inline-flex h-6 w-11 items-center rounded-full border transition " +
              (form.is_public ? "bg-sky-500 border-sky-500" : "bg-slate-200 border-slate-300")
            }
          >
            <span
              className={
                "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition " +
                (form.is_public ? "translate-x-5" : "translate-x-1")
              }
            />
          </button>
        </div>
      </div>

      {/* Basic fields */}
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Project Info (Draft)
      </div>

      <form
        id="project-editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit?.(e);
        }}
        className="grid grid-cols-1 gap-3 md:grid-cols-2"
      >
        <div>
          <label className="mb-1 block text-sm text-slate-600">Project Name</label>
          <Input
            value={form.title || ""}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            placeholder="Project name"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-600">Category</label>
          <Input
            value={form.category || ""}
            onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
            placeholder="Category"
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-1 block text-sm text-slate-600">Summary</label>
          <Textarea
            value={form.summary || ""}
            onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))}
            placeholder="Short description..."
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-600">Location (not address)</label>
          <Input
            value={form.location || ""}
            onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
            placeholder="City, State"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-600">Budget</label>
          <Input
            value={form.budget ?? ""}
            onChange={(e) => setForm((p) => ({ ...p, budget: e.target.value }))}
            inputMode="numeric"
            placeholder="e.g. 25000"
          />
        </div>

        {/* ✅ sqf input (prevents "sqf must be integer" complaints) */}
        <div>
          <label className="mb-1 block text-sm text-slate-600">Square Feet</label>
          <Input
            value={form.sqf ?? ""}
            onChange={(e) => setForm((p) => ({ ...p, sqf: e.target.value }))}
            inputMode="numeric"
            placeholder="e.g. 1800"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-600">Highlights (tags / text)</label>
          <Input
            value={form.highlights || ""}
            onChange={(e) => setForm((p) => ({ ...p, highlights: e.target.value }))}
            placeholder="comma-separated tags"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-600">Material / tool link (optional)</label>
          <Input
            value={form.material_url || ""}
            onChange={(e) => setForm((p) => ({ ...p, material_url: e.target.value }))}
            placeholder="https://www.example.com/product/123"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-600">Material label (title + price)</label>
          <Input
            value={form.material_label || ""}
            onChange={(e) => setForm((p) => ({ ...p, material_label: e.target.value }))}
            placeholder="e.g. Bosch SDS Hammer Drill – $129"
          />
        </div>

        <button type="submit" className="hidden" />
      </form>

      {/* Job Posting details */}
      {isJobPosting && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Job Posting Details
          </div>

          <div className="mt-4">
            <div className="text-sm font-semibold text-slate-800">1. Project Overview</div>

            <div className="mt-3">
              <label className="mb-1 block text-sm text-slate-600">Project Summary</label>
              <Textarea
                placeholder="e.g., Full kitchen remodel including custom cabinetry and island installation."
                value={form.job_summary || ""}
                onChange={(e) => setForm((p) => ({ ...p, job_summary: e.target.value }))}
              />
            </div>

            <div className="mt-3">
              <div className="mb-1 text-sm text-slate-600">Service Category</div>
              <div className="flex flex-wrap gap-3 text-sm text-slate-700">
                {["Plumbing", "Carpentry", "Electrical", "General", "Masonry"].map((c) => (
                  <label key={c} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Array.isArray(form.service_categories) && form.service_categories.includes(c)}
                      onChange={() =>
                        setForm((p) => ({
                          ...p,
                          service_categories: toggleInArray(p.service_categories, c),
                        }))
                      }
                    />
                    {c}
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-3">
              <div className="mb-1 text-sm text-slate-600">Part of Larger Project</div>
              <div className="flex items-center gap-4 text-sm text-slate-700">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="larger_project_edit"
                    checked={!!form.part_of_larger_project}
                    onChange={() => setForm((p) => ({ ...p, part_of_larger_project: true }))}
                  />
                  Yes
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="larger_project_edit"
                    checked={!form.part_of_larger_project}
                    onChange={() =>
                      setForm((p) => ({ ...p, part_of_larger_project: false, larger_project_details: "" }))
                    }
                  />
                  No
                </label>
              </div>

              {form.part_of_larger_project && (
                <div className="mt-2">
                  <label className="mb-1 block text-sm text-slate-600">If yes, specify</label>
                  <Input
                    value={form.larger_project_details || ""}
                    onChange={(e) => setForm((p) => ({ ...p, larger_project_details: e.target.value }))}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="mt-6">
            <div className="text-sm font-semibold text-slate-800">2. Professional &amp; Legal Requirements</div>

            <div className="mt-3">
              <div className="mb-1 text-sm text-slate-600">Required Expertise</div>
              <div className="flex flex-col gap-2 text-sm text-slate-700">
                <label className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="expertise_edit"
                    checked={form.required_expertise === "licensed_pro"}
                    onChange={() => setForm((p) => ({ ...p, required_expertise: "licensed_pro" }))}
                  />
                  <span>
                    <span className="font-medium">Licensed Professional</span>{" "}
                    <span className="text-xs text-slate-500">(verified credentials/insurance)</span>
                  </span>
                </label>
                <label className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="expertise_edit"
                    checked={form.required_expertise === "handyman"}
                    onChange={() => setForm((p) => ({ ...p, required_expertise: "handyman" }))}
                  />
                  <span>
                    <span className="font-medium">Handyman / Expert Help</span>{" "}
                    <span className="text-xs text-slate-500">(general labor/skilled assistance)</span>
                  </span>
                </label>
              </div>
            </div>

            <div className="mt-3">
              <div className="mb-1 text-sm text-slate-600">Permitting</div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={!!form.permit_required}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      permit_required: e.target.checked,
                      permit_responsible_party: e.target.checked
                        ? p.permit_responsible_party || "contractor"
                        : "",
                    }))
                  }
                />
                Permit Required
              </label>

              {form.permit_required && (
                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="permit_party_edit"
                      checked={form.permit_responsible_party === "contractor"}
                      onChange={() => setForm((p) => ({ ...p, permit_responsible_party: "contractor" }))}
                    />
                    Contractor handles filing
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="permit_party_edit"
                      checked={form.permit_responsible_party === "homeowner"}
                      onChange={() => setForm((p) => ({ ...p, permit_responsible_party: "homeowner" }))}
                    />
                    Homeowner handles filing
                  </label>
                </div>
              )}
            </div>

            <div className="mt-3">
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={!!form.compliance_confirmed}
                  onChange={(e) => setForm((p) => ({ ...p, compliance_confirmed: e.target.checked }))}
                />
                <span>
                  I confirm this post complies with Portfolio Terms of Service, is not spam, and abides by all State and Federal laws.
                </span>
              </label>
            </div>
          </div>

          <div className="mt-6">
            <div className="text-sm font-semibold text-slate-800">4. Visibility &amp; Media</div>

            <div className="mt-3 flex items-center gap-4 text-sm text-slate-700">
              <div className="font-medium">Post Privacy</div>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="privacy_edit"
                  checked={(form.post_privacy || "public") === "public"}
                  onChange={() => setForm((p) => ({ ...p, post_privacy: "public", private_contractor_username: "" }))}
                />
                Public
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="privacy_edit"
                  checked={form.post_privacy === "private"}
                  onChange={() => setForm((p) => ({ ...p, post_privacy: "private" }))}
                />
                Private
                <JobPostingHelp text={privateHelpText} />
              </label>
            </div>

            {form.post_privacy === "private" && (
              <div className="mt-2">
                <label className="mb-1 block text-sm text-slate-600">Private contractor username</label>
                <Input
                  value={form.private_contractor_username || ""}
                  onChange={(e) => setForm((p) => ({ ...p, private_contractor_username: e.target.value }))}
                />
              </div>
            )}

            <div className="mt-3">
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={!!form.notify_by_email}
                  onChange={(e) => setForm((p) => ({ ...p, notify_by_email: e.target.checked }))}
                />
                <span>Email me when I receive a response and need to take action.</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Images + uploader */}
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
                  <figure key={it.id ?? it.url} className="rounded-xl border border-slate-200 bg-white p-3">
                    <img
                      src={it.url}
                      alt=""
                      className="mb-2 h-36 w-full rounded-md object-cover"
                      onError={(e) => {
                        e.currentTarget.src = "/placeholder.png";
                      }}
                    />

                    <input
                      className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                      placeholder="Caption…"
                      value={it._localCaption}
                      onChange={(e) =>
                        setImages((prev) =>
                          prev.map((x) => (x.id === it.id ? { ...x, _localCaption: e.target.value } : x))
                        )
                      }
                    />

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <label className="flex items-center gap-1 text-[11px] text-slate-600">
                        <input
                          type="radio"
                          name="cover-image"
                          className="h-3 w-3"
                          checked={String(currentCoverId ?? "") === String(it.id ?? "")}
                          onChange={() => onMakeCover?.(it.id)}
                        />
                        <span>
                          {String(currentCoverId ?? "") === String(it.id ?? "")
                            ? "Cover image"
                            : "Make cover"}
                        </span>
                      </label>

                      <div className="flex items-center gap-2">
                        <GhostButton
                          onClick={() => it.id && onDeleteImage?.(it)}
                          disabled={!it.id || busy}
                        >
                          Delete
                        </GhostButton>
                        <Button
                          onClick={() => onSaveImageCaption?.(it)}
                          disabled={it._saving || it._localCaption === it.caption}
                        >
                          {it._saving ? "Saving…" : "Save caption"}
                        </Button>
                      </div>
                    </div>
                  </figure>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6">
            <div className="mb-2 text-sm font-semibold text-slate-800">Add Images</div>
            <div className="mb-2 text-xs text-slate-600">Drag & drop or click; add captions; upload.</div>
            <ImageUploader
              projectId={projectId}
              onUploaded={async () => {
                if (onAfterUpload) await onAfterUpload();
              }}
            />
          </div>
        </>
      )}

      {/* Actions */}
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className="!opacity-100 hover:!opacity-100 text-white-700 hover:text-white bg-slate-90 hover:!bg-red-600"
          onClick={onDeleteProject}
          disabled={busy}
        >
          Delete project
        </Button>

        {isJobPosting ? (
          <>
            <Button type="button" variant="outline" disabled={busy} onClick={saveDraft}>
              Save as Draft
            </Button>

            {form.post_privacy === "private" ? (
              <Button type="button" disabled={busy} onClick={sendToContractor}>
                Send to Contractor
              </Button>
            ) : (
              <Button type="button" disabled={busy} onClick={publishProject}>
                Publish Project
              </Button>
            )}
          </>
        ) : (
          <Button type="submit" disabled={busy} form="project-editor-form">
            {submitLabel}
          </Button>
        )}
      </div>
    </Card>
  );
}
