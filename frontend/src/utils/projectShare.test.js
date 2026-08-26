import assert from "node:assert/strict";
import test from "node:test";
import { buildProjectShareData, isShareablePublicProject } from "./projectShare.js";

test("public projects are shareable while private and sample cards are not", () => {
  assert.equal(isShareablePublicProject({ id: 17, is_public: true }), true);
  assert.equal(isShareablePublicProject({ id: 17, is_public: false }), false);
  assert.equal(isShareablePublicProject({ id: 17, is_private: true }), false);
  assert.equal(isShareablePublicProject({ id: 17, post_privacy: "private" }), false);
  assert.equal(isShareablePublicProject({ id: "sample-1" }), false);
});

test("share destinations carry the same public project URL", () => {
  const share = buildProjectShareData(
    {
      id: 17,
      title: "Kitchen refresh",
      summary: "New cabinets and flooring.",
      location: "Media, PA",
    },
    "https://www.flatorigin.com/",
  );

  assert.equal(share.url, "https://www.flatorigin.com/projects/17");
  assert.match(decodeURIComponent(share.emailUrl), /Kitchen refresh/);
  assert.match(decodeURIComponent(share.smsUrl), /https:\/\/www\.flatorigin\.com\/projects\/17/);
  assert.match(decodeURIComponent(share.facebookUrl), /https:\/\/www\.flatorigin\.com\/projects\/17/);
  assert.match(decodeURIComponent(share.nextdoorUrl), /source=flatorigin/);
  assert.match(decodeURIComponent(share.nextdoorUrl), /Kitchen refresh in Media, PA/);
});
