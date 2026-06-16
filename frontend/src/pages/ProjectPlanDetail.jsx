import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../api";
import {
  Badge,
  Button,
  Card,
  GhostButton,
  Input,
  SymbolIcon,
  Textarea,
} from "../ui";

const CONTRACTOR_SUGGESTIONS = [
  "carpenter",
  "window installer",
  "roofer",
  "painter",
  "electrician",
  "plumber",
  "tile installer",
  "general contractor",
];

const VISIBLE_CONTRACTOR_TYPE_LIMIT = 6;

function emptyLink() {
  return { url: "", label: "", notes: "" };
}

function normalizeError(err, fallback) {
  const data = err?.response?.data;
  return (
    data?.detail ||
    data?.message ||
    (data ? JSON.stringify(data) : "") ||
    err?.message ||
    fallback
  );
}

function canGenerateDraft(plan) {
  const hasTitleOrSummary = !!(
    (plan?.title || "").trim() || (plan?.issue_summary || "").trim()
  );
  const hasNoteOrImage = !!(
    (plan?.notes || "").trim() || (plan?.images || []).length
  );
  return hasTitleOrSummary && hasNoteOrImage;
}

function toDraftPayload(plan) {
  return {
    title: plan.title || "Untitled issue",
    issue_summary: plan.issue_summary || "",
    house_location: plan.house_location || "",
    priority: plan.priority || "medium",
    budget_min: plan.budget_min || null,
    budget_max: plan.budget_max || null,
    notes: plan.notes || "",
    status: plan.status || "planning",
    contractor_types: Array.isArray(plan.contractor_types)
      ? plan.contractor_types
      : [],
    links: Array.isArray(plan.links)
      ? plan.links.filter((item) => item?.url)
      : [],
    options: Array.isArray(plan.options)
      ? plan.options
          .filter((item) => item?.title)
          .map((item) => ({
            ...item,
            is_selected: item.key === plan.selected_option_key,
          }))
      : [],
    selected_option_key: plan.selected_option_key || "",
  };
}

export default function ProjectPlanDetail() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [draftBusy, setDraftBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState("");
  const [customContractor, setCustomContractor] = useState("");
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiOptions, setAiOptions] = useState([]);
  const [researchOpen, setResearchOpen] = useState(false);
  const [error, setError] = useState("");

  async function loadPlan() {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/project-plans/${planId}/`);
      setPlan({
        ...data,
        links:
          Array.isArray(data?.links) && data.links.length
            ? data.links
            : [emptyLink()],
        options: Array.isArray(data?.options) ? data.options : [],
      });
    } catch (err) {
      setError(normalizeError(err, "Could not load this project plan."));
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPlan();
  }, [planId]);

  const aiDisabled = useMemo(
    () => Number(plan?.ai_remaining_today ?? 0) <= 0,
    [plan],
  );
  const contractorTypeOptions = useMemo(() => {
    const selectedTypes = Array.isArray(plan?.contractor_types)
      ? plan.contractor_types
      : [];
    const visibleTypes = [
      ...selectedTypes,
      ...CONTRACTOR_SUGGESTIONS.filter((item) => !selectedTypes.includes(item)),
    ];
    return visibleTypes.slice(0, VISIBLE_CONTRACTOR_TYPE_LIMIT);
  }, [plan?.contractor_types]);

  function updateField(name, value) {
    setPlan((prev) => ({ ...prev, [name]: value }));
  }

  function updateLink(index, field, value) {
    setPlan((prev) => ({
      ...prev,
      links: (prev.links || []).map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }));
  }

  function addLink() {
    setPlan((prev) => ({
      ...prev,
      links: [...(prev.links || []), emptyLink()],
    }));
  }

  function removeLink(index) {
    setPlan((prev) => {
      const next = (prev.links || []).filter(
        (_, itemIndex) => itemIndex !== index,
      );
      return { ...prev, links: next.length ? next : [emptyLink()] };
    });
  }

  function toggleContractorType(value) {
    const current = Array.isArray(plan?.contractor_types)
      ? plan.contractor_types
      : [];
    const exists = current.includes(value);
    updateField(
      "contractor_types",
      exists ? current.filter((item) => item !== value) : [...current, value],
    );
  }

  function addCustomContractorType() {
    const value = customContractor.trim().toLowerCase();
    if (!value) return;
    const current = Array.isArray(plan?.contractor_types)
      ? plan.contractor_types
      : [];
    updateField("contractor_types", [
      value,
      ...current.filter((item) => item !== value),
    ]);
    setCustomContractor("");
  }

  async function savePlan() {
    if (!plan) return;
    setSaving(true);
    try {
      const { data } = await api.patch(
        `/project-plans/${planId}/`,
        toDraftPayload(plan),
      );
      setPlan({
        ...data,
        links:
          Array.isArray(data?.links) && data.links.length
            ? data.links
            : [emptyLink()],
        options: Array.isArray(data?.options) ? data.options : [],
      });
    } catch (err) {
      window.alert(normalizeError(err, "Could not save this project plan."));
    } finally {
      setSaving(false);
    }
  }

  async function archivePlan() {
    if (
      !window.confirm(
        "Archive this plan? It will stay saved as an inactive project plan and still count toward your 3 project plan slots.",
      )
    )
      return;
    try {
      await api.post(`/project-plans/${planId}/archive/`);
      navigate("/dashboard");
    } catch (err) {
      window.alert(normalizeError(err, "Could not archive this plan."));
    }
  }

  async function uploadImages(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("images", file));
      files.forEach(() => formData.append("captions", ""));
      await api.post(`/project-plans/${planId}/images/`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await loadPlan();
    } catch (err) {
      window.alert(normalizeError(err, "Could not upload images."));
    } finally {
      event.target.value = "";
      setUploading(false);
    }
  }

  async function updateImage(imageId, payload) {
    await api.patch(`/project-plans/${planId}/images/${imageId}/`, payload);
    await loadPlan();
  }

  async function removeImage(imageId) {
    if (!window.confirm("Delete this image?")) return;
    try {
      await api.delete(`/project-plans/${planId}/images/${imageId}/`);
      await loadPlan();
    } catch (err) {
      window.alert(normalizeError(err, "Could not delete this image."));
    }
  }

  async function runAi(action) {
    setAiBusy(action);
    try {
      const { data } = await api.post(`/project-plans/${planId}/ai/`, {
        action,
      });
      if (action === "analyze_issue") {
        setAiAnalysis(data.analysis || null);
      } else {
        setAiOptions(Array.isArray(data.options) ? data.options : []);
      }
      await loadPlan();
    } catch (err) {
      window.alert(normalizeError(err, "AI assist is unavailable right now."));
    } finally {
      setAiBusy("");
    }
  }

  function applyAnalysis() {
    if (!aiAnalysis) return;
    setPlan((prev) => ({
      ...prev,
      issue_summary:
        [aiAnalysis.likely_issue_label, aiAnalysis.explanation]
          .filter(Boolean)
          .join(": ") || prev.issue_summary,
      contractor_types:
        Array.isArray(aiAnalysis.contractor_types) &&
        aiAnalysis.contractor_types.length
          ? aiAnalysis.contractor_types.map((item) =>
              String(item).toLowerCase(),
            )
          : prev.contractor_types,
      notes:
        (prev.notes || "") +
        ((prev.notes || "").trim() ? "\n\n" : "") +
        (Array.isArray(aiAnalysis.next_steps) && aiAnalysis.next_steps.length
          ? `Possible next steps:\n- ${aiAnalysis.next_steps.join("\n- ")}`
          : ""),
    }));
  }

  function applyAiOptions() {
    if (!aiOptions.length) return;
    setPlan((prev) => ({
      ...prev,
      options: aiOptions.map((option, index) => ({
        key: `ai-option-${index + 1}`,
        title: option.title || `Option ${index + 1}`,
        notes: option.notes || "",
        pros: option.pros || "",
        cons: option.cons || "",
        estimated_cost_note: option.estimated_cost_note || "",
        is_selected: index === 0,
      })),
      selected_option_key: "ai-option-1",
      status: prev.status === "planning" ? "ready_to_draft" : prev.status,
    }));
  }

  async function createDraft(useAi) {
    if (!canGenerateDraft(plan)) return;
    setDraftBusy(true);
    try {
      const { data } = await api.post(
        `/project-plans/${planId}/convert-to-draft/`,
        {
          use_ai: useAi,
        },
      );
      navigate(`/projects/${data.draft_id}`);
    } catch (err) {
      const data = err?.response?.data;
      if (data?.draft_id) {
        navigate(`/projects/${data.draft_id}`);
        return;
      }
      window.alert(normalizeError(err, "Could not generate a draft job post."));
    } finally {
      setDraftBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-slate-500">
        Loading plan...
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error || "Project plan not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Link
            to="/dashboard"
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            Dashboard
          </Link>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            {plan.title || "Untitled issue"}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge className="capitalize">
              {String(plan.status || "planning").replaceAll("_", " ")}
            </Badge>
            <Badge>Private</Badge>
            <Badge>{plan.ai_remaining_today} AI assists left today</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <GhostButton type="button" onClick={archivePlan}>
            Archive
          </GhostButton>
          <Button type="button" disabled={saving} onClick={savePlan}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {plan.converted_job_post ? (
        <Card className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 shadow-none">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-semibold text-emerald-900">
                This plan already generated a draft job post.
              </div>
              <div className="text-sm text-emerald-800">
                Keep this planner for reference or open the draft to keep
                editing.
              </div>
            </div>
            <Button
              type="button"
              onClick={() => navigate(`/projects/${plan.converted_job_post}`)}
            >
              Open draft job post
            </Button>
          </div>
        </Card>
      ) : null}

      <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5">
          <div className="text-lg font-semibold text-slate-950">
            Project Details
          </div>
          <div className="mt-1 text-sm text-slate-500">
            Define the project clearly before turning it into a job post.
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Project Title
            </label>
            <Input
              value={plan.title || ""}
              onChange={(event) => updateField("title", event.target.value)}
              placeholder="Untitled issue"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Project Area
            </label>
            <Input
              value={plan.house_location || ""}
              onChange={(event) =>
                updateField("house_location", event.target.value)
              }
              placeholder="Kitchen window, front porch, upstairs bathroom"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Issue Overview
            </label>
            <Textarea
              rows={4}
              value={plan.issue_summary || ""}
              onChange={(event) =>
                updateField("issue_summary", event.target.value)
              }
              placeholder="What seems wrong, what you have noticed, and what is worrying you."
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Priority
            </label>
            <select
              value={plan.priority || "medium"}
              onChange={(event) => updateField("priority", event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Planner Status
            </label>
            <select
              value={plan.status || "planning"}
              onChange={(event) => updateField("status", event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            >
              <option value="planning">Planning</option>
              <option value="ready_to_draft">Ready to draft</option>
              <option value="converted">Converted</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 md:col-span-2">
            <label className="mb-3 block text-sm font-medium text-slate-700">
              Budget Range
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                value={plan.budget_min ?? ""}
                onChange={(event) =>
                  updateField("budget_min", event.target.value)
                }
                inputMode="decimal"
                placeholder="Min"
              />
              <Input
                value={plan.budget_max ?? ""}
                onChange={(event) =>
                  updateField("budget_max", event.target.value)
                }
                inputMode="decimal"
                placeholder="Max"
              />
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Project Requirements
            </label>
            <Textarea
              rows={8}
              value={plan.notes || ""}
              onChange={(event) => updateField("notes", event.target.value)}
              placeholder="Required work, measurements, timing, materials, access details, concerns, and what you already know."
            />
          </div>
        </div>
      </Card>

      <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-semibold text-slate-950">
              Image Markup Canvas
            </div>
            <div className="mt-1 max-w-[400px] text-sm text-slate-500">
              Upload images, mark problem areas, add visual notes, and
              communicate project details more clearly before sharing the
              project.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <GhostButton
              type="button"
              onClick={() => navigate(`/dashboard/planner/${planId}/markup`)}
            >
              <SymbolIcon name="edit_note" className="mr-1 text-[18px]" />
              Open markup canvas
            </GhostButton>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">
              <SymbolIcon name="add_a_photo" className="text-[18px]" />
              {uploading ? "Uploading..." : "Upload images"}
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={uploadImages}
              />
            </label>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(plan.images || []).map((image) => (
            <div
              key={image.id}
              className="rounded-lg border border-slate-200 p-3"
            >
              <img
                src={image.image_url}
                alt=""
                className="h-44 w-full rounded-md object-cover"
              />
              <Input
                className="mt-3"
                value={image.caption || ""}
                placeholder="Caption"
                onChange={(event) =>
                  setPlan((prev) => ({
                    ...prev,
                    images: (prev.images || []).map((item) =>
                      item.id === image.id
                        ? { ...item, caption: event.target.value }
                        : item,
                    ),
                  }))
                }
                onBlur={(event) =>
                  updateImage(image.id, { caption: event.target.value })
                }
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <GhostButton
                  type="button"
                  onClick={() => updateImage(image.id, { is_cover: true })}
                >
                  {image.is_cover ? "Cover image" : "Make cover"}
                </GhostButton>
                <GhostButton
                  type="button"
                  onClick={() => removeImage(image.id)}
                >
                  Delete
                </GhostButton>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setResearchOpen((value) => !value)}
          className="flex w-full items-center justify-between gap-4 p-5 text-left"
        >
          <div>
            <div className="font-semibold text-slate-950">Research Links</div>
            <div className="mt-1 text-sm text-slate-500">
              Save product links, inspiration, manufacturer references, videos,
              products, or notes from research.
            </div>
          </div>
          <SymbolIcon
            name={researchOpen ? "expand_less" : "expand_more"}
            className="text-[22px] text-slate-500"
          />
        </button>
        {researchOpen ? (
          <div className="border-t border-slate-200 p-5">
            <div className="space-y-3">
              {(plan.links || []).map((item, index) => (
                <div
                  key={`link-${index}`}
                  className="grid gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-[1.4fr,1fr,1fr,auto]"
                >
                  <Input
                    value={item.url || ""}
                    onChange={(event) =>
                      updateLink(index, "url", event.target.value)
                    }
                    placeholder="https://..."
                  />
                  <Input
                    value={item.label || ""}
                    onChange={(event) =>
                      updateLink(index, "label", event.target.value)
                    }
                    placeholder="Label"
                  />
                  <Input
                    value={item.notes || ""}
                    onChange={(event) =>
                      updateLink(index, "notes", event.target.value)
                    }
                    placeholder="Notes"
                  />
                  <GhostButton type="button" onClick={() => removeLink(index)}>
                    Remove
                  </GhostButton>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <GhostButton type="button" onClick={addLink}>
                Add link
              </GhostButton>
            </div>
          </div>
        ) : null}
      </Card>

      <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-semibold text-slate-950">Contractor Type</div>
            <div className="text-sm text-slate-500">
              Choose the trades that seem most likely. You can edit them later.
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-nowrap gap-2 overflow-hidden">
          {contractorTypeOptions.map((item) => {
            const active = (plan.contractor_types || []).includes(item);
            return (
              <button
                key={item}
                type="button"
                onClick={() => toggleContractorType(item)}
                className={
                  "rounded-full border px-3 py-1 text-sm transition " +
                  (active
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:border-slate-900")
                }
              >
                {item}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex gap-2">
          <Input
            value={customContractor}
            onChange={(event) => setCustomContractor(event.target.value)}
            placeholder="Add another contractor type"
          />
          <GhostButton type="button" onClick={addCustomContractorType}>
            Add
          </GhostButton>
        </div>

        {aiAnalysis ? (
          <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-4">
            <div className="font-semibold text-sky-950">AI issue review</div>
            <div className="mt-2 text-sm text-slate-700">
              <div>
                <span className="font-medium">Possible issue:</span>{" "}
                {aiAnalysis.likely_issue_label || "—"}
              </div>
              <div className="mt-1">{aiAnalysis.explanation || ""}</div>
              {Array.isArray(aiAnalysis.contractor_types) &&
              aiAnalysis.contractor_types.length ? (
                <div className="mt-2">
                  <span className="font-medium">Likely contractor types:</span>{" "}
                  {aiAnalysis.contractor_types.join(", ")}
                </div>
              ) : null}
              {Array.isArray(aiAnalysis.next_steps) &&
              aiAnalysis.next_steps.length ? (
                <ul className="mt-2 list-disc pl-5">
                  {aiAnalysis.next_steps.map((item, index) => (
                    <li key={`step-${index}`}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="mt-3">
              <Button type="button" onClick={applyAnalysis}>
                Apply suggestions to this plan
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="font-semibold text-slate-950">
          Create Job Post Draft
        </div>
        <div className="mt-1 text-sm text-slate-500">
          Turn this private planner into a private editable job posting draft.
          You can review it before publishing anything publicly.
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={!canGenerateDraft(plan) || draftBusy}
            onClick={() => createDraft(false)}
          >
            {draftBusy ? "Working..." : "Turn into job post"}
          </Button>
          <GhostButton
            type="button"
            disabled={aiDisabled || !canGenerateDraft(plan) || draftBusy}
            onClick={() => createDraft(true)}
          >
            Generate draft with AI
          </GhostButton>
        </div>
        {!canGenerateDraft(plan) ? (
          <div className="mt-3 text-sm text-slate-500">
            Add a title or issue summary plus at least one note or image before
            generating the draft.
          </div>
        ) : null}
      </Card>
    </div>
  );
}
