import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Container } from "../ui";
import IntroVideo from "../components/IntroVideo";

export default function Watch() {
  useEffect(() => {
    const previous = document.title;
    document.title = "Watch FlatOrigin — Plan. Connect. Build.";
    return () => { document.title = previous; };
  }, []);
  return (
    <main className="min-h-[75vh] bg-stone-50 py-8 sm:py-12">
      <Container>
        <h1 className="mb-5 text-lg font-semibold tracking-tight text-stone-700 sm:text-xl">Introduction to FlatOrigin</h1>
        <IntroVideo source="watch" inline />
        <p className="mt-5 text-sm text-stone-600"><a className="underline" href={`${import.meta.env.BASE_URL}video/flatorigin-intro.mp4`} download="FlatOrigin-intro.mp4">Download video</a> to attach it to a post.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/homeowner" className="rounded-xl bg-stone-900 px-5 py-3 text-sm font-medium text-white hover:bg-stone-800">Plan a project</Link>
          <Link to="/contractor" className="rounded-xl border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-stone-700">For contractors</Link>
        </div>
      </Container>
    </main>
  );
}
