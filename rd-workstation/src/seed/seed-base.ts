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

const systems = [
  { id: 'sys_vss', code: 'VSS', name: '视频监控系统', category: '安全防范', description: '视频监控，含点位/存储/网络', icon: 'video', sort_order: 1, enabled: true },
  { id: 'sys_acs', code: 'ACS', name: '门禁一卡通', category: '安全防范', description: '门禁与一卡通', icon: 'lock', sort_order: 2, enabled: true },
  { id: 'sys_lan', code: 'LAN', name: '综合布线网络', category: '信息网络', description: '综合布线/网络', icon: 'network', sort_order: 3, enabled: true },
  { id: 'sys_cab', code: 'CAB', name: '综合布线', category: '信息网络', description: '综合布线', icon: 'cable', sort_order: 4, enabled: true },
  { id: 'sys_bms', code: 'BMS', name: '楼宇自控', category: '楼宇控制', description: '楼宇自控系统', icon: 'building', sort_order: 5, enabled: true },
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

/** 系统基础表数据 */
export const baseTables: Record<string, Row[]> = {
  grades,
  system_templates,
  systems,
  design_parameters,
  point_categories,
}