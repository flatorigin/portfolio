import { SymbolIcon } from "../ui";

const tones = [
  "bg-amber-50 text-amber-600 ring-amber-200/60",
  "bg-blue-50 text-blue-600 ring-blue-200/60",
  "bg-emerald-50 text-emerald-700 ring-emerald-200/60",
  "bg-violet-50 text-violet-600 ring-violet-200/60",
];

export default function LandingFeatureIcon({ name, index = 0, compact = false, centered = false }) {
  return <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset ${tones[index % tones.length]} ${compact ? "size-12" : "size-16"} ${centered ? "mx-auto" : ""}`}>
    <SymbolIcon name={name} className={compact ? "text-[24px]" : "text-[30px]"} />
  </span>;
}
