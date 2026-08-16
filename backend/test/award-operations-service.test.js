import test from "node:test";
import assert from "node:assert/strict";
import {
  validateAwardStatusTransition,
  calculateInventorySummary,
} from "../src/award-operations-service.js";

test("validateAwardStatusTransition enforces valid state transitions and mandatory reason for void/expire", () => {
  // Redeem allowed from issued or delivered
  assert.equal(validateAwardStatusTransition("issued", "redeemed"), true);
  assert.equal(validateAwardStatusTransition("delivered", "redeemed"), true);

  // Void/expire requires reason
  assert.throws(
    () => validateAwardStatusTransition("issued", "void", ""),
    /Lý do không được để trống/,
  );
  assert.throws(
    () => validateAwardStatusTransition("delivered", "expired", "   "),
    /Lý do không được để trống/,
  );

  assert.equal(validateAwardStatusTransition("issued", "void", "Khách đổi quà khác"), true);

  // Invalid transition from redeemed
  assert.throws(
    () => validateAwardStatusTransition("redeemed", "void", "Lý do"),
    /Không thể chuyển trạng thái voucher đã đổi/,
  );
});

test("calculateInventorySummary aggregates planned, issued, delivered, redeemed, and remaining", () => {
  const rewards = [
    { id: "r1", title: "Voucher 500k", quantity: 100 },
    { id: "r2", title: "Voucher 100k", quantity: 50 },
  ];

  const awards = [
    { reward_id: "r1", status: "issued" },
    { reward_id: "r1", status: "delivered" },
    { reward_id: "r1", status: "redeemed" },
    { reward_id: "r2", status: "redeemed" },
  ];

  const summary = calculateInventorySummary(rewards, awards);
  assert.equal(summary.length, 2);

  const r1Summary = summary.find((x) => x.rewardId === "r1");
  assert.equal(r1Summary.plannedQuantity, 100);
  assert.equal(r1Summary.issuedCount, 3);
  assert.equal(r1Summary.deliveredCount, 1);
  assert.equal(r1Summary.redeemedCount, 1);
  assert.equal(r1Summary.remainingQuantity, 97);

  const r2Summary = summary.find((x) => x.rewardId === "r2");
  assert.equal(r2Summary.plannedQuantity, 50);
  assert.equal(r2Summary.issuedCount, 1);
  assert.equal(r2Summary.remainingQuantity, 49);
});
