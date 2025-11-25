import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api";
import { Card, Input, Button } from "../ui";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const uid = params.get("uid");
  const token = params.get("token");

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== password2) {
      setError("Passwords do not match.");
      return;
    }

    try {
      await api.post("/auth/password-reset-confirm/", {
        uid,
        token,
        new_password: password,
      });
      setDone(true);
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          "This reset link is invalid or expired."
      );
    }
  };

  if (!uid || !token) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-md p-6">
          <p className="text-sm text-red-600">
            Invalid reset link. Please request a new one.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md p-6">
        <h1 className="mb-2 text-xl font-semibold">Set a new password</h1>
        {done ? (
          <p className="text-sm text-slate-700">
            Your password has been reset. You can now log in with your new
            password.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                New password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Confirm password
              </label>
              <Input
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <Button type="submit" className="w-full">
              Save new password
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
