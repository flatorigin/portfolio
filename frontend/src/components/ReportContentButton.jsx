import { useState } from "react";
import api from "../api";

const REPORT_OPTIONS = [
  ["safety", "Safety concern"],
  ["fraud", "Fraud or scam"],
  ["impersonation", "Impersonation"],
  ["harassment", "Harassment or abuse"],
  ["spam", "Spam"],
  ["copyright", "Copyright issue"],
  ["child_safety", "Child safety"],
  ["illegal_content", "Illegal content"],
  ["other", "Other"],
];

export default function ReportContentButton({
  targetType,
  targetId,
  label = "Report",
  className = "",
  defaultReportType = "other",
  subject = "",
}) {
  const [open, setOpen] = useState(false);
  const [reportType, setReportType] = useState(defaultReportType);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const isAuthed = !!localStorage.getItem("access");

  async function submitReport(event) {
    event.preventDefault();
    if (!isAuthed || !targetType || !targetId) return;

    setBusy(true);
    setError("");
    try {
      await api.post("/reports/", {
        target_type: targetType,
        target_id: targetId,
        report_type: reportType,
        subject,
        details,
        source_url: window.location.href,
      });
      setSubmitted(true);
      setDetails("");
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "Could not submit this report.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!isAuthed) {
            alert("Log in to report content.");
            return;
          }
          setOpen(true);
          setSubmitted(false);
          setError("");
        }}
        className={className}
      >
        {submitted ? "Reported" : label}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <div className="text-base font-semibold text-slate-900">Report content</div>
            <div className="mt-1 text-sm text-slate-500">
              This goes to the internal review queue.
            </div>

            {submitted ? (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Your report has been submitted.
              </div>
            ) : (
              <form className="mt-4 space-y-4" onSubmit={submitReport}>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Reason</label>
                  <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    {REPORT_OPTIONS.map(([value, optionLabel]) => (
                      <option key={value} value={value}>
                        {optionLabel}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Details
                  </label>
                  <textarea
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="Add any context that will help the review."
                    className="min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                {error ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
                  >
                    {busy ? "Submitting..." : "Submit report"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
