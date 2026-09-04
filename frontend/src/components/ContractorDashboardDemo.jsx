import { useState } from "react";

import contractorProjectImage from "../assets/landing/contractor.webp";
import homeownerProjectImage from "../assets/landing/homeowner.webp";
import { Badge, SymbolIcon } from "../ui";

const SAMPLE_PROJECTS = [
  {
    title: "Exterior renovation",
    category: "General Contracting",
    location: "Media, PA",
    summary: "New siding, exterior trim, entry details, and final finish work.",
    image: contractorProjectImage,
  },
  {
    title: "Entry and curb appeal update",
    category: "Exterior",
    location: "Springfield, PA",
    summary: "Completed front entry, landscape borders, and facade improvements.",
    image: homeownerProjectImage,
  },
];

const SAMPLE_STATS = [
  { label: "Portfolio projects", value: "2", icon: "home_work" },
  { label: "Profile views", value: "28", icon: "visibility" },
  { label: "Job opportunities", value: "1", icon: "work" },
];

function SampleBidPreview({ onClose }) {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    amount: "14,500",
    timeline: "2-3 weeks",
    proposal:
      "I would begin with a site visit to verify the wall conditions and structural requirements, then provide a confirmed scope and schedule.",
  });

  function updateField(field) {
    return (event) => {
      setSubmitted(false);
      setForm((current) => ({ ...current, [field]: event.target.value }));
    };
  }

  function handleSubmit(event) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/60 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sample-bid-title"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Badge className="bg-sky-100 text-[10px] font-semibold text-sky-800">
                Sample
              </Badge>
              <span className="text-xs text-slate-500">Nothing will be submitted</span>
            </div>
            <h2 id="sample-bid-title" className="text-lg font-semibold text-slate-900">
              Kitchen wall removal &amp; open layout
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50"
            aria-label="Close sample bid"
            title="Close"
          >
            <SymbolIcon name="close" className="text-[20px]" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="border-b border-slate-100 pb-5">
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <SymbolIcon name="location_on" className="text-[18px]" />
                Springfield, PA
              </span>
              <span className="inline-flex items-center gap-1.5">
                <SymbolIcon name="payments" className="text-[18px]" />
                $12,000-$18,000
              </span>
              <span className="inline-flex items-center gap-1.5">
                <SymbolIcon name="schedule" className="text-[18px]" />
                Flexible start
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              The homeowner wants to remove the wall between the kitchen and dining room,
              confirm whether it is load-bearing, repair the surrounding surfaces, and create
              a wider opening with finished trim.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="sample-bid-amount" className="mb-1.5 block text-sm font-medium text-slate-800">
                Bid amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">$</span>
                <input
                  id="sample-bid-amount"
                  type="text"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={updateField("amount")}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-7 pr-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>
            </div>

            <div>
              <label htmlFor="sample-bid-timeline" className="mb-1.5 block text-sm font-medium text-slate-800">
                Estimated timeline
              </label>
              <input
                id="sample-bid-timeline"
                type="text"
                value={form.timeline}
                onChange={updateField("timeline")}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </div>

            <div>
              <label htmlFor="sample-bid-proposal" className="mb-1.5 block text-sm font-medium text-slate-800">
                Proposal
              </label>
              <textarea
                id="sample-bid-proposal"
                rows={5}
                value={form.proposal}
                onChange={updateField("proposal")}
                className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm leading-6 text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </div>

            {submitted ? (
              <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">
                <SymbolIcon name="check_circle" className="mt-0.5 text-[19px] text-emerald-700" fill={1} />
                <div>
                  <div className="font-semibold">Sample bid prepared</div>
                  <div className="mt-0.5 text-xs text-emerald-800">
                    This preview was not saved or sent to a homeowner.
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                <SymbolIcon name="send" className="text-[18px]" />
                Preview submission
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ContractorDashboardDemo({ isVisible, onCreateProject }) {
  const [showBidPreview, setShowBidPreview] = useState(false);

  if (!isVisible) return null;

  return (
    <>
      <section className="space-y-5" aria-labelledby="sample-dashboard-title">
        <div className="flex flex-col gap-4 rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-sky-700 shadow-sm">
              <SymbolIcon name="preview" className="text-[22px]" />
            </span>
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h2 id="sample-dashboard-title" className="text-base font-semibold text-slate-900">
                  Your sample contractor dashboard
                </h2>
                <Badge className="bg-sky-700 text-[10px] font-semibold text-white">Sample data</Badge>
              </div>
              <p className="max-w-2xl text-sm leading-5 text-slate-600">
                Explore a portfolio and practice responding to a homeowner job. These examples
                disappear permanently after you create your first project.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCreateProject}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <SymbolIcon name="add" className="text-[20px]" />
            Create real project
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {SAMPLE_STATS.map((stat) => (
            <div key={stat.label} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <SymbolIcon name={stat.icon} className="text-[21px]" />
              </span>
              <div>
                <div className="text-xl font-semibold text-slate-900">{stat.value}</div>
                <div className="text-xs text-slate-500">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur-md">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Sample Portfolio</div>
              <div className="text-xs text-slate-500">This is how completed work can appear on your dashboard.</div>
            </div>
            <Badge className="shrink-0 bg-slate-100 text-[10px] font-semibold text-slate-600">Preview only</Badge>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {SAMPLE_PROJECTS.map((project) => (
              <article key={project.title} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                <img src={project.image} alt="" className="h-40 w-full object-cover" />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-slate-900">{project.title}</h3>
                      <div className="mt-0.5 text-[11px] text-slate-500">{project.location}</div>
                    </div>
                    <Badge className="shrink-0 bg-emerald-50 text-[10px] font-medium text-emerald-700">Completed</Badge>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{project.summary}</p>
                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-500">
                    <span>{project.category}</span>
                    <span className="inline-flex items-center gap-1">
                      <SymbolIcon name="visibility" className="text-[15px]" />
                      Sample
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur-md">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Sample Homeowner Job</div>
              <div className="text-xs text-slate-500">Open the example to preview how bidding works.</div>
            </div>
            <Badge className="shrink-0 bg-amber-100 text-[10px] font-semibold text-amber-800">New opportunity</Badge>
          </div>

          <div className="grid overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm md:grid-cols-[220px_1fr]">
            <img src={homeownerProjectImage} alt="" className="h-48 w-full object-cover md:h-full" />
            <div className="flex flex-col p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Kitchen wall removal &amp; open layout</h3>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>Springfield, PA</span>
                    <span>$12,000-$18,000</span>
                    <span>Flexible start</span>
                  </div>
                </div>
                <Badge className="bg-slate-100 text-[10px] text-slate-600">General Contractor</Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Remove the wall between the kitchen and dining room, verify structural needs,
                and finish the new opening and adjacent surfaces.
              </p>
              <div className="mt-auto flex flex-col gap-2 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs text-slate-500">Posted by Sample Homeowner</span>
                <button
                  type="button"
                  onClick={() => setShowBidPreview(true)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  <SymbolIcon name="request_quote" className="text-[19px]" />
                  Practice bidding
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {showBidPreview ? <SampleBidPreview onClose={() => setShowBidPreview(false)} /> : null}
    </>
  );
}
