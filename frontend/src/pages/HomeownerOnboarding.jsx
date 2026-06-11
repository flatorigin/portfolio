import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import { Button, Card, Container, Input, SymbolIcon, Textarea } from "../ui";

const steps = [
  {
    id: "name",
    title: "What should we call you?",
    helper:
      "Use your name or the name you want contractors to see when you reach out.",
  },
  {
    id: "area",
    title: "Where is your project area?",
    helper:
      "A city, neighborhood, or ZIP/postal code is enough. You can update it later.",
  },
  {
    id: "contact",
    title: "Add your contact details",
    helper:
      "These stay protected unless you choose to share them through the platform.",
  },
  {
    id: "about",
    title: "Add a short note about your goals",
    helper:
      "Optional. A few words about what you plan to work on helps shape the rest of setup.",
  },
  {
    id: "finish",
    title: "Review your setup",
    helper: "You can finish now and keep adding project details later.",
  },
];

const initialForm = {
  display_name: "",
  service_location: "",
  contact_email: "",
  contact_phone: "",
  bio: "",
  public_profile_enabled: false,
  allow_direct_messages: true,
};

export default function HomeownerOnboarding() {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const step = steps[stepIndex];
  const progress = Math.round(((stepIndex + 1) / steps.length) * 100);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");

    api
      .get("/users/me/homeowner-onboarding/")
      .then(({ data }) => {
        if (!alive) return;
        setForm({
          display_name: data.display_name || "",
          service_location: data.service_location || "",
          contact_email: data.contact_email || data.email || "",
          contact_phone: data.contact_phone || "",
          bio: data.bio || "",
          public_profile_enabled: !!data.public_profile_enabled,
          allow_direct_messages: data.allow_direct_messages !== false,
        });
      })
      .catch((err) => {
        console.error("[HomeownerOnboarding] load error", err?.response || err);
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

  const payloadForStep = () => {
    const base = { profile_type: "homeowner" };
    if (step.id === "name") return { ...base, display_name: form.display_name };
    if (step.id === "area")
      return { ...base, service_location: form.service_location };
    if (step.id === "contact") {
      return {
        ...base,
        contact_email: form.contact_email,
        contact_phone: form.contact_phone,
        allow_direct_messages: form.allow_direct_messages,
      };
    }
    if (step.id === "about") {
      return {
        ...base,
        bio: form.bio,
        public_profile_enabled: form.public_profile_enabled,
      };
    }
    return base;
  };

  const saveCurrentStep = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await api.patch("/users/me/homeowner-onboarding/", payloadForStep());
      setForm((prev) => ({ ...prev, ...payloadForStep() }));
      setMessage("Saved.");
      return true;
    } catch (err) {
      console.error("[HomeownerOnboarding] save error", err?.response || err);
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data ||
        "Could not save this step.";
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
      await api.post("/users/me/homeowner-onboarding/", { action: "complete" });
      window.dispatchEvent(new CustomEvent("profile:changed"));
      navigate("/profile/edit");
    } catch (err) {
      console.error(
        "[HomeownerOnboarding] complete error",
        err?.response || err,
      );
      setError(
        err?.response?.data?.detail ||
          "Finish the required steps before completing setup.",
      );
    } finally {
      setSaving(false);
    }
  };

  const dismissOnboarding = async () => {
    try {
      await api.post("/users/me/homeowner-onboarding/", { action: "dismiss" });
    } catch {
      // Dismissal should never trap the user.
    }
    navigate("/dashboard");
  };

  const renderStep = () => {
    if (step.id === "name") {
      return (
        <Input
          autoFocus
          value={form.display_name}
          onChange={updateField("display_name")}
          placeholder="e.g. John Wakwins"
        />
      );
    }

    if (step.id === "area") {
      return (
        <Input
          autoFocus
          value={form.service_location}
          onChange={updateField("service_location")}
          placeholder="e.g. Philadelphia, PA or 19106"
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
              placeholder="Contact email"
            />
            <Input
              type="tel"
              value={form.contact_phone}
              onChange={updateField("contact_phone")}
              placeholder="Contact phone"
            />
          </div>
          <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
            <span className="text-sm font-medium text-slate-800">
              Allow contractors to message me on FlatOrigin
            </span>
            <input
              type="checkbox"
              checked={!!form.allow_direct_messages}
              onChange={updateToggle("allow_direct_messages")}
            />
          </label>
        </div>
      );
    }

    if (step.id === "about") {
      return (
        <div className="space-y-4">
          <Textarea
            autoFocus
            rows={6}
            value={form.bio}
            onChange={updateField("bio")}
            placeholder="Example: I am planning a deck repair and a few exterior updates this year."
          />
        </div>
      );
    }

    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ["Name", form.display_name || "Not added"],
          ["Project area", form.service_location || "Not added"],
          ["Email", form.contact_email || "Not added"],
          ["Phone", form.contact_phone || "Not added"],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-200 bg-white p-4"
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {label}
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-900">
              {value}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <Container className="py-12">
        <div className="text-sm text-slate-500">Loading homeowner setup...</div>
      </Container>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBF9F7] text-slate-900">
      <Container className="py-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link
            to="/homeowner"
            className="text-base font-bold tracking-tight text-slate-900"
          >
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
              <span>Homeowner setup</span>
              <span>
                Step {stepIndex + 1} of {steps.length}
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-slate-900"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <Card className="p-6 sm:p-8">
            <div className="mb-7 flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white">
                <SymbolIcon name="home" className="text-[22px]" />
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
            {message ? (
              <div className="mt-5 text-xs text-emerald-600">{message}</div>
            ) : null}

            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                disabled={saving || stepIndex === 0}
                onClick={() => setStepIndex((prev) => Math.max(prev - 1, 0))}
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Back
              </button>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  disabled={saving}
                  onClick={saveCurrentStep}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Save
                </button>
                {step.id === "finish" ? (
                  <Button
                    type="button"
                    disabled={saving}
                    onClick={completeOnboarding}
                  >
                    Complete your profile
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
            <Link
              to="/profile/edit"
              className="font-semibold text-slate-700 hover:text-slate-950"
            >
              Open edit profile
            </Link>
          </div>
        </div>
      </Container>
    </div>
  );
}
