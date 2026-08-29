export const GRADE_LABEL: Record<string, string> = { economic: '经济型', standard: '标准型', premium: '高端型' }
export const PRICE_TYPE_LABEL: Record<string, string> = { reference: '参考价', market: '市场价', supplier: '供应商价', project: '项目价' }
export const PRICE_TYPES = ['reference', 'market', 'supplier', 'project'] as const
/** 弱电智能化系统分组标签（P2：与系统目录对应） */
export const SYSTEM_GROUPS: Record<string, string> = {
  sys_vss: '安防 · 视频监控',
  sys_acs: '安防 · 门禁管理',
  sys_ias: '安防 · 入侵报警',
  sys_pat: '安防 · 电子巡更',
  sys_fen: '安防 · 电子围栏',
  sys_ics: '安防 · 可视对讲',
  sys_lan: '信息网络 · 信息网络',
  sys_cab: '信息网络 · 综合布线',
  sys_gpn: '信息网络 · 全光网络',
  sys_wls: '信息网络 · 无线对讲',
  sys_cee: '机房 · 机房工程',
  sys_pipe: '机房 · 综合管路',
  sys_cps: '公共设施 · 停车管理',
  sys_pas: '公共设施 · 公共广播',
  sys_info: '公共设施 · 信息发布',
  sys_led: '公共设施 · LED大屏',
  sys_bms: '楼宇控制 · 楼宇自控',
  __other: '通用设备',
} as const
/** 系统分组展示顺序（按系统目录 sort_order） */
export const SYSTEM_ORDER: string[] = [
  'sys_vss', 'sys_acs', 'sys_ias', 'sys_pat', 'sys_fen', 'sys_ics',
  'sys_lan', 'sys_cab', 'sys_gpn', 'sys_wls',
  'sys_cee', 'sys_pipe',
  'sys_cps', 'sys_pas', 'sys_info', 'sys_led',
  'sys_bms', '__other',
]

export type WarnFilter = 'missing_price' | 'disabled_use' | null