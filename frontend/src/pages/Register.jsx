import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api";
import { register } from "../auth";
import { Input, PasswordInput, Button, SymbolIcon } from "../ui";

export default function Register() {
  const [searchParams] = useSearchParams();
  const requestedRole = searchParams.get("role");
  const initialProfileType =
    requestedRole === "homeowner" || requestedRole === "contractor" ? requestedRole : "";
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    profile_type: initialProfileType,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [directoryForm, setDirectoryForm] = useState({
    business_name: "",
    location: "",
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
    if (!directoryForm.location.trim()) {
      setDirectoryError("Location is required.");
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
        location: directoryForm.location.trim(),
        specialties: uniqueSpecialties,
        phone_number: directoryForm.phone_number.trim(),
        website: directoryForm.website.trim(),
      });
      setDirectorySuccess(
        data?.message || "Thanks. Your listing was submitted and will be reviewed before publishing."
      );
      setDirectoryForm({
        business_name: "",
        location: "",
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

  const [activeTab, setActiveTab] = useState("register");

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl">
        {/* Tab Navigation */}
        <div className="mb-6 flex gap-2 rounded-2xl border border-white/60 bg-white/70 p-1.5 shadow-sm backdrop-blur-md">
          <button
            type="button"
            onClick={() => setActiveTab("register")}
            className={[
              "flex-1 rounded-xl px-4 py-3 text-sm font-medium transition",
              activeTab === "register"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:bg-white/80 hover:text-slate-900",
            ].join(" ")}
          >
            Create Account
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("listing")}
            className={[
              "flex-1 rounded-xl px-4 py-3 text-sm font-medium transition",
              activeTab === "listing"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:bg-white/80 hover:text-slate-900",
            ].join(" ")}
          >
            Submit Business Listing
          </button>
        </div>

        {/* Register Tab */}
        {activeTab === "register" && (
          <div className="overflow-hidden rounded-2xl border border-white/60 bg-white/70 shadow-sm backdrop-blur-md">
            <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white px-6 py-6 sm:px-8">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                Join FlatOrigin
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                Create account
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Build a profile, save projects, post jobs, and connect directly around real project details.
              </p>
            </div>

            {registeredEmail ? (
              <div className="px-6 py-7 sm:px-8 sm:py-8">
                <div className="flex items-start gap-4 border-b border-slate-200 pb-6">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                    <SymbolIcon name="mark_email_unread" className="text-[25px]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-700">
                      Account created
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-slate-950">Check your email</h2>
                    <p className="mt-2 break-words text-sm leading-6 text-slate-600">
                      We sent a confirmation link to <span className="font-semibold text-slate-900">{registeredEmail}</span>.
                    </p>
                  </div>
                </div>

                <div className="mt-6 border-l-4 border-blue-600 bg-blue-50 px-4 py-4">
                  <p className="text-sm font-semibold text-blue-950">Confirm before signing in</p>
                  <p className="mt-1 text-sm leading-6 text-blue-900">
                    Open the email and select <span className="font-semibold">Confirm email address</span>. Your account cannot be used until this step is complete.
                  </p>
                </div>

                <ol className="mt-6 space-y-3">
                  {[
                    "Open the confirmation email from FlatOrigin.",
                    "Select the confirmation button in the email.",
                    "Return here and sign in to your account.",
                  ].map((step, index) => (
                    <li key={step} className="flex items-start gap-3 text-sm leading-6 text-slate-600">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>

                <p className="mt-6 text-sm leading-6 text-slate-500">
                  The email may take a minute to arrive. Check your spam or promotions folder if you do not see it.
                </p>

                <Link
                  to="/login"
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  I confirmed my email - sign in
                  <SymbolIcon name="arrow_forward" className="text-[18px]" />
                </Link>
              </div>
            ) : (
              <div className="px-6 py-6 sm:px-8">
                <form onSubmit={submit} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Username
                    </label>
                    <Input
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                      autoComplete="username"
                      className="rounded-xl border-slate-200"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Email
                    </label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      autoComplete="email"
                      className="rounded-xl border-slate-200"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Password
                    </label>
                    <PasswordInput
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      autoComplete="new-password"
                      className="rounded-xl border-slate-200"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      I&apos;m joining as
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label
                        className={[
                          "cursor-pointer rounded-2xl border px-4 py-4 transition",
                          form.profile_type === "homeowner"
                            ? "border-slate-400 bg-slate-100"
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
                            ? "border-slate-400 bg-slate-100"
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

                  <div className="flex gap-3 border-l-4 border-blue-500 bg-blue-50 px-4 py-3 text-blue-950">
                    <SymbolIcon name="outgoing_mail" className="mt-0.5 shrink-0 text-[21px] text-blue-700" />
                    <div>
                      <p className="text-sm font-semibold">Email confirmation required</p>
                      <p className="mt-0.5 text-xs leading-5 text-blue-900">
                        After creating your account, check your email and confirm your address before signing in.
                      </p>
                    </div>
                  </div>

                  <Button type="submit" className="h-11 w-full rounded-xl bg-slate-900 text-sm font-medium hover:bg-slate-800">
                    {loading ? "Creating..." : "Create account"}
                  </Button>
                </form>

                <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-sm leading-6 text-slate-600">
                  FlatOrigin helps contractors keep their work in one public profile instead of scattered across social media, while giving homeowners a more targeted way to find real contractors with no middleman.
                </div>

                <div className="mt-5 text-center text-sm text-slate-500">
                  Already have an account?{" "}
                  <Link to="/login" className="font-medium text-slate-700 hover:text-slate-900">
                    Log in
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Business Listing Tab */}
        {activeTab === "listing" && (
          <div className="overflow-hidden rounded-2xl border border-white/60 bg-white/70 shadow-sm backdrop-blur-md">
            <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white px-6 py-6 sm:px-8">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                Contractor Directory
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                Submit a business listing
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                No account is required. Listings are reviewed before they appear publicly.
              </p>
            </div>

            <div className="px-6 py-6 sm:px-8">
              <form onSubmit={submitDirectoryListing} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Business / contractor name
                  </label>
                  <Input
                    value={directoryForm.business_name}
                    onChange={(e) => setDirectoryForm((prev) => ({ ...prev, business_name: e.target.value }))}
                    className="rounded-xl border-slate-200"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Location
                  </label>
                  <Input
                    value={directoryForm.location}
                    onChange={(e) => setDirectoryForm((prev) => ({ ...prev, location: e.target.value }))}
                    placeholder="City, State or ZIP code"
                    className="rounded-xl border-slate-200"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
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
                      className="rounded-xl border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={addSpecialty}
                      disabled={directoryForm.specialties.length >= 8}
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
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
                          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
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
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Phone number
                    </label>
                    <Input
                      value={directoryForm.phone_number}
                      onChange={(e) => setDirectoryForm((prev) => ({ ...prev, phone_number: e.target.value }))}
                      placeholder="555-123-4567"
                      className="rounded-xl border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Website
                    </label>
                    <Input
                      value={directoryForm.website}
                      onChange={(e) => setDirectoryForm((prev) => ({ ...prev, website: e.target.value }))}
                      placeholder="example.com"
                      className="rounded-xl border-slate-200"
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

                <Button type="submit" className="h-11 w-full rounded-xl bg-slate-900 text-sm font-medium hover:bg-slate-800" disabled={directoryBusy}>
                  {directoryBusy ? "Submitting..." : "Submit listing"}
                </Button>
              </form>

              <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-sm leading-6 text-slate-600">
                Want full control over your listing? <button type="button" onClick={() => setActiveTab("register")} className="font-medium text-slate-700 hover:text-slate-900">Create an account</button> to manage your profile, add project photos, and receive direct messages.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
