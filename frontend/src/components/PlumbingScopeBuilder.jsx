import LeaveEstimateButton from "./LeaveEstimateButton";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import api from "../api";
import { Button, Input, SymbolIcon, Textarea } from "../ui";
import PlumbingServicePicker from "./PlumbingServicePicker";
import {
  createPlumbingProject,
  createProjectSetup,
  estimateDraftTotal,
  newPlumbingDraft,
} from "../data/plumbingBundles2026_27";

const PENDING_KEY = "flatorigin:pending-plumbing-estimate";
const money = value => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value || 0));
const errorText = error => Object.entries(error.response?.data || {}).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(" ") : value}`).join(" ") || "Unable to complete the request.";

export default forwardRef(function PlumbingScopeBuilder({ estimateId, shareToken }, ref) {
  const navigate = useNavigate();
  const location = useLocation();
  const authed = !!localStorage.getItem("access");
  const [draft, setDraft] = useState(newPlumbingDraft);
  const [record, setRecord] = useState(null);
  const [calculation, setCalculation] = useState(null);
  const [loading, setLoading] = useState(Boolean(estimateId || shareToken));
  const [calculating, setCalculating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    let active = true;
    const url = shareToken ? `/estimates/shared/${shareToken}/` : estimateId ? `/estimates/${estimateId}/` : "";
    if (!url) {
      try {
        const pending = JSON.parse(localStorage.getItem(PENDING_KEY));
        if (pending?.inputs?.projects) setDraft(pending);
      } catch { /* Ignore an invalid local draft. */ }
      setLoading(false);
      return () => { active = false; };
    }
    api.get(url).then(({ data }) => {
      if (!active) return;
      setRecord(data);
      setDraft({
        project_name: data.project_name,
        issue_date: data.issue_date,
        valid_until: data.valid_until || "",
        status: data.status,
        contractor_notes: data.contractor_notes || "",
        inputs: data.inputs,
      });
      setCalculation(data.calculation);
      setShareUrl(`${window.location.origin}/plumbing-estimator/shared/${data.share_token}`);
    }).catch(error => { if (active) setNotice(errorText(error)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [estimateId, shareToken]);

  useEffect(() => {
    if (loading || !draft.inputs.projects.length) { setCalculation(null); return; }
    let active = true;
    setCalculating(true);
    const timer = setTimeout(() => api.post("/estimates/plumbing_preview/", draft.inputs).then(({ data }) => {
      if (active) { setCalculation(data); setNotice(""); }
    }).catch(error => { if (active) setNotice(errorText(error)); }).finally(() => { if (active) setCalculating(false); }), 250);
    return () => { active = false; clearTimeout(timer); };
  }, [draft.inputs, loading]);

  const role = record?.viewer_role || "homeowner";
  const canEdit = !shareToken || role === "homeowner" || role === "contractor";
  const baseline = record?.homeowner_snapshot || {};
  const baselinePrices = useMemo(() => {
    const map = new Map();
    for (const project of baseline.inputs?.projects || []) for (const item of project.line_items || []) map.set(item.id, Number(item.unit_price || 0));
    return map;
  }, [baseline]);
  const currentTotal = calculation ? Number(calculation.final_price) : estimateDraftTotal(draft.inputs.projects);
  const baselineTotal = Number(baseline.final_price || 0);

  const setInput = (key, value) => setDraft(current => ({ ...current, inputs: { ...current.inputs, [key]: value } }));
  const updateProject = (projectIndex, key, value) => setInput("projects", draft.inputs.projects.map((project, index) => index === projectIndex ? { ...project, [key]: value } : project));
  const updateLine = (projectIndex, lineIndex, key, value) => setInput("projects", draft.inputs.projects.map((project, index) => index === projectIndex ? {
    ...project,
    line_items: project.line_items.map((item, itemIndex) => itemIndex === lineIndex ? { ...item, [key]: value } : item),
  } : project));

  function addProject(serviceId) {
    if (!canEdit || loading) return false;
    const project = createPlumbingProject(serviceId);
    if (!project) return;
    setDraft(current => ({ ...current, inputs: { ...current.inputs, projects: current.inputs.projects.length ? [...current.inputs.projects, project] : [createProjectSetup(), project] } }));
    setCalculation(null);
    setNotice(`${project.name} added with its starting scope.`);
    return true;
  }

  useImperativeHandle(ref, () => ({ addProject }), [canEdit, loading]);

  function addCustomLine(projectIndex) {
    const project = draft.inputs.projects[projectIndex];
    updateProject(projectIndex, "line_items", [...project.line_items, {
      id: `line-custom-${crypto.randomUUID()}`, name: "Additional plumbing work", quantity: 1, unit: "allowance",
      unit_price: 0, homeowner_unit_price: 0, detail: "", required: false, included: true,
    }]);
  }

  async function save() {
    if (!draft.inputs.projects.length) { setNotice("Add at least one plumbing project first."); return null; }
    if (!authed) {
      localStorage.setItem(PENDING_KEY, JSON.stringify(draft));
      navigate(`/register?next=${encodeURIComponent("/plumbing-estimator")}`);
      return null;
    }
    setBusy(true);
    try {
      const contractor = role === "contractor";
      const payload = contractor
        ? { inputs: draft.inputs, contractor_notes: draft.contractor_notes, status: draft.status }
        : { estimate_type: "plumbing", project_name: draft.project_name, issue_date: draft.issue_date, valid_until: draft.valid_until || null, status: draft.status, inputs: draft.inputs, contractor_notes: draft.contractor_notes };
      const id = record?.id || estimateId;
      const { data } = await api[id ? "patch" : "post"](id ? `/estimates/${id}/` : "/estimates/", payload);
      setRecord(data); setCalculation(data.calculation); setNotice(contractor ? "Contractor revision saved." : "Plumbing estimate saved.");
      localStorage.removeItem(PENDING_KEY);
      if (!id) navigate(`/plumbing-estimator/${data.id}`, { replace: true });
      return data;
    } catch (error) { setNotice(errorText(error)); return null; } finally { setBusy(false); }
  }

  async function share() {
    if (!record?.id) { setNotice("Save the homeowner estimate before sharing it."); return; }
    setBusy(true);
    try {
      const { data } = await api.post(`/estimates/${record.id}/share/`);
      const url = `${window.location.origin}/plumbing-estimator/shared/${data.share_token}`;
      setRecord(data); setShareUrl(url); setNotice("Homeowner scope locked as the comparison baseline. Share this contractor link.");
      try { await navigator.clipboard.writeText(url); setNotice("Contractor link copied. The homeowner scope is locked as the comparison baseline."); } catch { /* Display the URL below. */ }
    } catch (error) { setNotice(errorText(error)); } finally { setBusy(false); }
  }

  async function claim() {
    if (!authed) { navigate(`/login?next=${encodeURIComponent(location.pathname)}`); return; }
    setBusy(true);
    try {
      const { data } = await api.post(`/estimates/shared/${shareToken}/claim/`);
      setRecord(data); setDraft(current => ({ ...current, inputs: data.inputs })); setNotice("Estimate accepted. You can now adjust quantities and unit prices.");
    } catch (error) { setNotice(errorText(error)); } finally { setBusy(false); }
  }

  async function returnRevision() {
    const saved = await save();
    if (!saved?.id) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/estimates/${saved.id}/return-revision/`);
      setRecord(data); setNotice("Revision returned to the homeowner with the original-price comparison preserved.");
    } catch (error) { setNotice(errorText(error)); } finally { setBusy(false); }
  }

  if (loading) return <div className="rounded-xl border border-stone-200 bg-white p-8 text-sm text-stone-500">Loading the shared plumbing scope…</div>;

  return <section id="scope-builder" className="scroll-mt-24 rounded-xl border border-stone-200 bg-white shadow-sm">
    <header className="border-b border-stone-200 bg-white p-5 text-stone-900 sm:p-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-900">Itemized project scope</div><h2 className="mt-2 text-2xl font-bold">Your plumbing project scope</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">Add services, review the included work, and adjust quantities before sharing with a plumber.</p></div>
        <div className="rounded-xl bg-stone-50 px-5 py-3 sm:text-right"><div className="text-xs text-stone-600">Current scope total</div><div className="mt-1 text-2xl font-bold text-stone-900">{calculating ? "Updating…" : money(currentTotal)}</div><div className="text-xs text-stone-400">Permits and township fees excluded</div></div>
      </div>
      {baselineTotal > 0 && <div className="mt-5 grid gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm sm:grid-cols-3"><div><span className="block text-xs text-stone-400">Homeowner baseline</span><strong>{money(baselineTotal)}</strong></div><div><span className="block text-xs text-stone-400">Current contractor price</span><strong>{money(currentTotal)}</strong></div><div><span className="block text-xs text-stone-400">Change</span><strong className={currentTotal > baselineTotal ? "text-stone-900" : "text-stone-900"}>{currentTotal >= baselineTotal ? "+" : ""}{money(currentTotal - baselineTotal)}</strong></div></div>}
    </header>

    <div className="space-y-6 p-5 sm:p-7">
      {role === "shared_viewer" && <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm leading-6 text-stone-900"><strong>This is the homeowner’s requested scope.</strong> Accept it as the contractor to adjust itemized quantities and pricing while preserving this original version.<div><Button type="button" onClick={claim} disabled={busy} className="mt-3">{authed ? "Accept and review as contractor" : "Sign in to review as contractor"}</Button></div></div>}
      {role === "contractor" && <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-900"><strong>Contractor editing:</strong> update only what the site conditions require. Every changed unit price is compared with the homeowner baseline.</div>}
      {role === "homeowner" && record?.workflow_status === "contractor_revised" && <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-900"><strong>The contractor returned a revision.</strong> Changed prices are marked beside the affected line items.</div>}

      {canEdit && <PlumbingServicePicker onAdd={addProject} />}

      {draft.inputs.projects.length ? <div className="space-y-4">{draft.inputs.projects.map((project, projectIndex) => <article key={project.id} className="overflow-hidden rounded-xl border border-stone-200">
        <div className="flex flex-col gap-3 bg-stone-50 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">{canEdit && project.service_id !== "project-setup" ? <Input value={project.name} onChange={event => updateProject(projectIndex, "name", event.target.value)} className="font-bold" /> : <h3 className="font-bold text-stone-950">{project.name}</h3>}<div className="mt-2">{canEdit ? <Input value={project.location} onChange={event => updateProject(projectIndex, "location", event.target.value)} placeholder="Room or location, such as garage north wall" className="text-sm" /> : project.location && <p className="text-sm text-stone-600">{project.location}</p>}</div></div>
          <strong className="shrink-0 text-lg">{money(project.line_items.reduce((sum, item) => sum + (item.included ? Number(item.quantity || 0) * Number(item.unit_price || 0) : 0), 0))}</strong>
          {canEdit && project.service_id !== "project-setup" && <button type="button" onClick={() => setInput("projects", draft.inputs.projects.filter((_, index) => index !== projectIndex))} className="text-sm font-semibold text-red-700">Remove</button>}
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-y border-stone-200 bg-white text-xs uppercase tracking-wide text-stone-500"><tr><th className="px-4 py-3">Include</th><th className="px-4 py-3">Required service</th><th className="px-4 py-3">Quantity</th><th className="px-4 py-3">Unit</th><th className="px-4 py-3 text-right">Unit price</th><th className="px-4 py-3 text-right">Total</th></tr></thead><tbody className="divide-y divide-stone-100">{project.line_items.map((item, lineIndex) => {
          const original = baselinePrices.get(item.id);
          const changed = original !== undefined && Number(item.unit_price) !== original;
          return <tr key={item.id} className={changed ? "bg-stone-50" : "bg-white"}><td className="px-4 py-3 align-top"><input type="checkbox" checked={item.included} disabled={!canEdit || item.required} onChange={event => updateLine(projectIndex, lineIndex, "included", event.target.checked)} className="h-4 w-4" /></td><td className="px-4 py-3 align-top"><div className="font-semibold text-stone-900">{item.name}</div><div className="mt-1 max-w-md text-xs leading-5 text-stone-500">{item.detail}</div>{changed && <div className="mt-1 text-xs font-semibold text-stone-700">Homeowner baseline: {money(original)} / {item.unit}</div>}</td><td className="px-4 py-3 align-top"><Input type="number" min="0" step="0.01" value={item.quantity} disabled={!canEdit} onChange={event => updateLine(projectIndex, lineIndex, "quantity", event.target.value)} className="w-24" /></td><td className="px-4 py-3 align-top text-stone-600">{item.unit}</td><td className="px-4 py-3 align-top"><Input type="number" min="0" step="0.01" value={item.unit_price} disabled={!canEdit} onChange={event => updateLine(projectIndex, lineIndex, "unit_price", event.target.value)} className="ml-auto w-28 text-right" /></td><td className="px-4 py-3 text-right align-top font-bold">{money(item.included ? Number(item.quantity || 0) * Number(item.unit_price || 0) : 0)}</td></tr>;
        })}</tbody></table></div>
        {canEdit && <div className="border-t border-stone-100 p-3"><button type="button" onClick={() => addCustomLine(projectIndex)} className="text-sm font-semibold text-stone-700 hover:text-stone-950">+ Add custom line item</button></div>}
      </article>)}</div> : <div className="rounded-xl border border-dashed border-stone-300 px-5 py-10 text-center"><SymbolIcon name="plumbing" className="text-[34px] text-stone-400" /><h3 className="mt-3 font-bold text-stone-950">No plumbing projects added</h3><p className="mt-1 text-sm text-stone-600">Choose a project above to receive its starting scope.</p></div>}

      {draft.inputs.projects.length > 0 && <div className="grid gap-4 rounded-xl border border-stone-200 p-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-stone-800"><span className="mb-1.5 block">Estimate name</span><Input value={draft.project_name} disabled={!canEdit || role === "contractor"} onChange={event => setDraft(current => ({ ...current, project_name: event.target.value }))} /></label>
        <label className="text-sm font-semibold text-stone-800"><span className="mb-1.5 block">Project address or area</span><Input value={draft.inputs.project_location} disabled={!canEdit} onChange={event => setInput("project_location", event.target.value)} /></label>
        <label className="text-sm font-semibold text-stone-800 sm:col-span-2"><span className="mb-1.5 block">{role === "contractor" ? "Contractor explanation for adjustments" : "Project notes"}</span><Textarea value={role === "contractor" ? draft.contractor_notes : draft.inputs.notes} disabled={!canEdit} onChange={event => role === "contractor" ? setDraft(current => ({ ...current, contractor_notes: event.target.value })) : setInput("notes", event.target.value)} className="min-h-24" /></label>
      </div>}

      <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm leading-6 text-stone-700"><strong>Excluded from this project price:</strong> permit fees, inspection fees, utility charges, township administration and filing legwork. Drywall, plaster and paint restoration are excluded unless added as a line item.</div>
      {notice && <div role="status" className="rounded-xl border border-stone-200 px-4 py-3 text-sm font-medium text-stone-700">{notice}</div>}
      {shareUrl && record?.workflow_status !== "owner_draft" && role === "homeowner" && <div className="rounded-xl border border-stone-200 bg-stone-50 p-4"><div className="text-sm font-bold text-stone-900">Contractor review link</div><div className="mt-2 flex flex-col gap-2 sm:flex-row"><Input readOnly value={shareUrl} className="bg-white text-sm" /><Button type="button" onClick={() => navigator.clipboard.writeText(shareUrl).then(() => setNotice("Contractor link copied."))}>Copy link</Button></div></div>}
      <div className="flex flex-wrap gap-2"><LeaveEstimateButton pendingKey={PENDING_KEY} disabled={busy} />
        {canEdit && <Button type="button" disabled={busy || calculating || !draft.inputs.projects.length} onClick={save}>{record?.id ? "Save itemized estimate" : authed ? "Save itemized estimate" : "Create account to save"}</Button>}
        {role === "homeowner" && record?.id && <button type="button" disabled={busy} onClick={share} className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-50">Share with contractor</button>}
        {role === "contractor" && <button type="button" disabled={busy || calculating} onClick={returnRevision} className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800">Save and return revision</button>}
        {shareToken && role === "homeowner" && <Link to={`/plumbing-estimator/${record.id}`} className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold">Open owner estimate</Link>}
      </div>
    </div>
  </section>;
});
