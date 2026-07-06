import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { Badge, SymbolIcon } from "../ui";

function formatDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function normalizeError(err) {
  return err?.response?.data?.detail || err?.message || "Could not load local promotions.";
}

export default function LocalPromotionsSection({
  role = "",
  compact = false,
  initialLimit = 6,
  showCta = true,
}) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    async function loadPromotions() {
      setLoading(true);
      setError("");
      try {
        const params = {};
        if (debouncedSearch) params.search = debouncedSearch;
        if (role) params.role = role;
        const { data } = await api.get("/local-promotions/", { params });
        if (!cancelled) setPromotions(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) {
          setPromotions([]);
          setError(normalizeError(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadPromotions();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, role]);

  const visiblePromotions = useMemo(() => {
    if (!compact) return promotions;
    return promotions.slice(0, initialLimit);
  }, [compact, initialLimit, promotions]);

  return (
    <section className={compact ? "rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur-md" : ""}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className={compact ? "text-sm font-semibold text-slate-900" : "text-3xl font-bold tracking-tight text-slate-900"}>
            Local Construction Deals & Services
          </h2>
          <p className={compact ? "mt-1 text-xs text-slate-500" : "mt-2 text-sm text-slate-500"}>
            Search local material, tool, and service offers near Media, PA.
          </p>
        </div>
        <div className="relative w-full sm:max-w-md">
          <SymbolIcon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 text-[18px] text-slate-400 -translate-y-1/2"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search lumber, drywall, tools, landscaping, handyman, roofing..."
            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          />
        </div>
      </div>

      {error ? (
        <div className="mt-5 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-5 rounded-xl border border-slate-100 bg-white px-4 py-5 text-sm text-slate-500">
          Loading local promotions...
        </div>
      ) : visiblePromotions.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-5 text-sm text-slate-500">
          No matching local promotions found.
        </div>
      ) : (
        <div className={compact ? "mt-5 grid gap-3 lg:grid-cols-2" : "mt-6 grid gap-4 md:grid-cols-2"}>
          {visiblePromotions.map((promotion) => (
            <article key={promotion.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-slate-900">
                    {promotion.title}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {promotion.business_name || "Local business"}
                  </p>
                </div>
                {promotion.category ? (
                  <Badge className="shrink-0 bg-slate-100 text-xs text-slate-700">
                    {promotion.category}
                  </Badge>
                ) : null}
              </div>

              {promotion.product_or_service_name ? (
                <div className="mt-3 text-sm font-medium text-slate-800">
                  {promotion.product_or_service_name}
                </div>
              ) : null}

              <p className="mt-2 text-sm leading-6 text-slate-600">
                {promotion.promotion_text}
              </p>

              {(promotion.sale_price || promotion.discount_text || promotion.coupon_code) ? (
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {promotion.sale_price ? (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
                      {promotion.original_price ? `${promotion.original_price} -> ` : ""}{promotion.sale_price}
                    </span>
                  ) : null}
                  {promotion.discount_text ? (
                    <span className="rounded-full bg-amber-50 px-3 py-1 font-semibold text-amber-700">
                      {promotion.discount_text}
                    </span>
                  ) : null}
                  {promotion.coupon_code ? (
                    <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                      Code: {promotion.coupon_code}
                    </span>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-4 space-y-1 text-xs text-slate-500">
                {promotion.end_date ? (
                  <div>Expires {formatDate(promotion.end_date)}</div>
                ) : null}
                {promotion.website_url ? (
                  <a
                    href={promotion.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex break-all font-medium text-slate-700 hover:text-slate-950 hover:underline"
                  >
                    {promotion.website_url}
                  </a>
                ) : null}
                <div>Promotion details should be verified with the business.</div>
              </div>
            </article>
          ))}
        </div>
      )}

      {showCta ? (
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
          Planning a project?{" "}
          <Link to="/dashboard" className="font-semibold text-slate-900 hover:underline">
            Create a free project plan
          </Link>{" "}
          to organize materials, contractors, and local offers.
        </div>
      ) : null}
    </section>
  );
}
