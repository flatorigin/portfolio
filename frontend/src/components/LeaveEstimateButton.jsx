import { useNavigate } from "react-router-dom";
export default function LeaveEstimateButton({ pendingKey, disabled }) {
  const navigate = useNavigate();
  return <button type="button" disabled={disabled} className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50" onClick={() => {
    if (!window.confirm("Leave without saving? Unsaved changes will be discarded. Any previously saved estimate will remain.")) return;
    if (pendingKey) localStorage.removeItem(pendingKey);
    navigate(localStorage.getItem("access") ? "/estimates" : "/project-estimator");
  }}>Leave without saving</button>;
}
