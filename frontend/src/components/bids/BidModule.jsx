import { useEffect, useMemo, useState } from "react";
import api from "../../api";

function normalizeError(err, fallback) {
  const data = err?.response?.data;

  if (typeof data === "string") {
    const trimmed = data.trim().toLowerCase();
    if (trimmed.startsWith("<!doctype") || trimmed.startsWith("<html")) {
      return fallback;
    }
    return data;
  }

  return (
    data?.detail ||
    data?.message ||
    err?.message ||
    fallback
  );
}

export default function BidModule({ projectId, currentUserId, ownerId }) {
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionBusyId, setActionBusyId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const [form, setForm] = useState({
    amount: "",
    message: "",
  });

  const isOwner = String(currentUserId) === String(ownerId);

  async function loadBids() {
    if (!projectId) return;
    setLoading(true);
    setError("");

    try {
      const { data } = await api.get(`/projects/${projectId}/bids/`);
      setBids(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("[BidModule] loadBids failed:", err?.response || err);
      setError(normalizeError(err, "Server error while loading bids."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBids();
  }, [projectId]);

  const myBid = useMemo(() => {
    if (!currentUserId) return null;
    return bids.find((b) => String(b.contractor) === String(currentUserId)) || null;
  }, [bids, currentUserId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!projectId) {
      setError("Missing project.");
      return;
    }

    if (!form.amount) {
      setError("Amount is required.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/projects/${projectId}/bids/`, {
        amount: form.amount,
        message: form.message,
      });

      setSuccess("Bid submitted.");
      setForm({
        amount: "",
        message: "",
      });
      setFormOpen(false);

      await loadBids();
    } catch (err) {
      console.error("[BidModule] submit failed:", err?.response || err);
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
      await api.post(`/bids/${bidId}/${action}/`);
      setSuccess(`Bid ${action}ed.`);
      await loadBids();
    } catch (err) {
      console.error(`[BidModule] ${action} failed:`, err?.response || err);
      setError(normalizeError(err, `Server error while trying to ${action} bid.`));
    } finally {
      setActionBusyId(null);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            {isOwner ? "Project Bids" : "Your Bid"}
          </h3>
          <p className="text-sm text-slate-500">
            {isOwner
              ? "Review submitted bids for this project."
              : "Submit one bid for this project."}
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

      {loading ? (
        <div className="mb-4 text-sm text-slate-500">Loading bids...</div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {success}
        </div>
      ) : null}

      {isOwner ? (
        <div className="space-y-3">
          {bids.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              No bids submitted yet.
            </div>
          ) : (
            bids.map((bid) => (
              <div key={bid.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {bid.contractor_name || `Contractor #${bid.contractor}`}
                    </div>
                    <div className="mt-1 text-xs capitalize text-slate-500">
                      Status: {bid.status}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-lg font-bold text-slate-900">
                      ${bid.amount}
                    </div>
                  </div>
                </div>

                {bid.message ? (
                  <div className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
                    {bid.message}
                  </div>
                ) : null}

                {["pending", "submitted"].includes((bid.status || "").toLowerCase()) ? (
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      disabled={actionBusyId === bid.id}
                      onClick={() => runAction(bid.id, "accept")}
                      className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
                    >
                      {actionBusyId === bid.id ? "Working..." : "Accept"}
                    </button>

                    <button
                      type="button"
                      disabled={actionBusyId === bid.id}
                      onClick={() => runAction(bid.id, "decline")}
                      className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                    >
                      {actionBusyId === bid.id ? "Working..." : "Decline"}
                    </button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {myBid ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    Your current bid
                  </div>
                  <div className="mt-1 text-xs capitalize text-slate-500">
                    Status: {myBid.status}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-lg font-bold text-slate-900">
                    ${myBid.amount}
                  </div>
                </div>
              </div>

              {myBid.message ? (
                <div className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
                  {myBid.message}
                </div>
              ) : null}

              {myBid.status !== "accepted" && myBid.status !== "withdrawn" ? (
                <div className="mt-4">
                  <button
                    type="button"
                    disabled={actionBusyId === myBid.id}
                    onClick={() => runAction(myBid.id, "withdraw")}
                    className="rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                  >
                    {actionBusyId === myBid.id ? "Working..." : "Withdraw Bid"}
                  </button>
                </div>
              ) : null}
            </div>
          ) : !formOpen ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setSuccess("");
                  setFormOpen(true);
                }}
                className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
              >
                Send Bid
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Amount
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, amount: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="5000"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Message
                </label>
                <textarea
                  rows={4}
                  value={form.message}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, message: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Write a short proposal..."
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
                >
                  {submitting ? "Submitting..." : "Submit Bid"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}