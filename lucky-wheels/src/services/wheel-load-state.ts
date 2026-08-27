export type WheelLoadState = "loading" | "ready" | "empty" | "error";

export interface WheelLoadStateInput {
  isLoading: boolean;
  participant: { id?: string } | null;
  segmentCount: number;
  error?: string | null;
}

export function getWheelLoadState(input: WheelLoadStateInput): WheelLoadState {
  if (input.isLoading) {
    return "loading";
  }
  if (input.error) {
    return "error";
  }
  if (!input.participant || input.segmentCount === 0) {
    return "empty";
  }
  return "ready";
}
