import type { Row } from '../types/domain'

type ProductSeed = { id: string; name: string; spec?: string; unit?: string; mfr?: string; system: string; category: string; family?: string; chain?: string }
const mkProduct = (p: ProductSeed) => ({
  id: p.id, name: p.name, specification: p.spec, unit: p.unit, manufacturer: p.mfr ?? '',
  system_id: p.system, category: p.category, product_family_id: p.family, chain_json: p.chain,
})

/** 部分配置行的详细参数示例（富文本 HTML），可在设备中心富文本编辑器修改 */
const MODEL_DETAIL: Record<string, string> = {
  m_bullet_s: '<p><b>传感器</b>：1/2.8" CMOS，400 万像素</p><p><b>镜头</b>：2.8~12mm 电动变焦</p><p><b>夜视</b>：星光级，红外 50m</p><p><b>供电</b>：POE / DC12V</p>',
  m_dome_s: '<p><b>传感器</b>：1/2.8" CMOS，400 万像素</p><p><b>安装</b>：吸顶半球</p><p><b>夜视</b>：红外 30m</p>',
  m_nvr_s: '<p><b>路数</b>：32 路</p><p><b>存储</b>：8 盘位，单盘 16TB</p><p><b>解码</b>：4K 输出</p>',
  m_poe_s: '<p><b>端口</b>：24×GE POE + 4×SFP</p><p><b>POE</b>：370W，IEEE 802.3af/at</p>',
}

const mkModel = (id: string, product: string, model: string, spec: string, grade: string, unit = '台', status: 'active' | 'disabled' = 'active') => ({
  id, product_id: product, model, specification: spec, unit, grade_code: grade, status,
  detail_html: MODEL_DETAIL[id],
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
  // ===== 安防 · 视频监控（sys_vss） =====
  mkProduct({ id: 'prod_bullet', name: '高清枪型摄像机', spec: '<p><b>图像</b>：2MP/4MP 可切换，1/2.8" CMOS</p><p><b>夜视</b>：星光级，红外 50m</p><p><b>防护</b>：IP67，-30℃~60℃</p>', unit: '台', mfr: '海康威视', system: 'sys_vss', category: 'front', family: 'pf_cam' }),
  mkProduct({ id: 'prod_dome', name: '红外半球摄像机', spec: '2MP/4MP 红外半球', unit: '台', mfr: '海康威视', system: 'sys_vss', category: 'front', family: 'pf_cam' }),
  mkProduct({ id: 'prod_ptz', name: '星光球型摄像机', spec: '4MP 球机 20-45x', unit: '台', mfr: '海康威视', system: 'sys_vss', category: 'front', family: 'pf_cam' }),
  mkProduct({ id: 'prod_mount', name: '摄像机支架', spec: '壁装/吊装', unit: '套', system: 'sys_vss', category: 'front', family: 'pf_mount' }),
  mkProduct({ id: 'prod_nvr', name: '网络硬盘录像机 NVR', spec: '32/64 路', unit: '台', mfr: '海康威视', system: 'sys_vss', category: 'back', family: 'pf_nvr' }),
  mkProduct({ id: 'prod_hdd', name: '监控硬盘', spec: '8/16TB 监控级', unit: '块', mfr: '希捷', system: 'sys_vss', category: 'back', family: 'pf_hdd' }),
  mkProduct({ id: 'prod_poe', name: 'POE 交换机', spec: '24/48口 千兆 POE', unit: '台', mfr: '华为', system: 'sys_vss', category: 'back', family: 'pf_poe', chain: '{"mode":"carry","capacity":24,"source":"front"}' }),
  // ===== 安防 · 门禁管理（sys_acs） =====
  mkProduct({ id: 'prod_acs_reader', name: '门禁读卡器', spec: 'IC/ID 刷卡+密码', unit: '台', mfr: '海康威视', system: 'sys_acs', category: 'front' }),
  mkProduct({ id: 'prod_acs_controller', name: '门禁控制器', spec: 'TCP/IP 单门', unit: '台', mfr: '海康威视', system: 'sys_acs', category: 'back' }),
  mkProduct({ id: 'prod_acs_lock', name: '电插锁', spec: '280kg', unit: '把', mfr: '海康威视', system: 'sys_acs', category: 'front' }),
  mkProduct({ id: 'prod_acs_btn', name: '出门按钮', spec: '86型', unit: '个', mfr: '海康威视', system: 'sys_acs', category: 'front' }),
  // ===== 信息网络 · 综合布线（sys_cab） =====
  mkProduct({ id: 'prod_cab_panel', name: '信息面板', spec: '双口六类 86型', unit: '个', system: 'sys_cab', category: 'front' }),
  mkProduct({ id: 'prod_cab_patch', name: '24口配线架', spec: '六类', unit: '个', system: 'sys_cab', category: 'back' }),
  mkProduct({ id: 'prod_cab_organizer', name: '理线器', spec: '1U', unit: '个', system: 'sys_cab', category: 'back' }),
  mkProduct({ id: 'prod_cable', name: '六类非屏蔽网线', spec: 'Cat6 UTP 305m', unit: '箱', system: 'sys_cab', category: 'cable', family: 'pf_cable', chain: '{"mode":"carry","capacity":1,"source":"front","factor":0.295082,"round":"ceil"}' }),
  // ===== 信息网络 · 信息网络（sys_lan） =====
  mkProduct({ id: 'prod_sw_core', name: '核心交换机', spec: '框式模块化', unit: '台', mfr: '华为', system: 'sys_lan', category: 'back' }),
  mkProduct({ id: 'prod_sw_access', name: '接入交换机', spec: '24/48口 千兆', unit: '台', mfr: '华为', system: 'sys_lan', category: 'back' }),
  mkProduct({ id: 'prod_agg', name: '汇聚交换机', spec: '24口 万兆', unit: '台', mfr: '华为', system: 'sys_vss', category: 'back', family: 'pf_agg', chain: '{"mode":"carry","capacity":8,"source":"prod_poe"}' }),
  // ===== 机房 · 机房工程（sys_cee） =====
  mkProduct({ id: 'prod_cee_ups', name: 'UPS不间断电源', spec: '10KVA', unit: '台', mfr: '华为', system: 'sys_cee', category: 'back' }),
  mkProduct({ id: 'prod_cee_ac', name: '精密空调', spec: '12.5KW', unit: '台', mfr: '华为', system: 'sys_cee', category: 'back' }),
  mkProduct({ id: 'prod_cee_cabinet', name: '服务器机柜', spec: '42U', unit: '台', mfr: '华为', system: 'sys_cee', category: 'back' }),
  // ===== 公共设施 · 公共广播（sys_pas） =====
  mkProduct({ id: 'prod_pas_speaker', name: '吸顶扬声器', spec: '3W', unit: '只', system: 'sys_pas', category: 'front' }),
  mkProduct({ id: 'prod_pas_amp', name: '广播功放', spec: '120W', unit: '台', system: 'sys_pas', category: 'back' }),
  // ===== 机房 · 综合管路（sys_pipe） =====
  mkProduct({ id: 'prod_pipe_tray', name: '金属线槽', spec: '200*100', unit: '米', system: 'sys_pipe', category: 'cable' }),
  mkProduct({ id: 'prod_pipe_manhole', name: '室外手孔井', spec: '600*600', unit: '座', system: 'sys_pipe', category: 'aux' }),
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
  // ===== 门禁管理 =====
  mkModel('m_acs_reader_h', 'prod_acs_reader', 'DS-K1102', 'IC/ID 刷卡+密码', 'standard'),
  mkModel('m_acs_reader_d', 'prod_acs_reader', 'DH-ASR2201', '人脸识别读卡器', 'premium'),
  mkModel('m_acs_ctrl_s', 'prod_acs_controller', 'DS-K2601', '单门 TCP/IP 控制器', 'standard'),
  mkModel('m_acs_lock_s', 'prod_acs_lock', 'DS-K4H250', '280kg 电插锁', 'standard'),
  mkModel('m_acs_btn_s', 'prod_acs_btn', 'EB29', '86型 出门按钮', 'standard'),
  // ===== 综合布线 =====
  mkModel('m_cab_panel_s', 'prod_cab_panel', '双口六类面板', '86型 双口六类', 'standard', '个'),
  mkModel('m_cab_patch_s', 'prod_cab_patch', '24口六类配线架', '1U 24口六类', 'standard', '个'),
  mkModel('m_cab_org_s', 'prod_cab_organizer', '1U理线器', '1U 金属理线环', 'standard', '个'),
  // ===== 信息网络交换机 =====
  mkModel('m_sw_core_h', 'prod_sw_core', 'S12700E-8', '框式核心 8槽', 'premium'),
  mkModel('m_sw_acc_e', 'prod_sw_access', 'S1730S-L24T', '24口千兆接入', 'economic'),
  mkModel('m_sw_acc_s', 'prod_sw_access', 'S5735-L48T4S', '48口千兆接入+4万兆', 'standard'),
  mkModel('m_agg_e', 'prod_agg', 'S5731-S24T4X', '24口万兆汇聚', 'economic'),
  // ===== 机房工程 =====
  mkModel('m_cee_ups_s', 'prod_cee_ups', 'UPS2000-G-10KVA', '在线式 10KVA', 'standard'),
  mkModel('m_cee_ac_s', 'prod_cee_ac', 'NetCol5000-12.5', '12.5KW 行级精密空调', 'standard'),
  mkModel('m_cee_cab_s', 'prod_cee_cabinet', 'NetHos-M-42U', '42U 服务器机柜', 'standard'),
  // ===== 公共广播 =====
  mkModel('m_pas_spk_s', 'prod_pas_speaker', '吸顶音箱-3W', '3W 吸顶扬声器', 'standard', '只'),
  mkModel('m_pas_amp_s', 'prod_pas_amp', '功放-120W', '120W 定压功放', 'standard'),
  // ===== 综合管路 =====
  mkModel('m_pipe_tray_s', 'prod_pipe_tray', '金属线槽-200*100', '热镀锌 200*100', 'standard', '米'),
  mkModel('m_pipe_mh_s', 'prod_pipe_manhole', '手孔井-600*600', '预制混凝土 600*600', 'standard', '座'),
]

const brands = [
  { id: 'b_hik', name: '海康威视', manufacturer_type: 'domestic' },
  { id: 'b_dahua', name: '大华', manufacturer_type: 'domestic' },
  { id: 'b_huawei', name: '华为', manufacturer_type: 'domestic' },
  { id: 'b_seagate', name: '希捷', manufacturer_type: 'foreign' },
  { id: 'b_generic', name: '国产', manufacturer_type: 'domestic' },
]

const suppliers = [
  { id: 'sup_hik_agent', name: '海康威视华东代理', contact: '张经理', phone: '0512-88****', region: '苏州', remark: '安防设备一级代理' },
  { id: 'sup_huawei_dist', name: '华为网络分销商', contact: '刘工', phone: '021-66****', region: '上海', remark: '网络设备分销' },
  { id: 'sup_seagate', name: '希捷存储渠道', contact: '王女士', region: '苏州', remark: '企业级硬盘渠道' },
]

// 型号 ↔ 品牌：同设备类型（产品）下的多型号各挂不同品牌，形成"多品牌备选"（经济档大华 / 标准·高端档海康）
const model_brands = [
  // 摄像机（枪机）
  { id: 'mb_1', model_id: 'm_bullet_e', brand_id: 'b_dahua', is_default: true },
  { id: 'mb_2', model_id: 'm_bullet_s', brand_id: 'b_hik', is_default: true },
  { id: 'mb_3', model_id: 'm_bullet_p', brand_id: 'b_hik', is_default: true },
  // 摄像机（半球）
  { id: 'mb_4', model_id: 'm_dome_e', brand_id: 'b_dahua', is_default: true },
  { id: 'mb_5', model_id: 'm_dome_s', brand_id: 'b_hik', is_default: true },
  { id: 'mb_6', model_id: 'm_dome_p', brand_id: 'b_hik', is_default: true },
  // 摄像机（球机）
  { id: 'mb_7', model_id: 'm_ptz_e', brand_id: 'b_dahua', is_default: true },
  { id: 'mb_8', model_id: 'm_ptz_s', brand_id: 'b_hik', is_default: true },
  { id: 'mb_9', model_id: 'm_ptz_p', brand_id: 'b_hik', is_default: true },
  // 网络
  { id: 'mb_10', model_id: 'm_poe_s', brand_id: 'b_huawei', is_default: true },
  { id: 'mb_11', model_id: 'm_poe_p', brand_id: 'b_huawei', is_default: true },
  { id: 'mb_12', model_id: 'm_agg_s', brand_id: 'b_huawei', is_default: true },
  // 后端
  { id: 'mb_13', model_id: 'm_nvr_s', brand_id: 'b_hik', is_default: true },
  { id: 'mb_14', model_id: 'm_nvr_p', brand_id: 'b_hik', is_default: true },
  // 存储
  { id: 'mb_15', model_id: 'm_hdd_s', brand_id: 'b_seagate', is_default: true },
  { id: 'mb_16', model_id: 'm_hdd_p', brand_id: 'b_seagate', is_default: true },
  // 支架（线缆无品牌）
  { id: 'mb_17', model_id: 'm_mount_s', brand_id: 'b_hik', is_default: true },
  // 门禁管理
  { id: 'mb_18', model_id: 'm_acs_reader_h', brand_id: 'b_hik', is_default: true },
  { id: 'mb_19', model_id: 'm_acs_reader_d', brand_id: 'b_dahua', is_default: true },
  { id: 'mb_20', model_id: 'm_acs_ctrl_s', brand_id: 'b_hik', is_default: true },
  { id: 'mb_21', model_id: 'm_acs_lock_s', brand_id: 'b_hik', is_default: true },
  { id: 'mb_22', model_id: 'm_acs_btn_s', brand_id: 'b_hik', is_default: true },
  // 综合布线 / 线缆（国产）
  { id: 'mb_23', model_id: 'm_cab_panel_s', brand_id: 'b_generic', is_default: true },
  { id: 'mb_24', model_id: 'm_cab_patch_s', brand_id: 'b_generic', is_default: true },
  { id: 'mb_25', model_id: 'm_cab_org_s', brand_id: 'b_generic', is_default: true },
  { id: 'mb_26', model_id: 'm_cable_s', brand_id: 'b_generic', is_default: true },
  // 信息网络
  { id: 'mb_27', model_id: 'm_sw_core_h', brand_id: 'b_huawei', is_default: true },
  { id: 'mb_28', model_id: 'm_sw_acc_e', brand_id: 'b_huawei', is_default: true },
  { id: 'mb_29', model_id: 'm_sw_acc_s', brand_id: 'b_huawei', is_default: true },
  { id: 'mb_30', model_id: 'm_agg_e', brand_id: 'b_huawei', is_default: true },
  // 机房工程
  { id: 'mb_31', model_id: 'm_cee_ups_s', brand_id: 'b_huawei', is_default: true },
  { id: 'mb_32', model_id: 'm_cee_ac_s', brand_id: 'b_huawei', is_default: true },
  { id: 'mb_33', model_id: 'm_cee_cab_s', brand_id: 'b_huawei', is_default: true },
  // 公共广播 / 综合管路（国产）
  { id: 'mb_34', model_id: 'm_pas_spk_s', brand_id: 'b_generic', is_default: true },
  { id: 'mb_35', model_id: 'm_pas_amp_s', brand_id: 'b_generic', is_default: true },
  { id: 'mb_36', model_id: 'm_pipe_tray_s', brand_id: 'b_generic', is_default: true },
  { id: 'mb_37', model_id: 'm_pipe_mh_s', brand_id: 'b_generic', is_default: true },
]

/* P4：设备单点定额材料（推导工程量/清单）—— 每 1 台前端/后端设备的线缆、管材、辅材配比 */
const device_materials = [
  // 枪机/半球/球机（前端）：每点 90m 网线 + 20m PVC25 管 + 1 套防水盒
  { id: 'dm_bullet', product_id: 'prod_bullet', category: 'cable', name: '六类非屏蔽双绞线', unit: '米', quantity_per_point: 90 },
  { id: 'dm_bullet_p', product_id: 'prod_bullet', category: 'conduit', name: 'PVC25 管', unit: '米', quantity_per_point: 20 },
  { id: 'dm_bullet_a', product_id: 'prod_bullet', category: 'aux', name: '接线防水盒', unit: '套', quantity_per_point: 1 },
  { id: 'dm_dome', product_id: 'prod_dome', category: 'cable', name: '六类非屏蔽双绞线', unit: '米', quantity_per_point: 90 },
  { id: 'dm_dome_p', product_id: 'prod_dome', category: 'conduit', name: 'PVC25 管', unit: '米', quantity_per_point: 18 },
  { id: 'dm_dome_a', product_id: 'prod_dome', category: 'aux', name: '接线防水盒', unit: '套', quantity_per_point: 1 },
  { id: 'dm_ptz', product_id: 'prod_ptz', category: 'cable', name: '六类非屏蔽双绞线', unit: '米', quantity_per_point: 110 },
  { id: 'dm_ptz_p', product_id: 'prod_ptz', category: 'conduit', name: 'PVC32 管', unit: '米', quantity_per_point: 25 },
  { id: 'dm_ptz_a', product_id: 'prod_ptz', category: 'aux', name: '室外防水箱', unit: '套', quantity_per_point: 1 },
  // 前端到 NVR：每条链路 1 根尾纤（后端按点位显著性给示例）
  { id: 'dm_nvr', product_id: 'prod_nvr', category: 'cable', name: '光纤跳线（LC-LC）', unit: '根', quantity_per_point: 4 },
  { id: 'dm_poe', product_id: 'prod_poe', category: 'conduit', name: '桥架（200×100）', unit: '米', quantity_per_point: 3 },
  // 门禁：读卡器 / 电插锁
  { id: 'dm_acs_r1', product_id: 'prod_acs_reader', category: 'cable', name: '读卡器线', unit: '米', quantity_per_point: 15 },
  { id: 'dm_acs_r2', product_id: 'prod_acs_reader', category: 'conduit', name: 'PVC20 管', unit: '米', quantity_per_point: 10 },
  { id: 'dm_acs_l1', product_id: 'prod_acs_lock', category: 'cable', name: '电源线', unit: '米', quantity_per_point: 10 },
  // 综合布线：信息面板
  { id: 'dm_cab_p1', product_id: 'prod_cab_panel', category: 'cable', name: '六类非屏蔽双绞线', unit: '米', quantity_per_point: 35 },
  { id: 'dm_cab_p2', product_id: 'prod_cab_panel', category: 'conduit', name: 'PVC20 管', unit: '米', quantity_per_point: 15 },
  { id: 'dm_cab_p3', product_id: 'prod_cab_panel', category: 'aux', name: '86底盒', unit: '个', quantity_per_point: 1 },
  // 公共广播：吸顶扬声器
  { id: 'dm_pas1', product_id: 'prod_pas_speaker', category: 'cable', name: '广播线', unit: '米', quantity_per_point: 20 },
  { id: 'dm_pas2', product_id: 'prod_pas_speaker', category: 'conduit', name: 'PVC20 管', unit: '米', quantity_per_point: 12 },
]

/* 材料单价（清单材料行价格来源：品牌/型号/单价）—— 与 device_materials 按材料名关联 */
const MATERIAL_PRICE: Record<string, { brand?: string; model?: string; price: number }> = {
  '六类非屏蔽双绞线': { brand: '国产', model: 'CAT6 UTP', price: 2.8 },
  'PVC20 管': { brand: '国产', model: 'DN20', price: 3.5 },
  'PVC25 管': { brand: '国产', model: 'DN25', price: 4.5 },
  'PVC32 管': { brand: '国产', model: 'DN32', price: 6 },
  '接线防水盒': { brand: '国产', model: '防水盒-标准', price: 18 },
  '室外防水箱': { brand: '国产', model: '防水箱-标准', price: 45 },
  '光纤跳线（LC-LC）': { brand: '国产', model: 'LC-LC 3m', price: 8 },
  '桥架（200×100）': { brand: '国产', model: '热镀锌', price: 38 },
  '读卡器线': { brand: '国产', model: 'RVV4*0.5', price: 2.2 },
  '电源线': { brand: '国产', model: 'RVV2*1.0', price: 1.6 },
  '广播线': { brand: '国产', model: 'RVV2*1.5', price: 1.9 },
  '86底盒': { brand: '国产', model: '86型', price: 3.2 },
}
device_materials.forEach((m) => {
  const meta = MATERIAL_PRICE[m.name]
  if (meta) Object.assign(m, meta)
})

/** 设备目录表数据 */
export const deviceTables: Record<string, Row[]> = {
  device_categories,
  product_families,
  products,
  product_models,
  brands,
  suppliers,
  model_brands,
  device_materials,
}