import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";

function formatStamp(value) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleString();
}

function normalizeError(err, fallback) {
  const data = err?.response?.data;

  if (typeof data === "string") {
    const trimmed = data.trim().toLowerCase();
    if (trimmed.startsWith("<!doctype") || trimmed.startsWith("<html")) return fallback;
    return data;
  }

  if (data && typeof data === "object") {
    const first = Object.values(data)[0];
    if (Array.isArray(first) && first.length) return String(first[0]);
    if (typeof first === "string") return first;
  }

  return data?.detail || data?.message || err?.message || fallback;
}

function statusLabel(status) {
  const value = String(status || "").toLowerCase();
  if (value === "revision_requested") return "Revision Requested";
  if (!value) return "Pending";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function statusBadgeClass(status) {
  const value = String(status || "").toLowerCase();
  if (value === "accepted") return "!bg-indigo-600 !text-white";
  if (value === "declined") return "bg-rose-100 text-rose-700";
  if (value === "withdrawn") return "bg-slate-200 text-slate-700";
  if (value === "revision_requested") return "bg-sky-100 text-sky-700";
  return "bg-amber-100 text-amber-800";
}

function bidAmountLabel(bid) {
  return bid?.display_amount || "—";
}

function compareFieldRows(leftBid, rightBid) {
  return [
    { label: "Contractor", render: (bid) => bid?.contractor_name || bid?.contractor_username || "Contractor" },
    { label: "Status", render: (bid) => statusLabel(bid?.status) },
    { label: "Price type", render: (bid) => (bid?.price_type === "range" ? "Estimate range" : "Fixed price") },
    { label: "Amount", render: (bid) => bidAmountLabel(bid) },
    { label: "Estimated timeline", render: (bid) => bid?.timeline_text || "—" },
    { label: "Proposal", render: (bid) => bid?.proposal_text || bid?.message || "—" },
    { label: "What’s included", render: (bid) => bid?.included_text || "—" },
    { label: "What’s excluded", render: (bid) => bid?.excluded_text || "—" },
    { label: "Payment terms", render: (bid) => bid?.payment_terms || "—" },
    { label: "Valid until", render: (bid) => bid?.valid_until || "—" },
    { label: "Submitted", render: (bid) => formatStamp(bid?.updated_at || bid?.created_at) || "—" },
    { label: "Attachment", render: (bid) => (bid?.attachment_url ? "Available" : "—") },
  ].map((row) => ({
    ...row,
    different: String(row.render(leftBid) || "") !== String(row.render(rightBid) || ""),
  }));
}

function emptyForm() {
  return {
    price_type: "fixed",
    amount: "",
    amount_min: "",
    amount_max: "",
    timeline_text: "",
    proposal_text: "",
    included_text: "",
    excluded_text: "",
    payment_terms: "",
    valid_until: "",
    attachment: null,
  };
}

function bidToForm(bid) {
  return {
    price_type: bid?.price_type || "fixed",
    amount: bid?.amount == null ? "" : String(bid.amount),
    amount_min: bid?.amount_min == null ? "" : String(bid.amount_min),
    amount_max: bid?.amount_max == null ? "" : String(bid.amount_max),
    timeline_text: bid?.timeline_text || "",
    proposal_text: bid?.proposal_text || bid?.message || "",
    included_text: bid?.included_text || "",
    excluded_text: bid?.excluded_text || "",
    payment_terms: bid?.payment_terms || "",
    valid_until: bid?.valid_until || "",
    attachment: null,
  };
}

function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div className="text-lg font-semibold text-slate-900">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, helper, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-800">{label}</label>
      {children}
      {helper ? <p className="text-xs text-slate-500">{helper}</p> : null}
    </div>
  );
}

export default function BidModule({ projectId, ownerUsername }) {
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionBusyId, setActionBusyId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingBidId, setEditingBidId] = useState(null);
  const [detailBid, setDetailBid] = useState(null);
  const [compareIds, setCompareIds] = useState([]);
  const [ownerNotes, setOwnerNotes] = useState({});
  const [ownerAction, setOwnerAction] = useState({});
  const [form, setForm] = useState(emptyForm());

  const authed = !!localStorage.getItem("access");
  const myUsername = (localStorage.getItem("username") || "").toLowerCase();
  const isOwner = (ownerUsername || "").toLowerCase() === myUsername;

  async function loadBids() {
    if (!projectId) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/projects/${projectId}/bids/`);
      const nextBids = Array.isArray(data) ? data : [];
      setBids(nextBids);
      setOwnerNotes((prev) => {
        const next = { ...prev };
        for (const bid of nextBids) {
          if (next[String(bid.id)] === undefined) next[String(bid.id)] = bid.owner_response_note || "";
        }
        return next;
      });
    } catch (err) {
      setError(normalizeError(err, "Server error while loading bids."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBids();
  }, [projectId]);

  const myBid = useMemo(() => {
    if (!myUsername) return null;
    return bids.find((b) => (b.contractor_username || "").toLowerCase() === myUsername) || null;
  }, [bids, myUsername]);

  const hasAcceptedBid = useMemo(
    () => bids.some((bid) => String(bid.status || "").toLowerCase() === "accepted"),
    [bids]
  );

  const compareBids = useMemo(
    () => compareIds.map((id) => bids.find((bid) => bid.id === id)).filter(Boolean).slice(0, 2),
    [bids, compareIds]
  );

  const compareRows = useMemo(() => {
    if (compareBids.length !== 2) return [];
    return compareFieldRows(compareBids[0], compareBids[1]);
  }, [compareBids]);

  function toggleCompareBid(bidId) {
    setCompareIds((prev) => {
      if (prev.includes(bidId)) return prev.filter((id) => id !== bidId);
      if (prev.length >= 2) return prev;
      return [...prev, bidId];
    });
  }

  function openCreateModal() {
    setEditingBidId(null);
    setForm(emptyForm());
    setError("");
    setSuccess("");
    setFormOpen(true);
  }

  function openEditModal(bid) {
    setEditingBidId(bid.id);
    setForm(bidToForm(bid));
    setError("");
    setSuccess("");
    setFormOpen(true);
  }

  function closeModal() {
    setFormOpen(false);
    setEditingBidId(null);
    setForm(emptyForm());
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!projectId) return setError("Missing project.");
    if (!authed) return setError("Please log in to submit a bid.");

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("price_type", form.price_type);
      if (form.price_type === "fixed") {
        fd.append("amount", form.amount);
      } else {
        fd.append("amount_min", form.amount_min);
        fd.append("amount_max", form.amount_max);
      }
      fd.append("timeline_text", form.timeline_text);
      fd.append("proposal_text", form.proposal_text);
      fd.append("included_text", form.included_text);
      fd.append("excluded_text", form.excluded_text);
      fd.append("payment_terms", form.payment_terms);
      fd.append("valid_until", form.valid_until);
      if (form.attachment) fd.append("attachment", form.attachment);

      if (editingBidId) {
        await api.post(`/bids/${editingBidId}/revise/`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setSuccess("Bid updated.");
      } else {
        await api.post(`/projects/${projectId}/bids/`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setSuccess("Bid submitted.");
      }

      closeModal();
      await loadBids();
    } catch (err) {
      setError(normalizeError(err, "Server error while submitting bid."));
    } finally {
      setSubmitting(false);
    }
  }

  async function runAction(bidId, action) {
    setError("");
    setSuccess("");
    setActionBusyId(bidId);
    try {
      const note = ownerNotes[String(bidId)] || "";
      let payload = {};
      if (action === "decline") payload = { owner_response_note: note };
      if (action === "request-revision") payload = { revision_note: note };
      if (action === "reopen") payload = { reopen_note: note };
      await api.post(`/bids/${bidId}/${action}/`, payload);
      setSuccess("Bid updated.");
      setOwnerAction((prev) => ({ ...prev, [String(bidId)]: "" }));
      await loadBids();
    } catch (err) {
      setError(normalizeError(err, `Server error while trying to ${action} bid.`));
    } finally {
      setActionBusyId(null);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{isOwner ? "Project Bids" : "Your Bid"}</h3>
          <p className="text-sm text-slate-500">
            {isOwner ? "Review submitted bids for this project." : "Submit one bid for this project."}
          </p>
        </div>
        <button
          type="button"
          onClick={loadBids}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {loading ? <div className="mb-4 text-sm text-slate-500">Loading bids...</div> : null}
      {error ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {success ? <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div> : null}

      {isOwner ? (
        <div className="space-y-3">
          {bids.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              No bids submitted yet.
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Bid queue</div>
                    <div className="text-sm text-slate-500">Select up to 2 bids to compare side by side. Up to 6 slots stay visible here.</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      {compareBids.length} of 2 selected
                    </span>
                    {compareIds.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setCompareIds([])}
                        className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-white"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {bids.slice(0, 6).map((bid) => {
                    const selected = compareIds.includes(bid.id);
                    return (
                      <button
                        key={`compare-${bid.id}`}
                        type="button"
                        onClick={() => toggleCompareBid(bid.id)}
                        className={
                          "rounded-2xl border p-4 text-left transition " +
                          (selected
                            ? "border-indigo-400 bg-indigo-50 shadow-sm"
                            : "border-slate-200 bg-white hover:border-slate-300")
                        }
                        aria-pressed={selected ? "true" : "false"}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-900">
                              {bid.contractor_name || bid.contractor_username || "Contractor"}
                            </div>
                            <div className="mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
                              {statusLabel(bid.status)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-slate-500">{bid.price_type === "range" ? "Range" : "Fixed"}</div>
                            <div className="text-sm font-semibold text-slate-900">{bidAmountLabel(bid)}</div>
                          </div>
                        </div>
                        <div className="mt-3 text-xs text-slate-500">
                          {bid.timeline_text || "No timeline added"}
                        </div>
                        <div className="mt-2 text-xs font-medium uppercase tracking-wide text-indigo-700">
                          {selected ? "Selected for compare" : "Select to compare"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {compareBids.length === 2 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <div className="text-base font-semibold text-slate-900">Bid comparison</div>
                      <div className="text-sm text-slate-500">Review both bids against the same fields before taking action.</div>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)]">
                    <div className="hidden lg:block" />
                    {compareBids.map((bid) => (
                      <div key={`compare-head-${bid.id}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-base font-semibold text-slate-900">
                              {bid.contractor_name || bid.contractor_username || "Contractor"}
                            </div>
                            <div className="mt-1 text-sm text-slate-500">{bidAmountLabel(bid)}</div>
                          </div>
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(bid.status)}`}>
                            {statusLabel(bid.status)}
                          </span>
                        </div>
                      </div>
                    ))}

                    {compareRows.map((row) => (
                      <div key={row.label} className="contents">
                        <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 lg:bg-transparent lg:px-0">
                          {row.label}
                        </div>
                        {compareBids.map((bid) => (
                          <div
                            key={`${row.label}-${bid.id}`}
                            className={
                              "rounded-xl border px-4 py-3 text-sm text-slate-700 " +
                              (row.different ? "border-indigo-200 bg-indigo-50/60" : "border-slate-200 bg-white")
                            }
                          >
                            {row.label === "Attachment" && bid?.attachment_url ? (
                              <a href={bid.attachment_url} target="_blank" rel="noreferrer" className="font-medium text-sky-700 hover:underline">
                                View attachment
                              </a>
                            ) : (
                              <div className="whitespace-pre-wrap break-words">{row.render(bid)}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}

                    <div className="hidden lg:block" />
                    {compareBids.map((bid) => {
                      const status = String(bid.status || "").toLowerCase();
                      const isActive = status === "pending" || status === "revision_requested";
                      return (
                        <div key={`compare-actions-${bid.id}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                          <div className="flex flex-wrap gap-2">
                            {isActive ? (
                              <button type="button" disabled={actionBusyId === bid.id} onClick={() => runAction(bid.id, "accept")} className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60">
                                {actionBusyId === bid.id ? "Working..." : "Accept"}
                              </button>
                            ) : null}
                            {isActive ? (
                              <button type="button" onClick={() => setOwnerAction((prev) => ({ ...prev, [String(bid.id)]: prev[String(bid.id)] === "request-revision" ? "" : "request-revision" }))} className="rounded-xl border border-sky-300 px-4 py-2 text-sm font-medium text-sky-700 hover:bg-sky-50">
                                Request Revision
                              </button>
                            ) : null}
                            {isActive ? (
                              <button type="button" onClick={() => setOwnerAction((prev) => ({ ...prev, [String(bid.id)]: prev[String(bid.id)] === "decline" ? "" : "decline" }))} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                                Decline Bid
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => setDetailBid(bid)}
                              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            >
                              View full bid
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {bids.map((bid) => {
              const actionState = ownerAction[String(bid.id)] || "";
              const status = String(bid.status || "").toLowerCase();
              const isActive = status === "pending" || status === "revision_requested";
              const isAccepted = status === "accepted";
              const noteLabel =
                actionState === "request-revision" ? "Revision note" : actionState === "reopen" ? "Reopen note" : "Reason (optional)";
              const notePlaceholder =
                actionState === "request-revision"
                  ? "Explain what needs to be changed before you can review this bid again."
                  : actionState === "reopen"
                  ? "Explain why you are reopening this bid and what you want the contractor to review again."
                  : "Add a short explanation for why this bid is being declined.";

              return (
                <div
                  key={bid.id}
                  className="cursor-pointer rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-indigo-200 hover:shadow-sm"
                  onClick={() => setDetailBid(bid)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setDetailBid(bid);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      {bid.contractor_username ? (
                        <Link
                          to={`/profiles/${bid.contractor_username}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-sm font-semibold text-sky-700 hover:underline"
                        >
                          {bid.contractor_name || bid.contractor_username}
                        </Link>
                      ) : (
                        <div className="text-sm font-semibold text-slate-900">{bid.contractor_name || `Contractor #${bid.contractor}`}</div>
                      )}
                      <div className="mt-1">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(status)}`}>
                          {statusLabel(status)}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm text-slate-500">{bid.price_type === "range" ? "Estimate range" : "Fixed price"}</div>
                      <div className="text-lg font-bold text-slate-900">{bid.display_amount || "—"}</div>
                    </div>
                  </div>

                  {bid.timeline_text ? <div className="mt-3 text-sm text-slate-700"><span className="font-medium text-slate-900">Estimated timeline:</span> {bid.timeline_text}</div> : null}
                  {bid.proposal_text ? <div className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{bid.proposal_text}</div> : null}
                  {bid.owner_response_note ? <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">{bid.owner_response_note}</div> : null}
                  <div className="mt-3 text-xs font-medium uppercase tracking-wide text-indigo-700">
                    Click to view full bid
                  </div>

                  {status !== "withdrawn" ? (
                    <div
                      className="mt-4 space-y-3"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      {!isAccepted ? (
                        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
                          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
                            Acceptance
                          </div>
                          <div className="mb-2">
                            Accepted by: <span className="font-semibold">{ownerUsername || "Project owner"}</span>
                          </div>
                          <div className="space-y-2 text-[13px] leading-relaxed text-indigo-900">
                            <p>
                              By accepting this bid, you confirm that you agree to the general terms, scope, and pricing outlined by the contractor.
                            </p>
                            <p>
                              This acceptance indicates your intent to proceed with the contractor; however, it does not constitute a legally binding contract. No formal agreement is created through this platform alone.
                            </p>
                            <p>
                              Any final agreement, including detailed scope, payment terms, schedule, permits, and legal obligations, must be discussed and confirmed directly between the project owner and the contractor outside of this platform.
                            </p>
                            <p>
                              The platform acts only as a facilitator for introductions and proposals and is not responsible for the execution, enforcement, or outcome of any agreement between the parties.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                            Reopen Job Posting
                          </div>
                          <div className="space-y-2 text-[13px] leading-relaxed text-emerald-900">
                            <p>
                              Reopening this job posting removes the awarded state and makes the project open for bidding again.
                            </p>
                            <p>
                              The accepted contractor will be notified and their bid will move back to revision requested.
                            </p>
                          </div>
                        </div>
                      )}

                      {actionState ? (
                        <Field label={noteLabel}>
                          <textarea
                            rows={3}
                            value={ownerNotes[String(bid.id)] || ""}
                            onChange={(e) => setOwnerNotes((prev) => ({ ...prev, [String(bid.id)]: e.target.value }))}
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                            placeholder={notePlaceholder}
                          />
                        </Field>
                      ) : null}

                      <div className="flex flex-wrap gap-2">
                        {isActive ? (
                          <button type="button" disabled={actionBusyId === bid.id} onClick={() => runAction(bid.id, "accept")} className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60">
                            {actionBusyId === bid.id ? "Working..." : "Accept"}
                          </button>
                        ) : null}
                        {isActive ? (
                          <button type="button" onClick={() => setOwnerAction((prev) => ({ ...prev, [String(bid.id)]: prev[String(bid.id)] === "request-revision" ? "" : "request-revision" }))} className="rounded-xl border border-sky-300 px-4 py-2 text-sm font-medium text-sky-700 hover:bg-sky-50">
                            Request Revision
                          </button>
                        ) : null}
                        {isActive ? (
                          <button type="button" onClick={() => setOwnerAction((prev) => ({ ...prev, [String(bid.id)]: prev[String(bid.id)] === "decline" ? "" : "decline" }))} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                            Decline Bid
                          </button>
                        ) : null}
                        {status === "declined" ? (
                          <button type="button" onClick={() => setOwnerAction((prev) => ({ ...prev, [String(bid.id)]: prev[String(bid.id)] === "reopen" ? "" : "reopen" }))} className="rounded-xl border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50">
                            Reopen Bid
                          </button>
                        ) : null}
                        {isAccepted ? (
                          <button type="button" onClick={() => setOwnerAction((prev) => ({ ...prev, [String(bid.id)]: prev[String(bid.id)] === "reopen" ? "" : "reopen" }))} className="rounded-xl border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50">
                            Reopen Job Post
                          </button>
                        ) : null}
                        {actionState === "request-revision" ? (
                          <button type="button" disabled={actionBusyId === bid.id} onClick={() => runAction(bid.id, "request-revision")} className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60">
                            {actionBusyId === bid.id ? "Working..." : "Send Revision Request"}
                          </button>
                        ) : null}
                        {actionState === "decline" ? (
                          <button type="button" disabled={actionBusyId === bid.id} onClick={() => runAction(bid.id, "decline")} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60">
                            {actionBusyId === bid.id ? "Working..." : "Confirm Decline"}
                          </button>
                        ) : null}
                        {actionState === "reopen" ? (
                          <button type="button" disabled={actionBusyId === bid.id} onClick={() => runAction(bid.id, "reopen")} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
                            {actionBusyId === bid.id ? "Working..." : isAccepted ? "Confirm Reopen Job Post" : "Confirm Reopen"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
            </>
          )}
        </div>
      ) : !authed ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Log in to submit a bid for this job posting.
        </div>
      ) : (
        <div className="space-y-4">
          {myBid ? (
            <button
              type="button"
              onClick={() => setDetailBid(myBid)}
              className="w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-indigo-200 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  {ownerUsername ? (
                    <div className="text-sm">
                      <span className="text-slate-500">Owner: </span>
                      <Link
                        to={`/profiles/${ownerUsername}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold text-sky-700 hover:underline"
                      >
                        {ownerUsername}
                      </Link>
                    </div>
                  ) : (
                    <div className="text-sm font-semibold text-slate-900">Your current bid</div>
                  )}
                  <div className="mt-1">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(myBid.status)}`}>
                      {statusLabel(myBid.status)}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-500">{myBid.price_type === "range" ? "Estimate range" : "Fixed price"}</div>
                  <div className="text-lg font-bold text-slate-900">{myBid.display_amount || "—"}</div>
                </div>
              </div>

              {myBid.proposal_text || myBid.message ? (
                <div className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
                  {myBid.proposal_text || myBid.message}
                </div>
              ) : null}
              {String(myBid.status || "").toLowerCase() !== "accepted" && myBid.owner_response_note ? (
                <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  {myBid.owner_response_note}
                </div>
              ) : null}
              <div className="mt-3 text-xs font-medium uppercase tracking-wide text-indigo-700">
                Click to view full bid
              </div>

              {["pending", "revision_requested"].includes(String(myBid.status || "").toLowerCase()) ? (
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    disabled={actionBusyId === myBid.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(myBid);
                    }}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Revise Bid
                  </button>
                  <button
                    type="button"
                    disabled={actionBusyId === myBid.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      runAction(myBid.id, "withdraw");
                    }}
                    className="rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                  >
                    {actionBusyId === myBid.id ? "Working..." : "Withdraw Bid"}
                  </button>
                </div>
              ) : null}
            </button>
          ) : (
            <div className="flex justify-end">
              <button type="button" onClick={openCreateModal} disabled={hasAcceptedBid} className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60">
                Send Bid
              </button>
            </div>
          )}

          {hasAcceptedBid && !myBid ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              This job posting has already been awarded and is closed to new bids.
            </div>
          ) : null}
        </div>
      )}

      <Modal open={formOpen} onClose={closeModal} title={editingBidId ? "Revise Your Bid" : "Submit Your Bid"}>
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="font-semibold">Important:</div>
          <div>Submitting a bid does not create a final legal contract. It is a proposal for review and agreement between both sides.</div>
        </div>

        <div className="mb-6 text-sm text-slate-600">
          Send a clear proposal for this job. Keep it specific, realistic, and easy for the owner to review.
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="Price type">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm">
                <input type="radio" name="price_type" value="fixed" checked={form.price_type === "fixed"} onChange={(e) => setForm((prev) => ({ ...prev, price_type: e.target.value }))} />
                <span>Fixed price</span>
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm">
                <input type="radio" name="price_type" value="range" checked={form.price_type === "range"} onChange={(e) => setForm((prev) => ({ ...prev, price_type: e.target.value }))} />
                <span>Estimate range</span>
              </label>
            </div>
          </Field>

          {form.price_type === "fixed" ? (
            <Field label="Bid amount" helper="Enter the total amount you would charge for this job.">
              <input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Example: 4500" />
            </Field>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Minimum amount" helper="Use a range if the final cost depends on site conditions, material choices, or hidden issues.">
                <input type="number" min="0" step="0.01" value={form.amount_min} onChange={(e) => setForm((prev) => ({ ...prev, amount_min: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Example: 4000" />
              </Field>
              <Field label="Maximum amount">
                <input type="number" min="0" step="0.01" value={form.amount_max} onChange={(e) => setForm((prev) => ({ ...prev, amount_max: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Example: 5500" />
              </Field>
            </div>
          )}

          <Field label="Estimated timeline" helper="Give a realistic timeframe for completing the work.">
            <input type="text" value={form.timeline_text} onChange={(e) => setForm((prev) => ({ ...prev, timeline_text: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Example: 2–3 weeks" />
          </Field>
          <Field label="Proposal" helper="This is your main message to the owner. Explain how you would handle the project.">
            <textarea rows={5} value={form.proposal_text} onChange={(e) => setForm((prev) => ({ ...prev, proposal_text: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Describe your approach, understanding of the job, and anything the owner should know before choosing your bid." />
          </Field>
          <Field label="What’s included" helper="List the work, services, or materials covered by this bid.">
            <textarea rows={4} value={form.included_text} onChange={(e) => setForm((prev) => ({ ...prev, included_text: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Example: labor, installation, standard materials, site cleanup" />
          </Field>
          <Field label="What’s excluded" helper="Clarify anything not covered so expectations are clear.">
            <textarea rows={4} value={form.excluded_text} onChange={(e) => setForm((prev) => ({ ...prev, excluded_text: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Example: permit fees, specialty finishes, hidden damage repair" />
          </Field>
          <Field label="Payment terms" helper="Explain how and when payment would be handled.">
            <textarea rows={4} value={form.payment_terms} onChange={(e) => setForm((prev) => ({ ...prev, payment_terms: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Example: 30% deposit, 40% during work, 30% on completion" />
          </Field>
          <Field label="Bid valid until" helper="Set the date until this bid remains valid.">
            <input type="date" value={form.valid_until} onChange={(e) => setForm((prev) => ({ ...prev, valid_until: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </Field>
          <Field label="Attachment (optional)" helper="Upload a quote, estimate sheet, reference document, or supporting file.">
            <input type="file" onChange={(e) => setForm((prev) => ({ ...prev, attachment: e.target.files?.[0] || null }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={closeModal} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={submitting} className="rounded-xl bg-sky-600 px-5 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60">
              {submitting ? "Submitting..." : "Submit Bid"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!detailBid} onClose={() => setDetailBid(null)} title="Bid Details">
        {detailBid ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <div>
                  Owner:{" "}
                  {ownerUsername ? (
                    <Link to={`/profiles/${ownerUsername}`} className="font-semibold text-sky-700 hover:underline">
                      {ownerUsername}
                    </Link>
                  ) : (
                    <span className="font-semibold">Project owner</span>
                  )}
                </div>
                <div>
                  Contractor:{" "}
                  <span className="font-semibold">
                    {detailBid.contractor_name || detailBid.contractor_username || "Contractor"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="mt-2">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(detailBid.status)}`}>
                    {statusLabel(detailBid.status)}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-slate-500">
                  {detailBid.price_type === "range" ? "Estimate range" : "Fixed price"}
                </div>
                <div className="text-lg font-bold text-slate-900">{detailBid.display_amount || "—"}</div>
              </div>
            </div>

            {detailBid.timeline_text ? (
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Estimated timeline
                </div>
                <div className="text-sm text-slate-700">{detailBid.timeline_text}</div>
              </div>
            ) : null}

            {detailBid.proposal_text || detailBid.message ? (
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Proposal
                </div>
                <div className="whitespace-pre-wrap text-sm text-slate-700">{detailBid.proposal_text || detailBid.message}</div>
              </div>
            ) : null}

            {detailBid.included_text ? (
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  What’s included
                </div>
                <div className="whitespace-pre-wrap text-sm text-slate-700">{detailBid.included_text}</div>
              </div>
            ) : null}

            {detailBid.excluded_text ? (
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  What’s excluded
                </div>
                <div className="whitespace-pre-wrap text-sm text-slate-700">{detailBid.excluded_text}</div>
              </div>
            ) : null}

            {detailBid.payment_terms ? (
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Payment terms
                </div>
                <div className="whitespace-pre-wrap text-sm text-slate-700">{detailBid.payment_terms}</div>
              </div>
            ) : null}

            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Bid Timeline
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                {detailBid.project_created_at ? <div>Posted job: {formatStamp(detailBid.project_created_at)}</div> : null}
                {detailBid.accepted_at || String(detailBid.status || "").toLowerCase() === "accepted" ? (
                  <div>Accepted bid: {formatStamp(detailBid.accepted_at || detailBid.updated_at)}</div>
                ) : null}
                {detailBid.accepted_by_username || (String(detailBid.status || "").toLowerCase() === "accepted" && ownerUsername) ? (
                  <div>Accepted by: {detailBid.accepted_by_username || ownerUsername}</div>
                ) : null}
                {detailBid.valid_until ? <div>Valid until: {detailBid.valid_until}</div> : null}
                {detailBid.attachment_url ? (
                  <a
                    href={detailBid.attachment_url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-sky-700 hover:underline"
                  >
                    View attachment
                  </a>
                ) : null}
              </div>
            </div>

            {String(detailBid.status || "").toLowerCase() !== "accepted" && detailBid.owner_response_note ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Owner note
                </div>
                <div className="whitespace-pre-wrap">{detailBid.owner_response_note}</div>
              </div>
            ) : null}

            <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50 px-4 py-4 text-sm leading-relaxed text-indigo-950">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-700">
                Acceptance Disclaimer
              </div>
              <p className="mb-2">
                By accepting this bid, you confirm that you agree to the general terms, scope, and pricing outlined by the contractor.
              </p>
              <p className="mb-2">
                This acceptance indicates your intent to proceed with the contractor; however, it does not constitute a legally binding contract. No formal agreement is created through this platform alone.
              </p>
              <p className="mb-2">
                Any final agreement, including detailed scope, payment terms, schedule, permits, and legal obligations, must be discussed and confirmed directly between the project owner and the contractor outside of this platform.
              </p>
              <p>
                The platform acts only as a facilitator for introductions and proposals and is not responsible for the execution, enforcement, or outcome of any agreement between the parties.
              </p>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
