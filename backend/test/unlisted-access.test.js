import test from "node:test";
import assert from "node:assert/strict";
import { parseCampaignInput } from "../src/campaign-service.js";
import { parseCustomerImportRows } from "../src/campaign-reuse-service.js";

test("parseCampaignInput handles allowUnlisted and unlistedSpinQuota defaults", () => {
  const result = parseCampaignInput({
    code: "TEST_UNLISTED_CAMPAIGN",
    name: "Test Unlisted Access Campaign",
    allowUnlisted: true,
    unlistedSpinQuota: 3,
  });

  assert.equal(result.code, "TEST_UNLISTED_CAMPAIGN");
  assert.equal(result.allowUnlisted, true);
  assert.equal(result.unlistedSpinQuota, 3);
});

test("parseCampaignInput defaults allowUnlisted to false and unlistedSpinQuota to 1", () => {
  const result = parseCampaignInput({
    code: "TEST_DEFAULT_CAMPAIGN",
    name: "Test Default Access Campaign",
  });

  assert.equal(result.allowUnlisted, false);
  assert.equal(result.unlistedSpinQuota, 1);
});

test("parseCustomerImportRows tags registration source as import", () => {
  const rows = [
    { "Tên KH": "Nguyễn Văn A", "SĐT": "0988776655", "Ghi chú": "5 triệu" }
  ];
  const parsed = parseCustomerImportRows(rows);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].valid, true);
  assert.equal(parsed[0].phone, "0988776655");
});
