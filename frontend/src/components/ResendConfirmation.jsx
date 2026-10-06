import { useEffect, useId, useRef, useState } from "react";
import api from "../api";

export default function ResendConfirmation({ initialEmail = "", expanded = false }) {
  const [open, setOpen] = useState(expanded || !!initialEmail);
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const id = useId();
  useEffect(() => {
    if (!remaining) return;
    const timer = setTimeout(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  async function resend(event) {
    event.preventDefault();
    if (inFlight.current || remaining) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api.post("/auth/users/resend_activation/", { email: email.trim() });
      setMessage("If this address has an account awaiting confirmation, a new link has been sent. Check your inbox and spam folder. Already confirmed? You can sign in.");
      setRemaining(60);
    } catch (err) {
      if (err?.response?.status === 429) {
        const retryAfter = Number(err.response.headers?.["retry-after"]);
        setRemaining(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : 60);
        setError("Too many requests. Please wait for the countdown before trying again.");
      } else {
        setError("We couldn’t send the confirmation request. Please try again shortly.");
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 border-t border-stone-200 pt-4 text-left">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)} className="text-sm font-medium text-stone-700 underline underline-offset-4 hover:text-stone-900">
        Resend confirmation email
      </button>
      {open && <form id={id} onSubmit={resend} className="mt-3 space-y-3">
        <label htmlFor={`${id}-email`} className="block text-sm text-stone-600">Email used to sign up</label>
        <input id={`${id}-email`} type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900" />
        <button type="submit" disabled={busy || remaining > 0} className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? "Sending…" : remaining ? `Resend in ${remaining}s` : "Send confirmation link"}
        </button>
        {message && <p role="status" className="text-sm text-stone-600">{message}</p>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      </form>}
    </div>
  );
}
