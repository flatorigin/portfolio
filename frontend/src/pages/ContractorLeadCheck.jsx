import ProjectChecklistTool from "../components/ProjectChecklistTool";
import { CONTRACTOR_CHECK_STORAGE_KEY } from "../data/projectChecklists";

export default function ContractorLeadCheck() {
  return (
    <ProjectChecklistTool
      mode="contractor"
      storageKey={CONTRACTOR_CHECK_STORAGE_KEY}
    />
  );
}
