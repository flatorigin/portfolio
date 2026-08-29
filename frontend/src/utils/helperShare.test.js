import test from "node:test";
import assert from "node:assert/strict";
import { buildHelperShareData } from "./helperShare.js";

test("helper share destinations use the helper's public card URL", () => {
  const share = buildHelperShareData(
    {
      id: 12,
      full_name: "Alex Helper",
      city: "Media",
      state: "PA",
      skill_labels: ["Cleanup", "Painting"],
    },
    "https://www.flatorigin.com/",
  );

  assert.equal(share.url, "https://www.flatorigin.com/project-helpers/12");
  assert.match(decodeURIComponent(share.facebookUrl), /project-helpers\/12/);
  assert.match(decodeURIComponent(share.nextdoorUrl), /Alex Helper/);
  assert.match(decodeURIComponent(share.nextdoorUrl), /Cleanup, Painting/);
});
