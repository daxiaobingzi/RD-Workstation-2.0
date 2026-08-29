import type { Row } from '../types/domain'
import { now } from './lib'

const grades = [
  { id: 'g_economic', code: 'economic', name: '经济型', sort_order: 1, enabled: true },
  { id: 'g_standard', code: 'standard', name: '标准型', sort_order: 2, enabled: true },
  { id: 'g_premium', code: 'premium', name: '高端型', sort_order: 3, enabled: true },
]

const system_templates = [
  { id: 'st_vss_office', system_id: 'sys_vss', name: '视频监控-办公建筑标准模板', version: '1.0', description: '4MP / H.265 / 30 天存储；室内半球 + 出入口枪机 + 室外球机', created_at: now, updated_at: now },
  { id: 'st_vss_hospital', system_id: 'sys_vss', name: '视频监控-医疗建筑标准模板', version: '1.0', description: '重点区域 4MP 全彩，存储 45 天', created_at: now, updated_at: now },
  { id: 'st_acs_office', system_id: 'sys_acs', name: '门禁-办公建筑标准模板', version: '1.1', description: '一卡通 + 访客管理 + 电梯层控', created_at: now, updated_at: now },
]

// 弱电智能化系统目录（P2：用户常用 16 系统 + 原有 楼宇自控）
const systems = [
  { id: 'sys_vss', code: 'VSS', name: '视频监控系统', category: '安防', description: '视频监控，含点位/存储/网络', icon: 'video', sort_order: 1, enabled: true },
  { id: 'sys_acs', code: 'ACS', name: '门禁管理系统', category: '安防', description: '门禁与一卡通', icon: 'lock', sort_order: 2, enabled: true },
  { id: 'sys_ias', code: 'IAS', name: '入侵报警系统', category: '安防', description: '入侵报警/紧急报警', icon: 'alert', sort_order: 3, enabled: true },
  { id: 'sys_pat', code: 'PAT', name: '电子巡更系统', category: '安防', description: '电子巡更', icon: 'route', sort_order: 4, enabled: true },
  { id: 'sys_fen', code: 'FEN', name: '电子围栏系统', category: '安防', description: '周界电子围栏', icon: 'shield', sort_order: 5, enabled: true },
  { id: 'sys_ics', code: 'ICS', name: '可视对讲系统', category: '安防', description: '可视对讲', icon: 'phone', sort_order: 6, enabled: true },
  { id: 'sys_lan', code: 'LAN', name: '信息网络系统', category: '信息网络', description: '综合布线/网络', icon: 'network', sort_order: 7, enabled: true },
  { id: 'sys_cab', code: 'PDS', name: '综合布线系统', category: '信息网络', description: '综合布线', icon: 'cable', sort_order: 8, enabled: true },
  { id: 'sys_gpn', code: 'GPN', name: '全光网络系统', category: '信息网络', description: '全光网络（FTTR/GPON）', icon: 'fiber', sort_order: 9, enabled: true },
  { id: 'sys_wls', code: 'WLS', name: '无线对讲系统', category: '信息网络', description: '无线对讲', icon: 'radio', sort_order: 10, enabled: true },
  { id: 'sys_cee', code: 'CEE', name: '机房工程', category: '机房', description: '机房基础环境/供配电/精密空调', icon: 'server', sort_order: 11, enabled: true },
  { id: 'sys_pipe', code: 'PIPE', name: '综合管路系统', category: '机房', description: '管线桥架与管路', icon: 'pipe', sort_order: 12, enabled: true },
  { id: 'sys_cps', code: 'CPS', name: '停车管理系统', category: '公共设施', description: '停车管理系统', icon: 'car', sort_order: 13, enabled: true },
  { id: 'sys_pas', code: 'PAS', name: '公共广播系统', category: '公共设施', description: '公共广播/背景音乐', icon: 'speaker', sort_order: 14, enabled: true },
  { id: 'sys_info', code: 'INFO', name: '信息发布系统', category: '公共设施', description: '信息发布/多媒体', icon: 'screen', sort_order: 15, enabled: true },
  { id: 'sys_led', code: 'LED', name: 'LED大屏显示系统', category: '公共设施', description: 'LED大屏显示', icon: 'monitor', sort_order: 16, enabled: true },
  { id: 'sys_bms', code: 'BMS', name: '楼宇自控', category: '楼宇控制', description: '楼宇自控系统', icon: 'building', sort_order: 17, enabled: true },
]

const design_parameters = [
  { id: 'dp_res', project_system_id: 'ps_vss_001', parameter_key: 'resolution', parameter_name: '分辨率', value_type: 'number', value_json: 4, unit: 'MP', required: true },
  { id: 'dp_bit', project_system_id: 'ps_vss_001', parameter_key: 'bitrate_mbps', parameter_name: '码流', value_type: 'number', value_json: 4, unit: 'Mbps', required: true },
  { id: 'dp_days', project_system_id: 'ps_vss_001', parameter_key: 'storage_days', parameter_name: '存储天数', value_type: 'number', value_json: 30, unit: '天', required: true },
  { id: 'dp_codec', project_system_id: 'ps_vss_001', parameter_key: 'codec', parameter_name: '编码', value_type: 'string', value_json: 'H.265', required: true },
]

const point_categories = [
  { id: 'pc_in', system_id: 'sys_vss', code: 'indoor', name: '室内摄像机', sort_order: 1, enabled: true },
  { id: 'pc_out', system_id: 'sys_vss', code: 'outdoor', name: '室外摄像机', sort_order: 2, enabled: true },
  { id: 'pc_ele', system_id: 'sys_vss', code: 'elevator', name: '电梯摄像机', sort_order: 3, enabled: true },
  { id: 'pc_ent', system_id: 'sys_vss', code: 'entrance', name: '出入口摄像机', sort_order: 4, enabled: true },
]

/* P5：选型方案种子（演示：经济型方案 优先低价 + 兼容品牌规则） */
const selection_schemes = [
  { id: 'sch_vss_econ', name: '视频监控-经济型方案', system_id: 'sys_vss', description: '优先低价型号，控制造价', enabled: true, is_default: false, created_at: now, updated_at: now },
  { id: 'sch_vss_hik', name: '视频监控-海康优选方案', system_id: 'sys_vss', description: '品牌偏好海康威视 + 标准档', enabled: true, is_default: false, created_at: now, updated_at: now },
]
const scheme_rules = [
  { id: 'srl_a1', scheme_id: 'sch_vss_econ', kind: 'camera', grade_code: 'economic', prefer_lowest_price: true, priority: 10, enabled: true },
  { id: 'srl_a2', scheme_id: 'sch_vss_econ', kind: 'poe_switch', prefer_lowest_price: true, priority: 20, enabled: true },
  { id: 'srl_a3', scheme_id: 'sch_vss_econ', kind: 'hdd', prefer_lowest_price: true, priority: 30, enabled: true },
  { id: 'srl_b1', scheme_id: 'sch_vss_hik', kind: 'camera', brand_id: 'b_hik', grade_code: 'standard', priority: 10, enabled: true },
  { id: 'srl_b2', scheme_id: 'sch_vss_hik', kind: 'nvr', brand_id: 'b_hik', grade_code: 'standard', priority: 20, enabled: true },
]

/** 系统基础表数据 */
export const baseTables: Record<string, Row[]> = {
  grades,
  system_templates,
  systems,
  design_parameters,
  point_categories,
  selection_schemes,
  scheme_rules,
}