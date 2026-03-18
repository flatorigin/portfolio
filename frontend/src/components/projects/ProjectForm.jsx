import { useEffect, useMemo, useState } from "react";

const DEFAULT_VALUES = {
  title: "",
  location: "",
  budget: "",
  status: "draft",
  description: "",
};

export default function ProjectForm({
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitLabel = "Save Changes",
  cancelLabel = "Cancel",
}) {
  const startingValues = useMemo(
    () => ({ ...DEFAULT_VALUES, ...(initialValues || {}) }),
    [initialValues]
  );

  const [form, setForm] = useState(startingValues);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setForm(startingValues);
    setIsDirty(false);
  }, [startingValues]);

  useEffect(() => {
    const hasChanges =
      JSON.stringify(form) !== JSON.stringify(startingValues);
    setIsDirty(hasChanges);
  }, [form, startingValues]);

  useEffect(() => {
    const beforeUnload = (e) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [isDirty]);

  function updateField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    await onSubmit(form);
  }

  function handleCancel() {
    if (isDirty) {
      const confirmed = window.confirm(
        "You have unsaved changes. Leave without saving?"
      );
      if (!confirmed) return;
    }
    onCancel?.();
  }

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col">
      <div className="space-y-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Project title
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => updateField("title", e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none ring-0 focus:border-slate-500"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Location
          </label>
          <input
            type="text"
            value={form.location}
            onChange={(e) => updateField("location", e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none ring-0 focus:border-slate-500"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Budget
            </label>
            <input
              type="text"
              value={form.budget}
              onChange={(e) => updateField("budget", e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none ring-0 focus:border-slate-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Status
            </label>
            <select
              value={form.status}
              onChange={(e) => updateField("status", e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none ring-0 focus:border-slate-500"
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Description
          </label>
          <textarea
            value={form.description}
            onChange={(e) => updateField("description", e.target.value)}
            rows={6}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none ring-0 focus:border-slate-500"
          />
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={handleCancel}
          className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {cancelLabel}
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {isSubmitting ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}