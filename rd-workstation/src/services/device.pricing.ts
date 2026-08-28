import { repository } from '../db/memory-db'
import { T } from '../types/domain'
import type { Price, Brand, Supplier, ModelBrand, Grade } from '../types/domain'
import { uid } from '../lib/utils'

function nowIso() {
  return new Date().toISOString()
}

/* ---------- 设备定价 / 品牌 / 供应商 ---------- */
export const DevicePricing = {
  prices(modelId: string): Price[] {
    return repository.where<Price>(T.prices, (r) => r.model_id === modelId).sort((a, b) => (a.effective_date ?? '').localeCompare(b.effective_date ?? ''))
  },
  price(modelId: string): number {
    const prices = this.prices(modelId)
    const ref = prices.find((p) => p.price_type === 'reference')
    return ref?.price ?? prices[0]?.price ?? 0
  },
  /** 写价格：同类型已有记录则更新，否则新增（reference 为当前生效参考价） */
  setPrice(modelId: string, priceType: Price['price_type'], price: number, extra?: { effective_date?: string; source?: string; supplier_id?: string; remark?: string }) {
    const existing = repository.getTable<Price>(T.prices).find((p) => p.model_id === modelId && p.price_type === priceType)
    const patch = { price, currency: 'CNY', effective_date: extra?.effective_date, source: extra?.source, supplier_id: extra?.supplier_id, remark: extra?.remark, updated_at: nowIso() }
    if (existing) {
      repository.update(T.prices, existing.id, patch)
      return existing.id
    }
    const id = uid('price')
    repository.insert(T.prices, { id, model_id: modelId, price_type: priceType, ...patch, created_at: nowIso() } as unknown as Price)
    return id
  },
  removePrice(id: string) {
    repository.remove(T.prices, id)
  },

  brands(): Brand[] {
    return repository.getTable<Brand>(T.brands)
  },
  addBrand(data: Partial<Brand>): Brand {
    const b: Brand = { id: uid('b'), name: data.name || '新品牌', manufacturer_type: data.manufacturer_type, website: data.website, remark: data.remark }
    repository.insert(T.brands, b)
    return b
  },
  updateBrand(id: string, patch: Partial<Brand>) {
    repository.update(T.brands, id, patch)
  },
  removeBrand(id: string): { ok: boolean; reason?: string } {
    const inUse = repository.getTable<ModelBrand>(T.model_brands).some((mb) => mb.brand_id === id)
    if (inUse) return { ok: false, reason: '该品牌已被型号引用，请先解除关联' }
    repository.remove(T.brands, id)
    return { ok: true }
  },

  grades(): Grade[] {
    return repository.getTable<Grade>(T.grades)
  },

  /* ---------- 供应商（预留域：询价 / 供应体系） ---------- */
  suppliers(): Supplier[] {
    return repository.getTable<Supplier>(T.suppliers)
  },
  addSupplier(data: Partial<Supplier>): Supplier {
    const s: Supplier = { id: uid('sup'), name: data.name || '新供应商', contact: data.contact, phone: data.phone, region: data.region, remark: data.remark }
    repository.insert(T.suppliers, s)
    return s
  },
  updateSupplier(id: string, patch: Partial<Supplier>) {
    repository.update(T.suppliers, id, patch)
  },
  removeSupplier(id: string): { ok: boolean; reason?: string } {
    const inUse = repository.getTable<Price>(T.prices).some((p) => p.supplier_id === id)
    if (inUse) return { ok: false, reason: '该供应商已被询价记录引用，请先解除关联' }
    repository.remove(T.suppliers, id)
    return { ok: true }
  },
}