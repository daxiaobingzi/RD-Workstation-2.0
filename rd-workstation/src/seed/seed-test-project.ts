import type { Row } from '../types/domain'
import { now } from './lib'

/**
 * 测试用丰富项目：「XX 科技园总部大楼智能化」proj_004
 * 覆盖多系统全数据链：建筑/弱电间 → 点位 → 推导结果 → 设备选型 → 清单版本 → 预算 →
 * 文档/任务/日程/点位快照。用于验收各模块联动（推导/设备/清单/预算/设备中心互链）。
 * 命名约定：proj_004 / ps_004_* / pt_004_* / dr_004_* / sel_004_* / bv_004_* / bi_004_* / bg_004_* / bgi_004_*
 */

/* ---------- 项目 ---------- */
const projects = [
  {
    id: 'proj_004', project_code: 'PJ-2026-004', name: 'XX科技园总部大楼智能化', project_type: '办公 · 智能楼宇',
    building_type: '科技园区', client_name: 'XX科技有限公司', location: '苏州工业园区', building_area: 156000,
    floor_count: 22, design_stage: '初设', status: 'designing', default_grade_code: 'standard',
    start_date: '2026-06-01', planned_end_date: '2027-03-31', description: '总部大楼弱电智能化系统设计测试项目：视频监控/门禁/综合布线/信息网络/机房/公共广播',
    created_at: now, updated_at: now,
  },
]

const buildings = [
  { id: 'bld_004_t1', project_id: 'proj_004', name: 'T1主楼', sort_order: 1, enabled: true, created_at: now, updated_at: now },
  { id: 'bld_004_cp', project_id: 'proj_004', name: '地下车库', sort_order: 2, enabled: true, created_at: now, updated_at: now },
]

const telecom_rooms = [
  { id: 'tr_004_1f', building_id: 'bld_004_t1', name: '1F-机房', sort_order: 1, enabled: true },
  { id: 'tr_004_8f', building_id: 'bld_004_t1', name: '8F-IDF', sort_order: 2, enabled: true },
  { id: 'tr_004_16f', building_id: 'bld_004_t1', name: '16F-IDF', sort_order: 3, enabled: true },
  { id: 'tr_004_b1', building_id: 'bld_004_cp', name: 'B1-IDF', sort_order: 1, enabled: true },
]

/* ---------- 项目子系统（覆盖 6 个系统） ---------- */
const project_systems = [
  { id: 'ps_004_vss', project_id: 'proj_004', system_id: 'sys_vss', status: 'designing', progress: 62, design_grade: 'standard', sort_order: 1, created_at: now, updated_at: now },
  { id: 'ps_004_acs', project_id: 'proj_004', system_id: 'sys_acs', status: 'designing', progress: 45, design_grade: 'standard', sort_order: 2, created_at: now, updated_at: now },
  { id: 'ps_004_cab', project_id: 'proj_004', system_id: 'sys_cab', status: 'designing', progress: 38, design_grade: 'economic', sort_order: 3, created_at: now, updated_at: now },
  { id: 'ps_004_lan', project_id: 'proj_004', system_id: 'sys_lan', status: 'designing', progress: 55, design_grade: 'standard', sort_order: 4, created_at: now, updated_at: now },
  { id: 'ps_004_cee', project_id: 'proj_004', system_id: 'sys_cee', status: 'reviewing', progress: 80, design_grade: 'standard', sort_order: 5, created_at: now, updated_at: now },
  { id: 'ps_004_pas', project_id: 'proj_004', system_id: 'sys_pas', status: 'draft', progress: 15, design_grade: 'standard', sort_order: 6, created_at: now, updated_at: now },
]

/* ---------- 设计参数（各系统入参） ---------- */
const design_parameters = [
  // VSS 视频监控
  { id: 'dp_004_r', project_system_id: 'ps_004_vss', parameter_key: 'resolution', parameter_name: '分辨率', value_type: 'number', value_json: 4, unit: 'MP', required: true },
  { id: 'dp_004_b', project_system_id: 'ps_004_vss', parameter_key: 'bitrate_mbps', parameter_name: '码流', value_type: 'number', value_json: 4, unit: 'Mbps', required: true },
  { id: 'dp_004_d', project_system_id: 'ps_004_vss', parameter_key: 'storage_days', parameter_name: '存储天数', value_type: 'number', value_json: 30, unit: '天', required: true },
  // ACS 门禁
  { id: 'dp_004_ac1', project_system_id: 'ps_004_acs', parameter_key: 'door_count', parameter_name: '门点数', value_type: 'number', value_json: 24, unit: '门', required: true },
  // CAB 综合布线
  { id: 'dp_004_cb1', project_system_id: 'ps_004_cab', parameter_key: 'info_points', parameter_name: '信息点', value_type: 'number', value_json: 260, unit: '点', required: true },
  // LAN 信息网络
  { id: 'dp_004_ln1', project_system_id: 'ps_004_lan', parameter_key: 'ap_count', parameter_name: 'AP 数量', value_type: 'number', value_json: 32, unit: '台', required: true },
]

/* ---------- 点位（多系统） ---------- */
const pts: { id: string; ps: string; code: string; device: string; building: string; telecom?: string; qty: number }[] = [
  // VSS 视频监控
  { id: 'pt_004_v01', ps: 'ps_004_vss', code: 'VSS-101', device: 'prod_bullet', building: 'bld_004_t1', telecom: 'tr_004_1f', qty: 18 },
  { id: 'pt_004_v02', ps: 'ps_004_vss', code: 'VSS-102', device: 'prod_dome', building: 'bld_004_t1', telecom: 'tr_004_8f', qty: 30 },
  { id: 'pt_004_v03', ps: 'ps_004_vss', code: 'VSS-103', device: 'prod_bullet', building: 'bld_004_t1', telecom: 'tr_004_16f', qty: 12 },
  { id: 'pt_004_v04', ps: 'ps_004_vss', code: 'VSS-104', device: 'prod_dome', building: 'bld_004_cp', telecom: 'tr_004_b1', qty: 16 },
  { id: 'pt_004_v05', ps: 'ps_004_vss', code: 'VSS-105', device: 'prod_ptz', building: 'bld_004_t1', telecom: 'tr_004_1f', qty: 4 },
  // ACS 门禁
  { id: 'pt_004_a01', ps: 'ps_004_acs', code: 'ACS-201', device: 'prod_acs_reader', building: 'bld_004_t1', telecom: 'tr_004_1f', qty: 8 },
  { id: 'pt_004_a02', ps: 'ps_004_acs', code: 'ACS-202', device: 'prod_acs_reader', building: 'bld_004_t1', telecom: 'tr_004_8f', qty: 8 },
  { id: 'pt_004_a03', ps: 'ps_004_acs', code: 'ACS-203', device: 'prod_acs_reader', building: 'bld_004_cp', telecom: 'tr_004_b1', qty: 8 },
  { id: 'pt_004_a04', ps: 'ps_004_acs', code: 'ACS-204', device: 'prod_acs_lock', building: 'bld_004_t1', telecom: 'tr_004_1f', qty: 24 },
  // CAB 综合布线
  { id: 'pt_004_c01', ps: 'ps_004_cab', code: 'PDS-301', device: 'prod_cab_panel', building: 'bld_004_t1', telecom: 'tr_004_1f', qty: 96 },
  { id: 'pt_004_c02', ps: 'ps_004_cab', code: 'PDS-302', device: 'prod_cab_panel', building: 'bld_004_t1', telecom: 'tr_004_8f', qty: 96 },
  { id: 'pt_004_c03', ps: 'ps_004_cab', code: 'PDS-303', device: 'prod_cab_panel', building: 'bld_004_t1', telecom: 'tr_004_16f', qty: 68 },
  // PAS 公共广播
  { id: 'pt_004_p01', ps: 'ps_004_pas', code: 'PAS-401', device: 'prod_pas_speaker', building: 'bld_004_t1', telecom: 'tr_004_8f', qty: 40 },
  { id: 'pt_004_p02', ps: 'ps_004_pas', code: 'PAS-402', device: 'prod_pas_speaker', building: 'bld_004_cp', telecom: 'tr_004_b1', qty: 16 },
]

const points = pts.map((p) => ({
  id: p.id, project_system_id: p.ps, point_code: p.code, device_id: p.device,
  building_id: p.building, telecom_room_id: p.telecom, quantity: p.qty, unit: '台',
  status: 'designed', created_at: now, updated_at: now,
}))

/* ---------- 推导结果（模拟各系统规则的推导输出） ---------- */
const dr = (id: string, ps: string, type: string, qty: number, unit: string, sourceType: string = 'derive', snap?: string) => ({
  id, project_system_id: ps, result_type: type, source_type: sourceType, quantity: qty, unit,
  formula_snapshot: snap, rule_snapshot: snap, created_at: now,
})
const design_results = [
  // VSS
  dr('dr_004_v1', 'ps_004_vss', 'camera', 80, '台', 'derive', 'camera_count'),
  dr('dr_004_v2', 'ps_004_vss', 'poe_switch', 4, '台', 'derive', 'ceil(camera_count/24)'),
  dr('dr_004_v3', 'ps_004_vss', 'nvr', 3, '台', 'derive', 'ceil(camera_count/32)'),
  dr('dr_004_v4', 'ps_004_vss', 'hdd', 12, '块', 'derive', 'storage_tb→hdd'),
  dr('dr_004_v5', 'ps_004_vss', 'mount', 80, '套', 'derive', 'camera_count'),
  dr('dr_004_v6', 'ps_004_vss', 'cable', 24, '箱', 'quota', '定额-六类非屏蔽双绞线'),
  // ACS
  dr('dr_004_a1', 'ps_004_acs', 'reader', 24, '台', 'derive', 'door_count'),
  dr('dr_004_a2', 'ps_004_acs', 'controller', 24, '台', 'derive', 'door_count'),
  dr('dr_004_a3', 'ps_004_acs', 'lock', 24, '把', 'derive', 'door_count'),
  dr('dr_004_a4', 'ps_004_acs', 'button', 24, '个', 'derive', 'door_count'),
  dr('dr_004_a5', 'ps_004_acs', 'cable', 8, '箱', 'quota', '定额-读卡器线'),
  // CAB
  dr('dr_004_c1', 'ps_004_cab', 'panel', 260, '个', 'derive', 'info_points'),
  dr('dr_004_c2', 'ps_004_cab', 'patch_panel', 11, '个', 'derive', 'ceil(info_points/24)'),
  dr('dr_004_c3', 'ps_004_cab', 'organizer', 6, '个', 'derive', 'rack_accessories'),
  dr('dr_004_c4', 'ps_004_cab', 'cable', 30, '箱', 'quota', '定额-六类非屏蔽双绞线'),
  // LAN
  dr('dr_004_l1', 'ps_004_lan', 'core_switch', 2, '台', 'derive', 'redundant_pair'),
  dr('dr_004_l2', 'ps_004_lan', 'access_switch', 8, '台', 'derive', 'ceil(info_points/24)'),
  dr('dr_004_l3', 'ps_004_lan', 'ap', 32, '台', 'derive', 'ap_count'),
  // CEE
  dr('dr_004_e1', 'ps_004_cee', 'ups', 1, '台', 'derive', 'ups_budget'),
  dr('dr_004_e2', 'ps_004_cee', 'precision_ac', 2, '台', 'derive', 'ac_budget'),
  dr('dr_004_e3', 'ps_004_cee', 'cabinet', 6, '台', 'derive', 'server_cabinet'),
  // PAS
  dr('dr_004_p1', 'ps_004_pas', 'speaker', 56, '只', 'derive', 'speaker_count'),
  dr('dr_004_p2', 'ps_004_pas', 'amplifier', 4, '台', 'derive', 'ceil(speaker/15)'),
]

/* ---------- 设备选型（价格快照；model 均来自设备中心 seed） ---------- */
const sel = (
  id: string, ps: string, modelId: string, qty: number, unit: string, price: number,
  reason: string, categoryLabel?: string,
) => ({
  id, project_system_id: ps, model_id: modelId, selection_source: 'engine', selection_reason: reason,
  grade_code: 'standard', quantity: qty, unit, unit_price: price, total_price: price * qty,
  status: 'selected', remark: categoryLabel, created_at: now, updated_at: now,
})
const device_selections = [
  // VSS：枪机标准档 / 半球标准档 / 球机标准档 / POE / NVR / 硬盘 / 支架
  sel('sel_004_v1', 'ps_004_vss', 'm_bullet_s', 30, '台', 1280, '点位-高清枪型摄像机', '摄像机'),
  sel('sel_004_v2', 'ps_004_vss', 'm_dome_s', 46, '台', 980, '点位-红外半球摄像机', '摄像机'),
  sel('sel_004_v3', 'ps_004_vss', 'm_ptz_s', 4, '台', 3450, '点位-星光球型摄像机', '摄像机'),
  sel('sel_004_v4', 'ps_004_vss', 'm_poe_s', 4, '台', 1580, '推导-POE交换机', '网络设备'),
  sel('sel_004_v5', 'ps_004_vss', 'm_agg_s', 2, '台', 8600, '推导-汇聚交换机', '网络设备'),
  sel('sel_004_v6', 'ps_004_vss', 'm_nvr_s', 3, '台', 6200, '推导-NVR', '后端设备'),
  sel('sel_004_v7', 'ps_004_vss', 'm_hdd_s', 12, '块', 1280, '推导-监控硬盘', '存储'),
  sel('sel_004_v8', 'ps_004_vss', 'm_mount_s', 80, '套', 45, '推导-摄像机支架', '辅材'),
  // ACS
  sel('sel_004_a1', 'ps_004_acs', 'm_acs_reader_h', 24, '台', 320, '点位-门禁读卡器', '门禁'),
  sel('sel_004_a2', 'ps_004_acs', 'm_acs_ctrl_s', 24, '台', 780, '推导-门禁控制器', '门禁'),
  sel('sel_004_a3', 'ps_004_acs', 'm_acs_lock_s', 24, '把', 150, '推导-电插锁', '门禁'),
  sel('sel_004_a4', 'ps_004_acs', 'm_acs_btn_s', 24, '个', 25, '推导-出门按钮', '门禁'),
  // CAB
  sel('sel_004_c1', 'ps_004_cab', 'm_cab_panel_s', 260, '个', 18, '点位-信息面板', '综合布线'),
  sel('sel_004_c2', 'ps_004_cab', 'm_cab_patch_s', 11, '个', 210, '推导-配线架', '综合布线'),
  sel('sel_004_c3', 'ps_004_cab', 'm_cab_org_s', 6, '个', 45, '推导-理线器', '综合布线'),
  sel('sel_004_c4', 'ps_004_cab', 'm_cable_s', 30, '箱', 680, '推导-六类网线', '线缆'),
  // LAN
  sel('sel_004_l1', 'ps_004_lan', 'm_sw_core_h', 2, '台', 36000, '推导-核心交换机', '网络设备'),
  sel('sel_004_l2', 'ps_004_lan', 'm_sw_acc_s', 8, '台', 2600, '推导-接入交换机', '网络设备'),
  sel('sel_004_l3', 'ps_004_lan', 'm_sw_acc_e', 2, '台', 860, '推导-接入交换机(经济)', '网络设备'),
  // CEE
  sel('sel_004_e1', 'ps_004_cee', 'm_cee_ups_s', 1, '台', 9800, '推导-UPS', '机房'),
  sel('sel_004_e2', 'ps_004_cee', 'm_cee_ac_s', 2, '台', 12000, '推导-精密空调', '机房'),
  sel('sel_004_e3', 'ps_004_cee', 'm_cee_cab_s', 6, '台', 2600, '推导-服务器机柜', '机房'),
  // PAS
  sel('sel_004_p1', 'ps_004_pas', 'm_pas_spk_s', 56, '只', 38, '点位-吸顶扬声器', '广播'),
  sel('sel_004_p2', 'ps_004_pas', 'm_pas_amp_s', 4, '台', 880, '推导-广播功放', '广播'),
]

/* ---------- 清单版本 + 清单项 ---------- */
const bill_versions = [
  { id: 'bv_004_v1', project_id: 'proj_004', version_no: 'V1', name: '清单 V1', source: 'engine', status: 'draft', created_by: 'seed', created_at: now, updated_at: now },
]

// 清单项由"选型行（selection）+ 定额材料行（quota）"组成，与 BillEngine 输出结构一致
const mkBillItem = (id: string, vId: string, ps: string, item: {
  modelId?: string; name: string; category: string; qty: number; price: number; unit: string; sourceType: string; sourceId: string; spec?: string
}, sort: number) => ({
  id, bill_version_id: vId, project_system_id: ps, device_model_id: item.modelId,
  item_code: `BI-004-${String(sort).padStart(3, '0')}`, item_name: item.name, specification: item.spec,
  unit: item.unit, quantity: item.qty, unit_price: item.price, amount: Math.round(item.qty * item.price * 100) / 100,
  category: item.category, source_type: item.sourceType, source_id: item.sourceId, sort_order: sort,
})

const v1 = 'bv_004_v1'
let biSort = 0
const nextSort = () => ++biSort
const bil = (
  id: string, ps: string, modelId: string | undefined, name: string, category: string,
  qty: number, price: number, unit: string, sourceType: string, sourceId: string, spec?: string,
) => mkBillItem(id, v1, ps, { modelId, name, category, qty, price, unit, sourceType, sourceId, spec }, nextSort())

const bill_items = [
  // ===== VSS =====
  bil('bi_004_v1', 'ps_004_vss', 'm_bullet_s', 'DS-2CD2646FW', '摄像机', 30, 1280, '台', 'selection', 'sel_004_v1', '4MP 星光枪机'),
  bil('bi_004_v2', 'ps_004_vss', 'm_dome_s', 'DS-2CD2346', '摄像机', 46, 980, '台', 'selection', 'sel_004_v2', '4MP 星光半球'),
  bil('bi_004_v3', 'ps_004_vss', 'm_ptz_s', 'DS-2DE4225', '摄像机', 4, 3450, '台', 'selection', 'sel_004_v3', '4MP 球机 25x'),
  bil('bi_004_v4', 'ps_004_vss', 'm_poe_s', 'S5735-L24P4S', '网络设备', 4, 1580, '台', 'selection', 'sel_004_v4', '24口千兆POE'),
  bil('bi_004_v5', 'ps_004_vss', 'm_agg_s', 'S6730-S24X6Q', '网络设备', 2, 8600, '台', 'selection', 'sel_004_v5', '24口万兆汇聚'),
  bil('bi_004_v6', 'ps_004_vss', 'm_nvr_s', 'DS-9632NXI', '后端设备', 3, 6200, '台', 'selection', 'sel_004_v6', '32路 NVR'),
  bil('bi_004_v7', 'ps_004_vss', 'm_hdd_s', 'ST8000VX004', '存储', 12, 1280, '块', 'selection', 'sel_004_v7', '8TB 监控硬盘'),
  bil('bi_004_v8', 'ps_004_vss', 'm_mount_s', 'DS-1212ZJ', '辅材', 80, 45, '套', 'selection', 'sel_004_v8', '通用摄像机支架（含防护罩）'),
  bil('bi_004_v9', 'ps_004_vss', undefined, '六类非屏蔽双绞线', '线缆', 7200, 2.8, '米', 'quota', 'dr_004_v6', 'CAT6 UTP'),
  // ===== ACS =====
  bil('bi_004_a1', 'ps_004_acs', 'm_acs_reader_h', 'DS-K1102', '门禁', 24, 320, '台', 'selection', 'sel_004_a1', 'IC/ID 刷卡+密码'),
  bil('bi_004_a2', 'ps_004_acs', 'm_acs_ctrl_s', 'DS-K2601', '门禁', 24, 780, '台', 'selection', 'sel_004_a2', '单门 TCP/IP 控制器'),
  bil('bi_004_a3', 'ps_004_acs', 'm_acs_lock_s', 'DS-K4H250', '门禁', 24, 150, '把', 'selection', 'sel_004_a3', '280kg 电插锁'),
  bil('bi_004_a4', 'ps_004_acs', 'm_acs_btn_s', 'EB29', '门禁', 24, 25, '个', 'selection', 'sel_004_a4', '86型 出门按钮'),
  bil('bi_004_a5', 'ps_004_acs', undefined, '读卡器线', '线缆', 360, 2.2, '米', 'quota', 'dr_004_a5', 'RVV4*0.5'),
  // ===== CAB =====
  bil('bi_004_c1', 'ps_004_cab', 'm_cab_panel_s', '双口六类面板', '综合布线', 260, 18, '个', 'selection', 'sel_004_c1', '86型 双口六类'),
  bil('bi_004_c2', 'ps_004_cab', 'm_cab_patch_s', '24口六类配线架', '综合布线', 11, 210, '个', 'selection', 'sel_004_c2', '1U 24口六类'),
  bil('bi_004_c3', 'ps_004_cab', 'm_cab_org_s', '1U理线器', '综合布线', 6, 45, '个', 'selection', 'sel_004_c3', '1U 金属理线环'),
  bil('bi_004_c4', 'ps_004_cab', 'm_cable_s', '六类非屏蔽4对', '线缆', 30, 680, '箱', 'selection', 'sel_004_c4', 'Cat6 UTP，305m/箱'),
  // ===== LAN =====
  bil('bi_004_l1', 'ps_004_lan', 'm_sw_core_h', 'S12700E-8', '网络设备', 2, 36000, '台', 'selection', 'sel_004_l1', '框式核心 8槽'),
  bil('bi_004_l2', 'ps_004_lan', 'm_sw_acc_s', 'S5735-L48T4S', '网络设备', 8, 2600, '台', 'selection', 'sel_004_l2', '48口千兆接入+4万兆'),
  bil('bi_004_l3', 'ps_004_lan', 'm_sw_acc_e', 'S1730S-L24T', '网络设备', 2, 860, '台', 'selection', 'sel_004_l3', '24口千兆接入'),
  // ===== CEE =====
  bil('bi_004_e1', 'ps_004_cee', 'm_cee_ups_s', 'UPS2000-G-10KVA', '机房', 1, 9800, '台', 'selection', 'sel_004_e1', '在线式 10KVA'),
  bil('bi_004_e2', 'ps_004_cee', 'm_cee_ac_s', 'NetCol5000-12.5', '机房', 2, 12000, '台', 'selection', 'sel_004_e2', '12.5KW 行级精密空调'),
  bil('bi_004_e3', 'ps_004_cee', 'm_cee_cab_s', 'NetHos-M-42U', '机房', 6, 2600, '台', 'selection', 'sel_004_e3', '42U 服务器机柜'),
  // ===== PAS =====
  bil('bi_004_p1', 'ps_004_pas', 'm_pas_spk_s', '吸顶音箱-3W', '广播', 56, 38, '只', 'selection', 'sel_004_p1', '3W 吸顶扬声器'),
  bil('bi_004_p2', 'ps_004_pas', 'm_pas_amp_s', '功放-120W', '广播', 4, 880, '台', 'selection', 'sel_004_p2', '120W 定压功放'),
]

/* ---------- 预算 + 预算项（关联账单项） ---------- */
const billTotal = bill_items.reduce((s, i) => s + i.amount, 0)
const budgets = [
  { id: 'bg_004', project_id: 'proj_004', bill_version_id: v1, budget_type: 'project', total_amount: Math.round(billTotal * 100) / 100, status: 'draft', created_at: now },
]

const budget_items = bill_items
  .map((i) => ({
    id: `bgi_${i.id}`, budget_id: 'bg_004', project_system_id: i.project_system_id, bill_item_id: i.id,
    quantity: i.quantity, unit_price: i.unit_price, amount: i.amount,
  }))

/* ---------- 文档 / 点位版本快照 / 任务 / 日程 ---------- */
const documents = [
  { id: 'doc_004_1', project_id: 'proj_004', type: 'design_note', title: '弱电总体设计说明 V0.8', version: '0.8', status: 'draft' },
  { id: 'doc_004_2', project_id: 'proj_004', type: 'device_list', title: '设备清单（初稿V1）', version: '1.0', status: 'draft' },
  { id: 'doc_004_3', project_id: 'proj_004', type: 'point_schedule', title: '点位表 V1', version: '1.0', status: 'approved' },
]

const revisions = pts.slice(0, 3).map((p, i) => ({
  id: `rev_004_${i + 1}`, entity_type: 'point', entity_id: p.id, version_no: 'V1',
  snapshot_json: JSON.stringify({
    project_system_id: p.ps, device_id: p.device, quantity: p.qty, building_id: p.building, telecom_room_id: p.telecom,
  }),
  change_type: 'create', change_summary: '测试项目点位快照',
  created_at: now,
}))

const tasks = [
  { id: 'task_004_1', title: '完成视频监控系统初稿评审', description: 'T1 主楼 80 摄像机点位复核', status: 'doing', priority: 'high', project_id: 'proj_004', project_system_id: 'ps_004_vss', due_at: '2026-08-30T17:00:00', estimated_minutes: 480, actual_minutes: 120, created_at: now, updated_at: now },
  { id: 'task_004_2', title: '核对门禁 24 门磁力锁选型', description: '读卡器/控制器/interlock 配置一致性', status: 'todo', priority: 'medium', project_id: 'proj_004', project_system_id: 'ps_004_acs', due_at: '2026-08-30T12:00:00', estimated_minutes: 60, created_at: now, updated_at: now },
  { id: 'task_004_3', title: '机房 UPS 负载计算复核', description: '10KVA×1 + 精密空调×2 配置', status: 'todo', priority: 'medium', project_id: 'proj_004', project_system_id: 'ps_004_cee', due_at: '2026-08-31T16:00:00', estimated_minutes: 45, created_at: now, updated_at: now },
  { id: 'task_004_4', title: '导出公共广播清单', description: '56 只吸顶扬声器 + 4 台功放', status: 'todo', priority: 'low', project_id: 'proj_004', project_system_id: 'ps_004_pas', due_at: '2026-09-01T18:00:00', estimated_minutes: 30, created_at: now, updated_at: now },
]

const schedules = [
  { id: 'sch_004_1', task_id: 'task_004_1', title: '视频监控 V0.9 内部评审会', start_at: '2026-08-30T10:00:00', end_at: '2026-08-30T11:00:00', schedule_type: 'meeting', location: 'T1-3F 会议室', project_id: 'proj_004', status: 'confirmed' },
  { id: 'sch_004_2', task_id: 'task_004_3', title: '机房配电方案复核', start_at: '2026-08-31T14:00:00', end_at: '2026-08-31T15:00:00', schedule_type: 'work', project_id: 'proj_004', status: 'confirmed' },
]

/** 测试用丰富项目表数据 */
export const testProjectTables: Record<string, Row[]> = {
  projects,
  buildings,
  telecom_rooms,
  project_systems,
  design_parameters,
  points,
  design_results,
  device_selections,
  bill_versions,
  bill_items,
  budgets,
  budget_items,
  documents,
  revisions,
  tasks,
  schedules,
}