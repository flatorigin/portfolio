import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api";
import { SectionTitle, SymbolIcon } from "../ui";

const DEFAULT_OPTIONS = {
  skills: [
    ["general_labor", "General labor"],
    ["demolition", "Demolition"],
    ["cleanup", "Cleanup"],
    ["painting", "Painting"],
    ["landscaping", "Landscaping"],
    ["flooring", "Flooring"],
    ["drywall", "Drywall"],
    ["framing", "Framing"],
    ["decks", "Decks"],
    ["concrete", "Concrete"],
    ["tile", "Tile"],
    ["cabinet_installation", "Cabinet installation"],
    ["moving_materials", "Moving materials"],
    ["roofing_assistant", "Roofing assistant"],
    ["electrical_assistant", "Electrical assistant"],
    ["plumbing_assistant", "Plumbing assistant"],
    ["other", "Other"],
  ],
  availability: [
    ["weekdays", "Weekdays"],
    ["evenings", "Evenings"],
    ["weekends", "Weekends"],
    ["part_time", "Part-time"],
    ["full_time", "Full-time"],
    ["one_day_help", "One-day help"],
  ],
  experience_levels: [
    ["beginner", "Beginner"],
    ["1_3_years", "1-3 years"],
    ["3_10_years", "3-10 years"],
    ["10_plus_years", "10+ years"],
  ],
  preferred_contact_methods: [
    ["phone", "Phone"],
    ["email", "Email"],
    ["either", "Either"],
  ],
};

const EMPTY_LISTING = {
  full_name: "",
  city: "",
  state: "PA",
  service_radius_miles: 15,
  phone: "",
  email: "",
  preferred_contact_method: "email",
  skills: [],
  other_skill: "",
  availability: [],
  experience_level: "1_3_years",
  bio: "",
};

const EMPTY_FEEDBACK = {
  project_type: "",
  worked_together: true,
  reliability_rating: 5,
  communication_rating: 5,
  work_quality_rating: 5,
  would_hire_again: true,
  short_note: "",
};
const HELPERS_DISCLAIMER_TEXT =
  "FlatOrigin provides a directory of individuals who choose to publish their contact information. FlatOrigin does not employ, recommend, verify work quality, manage payment, or guarantee any helper. Please verify experience, availability, insurance, licensing needs, and payment terms directly before hiring.";

function normalizeOptions(data) {
  const normalize = (items, fallback) =>
    Array.isArray(items) ? items.map((item) => [item.value, item.label]) : fallback;
  return {
    skills: normalize(data?.skills, DEFAULT_OPTIONS.skills),
    availability: normalize(data?.availability, DEFAULT_OPTIONS.availability),
    experience_levels: normalize(data?.experience_levels, DEFAULT_OPTIONS.experience_levels),
    preferred_contact_methods: normalize(
      data?.preferred_contact_methods,
      DEFAULT_OPTIONS.preferred_contact_methods
    ),
  };
}

function getErrorText(error) {
  const data = error?.response?.data;
  if (!data) return "Something went wrong. Please try again.";
  if (typeof data === "string") return data;
  if (data.detail) return data.detail;
  const firstKey = Object.keys(data)[0];
  const value = firstKey ? data[firstKey] : "";
  if (Array.isArray(value)) return `${firstKey}: ${value.join(" ")}`;
  if (typeof value === "string") return `${firstKey}: ${value}`;
  return JSON.stringify(data);
}

function TogglePill({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full border px-3 py-2 text-sm font-medium transition " +
        (active
          ? "border-slate-950 bg-slate-950 text-white"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50")
      }
    >
      {label}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-800">{label}</span>
      {children}
    </label>
  );
}

function RatingInput({ label, value, onChange }) {
  return (
    <Field label={label}>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
      >
        {[5, 4, 3, 2, 1].map((rating) => (
          <option key={rating} value={rating}>
            {rating}
          </option>
        ))}
      </select>
    </Field>
  );
}

function feedbackAverage(feedback) {
  if (!feedback) return 0;
  const total =
    Number(feedback.reliability_rating || 0) +
    Number(feedback.communication_rating || 0) +
    Number(feedback.work_quality_rating || 0);
  return total ? total / 3 : 0;
}

function ratingTone(value) {
  if (value >= 4) return "text-amber-500";
  if (value >= 3) return "text-amber-600";
  if (value > 0) return "text-rose-500";
  return "text-slate-300";
}

function RatingStars({ value = 0, size = "text-[15px]" }) {
  const rounded = Math.round(Number(value || 0));
  const tone = ratingTone(Number(value || 0));

  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${Number(value || 0).toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <SymbolIcon
          key={star}
          name="star"
          fill={rounded >= star ? 1 : 0}
          className={`${size} ${rounded >= star ? tone : "text-slate-300"}`}
        />
      ))}
    </span>
  );
}

function formatFeedbackDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function HelperFeedbackDialog({ helper, authed, onClose, onLeaveFeedback }) {
  const feedback = Array.isArray(helper.approved_feedback) ? helper.approved_feedback : [];
  const averageRating = Number(helper.average_rating || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <div className="text-lg font-bold text-slate-950">Helper feedback</div>
            <div className="mt-0.5 text-sm text-slate-500">{helper.full_name}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="max-h-[72vh] overflow-y-auto p-5">
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <RatingStars value={averageRating} size="text-[20px]" />
              <div className="text-sm font-semibold text-slate-900">
                {averageRating ? `${averageRating.toFixed(1)} out of 5` : "No approved rating yet"}
              </div>
              <div className="text-sm text-slate-500">
                {helper.feedback_count || 0} feedback
              </div>
            </div>
            <div className="mt-2 text-sm text-slate-500">
              {helper.would_hire_again_count || 0} would hire again
            </div>
          </div>

          {feedback.length ? (
            <div className="mt-4 space-y-3">
              {feedback.map((item) => {
                const itemAverage = feedbackAverage(item);
                return (
                  <div key={item.id} className="rounded-xl border border-slate-100 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-950">
                          {item.project_type}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          {item.reviewer_username ? <span>{item.reviewer_username}</span> : null}
                          {item.created_at ? <span>{formatFeedbackDate(item.created_at)}</span> : null}
                          {item.worked_together ? <span>Worked together</span> : null}
                          {item.would_hire_again ? <span>Would hire again</span> : null}
                        </div>
                      </div>
                      <div className="text-right">
                        <RatingStars value={itemAverage} />
                        <div className="mt-0.5 text-xs font-semibold text-slate-600">
                          {itemAverage.toFixed(1)}
                        </div>
                      </div>
                    </div>

                    {item.short_note ? (
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {item.short_note}
                      </p>
                    ) : null}

                    <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                      <div>Reliability: {item.reliability_rating}/5</div>
                      <div>Communication: {item.communication_rating}/5</div>
                      <div>Work quality: {item.work_quality_rating}/5</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-white p-5 text-sm text-slate-500">
              No approved feedback has been posted for this helper yet.
            </div>
          )}

          <div className="mt-5 flex justify-end">
            {authed ? (
              <button
                type="button"
                onClick={onLeaveFeedback}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <SymbolIcon name="rate_review" className="text-[17px]" />
                Leave feedback
              </button>
            ) : (
              <Link
                to="/login"
                className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Log in to leave feedback
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function HelperCard({ helper, authed, onFeedback }) {
  const [expanded, setExpanded] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const availabilityText = (helper.availability_labels || []).join(", ") || "Availability not listed";
  const feedbackCount = Number(helper.feedback_count || 0);
  const averageRating = Number(helper.average_rating || 0);
  const contactItems = [
    helper.phone ? ["Phone", helper.phone] : null,
    helper.email ? ["Email", helper.email] : null,
  ].filter(Boolean);

  return (
    <article
      className={
        "group rounded-2xl border border-white/70 bg-white/85 shadow-sm backdrop-blur transition hover:border-slate-200 hover:shadow-md " +
        (expanded ? "ring-1 ring-slate-200" : "")
      }
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        onFocus={() => setExpanded(true)}
        className="grid w-full gap-3 px-4 py-3 text-left sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-center"
        aria-expanded={expanded ? "true" : "false"}
      >
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-slate-950">{helper.full_name}</div>
          {helper.contact_verified ? (
            <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
              <SymbolIcon name="verified" className="text-[13px]" />
              Verified Contact
            </div>
          ) : null}
        </div>
        <div className="min-w-0 text-sm text-slate-600">
          <span className="font-medium text-slate-700">Location:</span>{" "}
          <span className="truncate">
            {helper.city}, {helper.state} · {helper.service_radius_miles} mi
          </span>
        </div>
        <div className="min-w-0 text-sm text-slate-600">
          <span className="font-medium text-slate-700">Availability:</span>{" "}
          <span className="line-clamp-1">{availabilityText}</span>
        </div>
        <div className="flex items-center justify-end gap-2 text-xs font-semibold text-slate-500">
          <span>{expanded ? "Show less" : "Show more"}</span>
          <SymbolIcon
            name={expanded ? "expand_less" : "expand_more"}
            className="text-[18px]"
          />
        </div>
      </button>

      <div
        className={
          "grid overflow-hidden transition-all duration-200 " +
          (expanded
            ? "grid-rows-[1fr] border-t border-slate-100 opacity-100"
            : "grid-rows-[0fr] opacity-0")
        }
      >
        <div className="min-h-0">
          <div className="space-y-4 px-4 py-4">
            <div className="flex flex-wrap gap-2">
              {(helper.skill_labels || []).map((skill) => (
                <span
                  key={skill}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700"
                >
                  {skill}
                </span>
              ))}
              {helper.other_skill ? (
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                  {helper.other_skill}
                </span>
              ) : null}
            </div>

            <dl className="grid gap-3 text-sm text-slate-700 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Experience
                </dt>
                <dd>{helper.experience_level_label}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Preferred contact
                </dt>
                <dd>{helper.preferred_contact_method_label}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Feedback
                </dt>
                <dd>
                  <button
                    type="button"
                    onClick={() => setFeedbackOpen(true)}
                    className="mt-1 inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-left text-sm font-semibold text-slate-800 hover:text-slate-950"
                  >
                    <RatingStars value={averageRating} />
                    <span>
                      {feedbackCount
                        ? `${averageRating.toFixed(1)}/5 from ${feedbackCount} feedback`
                        : "View feedback (0)"}
                    </span>
                  </button>
                  <div className="mt-1 text-xs text-slate-500">
                    {helper.would_hire_again_count || 0} would hire again
                  </div>
                </dd>
              </div>
            </dl>

            {helper.bio ? (
              <p className="text-sm leading-6 text-slate-600">{helper.bio}</p>
            ) : null}

            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Copy contact info
              </div>
              {contactItems.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {contactItems.map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                    >
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        {label}
                      </div>
                      <div className="select-all break-all text-sm font-medium text-slate-800">
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-500">No public contact listed.</div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                Verify helper availability, qualifications, and payment terms directly.
              </p>
              {authed ? (
                <button
                  type="button"
                  onClick={() => onFeedback(helper)}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <SymbolIcon name="rate_review" className="text-[17px]" />
                  Leave feedback
                </button>
              ) : (
                <Link
                  to="/login"
                  className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Log in to leave feedback
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
      {feedbackOpen ? (
        <HelperFeedbackDialog
          helper={helper}
          authed={authed}
          onClose={() => setFeedbackOpen(false)}
          onLeaveFeedback={() => {
            setFeedbackOpen(false);
            onFeedback(helper);
          }}
        />
      ) : null}
    </article>
  );
}

function HelperListingWizard({ open, options, onClose, onSubmitted }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY_LISTING);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (open) {
      setStep(0);
      setForm(EMPTY_LISTING);
      setBusy(false);
      setError("");
      setSuccess("");
    }
  }, [open]);

  if (!open) return null;

  const setField = (field, value) => {
    setError("");
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleArray = (field, value) => {
    setError("");
    setForm((prev) => {
      const current = Array.isArray(prev[field]) ? prev[field] : [];
      return {
        ...prev,
        [field]: current.includes(value)
          ? current.filter((item) => item !== value)
          : [...current, value],
      };
    });
  };

  const validates = () => {
    if (step === 0 && !form.full_name.trim()) return "Enter your full name.";
    if (step === 1 && (!form.city.trim() || form.state.trim().length !== 2)) {
      return "Enter your city and 2-letter state.";
    }
    if (step === 2) {
      if (form.preferred_contact_method === "phone" && !form.phone.trim()) {
        return "Enter a phone number or choose email.";
      }
      if (form.preferred_contact_method === "email" && !form.email.trim()) {
        return "Enter an email address or choose phone.";
      }
      if (form.preferred_contact_method === "either" && !form.phone.trim() && !form.email.trim()) {
        return "Enter a phone number, email address, or both.";
      }
    }
    if (step === 3 && form.skills.length === 0) return "Choose at least one skill.";
    if (step === 4 && form.skills.includes("other") && !form.other_skill.trim()) {
      return "Describe the other skill.";
    }
    if (step === 5 && form.availability.length === 0) {
      return "Choose at least one availability option.";
    }
    return "";
  };

  const next = () => {
    const message = validates();
    if (message) {
      setError(message);
      return;
    }
    setError("");
    setStep((value) => Math.min(value + 1, 7));
  };

  const submit = async () => {
    const message = validates();
    if (message) {
      setError(message);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.post("/project-helpers/", form);
      setSuccess(
        form.email
          ? "Thanks. Check your email to verify your contact. After admin review, your listing can appear publicly."
          : "Thanks. Your phone-only listing was submitted. FlatOrigin will manually verify the contact before admin approval."
      );
      onSubmitted?.();
    } catch (err) {
      setError(getErrorText(err));
    } finally {
      setBusy(false);
    }
  };

  const totalSteps = 8;
  const progress = Math.round(((step + 1) / totalSteps) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-bold text-slate-950">List yourself</div>
              <div className="text-sm text-slate-500">
                Quick helper listing · one question at a time
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-slate-950 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {success ? (
          <div className="space-y-5 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <SymbolIcon name="check" className="text-[26px]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-950">Listing submitted</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{success}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 items-center rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-5 p-6">
            {error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {error}
              </div>
            ) : null}

            {step === 0 ? (
              <div>
                <h2 className="text-xl font-bold text-slate-950">What is your full name?</h2>
                <p className="mt-1 text-sm text-slate-500">This is the name visitors will see.</p>
                <input
                  autoFocus
                  value={form.full_name}
                  onChange={(e) => setField("full_name", e.target.value)}
                  placeholder="Full name"
                  className="mt-5 h-12 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-slate-400"
                />
              </div>
            ) : null}

            {step === 1 ? (
              <div>
                <h2 className="text-xl font-bold text-slate-950">Where can you help?</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Add the city, state, and rough service radius.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_90px_150px]">
                  <Field label="City">
                    <input
                      value={form.city}
                      onChange={(e) => setField("city", e.target.value)}
                      placeholder="Media"
                      className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-slate-400"
                    />
                  </Field>
                  <Field label="State">
                    <input
                      value={form.state}
                      maxLength={2}
                      onChange={(e) => setField("state", e.target.value.toUpperCase())}
                      placeholder="PA"
                      className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm uppercase outline-none focus:border-slate-400"
                    />
                  </Field>
                  <Field label="Coverage miles">
                    <input
                      type="number"
                      min="1"
                      value={form.service_radius_miles}
                      onChange={(e) => setField("service_radius_miles", Number(e.target.value))}
                      placeholder="15"
                      className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-slate-400"
                    />
                  </Field>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div>
                <h2 className="text-xl font-bold text-slate-950">How should people contact you?</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Email can be verified automatically. Phone-only listings will be manually
                  verified for the first helpers.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {options.preferred_contact_methods.map(([value, label]) => (
                    <TogglePill
                      key={value}
                      label={label}
                      active={form.preferred_contact_method === value}
                      onClick={() => setField("preferred_contact_method", value)}
                    />
                  ))}
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <input
                    value={form.phone}
                    onChange={(e) => setField("phone", e.target.value)}
                    placeholder="Phone number"
                    className="h-12 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-slate-400"
                  />
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                    placeholder="Email address"
                    className="h-12 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-slate-400"
                  />
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div>
                <h2 className="text-xl font-bold text-slate-950">What kind of help can you provide?</h2>
                <p className="mt-1 text-sm text-slate-500">Choose all that apply.</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {options.skills.map(([value, label]) => (
                    <TogglePill
                      key={value}
                      label={label}
                      active={form.skills.includes(value)}
                      onClick={() => toggleArray("skills", value)}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {step === 4 ? (
              <div>
                <h2 className="text-xl font-bold text-slate-950">Any other skill to mention?</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Optional unless you selected Other in the previous step.
                </p>
                <input
                  value={form.other_skill}
                  onChange={(e) => setField("other_skill", e.target.value)}
                  placeholder="Other skill"
                  className="mt-5 h-12 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-slate-400"
                />
              </div>
            ) : null}

            {step === 5 ? (
              <div>
                <h2 className="text-xl font-bold text-slate-950">When are you usually available?</h2>
                <p className="mt-1 text-sm text-slate-500">Choose the options that fit.</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {options.availability.map(([value, label]) => (
                    <TogglePill
                      key={value}
                      label={label}
                      active={form.availability.includes(value)}
                      onClick={() => toggleArray("availability", value)}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {step === 6 ? (
              <div>
                <h2 className="text-xl font-bold text-slate-950">What is your experience level?</h2>
                <div className="mt-5 flex flex-wrap gap-2">
                  {options.experience_levels.map(([value, label]) => (
                    <TogglePill
                      key={value}
                      label={label}
                      active={form.experience_level === value}
                      onClick={() => setField("experience_level", value)}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {step === 7 ? (
              <div>
                <h2 className="text-xl font-bold text-slate-950">Add a short bio</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Keep it simple. Maximum 300 characters.
                </p>
                <textarea
                  value={form.bio}
                  maxLength={300}
                  onChange={(e) => setField("bio", e.target.value)}
                  placeholder="Example: Available for weekend cleanup, material moving, and painting prep around Media."
                  className="mt-5 min-h-28 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                />
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Your listing will not appear publicly until contact verification and admin
                  approval are complete. Phone-only listings can be manually verified for now.
                </div>
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={() => (step === 0 ? onClose() : setStep((value) => value - 1))}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {step === 0 ? "Cancel" : "Back"}
              </button>
              {step < 7 ? (
                <button
                  type="button"
                  onClick={next}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={busy}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {busy ? "Submitting..." : "Submit for review"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProjectHelpers() {
  const { token } = useParams();
  const authed = !!localStorage.getItem("access");
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [helpers, setHelpers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    skill: "",
    city: "",
    availability: "",
    experience_level: "",
  });
  const [wizardOpen, setWizardOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [feedbackHelper, setFeedbackHelper] = useState(null);
  const [feedbackForm, setFeedbackForm] = useState(EMPTY_FEEDBACK);
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const [feedbackSuccess, setFeedbackSuccess] = useState("");
  const [verifyMessage, setVerifyMessage] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [showDisclaimer, setShowDisclaimer] = useState(true);

  const acknowledgeDisclaimer = () => {
    setShowDisclaimer(false);
  };

  useEffect(() => {
    let cancelled = false;
    api
      .get("/project-helpers/options/")
      .then(({ data }) => {
        if (!cancelled) setOptions(normalizeOptions(data));
      })
      .catch(() => {
        if (!cancelled) setOptions(DEFAULT_OPTIONS);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api
      .get(`/project-helpers/verify/${token}/`)
      .then(({ data }) => {
        if (!cancelled) {
          setVerifyMessage(data?.detail || "Contact verified.");
          setVerifyError("");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setVerifyError(getErrorText(err));
          setVerifyMessage("");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    Object.entries(filters).forEach(([key, value]) => {
      if (String(value || "").trim()) params.set(key, String(value).trim());
    });
    return params.toString();
  }, [search, filters]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get(`/project-helpers/${queryParams ? `?${queryParams}` : ""}`)
      .then(({ data }) => {
        if (!cancelled) setHelpers(Array.isArray(data) ? data : data?.results || []);
      })
      .catch(() => {
        if (!cancelled) setHelpers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [queryParams, refreshKey]);

  const submitFeedback = async (e) => {
    e.preventDefault();
    if (!feedbackHelper) return;
    setFeedbackBusy(true);
    setFeedbackError("");
    setFeedbackSuccess("");
    try {
      await api.post(`/project-helpers/${feedbackHelper.id}/feedback/`, feedbackForm);
      setFeedbackSuccess("Feedback submitted. It will appear after admin review.");
      setFeedbackForm(EMPTY_FEEDBACK);
    } catch (err) {
      setFeedbackError(getErrorText(err));
    } finally {
      setFeedbackBusy(false);
    }
  };

  return (
    <div className="space-y-6 py-6">
      <header className="space-y-3">
        <SectionTitle className="!mb-0">Project Helpers</SectionTitle>
        <p className="max-w-3xl text-base leading-7 text-slate-600">
          Find local extra hands for construction, cleanup, repairs, and project support.
        </p>
      </header>

      <section className="rounded-2xl border border-white/70 bg-white/85 p-5 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-950">
              Available for project helper work?
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              Add yourself to the local helper directory with a quick one-question-at-a-time
              signup. Listings publish after contact verification and admin approval.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setWizardOpen(true)}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <SymbolIcon name="add" className="text-[18px]" />
            List yourself
          </button>
        </div>
      </section>

      {verifyMessage || verifyError ? (
        <div
          className={
            "rounded-2xl border px-4 py-3 text-sm " +
            (verifyError
              ? "border-rose-200 bg-rose-50 text-rose-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800")
          }
        >
          {verifyError || verifyMessage}
        </div>
      ) : null}

      <section className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
        <div className="grid gap-3 lg:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_0.8fr]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search helpers by skill, city, or availability..."
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-slate-400"
          />
          <select
            value={filters.skill}
            onChange={(e) => setFilters((prev) => ({ ...prev, skill: e.target.value }))}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
          >
            <option value="">All skills</option>
            {options.skills.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input
            value={filters.city}
            onChange={(e) => setFilters((prev) => ({ ...prev, city: e.target.value }))}
            placeholder="City"
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
          />
          <select
            value={filters.availability}
            onChange={(e) => setFilters((prev) => ({ ...prev, availability: e.target.value }))}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
          >
            <option value="">Any availability</option>
            {options.availability.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={filters.experience_level}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, experience_level: e.target.value }))
            }
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
          >
            <option value="">Any experience</option>
            {options.experience_levels.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="space-y-4">
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1].map((item) => (
              <div key={item} className="rounded-2xl border border-white/70 bg-white/80 p-5">
                <div className="h-5 w-48 animate-pulse rounded bg-slate-100" />
                <div className="mt-3 h-4 w-64 animate-pulse rounded bg-slate-100" />
                <div className="mt-5 h-20 animate-pulse rounded-xl bg-slate-100" />
              </div>
            ))}
          </div>
        ) : helpers.length ? (
          <div className="space-y-3">
            {helpers.map((helper) => (
              <HelperCard
                key={helper.id}
                helper={helper}
                authed={authed}
                onFeedback={(item) => {
                  setFeedbackHelper(item);
                  setFeedbackError("");
                  setFeedbackSuccess("");
                }}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-8 text-center">
            <div className="text-sm font-semibold text-slate-700">
              No project helpers found for this search.
            </div>
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <SymbolIcon name="add" className="text-[18px]" />
              List yourself
            </button>
          </div>
        )}
      </section>

      <HelperListingWizard
        open={wizardOpen}
        options={options}
        onClose={() => setWizardOpen(false)}
        onSubmitted={() => setRefreshKey((value) => value + 1)}
      />

      {showDisclaimer ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <SymbolIcon name="info" className="text-[24px]" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-950">
              Project Helpers is a public directory
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {HELPERS_DISCLAIMER_TEXT}
            </p>
            <button
              type="button"
              onClick={acknowledgeDisclaimer}
              className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              I understand
            </button>
          </div>
        </div>
      ) : null}

      {feedbackHelper ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <div className="text-lg font-bold text-slate-950">Structured feedback</div>
                <div className="text-sm text-slate-500">{feedbackHelper.full_name}</div>
              </div>
              <button
                type="button"
                onClick={() => setFeedbackHelper(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
            <form onSubmit={submitFeedback} className="space-y-4 p-5">
              {feedbackError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  {feedbackError}
                </div>
              ) : null}
              {feedbackSuccess ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  {feedbackSuccess}
                </div>
              ) : null}
              <input
                required
                value={feedbackForm.project_type}
                onChange={(e) =>
                  setFeedbackForm((prev) => ({ ...prev, project_type: e.target.value }))
                }
                placeholder="Project type"
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <RatingInput
                  label="Reliability"
                  value={feedbackForm.reliability_rating}
                  onChange={(value) =>
                    setFeedbackForm((prev) => ({ ...prev, reliability_rating: value }))
                  }
                />
                <RatingInput
                  label="Communication"
                  value={feedbackForm.communication_rating}
                  onChange={(value) =>
                    setFeedbackForm((prev) => ({ ...prev, communication_rating: value }))
                  }
                />
                <RatingInput
                  label="Work quality"
                  value={feedbackForm.work_quality_rating}
                  onChange={(value) =>
                    setFeedbackForm((prev) => ({ ...prev, work_quality_rating: value }))
                  }
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={feedbackForm.worked_together}
                    onChange={(e) =>
                      setFeedbackForm((prev) => ({
                        ...prev,
                        worked_together: e.target.checked,
                      }))
                    }
                  />
                  Worked together
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={feedbackForm.would_hire_again}
                    onChange={(e) =>
                      setFeedbackForm((prev) => ({
                        ...prev,
                        would_hire_again: e.target.checked,
                      }))
                    }
                  />
                  Would hire again
                </label>
              </div>
              <textarea
                value={feedbackForm.short_note}
                maxLength={200}
                onChange={(e) =>
                  setFeedbackForm((prev) => ({ ...prev, short_note: e.target.value }))
                }
                placeholder="Short note optional, 200 characters maximum"
                className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-slate-400"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={feedbackBusy}
                  className="inline-flex h-11 items-center rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {feedbackBusy ? "Submitting..." : "Submit feedback"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
