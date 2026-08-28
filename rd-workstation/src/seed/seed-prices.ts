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
]

/** 价格与型号-等级绑定表数据 */
export const priceTables: Record<string, Row[]> = {
  prices,
  model_grade_bindings,
}