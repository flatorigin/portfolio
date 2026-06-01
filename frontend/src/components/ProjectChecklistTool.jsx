import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Badge, Button, Card, Container, GhostButton, Input, Textarea } from "../ui";
import {
  CONTRACTOR_FOLLOW_UP_QUESTIONS,
  CONTRACTOR_LEAD_FIELDS,
  HOMEOWNER_GENERAL_FIELDS,
  HOMEOWNER_QUESTIONS,
  PROJECT_CATEGORIES,
  PROJECT_CHECK_TRANSFER_KEY,
} from "../data/projectChecklists";

function safeParse(raw, fallback) {
  try {
    return JSON.parse(raw) || fallback;
  } catch {
    return fallback;
  }
}

function getAnswerValue(value) {
  return typeof value === "string" ? value.trim() : value;
}

function isPositive(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return Boolean(normalized) && normalized !== "no" && normalized !== "not sure";
}

function isFilled(value) {
  const answer = getAnswerValue(value);
  return answer !== "" && answer !== null && answer !== undefined;
}

function getCategory(slug) {
  return PROJECT_CATEGORIES.find((category) => category.slug === slug) || PROJECT_CATEGORIES[0];
}

function categoryLabel(slug) {
  return getCategory(slug)?.name || "";
}

function defaultState(mode) {
  const fields = mode === "contractor" ? CONTRACTOR_LEAD_FIELDS : HOMEOWNER_GENERAL_FIELDS;
  return {
    mode,
    answers: Object.fromEntries(fields.map((field) => [field.id, field.id === "category" ? "deck" : ""])),
    categoryAnswers: {},
    updatedAt: new Date().toISOString(),
  };
}

function fieldComplete(field, value) {
  if (!field.weight) return true;
  if (field.type === "yesno" || field.type === "yesno_unsure") return isPositive(value);
  return isFilled(value);
}

function categoryQuestionComplete(question, value) {
  if (!question.required) return true;
  if (question.type === "select") return isPositive(value);
  return isFilled(value);
}

function scoreChecklist(mode, state) {
  const baseFields = mode === "contractor" ? CONTRACTOR_LEAD_FIELDS : HOMEOWNER_GENERAL_FIELDS;
  const activeCategory = getCategory(state.answers.category || "deck");
  const categoryAnswers = state.categoryAnswers?.[activeCategory.slug] || {};
  const items = baseFields
    .filter((field) => Number(field.weight) > 0)
    .map((field) => ({
      label: field.missingLabel,
      weight: Number(field.weight),
      complete: fieldComplete(field, state.answers[field.id]),
    }));

  if (mode === "homeowner") {
    activeCategory.questions.forEach((question) => {
      items.push({
        label: question.label,
        weight: question.required ? 8 : 3,
        complete: categoryQuestionComplete(question, categoryAnswers[question.id]),
      });
    });
  }

  const total = items.reduce((sum, item) => sum + item.weight, 0);
  const earned = items.reduce((sum, item) => sum + (item.complete ? item.weight : 0), 0);
  const score = total ? Math.round((earned / total) * 100) : 0;
  return {
    score,
    missing: items.filter((item) => !item.complete).map((item) => item.label),
  };
}

function scoreMessage(mode, score) {
  if (mode === "contractor") {
    if (score < 50) return "This lead may need more clarification before quoting.";
    if (score < 80) return "This lead has some useful details but needs follow-up questions.";
    return "This lead looks clear enough for an initial response or estimate.";
  }
  if (score < 50) return "This project needs more details before contractors can give useful feedback.";
  if (score < 80) return "This project is partly clear, but a few details would help contractors respond better.";
  return "This project is well prepared and ready to share.";
}

function buildSummary(mode, state, score, missing) {
  const lines = [];
  const answers = state.answers || {};
  const category = getCategory(answers.category || "deck");
  const categoryAnswers = state.categoryAnswers?.[category.slug] || {};

  if (mode === "contractor") {
    lines.push("FlatOrigin Contractor Lead Check");
    lines.push(`Lead clarity score: ${score}/100`);
  } else {
    lines.push("FlatOrigin Homeowner Project Check");
    lines.push(`Project readiness score: ${score}/100`);
  }
  lines.push("");
  lines.push(`Category: ${category.name}`);

  const baseFields = mode === "contractor" ? CONTRACTOR_LEAD_FIELDS : HOMEOWNER_GENERAL_FIELDS;
  baseFields
    .filter((field) => field.id !== "category")
    .forEach((field) => {
      const value = answers[field.id];
      if (isFilled(value)) lines.push(`${field.label}: ${value}`);
    });

  if (mode === "homeowner") {
    lines.push("");
    lines.push(`${category.name} details:`);
    category.questions.forEach((question) => {
      const value = categoryAnswers[question.id];
      if (isFilled(value)) lines.push(`${question.label}: ${value}`);
    });
  }

  if (missing.length > 0) {
    lines.push("");
    lines.push("Missing details:");
    missing.forEach((item) => lines.push(`- ${item}`));
  }

  return lines.join("\n");
}

function buildResponseMessage(state, missing) {
  const category = categoryLabel(state.answers?.category || "deck");
  const selectedQuestions = CONTRACTOR_FOLLOW_UP_QUESTIONS.filter((question) => {
    const lower = question.toLowerCase();
    return missing.some((item) => lower.includes(String(item).split(" ")[0].toLowerCase())) || missing.length < 4;
  }).slice(0, 6);
  return [
    `Hi, thank you for sharing your ${category.toLowerCase()} project.`,
    "Before I can give useful feedback, can you please confirm a few details?",
    "",
    ...selectedQuestions.map((question) => `- ${question}`),
    "",
    "Once I have that information, I can respond with a clearer next step.",
  ].join("\n");
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const element = document.createElement("textarea");
  element.value = text;
  element.setAttribute("readonly", "");
  element.style.position = "absolute";
  element.style.left = "-9999px";
  document.body.appendChild(element);
  element.select();
  document.execCommand("copy");
  document.body.removeChild(element);
}

function FieldControl({ field, value, onChange }) {
  const commonClass = "text-sm";
  if (field.type === "textarea") {
    return (
      <Textarea
        rows={4}
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Add a short note"
        className={commonClass}
      />
    );
  }
  if (field.type === "select" || field.type === "category" || field.type === "yesno" || field.type === "yesno_unsure") {
    const options =
      field.type === "category"
        ? PROJECT_CATEGORIES.map((category) => ({ label: category.name, value: category.slug }))
        : (field.options || (field.type === "yesno" ? ["Yes", "No"] : ["Yes", "No", "Not sure"])).map((option) => ({
            label: option,
            value: option,
          }));
    return (
      <select
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
      >
        <option value="">Choose</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  return (
    <Input
      type={field.type === "number" ? "number" : "text"}
      value={value || ""}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Not sure is okay"
      className={commonClass}
    />
  );
}

export default function ProjectChecklistTool({ mode, storageKey }) {
  const navigate = useNavigate();
  const [state, setState] = useState(() => defaultState(mode));
  const [notice, setNotice] = useState("");
  const [generatedMessage, setGeneratedMessage] = useState("");

  useEffect(() => {
    const restored = safeParse(sessionStorage.getItem(storageKey), null);
    if (restored?.mode === mode && restored?.answers) {
      setState({
        ...defaultState(mode),
        ...restored,
        answers: { ...defaultState(mode).answers, ...(restored.answers || {}) },
        categoryAnswers: restored.categoryAnswers || {},
      });
    }
  }, [mode, storageKey]);

  useEffect(() => {
    sessionStorage.setItem(storageKey, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }));
  }, [state, storageKey]);

  const activeCategory = getCategory(state.answers.category || "deck");
  const categoryAnswers = state.categoryAnswers?.[activeCategory.slug] || {};
  const { score, missing } = useMemo(() => scoreChecklist(mode, state), [mode, state]);
  const isContractor = mode === "contractor";
  const questionList = isContractor ? CONTRACTOR_FOLLOW_UP_QUESTIONS : HOMEOWNER_QUESTIONS;
  const summary = useMemo(() => buildSummary(mode, state, score, missing), [mode, state, score, missing]);

  const updateAnswer = (id, value) => {
    setNotice("");
    setState((prev) => ({
      ...prev,
      answers: { ...prev.answers, [id]: value },
    }));
  };

  const updateCategoryAnswer = (id, value) => {
    setNotice("");
    setState((prev) => ({
      ...prev,
      categoryAnswers: {
        ...prev.categoryAnswers,
        [activeCategory.slug]: {
          ...(prev.categoryAnswers?.[activeCategory.slug] || {}),
          [id]: value,
        },
      },
    }));
  };

  const clearChecklist = () => {
    const next = defaultState(mode);
    sessionStorage.removeItem(storageKey);
    setState(next);
    setGeneratedMessage("");
    setNotice("Checklist cleared.");
  };

  const saveInBrowser = () => {
    sessionStorage.setItem(storageKey, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }));
    setNotice("Saved in this browser session.");
  };

  const copySummary = async () => {
    await copyText(summary);
    setNotice(isContractor ? "Follow-up summary copied." : "Checklist summary copied.");
  };

  const copyQuestions = async () => {
    await copyText(questionList.map((question) => `- ${question}`).join("\n"));
    setNotice("Questions copied.");
  };

  const createResponse = async () => {
    const message = buildResponseMessage(state, missing);
    setGeneratedMessage(message);
    await copyText(message);
    setNotice("Response message copied.");
  };

  const turnIntoProject = () => {
    const payload = {
      mode,
      score,
      missing,
      summary,
      checklist: state,
      mappedProject: {
        title: `${categoryLabel(state.answers.category)} project`,
        summary: state.answers.description || state.answers.notes || "",
        category: categoryLabel(state.answers.category),
        location: state.answers.location || "",
        budget: state.answers.budget || "",
        job_summary: summary,
        is_job_posting: true,
      },
    };
    sessionStorage.setItem(storageKey, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }));
    sessionStorage.setItem(PROJECT_CHECK_TRANSFER_KEY, JSON.stringify(payload));
    if (localStorage.getItem("access")) {
      navigate("/dashboard");
      return;
    }
    navigate(`/register?role=homeowner&next=${encodeURIComponent("/dashboard")}`);
  };

  return (
    <div className="bg-[#FBF9F7] text-slate-900">
      <Container className="py-8 sm:py-12">
        <div className="mb-8 rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Badge className="border-slate-200 bg-slate-100 font-semibold uppercase tracking-[0.12em] text-slate-600">
              Free public tool
            </Badge>
            <h1 className="mt-4 max-w-3xl text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              {isContractor ? "Check a Project Lead Before You Quote" : "Check Your Project Before You Hire"}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              {isContractor
                ? "Use this quick checklist to see if a homeowner has shared enough information for a useful estimate."
                : "Answer a few simple questions to see what details are missing before talking to contractors."}
            </p>
          </div>
          <div className="flex gap-2">
            <Link to={isContractor ? "/project-check/homeowner" : "/project-check/contractor"} className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-xs transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200">
              {isContractor ? "Homeowner check" : "Contractor check"}
            </Link>
          </div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <Card className="p-5 sm:p-6">
              <div className="mb-5 border-b border-slate-100 pb-4">
                <h2 className="text-lg font-semibold text-slate-950">
                  {isContractor ? "Lead basics" : "Project basics"}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Not sure is okay. This is here to show what may need clarification.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {(isContractor ? CONTRACTOR_LEAD_FIELDS : HOMEOWNER_GENERAL_FIELDS).map((field) => (
                  <label key={field.id} className={field.type === "textarea" ? "md:col-span-2" : ""}>
                    <span className="mb-1 block text-xs font-semibold text-slate-600">
                      {field.label}
                    </span>
                    <FieldControl
                      field={field}
                      value={state.answers[field.id]}
                      onChange={(value) => updateAnswer(field.id, value)}
                    />
                  </label>
                ))}
              </div>
            </Card>

            {!isContractor ? (
              <Card className="p-5 sm:p-6">
                <div className="mb-5 flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">
                      {activeCategory.name} details
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      These details help contractors respond with fewer guesses.
                    </p>
                  </div>
                  <Badge>{activeCategory.questions.filter((question) => categoryQuestionComplete(question, categoryAnswers[question.id])).length}/{activeCategory.questions.length} answered</Badge>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {activeCategory.questions.map((question) => (
                    <label key={question.id} className={question.type === "textarea" ? "md:col-span-2" : ""}>
                      <span className="mb-1 block text-xs font-semibold text-slate-600">
                        {question.label}
                      </span>
                      <FieldControl
                        field={question}
                        value={categoryAnswers[question.id]}
                        onChange={(value) => updateCategoryAnswer(question.id, value)}
                      />
                    </label>
                  ))}
                </div>
              </Card>
            ) : null}

            <Card className="p-5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">
                    {isContractor ? "Recommended follow-up questions" : "Suggested contractor questions"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Use these before spending time on pricing or scheduling.
                  </p>
                </div>
                <GhostButton type="button" onClick={copyQuestions}>
                  Copy questions
                </GhostButton>
              </div>
              <ul className="mt-4 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
                {questionList.map((question) => (
                  <li key={question} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                    {question}
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <aside className="lg:sticky lg:top-20 lg:self-start">
            <Card className="overflow-hidden">
              <div className="border-b border-slate-100 bg-slate-50/70 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {isContractor ? "Lead clarity score" : "Project readiness score"}
              </div>
              <div className="mt-4 flex items-end gap-2">
                <span className="text-5xl font-bold tracking-tight text-slate-950">{score}</span>
                <span className="pb-2 text-sm font-semibold text-slate-500">/ 100</span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-slate-900 transition-all" style={{ width: `${score}%` }} />
              </div>
              </div>
              <div className="p-5">
              <p className="mt-4 text-sm leading-6 text-slate-700">{scoreMessage(mode, score)}</p>

              <div className="mt-5 border-t border-slate-200 pt-4">
                <div className="text-sm font-semibold text-slate-950">
                  Missing details
                </div>
                {missing.length > 0 ? (
                  <ul className="mt-3 space-y-2 text-sm text-slate-600">
                    {missing.slice(0, 8).map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-slate-600">No major details are missing.</p>
                )}
              </div>

              <div className="mt-5 grid gap-2">
                <Button type="button" onClick={copySummary}>
                  {isContractor ? "Copy follow-up summary" : "Copy checklist summary"}
                </Button>
                <GhostButton type="button" onClick={saveInBrowser}>
                  Save in this browser
                </GhostButton>
                {isContractor ? (
                  <GhostButton type="button" onClick={createResponse}>
                    Create response message
                  </GhostButton>
                ) : (
                  <GhostButton type="button" onClick={turnIntoProject}>
                    Turn this into a project post
                  </GhostButton>
                )}
                <button
                  type="button"
                  onClick={clearChecklist}
                  className="mt-1 text-center text-xs font-semibold text-slate-500 hover:text-slate-900 hover:underline"
                >
                  Clear checklist
                </button>
              </div>

              {notice ? (
                <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  {notice}
                </div>
              ) : null}
              </div>
            </Card>

            {generatedMessage ? (
              <Card className="mt-4 p-4">
                <div className="text-sm font-semibold text-slate-950">
                  Response message
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-700">
                  {generatedMessage}
                </pre>
              </Card>
            ) : null}
          </aside>
        </div>
      </Container>
    </div>
  );
}
