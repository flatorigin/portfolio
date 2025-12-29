// =======================================
// file: frontend/src/pages/Dashboard.jsx
// Owner dashboard: Create project + owned projects list
// =======================================
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { Card, Button, Textarea, Input, Badge } from "../ui";

// Normalize media URLs
function toUrl(raw) {
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
  const origin = base.replace(/\/api\/?$/, "");
  return raw.startsWith("/") ? `${origin}${raw}` : `${origin}/${raw}`;
}

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState("");

  // --- CREATE PROJECT STATE & HELPERS -------------------------
  const [createOpen, setCreateOpen] = useState(true);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createMessage, setCreateMessage] = useState("");

  const [createData, setCreateData] = useState({
    title: "",
    category: "",
    summary: "",
    location: "",
    budget: "",
    sqf: "",
    highlights: "",
    material_url: "",
    material_label: "",
    is_public: true,
    is_job_posting: false,
  });

  const [createExtraLinks, setCreateExtraLinks] = useState([]);
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [isDraggingCover, setIsDraggingCover] = useState(false);

  const updateCreateField = (key) => (e) => {
    const value =
      e && e.target && e.target.type === "checkbox"
        ? e.target.checked
        : e.target.value;
    setCreateData((prev) => ({ ...prev, [key]: value }));
  };

  function addCreateLinkRow() {
    setCreateExtraLinks((prev) => [...prev, { label: "", url: "" }]);
  }

  function updateCreateLinkRow(index, field, value) {
    setCreateExtraLinks((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  function removeCreateLinkRow(index) {
    setCreateExtraLinks((prev) => prev.filter((_, i) => i !== index));
  }

  const setCoverFromFile = (file) => {
    if (!file) return;
    setCoverFile(file);
    try {
      const url = URL.createObjectURL(file);
      setCoverPreview(url);
    } catch {
      setCoverPreview(null);
    }
  };

  const handleCoverChange = (e) => {
    const file = e.target.files?.[0] || null;
    setCoverFromFile(file);
  };

  const handleCoverDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingCover(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) setCoverFromFile(file);
  };

  const handleCoverDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingCover) setIsDraggingCover(true);
  };

  const handleCoverDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingCover(false);
  };

  const normalizeText = (val) => {
    if (val === undefined || val === null) return "";
    return String(val).trim();
  };

  const normalizeNumber = (val) => {
    if (val === undefined || val === null) return null;
    const s = String(val).trim();
    if (!s) return null;
    const cleaned = s.replace(/,/g, "");
    const n = Number(cleaned);
    return Number.isNaN(n) ? null : n;
  };

  async function handleCreateProject(e) {
    e.preventDefault();
    setCreateError("");
    setCreateMessage("");
    setCreateSaving(true);

    try {
      const formData = new FormData();

      formData.append("title", normalizeText(createData.title));
      formData.append("summary", normalizeText(createData.summary));
      formData.append("category", normalizeText(createData.category));
      formData.append("location", normalizeText(createData.location));

      const budget = normalizeNumber(createData.budget);
      const sqf = normalizeNumber(createData.sqf);
      if (budget !== null) formData.append("budget", budget);
      if (sqf !== null) formData.append("sqf", sqf);

      formData.append("highlights", normalizeText(createData.highlights));
      formData.append("material_url", normalizeText(createData.material_url));
      formData.append(
        "material_label",
        normalizeText(createData.material_label)
      );
      formData.append("is_public", createData.is_public ? "true" : "false");
      formData.append(
        "is_job_posting",
        createData.is_job_posting ? "true" : "false"
      );

      createExtraLinks
        .filter((row) => row.label || row.url)
        .forEach((row, index) => {
          formData.append(
            `extra_links[${index}][label]`,
            (row.label || "").trim()
          );
          formData.append(
            `extra_links[${index}][url]`,
            (row.url || "").trim()
          );
        });

      if (coverFile) {
        formData.append("cover_image", coverFile);
      }

      const { data } = await api.post("/projects/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setProjects((prev) => [data, ...prev]);
      setCreateMessage("Project created.");
      setCreateData({
        title: "",
        category: "",
        summary: "",
        location: "",
        budget: "",
        sqf: "",
        highlights: "",
        material_url: "",
        material_label: "",
        is_public: true,
        is_job_posting: false,
      });
      setCreateExtraLinks([]);
      setCoverFile(null);
      setCoverPreview(null);
    } catch (err) {
      console.error("[Dashboard] create project error", err?.response || err);
      const data = err?.response?.data;
      let msg =
        data?.detail ||
        data?.message ||
        data?.non_field_errors ||
        err?.message ||
        data ||
        "Could not create project.";
      if (typeof msg !== "string") msg = JSON.stringify(msg, null, 2);
      setCreateError(msg);
    } finally {
      setCreateSaving(false);
    }
  }

  // --- LOAD OWNED PROJECTS ----------------------------------------
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadingError("");

    (async () => {
      try {
        const { data } = await api.get("/projects/?mine=1");
        if (!alive) return;
        setProjects(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("[Dashboard] load projects error", err?.response || err);
        if (!alive) return;
        setLoadingError("Could not load your projects.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const ownedCount = projects.length;

  // =================================================================
  // RENDER
  // =================================================================
  return (
    <div className="space-y-6">
      {/* Page title */}
      <div className="mb-2">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
      </div>

      {/* CREATE PROJECT CARD */}
      <div className="mt-2">
        <Card className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-slate-900">
                Create Project
              </div>
              <div className="text-[11px] uppercase tracking-wide text-slate-400">
                Project info (draft)
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-[11px] text-slate-500">
                {ownedCount} owned
              </div>
              <Button
                type="button"
                variant={createOpen ? "default" : "outline"}
                size="sm"
                onClick={() => setCreateOpen((v) => !v)}
              >
                {createOpen ? "Hide project form" : "Show project form"}
              </Button>
            </div>
          </div>

          {createOpen && (
            <form onSubmit={handleCreateProject} className="space-y-4">
              {/* Job posting toggle at TOP */}
              <div className="rounded-xl border border-[#37C5F0]/30 bg-[#E6F8FD] px-4 py-3">
                <label className="flex items-center gap-3 text-xs">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-slate-900"
                    checked={!!createData.is_job_posting}
                    onChange={updateCreateField("is_job_posting")}
                  />
                  <div className="space-y-0.5">
                    <div className="text-[13px] font-semibold text-[#37C5F0]">
                      This is a job posting
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Clients can contact you directly to hire you for this
                      work.
                    </div>
                  </div>
                </label>
              </div>

              {/* Project name + Category */}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Project Name
                  </label>
                  <Input
                    value={createData.title}
                    onChange={updateCreateField("title")}
                    placeholder="e.g. Lake House Revamp"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Category
                  </label>
                  <Input
                    value={createData.category}
                    onChange={updateCreateField("category")}
                    placeholder="e.g. Residential"
                  />
                </div>
              </div>

              {/* Summary */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Summary
                </label>
                <Textarea
                  rows={4}
                  value={createData.summary}
                  onChange={updateCreateField("summary")}
                  placeholder="One or two sentences..."
                  className="min-h-[110px]"
                />
              </div>

              {/* Location / Budget / Sq Ft */}
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Location (not address)
                  </label>
                  <Input
                    value={createData.location}
                    onChange={updateCreateField("location")}
                    placeholder="City, State (optional)"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Budget
                  </label>
                  <Input
                    value={createData.budget}
                    onChange={updateCreateField("budget")}
                    placeholder="e.g. 250000"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Square Feet
                  </label>
                  <Input
                    value={createData.sqf}
                    onChange={updateCreateField("sqf")}
                    placeholder="e.g. 1800"
                  />
                </div>
              </div>

              {/* Highlights */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Highlights (tags / text)
                </label>
                <Textarea
                  rows={3}
                  value={createData.highlights}
                  onChange={updateCreateField("highlights")}
                  placeholder="comma-separated: modern, lake-view…"
                />
              </div>

              {/* Materials & links */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Materials &amp; links
                  </div>
                  <button
                    type="button"
                    onClick={addCreateLinkRow}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    title="Add another link"
                  >
                    +
                  </button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">
                      Material label (title + price)
                    </label>
                    <Input
                      value={createData.material_label}
                      onChange={updateCreateField("material_label")}
                      placeholder="e.g. Bosch SDS Hammer Drill — $129"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">
                      Material / tool link (optional)
                    </label>
                    <Input
                      value={createData.material_url}
                      onChange={updateCreateField("material_url")}
                      placeholder="https://www.example.com/product/123"
                    />
                  </div>
                </div>

                {createExtraLinks.length > 0 && (
                  <div className="space-y-2">
                    {createExtraLinks.map((row, index) => (
                      <div
                        key={index}
                        className="grid gap-2 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_auto]"
                      >
                        <Input
                          value={row.label}
                          onChange={(e) =>
                            updateCreateLinkRow(index, "label", e.target.value)
                          }
                          placeholder="Label"
                        />
                        <Input
                          value={row.url}
                          onChange={(e) =>
                            updateCreateLinkRow(index, "url", e.target.value)
                          }
                          placeholder="https://…"
                        />
                        <button
                          type="button"
                          onClick={() => removeCreateLinkRow(index)}
                          className="self-center text-[11px] text-slate-500 hover:text-red-500"
                          title="Remove this link"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Cover drop zone */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Project photos (cover)
                </label>
                <div
                  onDrop={handleCoverDrop}
                  onDragOver={handleCoverDragOver}
                  onDragLeave={handleCoverDragLeave}
                  className={
                    "flex min-h-[180px] flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center text-sm transition-colors " +
                    (isDraggingCover
                      ? "border-sky-400 bg-sky-50"
                      : "border-slate-300 bg-slate-50 hover:border-sky-300 hover:bg-sky-50")
                  }
                >
                  {coverPreview ? (
                    <div className="mb-3 w-full max-w-md overflow-hidden rounded-lg border border-slate-200 bg-white">
                      <img
                        src={coverPreview}
                        alt="Cover preview"
                        className="h-40 w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">
                      Drop an image here to set a project cover.
                    </div>
                  )}

                  <div className="mt-2 text-[11px] text-slate-500">
                    Drag &amp; drop a photo, or{" "}
                    <span className="font-semibold text-sky-600">
                      browse from your device
                    </span>
                    .
                  </div>

                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCoverChange}
                    className="mt-3 text-[11px]"
                  />
                </div>
              </div>

              {/* Messages */}
              {createError && (
                <p className="whitespace-pre-wrap text-xs text-red-600">
                  {createError}
                </p>
              )}
              {createMessage && (
                <p className="text-xs text-emerald-600">{createMessage}</p>
              )}

              {/* Visibility + Create button on same row */}
              <div className="mt-2 flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-slate-900"
                    checked={!!createData.is_public}
                    onChange={updateCreateField("is_public")}
                  />
                  <span>Public</span>
                </label>

                <Button type="submit" disabled={createSaving}>
                  {createSaving ? "Creating…" : "Create Project"}
                </Button>
              </div>
            </form>
          )}
        </Card>
      </div>

      {/* OWNED PROJECTS LIST – with image cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">
            Your projects
          </div>
          {ownedCount > 0 && (
            <div className="text-[11px] text-slate-500">
              {ownedCount} total project{ownedCount === 1 ? "" : "s"}
            </div>
          )}
        </div>

        {loading ? (
          <p className="text-xs text-slate-600">Loading projects…</p>
        ) : loadingError ? (
          <p className="text-xs text-red-600">{loadingError}</p>
        ) : projects.length === 0 ? (
          <p className="text-xs text-slate-500">
            No projects yet. Use the form above to create your first project.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Link
                key={p.id}
                to={`/projects/${p.id}`}
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
              >
                <div className="h-44 bg-slate-100">
                  {p.cover_image ? (
                    <img
                      src={toUrl(p.cover_image)}
                      alt={p.title || "project cover"}
                      className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-slate-500">
                      No image
                    </div>
                  )}
                </div>
                <div className="space-y-1.5 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-semibold text-slate-900">
                      {p.title || `Project #${p.id}`}
                    </div>
                    {p.is_job_posting && (
                      <Badge className="bg-[#37C5F0] text-[10px] font-semibold text-slate-900">
                        JOB POSTING
                      </Badge>
                    )}
                  </div>

                  {p.summary ? (
                    <div className="mt-1 line-clamp-2 text-xs text-slate-600">
                      {p.summary}
                    </div>
                  ) : (
                    <div className="mt-1 text-[11px] text-slate-500">
                      View details →
                    </div>
                  )}

                  <div className="mt-2 text-[11px] text-slate-500">
                    {p.location && <span>{p.location}</span>}
                    {p.budget && (
                      <>
                        <span className="mx-1">•</span>
                        <span>{p.budget}</span>
                      </>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
