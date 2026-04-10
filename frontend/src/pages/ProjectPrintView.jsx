import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api";

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

export default function ProjectPrintView() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState(null);
  const [images, setImages] = useState([]);

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
              caption: img.caption || "",
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

  const coverImage = useMemo(() => {
    const directCover = toUrl(project?.cover_image_url);
    if (directCover) return directCover;
    return images[0]?.url || "";
  }, [project?.cover_image_url, images]);

  const serviceCategoryList = Array.isArray(project?.service_categories)
    ? project.service_categories.filter((item) => String(item || "").trim())
    : [];

  if (loading) {
    return <div className="min-h-screen bg-[#FBF9F7] px-4 py-10 text-sm text-slate-500">Loading…</div>;
  }

  if (!project) {
    return <div className="min-h-screen bg-[#FBF9F7] px-4 py-10 text-sm text-slate-500">Project not found.</div>;
  }

  return (
    <div className="min-h-screen bg-[#FBF9F7] text-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-6 print:px-0 print:py-0">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link
            to={`/projects/${project.id}`}
            className="inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back to job post
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Print / Save PDF
          </button>
        </div>

        <article className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
          {coverImage ? (
            <div className="border-b border-slate-200 bg-slate-100">
              <img src={coverImage} alt={project.title || ""} className="h-[280px] w-full object-cover print:h-[220px]" />
            </div>
          ) : null}

          <div className="space-y-8 px-6 py-8 print:px-0">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                {project.is_job_posting ? <span>Job posting</span> : <span>Project</span>}
                {project.category ? <span>{project.category}</span> : null}
                {project.owner_username ? <span>by {project.owner_username}</span> : null}
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                {project.title || `Project #${project.id}`}
              </h1>
              <p className="max-w-3xl text-base leading-7 text-slate-700">
                {(project.job_summary || project.summary || "").trim() || "Project requirements will appear here."}
              </p>
            </div>

            <div className="grid gap-y-5 border-y border-slate-200 py-5 sm:grid-cols-2 xl:grid-cols-6 xl:gap-x-0">
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
                  className={"min-w-0 xl:px-5 " + (index > 0 ? "xl:border-l xl:border-slate-200" : "")}
                >
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
                </div>
              ))}
            </div>

            {(serviceCategoryList.length > 0 ||
              project.required_expertise ||
              project.highlights ||
              project.larger_project_details) && (
              <section className="space-y-4">
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

                <div className="grid gap-3 text-sm leading-7 text-slate-700">
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
                  {project.larger_project_details ? (
                    <div>
                      <span className="font-semibold text-slate-900">Context:</span> {project.larger_project_details}
                    </div>
                  ) : null}
                </div>
              </section>
            )}

            {images.length > 1 ? (
              <section className="space-y-4 print:hidden">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Additional media</div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {images.slice(0, 6).map((img, index) => (
                    <div key={`${img.url}-${index}`} className="overflow-hidden rounded-2xl bg-slate-100">
                      <img src={img.url} alt={img.caption || ""} className="h-40 w-full object-cover" />
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </article>
      </div>
    </div>
  );
}
