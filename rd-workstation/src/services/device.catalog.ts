import { repository } from '../db/memory-db'
import { T } from '../types/domain'
import type {
  DeviceCategory, DeviceSelection, Product, ProductFamily, ProductModel, ProjectSystem, Project,
  BillItem, ModelBrand, ModelGradeBinding, Brand, Price, Point, TelecomRoom, DeviceMaterial, Grade,
} from '../types/domain'
import { uid } from '../lib/utils'
import { DeviceGrade } from './device.grade'
import { DeviceCode } from './device.code'

function nowIso() {
  return new Date().toISOString()
}

/** 设备类型 → 配置行聚合视图（设备中心 U2/U3 主表数据源） */
export interface DeviceTypeView {
  product: Product
  rows: { m: ProductModel; brandName: string; unitPrice: number }[]
  modelCount: number
  brandNames: string[]
  gradeCoverage: { grade: string; count: number }[]
  priceMin: number | null
  priceMax: number | null
  disabledCount: number
}

/** 类别标签元数据（设备类型属性字段的取值与展示；对齐 Vue：前端/后端/管材线缆/辅材） */
export const DEVICE_CATEGORIES: { code: string; label: string }[] = [
  { code: 'front', label: '前端设备' },
  { code: 'back', label: '后端设备' },
  { code: 'cable', label: '管材线缆' },
  { code: 'aux', label: '辅材' },
  { code: '__other', label: '其他' },
]

/* ---------- 设备目录（类别 / 产品族 / 产品 / 型号 / 品牌关联） ---------- */
export const DeviceCatalog = {
  categories(): DeviceCategory[] {
    return repository.getTable<DeviceCategory>(T.device_categories)
  },
  addCategory(data: Partial<DeviceCategory>): DeviceCategory {
    const c: DeviceCategory = { id: uid('dc'), code: data.code || '', name: data.name || '新类别', system_id: data.system_id, category_type: data.category_type, sort_order: 1, enabled: true, ...data }
    repository.insert(T.device_categories, c)
    return c
  },
  updateCategory(id: string, patch: Partial<DeviceCategory>) {
    repository.update(T.device_categories, id, patch)
  },
  removeCategory(id: string): { ok: boolean; reason?: string } {
    const inUse = repository.getTable<ProductFamily>(T.product_families).some((f) => f.device_category_id === id)
    if (inUse) return { ok: false, reason: '该类别下仍有产品族，请先清空' }
    repository.remove(T.device_categories, id)
    return { ok: true }
  },

  families(categoryId?: string): ProductFamily[] {
    return repository.getTable<ProductFamily>(T.product_families).filter((f) => !categoryId || f.device_category_id === categoryId)
  },
  addFamily(data: Partial<ProductFamily>): ProductFamily {
    const f: ProductFamily = { id: uid('pf'), device_category_id: data.device_category_id || '', code: data.code || '', name: data.name || '新产品族', sort_order: 1, enabled: true, ...data }
    repository.insert(T.product_families, f)
    return f
  },
  updateFamily(id: string, patch: Partial<ProductFamily>) {
    repository.update(T.product_families, id, patch)
  },
  removeFamily(id: string): { ok: boolean; reason?: string } {
    const inUse = repository.getTable<Product>(T.products).some((p) => p.product_family_id === id)
    if (inUse) return { ok: false, reason: '该产品族下仍有产品/型号，请先清空' }
    repository.remove(T.product_families, id)
    return { ok: true }
  },

  products(familyId?: string): Product[] {
    return repository.getTable<Product>(T.products).filter((p) => !familyId || p.product_family_id === familyId)
  },
  addProduct(data: Partial<Product>): Product {
    const p: Product = { id: uid('prod'), product_family_id: data.product_family_id || '', name: data.name || '新产品', manufacturer: data.manufacturer, ...data }
    repository.insert(T.products, p)
    return p
  },
  updateProduct(id: string, patch: Partial<Product>) {
    repository.update(T.products, id, patch)
  },

  resolveDeviceType(data: { name: string; product_family_id?: string; specification?: string; unit?: string; system_id?: string; category?: string }): Product {
    const name = (data.name || '').trim()
    const existing = repository.getTable<Product>(T.products).find((p) => p.name === name && (data.system_id ? p.system_id === data.system_id : true) && (data.product_family_id ? p.product_family_id === data.product_family_id : true))
    if (existing) return existing
    const p: Product = {
      id: uid('prod'), name: name || '新设备类型', manufacturer: '',
      product_family_id: data.product_family_id,
      specification: data.specification, unit: data.unit,
      system_id: data.system_id, category: data.category,
    } as Product
    repository.insert(T.products, p)
    DeviceCode.assignCode(p)
    return p
  },
  addDeviceType(data: { product_family_id?: string; name: string; manufacturer?: string; specification?: string; unit?: string; system_id?: string; category?: string }): Product {
    return this.resolveDeviceType({ name: data.name, product_family_id: data.product_family_id, specification: data.specification, unit: data.unit, system_id: data.system_id, category: data.category })
  },
  updateDeviceType(id: string, patch: Record<string, unknown>) {
    repository.update(T.products, id, patch)
    if ('system_id' in patch || 'category' in patch) DeviceCode.reassignCode(id)
  },

  /** 设备类型主体视图：逐设备类型聚合其下配置行（型号）数量 / 品牌 / 档位覆盖 / 参考价区间。 */
  deviceTypes(filter?: { systemId?: string; category?: string; familyId?: string }): DeviceTypeView[] {
    const db = repository.db
    const products = db[T.products] ?? []
    const models = db[T.product_models] ?? []
    const grades = db[T.grades] ?? []
    const modelBrands = db[T.model_brands] ?? []
    const brands = db[T.brands] ?? []
    const prices = db[T.prices] ?? []
    const bindings = db[T.model_grade_bindings] ?? []

    const familyByProduct = new Map<string, string>()
    for (const p of products) familyByProduct.set(p.id, p.product_family_id ?? '')

    const modelsByProduct = new Map<string, ProductModel[]>()
    for (const m of models) {
      const list = modelsByProduct.get(m.product_id)
      if (list) list.push(m)
      else modelsByProduct.set(m.product_id, [m])
    }

    const brandIdByModel = new Map<string, string>()
    for (const mb of modelBrands) brandIdByModel.set(mb.model_id, mb.brand_id)

    const brandNameById = new Map<string, string>()
    for (const b of brands) brandNameById.set(b.id, b.name)

    const referencePriceByModel = new Map<string, number>()
    for (const p of prices) {
      if (p.price_type === 'reference') referencePriceByModel.set(p.model_id, p.price)
    }

    const gradeCodeByModel = new Map<string, string>()
    const gradeCodeById = new Map<string, string>()
    for (const g of grades) gradeCodeById.set(g.id, g.code)
    const hasBindingByModel = new Set<string>()
    for (const binding of bindings) {
      if (!hasBindingByModel.has(binding.model_id)) {
        const code = gradeCodeById.get(binding.grade_id)
        if (code) gradeCodeByModel.set(binding.model_id, code)
        hasBindingByModel.add(binding.model_id)
      }
    }
    for (const m of models) {
      if (!gradeCodeByModel.has(m.id) && m.grade_code) gradeCodeByModel.set(m.id, m.grade_code)
    }

    return products
      .filter((p) => {
        if (filter?.systemId && (p.system_id ?? '__other') !== filter.systemId) return false
        if (filter?.category && p.category !== filter.category) return false
        if (filter?.familyId && familyByProduct.get(p.id) !== filter.familyId) return false
        return true
      })
      .map((product) => {
        const pModels = modelsByProduct.get(product.id) ?? []
        const rows = pModels.map((m) => ({
          m,
          brandName: brandNameById.get(brandIdByModel.get(m.id) ?? '') ?? '',
          unitPrice: referencePriceByModel.get(m.id) ?? 0,
        }))
        const priced = rows.map((r) => r.unitPrice).filter((v) => v > 0)
        const gradeCount = new Map<string, number>()
        for (const m of pModels) {
          if (m.status === 'disabled') continue
          const grade = gradeCodeByModel.get(m.id)
          if (grade) gradeCount.set(grade, (gradeCount.get(grade) ?? 0) + 1)
        }
        return {
          product,
          rows,
          modelCount: pModels.length,
          brandNames: [...new Set(rows.map((r) => r.brandName).filter(Boolean))],
          gradeCoverage: grades.map((g) => ({ grade: g.code, count: gradeCount.get(g.code) ?? 0 })),
          priceMin: priced.length ? Math.min(...priced) : null,
          priceMax: priced.length ? Math.max(...priced) : null,
          disabledCount: pModels.reduce((count, m) => count + (m.status === 'disabled' ? 1 : 0), 0),
        }
      })
      .sort((a, b) => (a.product.sort_order ?? 9999) - (b.product.sort_order ?? 9999) || a.product.name.localeCompare(b.product.name))
  },

  models(familyId?: string): (ProductModel & { familyId?: string })[] {
    const models = repository.getTable<ProductModel>(T.product_models)
    const famMap = new Map(repository.getTable<Product>(T.products).map((p) => [p.id, p.product_family_id]))
    return models
      .map((m) => ({ ...m, familyId: famMap.get(m.product_id) }))
      .filter((m) => !familyId || m.familyId === familyId)
  },
  addModel(data: { product_id?: string; product_family_id?: string; device_type_name?: string; model: string; specification?: string; unit?: string; grade_code?: string; status?: 'active' | 'disabled'; detail_html?: string; brand_id?: string }): ProductModel | undefined {
    let product: Product | undefined
    if (data.product_id) product = repository.getById<Product>(T.products, data.product_id)
    if (!product) {
      if (data.product_family_id) {
        const family = repository.getById<ProductFamily>(T.product_families, data.product_family_id)
        if (!family) return undefined
        product = this.resolveDeviceType({ name: data.device_type_name?.trim() || data.model, product_family_id: family.id })
      } else {
        product = this.resolveDeviceType({ name: data.device_type_name?.trim() || data.model })
      }
    }
    const model: ProductModel = {
      id: uid('m'), product_id: product.id, model: data.model,
      specification: data.specification, unit: data.unit ?? '台',
      grade_code: data.grade_code, status: data.status ?? 'active',
      detail_html: data.detail_html, created_at: nowIso(),
    }
    repository.insert(T.product_models, model)
    DeviceGrade.setModelDefaultGrade(model.id, data.grade_code)
    if (data.brand_id) this.setModelBrand(model.id, data.brand_id)
    return model
  },
  updateModel(id: string, patch: Partial<ProductModel>) {
    repository.update(T.product_models, id, { ...patch, updated_at: nowIso() })
  },
  setModelStatus(id: string, status: 'active' | 'disabled') {
    repository.update(T.product_models, id, { status })
  },
  removeDeviceType(id: string): { ok: boolean; reason?: string; used?: { model: string; brand: string; projectNames: string[] }[] } {
    const models = repository.getTable<ProductModel>(T.product_models).filter((m) => m.product_id === id)
    const used: { model: string; brand: string; projectNames: string[] }[] = []
    for (const m of models) {
      const u = this.modelUsage(m.id)
      if (u.selectionCount > 0 || u.totalQty > 0) {
        used.push({ model: m.model, brand: this.brandOf(m.id).name ?? '', projectNames: u.projectNames })
      }
    }
    if (used.length) return { ok: false, reason: '该设备下型号已被项目引用，无法删除', used }
    for (const m of models) {
      repository.remove(T.product_models, m.id)
      repository.removeMany(T.prices, (r) => r.model_id === m.id)
      repository.removeMany(T.model_brands, (r) => r.model_id === m.id)
      repository.removeMany(T.model_grade_bindings, (r) => r.model_id === m.id)
    }
    repository.removeMany(T.device_materials, (r) => r.product_id === id)
    repository.remove(T.products, id)
    return { ok: true }
  },
  removeModel(id: string): { ok: boolean; reason?: string } {
    const used = this.modelInUse(id)
    if (used) return { ok: false, reason: '该型号已被项目选型/清单引用，请改为「停用」而非删除' }
    repository.remove(T.product_models, id)
    repository.removeMany(T.prices, (r) => r.model_id === id)
    repository.removeMany(T.model_brands, (r) => r.model_id === id)
    repository.removeMany(T.model_grade_bindings, (r) => r.model_id === id)
    return { ok: true }
  },
  modelInUse(modelId: string): boolean {
    const db = repository.db
    const sel = (db[T.device_selections] ?? []).some((s) => s.model_id === modelId)
    const bill = (db[T.bill_items] ?? []).some((i) => i.device_model_id === modelId)
    return sel || bill
  },
  modelUsage(modelId: string): { projectNames: string[]; systemCount: number; totalQty: number; totalAmount: number; selectionCount: number } {
    const db = repository.db
    const psOf = new Map((db[T.project_systems] ?? []).map((s) => [s.id, s.project_id]))
    const projName = new Map((db[T.projects] ?? []).map((p) => [p.id, p.name]))
    const sels = (db[T.device_selections] ?? []).filter((s) => s.model_id === modelId)
    const systems = new Set(sels.map((s) => s.project_system_id))
    const projectNames = new Set<string>()
    systems.forEach((psId) => { const projectId = psOf.get(psId); const n = projectId ? projName.get(projectId) : undefined; if (n) projectNames.add(n) })
    return {
      projectNames: [...projectNames],
      systemCount: systems.size,
      totalQty: sels.reduce((s, x) => s + (x.quantity || 0), 0),
      totalAmount: sels.reduce((s, x) => s + (x.total_price || 0), 0),
      selectionCount: sels.length,
    }
  },
  materials(productId: string): DeviceMaterial[] {
    return repository.getTable<DeviceMaterial>(T.device_materials).filter((m) => m.product_id === productId && m.enabled !== false).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
  },
  materialBOM(productIds: string[]): DeviceMaterial[] {
    const ids = new Set(productIds)
    return repository.getTable<DeviceMaterial>(T.device_materials).filter((m) => ids.has(m.product_id) && m.enabled !== false)
  },
  saveMaterial(data: Partial<DeviceMaterial>): DeviceMaterial {
    const existing = data.id ? repository.getById<DeviceMaterial>(T.device_materials, data.id) : undefined
    if (existing) {
      repository.update(T.device_materials, existing.id, { ...data, updated_at: nowIso() } as Record<string, unknown>)
      return repository.getById<DeviceMaterial>(T.device_materials, existing.id)!
    }
    const m: DeviceMaterial = {
      id: uid('dm'), product_id: data.product_id || '', category: data.category ?? 'other', name: data.name || '材料', unit: data.unit || '', quantity_per_point: data.quantity_per_point ?? 1, note: data.note, enabled: data.enabled ?? true,
    }
    repository.insert(T.device_materials, m)
    return m
  },
  removeMaterial(id: string) { repository.remove(T.device_materials, id) },
  setModelBrand(modelId: string, brandId: string | undefined) {
    const existing = repository.getTable<ModelBrand>(T.model_brands).find((mb) => mb.model_id === modelId)
    if (existing) repository.update(T.model_brands, existing.id, { brand_id: brandId, is_default: true })
    else if (brandId) repository.insert(T.model_brands, { id: uid('mb'), model_id: modelId, brand_id: brandId, is_default: true })
  },
  brandOf(modelId: string): { id?: string; name?: string } {
    const db = repository.db
    const mb = (db[T.model_brands] ?? []).find((r) => r.model_id === modelId && r.is_default !== false)
    const b = mb ? (db[T.brands] ?? []).find((x) => x.id === mb.brand_id) : undefined
    return { id: mb?.brand_id, name: b?.name }
  },
}

export interface ProductOption {
  id: string
  name: string
  familyName?: string
  categoryName?: string
  systemId?: string
  unit?: string
  brandNames: string[]
  modelNames: string[]
  searchText: string
}

export const DeviceProductOptions = {
  list(systemId?: string): ProductOption[] {
    const db = repository.db
    const catById = new Map((db[T.device_categories] ?? []).map((c) => [c.id, c]))
    const famById = new Map((db[T.product_families] ?? []).map((f) => [f.id, f]))
    const brandNameById = new Map((db[T.brands] ?? []).map((b) => [b.id, b.name]))
    const brandIdsByModel = new Map<string, string[]>()
    for (const mb of db[T.model_brands] ?? []) {
      const list = brandIdsByModel.get(mb.model_id) ?? []
      list.push(mb.brand_id)
      brandIdsByModel.set(mb.model_id, list)
    }
    const modelsByProduct = new Map<string, ProductModel[]>()
    for (const m of db[T.product_models] ?? []) {
      const list = modelsByProduct.get(m.product_id) ?? []
      list.push(m)
      modelsByProduct.set(m.product_id, list)
    }
    const options: ProductOption[] = []
    for (const prod of db[T.products] ?? []) {
      const family = prod.product_family_id ? famById.get(prod.product_family_id) : undefined
      const cat = family ? catById.get(family.device_category_id) : undefined
      const sysId = cat?.system_id
      if (systemId && sysId !== systemId) continue
      const models = modelsByProduct.get(prod.id) ?? []
      const brandNames = new Set<string>()
      const modelNames: string[] = []
      for (const m of models) {
        modelNames.push(m.model)
        for (const bid of brandIdsByModel.get(m.id) ?? []) {
          const name = brandNameById.get(bid)
          if (name) brandNames.add(name)
        }
      }
      const unit = models.find((m) => m.unit)?.unit
      const searchText = [prod.name, family?.name, cat?.name, [...brandNames].join(' '), modelNames.join(' ')].filter(Boolean).join(' ')
      options.push({ id: prod.id, name: prod.name, familyName: family?.name, categoryName: cat?.name, systemId: sysId, unit, brandNames: [...brandNames], modelNames, searchText })
    }
    return options.sort((a, b) => a.name.localeCompare(b.name))
  },
  recentByProjectId(projectId: string, limit = 8): string[] {
    const db = repository.db
    const psOf = new Map((db[T.project_systems] ?? []).map((s) => [s.id, s.project_id]))
    const byTime = new Map<string, number>()
    for (const point of db[T.points] ?? []) {
      if (psOf.get(point.project_system_id) !== projectId || !point.device_id) continue
      const t = point.updated_at ? new Date(point.updated_at).getTime() : 0
      const prev = byTime.get(point.device_id) ?? 0
      if (t > prev) byTime.set(point.device_id, t)
    }
    return [...byTime.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id)
  },
  structureNamesOf(projectId: string): { buildingOf: Map<string, string>; telecomNameOf: Map<string, string> } {
    const db = repository.db
    const buildingOf = new Map<string, string>()
    for (const b of db[T.buildings] ?? []) if (b.project_id === projectId) buildingOf.set(b.id, b.name)
    const telecomNameOf = new Map<string, string>()
    for (const r of db[T.telecom_rooms] ?? []) telecomNameOf.set(r.id, r.name)
    return { buildingOf, telecomNameOf }
  },
}