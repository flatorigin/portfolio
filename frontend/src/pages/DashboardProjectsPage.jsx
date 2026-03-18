import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ProjectEditModal from "../components/projects/ProjectEditModal";

function useMediaQuery(query) {
  const getMatches = () =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false;

  const [matches, setMatches] = useState(getMatches);

  useEffect(() => {
    const media = window.matchMedia(query);
    const listener = () => setMatches(media.matches);

    listener();
    media.addEventListener("change", listener);

    return () => media.removeEventListener("change", listener);
  }, [query]);

  return matches;
}

export default function DashboardProjectsPage() {
  const navigate = useNavigate();
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeProject, setActiveProject] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadProjects() {
      try {
        setLoading(true);
        const res = await fetch("/api/projects/", { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load projects");
        const data = await res.json();
        if (!ignore) {
          setProjects(Array.isArray(data) ? data : data.results || []);
        }
      } catch (err) {
        if (!ignore) setProjects([]);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadProjects();
    return () => {
      ignore = true;
    };
  }, []);

  const sortedProjects = useMemo(() => {
    return [...projects];
  }, [projects]);

  function openEdit(project) {
    if (isDesktop) {
      setActiveProject(project);
      return;
    }
    navigate(`/dashboard/projects/${project.id}/edit`);
  }

  function closeEdit() {
    setActiveProject(null);
  }

  async function handleDesktopSubmit(values) {
    if (!activeProject?.id) return;

    try {
      setSaving(true);

      const res = await fetch(`/api/projects/${activeProject.id}/`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      if (!res.ok) throw new Error("Failed to save");

      const updated = await res.json();

      setProjects((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );

      closeEdit();
    } catch (err) {
      window.alert("Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Projects</h1>
        <p className="text-sm text-slate-500">
          Manage your portfolio projects without cluttering the list view.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Loading projects...</div>
        ) : sortedProjects.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">No projects yet.</div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {sortedProjects.map((project) => (
              <li
                key={project.id}
                className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-slate-900">
                    {project.title}
                  </h2>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                    <span>{project.location || "No location"}</span>
                    <span>Status: {project.status || "draft"}</span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/projects/${project.id}`)}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    View
                  </button>

                  <button
                    type="button"
                    onClick={() => openEdit(project)}
                    className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                  >
                    Edit
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ProjectEditModal
        open={Boolean(activeProject && isDesktop)}
        project={activeProject}
        onClose={closeEdit}
        onSubmit={handleDesktopSubmit}
        isSubmitting={saving}
      />
    </div>
  );
}