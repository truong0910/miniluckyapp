import { describe, expect, it } from "vitest";
import { getWheelLoadState, WheelLoadStateInput } from "./wheel-load-state";

describe("getWheelLoadState classifier", () => {
  it.each([
    [{ isLoading: true, participant: null, segmentCount: 0, error: null }, "loading"],
    [{ isLoading: false, participant: null, segmentCount: 0, error: "request failed" }, "error"],
    [{ isLoading: false, participant: null, segmentCount: 0, error: null }, "empty"],
    [{ isLoading: false, participant: { id: "c1" }, segmentCount: 2, error: null }, "ready"],
  ])("classifies wheel state correctly", (input, expected) => {
    expect(getWheelLoadState(input as WheelLoadStateInput)).toBe(expected);
  });
});
