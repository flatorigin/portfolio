import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../api";
import {
  calculatePaintingEstimate,
  createDefaultPaintingInputs,
} from "../estimators/painting";
import { Button, Container, Input, SymbolIcon, Textarea } from "../ui";


const PENDING_ESTIMATE_KEY = "flatorigin:pending-painting-estimate";


function localDateString(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}


function dateAfter(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateString(date);
}


function createDraft() {
  return {
    project_name: "Interior painting estimate",
    issue_date: localDateString(),
    valid_until: dateAfter(30),
    inputs: createDefaultPaintingInputs(),
  };
}


function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}


function readableDate(value) {
  if (!value) return "Not set";
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}


function FieldLabel({ children }) {
  return <div className="mb-1.5 text-sm font-medium text-slate-700">{children}</div>;
}


function ToggleChoice({ checked, onChange, label, description }) {
  return (
    <label
      className={[
        "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition",
        checked
          ? "border-slate-400 bg-slate-50"
          : "border-slate-200 bg-white hover:border-slate-300",
      ].join(" ")}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 accent-slate-900"
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-900">{label}</span>
        <span className="mt-0.5 block text-xs leading-5 text-slate-500">{description}</span>
      </span>
    </label>
  );
}


function SegmentedControl({ value, onChange, options, label }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="grid grid-cols-2 rounded-xl border border-slate-200 bg-slate-100 p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={[
              "min-h-10 rounded-lg px-3 text-sm font-medium transition",
              value === option.value
                ? "bg-white text-slate-950 shadow-sm"
                : "text-slate-500 hover:text-slate-800",
            ].join(" ")}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}


function CustomItemEditor({ item, index, onChange, onRemove }) {
  const update = (field, value) => onChange(index, { ...item, [field]: value });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-900">Additional item {index + 1}</div>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-red-50 hover:text-red-700"
          aria-label={`Remove additional item ${index + 1}`}
          title="Remove item"
        >
          <SymbolIcon name="delete" className="text-[19px]" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <FieldLabel>Item name</FieldLabel>
          <Input
            value={item.name}
            onChange={(event) => update("name", event.target.value)}
            placeholder="Door painting"
          />
        </label>
        <label>
          <FieldLabel>Material</FieldLabel>
          <Input
            value={item.material}
            onChange={(event) => update("material", event.target.value)}
            placeholder="Interior enamel"
          />
        </label>
        <label className="sm:col-span-2">
          <FieldLabel>Description</FieldLabel>
          <Input
            value={item.description}
            onChange={(event) => update("description", event.target.value)}
            placeholder="Prepare and paint doors and frames"
          />
        </label>
        <label>
          <FieldLabel>Quantity</FieldLabel>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            value={item.quantity}
            onChange={(event) => update("quantity", event.target.value)}
          />
        </label>
        <label>
          <FieldLabel>Unit</FieldLabel>
          <Input
            value={item.unit}
            onChange={(event) => update("unit", event.target.value)}
            placeholder="each"
          />
        </label>
        <label>
          <FieldLabel>Unit price</FieldLabel>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">$</span>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={item.unit_price}
              onChange={(event) => update("unit_price", event.target.value)}
              className="pl-7"
            />
          </div>
        </label>
        <label>
          <FieldLabel>Labor</FieldLabel>
          <Input
            value={item.labor_note}
            onChange={(event) => update("labor_note", event.target.value)}
            placeholder="Included"
          />
        </label>
      </div>
    </div>
  );
}


function EstimatePreview({ draft, calculation, estimateNumber }) {
  const inputs = draft.inputs;
  const supplierLabels = {
    contractor: "Materials supplied by issuer",
    client: "Materials supplied by client",
    not_specified: "Material supplier to be confirmed",
  };

  return (
    <section aria-label="Estimate preview" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-5 sm:px-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">FlatOrigin Estimate</div>
            <h2 className="mt-2 break-words text-2xl font-bold text-slate-950">{draft.project_name || "Untitled estimate"}</h2>
            <div className="mt-2 text-sm text-slate-500">Estimate #{estimateNumber || "FO-DRAFT"}</div>
          </div>
          <div className="text-sm leading-6 text-slate-600 sm:text-right">
            <div><span className="font-medium text-slate-900">Issued:</span> {readableDate(draft.issue_date)}</div>
            <div><span className="font-medium text-slate-900">Valid until:</span> {readableDate(draft.valid_until)}</div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Prepared by</div>
            <div className="mt-1 text-sm font-medium text-slate-900">{inputs.prepared_by || "Issuing user"}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Prepared for</div>
            <div className="mt-1 text-sm font-medium text-slate-900">{inputs.client_name || "Client to be confirmed"}</div>
            {inputs.project_location ? <div className="mt-0.5 text-sm text-slate-500">{inputs.project_location}</div> : null}
          </div>
        </div>
      </div>

      <div className="divide-y divide-slate-100 sm:hidden">
        {calculation.line_items.map((item) => (
          <article key={item.code} className="px-4 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 font-semibold text-slate-950">{item.name}</div>
              <div className="shrink-0 font-semibold text-slate-950">{money(item.amount)}</div>
            </div>
            <p className="mt-1 break-words text-sm leading-5 text-slate-600">{item.description || "-"}</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
              <div className="min-w-0">
                <dt className="font-semibold uppercase text-slate-400">Quantity</dt>
                <dd className="mt-1 break-words text-slate-700">{item.quantity} {item.unit}</dd>
              </div>
              <div className="min-w-0 text-right">
                <dt className="font-semibold uppercase text-slate-400">Rate</dt>
                <dd className="mt-1 text-slate-700">{money(item.rate)}</dd>
              </div>
              <div className="col-span-2 min-w-0">
                <dt className="font-semibold uppercase text-slate-400">Material</dt>
                <dd className="mt-1 break-words text-slate-700">{item.material || "-"}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3 sm:px-7">Item</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">Material</th>
              <th className="px-4 py-3 text-right">Rate</th>
              <th className="px-5 py-3 text-right sm:px-7">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm text-slate-600">
            {calculation.line_items.map((item) => (
              <tr key={item.code}>
                <td className="px-5 py-4 font-semibold text-slate-900 sm:px-7">{item.name}</td>
                <td className="max-w-[260px] px-4 py-4 leading-5">{item.description || "-"}</td>
                <td className="whitespace-nowrap px-4 py-4">{item.quantity} {item.unit}</td>
                <td className="px-4 py-4">{item.material || "-"}</td>
                <td className="whitespace-nowrap px-4 py-4 text-right">{money(item.rate)}</td>
                <td className="whitespace-nowrap px-5 py-4 text-right font-medium text-slate-900 sm:px-7">{money(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-6 border-t border-slate-200 px-5 py-5 sm:grid-cols-[1fr_260px] sm:px-7">
        <div className="text-sm leading-6 text-slate-600">
          <div className="font-medium text-slate-900">Estimate assumptions</div>
          <div className="mt-1">{supplierLabels[inputs.material_supplier]}</div>
          <div>{inputs.paint_tier === "premium" ? "Premium" : "Standard"} paint allowance</div>
          <div>{inputs.wall_height || 8} ft wall and ceiling height</div>
          {inputs.surfaces.walls ? <div>{money(inputs.wall_unit_price || 3)} wall base rate per sq ft</div> : null}
          {inputs.surfaces.ceilings ? <div>{money(inputs.ceiling_unit_price || 2)} ceiling base rate per sq ft</div> : null}
          {Number(calculation.assumptions?.ceiling_access_surcharge_percent) > 0 ? (
            <div>{calculation.assumptions.ceiling_access_surcharge_percent}% high-ceiling access and protection allowance</div>
          ) : null}
          {inputs.notes ? <p className="mt-3 whitespace-pre-wrap">{inputs.notes}</p> : null}
        </div>
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-5">
            <dt className="text-slate-500">Subtotal</dt>
            <dd className="font-medium text-slate-900">{money(calculation.subtotal)}</dd>
          </div>
          <div className="flex items-center justify-between gap-5">
            <dt className="text-slate-500">Discount</dt>
            <dd className="font-medium text-slate-900">-{money(calculation.discount_amount)}</dd>
          </div>
          <div className="flex items-center justify-between gap-5 border-t border-slate-200 pt-3">
            <dt className="font-semibold text-slate-950">Estimated total</dt>
            <dd className="text-xl font-bold text-slate-950">{money(calculation.final_price)}</dd>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
            Planning range: {money(calculation.range_low)} - {money(calculation.range_high)}
          </div>
        </dl>
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 text-xs leading-5 text-slate-500 sm:px-7">
        <div className="font-semibold text-slate-700">Created with FlatOrigin.com</div>
        <div className="mt-1">
          This estimate was prepared by the issuing user using FlatOrigin tools. FlatOrigin does not set, verify, endorse, or guarantee the pricing or terms shown.
        </div>
      </div>
    </section>
  );
}


export default function ProjectEstimator() {
  const navigate = useNavigate();
  const authed = !!localStorage.getItem("access");
  const [draft, setDraft] = useState(createDraft);
  const [savedEstimates, setSavedEstimates] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [serverCalculation, setServerCalculation] = useState(null);
  const [loading, setLoading] = useState(authed);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const liveCalculation = useMemo(
    () => calculatePaintingEstimate(draft.inputs),
    [draft.inputs]
  );
  const calculation = serverCalculation || liveCalculation;
  const activeEstimate = savedEstimates.find((estimate) => estimate.id === activeId);

  useEffect(() => {
    const pending = localStorage.getItem(PENDING_ESTIMATE_KEY);
    if (pending) {
      try {
        const parsed = JSON.parse(pending);
        if (parsed?.inputs && parsed?.project_name) setDraft(parsed);
      } catch {
        localStorage.removeItem(PENDING_ESTIMATE_KEY);
      }
    }

    if (!authed) return;
    let cancelled = false;
    (async () => {
      try {
        const [{ data: estimateData }, profileResponse] = await Promise.all([
          api.get("/estimates/"),
          api.get("/users/me/").catch(() => ({ data: null })),
        ]);
        if (!cancelled) {
          setSavedEstimates(
            Array.isArray(estimateData) ? estimateData : estimateData?.results || []
          );
          const profileName =
            profileResponse?.data?.display_name || profileResponse?.data?.username || "";
          if (profileName) {
            setDraft((current) => current.inputs.prepared_by ? current : {
              ...current,
              inputs: { ...current.inputs, prepared_by: profileName },
            });
          }
        }
      } catch (requestError) {
        if (!cancelled) setError(requestError?.response?.data?.detail || "Saved estimates could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authed]);

  const updateDraft = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setServerCalculation(null);
    setNotice("");
  };

  const updateInputs = (field, value) => {
    setDraft((current) => ({
      ...current,
      inputs: { ...current.inputs, [field]: value },
    }));
    setServerCalculation(null);
    setNotice("");
  };

  const updateSurface = (surface, value) => {
    updateInputs("surfaces", { ...draft.inputs.surfaces, [surface]: value });
  };

  const addCustomItem = () => {
    updateInputs("custom_items", [
      ...draft.inputs.custom_items,
      {
        name: "",
        description: "",
        quantity: "1",
        unit: "each",
        material: "",
        labor_note: "Included",
        unit_price: "0",
      },
    ]);
  };

  const updateCustomItem = (index, item) => {
    updateInputs(
      "custom_items",
      draft.inputs.custom_items.map((current, itemIndex) => itemIndex === index ? item : current)
    );
  };

  const removeCustomItem = (index) => {
    updateInputs(
      "custom_items",
      draft.inputs.custom_items.filter((_, itemIndex) => itemIndex !== index)
    );
  };

  const validateDraft = () => {
    if (!draft.project_name.trim()) return "Enter a project or estimate name.";
    if (Number(draft.inputs.space_size) <= 0) return "Enter a floor area greater than zero.";
    if (Number(draft.inputs.wall_height ?? 8) < 6 || Number(draft.inputs.wall_height ?? 8) > 40) {
      return "Enter a wall and ceiling height from 6 to 40 feet.";
    }
    if (draft.inputs.surfaces.walls && (Number(draft.inputs.wall_unit_price ?? 3) < 2 || Number(draft.inputs.wall_unit_price ?? 3) > 6)) {
      return "Enter a wall unit price from $2.00 to $6.00 per square foot.";
    }
    if (draft.inputs.surfaces.ceilings && (Number(draft.inputs.ceiling_unit_price ?? 2) < 2 || Number(draft.inputs.ceiling_unit_price ?? 2) > 6)) {
      return "Enter a ceiling unit price from $2.00 to $6.00 per square foot.";
    }
    if (
      !Object.values(draft.inputs.surfaces).some(Boolean) &&
      draft.inputs.custom_items.length === 0
    ) {
      return "Choose at least one surface or add an additional item.";
    }
    if (draft.inputs.custom_items.some((item) => !item.name.trim())) {
      return "Give every additional item a name before saving.";
    }
    return "";
  };

  const saveEstimate = async () => {
    setError("");
    setNotice("");
    const validationError = validateDraft();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!authed) {
      localStorage.setItem(PENDING_ESTIMATE_KEY, JSON.stringify(draft));
      navigate("/register?next=/project-estimator");
      return;
    }

    setBusy(true);
    try {
      const payload = {
        estimate_type: "painting",
        project_name: draft.project_name.trim(),
        issue_date: draft.issue_date,
        valid_until: draft.valid_until || null,
        inputs: draft.inputs,
      };
      const response = activeId
        ? await api.patch(`/estimates/${activeId}/`, payload)
        : await api.post("/estimates/", payload);
      const saved = response.data;
      setSavedEstimates((current) => [
        saved,
        ...current.filter((estimate) => estimate.id !== saved.id),
      ]);
      setActiveId(saved.id);
      setDraft({
        project_name: saved.project_name,
        issue_date: saved.issue_date,
        valid_until: saved.valid_until || "",
        inputs: saved.inputs,
      });
      setServerCalculation(saved.calculation);
      localStorage.removeItem(PENDING_ESTIMATE_KEY);
      setNotice(activeId ? "Estimate updated." : "Estimate saved to your account.");
    } catch (requestError) {
      const data = requestError?.response?.data;
      const message =
        data?.detail ||
        (data && typeof data === "object" ? Object.values(data).flat().join(" ") : "") ||
        "The estimate could not be saved.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const openEstimate = (estimate) => {
    setActiveId(estimate.id);
    setDraft({
      project_name: estimate.project_name,
      issue_date: estimate.issue_date,
      valid_until: estimate.valid_until || "",
      inputs: estimate.inputs,
    });
    setServerCalculation(estimate.calculation);
    setError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startNew = () => {
    setActiveId(null);
    setDraft(createDraft());
    setServerCalculation(null);
    setError("");
    setNotice("");
  };

  const deleteEstimate = async () => {
    if (!activeId || !window.confirm("Delete this saved estimate? This cannot be undone.")) return;
    setBusy(true);
    setError("");
    try {
      await api.delete(`/estimates/${activeId}/`);
      setSavedEstimates((current) => current.filter((estimate) => estimate.id !== activeId));
      startNew();
      setNotice("Estimate deleted.");
    } catch {
      setError("The estimate could not be deleted.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF9F7] pb-16 text-slate-900">
      <div className="border-b border-slate-200 bg-white">
        <Container className="py-8 sm:py-10">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Project Estimator</div>
              <h1 className="mt-2 text-3xl font-bold text-slate-950 sm:text-4xl">Painting estimate</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                Define the surfaces, condition, materials, and additional work to create a clear planning estimate.
              </p>
            </div>
            {authed ? (
              <Button type="button" onClick={startNew} className="h-11 shrink-0 gap-2">
                <SymbolIcon name="add" className="text-[19px]" />
                New estimate
              </Button>
            ) : null}
          </div>
        </Container>
      </div>

      {authed ? (
        <div className="border-b border-slate-200 bg-[#F3F6F8]">
          <Container className="py-5">
            <div className="mb-3 flex items-center justify-between gap-4">
              <div className="text-sm font-semibold text-slate-900">Saved estimates</div>
              <div className="text-xs text-slate-500">{savedEstimates.length} saved</div>
            </div>
            {loading ? (
              <div className="text-sm text-slate-500">Loading saved estimates...</div>
            ) : savedEstimates.length ? (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {savedEstimates.map((estimate) => (
                  <button
                    key={estimate.id}
                    type="button"
                    onClick={() => openEstimate(estimate)}
                    className={[
                      "min-w-[230px] rounded-xl border bg-white px-4 py-3 text-left transition",
                      activeId === estimate.id
                        ? "border-slate-500 shadow-sm"
                        : "border-slate-200 hover:border-slate-300",
                    ].join(" ")}
                  >
                    <div className="truncate text-sm font-semibold text-slate-900">{estimate.project_name}</div>
                    <div className="mt-1 flex items-center justify-between gap-3 text-xs text-slate-500">
                      <span>{estimate.estimate_number}</span>
                      <span className="font-semibold text-slate-800">{money(estimate.final_price)}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-500">Your first saved estimate will appear here.</div>
            )}
          </Container>
        </div>
      ) : null}

      <Container className="py-7 sm:py-10">
        <div className="grid min-w-0 items-start gap-7 lg:grid-cols-[minmax(340px,0.72fr)_minmax(0,1.28fr)]">
          <div className="min-w-0 space-y-6">
            <section className="border-b border-slate-200 pb-6">
              <h2 className="text-lg font-semibold text-slate-950">Estimate details</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <label className="sm:col-span-2 lg:col-span-1 xl:col-span-2">
                  <FieldLabel>Project or estimate name</FieldLabel>
                  <Input value={draft.project_name} onChange={(event) => updateDraft("project_name", event.target.value)} />
                </label>
                <label>
                  <FieldLabel>Prepared by</FieldLabel>
                  <Input value={draft.inputs.prepared_by} onChange={(event) => updateInputs("prepared_by", event.target.value)} placeholder="Business name" />
                </label>
                <label>
                  <FieldLabel>Client</FieldLabel>
                  <Input value={draft.inputs.client_name} onChange={(event) => updateInputs("client_name", event.target.value)} placeholder="Client name" />
                </label>
                <label className="sm:col-span-2 lg:col-span-1 xl:col-span-2">
                  <FieldLabel>Project location</FieldLabel>
                  <Input value={draft.inputs.project_location} onChange={(event) => updateInputs("project_location", event.target.value)} placeholder="City, State" />
                </label>
                <label>
                  <FieldLabel>Issue date</FieldLabel>
                  <Input type="date" value={draft.issue_date} onChange={(event) => updateDraft("issue_date", event.target.value)} />
                </label>
                <label>
                  <FieldLabel>Valid until</FieldLabel>
                  <Input type="date" min={draft.issue_date} value={draft.valid_until} onChange={(event) => updateDraft("valid_until", event.target.value)} />
                </label>
              </div>
            </section>

            <section className="border-b border-slate-200 pb-6">
              <h2 className="text-lg font-semibold text-slate-950">Painting scope</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <label className="block">
                  <FieldLabel>Floor area</FieldLabel>
                  <div className="relative">
                    <Input type="number" min="1" max="100000" step="1" value={draft.inputs.space_size} onChange={(event) => updateInputs("space_size", event.target.value)} className="pr-16" />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">sq ft</span>
                  </div>
                </label>
                <label className="block">
                  <FieldLabel>Wall / ceiling height</FieldLabel>
                  <div className="relative">
                    <Input type="number" min="6" max="40" step="0.5" value={draft.inputs.wall_height ?? "8"} onChange={(event) => updateInputs("wall_height", event.target.value)} className="pr-10" />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">ft</span>
                  </div>
                </label>
                <div className="text-xs leading-5 text-slate-500 sm:col-span-2 lg:col-span-1 xl:col-span-2">
                  Walls scale from the 8 ft baseline. Ceilings above 9 ft add 5% per additional foot for access and protection, capped at 50%.
                </div>
              </div>

              <div className="mt-4">
                <FieldLabel>Surfaces to paint</FieldLabel>
                <div className="grid gap-2">
                  <ToggleChoice checked={draft.inputs.surfaces.walls} onChange={(value) => updateSurface("walls", value)} label="Walls" description="Calculated from the floor-area planning factor." />
                  <ToggleChoice checked={draft.inputs.surfaces.ceilings} onChange={(value) => updateSurface("ceilings", value)} label="Ceilings" description="Adds the full floor area as ceiling surface." />
                  <ToggleChoice checked={draft.inputs.surfaces.trim} onChange={(value) => updateSurface("trim", value)} label="Baseboards & trim" description="Adds the trim allowance using the floor area." />
                </div>
              </div>

              <div className="mt-4 space-y-4">
                <SegmentedControl
                  label="Wall condition"
                  value={draft.inputs.wall_condition}
                  onChange={(value) => updateInputs("wall_condition", value)}
                  options={[
                    { value: "standard_repaint", label: "Standard repaint" },
                    { value: "new_drywall", label: "New drywall" },
                  ]}
                />
                {draft.inputs.surfaces.trim ? (
                  <ToggleChoice checked={draft.inputs.trim_needs_prep} onChange={(value) => updateInputs("trim_needs_prep", value)} label="Trim needs prep and caulk" description="Adds joint repair, preparation, and caulking allowance." />
                ) : null}
                <SegmentedControl
                  label="Paint quality"
                  value={draft.inputs.paint_tier}
                  onChange={(value) => updateInputs("paint_tier", value)}
                  options={[
                    { value: "standard", label: "Standard" },
                    { value: "premium", label: "Premium +15%" },
                  ]}
                />
                <label className="block">
                  <FieldLabel>Paint or material specification</FieldLabel>
                  <Input value={draft.inputs.paint_material} onChange={(event) => updateInputs("paint_material", event.target.value)} placeholder="Brand, finish, color, or material tier" />
                </label>
                <label className="block">
                  <FieldLabel>Material supplier</FieldLabel>
                  <select
                    value={draft.inputs.material_supplier}
                    onChange={(event) => updateInputs("material_supplier", event.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="not_specified">To be confirmed</option>
                    <option value="contractor">Issuer / contractor</option>
                    <option value="client">Client / homeowner</option>
                  </select>
                  <div className="mt-1.5 text-xs leading-5 text-slate-500">
                    {draft.inputs.material_supplier === "contractor"
                      ? "Use rates that include contractor-supplied paint and materials."
                      : draft.inputs.material_supplier === "client"
                      ? "Materials are not priced separately. Lower the rates as needed for owner-supplied paint and materials."
                      : "Confirm the supplier, then set rates that reflect whether paint and materials are included."}
                  </div>
                </label>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  {draft.inputs.surfaces.walls ? (
                    <label className="block">
                      <FieldLabel>Wall base unit price</FieldLabel>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">$</span>
                        <Input type="number" min="2" max="6" step="0.25" value={draft.inputs.wall_unit_price ?? "3.00"} onChange={(event) => updateInputs("wall_unit_price", event.target.value)} className="pl-7 pr-16" />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">/ sq ft</span>
                      </div>
                    </label>
                  ) : null}
                  {draft.inputs.surfaces.ceilings ? (
                    <label className="block">
                      <FieldLabel>Ceiling base unit price</FieldLabel>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">$</span>
                        <Input type="number" min="2" max="6" step="0.25" value={draft.inputs.ceiling_unit_price ?? "2.00"} onChange={(event) => updateInputs("ceiling_unit_price", event.target.value)} className="pl-7 pr-16" />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">/ sq ft</span>
                      </div>
                    </label>
                  ) : null}
                </div>
                <p className="text-xs leading-5 text-slate-500">
                  Set the base labor-and-material rate for this estimate. Height, condition, and paint-quality adjustments are applied afterward.
                </p>
              </div>
            </section>

            <section className="border-b border-slate-200 pb-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Additional items</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Add work that is not included in the painting selections.</p>
                </div>
                <button type="button" onClick={addCustomItem} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                  <SymbolIcon name="add" className="text-[18px]" />
                  Add item
                </button>
              </div>
              {draft.inputs.custom_items.length ? (
                <div className="mt-4 space-y-3">
                  {draft.inputs.custom_items.map((item, index) => (
                    <CustomItemEditor key={index} item={item} index={index} onChange={updateCustomItem} onRemove={removeCustomItem} />
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500">No additional items.</div>
              )}
            </section>

            <section className="border-b border-slate-200 pb-6">
              <h2 className="text-lg font-semibold text-slate-950">Discount and notes</h2>
              <div className="mt-4 grid grid-cols-[120px_1fr] gap-3">
                <label>
                  <FieldLabel>Discount type</FieldLabel>
                  <select value={draft.inputs.discount_type} onChange={(event) => updateInputs("discount_type", event.target.value)} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="percent">Percent</option>
                    <option value="fixed">Fixed</option>
                  </select>
                </label>
                <label>
                  <FieldLabel>Discount</FieldLabel>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">{draft.inputs.discount_type === "fixed" ? "$" : "%"}</span>
                    <Input type="number" min="0" max={draft.inputs.discount_type === "percent" ? "100" : undefined} step="0.01" value={draft.inputs.discount_value} onChange={(event) => updateInputs("discount_value", event.target.value)} className="pl-8" />
                  </div>
                </label>
              </div>
              <label className="mt-4 block">
                <FieldLabel>Estimate notes and assumptions</FieldLabel>
                <Textarea value={draft.inputs.notes} onChange={(event) => updateInputs("notes", event.target.value)} placeholder="Access, preparation, exclusions, schedule, or other assumptions..." />
              </label>
            </section>

            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-xs leading-5 text-amber-950">
              FlatOrigin provides estimating tools and informational pricing suggestions. The issuing user is responsible for reviewing and approving all pricing, quantities, materials, descriptions, discounts, and terms.
            </div>

            {error ? <div className="text-sm font-medium text-red-700">{error}</div> : null}
            {notice ? <div className="text-sm font-medium text-emerald-700">{notice}</div> : null}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" disabled={busy} onClick={saveEstimate} className="h-11 flex-1 gap-2">
                <SymbolIcon name={authed ? "save" : "person_add"} className="text-[18px]" />
                {authed ? (activeId ? "Update estimate" : "Save estimate") : "Create free account to save"}
              </Button>
              {authed && activeId ? (
                <button type="button" disabled={busy} onClick={deleteEstimate} className="h-11 rounded-xl border border-red-200 px-4 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-60">
                  Delete
                </button>
              ) : null}
            </div>
            {!authed ? (
              <p className="text-xs leading-5 text-slate-500">The full estimate is available now. An account is only required to save and revise it later.</p>
            ) : null}
          </div>

          <div className="min-w-0 lg:sticky lg:top-24">
            <EstimatePreview draft={draft} calculation={calculation} estimateNumber={activeEstimate?.estimate_number} />
          </div>
        </div>
      </Container>
    </div>
  );
}
