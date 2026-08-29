import type { Row } from '../types/domain'
import { id } from './lib'

const mkPrice = (model: string, price: number, ptype: 'reference' | 'market' | 'supplier' | 'project' = 'reference') => ({
  id: id('price'), model_id: model, price_type: ptype, price, currency: 'CNY', source: 'seed',
})

const prices = [
  mkPrice('m_bullet_e', 420), mkPrice('m_bullet_s', 1280), mkPrice('m_bullet_p', 2650),
  mkPrice('m_dome_e', 360), mkPrice('m_dome_s', 980), mkPrice('m_dome_p', 1980),
  mkPrice('m_ptz_e', 1250), mkPrice('m_ptz_s', 3450), mkPrice('m_ptz_p', 6800),
  mkPrice('m_poe_s', 1580), mkPrice('m_poe_p', 3980), mkPrice('m_agg_s', 8600),
  mkPrice('m_nvr_s', 6200), mkPrice('m_nvr_p', 12800),
  mkPrice('m_hdd_s', 1280), mkPrice('m_hdd_p', 2680),
  mkPrice('m_mount_s', 45), mkPrice('m_cable_s', 680),
  // ===== 新增子系统设备参考价 =====
  mkPrice('m_acs_reader_h', 320), mkPrice('m_acs_reader_d', 880), mkPrice('m_acs_ctrl_s', 780), mkPrice('m_acs_lock_s', 150), mkPrice('m_acs_btn_s', 25),
  mkPrice('m_cab_panel_s', 18), mkPrice('m_cab_patch_s', 210), mkPrice('m_cab_org_s', 45),
  mkPrice('m_sw_core_h', 36000), mkPrice('m_sw_acc_e', 860), mkPrice('m_sw_acc_s', 2600), mkPrice('m_agg_e', 6800),
  mkPrice('m_cee_ups_s', 9800), mkPrice('m_cee_ac_s', 12000), mkPrice('m_cee_cab_s', 2600),
  mkPrice('m_pas_spk_s', 38), mkPrice('m_pas_amp_s', 880),
  mkPrice('m_pipe_tray_s', 38), mkPrice('m_pipe_mh_s', 650),
  // 市场价 / 供应商价（价格管理 R2 演示数据）
  mkPrice('m_dome_s', 1050, 'market'), mkPrice('m_dome_s', 950, 'supplier'),
  mkPrice('m_bullet_s', 1350, 'market'), mkPrice('m_bullet_s', 1220, 'supplier'),
  mkPrice('m_bullet_p', 2800, 'market'),
  mkPrice('m_poe_s', 1680, 'market'), mkPrice('m_poe_s', 1520, 'supplier'),
  mkPrice('m_hdd_s', 1350, 'market'),
  mkPrice('m_nvr_s', 6500, 'market'),
]

const model_grade_bindings = [
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
  // ===== 新增子系统 =====
  { id: 'mgb_acs_rh', model_id: 'm_acs_reader_h', grade_id: 'g_standard', is_default: true },
  { id: 'mgb_acs_rd', model_id: 'm_acs_reader_d', grade_id: 'g_premium', is_default: true },
  { id: 'mgb_acs_ctrl', model_id: 'm_acs_ctrl_s', grade_id: 'g_standard', is_default: true },
  { id: 'mgb_acs_lock', model_id: 'm_acs_lock_s', grade_id: 'g_standard', is_default: true },
  { id: 'mgb_acs_btn', model_id: 'm_acs_btn_s', grade_id: 'g_standard', is_default: true },
  { id: 'mgb_cab_panel', model_id: 'm_cab_panel_s', grade_id: 'g_standard', is_default: true },
  { id: 'mgb_cab_patch', model_id: 'm_cab_patch_s', grade_id: 'g_standard', is_default: true },
  { id: 'mgb_cab_org', model_id: 'm_cab_org_s', grade_id: 'g_standard', is_default: true },
  { id: 'mgb_sw_core', model_id: 'm_sw_core_h', grade_id: 'g_premium', is_default: true },
  { id: 'mgb_sw_acc_e', model_id: 'm_sw_acc_e', grade_id: 'g_economic', is_default: true },
  { id: 'mgb_sw_acc_s', model_id: 'm_sw_acc_s', grade_id: 'g_standard', is_default: true },
  { id: 'mgb_agg_e', model_id: 'm_agg_e', grade_id: 'g_economic', is_default: true },
  { id: 'mgb_cee_ups', model_id: 'm_cee_ups_s', grade_id: 'g_standard', is_default: true },
  { id: 'mgb_cee_ac', model_id: 'm_cee_ac_s', grade_id: 'g_standard', is_default: true },
  { id: 'mgb_cee_cab', model_id: 'm_cee_cab_s', grade_id: 'g_standard', is_default: true },
  { id: 'mgb_pas_spk', model_id: 'm_pas_spk_s', grade_id: 'g_standard', is_default: true },
  { id: 'mgb_pas_amp', model_id: 'm_pas_amp_s', grade_id: 'g_standard', is_default: true },
  { id: 'mgb_pipe_tray', model_id: 'm_pipe_tray_s', grade_id: 'g_standard', is_default: true },
  { id: 'mgb_pipe_mh', model_id: 'm_pipe_mh_s', grade_id: 'g_standard', is_default: true },
]

/** 价格与型号-等级绑定表数据 */
export const priceTables: Record<string, Row[]> = {
  prices,
  model_grade_bindings,
}