import ResendConfirmation from "../components/ResendConfirmation";
// frontend/src/pages/Login.jsx
import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { login } from "../auth";
import { Card, Input, PasswordInput, Button } from "../ui";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedNext = searchParams.get("next") || "";
  const safeNext = requestedNext.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : "/dashboard";
  const registerPath = safeNext !== "/dashboard"
    ? `/register?next=${encodeURIComponent(safeNext)}`
    : "/register";

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await login({
        username,
        password,
      });
      navigate(safeNext);
    } catch (err) {
      setError(err?.response?.status === 401
        ? "We couldn’t sign you in. Check your username and password. If you haven’t confirmed your email yet, use the resend option below."
        : "Sign-in could not be completed. Please try again shortly.");
    }
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md p-6">
        <h1 className="mb-4 text-xl font-semibold">Log in</h1>
        {searchParams.get("activated") === "1" && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Email confirmed. You can now sign in with your username and password.</p>}
        {searchParams.get("activation_error") === "1" && <p role="alert" className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">This confirmation link is invalid or expired. If you already confirmed your email, sign in. Otherwise, request a new link below.</p>}
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Username
            </label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-700">
                Password
              </label>

              <Link
                to="/forgot-password"
                className="text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                Forgot password?
              </Link>
            </div>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <Button type="submit" className="w-full">
            Log in
          </Button>
        </form>

        <ResendConfirmation expanded={searchParams.get("activation_error") === "1"} />

        <div className="mt-3 text-center text-xs text-slate-500">
          Don't have an account?{" "}
          <Link
            to={registerPath}
            className="text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            Sign up
          </Link>
        </div>
      </Card>
    </div>
  );
}
