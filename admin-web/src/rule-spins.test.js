import test from "node:test";
import assert from "node:assert/strict";
import { getInitialSpinSelection, getSpinSummary, getTargetSpins } from "./rule-spins.js";

test("specific spin selection supports arbitrary spin numbers and removes duplicates", () => {
  assert.deepEqual(
    getTargetSpins({ mode: "custom", customSpins: [100, 3, 100] }),
    [3, 100],
  );
});

test("only the full 1–50 sequence is treated as all spins when editing", () => {
  assert.deepEqual(getInitialSpinSelection([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), {
    mode: "range",
    rangeStart: 1,
    rangeEnd: 10,
    customSpins: [],
  });
  assert.deepEqual(getInitialSpinSelection(Array.from({ length: 50 }, (_, index) => index + 1)), {
    mode: "all",
    rangeStart: 1,
    rangeEnd: 50,
    customSpins: [],
  });
});

test("non-contiguous spins above ten remain a specific selection when editing", () => {
  assert.deepEqual(getInitialSpinSelection([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12]), {
    mode: "custom",
    rangeStart: 1,
    rangeEnd: 50,
    customSpins: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12],
  });
});

test("rule summaries describe the actual contiguous range instead of calling it all", () => {
  assert.equal(getSpinSummary([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), "Lượt 1–10");
  assert.equal(getSpinSummary(Array.from({ length: 50 }, (_, index) => index + 1)), "Tất cả lượt (1–50)");
});
