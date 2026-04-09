import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register } from "../auth";
import { Card, Input, Button } from "../ui";

export default function Register() {
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await register(form);
      navigate("/profile/edit");
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
      <Card className="w-full max-w-md border-[#E6EDF7] p-6 sm:p-7">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">Create account</h1>
          <p className="mt-2 text-sm text-slate-500">
            Set up your account to build a profile, save projects, and connect directly with contractors.
          </p>
        </div>

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
            <Input
              type="password"
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

          <Button type="submit" className="w-full">
            {loading ? "Creating..." : "Create account"}
          </Button>
        </form>

        <div className="mt-5 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-slate-700 hover:text-slate-900">
            Log in
          </Link>
        </div>
      </Card>
    </div>
  );
}
