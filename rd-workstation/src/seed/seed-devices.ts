import type { Row } from '../types/domain'

const mkProduct = (id: string, family: string, name: string, mfr = '') => ({
  id, product_family_id: family, name, manufacturer: mfr,
})

const mkModel = (id: string, product: string, model: string, spec: string, grade: string, unit = '台', status: 'active' | 'disabled' = 'active') => ({
  id, product_id: product, model, specification: spec, unit, grade_code: grade, status,
  parameter_json: {},
})

const device_categories = [
  { id: 'dc_front', system_id: 'sys_vss', code: 'front', name: '前端设备', category_type: 'front', sort_order: 1 },
  { id: 'dc_back', system_id: 'sys_vss', code: 'back', name: '后端设备', category_type: 'back', sort_order: 2 },
  { id: 'dc_net', system_id: 'sys_lan', code: 'net', name: '网络设备', category_type: 'net', sort_order: 3 },
  { id: 'dc_cable', system_id: 'sys_vss', code: 'cable', name: '管材线缆', category_type: 'cable', sort_order: 4 },
  { id: 'dc_aux', system_id: 'sys_vss', code: 'aux', name: '辅材', category_type: 'aux', sort_order: 5 },
  // 注：网络设备归属信息网络系统（sys_lan）；存储并入后端设备（含 NVR / 硬盘 / 服务器）
]

const product_families = [
  { id: 'pf_cam', device_category_id: 'dc_front', code: 'camera', name: '摄像机', sort_order: 1 },
  { id: 'pf_mount', device_category_id: 'dc_front', code: 'mount', name: '支架/防护罩', sort_order: 2 },
  { id: 'pf_nvr', device_category_id: 'dc_back', code: 'nvr', name: 'NVR', sort_order: 1 },
  { id: 'pf_hdd', device_category_id: 'dc_back', code: 'hdd', name: '硬盘', sort_order: 2 },
  { id: 'pf_poe', device_category_id: 'dc_net', code: 'poe', name: 'POE交换机', sort_order: 1 },
  { id: 'pf_agg', device_category_id: 'dc_net', code: 'aggregation', name: '汇聚交换机', sort_order: 2 },
  { id: 'pf_cable', device_category_id: 'dc_cable', code: 'cable', name: '线缆', sort_order: 1 },
]

const products = [
  mkProduct('prod_bullet', 'pf_cam', '高清枪型摄像机', '海康威视'),
  mkProduct('prod_dome', 'pf_cam', '红外半球摄像机', '海康威视'),
  mkProduct('prod_ptz', 'pf_cam', '星光球型摄像机', '海康威视'),
  mkProduct('prod_poe', 'pf_poe', 'POE 交换机', '华为'),
  mkProduct('prod_agg', 'pf_agg', '汇聚交换机', '华为'),
  mkProduct('prod_nvr', 'pf_nvr', '网络硬盘录像机 NVR', '海康威视'),
  mkProduct('prod_hdd', 'pf_hdd', '监控硬盘', '希捷'),
  mkProduct('prod_mount', 'pf_mount', '摄像机支架', ''),
  mkProduct('prod_cable', 'pf_cable', '六类非屏蔽网线', ''),
]

const product_models = [
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
]

const brands = [
  { id: 'b_hik', name: '海康威视', manufacturer_type: 'domestic' },
  { id: 'b_dahua', name: '大华', manufacturer_type: 'domestic' },
  { id: 'b_huawei', name: '华为', manufacturer_type: 'domestic' },
  { id: 'b_seagate', name: '希捷', manufacturer_type: 'foreign' },
]

const suppliers = [
  { id: 'sup_hik_agent', name: '海康威视华东代理', contact: '张经理', phone: '0512-88****', region: '苏州', remark: '安防设备一级代理' },
  { id: 'sup_huawei_dist', name: '华为网络分销商', contact: '刘工', phone: '021-66****', region: '上海', remark: '网络设备分销' },
  { id: 'sup_seagate', name: '希捷存储渠道', contact: '王女士', region: '苏州', remark: '企业级硬盘渠道' },
]

const model_brands = [
  { id: 'mb_1', model_id: 'm_bullet_s', brand_id: 'b_hik', is_default: true },
  { id: 'mb_2', model_id: 'm_dome_s', brand_id: 'b_hik', is_default: true },
  { id: 'mb_3', model_id: 'm_ptz_s', brand_id: 'b_hik', is_default: true },
  { id: 'mb_4', model_id: 'm_poe_s', brand_id: 'b_huawei', is_default: true },
  { id: 'mb_5', model_id: 'm_nvr_s', brand_id: 'b_hik', is_default: true },
  { id: 'mb_6', model_id: 'm_hdd_s', brand_id: 'b_seagate', is_default: true },
]

/** 设备目录表数据 */
export const deviceTables: Record<string, Row[]> = {
  device_categories,
  product_families,
  products,
  product_models,
  brands,
  suppliers,
  model_brands,
}