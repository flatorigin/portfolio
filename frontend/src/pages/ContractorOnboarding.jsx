import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import { Button, Card, Container, Input, SymbolIcon, Textarea } from "../ui";
import {
  CONTRACTOR_CATEGORY_GROUPS,
  CONTRACTOR_CATEGORY_OPTIONS,
  MAX_CONTRACTOR_CATEGORIES,
} from "../data/contractorCategories";

function normalizeCategories(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_CONTRACTOR_CATEGORIES);
}

const steps = [
  {
    id: "business",
    title: "What should homeowners call your business?",
    helper: "Use your company name, your trade name, or your own name.",
  },
  {
    id: "area",
    title: "Where do you usually work?",
    helper: "A city, county, or ZIP/postal code is enough. You can make this more exact later.",
  },
  {
    id: "category",
    title: "Choose your main contractor title",
    helper: "This is the title shown publicly on your profile.",
  },
  {
    id: "work",
    title: "What kind of work do you do?",
    helper: "Pick up to 10. These help homeowners find you, even if they are not all shown publicly.",
  },
  {
    id: "about",
    title: "Tell homeowners what you do",
    helper: "Keep it simple. A few sentences is enough.",
  },
  {
    id: "contact",
    title: "How should homeowners contact you?",
    helper: "Platform messages stay available. You control whether call or email buttons show publicly.",
  },
  {
    id: "finish",
    title: "Review your setup",
    helper: "You can finish now and keep improving your profile later.",
  },
];

const initialForm = {
  display_name: "",
  service_location: "",
  contractor_primary_category: "",
  contractor_categories: [],
  bio: "",
  contact_email: "",
  contact_phone: "",
  show_contact_email: false,
  show_contact_phone: false,
  public_profile_enabled: true,
  allow_direct_messages: true,
};

export default function ContractorOnboarding() {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const step = steps[stepIndex];
  const selectedCategories = normalizeCategories(form.contractor_categories);
  const progress = Math.round(((stepIndex + 1) / steps.length) * 100);

  const primaryOptions = useMemo(
    () => normalizeCategories([
      form.contractor_primary_category,
      ...selectedCategories,
      ...CONTRACTOR_CATEGORY_OPTIONS,
    ]),
    [form.contractor_primary_category, selectedCategories]
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");

    api
      .get("/users/me/contractor-onboarding/")
      .then(({ data }) => {
        if (!alive) return;
        setForm({
          display_name: data.display_name || "",
          service_location: data.service_location || "",
          contractor_primary_category: data.contractor_primary_category || "",
          contractor_categories: normalizeCategories(data.contractor_categories),
          bio: data.bio || "",
          contact_email: data.contact_email || data.email || "",
          contact_phone: data.contact_phone || "",
          show_contact_email: !!data.show_contact_email,
          show_contact_phone: !!data.show_contact_phone,
          public_profile_enabled: data.public_profile_enabled !== false,
          allow_direct_messages: data.allow_direct_messages !== false,
        });
      })
      .catch((err) => {
        console.error("[ContractorOnboarding] load error", err?.response || err);
        setError(err?.response?.data?.detail || "Could not load onboarding.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const updateField = (key) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateToggle = (key) => (event) => {
    const checked = event.target.checked;
    setForm((prev) => ({ ...prev, [key]: checked }));
  };

  const toggleCategory = (category) => {
    const current = normalizeCategories(form.contractor_categories);
    const exists = current.includes(category);
    if (exists) {
      setForm((prev) => ({
        ...prev,
        contractor_categories: current.filter((item) => item !== category),
      }));
      return;
    }
    if (current.length >= MAX_CONTRACTOR_CATEGORIES) return;
    setForm((prev) => ({ ...prev, contractor_categories: [...current, category] }));
  };

  const payloadForStep = () => {
    const base = { profile_type: "contractor" };
    if (step.id === "business") return { ...base, display_name: form.display_name };
    if (step.id === "area") return { ...base, service_location: form.service_location };
    if (step.id === "category") {
      return { ...base, contractor_primary_category: form.contractor_primary_category };
    }
    if (step.id === "work") {
      return {
        ...base,
        contractor_categories: normalizeCategories(form.contractor_categories),
      };
    }
    if (step.id === "about") return { ...base, bio: form.bio };
    if (step.id === "contact") {
      return {
        ...base,
        contact_email: form.contact_email,
        contact_phone: form.contact_phone,
        show_contact_email: form.show_contact_email,
        show_contact_phone: form.show_contact_phone,
        public_profile_enabled: form.public_profile_enabled,
        allow_direct_messages: form.allow_direct_messages,
      };
    }
    return base;
  };

  const saveCurrentStep = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const { data } = await api.patch("/users/me/contractor-onboarding/", payloadForStep());
      setForm((prev) => ({
        ...prev,
        ...payloadForStep(),
        contractor_categories: Array.isArray(data.contractor_categories)
          ? normalizeCategories(data.contractor_categories)
          : prev.contractor_categories,
      }));
      setMessage("Saved.");
      return true;
    } catch (err) {
      console.error("[ContractorOnboarding] save error", err?.response || err);
      const detail = err?.response?.data?.detail || err?.response?.data || "Could not save this step.";
      setError(typeof detail === "string" ? detail : JSON.stringify(detail));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const nextStep = async () => {
    const ok = await saveCurrentStep();
    if (!ok) return;
    setStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const completeOnboarding = async () => {
    const ok = await saveCurrentStep();
    if (!ok) return;
    setSaving(true);
    setError("");
    try {
      await api.post("/users/me/contractor-onboarding/", { action: "complete" });
      navigate("/profile/edit");
    } catch (err) {
      console.error("[ContractorOnboarding] complete error", err?.response || err);
      setError(err?.response?.data?.detail || "Finish the required steps before completing setup.");
    } finally {
      setSaving(false);
    }
  };

  const dismissOnboarding = async () => {
    try {
      await api.post("/users/me/contractor-onboarding/", { action: "dismiss" });
    } catch {
      // Dismissal should never trap the user.
    }
    navigate("/dashboard");
  };

  const renderStep = () => {
    if (step.id === "business") {
      return (
        <Input
          autoFocus
          value={form.display_name}
          onChange={updateField("display_name")}
          placeholder="e.g. Smith Home Improvements"
        />
      );
    }

    if (step.id === "area") {
      return (
        <Input
          autoFocus
          value={form.service_location}
          onChange={updateField("service_location")}
          placeholder="e.g. Media, PA or Chester County, PA"
        />
      );
    }

    if (step.id === "category") {
      return (
        <div>
          <Input
            autoFocus
            list="contractor-onboarding-primary-category-options"
            value={form.contractor_primary_category}
            onChange={updateField("contractor_primary_category")}
            placeholder="e.g. General Contractor"
          />
          <datalist id="contractor-onboarding-primary-category-options">
            {primaryOptions.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
          <div className="mt-4 flex flex-wrap gap-2">
            {["General Contractor", "Deck Builder", "Plumber", "Electrician"].map((category) => (
              <button
                type="button"
                key={category}
                onClick={() =>
                  setForm((prev) => ({ ...prev, contractor_primary_category: category }))
                }
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (step.id === "work") {
      return (
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-700">
              {selectedCategories.length}/{MAX_CONTRACTOR_CATEGORIES} selected
            </span>
            {selectedCategories.map((category) => (
              <span key={category} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                {category}
              </span>
            ))}
          </div>
          <div className="max-h-[420px] overflow-y-auto pr-1">
            <div className="grid gap-4 lg:grid-cols-2">
              {CONTRACTOR_CATEGORY_GROUPS.map((group) => (
                <section key={group.title} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-slate-950">{group.title}</h3>
                  <div className="mt-3 grid gap-2">
                    {group.options.map((category) => {
                      const checked = selectedCategories.includes(category);
                      const disabled = !checked && selectedCategories.length >= MAX_CONTRACTOR_CATEGORIES;
                      return (
                        <label
                          key={category}
                          className={[
                            "flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm",
                            checked
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                            disabled ? "cursor-not-allowed opacity-50" : "",
                          ].join(" ")}
                        >
                          <span>{category}</span>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => toggleCategory(category)}
                          />
                        </label>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (step.id === "about") {
      return (
        <Textarea
          autoFocus
          rows={7}
          value={form.bio}
          onChange={updateField("bio")}
          placeholder="Example: We handle deck builds, exterior repairs, and finish carpentry for homeowners around Media. We focus on clear communication, clean job sites, and durable work."
        />
      );
    }

    if (step.id === "contact") {
      return (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              type="email"
              value={form.contact_email}
              onChange={updateField("contact_email")}
              placeholder="Business email"
            />
            <Input
              type="tel"
              value={form.contact_phone}
              onChange={updateField("contact_phone")}
              placeholder="Business phone"
            />
          </div>
          {[
            ["allow_direct_messages", "Allow homeowners to message me on FlatOrigin"],
            ["show_contact_phone", "Show a call button on my public profile"],
            ["show_contact_email", "Show an email button on my public profile"],
            ["public_profile_enabled", "Make my contractor profile public"],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
              <span className="text-sm font-medium text-slate-800">{label}</span>
              <input type="checkbox" checked={!!form[key]} onChange={updateToggle(key)} />
            </label>
          ))}
        </div>
      );
    }

    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ["Business", form.display_name || "Not added"],
          ["Service area", form.service_location || "Not added"],
          ["Title", form.contractor_primary_category || "Not added"],
          ["Categories", selectedCategories.length ? `${selectedCategories.length} selected` : "Not added"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
            <div className="mt-2 text-sm font-semibold text-slate-900">{value}</div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <Container className="py-12">
        <div className="text-sm text-slate-500">Loading contractor setup...</div>
      </Container>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBF9F7] text-slate-900">
      <Container className="py-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link to="/contractor" className="text-base font-bold tracking-tight text-slate-900">
            FlatOrigin
          </Link>
          <button
            type="button"
            onClick={dismissOnboarding}
            className="text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            Skip for now
          </button>
        </div>

        <div className="mx-auto max-w-4xl">
          <div className="mb-5">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <span>Contractor setup</span>
              <span>Step {stepIndex + 1} of {steps.length}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-slate-900" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <Card className="p-6 sm:p-8">
            <div className="mb-7 flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white">
                <SymbolIcon name="construction" className="text-[22px]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                  {step.title}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  {step.helper}
                </p>
              </div>
            </div>

            {renderStep()}

            {error ? (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}
            {message ? <div className="mt-5 text-xs text-emerald-600">{message}</div> : null}

            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                disabled={saving || stepIndex === 0}
                onClick={() => setStepIndex((prev) => Math.max(prev - 1, 0))}
                className="bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
              >
                Back
              </Button>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  disabled={saving}
                  onClick={saveCurrentStep}
                  className="bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
                >
                  Save
                </Button>
                {step.id === "finish" ? (
                  <Button type="button" disabled={saving} onClick={completeOnboarding}>
                    Finish setup
                  </Button>
                ) : (
                  <Button type="button" disabled={saving} onClick={nextStep}>
                    {saving ? "Saving..." : "Continue"}
                  </Button>
                )}
              </div>
            </div>
          </Card>

          <div className="mt-5 text-center text-xs text-slate-500">
            Need the full editor?{" "}
            <Link to="/profile/edit" className="font-semibold text-slate-700 hover:text-slate-950">
              Open edit profile
            </Link>
          </div>
        </div>
      </Container>
    </div>
  );
}
