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

const FINAL_DETAIL_QUESTIONS = [
  {
    field: "title",
    label: "Name this project",
    help: "Use a short name that a contractor can recognize quickly.",
    type: "input",
    required: true,
    placeholder: "Deck railing repair",
  },
  {
    field: "house_location",
    label: "Where is the work area?",
    help: "Name the room, exterior area, floor, or part of the property.",
    type: "input",
    required: true,
    placeholder: "Back deck, second-floor bathroom, front entry",
  },
  {
    field: "issue_summary",
    label: "Summarize what needs to happen",
    help: "Write the plain-language scope you want contractors to understand first.",
    type: "textarea",
    required: true,
    placeholder: "The railing is loose and a few boards need replacement before the deck can be used safely.",
  },
  {
    field: "site_access",
    label: "How should contractors access the area?",
    help: "Mention gates, stairs, parking, tight paths, upper floors, or material delivery constraints.",
    type: "input",
    required: false,
    placeholder: "Easy access from driveway through side gate",
  },
  {
    field: "notes",
    label: "Add any final details",
    help: "Include timing, concerns, preferred materials, or anything the guided intake missed.",
    type: "textarea",
    required: false,
    placeholder: "Prefer composite boards if the frame is usable. Flexible timing over the next month.",
  },
];

function findMarkupForImage(image, versions) {
  if (!image) return null;
  return (versions || []).find((version) => {
    if (version.source_image_id && Number(version.source_image_id) === Number(image.id)) return true;
    return version.background_url && version.background_url === image.image_url;
  });
}

function finalDetailsComplete(plan) {
  if (!plan) return false;
  return FINAL_DETAIL_QUESTIONS.every((question) => {
    if (!question.required) return true;
    const value = String(plan?.[question.field] ?? "").trim();
    if (question.field === "title") return value && value !== "Untitled issue";
    return Boolean(value);
  });
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
  const [finalQuestionIndex, setFinalQuestionIndex] = useState(0);

  async function loadPlan() {
    setLoading(true);
    setError("");
    try {
      const [{ data: planData }, { data: metaData }] = await Promise.all([
        api.get(`/project-plans/${planId}/`),
        api.get("/project-plans/meta/"),
      ]);
      setPlan(emptyPlan(planData));
      setMeta(metaData || null);
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
  const finalQuestion = FINAL_DETAIL_QUESTIONS[finalQuestionIndex] || FINAL_DETAIL_QUESTIONS[0];
  const finalReady = finalDetailsComplete(plan);

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
        site_access: "",
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

  async function saveFinalDetailAndMove(nextIndex) {
    if (!finalQuestion) return;
    const value = String(plan?.[finalQuestion.field] ?? "").trim();
    if (finalQuestion.required && (!value || (finalQuestion.field === "title" && value === "Untitled issue"))) {
      setError("Answer this question before continuing.");
      return;
    }
    setError("");
    await patchPlan({ [finalQuestion.field]: plan[finalQuestion.field] }, "Project detail saved.");
    setFinalQuestionIndex(Math.min(Math.max(nextIndex, 0), FINAL_DETAIL_QUESTIONS.length - 1));
  }

  function openMarkupForImage(image) {
    const params = new URLSearchParams();
    if (image?.id) params.set("image", String(image.id));
    navigate(`/dashboard/planner/${planId}/markup${params.toString() ? `?${params.toString()}` : ""}`);
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
      setError(normalizeError(err, "AI project generation is unavailable right now."));
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
          Move through the intake, add photos and markups, answer final project details, then generate a contractor-ready draft.
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

      {!plan.project_type ? (
        <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-lg font-semibold text-slate-950">Choose a project type</div>
          <div className="mt-1 text-sm text-slate-500">
            Start with the closest project type. You can still describe the specifics in your own words below.
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {projectTypes.map((type) => (
              <button
                key={type.key}
                type="button"
                onClick={() => selectProjectType(type.key)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-slate-400 hover:bg-white"
              >
                <div className="font-semibold text-slate-900">{type.label}</div>
                <div className="mt-1 text-sm text-slate-500">Use guided intake questions for this project.</div>
              </button>
            ))}
          </div>
        </Card>
      ) : null}

      {plan.project_type && currentQuestion ? (
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

      <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-lg font-semibold text-slate-950">Project Photos & Markup</div>
            <div className="mt-1 text-sm text-slate-500">
              Upload photos, then mark up each image from its tile.
            </div>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            <input type="file" accept="image/*" multiple className="hidden" onChange={uploadImages} />
            <SymbolIcon name="upload" className="text-[18px]" />
            {uploading ? "Uploading..." : "Upload photos"}
          </label>
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

      {isIntakeComplete ? (
        <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-slate-950">Final Project Details</div>
              <div className="mt-1 text-sm text-slate-500">
                Question {finalQuestionIndex + 1} of {FINAL_DETAIL_QUESTIONS.length}
              </div>
            </div>
            {finalReady ? <Badge>Ready to generate</Badge> : null}
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
            <label className="block text-xl font-semibold text-slate-950">{finalQuestion.label}</label>
            <div className="mt-2 text-sm leading-6 text-slate-600">{finalQuestion.help}</div>
            <div className="mt-5">
              {finalQuestion.type === "textarea" ? (
                <Textarea
                  rows={5}
                  value={plan[finalQuestion.field] || ""}
                  onChange={(event) => updateLocalField(finalQuestion.field, event.target.value)}
                  onBlur={() => saveManualField(finalQuestion.field)}
                  placeholder={finalQuestion.placeholder}
                />
              ) : (
                <Input
                  value={plan[finalQuestion.field] || ""}
                  onChange={(event) => updateLocalField(finalQuestion.field, event.target.value)}
                  onBlur={() => saveManualField(finalQuestion.field)}
                  placeholder={finalQuestion.placeholder}
                />
              )}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <GhostButton
                type="button"
                onClick={() => setFinalQuestionIndex((index) => Math.max(index - 1, 0))}
                disabled={saving || finalQuestionIndex === 0}
              >
                Back
              </GhostButton>
              <Button
                type="button"
                onClick={() => saveFinalDetailAndMove(finalQuestionIndex + 1)}
                disabled={saving}
              >
                {saving ? "Saving..." : finalQuestionIndex >= FINAL_DETAIL_QUESTIONS.length - 1 ? "Finish details" : "Next"}
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {isIntakeComplete && finalReady ? (
      <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-lg font-semibold text-slate-950">Generate Contractor-Ready Project</div>
            <div className="mt-1 text-sm text-slate-500">
              Use AI once you have enough intake answers, photos, and markup to turn this into a contractor-facing draft.
            </div>
          </div>
          <Button type="button" onClick={generateContractorReadyProject} disabled={aiBusy || aiDisabled}>
            {aiBusy ? "Generating..." : "Generate Contractor-Ready Project"}
          </Button>
        </div>

        {aiDisabled ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            You have used your free AI project guides for today. You can still edit your planner manually.
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
                Turn this intake into a real project draft. You can post it locally or keep it invite-only for specific contractors.
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
