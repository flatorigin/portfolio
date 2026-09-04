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
  timeline: "Flexible start; complete within 3-4 weeks",
  category: "General Contractor",
  posted: "Posted 2 days ago",
  summary:
    "We want to widen or remove the wall between our kitchen and dining room so the first floor feels more open. We need help confirming whether the wall is load-bearing and completing all framing, electrical, drywall, trim, and paint work.",
  details: [
    "Evaluate the wall and confirm structural requirements",
    "Relocate the outlet and any wiring affected by the opening",
    "Install the required header and complete framing",
    "Repair flooring, drywall, ceiling, trim, and paint at the opening",
  ],
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
        backgroundSize: "200% 200%",
      }}
    />
  );
}

function Gallery({ item, activeIndex, onSelect }) {
  return (
    <div>
      <GalleryImage
        sheet={item.gallery}
        index={activeIndex}
        label={item.galleryLabels[activeIndex]}
        className="aspect-[3/2] w-full rounded-xl border border-slate-100 bg-cover"
      />
      <div className="mt-2 grid grid-cols-4 gap-2">
        {item.galleryLabels.map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => onSelect(index)}
            className={`overflow-hidden rounded-lg border-2 transition ${
              activeIndex === index
                ? "border-slate-900"
                : "border-transparent hover:border-slate-300"
            }`}
            aria-label={`View ${label.toLowerCase()}`}
            aria-pressed={activeIndex === index}
          >
            <GalleryImage
              sheet={item.gallery}
              index={index}
              label=""
              className="aspect-[3/2] w-full bg-cover"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function DemoModal({ title, eyebrow, onClose, children }) {
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-white/60 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="contractor-demo-modal-title"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Badge className="bg-sky-100 text-[10px] font-semibold text-sky-800">Sample</Badge>
              <span className="text-xs text-slate-500">{eyebrow}</span>
            </div>
            <h2 id="contractor-demo-modal-title" className="text-lg font-semibold text-slate-900 sm:text-xl">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50"
            aria-label="Close preview"
            title="Close"
          >
            <SymbolIcon name="close" className="text-[20px]" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SampleProjectPreview({ project, onClose, onCreateProject }) {
  const [activeImage, setActiveImage] = useState(0);

  return (
    <DemoModal title={project.title} eyebrow="Portfolio project preview" onClose={onClose}>
      <div className="grid gap-6 p-5 lg:grid-cols-[1.15fr_0.85fr]">
        <Gallery item={project} activeIndex={activeImage} onSelect={setActiveImage} />

        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-emerald-50 text-emerald-700">Completed</Badge>
            <Badge className="bg-slate-100 text-slate-600">{project.category}</Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-3">
              <SymbolIcon name="location_on" className="text-[18px] text-slate-500" />
              <div>
                <div className="text-xs text-slate-400">Location</div>
                <div className="font-medium text-slate-800">{project.location}</div>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-3">
              <SymbolIcon name="payments" className="text-[18px] text-slate-500" />
              <div>
                <div className="text-xs text-slate-400">Project value</div>
                <div className="font-medium text-slate-800">{project.budget}</div>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-3">
              <SymbolIcon name="square_foot" className="text-[18px] text-slate-500" />
              <div>
                <div className="text-xs text-slate-400">Project size</div>
                <div className="font-medium text-slate-800">{project.sqf}</div>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-3">
              <SymbolIcon name="event_available" className="text-[18px] text-slate-500" />
              <div>
                <div className="text-xs text-slate-400">Status</div>
                <div className="font-medium text-slate-800">{project.completed}</div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900">Project description</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{project.description}</p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900">Scope completed</h3>
            <ul className="mt-2 space-y-2">
              {project.scope.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm leading-5 text-slate-600">
                  <SymbolIcon name="check_circle" className="mt-0.5 text-[17px] text-emerald-600" fill={1} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
              <SymbolIcon name="handyman" className="text-[17px]" />
              Materials and finishes
            </div>
            <p className="mt-2 text-sm text-slate-700">{project.materials}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Close
        </button>
        <button
          type="button"
          onClick={() => {
            onClose();
            onCreateProject();
          }}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          <SymbolIcon name="add" className="text-[19px]" />
          Create your project
        </button>
      </div>
    </DemoModal>
  );
}

function SampleBidPreview({ onClose }) {
  const [activeImage, setActiveImage] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    amount: "14,500",
    timeline: "2-3 weeks after permit approval",
    proposal:
      "I would begin with a site visit to verify the wall conditions, utilities, and structural requirements. After engineering confirmation, our crew can complete the opening, rough work, and finish repairs as one coordinated scope.",
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
    <DemoModal title={SAMPLE_JOB.title} eyebrow="Sample homeowner job - nothing will be submitted" onClose={onClose}>
      <div className="grid gap-6 p-5 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-5">
          <Gallery item={SAMPLE_JOB} activeIndex={activeImage} onSelect={setActiveImage} />

          <div>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-amber-100 text-amber-800">Accepting bids</Badge>
              <Badge className="bg-slate-100 text-slate-600">{SAMPLE_JOB.category}</Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-700">{SAMPLE_JOB.summary}</p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900">Requested scope</h3>
            <ul className="mt-2 space-y-2">
              {SAMPLE_JOB.details.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm leading-5 text-slate-600">
                  <SymbolIcon name="check" className="mt-0.5 text-[17px] text-slate-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div>
          <div className="grid grid-cols-2 gap-3 border-b border-slate-100 pb-5 text-sm">
            <div>
              <div className="text-xs text-slate-400">Homeowner</div>
              <div className="mt-1 font-medium text-slate-800">{SAMPLE_JOB.homeowner}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Location</div>
              <div className="mt-1 font-medium text-slate-800">{SAMPLE_JOB.location}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Expected budget</div>
              <div className="mt-1 font-medium text-slate-800">{SAMPLE_JOB.budget}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Timing</div>
              <div className="mt-1 font-medium text-slate-800">{SAMPLE_JOB.timeline}</div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="flex items-center gap-2">
              <SymbolIcon name="request_quote" className="text-[21px] text-slate-600" />
              <h3 className="text-base font-semibold text-slate-900">Your bid</h3>
            </div>

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
                rows={6}
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

            <button
              type="submit"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <SymbolIcon name="send" className="text-[18px]" />
              Preview bid submission
            </button>
          </form>
        </div>
      </div>
    </DemoModal>
  );
}

function ProjectCard({ project, onOpen }) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:border-slate-200 hover:shadow-md">
      <button type="button" onClick={onOpen} className="block w-full text-left" aria-label={`Open ${project.title}`}>
        <GalleryImage
          sheet={project.gallery}
          index={0}
          label={project.galleryLabels[0]}
          className="h-36 w-full bg-cover"
        />
        <div className="grid h-12 grid-cols-3 gap-px bg-white">
          {[1, 2, 3].map((index) => (
            <GalleryImage
              key={project.galleryLabels[index]}
              sheet={project.gallery}
              index={index}
              label={project.galleryLabels[index]}
              className="h-full w-full bg-cover"
            />
          ))}
        </div>
      </button>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-1 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-900">{project.title}</h3>
            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
              <SymbolIcon name="location_on" className="text-[14px]" />
              {project.location}
            </div>
          </div>
          <Badge className="shrink-0 bg-emerald-50 text-[10px] font-medium text-emerald-700">Completed</Badge>
        </div>

        <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-600">{project.summary}</p>

        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
          <div className="inline-flex items-center gap-1">
            <SymbolIcon name="payments" className="text-[14px]" />
            {project.budget}
          </div>
          <div className="inline-flex items-center gap-1">
            <SymbolIcon name="square_foot" className="text-[14px]" />
            {project.sqf}
          </div>
          <div className="col-span-2 inline-flex items-center gap-1 truncate">
            <SymbolIcon name="category" className="text-[14px]" />
            {project.category}
          </div>
        </div>

        <button
          type="button"
          onClick={onOpen}
          className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          <SymbolIcon name="folder_open" className="text-[18px]" />
          Open project
        </button>
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
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Your Projects</div>
              <div className="text-xs text-slate-500">Open any sample to review its photos, scope, materials, and project details.</div>
            </div>
            <span className="shrink-0 text-xs font-medium text-slate-500">3 samples</span>
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

          <article className="grid overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm md:grid-cols-[260px_1fr]">
            <button
              type="button"
              onClick={() => setShowBidPreview(true)}
              className="block w-full text-left"
              aria-label={`Open ${SAMPLE_JOB.title}`}
            >
              <GalleryImage
                sheet={SAMPLE_JOB.gallery}
                index={0}
                label={SAMPLE_JOB.galleryLabels[0]}
                className="h-44 w-full bg-cover md:h-full"
              />
            </button>

            <div className="flex flex-col p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    <span>{SAMPLE_JOB.posted}</span>
                    <span aria-hidden="true">|</span>
                    <span>Posted by {SAMPLE_JOB.homeowner}</span>
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">{SAMPLE_JOB.title}</h3>
                </div>
                <Badge className="bg-slate-100 text-[10px] text-slate-600">{SAMPLE_JOB.category}</Badge>
              </div>

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <SymbolIcon name="location_on" className="text-[15px]" />
                  {SAMPLE_JOB.location}
                </span>
                <span className="inline-flex items-center gap-1">
                  <SymbolIcon name="payments" className="text-[15px]" />
                  {SAMPLE_JOB.budget}
                </span>
                <span className="inline-flex items-center gap-1">
                  <SymbolIcon name="schedule" className="text-[15px]" />
                  Flexible start
                </span>
                <span className="inline-flex items-center gap-1">
                  <SymbolIcon name="photo_library" className="text-[15px]" />
                  4 photos
                </span>
              </div>

              <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{SAMPLE_JOB.summary}</p>

              <div className="mt-auto flex justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setShowBidPreview(true)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  <SymbolIcon name="request_quote" className="text-[19px]" />
                  Open job &amp; practice bidding
                </button>
              </div>
            </div>
          </article>
        </div>
      </section>

      {activeProject ? (
        <SampleProjectPreview
          project={activeProject}
          onClose={() => setActiveProject(null)}
          onCreateProject={onCreateProject}
        />
      ) : null}
      {showBidPreview ? <SampleBidPreview onClose={() => setShowBidPreview(false)} /> : null}
    </>
  );
}
