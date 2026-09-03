import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api";
import BusinessShareDialog from "../components/BusinessShareDialog";
import { SymbolIcon } from "../ui";

export default function BusinessDirectoryDetail() {
  const { listingId } = useParams();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api
      .get(`/business-directory/${listingId}/`)
      .then(({ data }) => {
        if (!cancelled) setListing(data);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setListing(null);
          setError(
            requestError?.response?.status === 404
              ? "This business listing is not available."
              : "Could not load this business listing.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [listingId]);

  if (loading) {
    return <div className="mx-auto max-w-3xl px-4 py-12 text-sm text-slate-500">Loading business...</div>;
  }

  if (!listing) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-2xl font-bold text-slate-950">Business not available</h1>
        <p className="mt-2 text-sm text-slate-600">{error}</p>
        <Link to="/explore" className="mt-5 inline-flex text-sm font-semibold text-slate-900 underline underline-offset-4">
          Back to Explore
        </Link>
      </div>
    );
  }

  const specialties = Array.isArray(listing.specialties) ? listing.specialties : [];

  return (
    <div className="min-h-[70vh] bg-[#F6F5F1]">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <Link to="/explore" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950">
          <SymbolIcon name="arrow_back" className="text-[18px]" />
          Back to Explore
        </Link>

        <article className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <header className="flex flex-col gap-5 border-b border-slate-200 px-5 py-6 sm:flex-row sm:items-start sm:justify-between sm:px-7">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Local Contractor Directory</div>
              <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">{listing.business_name}</h1>
              <div className="mt-3 flex items-center gap-1.5 text-sm text-slate-600">
                <SymbolIcon name="location_on" className="text-[18px] text-slate-400" />
                {listing.location || "Local"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <SymbolIcon name="share" className="text-[18px]" />
              Share
            </button>
          </header>

          <div className="space-y-6 px-5 py-6 sm:px-7">
            {specialties.length ? (
              <section>
                <h2 className="text-sm font-semibold text-slate-950">Services</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {specialties.map((specialty) => (
                    <span key={specialty} className="rounded-md bg-slate-100 px-3 py-1.5 text-sm text-slate-700">
                      {specialty}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="grid gap-3 sm:grid-cols-2">
              {listing.phone_number ? (
                <a
                  href={`tel:${String(listing.phone_number).replace(/[^\d+]/g, "")}`}
                  className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <SymbolIcon name="call" className="text-[20px] text-slate-500" />
                  {listing.phone_number}
                </a>
              ) : null}
              {listing.website ? (
                <a
                  href={listing.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <SymbolIcon name="language" className="text-[20px] text-slate-500" />
                  <span className="min-w-0 flex-1 truncate">Visit website</span>
                  <SymbolIcon name="open_in_new" className="text-[16px] text-slate-400" />
                </a>
              ) : null}
            </section>

            <p className="border-t border-slate-100 pt-5 text-xs leading-5 text-slate-500">
              Business information may be sourced from publicly available information. Business owners may request edits or removal.
            </p>
          </div>
        </article>
      </div>
      {shareOpen ? <BusinessShareDialog listing={listing} onClose={() => setShareOpen(false)} /> : null}
    </div>
  );
}
