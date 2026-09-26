import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import api from "../api";
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
            {estimates.map((estimate) => (
              <article key={estimate.id} className="flex min-h-56 flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
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
                <div className="mt-5 text-2xl font-bold text-slate-950">{money(estimate.final_price)}</div>
                <Link to={`/${['framing', 'drywall', 'paving', 'roofing', 'flooring', 'siding', 'decking', 'fencing', 'windows', 'doors', 'garage_coating', 'electrical', 'plumbing'].includes(estimate.estimate_type) ? estimate.estimate_type : 'project'}-estimator/${estimate.id}`} className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50">
                  Open estimate
                  <SymbolIcon name="arrow_forward" className="text-[18px]" />
                </Link>
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
    </div>
  );
}
