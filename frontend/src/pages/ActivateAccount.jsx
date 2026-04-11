import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api";
import { Card } from "../ui";

export default function ActivateAccount() {
  const { uid, token } = useParams();
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let cancelled = false;

    async function activate() {
      try {
        await api.post("/auth/users/activation/", { uid, token });
        if (!cancelled) setStatus("success");
      } catch (err) {
        if (!cancelled) setStatus("error");
      }
    }

    activate();

    return () => {
      cancelled = true;
    };
  }, [uid, token]);

  const content = {
    loading: {
      title: "Confirming your email",
      body: "We are verifying your account. This should only take a moment.",
    },
    success: {
      title: "Email confirmed",
      body: "Your account is active. You can log in and continue setting up your profile.",
    },
    error: {
      title: "Confirmation link did not work",
      body: "The link may be expired or already used. Try logging in, or create a new account if this was a new signup.",
    },
  }[status];

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-lg border-[#E6EDF7] bg-white p-7 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#EEF2FF] text-2xl font-semibold text-[#4F46E5]">
          {status === "success" ? "✓" : status === "error" ? "!" : "..."}
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">
          {content.title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{content.body}</p>
        <div className="mt-6">
          <Link
            to={status === "error" ? "/register" : "/login"}
            className="inline-flex w-full items-center justify-center rounded-xl bg-[#4F46E5] px-4 py-3 text-sm font-semibold text-white hover:bg-[#4338CA]"
          >
            {status === "error" ? "Back to register" : "Go to login"}
          </Link>
        </div>
      </Card>
    </div>
  );
}
