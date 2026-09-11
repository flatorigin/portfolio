import { useEffect, useState } from "react";
import api from "../api";
import { SymbolIcon } from "../ui";

function formatCurrency(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: amount > 0 && amount < 0.01 ? 4 : 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export default function AiUsagePage() {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    api
      .get("/ai/usage/")
      .then(({ data }) => {
        if (active) setUsage(data);
      })
      .catch((err) => {
        console.warn("[AiUsagePage] failed to load AI usage", err?.response || err);
        if (active) setError("AI usage is temporarily unavailable.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const remaining = Number(usage?.remaining_today || 0);
  const dailyLimit = Number(usage?.daily_limit || 0);
  const remainingPercent =
    dailyLimit > 0 ? Math.min(100, (remaining / dailyLimit) * 100) : 0;
  const month = usage?.month || {};
  const pricing = usage?.pricing || {};
  const recent = Array.isArray(usage?.recent) ? usage.recent : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-6">
      <header>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <SymbolIcon name="smart_toy" className="text-[24px]" weight={500} />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">AI usage</h1>
            <p className="mt-1 text-sm text-slate-500">
              Review your current allowance, account charges, and recent AI activity.
            </p>
          </div>
        </div>
      </header>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">AI usage balance</h2>
            <p className="mt-1 text-xs text-slate-500">
              Current allowance and account charges
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
            Tracking only
          </span>
        </div>

        {loading ? (
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            {[0, 1].map((item) => (
              <div key={item} className="h-24 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : usage ? (
          <>
            <div className="grid gap-px bg-slate-100 sm:grid-cols-2">
              <div className="bg-white p-5">
                <div className="text-xs font-medium text-slate-500">Available today</div>
                <div className="mt-2 flex items-end gap-2">
                  <span className="text-2xl font-semibold text-slate-900">{remaining}</span>
                  <span className="pb-1 text-xs text-slate-500">
                    of {dailyLimit} actions
                  </span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-[width]"
                    style={{ width: `${remainingPercent}%` }}
                  />
                </div>
              </div>

              <div className="bg-white p-5">
                <div className="text-xs font-medium text-slate-500">Company charge</div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">
                  {formatCurrency(month.company_charge_usd)}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  {remaining > 0
                    ? "No paid usage this month"
                    : `${formatCurrency(pricing.minimum_charge_usd)} minimum per paid action`}
                </div>
              </div>
            </div>

            <div className="px-5 py-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-xs font-semibold uppercase text-slate-500">
                  Recent activity
                </div>
                <div className="text-[11px] text-slate-400">
                  Charges are not collected yet
                </div>
              </div>
              {recent.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {recent.map((event) => (
                    <div
                      key={event.id}
                      className="flex min-h-11 items-center justify-between gap-4 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-700">
                          {event.feature_label}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {new Date(event.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="shrink-0 text-sm font-semibold text-slate-700">
                        {event.status === "success" ? "Included" : "Not charged"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                  No AI activity on this account yet.
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="px-5 py-6 text-sm text-slate-500">
            {error || "AI usage is temporarily unavailable."}
          </div>
        )}
      </section>
    </div>
  );
}
