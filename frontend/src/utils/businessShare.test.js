import test from "node:test";
import assert from "node:assert/strict";
import { buildBusinessShareData, isShareableBusinessListing } from "./businessShare.js";

test("business share destinations use the public directory URL", () => {
  const share = buildBusinessShareData(
    {
      id: 42,
      business_name: "Deck Pros",
      location: "Media, PA",
      specialties: ["Decks", "Railings"],
    },
    "https://www.flatorigin.com/",
  );

  assert.equal(share.url, "https://www.flatorigin.com/business-directory/42");
  assert.match(decodeURIComponent(share.emailUrl), /Deck Pros/);
  assert.match(decodeURIComponent(share.facebookUrl), /business-directory\/42/);
  assert.match(decodeURIComponent(share.nextdoorUrl), /Decks, Railings/);
});

test("sample directory placeholders are not shareable", () => {
  assert.equal(isShareableBusinessListing({ id: 42 }), true);
  assert.equal(isShareableBusinessListing({ id: "dir-1" }), false);
  assert.equal(isShareableBusinessListing({}), false);
});
