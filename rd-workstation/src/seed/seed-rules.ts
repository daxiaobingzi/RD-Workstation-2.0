import type { Row } from '../types/domain'

const design_rules = [
  { id: 'rule_poe', system_id: 'sys_vss', code: 'R-CAM-POE', name: '摄像机→POE交换机', description: '每 24 个摄像机端口配 1 台 24 口 POE 交换机', rule_type: 'derive', source_type: 'camera', target_type: 'poe_switch', formula_json: 'ceil(camera_count / 24)', priority: 1, enabled: true },
  { id: 'rule_nvr', system_id: 'sys_vss', code: 'R-CAM-NVR', name: '摄像机→NVR', description: '每 32 路摄像机配 1 台 32 路 NVR', rule_type: 'derive', source_type: 'camera', target_type: 'nvr', formula_json: 'ceil(camera_count / 32)', priority: 2, enabled: true },
  { id: 'rule_hdd', system_id: 'sys_vss', code: 'R-CAM-HDD', name: '存储容量→硬盘', description: '按码流/天数计算存储，每 8TB 一块硬盘', rule_type: 'derive', source_type: 'camera', target_type: 'hdd', formula_json: 'ceil(storage_tb / 8)', priority: 3, enabled: true },
  { id: 'rule_agg', system_id: 'sys_vss', code: 'R-POE-AGG', name: 'POE→汇聚交换机', description: '每 8 台 POE 汇聚到 1 台汇聚交换机', rule_type: 'derive', source_type: 'poe', target_type: 'aggregation', formula_json: 'ceil(poe_count / 8)', priority: 4, enabled: true },
  { id: 'rule_mount', system_id: 'sys_vss', code: 'R-CAM-MOUNT', name: '摄像机→支架', description: '每台摄像机配 1 套通用支架（含防护罩）', rule_type: 'derive', source_type: 'camera', target_type: 'mount', formula_json: 'camera_count', priority: 5, enabled: true },
  { id: 'rule_cable', system_id: 'sys_vss', code: 'R-CAM-CABLE', name: '点位→线缆', description: '按 90m/点位估算，305 米/箱（条件：有点位才生成）', rule_type: 'derive', source_type: 'camera', target_type: 'cable', formula_json: 'ceil(camera_count * 90 / 305)', condition_json: 'camera_count > 0', priority: 6, enabled: true },
]

const rule_bindings = [
  { id: 'rb_1', rule_id: 'rule_poe', enabled: true },
  { id: 'rb_2', rule_id: 'rule_nvr', enabled: true },
  { id: 'rb_3', rule_id: 'rule_hdd', enabled: true },
  { id: 'rb_4', rule_id: 'rule_agg', enabled: true },
  { id: 'rb_5', rule_id: 'rule_mount', enabled: true },
  { id: 'rb_6', rule_id: 'rule_cable', enabled: true },
]

/** 设计规则表数据 */
export const ruleTables: Record<string, Row[]> = {
  design_rules,
  rule_bindings,
}