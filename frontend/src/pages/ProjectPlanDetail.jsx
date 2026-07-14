import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../api";
import { Badge, Button, Card, GhostButton, Input, SymbolIcon, Textarea } from "../ui";

function emptyPlan(data = {}) {
  return {
    ...data,
    guided_answers_json: typeof data?.guided_answers_json === "object" && data?.guided_answers_json ? data.guided_answers_json : {},
    contractor_ready_summary_json:
      typeof data?.contractor_ready_summary_json === "object" && data?.contractor_ready_summary_json
        ? data.contractor_ready_summary_json
        : {},
    images: Array.isArray(data?.images) ? data.images : [],
    markup_data: typeof data?.markup_data === "object" && data?.markup_data ? data.markup_data : {},
  };
}

function normalizeError(err, fallback) {
  const data = err?.response?.data;
  return data?.detail || data?.message || (data ? JSON.stringify(data) : "") || err?.message || fallback;
}

function getAnswerLabel(answer) {
  if (Array.isArray(answer)) return answer.join(", ");
  return String(answer || "").trim();
}

function answerIsComplete(question, answer) {
  if (!question) return false;
  if (Array.isArray(answer)) return answer.length > 0;
  return String(answer || "").trim().length > 0;
}

function getMarkupVersions(markupData) {
  return Array.isArray(markupData?.versions) ? markupData.versions : [];
}

function projectTypeLabel(template) {
  return template?.label || "Project";
}

function photoSuggestionList(template, currentQuestion) {
  const suggestions = new Set(template?.photo_suggestions || []);
  const questionSuggestions = currentQuestion?.photo_prompt?.suggested_photos || [];
  const answerSuggestions = currentQuestion?.options || [];
  questionSuggestions.forEach((item) => suggestions.add(item));
  if (currentQuestion?.type === "photo_prompt" || currentQuestion?.id?.includes("photo_prompt")) {
    answerSuggestions.forEach((item) => suggestions.add(item));
  }
  return Array.from(suggestions).filter(Boolean);
}

function findMarkupForImage(image, versions) {
  if (!image) return null;
  return (versions || []).find((version) => {
    if (version.source_image_id && Number(version.source_image_id) === Number(image.id)) return true;
    return version.background_url && version.background_url === image.image_url;
  });
}

function finalDetailsComplete(plan) {
  return packetEssentialsComplete(plan);
}

function packetEssentialsComplete(plan) {
  return ["title", "house_location", "issue_summary"].every((field) => {
    const value = String(plan?.[field] ?? "").trim();
    if (field === "title") return value && value !== "Untitled issue";
    return Boolean(value);
  });
}

function packetReadinessLabel(plan, images, markupVersions) {
  if (!packetEssentialsComplete(plan)) return "Basic packet needed";
  if (!images.length) return "Better with photos";
  if (!String(plan?.site_access || "").trim()) return "Good enough to share";
  if (!markupVersions.length) return "Ready for contractor review";
  return "Detailed packet ready";
}

function guidedAnswerRows(template, answers) {
  return (template?.questions || []).map((question) => ({
    id: question.id,
    question: question.question,
    answer: getAnswerLabel((answers || {})[question.id]) || "Not answered",
  }));
}

function xmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function markupVersionSvg(version, planTitle) {
  const annotations = Array.isArray(version?.annotations) ? version.annotations : [];
  const shapes = annotations
    .map((item) => {
      const stroke = item.strokeColor || item.color || "#0f172a";
      const fill = item.fillColor ? `${item.fillColor}33` : "transparent";
      const dash = item.strokeStyle === "dashed" ? ' stroke-dasharray="10 8"' : "";
      if (item.type === "rect") {
        const x = Math.min(item.x || 0, item.x2 || 0);
        const y = Math.min(item.y || 0, item.y2 || 0);
        return `<rect x="${x}" y="${y}" width="${Math.abs((item.x2 || 0) - (item.x || 0))}" height="${Math.abs((item.y2 || 0) - (item.y || 0))}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="3"${dash}/>`;
      }
      if (item.type === "circle") {
        const cx = ((item.x || 0) + (item.x2 || 0)) / 2;
        const cy = ((item.y || 0) + (item.y2 || 0)) / 2;
        return `<ellipse cx="${cx}" cy="${cy}" rx="${Math.max(10, Math.abs((item.x2 || 0) - (item.x || 0)) / 2)}" ry="${Math.max(10, Math.abs((item.y2 || 0) - (item.y || 0)) / 2)}" fill="${fill}" stroke="${stroke}" stroke-width="3"${dash}/>`;
      }
      if (item.type === "arrow" || item.type === "measure") {
        return `<line x1="${item.x || 0}" y1="${item.y || 0}" x2="${item.x2 || 0}" y2="${item.y2 || 0}" stroke="${stroke}" stroke-width="4" stroke-linecap="round"${dash}/>`;
      }
      if (item.type === "freehand" && Array.isArray(item.points)) {
        const d = item.points.map((point, index) => `${index ? "L" : "M"} ${point.x || 0} ${point.y || 0}`).join(" ");
        return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"${dash}/>`;
      }
      if (item.type === "priority") {
        return `<circle cx="${item.x || 0}" cy="${item.y || 0}" r="26" fill="${fill}" stroke="${stroke}" stroke-width="3"/><text x="${item.x || 0}" y="${(item.y || 0) + 8}" text-anchor="middle" fill="${stroke}" font-size="24" font-weight="700">${xmlEscape(item.priorityNumber || 1)}</text>`;
      }
      return `<text x="${item.x || 0}" y="${item.y || 0}" fill="${stroke}" font-size="22" font-weight="500">${xmlEscape(item.text || "Note")}</text>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 760" width="1200" height="760"><title>${xmlEscape(version?.name || planTitle || "Project markup")}</title><rect width="1200" height="760" fill="#f8fafc"/><text x="32" y="44" fill="#334155" font-size="24" font-weight="700">${xmlEscape(version?.name || planTitle || "Project markup")}</text>${shapes}</svg>`;
}

function downloadBlob(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ProjectPlanDetail() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [postingBusy, setPostingBusy] = useState("");
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [inviteUsernames, setInviteUsernames] = useState("");
  const [finalDetailsFinished, setFinalDetailsFinished] = useState(false);
  const [projectPreviewOpen, setProjectPreviewOpen] = useState(false);
  const [guidedPanelOpen, setGuidedPanelOpen] = useState(false);

  async function loadPlan() {
    setLoading(true);
    setError("");
    try {
      const [{ data: planData }, { data: metaData }] = await Promise.all([
        api.get(`/project-plans/${planId}/`),
        api.get("/project-plans/meta/"),
      ]);
      const loadedPlan = emptyPlan(planData);
      setPlan(loadedPlan);
      setMeta(metaData || null);
      setFinalDetailsFinished(finalDetailsComplete(loadedPlan));
      setProjectPreviewOpen(false);
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

  const projectTypes = useMemo(() => meta?.project_type_choices || [], [meta]);
  const templates = useMemo(() => meta?.project_intake_templates || [], [meta]);
  const activeTemplate = useMemo(
    () => templates.find((item) => item.key === plan?.project_type) || null,
    [templates, plan?.project_type],
  );
  const questions = activeTemplate?.questions || [];
  const guidedIndex = Math.max(Number(plan?.guided_question_index || 0), 0);
  const isIntakeComplete = questions.length > 0 && guidedIndex >= questions.length;
  const currentQuestionIndex = isIntakeComplete
    ? questions.length - 1
    : Math.min(guidedIndex, Math.max(questions.length - 1, 0));
  const currentQuestion = isIntakeComplete ? null : questions[currentQuestionIndex] || null;
  const currentAnswer = currentQuestion ? plan?.guided_answers_json?.[currentQuestion.id] : "";
  const answeredCount = useMemo(
    () =>
      questions.reduce((count, question) => {
        return count + (answerIsComplete(question, plan?.guided_answers_json?.[question.id]) ? 1 : 0);
      }, 0),
    [questions, plan?.guided_answers_json],
  );
  const progressPercent = questions.length
    ? Math.round((((isIntakeComplete ? questions.length : currentQuestionIndex + 1)) / questions.length) * 100)
    : 0;
  const aiDisabled = Number(plan?.ai_remaining_today ?? 0) <= 0;
  const contractorReady = plan?.contractor_ready_summary_json || {};
  const markupVersions = getMarkupVersions(plan?.markup_data);
  const currentPhotoSuggestions = photoSuggestionList(activeTemplate, currentQuestion);
  const packetReady = packetEssentialsComplete(plan);
  const finalReady = finalDetailsFinished && packetReady;
  const showProjectPreview = finalReady && projectPreviewOpen;
  const guidedRows = guidedAnswerRows(activeTemplate, plan?.guided_answers_json);
  const packetStatus = packetReadinessLabel(plan, plan?.images || [], markupVersions);
  const packetChecklist = [
    {
      label: "Project type",
      complete: !!plan?.project_type,
      helper: plan?.project_type ? projectTypeLabel(activeTemplate) : "Choose the closest category.",
    },
    {
      label: "Basic details",
      complete: packetReady,
      helper: packetReady ? "Title, work area, and summary are filled." : "Add title, work area, and summary.",
    },
    {
      label: "Photos",
      complete: (plan?.images || []).length > 0,
      helper: `${(plan?.images || []).length} uploaded`,
    },
    {
      label: "Access notes",
      complete: !!String(plan?.site_access || "").trim(),
      helper: plan?.site_access || "Optional, but helpful for contractors.",
    },
    {
      label: "Guided intake",
      complete: isIntakeComplete,
      helper: questions.length ? `${answeredCount}/${questions.length} answered` : "Optional improvement step.",
    },
  ];

  async function patchPlan(patch, successMessage = "Saved.") {
    setSaving(true);
    setStatusMessage("");
    try {
      const { data } = await api.patch(`/project-plans/${planId}/`, patch);
      setPlan(emptyPlan(data));
      setStatusMessage(successMessage);
      return data;
    } catch (err) {
      const message = normalizeError(err, "Could not save this project plan.");
      setError(message);
      throw err;
    } finally {
      setSaving(false);
    }
  }

  function updateLocalField(field, value) {
    setPlan((prev) => emptyPlan({ ...prev, [field]: value }));
    if (["title", "house_location", "issue_summary", "site_access", "notes"].includes(field)) {
      setFinalDetailsFinished(false);
      setProjectPreviewOpen(false);
    }
  }

  function updateGuidedAnswer(value) {
    if (!currentQuestion) return;
    setPlan((prev) =>
      emptyPlan({
        ...prev,
        guided_answers_json: {
          ...(prev?.guided_answers_json || {}),
          [currentQuestion.id]: value,
        },
      }),
    );
  }

  async function selectProjectType(projectType) {
    setError("");
    await patchPlan(
      {
        project_type: projectType,
        guided_answers_json: {},
        guided_question_index: 0,
        contractor_ready_summary_json: {},
        contractor_ready_status: "not_ready",
      },
      "Project type saved.",
    );
  }

  async function goToQuestion(nextIndex) {
    if (!activeTemplate || !currentQuestion) return;
    const next = Math.min(Math.max(nextIndex, 0), questions.length - 1);
    const patch = {
      guided_answers_json: plan.guided_answers_json || {},
      guided_question_index: next,
    };
    if (currentQuestion?.maps_to_field === "site_access") {
      patch.site_access = getAnswerLabel(currentAnswer);
    }
    await patchPlan(patch, "Progress saved.");
  }

  async function saveAndNext() {
    if (!currentQuestion) return;
    if (currentQuestion.required && !answerIsComplete(currentQuestion, currentAnswer)) {
      setError("Answer this question before continuing.");
      return;
    }
    setError("");
    if (currentQuestionIndex >= questions.length - 1) {
      await patchPlan(
        {
          guided_answers_json: plan.guided_answers_json || {},
          guided_question_index: questions.length,
          site_access:
            currentQuestion.maps_to_field === "site_access" ? getAnswerLabel(currentAnswer) : plan.site_access || "",
        },
        "Intake questions saved.",
      );
      return;
    }
    await goToQuestion(currentQuestionIndex + 1);
  }

  async function skipQuestion() {
    if (!currentQuestion?.allow_skip) return;
    setError("");
    if (currentQuestionIndex >= questions.length - 1) {
      await patchPlan({ guided_question_index: questions.length }, "Skipped.");
      return;
    }
    await goToQuestion(currentQuestionIndex + 1);
  }

  async function saveManualField(field) {
    if (!plan) return;
    setError("");
    await patchPlan({ [field]: plan[field] }, "Saved.");
  }

  async function savePacketEssentials({ openPreview = false } = {}) {
    if (!plan) return;
    setError("");
    const patch = {
      title: plan.title || "",
      house_location: plan.house_location || "",
      issue_summary: plan.issue_summary || "",
      site_access: plan.site_access || "",
      notes: plan.notes || "",
    };
    const updatedPlan = emptyPlan(await patchPlan(patch, "Project packet saved."));
    const complete = finalDetailsComplete(updatedPlan);
    setFinalDetailsFinished(complete);
    if (openPreview && complete) {
      setProjectPreviewOpen(true);
    } else if (!complete) {
      setProjectPreviewOpen(false);
    }
  }

  function openMarkupForImage(image) {
    const params = new URLSearchParams();
    if (image?.id) params.set("image", String(image.id));
    navigate(`/dashboard/planner/${planId}/markup${params.toString() ? `?${params.toString()}` : ""}`);
  }

  function openSketchPlanBuilder() {
    navigate(`/dashboard/planner/${planId}/markup?mode=rough_plan&sketch=1`);
  }

  function downloadMarkupSvg(version) {
    downloadBlob(
      markupVersionSvg(version, plan.title),
      `${String(version?.name || plan.title || "project-markup").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.svg`,
      "image/svg+xml;charset=utf-8",
    );
  }

  async function downloadMarkupPng(version) {
    if (!version?.snapshot_url) return;
    const response = await fetch(version.snapshot_url, { credentials: "include" });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${String(version?.name || plan.title || "project-markup").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function uploadImages(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setUploading(true);
    setStatusMessage("");
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("images", file));
      files.forEach(() => formData.append("captions", ""));
      await api.post(`/project-plans/${planId}/images/`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await loadPlan();
      setStatusMessage("Photos uploaded.");
    } catch (err) {
      setError(normalizeError(err, "Could not upload images."));
    } finally {
      event.target.value = "";
      setUploading(false);
    }
  }

  async function removeImage(imageId) {
    if (!window.confirm("Delete this image?")) return;
    try {
      await api.delete(`/project-plans/${planId}/images/${imageId}/`);
      await loadPlan();
    } catch (err) {
      setError(normalizeError(err, "Could not delete this image."));
    }
  }

  async function deleteMarkupVersion(versionId) {
    if (!window.confirm("Delete this saved markup version?")) return;
    const versions = markupVersions.filter((version) => version.id !== versionId);
    const nextMarkup = { ...(plan?.markup_data || {}), versions };
    try {
      await patchPlan({ markup_data: nextMarkup }, "Markup version deleted.");
    } catch {
      return;
    }
  }

  async function generateContractorReadyProject() {
    setAiBusy(true);
    setError("");
    setStatusMessage("");
    try {
      const { data } = await api.post(`/project-plans/${planId}/ai/`, {
        action: "generate_contractor_ready_project",
      });
      setPlan((prev) =>
        emptyPlan({
          ...prev,
          contractor_ready_summary_json: data.contractor_ready_project || {},
          contractor_ready_status: data.contractor_ready_project?.contractor_ready_status || prev?.contractor_ready_status,
          ai_remaining_today: data.remaining_today,
          ai_daily_limit: data.daily_limit,
        }),
      );
      await loadPlan();
      setStatusMessage("Contractor-ready summary generated.");
    } catch (err) {
      setError(
        `${normalizeError(err, "AI project generation is unavailable right now.")} You can still create the project manually from the details you entered.`,
      );
    } finally {
      setAiBusy(false);
    }
  }

  async function createDraft(postingMode) {
    setPostingBusy(postingMode);
    setError("");
    try {
      const payload = { posting_mode: postingMode };
      if (postingMode === "invite_only") {
        payload.private_contractor_usernames = inviteUsernames
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
      }
      const { data } = await api.post(`/project-plans/${planId}/convert-to-draft/`, payload);
      navigate(`/projects/${data.draft_id}`);
    } catch (err) {
      setError(normalizeError(err, "Could not create a project draft from this intake."));
    } finally {
      setPostingBusy("");
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-slate-500">Loading plan...</div>;
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
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link to="/dashboard" className="text-sm text-slate-500 hover:text-slate-900">
            Dashboard
          </Link>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            {plan.title || "Untitled issue"}
          </h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge>{projectTypeLabel(activeTemplate)}</Badge>
            <Badge>Project Readiness: {plan.project_readiness_score ?? 0}% Complete</Badge>
            <Badge>{plan.ai_remaining_today} AI generations left today</Badge>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          Build a shareable project packet first. Add guided answers, photos, and markups when they make the packet stronger.
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}
      {statusMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {statusMessage}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-lg font-semibold text-slate-950">Project Packet Builder</div>
              <div className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                Start with the essentials contractors need to understand the job. Add photos and optional intake details when you want a stronger packet.
              </div>
            </div>
            <Badge
              className={
                "h-8 shrink-0 whitespace-nowrap rounded-full px-3 text-xs font-semibold " +
                (packetReady
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-amber-200 bg-amber-50 text-amber-900")
              }
            >
              {packetStatus}
            </Badge>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {packetChecklist.map((item) => (
              <div
                key={item.label}
                className={
                  "min-h-[92px] rounded-xl border px-4 py-3 text-sm " +
                  (item.complete
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-slate-200 bg-slate-50 text-slate-700")
                }
              >
                <div className="flex items-start gap-2 font-semibold">
                  <SymbolIcon
                    name={item.complete ? "check_circle" : "radio_button_unchecked"}
                    className={"mt-0.5 shrink-0 text-[18px] " + (item.complete ? "text-emerald-600" : "text-slate-400")}
                  />
                  <span className="min-w-0 leading-5">{item.label}</span>
                </div>
                <div className="mt-2 text-xs leading-5 opacity-80">{item.helper}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Project type
              </span>
              <select
                value={plan.project_type || ""}
                onChange={(event) => selectProjectType(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose a type</option>
                {projectTypes.map((type) => (
                  <option key={type.key} value={type.key}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Project name
              </span>
              <Input
                value={plan.title === "Untitled issue" ? "" : plan.title || ""}
                onChange={(event) => updateLocalField("title", event.target.value)}
                onBlur={() => saveManualField("title")}
                placeholder="Deck railing repair"
              />
            </label>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Work area
              </span>
              <Input
                value={plan.house_location || ""}
                onChange={(event) => updateLocalField("house_location", event.target.value)}
                onBlur={() => saveManualField("house_location")}
                placeholder="Back deck, upstairs bathroom, front entry"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Access notes
              </span>
              <Input
                value={plan.site_access || ""}
                onChange={(event) => updateLocalField("site_access", event.target.value)}
                onBlur={() => saveManualField("site_access")}
                placeholder="Driveway access through side gate"
              />
            </label>
          </div>

          <label className="mt-4 block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              What needs to happen?
            </span>
            <Textarea
              rows={5}
              value={plan.issue_summary || ""}
              onChange={(event) => updateLocalField("issue_summary", event.target.value)}
              onBlur={() => saveManualField("issue_summary")}
              placeholder="Describe the issue, what you want fixed or built, and any concerns a contractor should know."
            />
          </label>

          <label className="mt-4 block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Extra notes
            </span>
            <Textarea
              rows={3}
              value={plan.notes || ""}
              onChange={(event) => updateLocalField("notes", event.target.value)}
              onBlur={() => saveManualField("notes")}
              placeholder="Timing, preferences, materials, questions, or constraints."
            />
          </label>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button type="button" onClick={() => savePacketEssentials({ openPreview: true })} disabled={saving || !packetReady}>
              Review Packet
            </Button>
            <GhostButton type="button" onClick={() => savePacketEssentials()} disabled={saving}>
              {saving ? "Saving..." : "Save Packet"}
            </GhostButton>
            {plan.project_type ? (
              <GhostButton type="button" onClick={() => setGuidedPanelOpen((open) => !open)}>
                {guidedPanelOpen ? "Hide Guided Intake" : "Improve Packet"}
              </GhostButton>
            ) : null}
          </div>

          {!packetReady ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Add a project name, work area, and short summary before reviewing or sharing the packet.
            </div>
          ) : null}
        </Card>

        <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-slate-950">Live Packet Preview</div>
              <div className="mt-1 text-sm text-slate-500">This is the contractor-facing summary you are building.</div>
            </div>
            <Badge>{packetStatus}</Badge>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              {projectTypeLabel(activeTemplate)}
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">
              {plan.title && plan.title !== "Untitled issue" ? plan.title : "Untitled project"}
            </h2>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Work area</div>
                <div className="mt-1 text-slate-800">{plan.house_location || "Not specified"}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Access</div>
                <div className="mt-1 text-slate-800">{plan.site_access || "Not specified"}</div>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Summary</div>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-800">
                {plan.issue_summary || "Add a short description of the work needed."}
              </p>
            </div>
            {plan.notes ? (
              <div className="mt-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Notes</div>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{plan.notes}</p>
              </div>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
              <div className="text-lg font-semibold text-slate-950">{plan.images.length}</div>
              <div className="text-xs text-slate-500">Photos</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
              <div className="text-lg font-semibold text-slate-950">{markupVersions.length}</div>
              <div className="text-xs text-slate-500">Markups</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
              <div className="text-lg font-semibold text-slate-950">{answeredCount}</div>
              <div className="text-xs text-slate-500">Answers</div>
            </div>
          </div>

          {plan.images.length ? (
            <div className="mt-4 grid grid-cols-3 gap-2">
              {plan.images.slice(0, 3).map((image) => (
                <img key={image.id} src={image.image_url} alt="" className="h-20 w-full rounded-xl object-cover" />
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
              Add overview and close-up photos to make this easier to estimate.
            </div>
          )}
        </Card>
      </div>

      {plan.project_type && currentQuestion && guidedPanelOpen ? (
        <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-slate-950">Guided Project Intake</div>
              <div className="mt-1 text-sm text-slate-500">
                Question {Math.min(currentQuestionIndex + 1, questions.length)} of {questions.length}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPlan((prev) => emptyPlan({ ...prev, project_type: "" }))}
              className="text-sm text-slate-500 hover:text-slate-900"
            >
              Change type
            </button>
          </div>

          <div className="mt-5">
            <div className="mb-3 flex items-center justify-between text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
              <span>{projectTypeLabel(activeTemplate)}</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-slate-900 transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
            <div className="text-xl font-semibold text-slate-950">{currentQuestion.question}</div>
            {currentQuestion.help_text ? (
              <div className="mt-2 text-sm leading-6 text-slate-600">{currentQuestion.help_text}</div>
            ) : null}

            <div className="mt-5">
              {currentQuestion.type === "single_choice" || currentQuestion.type === "yes_no" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {(currentQuestion.options || []).map((option) => {
                    const active = currentAnswer === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => updateGuidedAnswer(option)}
                        className={
                          "rounded-2xl border px-4 py-4 text-left transition " +
                          (active
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-400")
                        }
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {currentQuestion.type === "multi_choice" || currentQuestion.type === "photo_prompt" ? (
                <div className="space-y-3">
                  {(currentQuestion.options || []).map((option) => {
                    const selected = Array.isArray(currentAnswer) ? currentAnswer.includes(option) : false;
                    return (
                      <label
                        key={option}
                        className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(event) => {
                            const next = new Set(Array.isArray(currentAnswer) ? currentAnswer : []);
                            if (event.target.checked) next.add(option);
                            else next.delete(option);
                            updateGuidedAnswer(Array.from(next));
                          }}
                        />
                        <span>{option}</span>
                      </label>
                    );
                  })}
                </div>
              ) : null}

              {currentQuestion.type === "short_text" ? (
                <Textarea
                  rows={4}
                  value={String(currentAnswer || "")}
                  onChange={(event) => updateGuidedAnswer(event.target.value)}
                  placeholder="Write a short answer"
                />
              ) : null}

              {currentQuestion.type === "number" ? (
                <Input
                  value={String(currentAnswer || "")}
                  inputMode="numeric"
                  onChange={(event) => updateGuidedAnswer(event.target.value)}
                  placeholder="Enter a number"
                />
              ) : null}
            </div>

            {currentPhotoSuggestions.length ? (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-4">
                <div className="text-sm font-semibold text-slate-900">Helpful photos for this step</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {currentPhotoSuggestions.map((item) => (
                    <Badge key={item}>{item}</Badge>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <GhostButton type="button" onClick={() => goToQuestion(currentQuestionIndex - 1)} disabled={saving || currentQuestionIndex === 0}>
                Back
              </GhostButton>
              {currentQuestion.allow_skip ? (
                <GhostButton type="button" onClick={skipQuestion} disabled={saving}>
                  Skip
                </GhostButton>
              ) : null}
              <Button type="button" onClick={saveAndNext} disabled={saving}>
                {saving ? "Saving..." : currentQuestionIndex >= questions.length - 1 ? "Finish intake" : "Next"}
              </Button>
            </div>
          </div>

          <div className="mt-4 text-sm text-slate-500">
            {answeredCount}/{questions.length} intake questions answered
          </div>
        </Card>
      ) : null}

      {plan.project_type && currentQuestion && !guidedPanelOpen ? (
        <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-lg font-semibold text-slate-950">Improve Packet With Guided Intake</div>
              <div className="mt-1 text-sm text-slate-500">
                Optional questions can help contractors understand size, materials, permits, access, and missing details.
              </div>
            </div>
            <Button type="button" onClick={() => setGuidedPanelOpen(true)}>
              Continue Intake
            </Button>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-slate-900 transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="mt-2 text-sm text-slate-500">
            {answeredCount}/{questions.length} optional intake questions answered
          </div>
        </Card>
      ) : null}

      <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-lg font-semibold text-slate-950">Project Photos & Markup</div>
            <div className="mt-1 text-sm text-slate-500">
              Upload photos, then mark up each image from its tile.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <GhostButton type="button" onClick={openSketchPlanBuilder} className="h-10 px-4">
              <SymbolIcon name="architecture" className="text-[18px]" />
              Create Plan from Sketch
            </GhostButton>
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white">
              <input type="file" accept="image/*" multiple className="hidden" onChange={uploadImages} />
              <SymbolIcon name="upload" className="text-[18px]" />
              {uploading ? "Uploading..." : "Upload photos"}
            </label>
          </div>
        </div>

        {activeTemplate?.photo_suggestions?.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {activeTemplate.photo_suggestions.map((item) => (
              <Badge key={item}>{item}</Badge>
            ))}
          </div>
        ) : null}

        {plan.images.length ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {plan.images.map((image) => {
              const markedVersion = findMarkupForImage(image, markupVersions);
              return (
                <div key={image.id} className="rounded-2xl border border-slate-200 p-3">
                  <button type="button" onClick={() => openMarkupForImage(image)} className="block w-full overflow-hidden rounded-xl bg-slate-100 text-left">
                    <img src={image.image_url} alt="" className="h-44 w-full object-cover" />
                  </button>
                  <div className="mt-3 flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-medium text-slate-700">{image.caption || "Project photo"}</div>
                      {markedVersion ? (
                        <div className="mt-1 text-xs text-emerald-700">
                          {markedVersion.annotation_count ?? 0} markups saved
                        </div>
                      ) : (
                        <div className="mt-1 text-xs text-slate-500">No markup yet</div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeImage(image.id)}
                      className="text-xs font-medium text-rose-700 hover:text-rose-800"
                    >
                      Delete
                    </button>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button type="button" onClick={() => openMarkupForImage(image)} className="h-9 px-3 text-xs">
                      {markedVersion ? "Edit markup" : "Add markup"}
                    </Button>
                    {markedVersion?.snapshot_url ? (
                      <GhostButton type="button" onClick={() => openMarkupForImage(image)} className="h-9 px-3 text-xs">
                        View
                      </GhostButton>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
            No project photos yet. Add overview shots, close-ups, and access photos.
          </div>
        )}

        {markupVersions.length ? (
          <div className="mt-6">
            <div className="text-sm font-semibold text-slate-900">Saved markup versions</div>
            <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
              {markupVersions.map((version) => {
                const previewUrl = version.snapshot_url || version.background_url || "";
                return (
                  <div key={version.id} className="min-w-[220px] rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                    {previewUrl ? (
                      <img src={previewUrl} alt="" className="h-28 w-full rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-28 items-center justify-center rounded-xl bg-white text-xs text-slate-400">
                        No snapshot preview
                      </div>
                    )}
                    <div className="mt-3 font-semibold text-slate-900">{version.name || "Saved markup"}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {version.annotation_count ?? 0} markups
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteMarkupVersion(version.id)}
                      className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-lg border border-rose-200 bg-white text-xs font-medium text-rose-700 hover:bg-rose-50"
                    >
                      Delete version
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </Card>

      {showProjectPreview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <div className="text-lg font-semibold text-slate-950">Project Preview</div>
                <div className="mt-1 text-sm text-slate-500">
                  Review how this project will read before generating the contractor-ready draft.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProjectPreviewOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                aria-label="Close preview"
              >
                <SymbolIcon name="close" className="text-[20px]" />
              </button>
            </div>

            <div className="max-h-[calc(90vh-76px)] overflow-y-auto px-5 py-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {projectTypeLabel(activeTemplate)}
                </div>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">{plan.title || "Untitled issue"}</h2>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Work area</div>
                    <div className="mt-1 text-sm text-slate-800">{plan.house_location || "Not specified"}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Access</div>
                    <div className="mt-1 text-sm text-slate-800">{plan.site_access || "Not specified"}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Photos</div>
                    <div className="mt-1 text-sm text-slate-800">
                      {plan.images.length} uploaded, {markupVersions.length} markup versions saved
                    </div>
                  </div>
                </div>
                <div className="mt-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Summary</div>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-800">
                    {plan.issue_summary || "No summary yet."}
                  </p>
                </div>
                {plan.notes ? (
                  <div className="mt-5">
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Additional details</div>
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{plan.notes}</p>
                  </div>
                ) : null}
              </div>

              {guidedRows.length ? (
                <div className="mt-5">
                  <div className="text-sm font-semibold text-slate-900">Guided intake answers</div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {guidedRows.map((row, index) => (
                      <div key={row.id || index} className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                          Question {index + 1}
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">{row.question}</div>
                        <div className="mt-2 text-sm leading-6 text-slate-700">{row.answer}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {markupVersions.length ? (
                <div className="mt-5">
                  <div className="text-sm font-semibold text-slate-900">Markup files</div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {markupVersions.map((version) => (
                      <div key={version.id} className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="font-semibold text-slate-900">{version.name || "Saved markup"}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {version.annotation_count ?? 0} markups
                          {version.created_at ? ` · ${new Date(version.created_at).toLocaleString()}` : ""}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <GhostButton type="button" onClick={() => downloadMarkupSvg(version)} className="h-9 px-3 text-xs">
                            SVG
                          </GhostButton>
                          <GhostButton
                            type="button"
                            onClick={() => downloadMarkupPng(version)}
                            disabled={!version.snapshot_url}
                            className="h-9 px-3 text-xs"
                          >
                            PNG
                          </GhostButton>
                          <GhostButton type="button" onClick={() => navigate(`/dashboard/planner/${planId}/markup`)} className="h-9 px-3 text-xs">
                            Open markup
                          </GhostButton>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {finalReady ? (
      <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-lg font-semibold text-slate-950">Generate Contractor-Ready Project</div>
            <div className="mt-1 text-sm text-slate-500">
              AI can connect the dots from your packet, photos, notes, and optional guided answers. If AI is not available, you can still create the project from the details you entered.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={generateContractorReadyProject} disabled={aiBusy || aiDisabled}>
              {aiBusy ? "Organizing..." : "Use AI to Organize"}
            </Button>
            <GhostButton type="button" onClick={() => createDraft("draft")} disabled={postingBusy !== ""}>
              {postingBusy === "draft" ? "Creating..." : "Create Manual Draft"}
            </GhostButton>
          </div>
        </div>

        {aiDisabled ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            AI is not available for this planner right now. Use Create Manual Draft to build the project from your saved packet details.
          </div>
        ) : null}

        {!contractorReady.summary ? (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">Manual project details are ready</div>
            <div className="mt-1 text-sm leading-6 text-slate-600">
              The manual draft will use the project name, work area, summary, access notes, extra notes, photos, and any optional intake answers you have saved.
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button type="button" onClick={() => createDraft("local_public")} disabled={postingBusy !== ""}>
                {postingBusy === "local_public" ? "Creating..." : "Post to Local Projects"}
              </Button>
              <GhostButton type="button" onClick={() => createDraft("draft")} disabled={postingBusy !== ""}>
                {postingBusy === "draft" ? "Creating..." : "Save as Private Draft"}
              </GhostButton>
            </div>
          </div>
        ) : null}

        {contractorReady.summary ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Readiness summary</div>
              <div className="mt-2 text-sm leading-6 text-slate-700">{contractorReady.summary}</div>
              <div className="mt-3">
                <Badge className="capitalize">
                  {String(plan.contractor_ready_status || contractorReady.contractor_ready_status || "not_ready").replaceAll("_", " ")}
                </Badge>
              </div>
            </div>

            {Array.isArray(contractorReady.known_details) && contractorReady.known_details.length ? (
              <section>
                <div className="text-sm font-semibold text-slate-900">Known details</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {contractorReady.known_details.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {Array.isArray(contractorReady.missing_information) && contractorReady.missing_information.length ? (
              <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                <div className="text-sm font-semibold text-amber-900">Missing information</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
                  {contractorReady.missing_information.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {Array.isArray(contractorReady.recommended_next_steps) && contractorReady.recommended_next_steps.length ? (
              <section>
                <div className="text-sm font-semibold text-slate-900">Project checklist</div>
                <div className="mt-2 space-y-2">
                  {contractorReady.recommended_next_steps.map((item) => (
                    <label key={item} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                      <input type="checkbox" />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </section>
            ) : null}

            {Array.isArray(contractorReady.contractor_questions) && contractorReady.contractor_questions.length ? (
              <section>
                <div className="text-sm font-semibold text-slate-900">Contractor questions preview</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {contractorReady.contractor_questions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">Next step</div>
              <div className="mt-1 text-sm text-slate-500">
                Turn this packet into a real project draft. You can post it locally or keep it invite-only for specific contractors.
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button type="button" onClick={() => createDraft("local_public")} disabled={postingBusy !== ""}>
                  {postingBusy === "local_public" ? "Creating..." : "Post to Local Projects"}
                </Button>
                <GhostButton type="button" onClick={() => createDraft("draft")} disabled={postingBusy !== ""}>
                  {postingBusy === "draft" ? "Creating..." : "Save as Private Draft"}
                </GhostButton>
              </div>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">Invite Specific Contractors</div>
                <div className="mt-1 text-sm text-slate-500">
                  Enter contractor usernames separated by commas. This creates a private draft with those invites attached.
                </div>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                  <Input value={inviteUsernames} onChange={(event) => setInviteUsernames(event.target.value)} placeholder="contractor1, contractor2" />
                  <Button type="button" onClick={() => createDraft("invite_only")} disabled={postingBusy !== ""}>
                    {postingBusy === "invite_only" ? "Creating..." : "Invite Specific Contractors"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </Card>
      ) : null}
    </div>
  );
}
