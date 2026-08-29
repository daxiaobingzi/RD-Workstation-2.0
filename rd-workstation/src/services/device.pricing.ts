import { repository } from '../db/memory-db'
import { T } from '../types/domain'
import type { Price, Brand, Supplier, ModelBrand, Grade, Product, ProductModel } from '../types/domain'
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

  /* ---------- 价格治理（对齐 Vue PriceGovern：缺价体检 / 按品牌批量调价 / 品牌替换） ---------- */
  /** 全库缺价体检：按设备类型 × 配置行列出 未挂品牌 / 缺参考价 问题 */
  brandAudit(): { deviceTypeId: string; deviceTypeName: string; modelId: string; model: string; brandName: string; unitPrice: number; issue: string }[] {
    const db = repository.db
    const products = (db[T.products] ?? []) as Product[]
    const models = (db[T.product_models] ?? []) as ProductModel[]
    const brandIdOfModel = new Map<string, string>()
    for (const mb of db[T.model_brands] ?? []) brandIdOfModel.set((mb as ModelBrand).model_id, (mb as ModelBrand).brand_id)
    const brandNameById = new Map<string, string>()
    for (const b of db[T.brands] ?? []) brandNameById.set((b as Brand).id, (b as Brand).name)
    const refPriceOf = new Map<string, number>()
    for (const p of db[T.prices] ?? []) {
      const row = p as Price
      if (row.price_type === 'reference') refPriceOf.set(row.model_id, row.price)
    }
    const out: { deviceTypeId: string; deviceTypeName: string; modelId: string; model: string; brandName: string; unitPrice: number; issue: string }[] = []
    for (const p of products) {
      for (const m of models.filter((x) => x.product_id === p.id)) {
        const bid = brandIdOfModel.get(m.id)
        const brandName = bid ? (brandNameById.get(bid) ?? '') : ''
        const unitPrice = refPriceOf.get(m.id) ?? 0
        if (!brandName) out.push({ deviceTypeId: p.id, deviceTypeName: p.name, modelId: m.id, model: m.model, brandName: '', unitPrice, issue: '未挂品牌' })
        else if (unitPrice <= 0) out.push({ deviceTypeId: p.id, deviceTypeName: p.name, modelId: m.id, model: m.model, brandName, unitPrice, issue: '缺参考价' })
      }
    }
    return out
  },
  /** 按品牌批量调价（参考价）：pct 百分比（10=+10%），roundTo 取整位数（0 不取整）；无价型号跳过并计数 */
  bulkAdjustPriceByBrand(brandId: string, pct: number, roundTo = 10): { adjusted: number; skipped: number } {
    const db = repository.db
    const modelIds = (db[T.model_brands] ?? []).filter((mb) => (mb as ModelBrand).brand_id === brandId).map((mb) => (mb as ModelBrand).model_id)
    let adjusted = 0
    let skipped = 0
    for (const mid of modelIds) {
      const cur = this.price(mid)
      if (cur <= 0) { skipped++; continue }
      let nv = Math.round(cur * (1 + pct / 100))
      if (roundTo > 0) nv = Math.round(nv / roundTo) * roundTo
      if (!(nv > 0)) nv = 1
      this.setPrice(mid, 'reference', nv, { source: '按品牌批量调价' })
      adjusted++
    }
    return { adjusted, skipped }
  },
  /** 品牌替换（停产/换主供）：把旧品牌下所有型号改绑新品牌，参考价保持不变 */
  replaceBrand(oldBrandId: string, newBrandId: string): { moved: number } {
    const list = repository.getTable<ModelBrand>(T.model_brands)
    let moved = 0
    for (const mb of list) {
      if (mb.brand_id === oldBrandId) {
        repository.update(T.model_brands, mb.id, { brand_id: newBrandId })
        moved++
      }
    }
    return { moved }
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