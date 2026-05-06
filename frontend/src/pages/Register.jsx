import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { register } from "../auth";
import { Card, Input, PasswordInput, Button, SymbolIcon } from "../ui";

export default function Register() {
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    profile_type: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [directoryForm, setDirectoryForm] = useState({
    business_name: "",
    specialtyInput: "",
    specialties: [],
    phone_number: "",
    website: "",
  });
  const [directoryBusy, setDirectoryBusy] = useState(false);
  const [directoryError, setDirectoryError] = useState("");
  const [directorySuccess, setDirectorySuccess] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await register(form);
      setRegisteredEmail(form.email);
    } catch (err) {
      const data = err?.response?.data;
      if (data?.detail) {
        setError(String(data.detail));
      } else if (data && typeof data === "object") {
        const msgs = Object.entries(data).map(([k, v]) => {
          const value = Array.isArray(v) ? v.join(", ") : String(v);
          return `${k}: ${value}`;
        });
        setError(msgs.join(" | "));
      } else {
        setError(err.message || "Registration failed");
      }
    } finally {
      setLoading(false);
    }
  }

  function addSpecialty() {
    const value = directoryForm.specialtyInput.trim();
    if (!value || directoryForm.specialties.length >= 8) return;
    if (directoryForm.specialties.some((item) => item.toLowerCase() === value.toLowerCase())) {
      setDirectoryForm((prev) => ({ ...prev, specialtyInput: "" }));
      return;
    }
    setDirectoryForm((prev) => ({
      ...prev,
      specialtyInput: "",
      specialties: [...prev.specialties, value],
    }));
  }

  function removeSpecialty(value) {
    setDirectoryForm((prev) => ({
      ...prev,
      specialties: prev.specialties.filter((item) => item !== value),
    }));
  }

  async function submitDirectoryListing(e) {
    e.preventDefault();
    setDirectoryError("");
    setDirectorySuccess("");

    const pendingSpecialty = directoryForm.specialtyInput.trim();
    const specialties = pendingSpecialty
      ? [...directoryForm.specialties, pendingSpecialty]
      : directoryForm.specialties;
    const uniqueSpecialties = Array.from(
      new Map(specialties.map((item) => [item.trim().toLowerCase(), item.trim()])).values()
    ).filter(Boolean);

    if (!directoryForm.business_name.trim()) {
      setDirectoryError("Business name is required.");
      return;
    }
    if (!directoryForm.phone_number.trim() && !directoryForm.website.trim()) {
      setDirectoryError("Provide either a phone number or a website.");
      return;
    }
    if (uniqueSpecialties.length > 8) {
      setDirectoryError("Add up to 8 specialties.");
      return;
    }

    setDirectoryBusy(true);
    try {
      const { data } = await api.post("/business-directory/", {
        business_name: directoryForm.business_name.trim(),
        specialties: uniqueSpecialties,
        phone_number: directoryForm.phone_number.trim(),
        website: directoryForm.website.trim(),
      });
      setDirectorySuccess(
        data?.message || "Thanks. Your listing was submitted and will be reviewed before publishing."
      );
      setDirectoryForm({
        business_name: "",
        specialtyInput: "",
        specialties: [],
        phone_number: "",
        website: "",
      });
    } catch (err) {
      const data = err?.response?.data;
      setDirectoryError(
        data?.detail ||
          data?.business_name?.[0] ||
          data?.specialties?.[0] ||
          (data ? JSON.stringify(data) : "") ||
          err?.message ||
          "Could not submit listing."
      );
    } finally {
      setDirectoryBusy(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-4 py-10">
      <Card className="w-full max-w-2xl overflow-hidden border-[#E6EDF7] bg-white p-0 shadow-sm">
        <div className="bg-[radial-gradient(circle_at_top_left,#E8EDFF,transparent_36%),linear-gradient(135deg,#FBF9F7_0%,#FFFFFF_64%)] px-6 py-7 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4F5D83]">
            Join FlatOrigin
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            Create account
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
            Build a profile, save projects, post jobs, and connect directly around real project details.
          </p>
        </div>

        {registeredEmail ? (
          <div className="space-y-5 px-6 py-7 sm:px-8">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm leading-6 text-emerald-900">
              We sent a confirmation link to <span className="font-semibold">{registeredEmail}</span>. Open that email and confirm your account before logging in.
            </div>
            <p className="text-sm leading-6 text-slate-600">
              After confirmation, you can log in and finish your public profile or start a job post.
            </p>
            <Link
              to="/login"
              className="inline-flex w-full items-center justify-center rounded-xl bg-[#4F46E5] px-4 py-3 text-sm font-semibold text-white hover:bg-[#4338CA]"
            >
              Go to login
            </Link>
          </div>
        ) : (
          <div className="px-6 py-7 sm:px-8">
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Username
                </label>
                <Input
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  autoComplete="username"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Email
                </label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  autoComplete="email"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Password
                </label>
                <PasswordInput
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  autoComplete="new-password"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  I’m joining as
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label
                    className={[
                      "cursor-pointer rounded-2xl border px-4 py-4 transition",
                      form.profile_type === "homeowner"
                        ? "border-slate-900 bg-slate-50"
                        : "border-slate-200 bg-white hover:border-slate-300",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name="profile_type"
                      value="homeowner"
                      checked={form.profile_type === "homeowner"}
                      onChange={(e) => setForm({ ...form, profile_type: e.target.value })}
                      className="sr-only"
                      required
                    />
                    <div className="text-sm font-semibold text-slate-900">Homeowner</div>
                    <div className="mt-1 text-xs leading-5 text-slate-600">
                      Post projects, compare bids, and keep a private or public homeowner profile.
                    </div>
                  </label>

                  <label
                    className={[
                      "cursor-pointer rounded-2xl border px-4 py-4 transition",
                      form.profile_type === "contractor"
                        ? "border-slate-900 bg-slate-50"
                        : "border-slate-200 bg-white hover:border-slate-300",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name="profile_type"
                      value="contractor"
                      checked={form.profile_type === "contractor"}
                      onChange={(e) => setForm({ ...form, profile_type: e.target.value })}
                      className="sr-only"
                      required
                    />
                    <div className="text-sm font-semibold text-slate-900">Contractor</div>
                    <div className="mt-1 text-xs leading-5 text-slate-600">
                      Build a public profile, showcase work, and bid on posted jobs.
                    </div>
                  </label>
                </div>
              </div>

              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              ) : null}

              <Button type="submit" className="w-full bg-[#4F46E5] hover:bg-[#4338CA]">
                {loading ? "Creating..." : "Create account"}
              </Button>
            </form>

            <div className="mt-6 rounded-2xl border border-[#E9E5DC] bg-[#FBF9F7] p-4 text-sm leading-6 text-slate-600">
              FlatOrigin helps contractors keep their work in one public profile instead of scattered across social media, while giving homeowners a more targeted way to find real contractors with no middleman. Homeowners can compare, communicate, and ask specific questions before asking contractors to travel back and forth for inspections that may not be the right fit.
            </div>

            <div className="mt-5 text-center text-sm text-slate-500">
              Already have an account?{" "}
              <Link to="/login" className="font-medium text-slate-700 hover:text-slate-900">
                Log in
              </Link>
            </div>
          </div>
        )}
      </Card>

      <Card className="w-full max-w-2xl border-[#E6EDF7] bg-white p-6 shadow-sm sm:p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4F5D83]">
            Contractor directory
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            Submit a business listing
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            No account is required. Listings are reviewed before they appear publicly.
          </p>
        </div>

        <form onSubmit={submitDirectoryListing} className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Business / contractor name
            </label>
            <Input
              value={directoryForm.business_name}
              onChange={(e) => setDirectoryForm((prev) => ({ ...prev, business_name: e.target.value }))}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Specialized in
            </label>
            <div className="flex gap-2">
              <Input
                value={directoryForm.specialtyInput}
                onChange={(e) => setDirectoryForm((prev) => ({ ...prev, specialtyInput: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSpecialty();
                  }
                }}
                disabled={directoryForm.specialties.length >= 8}
                placeholder="Decks, tile, roofing..."
              />
              <button
                type="button"
                onClick={addSpecialty}
                disabled={directoryForm.specialties.length >= 8}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-300 text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                aria-label="Add specialty"
                title="Add specialty"
              >
                <SymbolIcon name="add" className="text-[22px]" />
              </button>
            </div>
            {directoryForm.specialties.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {directoryForm.specialties.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => removeSpecialty(item)}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    title="Remove specialty"
                  >
                    {item}
                    <SymbolIcon name="close" className="text-[14px]" />
                  </button>
                ))}
              </div>
            ) : null}
            <p className="mt-2 text-xs text-slate-500">{directoryForm.specialties.length}/8 specialties</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Phone number
              </label>
              <Input
                value={directoryForm.phone_number}
                onChange={(e) => setDirectoryForm((prev) => ({ ...prev, phone_number: e.target.value }))}
                placeholder="555-123-4567"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Website
              </label>
              <Input
                value={directoryForm.website}
                onChange={(e) => setDirectoryForm((prev) => ({ ...prev, website: e.target.value }))}
                placeholder="example.com"
              />
            </div>
          </div>

          {directoryError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {directoryError}
            </div>
          ) : null}
          {directorySuccess ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              {directorySuccess}
            </div>
          ) : null}

          <Button type="submit" className="w-full bg-slate-950 hover:bg-slate-800" disabled={directoryBusy}>
            {directoryBusy ? "Submitting..." : "Publish"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
