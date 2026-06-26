import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api";

const VIDEO_EXTENSIONS = /\.(mp4|mov|webm)(?:$|[?#])/i;

function toUrl(raw) {
  if (!raw) return "";

  const value = String(raw).trim();
  const hasProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value);
  const isAllowedProtocol = /^(https?:|data:|mailto:)/i.test(value);

  if (hasProtocol && !isAllowedProtocol) return "";
  if (/^https?:\/\//i.test(value)) return value;

  const base = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
  const origin = base.replace(/\/api\/?$/, "");

  return value.startsWith("/") ? `${origin}${value}` : `${origin}/${value}`;
}

function mediaTypeFor(item) {
  const url = item?.url || item?.image || item?.file || item?.src || "";
  if (
    item?.media_type === "video" ||
    item?.mediaType === "video" ||
    VIDEO_EXTENSIONS.test(String(url))
  ) {
    return "video";
  }
  return "image";
}

function formatPostedDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function chunkItems(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export default function ProjectPrintView() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState(null);
  const [images, setImages] = useState([]);
  const autoPrintStartedRef = useRef(false);

  useEffect(() => {
    let active = true;

    (async () => {
      if (!id) return;
      setLoading(true);
      try {
        const [{ data: meta }, { data: rawImages }] = await Promise.all([
          api.get(`/projects/${id}/`),
          api.get(`/projects/${id}/images/`).catch(() => ({ data: [] })),
        ]);

        if (!active) return;
        setProject(meta || null);
        setImages(
          (Array.isArray(rawImages) ? rawImages : [])
            .map((img) => ({
              url: toUrl(img.url || img.image || img.src || img.file),
              thumbnail: toUrl(img.thumbnail || img.thumb || ""),
              caption: img.caption || "",
              media_type: mediaTypeFor(img),
            }))
            .filter((img) => !!img.url)
        );
      } catch (err) {
        if (!active) return;
        console.error("[ProjectPrintView] failed to load project", err);
        setProject(null);
        setImages([]);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [id]);

  const serviceCategoryList = Array.isArray(project?.service_categories)
    ? project.service_categories.filter((item) => String(item || "").trim())
    : [];
  const jobSummaryText = (project?.job_summary || project?.summary || "").trim();
  const projectRequirementsText =
    project?.summary && project.summary.trim() !== jobSummaryText ? project.summary.trim() : "";
  const printableImages = images;
  const printableImagePages = chunkItems(printableImages, 4);

  useEffect(() => {
    if (loading || !project || autoPrintStartedRef.current) return;
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("download") !== "1") return;

    autoPrintStartedRef.current = true;
    const timer = window.setTimeout(() => window.print(), 450);
    return () => window.clearTimeout(timer);
  }, [loading, project]);

  if (loading) {
    return <div className="min-h-screen bg-[#FBF9F7] px-4 py-10 text-sm text-slate-500">Loading…</div>;
  }

  if (!project) {
    return <div className="min-h-screen bg-[#FBF9F7] px-4 py-10 text-sm text-slate-500">Project not found.</div>;
  }

  return (
    <div className="min-h-screen bg-[#FBF9F7] text-slate-900">
      <style>
        {`
          @page {
            size: A4;
            margin: 13mm;
          }

          @media print {
            html,
            body {
              background: #fff !important;
            }

            .pdf-sheet {
              width: 184mm;
              min-height: auto;
            }

            .pdf-first-page {
              break-after: auto;
            }

            .pdf-overview-table {
              break-inside: auto;
            }

            .pdf-overview-table thead {
              display: table-header-group;
            }

            .pdf-overview-table tbody {
              display: table-row-group;
            }

            .pdf-section {
              break-inside: avoid;
            }

            .pdf-media-page {
              break-before: page;
              break-after: page;
              min-height: 258mm;
            }

            .pdf-media-grid {
              display: grid !important;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              grid-template-rows: repeat(2, minmax(0, 1fr));
              gap: 8mm;
            }

            .pdf-media-item {
              break-inside: avoid;
              page-break-inside: avoid;
            }

            .pdf-media-img {
              height: 105mm;
              object-fit: contain;
            }
          }
        `}
      </style>
      <div className="mx-auto max-w-5xl px-4 py-6 print:px-0 print:py-0">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link
            to={`/projects/${project.id}`}
            className="inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back to job post
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Print
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Download PDF
            </button>
          </div>
        </div>

        <article className="pdf-sheet overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm print:overflow-visible print:rounded-none print:border-0 print:shadow-none">
          <div className="pdf-first-page space-y-5 px-6 py-7 print:px-0 print:py-0">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                {project.is_job_posting ? <span>Job posting</span> : <span>Project</span>}
                {project.category ? <span>{project.category}</span> : null}
                {project.owner_username ? <span>by {project.owner_username}</span> : null}
              </div>
              <h1 className="text-3xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-4xl print:text-[24pt]">
                {project.title || `Project #${project.id}`}
              </h1>
            </div>

            <div className="grid gap-y-4 border-y border-slate-200 py-4 sm:grid-cols-2 xl:grid-cols-6 xl:gap-x-0 print:grid-cols-3 print:gap-x-4 print:gap-y-3">
              {[
                ["Location", project.location || "—"],
                ["Budget", project.budget ?? "—"],
                ["Sq Ft", project.sqf ?? "—"],
                ["Posting type", project.is_private ? "Private invite-only job" : "Public job posting"],
                [
                  "Permits",
                  project.permit_required
                    ? `Required${project.permit_responsible_party ? ` · ${project.permit_responsible_party}` : ""}`
                    : "Not specified",
                ],
                ["Posted", formatPostedDate(project.created_at)],
              ].map(([label, value], index) => (
                <div
                  key={label}
                  className={
                    "min-w-0 xl:px-5 print:px-0 " +
                    (index > 0 ? "xl:border-l xl:border-slate-200 print:border-l-0" : "")
                  }
                >
                  <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 print:text-[10pt]">{value}</div>
                </div>
              ))}
            </div>

            <table className="pdf-overview-table w-full border-collapse">
              <thead>
                <tr>
                  <th className="bg-white pb-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Job overview
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="text-sm leading-7 text-slate-700 print:text-[10.5pt] print:leading-[1.55]">
                    <p className="whitespace-pre-line">
                      {jobSummaryText || "Project requirements will appear here."}
                    </p>
                    {project.larger_project_details ? (
                      <div className="mt-4 border-t border-slate-200 pt-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Context
                        </div>
                        <p className="mt-2 whitespace-pre-line">{project.larger_project_details}</p>
                      </div>
                    ) : null}
                  </td>
                </tr>
              </tbody>
            </table>

            {(serviceCategoryList.length > 0 ||
              project.required_expertise ||
              project.highlights ||
              projectRequirementsText) && (
              <section className="pdf-section space-y-4 pt-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Requirements</div>

                {serviceCategoryList.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {serviceCategoryList.map((item) => (
                      <span
                        key={item}
                        className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="grid gap-3 text-sm leading-7 text-slate-700 print:text-[10pt] print:leading-[1.55]">
                  {project.required_expertise ? (
                    <div>
                      <span className="font-semibold text-slate-900">Required expertise:</span> {project.required_expertise}
                    </div>
                  ) : null}
                  {project.highlights ? (
                    <div>
                      <span className="font-semibold text-slate-900">Highlights:</span> {project.highlights}
                    </div>
                  ) : null}
                  {projectRequirementsText ? (
                    <div>
                      <div className="font-semibold text-slate-900">Project requirements:</div>
                      <p className="mt-1 whitespace-pre-line leading-6 text-slate-700">
                        {projectRequirementsText}
                      </p>
                    </div>
                  ) : null}
                </div>
              </section>
            )}
          </div>

          {printableImagePages.length > 0 ? (
            <section className="space-y-6 px-6 pb-7 print:px-0 print:pb-0">
              {printableImagePages.map((pageImages, pageIndex) => (
                <div key={`media-page-${pageIndex}`} className="pdf-media-page space-y-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Project media {printableImagePages.length > 1 ? `${pageIndex + 1}/${printableImagePages.length}` : ""}
                  </div>
                  <div className="pdf-media-grid grid grid-cols-1 gap-4 md:grid-cols-2">
                    {pageImages.map((img, index) => (
                    <div
                      key={`${img.url}-${index}`}
                      className="pdf-media-item break-inside-avoid overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 print:rounded-none print:border print:border-slate-200 print:bg-white"
                    >
                      <img
                        src={img.url}
                        alt={img.caption || ""}
                        className="pdf-media-img max-h-[520px] w-full object-contain"
                      />
                      {img.caption ? (
                        <div className="border-t border-slate-200 px-3 py-2 text-xs text-slate-600 print:px-0">
                          {img.caption}
                        </div>
                      ) : null}
                    </div>
                  ))}
                  </div>
                </div>
              ))}
            </section>
          ) : null}
        </article>
      </div>
    </div>
  );
}
