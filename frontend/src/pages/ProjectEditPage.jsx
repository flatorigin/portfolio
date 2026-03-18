import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ProjectForm from "../components/projects/ProjectForm";

export default function ProjectEditPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadProject() {
      try {
        setLoading(true);
        setNotFound(false);

        const res = await fetch(`/api/projects/${projectId}/`, {
          credentials: "include",
        });

        if (res.status === 404) {
          if (!ignore) setNotFound(true);
          return;
        }

        if (!res.ok) {
          throw new Error("Failed to load project");
        }

        const data = await res.json();
        if (!ignore) setProject(data);
      } catch (err) {
        if (!ignore) setNotFound(true);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadProject();
    return () => {
      ignore = true;
    };
  }, [projectId]);

  const pageTitle = useMemo(() => {
    if (!project?.title) return "Edit Project";
    return `Edit ${project.title}`;
  }, [project]);

  async function handleSubmit(values) {
    try {
      setSaving(true);

      const res = await fetch(`/api/projects/${projectId}/`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        throw new Error("Failed to save project");
      }

      navigate("/dashboard/projects", { replace: true });
    } catch (err) {
      window.alert("Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    navigate("/dashboard/projects");
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <p className="text-sm text-slate-500">Loading project...</p>
      </div>
    );
  }

  if (notFound || !project) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="text-xl font-semibold text-slate-900">Project not found</h1>
        <p className="mt-2 text-sm text-slate-600">
          This project does not exist or you do not have access to it.
        </p>
        <button
          type="button"
          onClick={() => navigate("/dashboard/projects")}
          className="mt-5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
        >
          Back to projects
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{pageTitle}</h1>
          <p className="text-sm text-slate-500">Update project details</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <ProjectForm
          initialValues={project}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={saving}
        />
      </div>
    </div>
  );
}