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
          Move through the intake one step at a time, upload photos, mark them up, and then generate a contractor-ready draft.
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
              Upload photos, then open the markup canvas to point out repair areas, additions, access constraints, or unclear details.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">
              <input type="file" accept="image/*" multiple className="hidden" onChange={uploadImages} />
              <SymbolIcon name="upload" className="text-[18px]" />
              {uploading ? "Uploading..." : "Upload photos"}
            </label>
            <GhostButton type="button" onClick={() => navigate(`/dashboard/planner/${planId}/markup`)}>
              Open markup canvas
            </GhostButton>
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
            {plan.images.map((image) => (
              <div key={image.id} className="rounded-2xl border border-slate-200 p-3">
                <img src={image.image_url} alt="" className="h-44 w-full rounded-xl object-cover" />
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="text-xs text-slate-500">{image.caption || "Project photo"}</div>
                  <button
                    type="button"
                    onClick={() => removeImage(image.id)}
                    className="text-xs font-medium text-rose-700 hover:text-rose-800"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
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

      <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-lg font-semibold text-slate-950">Manual project details</div>
        <div className="mt-1 text-sm text-slate-500">
          Manual editing remains available at all times. Use this to clarify anything the guided intake misses.
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Project title</label>
            <Input value={plan.title || ""} onChange={(event) => updateLocalField("title", event.target.value)} onBlur={() => saveManualField("title")} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Affected area</label>
            <Input value={plan.house_location || ""} onChange={(event) => updateLocalField("house_location", event.target.value)} onBlur={() => saveManualField("house_location")} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Site access</label>
            <Input value={plan.site_access || ""} onChange={(event) => updateLocalField("site_access", event.target.value)} onBlur={() => saveManualField("site_access")} />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Issue summary</label>
            <Textarea rows={4} value={plan.issue_summary || ""} onChange={(event) => updateLocalField("issue_summary", event.target.value)} onBlur={() => saveManualField("issue_summary")} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Budget min</label>
            <Input value={plan.budget_min ?? ""} inputMode="decimal" onChange={(event) => updateLocalField("budget_min", event.target.value)} onBlur={() => saveManualField("budget_min")} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Budget max</label>
            <Input value={plan.budget_max ?? ""} inputMode="decimal" onChange={(event) => updateLocalField("budget_max", event.target.value)} onBlur={() => saveManualField("budget_max")} />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Extra notes</label>
            <Textarea rows={6} value={plan.notes || ""} onChange={(event) => updateLocalField("notes", event.target.value)} onBlur={() => saveManualField("notes")} />
          </div>
        </div>
      </Card>

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
    </div>
  );
}
