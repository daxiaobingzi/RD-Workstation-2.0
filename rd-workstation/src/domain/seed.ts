import type { DB } from './db'
import type { Row } from './types'

let n = 0
const id = (p: string) => `${p}_${(++n).toString(36)}`

const now = '2026-08-27T09:00:00'

/** 演示种子数据：苏州公安项目 · 视频监控 VSS 设计链全量数据 */
export function seedDB(): DB {
  const db: DB = {}

  const put = <T extends Row>(t: string, rows: T[]) => {
    db[t] = rows
  }

  /* ---------- 系统基础 ---------- */
  put('grades', [
    { id: 'g_economic', code: 'economic', name: '经济型', sort_order: 1, enabled: true },
    { id: 'g_standard', code: 'standard', name: '标准型', sort_order: 2, enabled: true },
    { id: 'g_premium', code: 'premium', name: '高端型', sort_order: 3, enabled: true },
  ])

  put('system_templates', [
    { id: 'st_vss_office', system_id: 'sys_vss', name: '视频监控-办公建筑标准模板', version: '1.0', description: '4MP / H.265 / 30 天存储；室内半球 + 出入口枪机 + 室外球机', created_at: now, updated_at: now },
    { id: 'st_vss_hospital', system_id: 'sys_vss', name: '视频监控-医疗建筑标准模板', version: '1.0', description: '重点区域 4MP 全彩，存储 45 天', created_at: now, updated_at: now },
    { id: 'st_acs_office', system_id: 'sys_acs', name: '门禁-办公建筑标准模板', version: '1.1', description: '一卡通 + 访客管理 + 电梯层控', created_at: now, updated_at: now },
  ])

  put('systems', [
    { id: 'sys_vss', code: 'VSS', name: '视频监控系统', category: '安全防范', description: '视频监控，含点位/存储/网络', icon: 'video', sort_order: 1, enabled: true },
    { id: 'sys_acs', code: 'ACS', name: '门禁一卡通', category: '安全防范', description: '门禁与一卡通', icon: 'lock', sort_order: 2, enabled: true },
    { id: 'sys_lan', code: 'LAN', name: '综合布线网络', category: '信息网络', description: '综合布线/网络', icon: 'network', sort_order: 3, enabled: true },
    { id: 'sys_cab', code: 'CAB', name: '综合布线', category: '信息网络', description: '综合布线', icon: 'cable', sort_order: 4, enabled: true },
    { id: 'sys_bms', code: 'BMS', name: '楼宇自控', category: '楼宇控制', description: '楼宇自控系统', icon: 'building', sort_order: 5, enabled: true },
  ])

  /* ---------- 设备域 ---------- */
  put('device_categories', [
    { id: 'dc_front', system_id: 'sys_vss', code: 'front', name: '前端设备', category_type: 'front', sort_order: 1 },
    { id: 'dc_back', system_id: 'sys_vss', code: 'back', name: '后端设备', category_type: 'back', sort_order: 2 },
    { id: 'dc_net', system_id: 'sys_lan', code: 'net', name: '网络设备', category_type: 'net', sort_order: 3 },
    { id: 'dc_cable', system_id: 'sys_vss', code: 'cable', name: '管材线缆', category_type: 'cable', sort_order: 4 },
    { id: 'dc_aux', system_id: 'sys_vss', code: 'aux', name: '辅材', category_type: 'aux', sort_order: 5 },
    // 注：网络设备归属信息网络系统（sys_lan）；存储并入后端设备（含 NVR / 硬盘 / 服务器）
  ])
  put('product_families', [
    { id: 'pf_cam', device_category_id: 'dc_front', code: 'camera', name: '摄像机', sort_order: 1 },
    { id: 'pf_mount', device_category_id: 'dc_front', code: 'mount', name: '支架/防护罩', sort_order: 2 },
    { id: 'pf_nvr', device_category_id: 'dc_back', code: 'nvr', name: 'NVR', sort_order: 1 },
    { id: 'pf_hdd', device_category_id: 'dc_back', code: 'hdd', name: '硬盘', sort_order: 2 },
    { id: 'pf_poe', device_category_id: 'dc_net', code: 'poe', name: 'POE交换机', sort_order: 1 },
    { id: 'pf_agg', device_category_id: 'dc_net', code: 'aggregation', name: '汇聚交换机', sort_order: 2 },
    { id: 'pf_cable', device_category_id: 'dc_cable', code: 'cable', name: '线缆', sort_order: 1 },
  ])

  const mkProduct = (id: string, family: string, name: string, mfr = '') => ({
    id, product_family_id: family, name, manufacturer: mfr,
  })
  put('products', [
    mkProduct('prod_bullet', 'pf_cam', '高清枪型摄像机', '海康威视'),
    mkProduct('prod_dome', 'pf_cam', '红外半球摄像机', '海康威视'),
    mkProduct('prod_ptz', 'pf_cam', '星光球型摄像机', '海康威视'),
    mkProduct('prod_poe', 'pf_poe', 'POE 交换机', '华为'),
    mkProduct('prod_agg', 'pf_agg', '汇聚交换机', '华为'),
    mkProduct('prod_nvr', 'pf_nvr', '网络硬盘录像机 NVR', '海康威视'),
    mkProduct('prod_hdd', 'pf_hdd', '监控硬盘', '希捷'),
    mkProduct('prod_mount', 'pf_mount', '摄像机支架', ''),
    mkProduct('prod_cable', 'pf_cable', '六类非屏蔽网线', ''),
  ])

  const mkModel = (id: string, product: string, model: string, spec: string, grade: string, unit = '台', status: 'active' | 'disabled' = 'active') => ({
    id, product_id: product, model, specification: spec, unit, grade_code: grade, status,
    parameter_json: {},
  })
  put('product_models', [
    // 摄像机：经济 / 标准 / 高端 三档
    mkModel('m_bullet_e', 'prod_bullet', 'DS-2CD1T26DW', '2MP 红外枪机 50m', 'economic'),
    mkModel('m_bullet_s', 'prod_bullet', 'DS-2CD2646FW', '4MP 星光枪机', 'standard'),
    mkModel('m_bullet_p', 'prod_bullet', 'DS-2CD7A46', '4MP 智能枪机 人车', 'premium'),
    mkModel('m_dome_e', 'prod_dome', 'DS-2CD1125', '2MP 红外半球', 'economic'),
    mkModel('m_dome_s', 'prod_dome', 'DS-2CD2346', '4MP 星光半球', 'standard'),
    mkModel('m_dome_p', 'prod_dome', 'DS-2CD7347', '4MP 全彩半球', 'premium'),
    mkModel('m_ptz_e', 'prod_ptz', 'DS-2DE2204', '2MP 球机 20x', 'economic'),
    mkModel('m_ptz_s', 'prod_ptz', 'DS-2DE4225', '4MP 球机 25x', 'standard'),
    mkModel('m_ptz_p', 'prod_ptz', 'DS-2DE7A45', '4MP 球机 45x 星光', 'premium'),
    // 网络
    mkModel('m_poe_s', 'prod_poe', 'S5735-L24P4S', '24口千兆POE', 'standard'),
    mkModel('m_poe_p', 'prod_poe', 'S6730-H48X6C', '48口千兆POE+', 'premium'),
    mkModel('m_agg_s', 'prod_agg', 'S6730-S24X6Q', '24口万兆汇聚', 'standard'),
    // 后端
    mkModel('m_nvr_s', 'prod_nvr', 'DS-9632NXI', '32路 NVR', 'standard'),
    mkModel('m_nvr_p', 'prod_nvr', 'DS-9664NXI', '64路 NVR', 'premium'),
    // 存储
    mkModel('m_hdd_s', 'prod_hdd', 'ST8000VX004', '8TB 监控硬盘', 'standard'),
    mkModel('m_hdd_p', 'prod_hdd', 'ST16000VE002', '16TB 监控硬盘', 'premium'),
    // 支架 / 线缆
    mkModel('m_mount_s', 'prod_mount', 'DS-1212ZJ', '通用摄像机支架（含防护罩）', 'standard', '套'),
    mkModel('m_cable_s', 'prod_cable', '六类非屏蔽4对', 'Cat6 UTP，305m/箱', 'standard', '箱'),
  ])

  put('brands', [
    { id: 'b_hik', name: '海康威视', manufacturer_type: 'domestic' },
    { id: 'b_dahua', name: '大华', manufacturer_type: 'domestic' },
    { id: 'b_huawei', name: '华为', manufacturer_type: 'domestic' },
    { id: 'b_seagate', name: '希捷', manufacturer_type: 'foreign' },
  ])
  put('suppliers', [
    { id: 'sup_hik_agent', name: '海康威视华东代理', contact: '张经理', phone: '0512-88****', region: '苏州', remark: '安防设备一级代理' },
    { id: 'sup_huawei_dist', name: '华为网络分销商', contact: '刘工', phone: '021-66****', region: '上海', remark: '网络设备分销' },
    { id: 'sup_seagate', name: '希捷存储渠道', contact: '王女士', region: '苏州', remark: '企业级硬盘渠道' },
  ])
  put('model_brands', [
    { id: 'mb_1', model_id: 'm_bullet_s', brand_id: 'b_hik', is_default: true },
    { id: 'mb_2', model_id: 'm_dome_s', brand_id: 'b_hik', is_default: true },
    { id: 'mb_3', model_id: 'm_ptz_s', brand_id: 'b_hik', is_default: true },
    { id: 'mb_4', model_id: 'm_poe_s', brand_id: 'b_huawei', is_default: true },
    { id: 'mb_5', model_id: 'm_nvr_s', brand_id: 'b_hik', is_default: true },
    { id: 'mb_6', model_id: 'm_hdd_s', brand_id: 'b_seagate', is_default: true },
  ])

  const mkPrice = (model: string, price: number, ptype: 'reference' | 'market' | 'supplier' | 'project' = 'reference') => ({
    id: id('price'), model_id: model, price_type: ptype, price, currency: 'CNY', source: 'seed',
  })
  put('prices', [
    mkPrice('m_bullet_e', 420), mkPrice('m_bullet_s', 1280), mkPrice('m_bullet_p', 2650),
    mkPrice('m_dome_e', 360), mkPrice('m_dome_s', 980), mkPrice('m_dome_p', 1980),
    mkPrice('m_ptz_e', 1250), mkPrice('m_ptz_s', 3450), mkPrice('m_ptz_p', 6800),
    mkPrice('m_poe_s', 1580), mkPrice('m_poe_p', 3980), mkPrice('m_agg_s', 8600),
    mkPrice('m_nvr_s', 6200), mkPrice('m_nvr_p', 12800),
    mkPrice('m_hdd_s', 1280), mkPrice('m_hdd_p', 2680),
    mkPrice('m_mount_s', 45), mkPrice('m_cable_s', 680),
    // 市场价 / 供应商价（价格管理 R2 演示数据）
    mkPrice('m_dome_s', 1050, 'market'), mkPrice('m_dome_s', 950, 'supplier'),
    mkPrice('m_bullet_s', 1350, 'market'), mkPrice('m_bullet_s', 1220, 'supplier'),
    mkPrice('m_bullet_p', 2800, 'market'),
    mkPrice('m_poe_s', 1680, 'market'), mkPrice('m_poe_s', 1520, 'supplier'),
    mkPrice('m_hdd_s', 1350, 'market'),
    mkPrice('m_nvr_s', 6500, 'market'),
  ])

  put('model_grade_bindings', [
    { id: 'mgb_bullet_e', model_id: 'm_bullet_e', grade_id: 'g_economic', is_default: true },
    { id: 'mgb_bullet_s', model_id: 'm_bullet_s', grade_id: 'g_standard', is_default: true },
    { id: 'mgb_bullet_p', model_id: 'm_bullet_p', grade_id: 'g_premium', is_default: true },
    { id: 'mgb_dome_e', model_id: 'm_dome_e', grade_id: 'g_economic', is_default: true },
    { id: 'mgb_dome_s', model_id: 'm_dome_s', grade_id: 'g_standard', is_default: true },
    { id: 'mgb_dome_p', model_id: 'm_dome_p', grade_id: 'g_premium', is_default: true },
    { id: 'mgb_ptz_e', model_id: 'm_ptz_e', grade_id: 'g_economic', is_default: true },
    { id: 'mgb_ptz_s', model_id: 'm_ptz_s', grade_id: 'g_standard', is_default: true },
    { id: 'mgb_ptz_p', model_id: 'm_ptz_p', grade_id: 'g_premium', is_default: true },
    { id: 'mgb_poe_s', model_id: 'm_poe_s', grade_id: 'g_standard', is_default: true },
    { id: 'mgb_nvr_s', model_id: 'm_nvr_s', grade_id: 'g_standard', is_default: true },
    { id: 'mgb_hdd_s', model_id: 'm_hdd_s', grade_id: 'g_standard', is_default: true },
    { id: 'mgb_mount_s', model_id: 'm_mount_s', grade_id: 'g_standard', is_default: true },
    { id: 'mgb_cable_s', model_id: 'm_cable_s', grade_id: 'g_standard', is_default: true },
  ])

  /* ---------- 项目域 ---------- */
  put('projects', [
    {
      id: 'proj_001', project_code: 'PJ-2026-001', name: '苏州XX公安项目', project_type: '政府 · 公共安全',
      building_type: '行政办公', client_name: '苏州公安局', location: '苏州工业园区', building_area: 128000,
      floor_count: 26, design_stage: '施工图', status: 'designing', default_grade_code: 'standard',
      start_date: '2026-03-01', planned_end_date: '2026-12-31', description: '公安业务用房智能化系统设计',
      created_at: now, updated_at: now,
    },
    {
      id: 'proj_002', project_code: 'PJ-2026-002', name: '园区银行大厦弱电', project_type: '办公 · 金融',
      building_type: '写字楼', client_name: 'XX银行', location: '苏州高新区', building_area: 86000,
      floor_count: 32, design_stage: '初设', status: 'designing', default_grade_code: 'premium',
      start_date: '2026-04-15', planned_end_date: '2026-11-30',
      created_at: now, updated_at: now,
    },
    {
      id: 'proj_003', project_code: 'PJ-2025-019', name: '医院综合楼智能化', project_type: '医疗',
      building_type: '综合医院', client_name: 'XX医院', location: '苏州吴中区', building_area: 210000,
      floor_count: 18, design_stage: '已交付', status: 'completed', default_grade_code: 'standard',
      start_date: '2025-02-01', planned_end_date: '2025-12-30', actual_end_date: '2025-12-20',
      created_at: now, updated_at: now,
    },
  ])

  put('project_systems', [
    { id: 'ps_vss_001', project_id: 'proj_001', system_id: 'sys_vss', status: 'designing', progress: 78, design_grade: 'standard', sort_order: 1, created_at: now, updated_at: now },
    { id: 'ps_acs_001', project_id: 'proj_001', system_id: 'sys_acs', status: 'designing', progress: 63, design_grade: 'standard', sort_order: 2, created_at: now, updated_at: now },
    { id: 'ps_cab_001', project_id: 'proj_001', system_id: 'sys_cab', status: 'designing', progress: 52, design_grade: 'economic', sort_order: 3, created_at: now, updated_at: now },
    { id: 'ps_vss_002', project_id: 'proj_002', system_id: 'sys_vss', status: 'designing', progress: 45, design_grade: 'premium', sort_order: 1, created_at: now, updated_at: now },
    { id: 'ps_lan_002', project_id: 'proj_002', system_id: 'sys_lan', status: 'designing', progress: 38, design_grade: 'premium', sort_order: 2, created_at: now, updated_at: now },
    { id: 'ps_vss_003', project_id: 'proj_003', system_id: 'sys_vss', status: 'completed', progress: 100, design_grade: 'standard', sort_order: 1, created_at: now, updated_at: now },
  ])

  /* ---------- 设计域：苏州公安 VSS ---------- */
  put('design_parameters', [
    { id: 'dp_res', project_system_id: 'ps_vss_001', parameter_key: 'resolution', parameter_name: '分辨率', value_type: 'number', value_json: 4, unit: 'MP', required: true },
    { id: 'dp_bit', project_system_id: 'ps_vss_001', parameter_key: 'bitrate_mbps', parameter_name: '码流', value_type: 'number', value_json: 4, unit: 'Mbps', required: true },
    { id: 'dp_days', project_system_id: 'ps_vss_001', parameter_key: 'storage_days', parameter_name: '存储天数', value_type: 'number', value_json: 30, unit: '天', required: true },
    { id: 'dp_codec', project_system_id: 'ps_vss_001', parameter_key: 'codec', parameter_name: '编码', value_type: 'string', value_json: 'H.265', required: true },
  ])

  put('point_categories', [
    { id: 'pc_in', system_id: 'sys_vss', code: 'indoor', name: '室内摄像机', sort_order: 1, enabled: true },
    { id: 'pc_out', system_id: 'sys_vss', code: 'outdoor', name: '室外摄像机', sort_order: 2, enabled: true },
    { id: 'pc_ele', system_id: 'sys_vss', code: 'elevator', name: '电梯摄像机', sort_order: 3, enabled: true },
    { id: 'pc_ent', system_id: 'sys_vss', code: 'entrance', name: '出入口摄像机', sort_order: 4, enabled: true },
  ])

  const pts: { name: string; cat: string; floor: string; space: string; qty: number; type: string }[] = [
    { name: '大厅高清枪机', cat: 'pc_in', floor: '1F', space: '大堂', qty: 12, type: 'm_bullet_s' },
    { name: '标准层走廊半球', cat: 'pc_in', floor: '2-26F', space: '走廊', qty: 150, type: 'm_dome_s' },
    { name: '电梯轿厢半球', cat: 'pc_ele', floor: 'B1-26F', space: '电梯轿厢', qty: 27, type: 'm_dome_s' },
    { name: '主出入口枪机', cat: 'pc_ent', floor: '1F', space: '主出入口', qty: 8, type: 'm_bullet_s' },
    { name: '周界枪机', cat: 'pc_out', floor: '室外', space: '周界', qty: 18, type: 'm_bullet_s' },
    { name: '地下车库半球', cat: 'pc_in', floor: 'B1-B2', space: '车库', qty: 60, type: 'm_dome_s' },
    { name: '广场球机', cat: 'pc_out', floor: '室外', space: '广场', qty: 6, type: 'm_ptz_s' },
    { name: '消防通道半球', cat: 'pc_in', floor: '各层', space: '消防通道', qty: 40, type: 'm_dome_s' },
    { name: '制高点球机', cat: 'pc_out', floor: '屋顶', space: '制高点', qty: 4, type: 'm_ptz_s' },
    { name: '库房半球', cat: 'pc_in', floor: 'B1', space: '库房', qty: 16, type: 'm_dome_s' },
    { name: '财务室半球', cat: 'pc_in', floor: '1F', space: '财务室', qty: 5, type: 'm_dome_s' },
    { name: '消控值班室半球', cat: 'pc_in', floor: '1F', space: '消控室', qty: 5, type: 'm_dome_s' },
    { name: '车道枪机', cat: 'pc_ent', floor: '室外', space: '车道出入口', qty: 35, type: 'm_bullet_s' },
  ]
  put('points', pts.map((p, i) => {
    return {
      id: `pt_vss_${String(i + 1).padStart(3, '0')}`,
      project_system_id: 'ps_vss_001',
      point_code: `VSS-C-${String(i + 1).padStart(3, '0')}`,
      point_name: p.name,
      category_id: p.cat,
      floor: p.floor,
      space: p.space,
      location: p.space,
      quantity: p.qty,
      unit: '台',
      status: 'designed',
      remark: p.type,
      created_at: now, updated_at: now,
    }
  }))

  /* ---------- 规则与结果 ---------- */
  put('design_rules', [
    { id: 'rule_poe', system_id: 'sys_vss', code: 'R-CAM-POE', name: '摄像机→POE交换机', description: '每 24 个摄像机端口配 1 台 24 口 POE 交换机', rule_type: 'derive', source_type: 'camera', target_type: 'poe_switch', formula_json: 'ceil(camera_count / 24)', priority: 1, enabled: true },
    { id: 'rule_nvr', system_id: 'sys_vss', code: 'R-CAM-NVR', name: '摄像机→NVR', description: '每 32 路摄像机配 1 台 32 路 NVR', rule_type: 'derive', source_type: 'camera', target_type: 'nvr', formula_json: 'ceil(camera_count / 32)', priority: 2, enabled: true },
    { id: 'rule_hdd', system_id: 'sys_vss', code: 'R-CAM-HDD', name: '存储容量→硬盘', description: '按码流/天数计算存储，每 8TB 一块硬盘', rule_type: 'derive', source_type: 'camera', target_type: 'hdd', formula_json: 'ceil(storage_tb / 8)', priority: 3, enabled: true },
    { id: 'rule_agg', system_id: 'sys_vss', code: 'R-POE-AGG', name: 'POE→汇聚交换机', description: '每 8 台 POE 汇聚到 1 台汇聚交换机', rule_type: 'derive', source_type: 'poe', target_type: 'aggregation', formula_json: 'ceil(poe_count / 8)', priority: 4, enabled: true },
    { id: 'rule_mount', system_id: 'sys_vss', code: 'R-CAM-MOUNT', name: '摄像机→支架', description: '每台摄像机配 1 套通用支架（含防护罩）', rule_type: 'derive', source_type: 'camera', target_type: 'mount', formula_json: 'camera_count', priority: 5, enabled: true },
    { id: 'rule_cable', system_id: 'sys_vss', code: 'R-CAM-CABLE', name: '点位→线缆', description: '按 90m/点位估算，305 米/箱（条件：有点位才生成）', rule_type: 'derive', source_type: 'camera', target_type: 'cable', formula_json: 'ceil(camera_count * 90 / 305)', condition_json: 'camera_count > 0', priority: 6, enabled: true },
  ])
  put('rule_bindings', [
    { id: 'rb_1', rule_id: 'rule_poe', enabled: true },
    { id: 'rb_2', rule_id: 'rule_nvr', enabled: true },
    { id: 'rb_3', rule_id: 'rule_hdd', enabled: true },
    { id: 'rb_4', rule_id: 'rule_agg', enabled: true },
    { id: 'rb_5', rule_id: 'rule_mount', enabled: true },
    { id: 'rb_6', rule_id: 'rule_cable', enabled: true },
  ])

  /* ---------- 个人工作域 ---------- */
  put('tasks', [
    { id: 'task_1', title: '完成视频监控设计初稿', description: '点位/设备/清单/预算全链落库', status: 'doing', priority: 'high', project_id: 'proj_001', project_system_id: 'ps_vss_001', source_type: 'system', source_id: 'ps_vss_001', due_at: '2026-08-27T17:00:00', estimated_minutes: 480, actual_minutes: 120, created_at: now, updated_at: now },
    { id: 'task_2', title: '校对 NVR 存储容量', description: '按码流 4Mbps / 30 天复核', status: 'todo', priority: 'high', project_id: 'proj_001', project_system_id: 'ps_vss_001', due_at: '2026-08-27T12:00:00', estimated_minutes: 60, created_at: now, updated_at: now },
    { id: 'task_3', title: '补充 5 项缺价设备', status: 'todo', priority: 'medium', project_id: 'proj_001', due_at: '2026-08-27T16:00:00', estimated_minutes: 45, created_at: now, updated_at: now },
    { id: 'task_4', title: '导出楼控系统工程量', status: 'done', priority: 'medium', project_id: 'proj_001', completed_at: '2026-08-26T17:30:00', estimated_minutes: 30, actual_minutes: 25, created_at: now, updated_at: now },
    { id: 'task_5', title: '周目标复盘', status: 'todo', priority: 'low', goal_id: 'goal_q3', due_at: '2026-08-28T18:00:00', estimated_minutes: 30, created_at: now, updated_at: now },
  ])
  put('schedules', [
    { id: 'sch_1', task_id: 'task_1', title: '视频监控初稿评审', start_at: '2026-08-27T09:00:00', end_at: '2026-08-27T10:00:00', schedule_type: 'meeting', location: '会议室', project_id: 'proj_001', status: 'confirmed' },
    { id: 'sch_2', task_id: 'task_1', title: '录入摄像机点位', start_at: '2026-08-27T10:30:00', end_at: '2026-08-27T12:00:00', schedule_type: 'work', project_id: 'proj_001', status: 'confirmed' },
    { id: 'sch_3', task_id: 'task_1', title: '设备选型 · 标准档', start_at: '2026-08-27T14:00:00', end_at: '2026-08-27T15:00:00', schedule_type: 'work', project_id: 'proj_001', status: 'confirmed' },
    { id: 'sch_4', task_id: 'task_1', title: '清单预算生成', start_at: '2026-08-27T16:30:00', end_at: '2026-08-27T17:30:00', schedule_type: 'work', project_id: 'proj_001', status: 'confirmed' },
  ])
  put('goals', [
    { id: 'goal_q3', name: 'Q3 完成 15 个项目设计', period_type: 'quarter', start_date: '2026-07-01', end_date: '2026-09-30', target_value: 15, current_value: 12, status: 'active' },
    { id: 'goal_q3_subs', parent_goal_id: 'goal_q3', name: '视频监控系统模板沉淀', period_type: 'quarter', target_value: 3, current_value: 2, status: 'active' },
  ])
  put('habits', [
    { id: 'habit_1', name: '晨间规划', frequency_type: 'daily', target_value: 1, unit: '次', is_active: true },
    { id: 'habit_2', name: '工作复盘', frequency_type: 'daily', target_value: 1, unit: '次', is_active: true },
    { id: 'habit_3', name: '阅读 30 分钟', frequency_type: 'daily', target_value: 30, unit: '分钟', is_active: true },
  ])
  put('habit_records', [
    { id: 'hr_1', habit_id: 'habit_1', date: '2026-08-27', completed: true },
    { id: 'hr_2', habit_id: 'habit_2', date: '2026-08-27', completed: true },
    { id: 'hr_3', habit_id: 'habit_1', date: '2026-08-26', completed: true },
    { id: 'hr_4', habit_id: 'habit_2', date: '2026-08-26', completed: true },
    { id: 'hr_5', habit_id: 'habit_3', date: '2026-08-25', completed: true },
  ])

  /* ---------- 知识域 ---------- */
  put('knowledge_items', [
    { id: 'kn_1', type: 'standard', title: 'GB 50395 视频安防监控系统工程设计规范', content: '视频监控系统设计遵循的国家标准。', tags_json: ['规范', '视频监控'] },
    { id: 'kn_2', type: 'case', title: '公安项目视频监控设计案例', content: '128,000㎡ 办公建筑，386 点位，4MP/H.265/30天存储。', tags_json: ['案例', '视频监控'] },
    { id: 'kn_3', type: 'experience', title: '存储容量计算公式', content: '容量(TB) = 点位×码流(Mbps)×天数×86400 ÷ 8 ÷ 1024³', tags_json: ['经验', '存储'] },
  ])
  put('documents', [
    { id: 'doc_1', project_id: 'proj_001', type: 'design_note', title: '视频监控设计说明 V0.9', version: '0.9', status: 'draft' },
    { id: 'doc_2', project_id: 'proj_001', type: 'device_list', title: '设备表（初稿）', version: '0.9', status: 'draft' },
  ])

  return db
}
