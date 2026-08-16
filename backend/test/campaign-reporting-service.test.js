import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateCampaignMetrics,
  formatAwardsToCsv,
} from "../src/campaign-reporting-service.js";

test("calculateCampaignMetrics aggregates campaign-scoped totals", () => {
  const participants = [
    { spin_quota: 10 },
    { spin_quota: 5 },
  ];

  const spinEvents = [
    { outcome: "reward" },
    { outcome: "reward" },
    { outcome: "better_luck" },
  ];

  const awards = [
    { status: "issued" },
    { status: "delivered" },
    { status: "redeemed" },
    { status: "void" },
  ];

  const metrics = calculateCampaignMetrics({ participants, spinEvents, awards });

  assert.equal(metrics.totalParticipants, 2);
  assert.equal(metrics.totalAllocatedSpins, 15);
  assert.equal(metrics.totalSpinsUsed, 3);
  assert.equal(metrics.totalWinningSpins, 2);

  assert.equal(metrics.awardsIssued, 1);
  assert.equal(metrics.awardsDelivered, 1);
  assert.equal(metrics.awardsRedeemed, 1);
  assert.equal(metrics.awardsVoided, 1);
});

test("formatAwardsToCsv generates RFC4180 compliant CSV string", () => {
  const awards = [
    {
      code: "V5M_01",
      customerName: "Nguyễn Văn A",
      customerPhone: "0912345678",
      title: "Voucher 5 triệu",
      value: 5000000,
      status: "delivered",
      issuedAt: "2026-08-16T12:00:00Z",
    },
  ];

  const csv = formatAwardsToCsv(awards);
  assert.match(csv, /^"Mã Voucher","Tên Khách hàng","SĐT","Phần thưởng","Giá trị","Trạng thái","Ngày cấp"/);
  assert.match(csv, /"V5M_01","Nguyễn Văn A","0912345678","Voucher 5 triệu","5000000","delivered"/);
});
