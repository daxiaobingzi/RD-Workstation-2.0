export const GRADE_LABEL: Record<string, string> = { economic: '经济型', standard: '标准型', premium: '高端型' }
export const PRICE_TYPE_LABEL: Record<string, string> = { reference: '参考价', market: '市场价', supplier: '供应商价', project: '项目价' }
export const PRICE_TYPES = ['reference', 'market', 'supplier', 'project'] as const
export const SYSTEM_GROUPS: Record<string, string> = { sys_vss: '安全防范（视频监控）', sys_lan: '信息网络（网络设备）', __other: '通用设备' }

export type WarnFilter = 'missing_price' | 'disabled_use' | null