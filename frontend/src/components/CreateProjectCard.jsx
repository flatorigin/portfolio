// ============================================================================
// file: frontend/src/components/CreateProjectCard.jsx
// Create Project + Job Posting form fields (Public vs Private draft)
// Action menu: Save Draft / Publish / Send to Contractor (placeholder)
// ============================================================================
import { useMemo, useState } from "react";
import { Card, Input, Textarea, Button, Badge } from "../ui";

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

export default function CreateProjectCard({
  ownedCount = 0,
  form,
  setForm,
  cover,
  setCover,
  busy = false,
  error,
  success,
  onSubmit, // (event, images) => void
  onSendPrivate, // OPTIONAL: (username, payload) => void  (later)
  defaultOpen = false,
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [images, setImages] = useState([]);

  const jobOn = !!form.is_job_posting;

  const privateHelpText = useMemo(
    () =>
      [
        "Private posts are drafts you can keep improving.",
        "When ready, you can send the job post to a specific contractor username.",
        "Limit: you can send to one contractor per day (enforced later).",
        "Optional: enable email notifications to get alerted when there’s activity on this post.",
      ].join("\n"),
    []
  );

  const ensureJobDefaults = () => {
    setForm((prev) => ({
      ...prev,
      job_summary: prev.job_summary || "",
      service_categories: Array.isArray(prev.service_categories) ? prev.service_categories : [],
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

  const validatePublish = () => {
    if (!jobOn) return { ok: true };

    if (!form.compliance_confirmed) {
      return { ok: false, msg: "Please confirm compliance before publishing." };
    }

    // Publish is only for PUBLIC job posts
    if ((form.post_privacy || "public") !== "public") {
      return { ok: false, msg: "Private posts are not published. Use Send to Contractor." };
    }

    return { ok: true };
  };

  const validateSendPrivate = () => {
    if (!jobOn) return { ok: false, msg: "Turn on Job Posting first." };
    if ((form.post_privacy || "public") !== "private") {
      return { ok: false, msg: "Set Post Privacy to Private to send to a contractor." };
    }
    const u = (form.private_contractor_username || "").trim();
    if (!u) return { ok: false, msg: "Enter a contractor username to send this private post." };
    if (!form.compliance_confirmed) {
      return { ok: false, msg: "Please confirm compliance before sending." };
    }
    return { ok: true, username: u };
  };

  const toggleJobPosting = () => {
    setForm((prev) => ({ ...prev, is_job_posting: !prev.is_job_posting }));
    ensureJobDefaults();
  };

  const toggleOpen = () => {
    setIsOpen((v) => !v);
    if (isOpen) setImages([]); // close => reset images
  };

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
    handleAddImages(e.dataTransfer?.files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleImageCaptionChange = (id, caption) => {
    setImages((prev) => prev.map((img) => (img.id === id ? { ...img, caption } : img)));
  };

  const handleDeleteImage = (image) => {
    setImages((prev) => prev.filter((img) => img.id !== image.id));
  };

  const saveDraft = (e) => {
    e.preventDefault();
    ensureJobDefaults();
    setForm((p) => ({ ...p, is_public: false }));
    onSubmit(e, images);
    setIsOpen(false);
    setImages([]);
  };

  const publishProject = (e) => {
    e.preventDefault();
    ensureJobDefaults();

    const v = validatePublish();
    if (!v.ok) return alert(v.msg);

    setForm((p) => ({ ...p, is_public: true }));
    onSubmit(e, images);
    setIsOpen(false);
    setImages([]);
  };

  const sendToContractor = (e) => {
    e.preventDefault();
    ensureJobDefaults();

    const v = validateSendPrivate();
    if (!v.ok) return alert(v.msg);

    // For now: save as draft (private) and call optional hook
    setForm((p) => ({ ...p, is_public: false, post_privacy: "private" }));
    onSubmit(e, images);

    if (onSendPrivate) {
      onSendPrivate(v.username, { ...form, is_public: false, post_privacy: "private" });
    } else {
      alert(
        "Saved as Private draft. Sending/notification will be implemented next (contractor will be notified later)."
      );
    }

    setIsOpen(false);
    setImages([]);
  };

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-800">Create Project</div>
        <Badge>{ownedCount} owned</Badge>
      </div>

      <Button type="button" className="mb-3" onClick={toggleOpen}>
        {isOpen ? "Hide form" : "Create new project"}
      </Button>

      {isOpen && (
        <>
          {/* Job Posting banner */}
          <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-900">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-900/80">
                Job Posting
              </div>
              <button
                type="button"
                onClick={toggleJobPosting}
                className={
                  "relative inline-flex h-7 w-12 items-center rounded-full transition " +
                  (jobOn ? "bg-sky-500 shadow-sm" : "bg-sky-200")
                }
                role="switch"
                aria-checked={jobOn}
              >
                <span
                  className={
                    "inline-block h-5 w-5 transform rounded-full bg-white shadow transition " +
                    (jobOn ? "translate-x-6" : "translate-x-1")
                  }
                />
              </button>
            </div>
            <p className="mt-1 text-[11px] text-sky-800">
              {jobOn
                ? "This project will be treated as a job post (homeowners posting jobs for pros)."
                : "Turn this on when a homeowner is posting work for contractors."}
            </p>
          </div>

          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Project Info (Draft)
          </div>

          <form onSubmit={(e) => onSubmit(e, images)} className="space-y-6">
            {/* Basics */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-slate-600">Project Name</label>
                <Input
                  placeholder="e.g. Kitchen remodel"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">Category</label>
                <Input
                  placeholder="e.g. Renovation"
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-600">Summary</label>
              <Textarea
                placeholder="One or two sentences…"
                value={form.summary}
                onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))}
              />
            </div>

            {/* Location / Budget */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-slate-600">Location</label>
                <Input
                  placeholder="City, State"
                  value={form.location}
                  onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">Budget</label>
                <Input
                  placeholder="e.g. 25000"
                  inputMode="numeric"
                  value={form.budget}
                  onChange={(e) => setForm((p) => ({ ...p, budget: e.target.value }))}
                />
              </div>
            </div>

            {/* Public checkbox (still used, but actions set it) */}
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={!!form.is_public}
                  onChange={(e) => setForm((p) => ({ ...p, is_public: e.target.checked }))}
                />
                Public
              </label>
            </div>

            {/* Job Posting Extensions */}
            {jobOn && (
              <Card className="border border-slate-200 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Job Posting Details
                </div>

                {/* 1. Project Overview */}
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
                          name="larger_project"
                          checked={!!form.part_of_larger_project}
                          onChange={() => setForm((p) => ({ ...p, part_of_larger_project: true }))}
                        />
                        Yes
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="larger_project"
                          checked={!form.part_of_larger_project}
                          onChange={() =>
                            setForm((p) => ({
                              ...p,
                              part_of_larger_project: false,
                              larger_project_details: "",
                            }))
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
                          onChange={(e) =>
                            setForm((p) => ({ ...p, larger_project_details: e.target.value }))
                          }
                          placeholder="Describe the larger project context"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Professional & Legal Requirements */}
                <div className="mt-6">
                  <div className="text-sm font-semibold text-slate-800">
                    2. Professional &amp; Legal Requirements
                  </div>

                  <div className="mt-3">
                    <div className="mb-1 text-sm text-slate-600">Required Expertise</div>
                    <div className="flex flex-col gap-2 text-sm text-slate-700">
                      <label className="flex items-start gap-2">
                        <input
                          type="radio"
                          name="expertise"
                          checked={form.required_expertise === "licensed_pro"}
                          onChange={() =>
                            setForm((p) => ({ ...p, required_expertise: "licensed_pro" }))
                          }
                        />
                        <span>
                          <span className="font-medium">Licensed Professional</span>{" "}
                          <span className="text-xs text-slate-500">
                            (requires verified credentials/insurance)
                          </span>
                        </span>
                      </label>
                      <label className="flex items-start gap-2">
                        <input
                          type="radio"
                          name="expertise"
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
                            name="permit_party"
                            checked={form.permit_responsible_party === "contractor"}
                            onChange={() =>
                              setForm((p) => ({ ...p, permit_responsible_party: "contractor" }))
                            }
                          />
                          Contractor handles filing
                        </label>
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="radio"
                            name="permit_party"
                            checked={form.permit_responsible_party === "homeowner"}
                            onChange={() =>
                              setForm((p) => ({ ...p, permit_responsible_party: "homeowner" }))
                            }
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

                {/* 4. Visibility & Media */}
                <div className="mt-6">
                  <div className="text-sm font-semibold text-slate-800">
                    4. Visibility &amp; Media
                  </div>

                  <div className="mt-3 flex items-center gap-4 text-sm text-slate-700">
                    <div className="font-medium">Post Privacy</div>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="privacy"
                        checked={(form.post_privacy || "public") === "public"}
                        onChange={() =>
                          setForm((p) => ({ ...p, post_privacy: "public", private_contractor_username: "" }))
                        }
                      />
                      Public
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="privacy"
                        checked={form.post_privacy === "private"}
                        onChange={() => setForm((p) => ({ ...p, post_privacy: "private" }))}
                      />
                      Private
                      <JobPostingHelp text={privateHelpText} />
                    </label>
                  </div>

                  {form.post_privacy === "private" && (
                    <div className="mt-2">
                      <label className="mb-1 block text-sm text-slate-600">
                        Private contractor username
                      </label>
                      <Input
                        value={form.private_contractor_username || ""}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, private_contractor_username: e.target.value }))
                        }
                        placeholder="e.g. john-builder"
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
              </Card>
            )}

            {/* Images */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Images</span>
                {images.length > 0 && (
                  <span className="text-xs text-slate-500">{images.length} total</span>
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
                          onError={(e) => {
                            e.currentTarget.src = "/placeholder.png";
                          }}
                        />
                      </div>
                      <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-center">
                        <input
                          type="text"
                          className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm"
                          placeholder="Caption..."
                          value={image.caption || ""}
                          onChange={(e) => handleImageCaptionChange(image.id, e.target.value)}
                        />
                        <div className="flex gap-2">
                          <Button type="button" variant="ghost" onClick={() => handleDeleteImage(image)}>
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

            {/* Add images */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-700">Add Images</div>
              <div className="text-xs text-slate-500">Drag & drop or click; add captions; upload.</div>
              <div
                className="mt-1 flex min-h-[120px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 px-4 text-center text-sm text-slate-500"
                onDrop={handleDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  id="create-project-add-images-input"
                  onChange={(e) => handleAddImages(e.target.files)}
                />
                <label htmlFor="create-project-add-images-input" className="cursor-pointer">
                  <div>Drag & drop images here</div>
                  <div className="mt-1 text-xs text-slate-400">or click to browse</div>
                </label>
              </div>
            </div>

            {/* Action Menu */}
            <div className="space-y-2">
              {error && <div className="text-sm text-red-700">{error}</div>}
              {success && !error && <div className="text-sm text-green-700">Saved.</div>}

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" disabled={busy} onClick={saveDraft}>
                  Save as Draft
                </Button>

                {jobOn && form.post_privacy === "private" ? (
                  <Button type="button" disabled={busy} onClick={sendToContractor}>
                    Send to Contractor
                  </Button>
                ) : (
                  <Button type="button" disabled={busy} onClick={publishProject}>
                    Publish Project
                  </Button>
                )}
              </div>
            </div>
          </form>
        </>
      )}
    </Card>
  );
}