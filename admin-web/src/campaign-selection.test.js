import test from "node:test";
import assert from "node:assert/strict";
import { getDefaultCampaignId } from "./campaign-selection.js";

test("prefers the active campaign over a newer ended campaign", () => {
  const campaigns = [
    { id: "ended-new", status: "ended" },
    { id: "active-old", status: "active" },
  ];

  assert.equal(getDefaultCampaignId(campaigns), "active-old");
});

test("falls back to the first campaign if none is active", () => {
  const campaigns = [
    { id: "ended-new", status: "ended" },
    { id: "paused-old", status: "paused" },
  ];

  assert.equal(getDefaultCampaignId(campaigns), "ended-new");
});

test("returns an empty selection when there are no campaigns", () => {
  assert.equal(getDefaultCampaignId([]), "");
});
