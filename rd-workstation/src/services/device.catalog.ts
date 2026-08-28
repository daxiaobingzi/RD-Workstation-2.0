import { repository } from '../db/memory-db'
import { T } from '../types/domain'
import type {
  DeviceCategory, DeviceSelection, Product, ProductFamily, ProductModel, ProjectSystem, Project,
  BillItem, ModelBrand, ModelGradeBinding, Brand, Price,
} from '../types/domain'
import { uid } from '../lib/utils'
import { DeviceGrade } from './device.grade'

function nowIso() {
  return new Date().toISOString()
}

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

  models(familyId?: string): (ProductModel & { familyId?: string })[] {
    const models = repository.getTable<ProductModel>(T.product_models)
    const famMap = new Map(repository.getTable<Product>(T.products).map((p) => [p.id, p.product_family_id]))
    return models
      .map((m) => ({ ...m, familyId: famMap.get(m.product_id) }))
      .filter((m) => !familyId || m.familyId === familyId)
  },
  addModel(data: { product_family_id: string; model: string; specification?: string; unit?: string; grade_code?: string; status?: 'active' | 'disabled'; parameter_json?: Record<string, unknown>; brand_id?: string }): ProductModel | undefined {
    const family = repository.getById<ProductFamily>(T.product_families, data.product_family_id)
    if (!family) return undefined
    const productId = uid('prod')
    repository.insert(T.products, { id: productId, product_family_id: family.id, name: data.model, manufacturer: '' } as unknown as Product)
    const model: ProductModel = {
      id: uid('m'), product_id: productId, model: data.model,
      specification: data.specification, unit: data.unit ?? '台',
      grade_code: data.grade_code, status: data.status ?? 'active',
      parameter_json: data.parameter_json ?? {}, created_at: nowIso(),
    }
    repository.insert(T.product_models, model)
    // 表单主档同步写入绑定表，保证 engine（绑定优先）与 grade_code 口径一致
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
  /** 删除保护：被项目选型 / 清单引用的型号禁止物理删除，应转为停用 */
  removeModel(id: string): { ok: boolean; reason?: string } {
    const used = this.modelInUse(id)
    if (used) return { ok: false, reason: '该型号已被项目选型/清单引用，请改为「停用」而非删除' }
    const m = repository.getById<ProductModel>(T.product_models, id)
    if (m) repository.remove(T.products, m.product_id)
    repository.remove(T.product_models, id)
    repository.removeMany(T.prices, (r) => (r as Price).model_id === id)
    repository.removeMany(T.model_brands, (r) => (r as ModelBrand).model_id === id)
    repository.removeMany(T.model_grade_bindings, (r) => (r as ModelGradeBinding).model_id === id)
    return { ok: true }
  },
  modelInUse(modelId: string): boolean {
    const db = repository.db
    const sel = (db[T.device_selections] ?? []).some((s) => (s as DeviceSelection).model_id === modelId)
    const bill = (db[T.bill_items] ?? []).some((i) => (i as BillItem).device_model_id === modelId)
    return sel || bill
  },
  /** 型号项目使用情况（真·聚合）：项目名单 / 选型量 / 金额 */
  modelUsage(modelId: string): { projectNames: string[]; systemCount: number; totalQty: number; totalAmount: number; selectionCount: number } {
    const db = repository.db
    const psOf = new Map((db[T.project_systems] ?? []).map((s) => [s.id, s as ProjectSystem]))
    const projName = new Map((db[T.projects] ?? []).map((p) => [p.id, (p as Project).name]))
    const sels = (db[T.device_selections] ?? []).filter((s) => (s as DeviceSelection).model_id === modelId) as DeviceSelection[]
    const systems = new Set(sels.map((s) => s.project_system_id))
    const projectNames = new Set<string>()
    systems.forEach((psId) => { const p = psOf.get(psId); if (p) { const n = projName.get(p.project_id); if (n) projectNames.add(n) } })
    return {
      projectNames: [...projectNames],
      systemCount: systems.size,
      totalQty: sels.reduce((s, x) => s + (x.quantity || 0), 0),
      totalAmount: sels.reduce((s, x) => s + (x.total_price || 0), 0),
      selectionCount: sels.length,
    }
  },

  setModelBrand(modelId: string, brandId: string | undefined) {
    const existing = repository.getTable<ModelBrand>(T.model_brands).find((mb) => mb.model_id === modelId)
    if (existing) {
      repository.update(T.model_brands, existing.id, { brand_id: brandId, is_default: true })
    } else if (brandId) {
      repository.insert(T.model_brands, { id: uid('mb'), model_id: modelId, brand_id: brandId, is_default: true } as unknown as ModelBrand)
    }
  },
  brandOf(modelId: string): { id?: string; name?: string } {
    const db = repository.db
    const mb = (db[T.model_brands] ?? []).find((r) => (r as ModelBrand).model_id === modelId && (r as ModelBrand).is_default !== false) as ModelBrand | undefined
    const b = mb ? (db[T.brands] ?? []).find((x) => x.id === mb.brand_id) as Brand | undefined : undefined
    return { id: mb?.brand_id, name: b?.name }
  },
}