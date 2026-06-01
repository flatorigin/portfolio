import { Card, SymbolIcon } from "../../ui";
import ReportContentButton from "../ReportContentButton";

export default function DirectoryListingCard({
  listing,
  distanceLabel = "",
  liked = false,
  likeCount = 0,
  likeBusy = false,
  onLike,
}) {
  const specialties = Array.isArray(listing?.specialties) ? listing.specialties : [];
  const visibleSpecialties = specialties.slice(0, 3);
  const hiddenSpecialtyCount = Math.max(0, specialties.length - visibleSpecialties.length);
  const reviewCount = Number(listing?.review_count || listing?.reviews_count || 0);
  const rating = listing?.rating || listing?.average_rating || null;
  const phoneHref = listing?.phone_number
    ? `tel:${String(listing.phone_number).replace(/[^\d+]/g, "")}`
    : "";

  return (
    <Card className="flex min-h-[285px] flex-col border-slate-300/80 p-5 transition hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold tracking-tight text-slate-950">
            {listing.business_name}
          </h3>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-slate-500">
            {listing.location ? (
              <div className="inline-flex min-w-0 items-center gap-1.5 text-sm font-medium">
                <SymbolIcon name="location_on" className="text-[20px]" />
                <span className="truncate">{listing.location}</span>
              </div>
            ) : null}
            {distanceLabel ? (
              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                {distanceLabel}
              </span>
            ) : null}
          </div>

          {rating || reviewCount > 0 ? (
            <div className="mt-5 flex items-center gap-2 text-sm text-slate-600">
              <SymbolIcon name="star" fill={1} className="text-[20px] text-slate-500" />
              {rating ? (
                <span className="font-semibold text-slate-950">{rating}</span>
              ) : null}
              {reviewCount > 0 ? (
                <span>
                  ({reviewCount} review{reviewCount === 1 ? "" : "s"})
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 disabled:opacity-50"
          onClick={onLike}
          disabled={likeBusy}
          aria-label={liked ? "Unlike directory listing" : "Like directory listing"}
          title={liked ? "Unlike directory listing" : "Like directory listing"}
        >
          <SymbolIcon name="favorite" fill={liked ? 1 : 0} className="text-[26px]" />
          <span className="sr-only">{likeCount}</span>
        </button>
      </div>

      {visibleSpecialties.length > 0 ? (
        <div className="mt-7 flex flex-wrap gap-2">
          {visibleSpecialties.map((specialty) => (
            <span
              key={specialty}
              className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-medium text-slate-600"
            >
              {specialty}
            </span>
          ))}
          {hiddenSpecialtyCount > 0 ? (
            <span className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-medium text-slate-600">
              +{hiddenSpecialtyCount} more
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-4 border-t border-slate-200 pt-5">
        <div className="group relative">
          <ReportContentButton
            targetType="business_directory_listing"
            targetId={listing.id}
            subject={listing.business_name || "Business directory listing"}
            label={<SymbolIcon name="flag" className="text-[16px]" />}
            title="Report listing"
            ariaLabel="Report listing"
            className="hidden"
          />
          <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-64 rounded-xl bg-slate-950 p-3 text-xs leading-5 text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
            Business information may be sourced from publicly available information.
            Business owners may request edits or removal.
          </div>
        </div>

        {phoneHref ? (
          <a
            href={phoneHref}
            className="inline-flex min-w-0 flex-1 items-center justify-start gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950"
          >
            <SymbolIcon name="phone" className="text-[22px]" />
            <span className="truncate">{listing.phone_number}</span>
          </a>
        ) : (
          <span className="flex-1" />
        )}

        {listing.website ? (
          <a
            href={listing.website}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-slate-700 transition hover:text-slate-950 hover:underline"
          >
            Website
            <SymbolIcon name="open_in_new" className="text-[19px]" />
          </a>
        ) : (
          <span className="text-xs text-slate-400">Reviewed listing</span>
        )}
      </div>
    </Card>
  );
}
