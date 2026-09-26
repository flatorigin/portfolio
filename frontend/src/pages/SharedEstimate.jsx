import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api";
import { Container } from "../ui";
export default function SharedEstimate() {
  const { token } = useParams();
  const [estimate, setEstimate] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { let active = true; setEstimate(null); setError(""); api.get(`/estimates/client/${token}/`).then(({data}) => { if (active) setEstimate(data); }).catch(() => { if (active) setError("This estimate link is unavailable or the estimate was deleted."); }); return () => { active = false; }; }, [token]);
  return <div className="min-h-screen bg-stone-50 py-10"><Container><article className="mx-auto max-w-3xl rounded-xl border border-stone-200 bg-white p-6 shadow-sm">{error ? <p role="alert">{error}</p> : !estimate ? <p>Loading estimate…</p> : <>
    <p className="text-xs text-stone-500">Shared estimate · Read only · {estimate.status}</p>
    <h1 className="mt-2 text-2xl font-bold text-stone-900">{estimate.project_name}</h1>
    <p className="mt-2 text-sm text-stone-500">{estimate.estimate_number} · Issued {estimate.issue_date}{estimate.valid_until && ` · Valid until ${estimate.valid_until}`}</p>
    <div className="my-6 text-3xl font-semibold">{new Intl.NumberFormat("en-US", {style:"currency", currency:"USD"}).format(Number(estimate.final_price))}</div>
    {estimate.scope?.map((section, index) => <section key={index} className="border-t border-stone-200 py-4"><h2 className="font-semibold">{section.name}</h2><ul className="mt-2 list-inside list-disc text-sm text-stone-600">{section.items.map((name, i) => <li key={i}>{name}</li>)}</ul></section>)}
    {estimate.notes && <p className="mt-4 whitespace-pre-wrap text-sm text-stone-600">{estimate.notes}</p>}
    {[["Included", estimate.included_scope], ["Excluded", estimate.excluded_scope]].map(([title, items]) => Array.isArray(items) && items.length > 0 && <section key={title} className="mt-4"><h2 className="font-semibold">{title}</h2><ul className="list-inside list-disc text-sm text-stone-600">{items.map((item, index) => <li key={index}>{typeof item === "string" ? item : item.name || item.description || ""}</li>)}</ul></section>)}
    <p className="mt-4 text-xs text-stone-500">Saved version shared {new Date(estimate.shared_at).toLocaleDateString()}. Contact the sender to discuss changes.</p>
    <button type="button" onClick={() => window.print()} className="mt-4 rounded-lg border px-4 py-2 text-sm print:hidden">Print estimate</button>
  </>}</article></Container></div>;
}
