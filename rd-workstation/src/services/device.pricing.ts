import { useDB } from '../db/memory-db'
import { T } from '../types/domain'
import type { Price, Brand, Supplier, ModelBrand, Grade } from '../types/domain'
import { uid } from '../lib/utils'

function nowIso() {
  return new Date().toISOString()
}

/* ---------- 设备定价 / 品牌 / 供应商 ---------- */
export const DevicePricing = {
  prices(modelId: string): Price[] {
    return useDB.getState().where<Price>(T.prices, (r) => r.model_id === modelId).sort((a, b) => (a.effective_date ?? '').localeCompare(b.effective_date ?? ''))
  },
  price(modelId: string): number {
    const prices = this.prices(modelId)
    const ref = prices.find((p) => p.price_type === 'reference')
    return ref?.price ?? prices[0]?.price ?? 0
  },
  /** 写价格：同类型已有记录则更新，否则新增（reference 为当前生效参考价） */
  setPrice(modelId: string, priceType: Price['price_type'], price: number, extra?: { effective_date?: string; source?: string; supplier_id?: string; remark?: string }) {
    const existing = useDB.getState().getTable<Price>(T.prices).find((p) => p.model_id === modelId && p.price_type === priceType)
    const patch = { price, currency: 'CNY', effective_date: extra?.effective_date, source: extra?.source, supplier_id: extra?.supplier_id, remark: extra?.remark, updated_at: nowIso() }
    if (existing) {
      useDB.getState().update(T.prices, existing.id, patch)
      return existing.id
    }
    const id = uid('price')
    useDB.getState().insert(T.prices, { id, model_id: modelId, price_type: priceType, ...patch, created_at: nowIso() } as unknown as Price)
    return id
  },
  removePrice(id: string) {
    useDB.getState().remove(T.prices, id)
  },

  brands(): Brand[] {
    return useDB.getState().getTable<Brand>(T.brands)
  },
  addBrand(data: Partial<Brand>): Brand {
    const b: Brand = { id: uid('b'), name: data.name || '新品牌', manufacturer_type: data.manufacturer_type, website: data.website, remark: data.remark }
    useDB.getState().insert(T.brands, b)
    return b
  },
  updateBrand(id: string, patch: Partial<Brand>) {
    useDB.getState().update(T.brands, id, patch)
  },
  removeBrand(id: string): { ok: boolean; reason?: string } {
    const inUse = useDB.getState().getTable<ModelBrand>(T.model_brands).some((mb) => mb.brand_id === id)
    if (inUse) return { ok: false, reason: '该品牌已被型号引用，请先解除关联' }
    useDB.getState().remove(T.brands, id)
    return { ok: true }
  },

  grades(): Grade[] {
    return useDB.getState().getTable<Grade>(T.grades)
  },

  /* ---------- 供应商（预留域：询价 / 供应体系） ---------- */
  suppliers(): Supplier[] {
    return useDB.getState().getTable<Supplier>(T.suppliers)
  },
  addSupplier(data: Partial<Supplier>): Supplier {
    const s: Supplier = { id: uid('sup'), name: data.name || '新供应商', contact: data.contact, phone: data.phone, region: data.region, remark: data.remark }
    useDB.getState().insert(T.suppliers, s)
    return s
  },
  updateSupplier(id: string, patch: Partial<Supplier>) {
    useDB.getState().update(T.suppliers, id, patch)
  },
  removeSupplier(id: string): { ok: boolean; reason?: string } {
    const inUse = useDB.getState().getTable<Price>(T.prices).some((p) => p.supplier_id === id)
    if (inUse) return { ok: false, reason: '该供应商已被询价记录引用，请先解除关联' }
    useDB.getState().remove(T.suppliers, id)
    return { ok: true }
  },
}