import { useEffect, useState } from "react";

import bathroomGallery from "../assets/dashboard-samples/bathroom-renovation-gallery.webp";
import deckGallery from "../assets/dashboard-samples/deck-renovation-gallery.webp";
import homeownerJobGallery from "../assets/dashboard-samples/homeowner-job-gallery.webp";
import kitchenGallery from "../assets/dashboard-samples/kitchen-renovation-gallery.webp";
import { Badge, SymbolIcon } from "../ui";

const GALLERY_POSITIONS = ["0% 0%", "100% 0%", "0% 100%", "100% 100%"];

const SAMPLE_PROJECTS = [
  {
    id: "sample-kitchen",
    title: "Open-concept kitchen renovation",
    category: "Kitchen Remodeling",
    location: "Media, PA",
    budget: "$42,000",
    sqf: "310 sq ft",
    completed: "Completed May 2026",
    posted: "May 28, 2026",
    likes: 18,
    summary:
      "Opened the kitchen to the dining room and installed new cabinetry, counters, lighting, and finish details.",
    description:
      "The homeowners wanted better circulation and a larger gathering space without changing the kitchen footprint. We widened the dining-room opening, installed a properly sized structural header, and rebuilt the kitchen around a new oak island.",
    scope: [
      "Protected the occupied areas and completed selective demolition",
      "Framed and finished the widened structural opening",
      "Installed cabinets, quartz surfaces, fixtures, trim, and lighting",
      "Completed final paint, hardware adjustments, and cleanup",
    ],
    materials: "White shaker cabinetry, oak island, quartz countertops, black hardware",
    highlights: "Structural opening, custom island, quartz counters",
    review: {
      author: "Morgan L.",
      date: "Jun 2, 2026",
      text: "The new opening completely changed how the first floor feels. The schedule and daily updates were clear from start to finish.",
      reply: "Thank you, Morgan. We enjoyed helping your family make the kitchen work better for everyday gatherings.",
    },
    gallery: kitchenGallery,
    galleryLabels: [
      "Completed kitchen and island",
      "Structural opening during construction",
      "Cabinet and quartz detail",
      "Finished kitchen facing the dining room",
    ],
  },
  {
    id: "sample-deck",
    title: "Composite deck rebuild",
    category: "Decks & Outdoor",
    location: "Havertown, PA",
    budget: "$28,500",
    sqf: "420 sq ft",
    completed: "Completed April 2026",
    posted: "Apr 19, 2026",
    likes: 12,
    summary:
      "Replaced an aging wood deck with composite boards, picture-frame edges, black railing, and new stairs.",
    description:
      "The original deck had deteriorated framing and an undersized stair landing. We removed the existing structure, rebuilt the frame and footings, and installed a low-maintenance composite surface with safer access to the yard.",
    scope: [
      "Removed and disposed of the existing deck and railing",
      "Rebuilt the ledger, posts, beams, joists, stairs, and landing",
      "Installed composite decking with picture-frame borders",
      "Installed black aluminum guards, handrails, and final trim",
    ],
    materials: "Medium-brown composite decking, pressure-treated framing, aluminum railing",
    highlights: "Composite decking, picture-frame border, aluminum railing",
    review: {
      author: "Chris D.",
      date: "Apr 25, 2026",
      text: "The deck feels solid and the stair layout is much safer. The finish details look especially clean around the border and railing.",
      reply: "Thank you, Chris. The improved access and low-maintenance finish were the priorities for this rebuild.",
    },
    gallery: deckGallery,
    galleryLabels: [
      "Completed deck from the yard",
      "New deck framing in progress",
      "Picture-frame edge and railing detail",
      "Completed stairs and house connection",
    ],
  },
  {
    id: "sample-bathroom",
    title: "Primary bathroom renovation",
    category: "Bathroom Remodeling",
    location: "Wayne, PA",
    budget: "$31,800",
    sqf: "145 sq ft",
    completed: "Completed March 2026",
    posted: "Mar 21, 2026",
    likes: 15,
    summary:
      "Built a walk-in shower and double vanity with new waterproofing, tile, lighting, plumbing, and glass.",
    description:
      "This bathroom was reconfigured to replace a small shower and unused storage area with a larger walk-in enclosure. The finished room adds practical storage, brighter task lighting, and durable surfaces while keeping the existing window location.",
    scope: [
      "Removed existing fixtures, finishes, and damaged underlayment",
      "Updated supply, drain, electrical, ventilation, and waterproofing",
      "Installed shower tile, floor tile, vanity, counters, and lighting",
      "Completed glass installation, fixture trim, paint, and punch list",
    ],
    materials: "Oak double vanity, white tile, light stone flooring, matte black fixtures",
    highlights: "Walk-in shower, double vanity, full waterproofing",
    review: {
      author: "Taylor S.",
      date: "Mar 27, 2026",
      text: "The shower and vanity storage made the room much more practical. Every transition and tile line looks carefully finished.",
      reply: "Thank you, Taylor. We are glad the new layout and storage are working well for you.",
    },
    gallery: bathroomGallery,
    galleryLabels: [
      "Completed vanity and walk-in shower",
      "Waterproofing and tile preparation",
      "Finished shower fixture and niche detail",
      "Completed bathroom from the entry",
    ],
  },
];

const SAMPLE_JOB = {
  title: "Kitchen wall removal & open layout",
  homeowner: "Jamie R.",
  location: "Springfield, PA",
  budget: "$12,000-$18,000",
  sqf: "240 sq ft",
  timeline: "Flexible start; complete within 3-4 weeks",
  category: "General Contractor",
  postedDate: "Sep 2, 2026",
  distance: "4.8 mi",
  likes: 4,
  postingType: "Public job posting",
  permits: "Required · Homeowner",
  expertise: "Structural framing, electrical coordination, drywall, trim, and painting",
  highlights: "Wider opening, matching existing finishes, occupied home",
  serviceCategories: ["General Contractor", "Structural Framing", "Drywall & Paint"],
  summary:
    "We want to widen or remove the wall between our kitchen and dining room so the first floor feels more open. We need help confirming whether the wall is load-bearing and completing all framing, electrical, drywall, trim, and paint work.",
  details: [
    "Evaluate the wall and confirm structural requirements",
    "Relocate the outlet and any wiring affected by the opening",
    "Install the required header and complete framing",
    "Repair flooring, drywall, ceiling, trim, and paint at the opening",
  ],
  review: {
    author: "Riverside Build Co.",
    date: "Sep 3, 2026",
    text: "Is the wall directly below a second-floor wall, and do you have any original framing plans available?",
    reply: "It is below the upstairs hallway wall. We do not have framing plans, so we expect the contractor to help coordinate the structural review.",
  },
  gallery: homeownerJobGallery,
  galleryLabels: [
    "Kitchen facing the dining-room opening",
    "Dining room facing the kitchen wall",
    "Wall, outlet, and baseboard detail",
    "Overall kitchen and dining-room connection",
  ],
};

function GalleryImage({ sheet, index, label, className = "" }) {
  return (
    <div
      role="img"
      aria-label={label}
      className={`bg-slate-100 bg-no-repeat ${className}`}
      style={{
        backgroundImage: `url(${sheet})`,
        backgroundPosition: GALLERY_POSITIONS[index],
        backgroundSize: "200% auto",
      }}
    />
  );
}

function useModalLifecycle(onClose) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);
}

function StaticProjectAction({ icon, children, primary = false }) {
  return (
    <span
      className={`inline-flex h-9 cursor-default items-center gap-1.5 rounded-lg px-3 text-sm font-medium ${
        primary
          ? "bg-slate-900 text-white"
          : "border border-slate-200 bg-white text-slate-700"
      }`}
    >
      <SymbolIcon name={icon} className="text-[16px]" />
      {children}
    </span>
  );
}

function StaticStars({ rating = 5 }) {
  return (
    <div className="inline-flex items-center gap-0" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <SymbolIcon
          key={value}
          name="star"
          fill={value <= rating ? 1 : 0}
          className={value <= rating ? "text-[13px] text-amber-500" : "text-[13px] text-slate-300"}
        />
      ))}
    </div>
  );
}

function SampleProjectPreview({ project, onClose }) {
  useModalLifecycle(onClose);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/65 px-3 py-4 backdrop-blur-sm sm:px-6 sm:py-8"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="mx-auto max-w-6xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sample-project-detail-title"
      >
        <div className="mb-0 flex min-h-14 items-center justify-between rounded-t-2xl bg-slate-50 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            <Badge className="bg-sky-100 text-[10px] font-semibold text-sky-800">Sample</Badge>
            <span>/</span>
            <span className="text-slate-700">Project</span>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-slate-600 hover:text-slate-900">
            &larr; Back
          </button>
        </div>

        <div className="mb-4 overflow-hidden rounded-b-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-white">
            <div className="px-5 py-5 sm:px-7 sm:py-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Project document
                  </div>
                  <h1
                    id="sample-project-detail-title"
                    className="mt-2 text-2xl font-semibold leading-tight text-slate-950 sm:text-3xl"
                  >
                    {project.title}
                  </h1>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                      {project.category}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600">
                      Prepared by Demo Contractor
                    </span>
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600">
                      {project.posted}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 text-slate-700">
                  <div className="flex items-center gap-1.5">
                    <span className="min-w-[1ch] text-[18px] font-medium text-slate-900">{project.likes}</span>
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500">
                      <SymbolIcon name="favorite" className="text-[18px]" />
                    </span>
                  </div>
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500">
                    <SymbolIcon name="bookmark" className="text-[18px]" />
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-3 sm:px-7">
              <div className="flex flex-wrap items-center gap-2">
                <StaticProjectAction icon="print">Print</StaticProjectAction>
                <StaticProjectAction icon="download">Download PDF</StaticProjectAction>
                <StaticProjectAction icon="share">Share</StaticProjectAction>
                <StaticProjectAction icon="person">Profile</StaticProjectAction>
              </div>
              <StaticProjectAction icon="edit" primary>Edit</StaticProjectAction>
            </div>
          </div>

          <div className="space-y-6 p-4 sm:p-7">
            <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Project overview
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-700 sm:text-[15px]">{project.description}</p>

              <div className="mt-6 grid gap-y-5 border-t border-slate-200 pt-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-x-0">
                {[
                  ["Location", project.location],
                  ["Budget", project.budget],
                  ["Sq Ft", project.sqf],
                  ["Status", project.completed],
                ].map(([label, value], index) => (
                  <div
                    key={label}
                    className={`min-w-0 lg:px-5 ${index > 0 ? "lg:border-l lg:border-slate-200" : ""}`}
                  >
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid gap-5 border-t border-slate-200 pt-5 lg:grid-cols-[0.8fr_1.2fr]">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Highlights</div>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{project.highlights}</p>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Work completed</div>
                  <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                    {project.scope.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm leading-5 text-slate-700">
                        <SymbolIcon name="check_circle" fill={1} className="mt-0.5 text-[16px] text-emerald-600" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Materials &amp; tools used
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                  <SymbolIcon name="handyman" className="text-[18px]" />
                </span>
                <div className="text-sm font-semibold text-slate-800">{project.materials}</div>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Project media</div>
                <div className="text-[11px] text-slate-500">{project.galleryLabels.length} media items</div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {project.galleryLabels.map((label, index) => (
                  <div
                    key={label}
                    className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm"
                  >
                    <div className="relative h-40 w-full overflow-hidden bg-slate-100">
                      <GalleryImage
                        sheet={project.gallery}
                        index={index}
                        label={label}
                        className="block h-full w-full bg-cover"
                      />
                      <div className="absolute left-2 top-2 rounded-md bg-white/90 px-2 py-1 text-[10px] font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200">
                        Image only
                      </div>
                    </div>
                    <div className="px-3 py-2 text-xs text-slate-700">{label}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-2.5 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Comments</div>
                <div className="text-[11px] text-slate-500">2 comments</div>
              </div>

              <div className="space-y-2">
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm">
                  <div className="mb-0.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span className="font-medium text-slate-700">{project.review.author}</span>
                    <span>{project.review.date}</span>
                  </div>
                  <StaticStars />
                  <p className="mt-0.5 whitespace-pre-line leading-5 text-slate-800">{project.review.text}</p>
                </div>

                <div className="ml-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm">
                  <div className="mb-0.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-700">Demo Contractor</span>
                      <span className="rounded-full bg-slate-900 px-2 py-[1px] text-[9px] font-semibold uppercase tracking-wide text-white">
                        Owner
                      </span>
                    </div>
                    <span>{project.review.date}</span>
                  </div>
                  <p className="whitespace-pre-line leading-5 text-slate-800">{project.review.reply}</p>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-3">
                <div className="rounded-xl border border-slate-200 bg-white/80 px-3 py-1.5 text-[11px] text-slate-600">
                  Public comments are text-only. No links or media. Emoji is okay.
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-[11px] font-medium text-slate-600">Rating (optional)</div>
                  <StaticStars rating={0} />
                </div>
                <textarea
                  rows={3}
                  readOnly
                  tabIndex={-1}
                  placeholder="Add a public comment..."
                  className="mt-2 min-h-[76px] w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
                />
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="text-[11px] text-slate-500">0/280</div>
                  <button
                    type="button"
                    aria-disabled="true"
                    className="h-10 cursor-default rounded-xl bg-slate-900 px-5 text-sm font-medium text-white"
                  >
                    Post
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function SampleBidPreview({ onClose }) {
  useModalLifecycle(onClose);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/65 px-3 py-4 backdrop-blur-sm sm:px-6 sm:py-8"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="mx-auto max-w-5xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sample-job-detail-title"
      >
        <div className="mb-0 flex min-h-14 items-center justify-between rounded-t-2xl bg-slate-50 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            <Badge className="bg-sky-100 text-[10px] font-semibold text-sky-800">Sample</Badge>
            <span>/</span>
            <span className="text-slate-700">Project</span>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-slate-600 hover:text-slate-900">
            &larr; Back
          </button>
        </div>

        <div className="mb-4 overflow-hidden rounded-b-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-white">
            <div className="px-5 py-5 sm:px-7 sm:py-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Project brief
                  </div>
                  <h1
                    id="sample-job-detail-title"
                    className="mt-2 text-2xl font-semibold leading-tight text-slate-950 sm:text-3xl"
                  >
                    {SAMPLE_JOB.title}
                  </h1>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                      {SAMPLE_JOB.category}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600">
                      Prepared by {SAMPLE_JOB.homeowner}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600">
                      {SAMPLE_JOB.postedDate}
                    </span>
                  </div>
                  <div className="mt-2">
                    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-semibold tracking-wide text-emerald-800">
                      JOB POSTING
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 text-slate-700">
                  <div className="flex items-center gap-1.5">
                    <span className="min-w-[1ch] text-[18px] font-medium text-slate-900">{SAMPLE_JOB.likes}</span>
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500">
                      <SymbolIcon name="favorite" className="text-[18px]" />
                    </span>
                  </div>
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500">
                    <SymbolIcon name="bookmark" className="text-[18px]" />
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-3 sm:px-7">
              <div className="flex flex-wrap items-center gap-2">
                <StaticProjectAction icon="print">Print</StaticProjectAction>
                <StaticProjectAction icon="download">Download PDF</StaticProjectAction>
                <StaticProjectAction icon="share">Share</StaticProjectAction>
                <StaticProjectAction icon="person">Profile</StaticProjectAction>
                <StaticProjectAction icon="chat_bubble">Message</StaticProjectAction>
                <StaticProjectAction icon="flag">Report</StaticProjectAction>
              </div>
            </div>
          </div>

          <div className="space-y-6 p-4 sm:p-7">
            <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Job overview</div>
              <p className="mt-3 text-sm leading-7 text-slate-700 sm:text-[15px]">{SAMPLE_JOB.summary}</p>

              <div className="mt-6 grid gap-y-5 border-t border-slate-200 pt-5 sm:grid-cols-2 xl:grid-cols-6 xl:gap-x-0">
                {[
                  ["Location", SAMPLE_JOB.location],
                  ["Budget", SAMPLE_JOB.budget],
                  ["Sq Ft", SAMPLE_JOB.sqf],
                  ["Posting type", SAMPLE_JOB.postingType],
                  ["Permits", SAMPLE_JOB.permits],
                  ["Posted", SAMPLE_JOB.postedDate],
                ].map(([label, value], index) => (
                  <div
                    key={label}
                    className={`min-w-0 xl:px-5 ${index > 0 ? "xl:border-l xl:border-slate-200" : ""}`}
                  >
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
                    {label === "Location" ? (
                      <span className="mt-1 inline-flex text-xs font-medium text-sky-700">Show map</span>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="mt-6 border-t border-slate-200 pt-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Requirements</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {SAMPLE_JOB.serviceCategories.map((category) => (
                    <span
                      key={category}
                      className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700"
                    >
                      {category}
                    </span>
                  ))}
                </div>

                <div className="mt-4 grid gap-3 text-sm text-slate-700 lg:grid-cols-2">
                  <div>
                    <span className="font-semibold text-slate-900">Required expertise:</span>{" "}
                    {SAMPLE_JOB.expertise}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Highlights:</span>{" "}
                    {SAMPLE_JOB.highlights}
                  </div>
                  <div className="lg:col-span-2">
                    <div className="font-semibold text-slate-900">Project requirements:</div>
                    <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                      {SAMPLE_JOB.details.map((item) => (
                        <li key={item} className="flex items-start gap-2 leading-6">
                          <SymbolIcon name="check_circle" fill={1} className="mt-1 text-[16px] text-emerald-600" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Your Bid</h2>
                  <p className="text-sm text-slate-500">Submit one bid for this project.</p>
                </div>
                <span className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700">Refresh</span>
              </div>
              <div className="flex justify-end">
                <span className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white">Send Bid</span>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Project media</div>
                <div className="text-[11px] text-slate-500">{SAMPLE_JOB.galleryLabels.length} media items</div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {SAMPLE_JOB.galleryLabels.map((label, index) => (
                  <div
                    key={label}
                    className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm"
                  >
                    <div className="relative h-40 w-full overflow-hidden bg-slate-100">
                      <GalleryImage
                        sheet={SAMPLE_JOB.gallery}
                        index={index}
                        label={label}
                        className="block h-full w-full bg-cover"
                      />
                      <div className="absolute left-2 top-2 rounded-md bg-white/90 px-2 py-1 text-[10px] font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200">
                        Image only
                      </div>
                    </div>
                    <div className="px-3 py-2 text-xs text-slate-700">{label}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-2.5 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Comments</div>
                <div className="text-[11px] text-slate-500">2 comments</div>
              </div>
              <div className="space-y-2">
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm">
                  <div className="mb-0.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span className="font-medium text-slate-700">{SAMPLE_JOB.review.author}</span>
                    <span>{SAMPLE_JOB.review.date}</span>
                  </div>
                  <StaticStars rating={0} />
                  <p className="mt-0.5 whitespace-pre-line leading-5 text-slate-800">{SAMPLE_JOB.review.text}</p>
                </div>
                <div className="ml-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm">
                  <div className="mb-0.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-700">{SAMPLE_JOB.homeowner}</span>
                      <span className="rounded-full bg-slate-900 px-2 py-[1px] text-[9px] font-semibold uppercase tracking-wide text-white">
                        Owner
                      </span>
                    </div>
                    <span>{SAMPLE_JOB.review.date}</span>
                  </div>
                  <p className="whitespace-pre-line leading-5 text-slate-800">{SAMPLE_JOB.review.reply}</p>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-3">
                <div className="rounded-xl border border-slate-200 bg-white/80 px-3 py-1.5 text-[11px] text-slate-600">
                  Public comments are text-only. No links or media. Emoji is okay.
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-[11px] font-medium text-slate-600">Rating (optional)</div>
                  <StaticStars rating={0} />
                </div>
                <textarea
                  rows={3}
                  readOnly
                  tabIndex={-1}
                  placeholder="Add a public comment..."
                  className="mt-2 min-h-[76px] w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
                />
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="text-[11px] text-slate-500">0/280</div>
                  <button
                    type="button"
                    aria-disabled="true"
                    className="h-10 cursor-default rounded-xl bg-slate-900 px-5 text-sm font-medium text-white"
                  >
                    Post
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function SampleJobCard({ onOpen }) {
  return (
    <article
      className="group cursor-pointer overflow-hidden rounded-2xl border border-white/60 bg-white/70 shadow-sm backdrop-blur-md transition hover:shadow-md"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Open ${SAMPLE_JOB.title}`}
    >
      <div className="relative h-44 bg-slate-100">
        <GalleryImage
          sheet={SAMPLE_JOB.gallery}
          index={0}
          label={SAMPLE_JOB.galleryLabels[0]}
          className="h-full w-full bg-cover transition-transform group-hover:scale-[1.02]"
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <Badge className="bg-slate-800 text-[11px] font-semibold text-white">Job posting</Badge>
        </div>
      </div>

      <div className="p-4">
        <h3 className="truncate text-sm font-semibold text-slate-900">{SAMPLE_JOB.title}</h3>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          <span>by {SAMPLE_JOB.homeowner}</span>
          <span className="mx-1 text-slate-300" aria-hidden="true">•</span>
          <span>{SAMPLE_JOB.location}</span>
          <span className="mx-1 text-slate-300" aria-hidden="true">•</span>
          <span className="font-semibold text-slate-600">{SAMPLE_JOB.distance}</span>
        </div>

        <p className="mt-2 line-clamp-2 text-xs text-slate-600">{SAMPLE_JOB.summary}</p>

        <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
          <div className="flex items-center justify-between gap-3 text-xs">
            <div className="text-slate-600">
              <span className="font-medium text-slate-800">0</span> total bids
            </div>
            <div className="font-medium text-slate-500">No open bids</div>
          </div>
        </div>
      </div>
    </article>
  );
}

function ProjectCard({ project, onOpen }) {
  return (
    <article
      className="cursor-pointer overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:border-slate-200 hover:shadow-md"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Open ${project.title}`}
    >
      <GalleryImage
        sheet={project.gallery}
        index={0}
        label={project.galleryLabels[0]}
        className="block h-36 w-full bg-cover"
      />

      <div className="p-4">
        <div className="mb-1 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-900">{project.title}</h3>
          </div>
          <Badge className="shrink-0 bg-slate-100 text-[10px] text-slate-600">{project.category}</Badge>
        </div>

        <p className="line-clamp-2 text-xs text-slate-600">{project.summary}</p>

        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-500">
          <div>
            <span className="text-slate-400">Location:</span> {project.location}
          </div>
          <div>
            <span className="text-slate-400">Budget:</span> {project.budget}
          </div>
          <div>
            <span className="text-slate-400">Sq Ft:</span> {project.sqf}
          </div>
          <div className="col-span-2 truncate">
            <span className="text-slate-400">Highlights:</span> {project.highlights}
          </div>
        </div>

        <div className="mt-3 flex w-full flex-nowrap gap-2">
          <button
            type="button"
            className="flex h-9 w-1/2 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            onClick={(event) => {
              event.stopPropagation();
              onOpen();
            }}
          >
            Open
          </button>
          <button
            type="button"
            className="flex h-9 w-1/2 items-center justify-center rounded-xl bg-slate-900 text-sm font-medium text-white transition hover:bg-slate-800"
            onClick={(event) => {
              event.stopPropagation();
              onOpen();
            }}
          >
            Edit
          </button>
        </div>
      </div>
    </article>
  );
}

export default function ContractorDashboardDemo({ isVisible, onCreateProject }) {
  const [activeProject, setActiveProject] = useState(null);
  const [showBidPreview, setShowBidPreview] = useState(false);

  if (!isVisible) return null;

  return (
    <>
      <section className="space-y-5" aria-labelledby="sample-dashboard-title">
        <div className="flex flex-col gap-4 rounded-2xl border border-sky-200 bg-sky-50 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-sky-700 shadow-sm">
              <SymbolIcon name="preview" className="text-[24px]" />
            </span>
            <div>
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <h2 id="sample-dashboard-title" className="text-xl font-bold text-slate-950 sm:text-2xl">
                  Your sample contractor dashboard
                </h2>
                <Badge className="bg-sky-700 text-[10px] font-semibold text-white">Sample data</Badge>
              </div>
              <p className="max-w-2xl text-sm leading-6 text-slate-600">
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

        <div className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur-md">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-900">Your Projects</div>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
              {SAMPLE_PROJECTS.length} shown
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SAMPLE_PROJECTS.map((project) => (
              <ProjectCard key={project.id} project={project} onOpen={() => setActiveProject(project)} />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur-md">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Job Opportunities</div>
              <div className="text-xs text-slate-500">A nearby homeowner project matching your services.</div>
            </div>
            <Badge className="shrink-0 bg-amber-100 text-[10px] font-semibold text-amber-800">New opportunity</Badge>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SampleJobCard onOpen={() => setShowBidPreview(true)} />
          </div>
        </div>
      </section>

      {activeProject ? (
        <SampleProjectPreview
          project={activeProject}
          onClose={() => setActiveProject(null)}
        />
      ) : null}
      {showBidPreview ? <SampleBidPreview onClose={() => setShowBidPreview(false)} /> : null}
    </>
  );
}
