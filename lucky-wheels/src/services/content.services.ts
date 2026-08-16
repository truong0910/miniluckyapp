import slideImg from "@/static/slide-img.webp";
import type { SymbolCode } from "@/types/campaign";
import { apiRequest } from "@/services/api.client";
import { zbsService } from "@/services/zbs.services";

export interface BannerConfig {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl?: string;
  active: boolean;
  order: number;
}

export interface RewardCatalogItem {
  id: string;
  codePrefix: string;
  title: string;
  value: number;
  description: string;
  wheelLabel: string;
  symbol: SymbolCode;
  active: boolean;
}

let memoryBanners: BannerConfig[] | null = null;
let memoryRewardCatalog: RewardCatalogItem[] | null = null;
let memoryProgramRules: Record<string, unknown> | null = null;

const DEFAULT_BANNERS: BannerConfig[] = [
  {
    id: "default-slide",
    title: "Vòng quay may mắn",
    imageUrl: slideImg,
    active: true,
    order: 0,
  },
];

const DEFAULT_REWARD_CATALOG: RewardCatalogItem[] = [
  {
    id: "reward-5m",
    codePrefix: "VOUCHER_5M",
    title: "Voucher mua hàng 5.000.000đ",
    value: 5_000_000,
    description: "Voucher mua hàng trị giá 5.000.000đ",
    wheelLabel: "5 TRIỆU",
    symbol: "red_envelope",
    active: true,
  },
  {
    id: "reward-4m",
    codePrefix: "VOUCHER_4M",
    title: "Voucher mua hàng 4.000.000đ",
    value: 4_000_000,
    description: "Voucher mua hàng trị giá 4.000.000đ",
    wheelLabel: "4 TRIỆU",
    symbol: "star",
    active: true,
  },
  {
    id: "reward-3m",
    codePrefix: "VOUCHER_3M",
    title: "Voucher mua hàng 3.000.000đ",
    value: 3_000_000,
    description: "Voucher mua hàng trị giá 3.000.000đ",
    wheelLabel: "3 TRIỆU",
    symbol: "star",
    active: true,
  },
  {
    id: "reward-2m",
    codePrefix: "VOUCHER_2M",
    title: "Voucher mua hàng 2.000.000đ",
    value: 2_000_000,
    description: "Voucher mua hàng trị giá 2.000.000đ",
    wheelLabel: "2 TRIỆU",
    symbol: "bell",
    active: true,
  },
  {
    id: "reward-100k",
    codePrefix: "VOUCHER_100K",
    title: "Voucher mua hàng 100.000đ",
    value: 100_000,
    description: "Voucher mua hàng trị giá 100.000đ",
    wheelLabel: "100K",
    symbol: "bell",
    active: true,
  },
];

const SYMBOL_CODES: SymbolCode[] = [
  "cherry",
  "lemon",
  "bell",
  "star",
  "red_envelope",
];

function isSymbolCode(value: unknown): value is SymbolCode {
  return typeof value === "string" && SYMBOL_CODES.includes(value as SymbolCode);
}

function normalizeBanners(value: unknown): BannerConfig[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Partial<BannerConfig> => Boolean(item && typeof item === "object"))
    .map((item, index) => ({
      id: typeof item.id === "string" && item.id ? item.id : `banner-${Date.now()}-${index}`,
      title: typeof item.title === "string" ? item.title : "Banner chương trình",
      imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : "",
      linkUrl: typeof item.linkUrl === "string" ? item.linkUrl : undefined,
      active: item.active !== false,
      order: Number.isFinite(item.order) ? Number(item.order) : index,
    }))
    .filter((item) => item.imageUrl.trim());
}

function normalizeRewardCatalog(value: unknown): RewardCatalogItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Partial<RewardCatalogItem> => Boolean(item && typeof item === "object"))
    .map((item, index) => ({
      id: typeof item.id === "string" && item.id ? item.id : `reward-${Date.now()}-${index}`,
      codePrefix:
        typeof item.codePrefix === "string" && item.codePrefix
          ? item.codePrefix
          : `REWARD_${index + 1}`,
      title: typeof item.title === "string" ? item.title : "Giải thưởng",
      value: Math.max(0, Number(item.value) || 0),
      description: typeof item.description === "string" ? item.description : "",
      wheelLabel:
        typeof item.wheelLabel === "string" && item.wheelLabel
          ? item.wheelLabel
          : `${Math.max(0, Number(item.value) || 0).toLocaleString("vi-VN")}đ`,
      symbol: isSymbolCode(item.symbol) ? item.symbol : "star",
      active: item.active !== false,
    }))
    .filter((item) => item.title.trim() && item.value > 0);
}

export function readBanners(): BannerConfig[] {
  return (memoryBanners || DEFAULT_BANNERS).map((banner) => ({ ...banner }));
}

export function writeBanners(banners: BannerConfig[]) {
  memoryBanners = normalizeBanners(banners);
  window.dispatchEvent(new Event("lucky-wheels:banners-updated"));
}

export function getActiveBanners() {
  const active = readBanners()
    .filter((banner) => banner.active && banner.imageUrl.trim())
    .sort((a, b) => a.order - b.order);

  return active.length > 0
    ? active
    : DEFAULT_BANNERS.map((banner) => ({ ...banner }));
}

export function getDefaultBanners() {
  return DEFAULT_BANNERS.map((banner) => ({ ...banner }));
}

export function resetBanners() {
  writeBanners(DEFAULT_BANNERS);
  return readBanners();
}

export function readRewardCatalog(): RewardCatalogItem[] {
  return (memoryRewardCatalog || DEFAULT_REWARD_CATALOG).map((item) => ({ ...item }));
}

export function writeRewardCatalog(items: RewardCatalogItem[]) {
  memoryRewardCatalog = normalizeRewardCatalog(items);
  window.dispatchEvent(new Event("lucky-wheels:reward-catalog-updated"));
}

export function getRewardCatalogItemByValue(value: number) {
  return readRewardCatalog().find((item) => item.value === value);
}

export function getRewardCatalogItemById(id: string) {
  return readRewardCatalog().find((item) => item.id === id);
}

export function resetRewardCatalog() {
  writeRewardCatalog(DEFAULT_REWARD_CATALOG);
  return readRewardCatalog();
}

export function getRemoteProgramRules() {
  return memoryProgramRules;
}

export async function syncRemoteContent() {
  try {
    const content = await apiRequest<{
      banners?: BannerConfig[];
      rewards?: RewardCatalogItem[];
      rules?: Record<string, unknown> | null;
      zbsConfigured?: boolean;
    }>("/content");
    if (typeof content.zbsConfigured === "boolean") {
      zbsService.setConfigured(content.zbsConfigured);
    }
    if (Array.isArray(content.banners)) writeBanners(content.banners);
    if (Array.isArray(content.rewards)) writeRewardCatalog(content.rewards);
    if (content.rules && typeof content.rules === "object") memoryProgramRules = content.rules;
    return true;
  } catch (error) {
    console.warn("Unable to sync campaign content from backend", error);
    return false;
  }
}
