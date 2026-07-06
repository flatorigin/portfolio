import { Container } from "../ui";
import LocalPromotionsSection from "../components/LocalPromotionsSection";

export default function LocalPromotionsPage() {
  return (
    <div className="bg-[#FBF9F7] py-10 text-slate-900">
      <Container>
        <LocalPromotionsSection />
      </Container>
    </div>
  );
}
