import { getRemoteProgramRules } from "@/services/content.services";
import type { RewardAssignment, SpinReward, SymbolCode } from "@/types/campaign";

export interface ProgramRules {
  intro: string;
  eligibility: string[];
  rewards: string[];
  usageNotes: string[];
}

export const DEFAULT_PROGRAM_RULES: ProgramRules = {
  intro: "Chương trình Vòng Quay May Mắn dành cho khách hàng được cấp lượt quay. Mỗi lượt quay được ghi nhận kết quả và trao Voucher tương ứng.",
  eligibility: ["Nhập đúng số điện thoại đã được cấp quyền tham gia chương trình.", "Theo dõi Zalo Official Account (OA) trước khi quay.", "Số lượt quay hiển thị theo cấu hình tài khoản của bạn."],
  rewards: [],
  usageNotes: ["Mã Voucher trúng thưởng được lưu trong mục Xem kết quả quay.", "Voucher không có giá trị quy đổi thành tiền mặt."],
};

let localProgramRules: ProgramRules | null = null;

export function readProgramRules(): ProgramRules {
  const remote = getRemoteProgramRules();
  const base = remote || localProgramRules || DEFAULT_PROGRAM_RULES;
  return {
    ...base,
    eligibility: [...(base.eligibility || [])],
    rewards: [...(base.rewards || [])],
    usageNotes: [...(base.usageNotes || [])],
  };
}

export function writeProgramRules(rules: ProgramRules) {
  localProgramRules = readProgramRules();
  localProgramRules = {
    ...rules,
    eligibility: [...rules.eligibility],
    rewards: [...rules.rewards],
    usageNotes: [...rules.usageNotes],
  };
}

export interface WheelSegment {
  id: string;
  label: string;
  type: "reward" | "better_luck";
}

export type LocalSpinResult = {
  spinId: string;
  outcome: "reward" | "better_luck";
  wheelSegmentId: string;
  result: [SymbolCode, SymbolCode, SymbolCode];
  reward: SpinReward | null;
  spinsRemaining: number;
};

export type { RewardAssignment };
