import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import api from "../api";
import EstimateCardDialogs from "../components/EstimateCardDialogs";
import { Container, SymbolIcon } from "../ui";


function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}


function updatedDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}


export default function Estimates() {
  const [estimates, setEstimates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [sharing, setSharing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  async function action(estimate, kind) {
    setBusyId(estimate.id); setError("");
    try {
      if (kind === "delete") {
        await api.delete(`/estimates/${estimate.id}/`);
        setEstimates(items => items.filter(item => item.id !== estimate.id));
        setDeleting(null);
      } else if (kind === "pin") {
        const {data} = await api.post(`/estimates/${estimate.id}/pin/`, {pinned: !estimate.is_pinned});
        setEstimates(items => items.map(item => item.id === estimate.id ? {...item, is_pinned: data.is_pinned} : item));
      } else {
        const {data} = await api.post(`/estimates/${estimate.id}/client-share/`);
        const url = `${window.location.origin}/shared-estimate/${data.token}`;
        setSharing({url, name: estimate.project_name});
      }
    } catch { setError(`Could not ${kind} this estimate. Please try again.`); }
    finally { setBusyId(null); }
  }


  useEffect(() => {
    let cancelled = false;
    api.get("/estimates/")
      .then(({ data }) => {
        if (!cancelled) setEstimates(Array.isArray(data) ? data : data?.results || []);
      })
      .catch(() => {
        if (!cancelled) setError("Your estimates could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#FBF9F7] pb-16 text-slate-900">
      <div className="border-b border-slate-200 bg-white">
        <Container className="py-8 sm:py-10">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Project pricing</div>
              <h1 className="mt-2 text-3xl font-bold text-slate-950 sm:text-4xl">Estimates</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                Open, revise, and organize every estimate as its own project record.
              </p>
            </div>
            <Link to="/project-estimator" className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">
              <SymbolIcon name="add" className="text-[19px]" />
              New estimate
            </Link>
          </div>
        </Container>
      </div>

      <Container className="py-8">
        {error ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        {loading ? (
          <div className="text-sm text-slate-500">Loading estimates...</div>
        ) : estimates.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...estimates].sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned)).map((estimate) => (
              <article key={estimate.id} className="group relative flex min-h-56 flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                {estimate.viewer_role === "homeowner" && <button type="button" aria-label={`Delete ${estimate.project_name}`} title="Delete estimate" disabled={busyId !== null} onClick={() => { setError(""); setDeleting(estimate); }} className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-full text-red-600 transition hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"><SymbolIcon name="close" className="text-[18px]" /></button>}
                <div className="flex items-start justify-between gap-3 pr-7">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium capitalize text-slate-600">
                    {estimate.estimate_type}
                  </span>
                  <span className={[
                    "rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
                    estimate.status === "final" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800",
                  ].join(" ")}>
                    {estimate.status || "draft"}
                  </span>
                </div>
                <h2 className="mt-4 break-words text-lg font-bold text-slate-950">{estimate.project_name}</h2>
                <div className="mt-2 text-xs text-slate-500">{estimate.estimate_number} / Updated {updatedDate(estimate.updated_at)}</div>
                <div className="mb-6 mt-5 text-2xl font-bold text-slate-950">{money(estimate.final_price)}</div>
                <Link to={`/${['framing', 'drywall', 'paving', 'roofing', 'flooring', 'siding', 'decking', 'fencing', 'windows', 'doors', 'garage_coating', 'electrical', 'plumbing'].includes(estimate.estimate_type) ? estimate.estimate_type : 'project'}-estimator/${estimate.id}`} className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50">
                  Open estimate
                  <SymbolIcon name="arrow_forward" className="text-[18px]" />
                </Link>
                <div className="mt-3 flex justify-end gap-1">
                  <button type="button" title="Share estimate" disabled={busyId !== null} onClick={() => action(estimate, "share")} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-50"><SymbolIcon name="share" className="text-[18px]" />Share</button>
                  <button type="button" title={estimate.is_pinned ? "Unpin estimate" : "Pin estimate"} disabled={busyId !== null} aria-pressed={estimate.is_pinned} onClick={() => action(estimate, "pin")} className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-50 ${estimate.is_pinned ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-900"}`}><SymbolIcon name="push_pin" className="text-[18px]" />{estimate.is_pinned ? "Pinned" : "Pin"}</button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <SymbolIcon name="calculate" className="text-[34px] text-slate-400" />
            <h2 className="mt-4 text-xl font-bold text-slate-950">No estimates yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">Choose a project category and create an estimate. Every saved estimate will remain independent and appear here.</p>
            <Link to="/project-estimator" className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800">
              <SymbolIcon name="add" className="text-[19px]" />
              Create an estimate
            </Link>
          </div>
        )}
      </Container>
      <EstimateCardDialogs deleting={deleting} sharing={sharing} busy={busyId !== null} error={error} onCancel={() => { setDeleting(null); setSharing(null); }} onDelete={() => deleting && action(deleting, "delete")} />
    </div>
  );
}
