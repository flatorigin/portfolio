import { useEffect } from "react";
import ProjectForm from "./ProjectForm";

export default function ProjectEditModal({
  open,
  project,
  onClose,
  onSubmit,
  isSubmitting = false,
}) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open || !project) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close edit modal"
        className="absolute inset-0 bg-slate-950/40"
        onClick={onClose}
      />

      <div className="absolute inset-x-0 top-1/2 mx-auto w-[min(720px,calc(100%-2rem))] -translate-y-1/2">
        <div className="max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Edit Project
              </h2>
              <p className="text-sm text-slate-500">{project.title}</p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              Close
            </button>
          </div>

          <div className="max-h-[calc(85vh-76px)] overflow-y-auto px-6 py-5">
            <ProjectForm
              initialValues={project}
              onSubmit={onSubmit}
              onCancel={onClose}
              isSubmitting={isSubmitting}
            />
          </div>
        </div>
      </div>
    </div>
  );
}