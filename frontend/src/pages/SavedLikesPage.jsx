import { Link } from "react-router-dom";
import SavedLikesCard from "../components/SavedLikesCard";
import { SymbolIcon } from "../ui";

export default function SavedLikesPage() {
  return (
    <div className="min-h-screen bg-[#FBF9F7]">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Profile
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
              Saved &amp; Likes
            </h1>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <SymbolIcon name="dashboard" className="text-[18px]" />
            Dashboard
          </Link>
        </div>

        <SavedLikesCard />
      </div>
    </div>
  );
}
