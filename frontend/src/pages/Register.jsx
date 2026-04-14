import { useState } from "react";
import { Link } from "react-router-dom";
import { register } from "../auth";
import { Card, Input, PasswordInput, Button } from "../ui";

export default function Register() {
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await register(form);
      setRegisteredEmail(form.email);
    } catch (err) {
      const data = err?.response?.data;
      if (data && typeof data === "object") {
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

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
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
    </div>
  );
}
