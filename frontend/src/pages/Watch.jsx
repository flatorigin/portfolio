import { useEffect } from "react";
import { Link } from "react-router-dom";
import IntroVideo from "../components/IntroVideo";

export default function Watch() {
  useEffect(() => {
    const previous = document.title;
    document.title = "Watch FlatOrigin — Plan. Connect. Build.";
    return () => { document.title = previous; };
  }, []);
  return (
    <main className="min-h-[75vh] bg-stone-50 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="text-xl font-bold text-stone-900">FlatOrigin</Link>
        <h1 className="mb-6 mt-5 text-3xl font-semibold tracking-tight text-stone-900">Your next home project starts here.</h1>
        <IntroVideo />
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/homeowner" className="rounded-xl bg-stone-900 px-5 py-3 text-sm font-medium text-white hover:bg-stone-800">Plan a project</Link>
          <Link to="/contractor" className="rounded-xl border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-stone-700">For contractors</Link>
        </div>
      </div>
    </main>
  );
}
