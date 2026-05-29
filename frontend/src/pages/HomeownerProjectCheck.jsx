import ProjectChecklistTool from "../components/ProjectChecklistTool";
import { HOMEOWNER_CHECK_STORAGE_KEY } from "../data/projectChecklists";

export default function HomeownerProjectCheck() {
  return (
    <ProjectChecklistTool
      mode="homeowner"
      storageKey={HOMEOWNER_CHECK_STORAGE_KEY}
    />
  );
}
