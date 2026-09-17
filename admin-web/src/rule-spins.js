const ALL_SPIN_COUNT = 50;
const MAX_SPIN_NUMBER = 2_147_483_647;

function normalizeSpins(spins = []) {
  return [...new Set(spins
    .map(Number)
    .filter((spin) => Number.isSafeInteger(spin) && spin > 0 && spin <= MAX_SPIN_NUMBER))]
    .sort((a, b) => a - b);
}

function isContiguous(spins) {
  return spins.length > 1 && spins.every((spin, index) => index === 0 || spin === spins[index - 1] + 1);
}

export function getTargetSpins({ mode, rangeStart = 1, rangeEnd = ALL_SPIN_COUNT, customSpins = [] }) {
  if (mode === "all") {
    return Array.from({ length: ALL_SPIN_COUNT }, (_, index) => index + 1);
  }

  if (mode === "range") {
    const start = Number(rangeStart);
    const end = Number(rangeEnd);
    if (![start, end].every((spin) => Number.isSafeInteger(spin) && spin > 0 && spin <= ALL_SPIN_COUNT)) {
      return [];
    }
    const first = Math.min(start, end);
    const last = Math.max(start, end);
    return Array.from({ length: last - first + 1 }, (_, index) => first + index);
  }

  return normalizeSpins(customSpins);
}

export function getInitialSpinSelection(spins) {
  const normalized = normalizeSpins(spins || []);
  const isAll = normalized.length === ALL_SPIN_COUNT
    && normalized.every((spin, index) => spin === index + 1);

  if (isAll) {
    return { mode: "all", rangeStart: 1, rangeEnd: ALL_SPIN_COUNT, customSpins: [] };
  }

  if (isContiguous(normalized) && normalized[normalized.length - 1] <= ALL_SPIN_COUNT) {
    return {
      mode: "range",
      rangeStart: normalized[0],
      rangeEnd: normalized[normalized.length - 1],
      customSpins: [],
    };
  }

  return {
    mode: "custom",
    rangeStart: 1,
    rangeEnd: ALL_SPIN_COUNT,
    customSpins: normalized,
  };
}

export function getSpinSummary(spins) {
  const normalized = normalizeSpins(spins || []);
  const isAll = normalized.length === ALL_SPIN_COUNT
    && normalized.every((spin, index) => spin === index + 1);
  if (isAll) return "Tất cả lượt (1–50)";
  if (isContiguous(normalized)) return `Lượt ${normalized[0]}–${normalized[normalized.length - 1]}`;
  return normalized.length > 0 ? `Lượt: ${normalized.join(", ")}` : "Chưa cấu hình lượt";
}
