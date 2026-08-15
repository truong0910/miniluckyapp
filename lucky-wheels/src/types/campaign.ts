export type SymbolCode = "cherry" | "lemon" | "bell" | "star" | "red_envelope";

export interface SpinReward {
  code: string;
  title: string;
  value: number;
  description?: string;
  expiresAt?: string;
  wheelLabel?: string;
}

export interface RewardAssignment {
  result: [SymbolCode, SymbolCode, SymbolCode];
  reward: SpinReward;
}
