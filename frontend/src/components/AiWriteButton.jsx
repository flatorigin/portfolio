import { useState } from "react";
import api from "../api";
import { Button, SymbolIcon } from "../ui";

function normalizeAiError(err) {
  const data = err?.response?.data;
  if (typeof data === "string") return data;
  if (data?.detail) return data.detail;
  return err?.message || "AI helper is unavailable right now.";
}

export default function AiWriteButton({
  feature,
  payload,
  onApply,
  label = "Draft with AI",
  className = "",
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState(null);

  async function handleClick() {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/ai/assist/", {
        feature,
        ...payload,
      });
      onApply?.(data?.text || "");
      setMeta({
        model: data?.model || "",
        remaining: data?.remaining_today,
      });
    } catch (err) {
      setError(normalizeAiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={"space-y-1 " + className}>
      <Button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="gap-2 !bg-slate-800 hover:!bg-slate-900"
      >
        <SymbolIcon name="auto_awesome" className="text-[18px]" />
        {busy ? "Writing…" : label}
      </Button>
      {meta?.remaining !== undefined ? (
        <div className="text-[11px] text-slate-500">
          {meta.remaining} AI uses left today
        </div>
      ) : null}
      {error ? <div className="text-[11px] text-rose-600">{error}</div> : null}
    </div>
  );
}
