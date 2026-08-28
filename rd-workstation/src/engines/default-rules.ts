/** 程序内置 fallback 默认规则（buildVars / ValidationEngine 等复用） */
export const DEFAULT_RULES = {
  bitrateMbps: 4,
  storageDays: 30,
  hddCapacityTb: 8,
} as const