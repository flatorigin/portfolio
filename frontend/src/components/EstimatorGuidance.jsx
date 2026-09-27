export const estimatorServices = ["Painting", "Framing", "Drywall", "Flooring", "Roofing", "Siding", "Decking", "Paving", "Fencing", "Windows", "Doors", "Garage coating", "Electrical", "Plumbing"];
export const estimatorResponsibility = "FlatOrigin provides tools to organize, calculate and share estimates; it does not set or dictate prices. The estimate creator controls the scope, quantities, materials, rates and final price, and is responsible for verifying the estimate’s accuracy and completeness before sharing it.";
export const estimatorPriceReview = "Suggested prices are planning references, not quotes or guaranteed market rates. Reference ranges should be reviewed at least annually and whenever local labor or material costs change. Check the stated pricing basis and review date where available, and verify current local prices before using them. Future-year projections are not confirmed prices.";
export function EstimatorServiceBadges() {
  return <div className="flex flex-wrap gap-2" aria-label="Estimator service types">{estimatorServices.map(service => <span key={service} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">{service}</span>)}</div>;
}
export default function EstimatorGuidance() {
  return <aside aria-label="About estimator pricing" className="mb-6 rounded-xl border border-stone-200 bg-white p-4 text-left text-xs leading-6 text-stone-600"><p><strong className="font-semibold text-stone-800">Your estimate, your control.</strong> {estimatorResponsibility}</p><p className="mt-2">{estimatorPriceReview}</p></aside>;
}
