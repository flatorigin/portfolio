import SavedLikesCard from "../components/SavedLikesCard";
import { SectionTitle } from "../ui";

export default function SavedLikesPage() {
  return (
    <div className="space-y-5">
      <header className="mb-1 flex min-h-14 items-center">
        <SectionTitle className="!mb-0">Saved &amp; Likes</SectionTitle>
      </header>

      <SavedLikesCard />
    </div>
  );
}
