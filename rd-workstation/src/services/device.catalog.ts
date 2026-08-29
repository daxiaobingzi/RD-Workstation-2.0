import { repository } from '../db/memory-db'
import { T } from '../types/domain'
import type {
  DeviceCategory, DeviceSelection, Product, ProductFamily, ProductModel, ProjectSystem, Project,
  BillItem, ModelBrand, ModelGradeBinding, Brand, Price, Point, TelecomRoom, DeviceMaterial, Grade,
} from '../types/domain'
import { uid } from '../lib/utils'
import { DeviceGrade } from './device.grade'

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

/** 子系统顶层元数据（设备中心页签数据源；与 device-center.types.SYSTEM_GROUPS 同步维护） */
export const DEVICE_SYSTEMS: { id: string; label: string }[] = [
  { id: 'sys_vss', label: '安防 · 视频监控' },
  { id: 'sys_acs', label: '安防 · 门禁管理' },
  { id: 'sys_ias', label: '安防 · 入侵报警' },
  { id: 'sys_pat', label: '安防 · 电子巡更' },
  { id: 'sys_fen', label: '安防 · 电子围栏' },
  { id: 'sys_ics', label: '安防 · 可视对讲' },
  { id: 'sys_lan', label: '信息网络 · 信息网络' },
  { id: 'sys_cab', label: '信息网络 · 综合布线' },
  { id: 'sys_gpn', label: '信息网络 · 全光网络' },
  { id: 'sys_wls', label: '信息网络 · 无线对讲' },
  { id: 'sys_cee', label: '机房 · 机房工程' },
  { id: 'sys_pipe', label: '机房 · 综合管路' },
  { id: 'sys_cps', label: '公共设施 · 停车管理' },
  { id: 'sys_pas', label: '公共设施 · 公共广播' },
  { id: 'sys_info', label: '公共设施 · 信息发布' },
  { id: 'sys_led', label: '公共设施 · LED大屏' },
  { id: 'sys_bms', label: '楼宇控制 · 楼宇自控' },
  { id: '__other', label: '通用设备' },
]

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

  /** 设备类型解析：子系统+类别+名称维度匹配已有则复用，否则新建（避免重复 Product） */
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
    return p
  },
  /** 创建设备类型（不含型号） */
  addDeviceType(data: { product_family_id?: string; name: string; manufacturer?: string; specification?: string; unit?: string; system_id?: string; category?: string }): Product {
    return this.resolveDeviceType({ name: data.name, product_family_id: data.product_family_id, specification: data.specification, unit: data.unit, system_id: data.system_id, category: data.category })
  },
  /** 更新设备类型自身字段 */
  updateDeviceType(id: string, patch: Record<string, unknown>) {
    repository.update(T.products, id, patch)
  },

  /** 设备类型主体视图：逐设备类型聚合其下配置行（型号）数量 / 品牌 / 档位覆盖 / 参考价区间。
   *  过滤维度：子系统（systemId）/ 类别（category）/ 产品族（familyId，过渡兼容）。 */
  deviceTypes(filter?: { systemId?: string; category?: string; familyId?: string }): DeviceTypeView[] {
    const db = repository.db
    const famOf = new Map<string, string>()
    for (const p of db[T.products] ?? []) famOf.set((p as Product).id, (p as Product).product_family_id ?? '')
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
    const gradeCodes = (db[T.grades] ?? []).map((g) => (g as Grade).code)
    return ((db[T.products] ?? []) as Product[])
      .filter((p) => {
        const pr = p as Product
        if (filter?.systemId && (pr.system_id ?? '__other') !== filter.systemId) return false
        if (filter?.category && pr.category !== filter.category) return false
        if (filter?.familyId && famOf.get(pr.id) !== filter.familyId) return false
        return true
      })
      .map((p) => {
        const pModels = models.filter((m) => m.product_id === p.id)
        const rows = pModels.map((m) => ({
          m,
          brandName: brandNameById.get(brandIdOfModel.get(m.id) ?? '') ?? '',
          unitPrice: refPriceOf.get(m.id) ?? 0,
        }))
        const priced = rows.map((r) => r.unitPrice).filter((v) => v > 0)
        return {
          product: p,
          rows,
          modelCount: pModels.length,
          brandNames: [...new Set(rows.map((r) => r.brandName).filter(Boolean))],
          gradeCoverage: gradeCodes.map((g) => ({ grade: g, count: pModels.filter((m) => m.status !== 'disabled' && DeviceGrade.gradeCodeOf(m.id) === g).length })),
          priceMin: priced.length ? Math.min(...priced) : null,
          priceMax: priced.length ? Math.max(...priced) : null,
          disabledCount: pModels.filter((m) => m.status === 'disabled').length,
        }
      })
      .sort((a, b) => (a.product.sort_order ?? 9999) - (b.product.sort_order ?? 9999) || a.product.name.localeCompare(b.product.name))
  },

  /** 子系统列表（设备中心页签数据源）：全部子系统含 count=0（U3 空态展示） */
  deviceSystems(): { id: string; label: string; count: number }[] {
    const counts = new Map<string, number>()
    for (const p of repository.getTable<Product>(T.products)) {
      const sys = p.system_id ?? '__other'
      counts.set(sys, (counts.get(sys) ?? 0) + 1)
    }
    return DEVICE_SYSTEMS.map((s) => ({ ...s, count: counts.get(s.id) ?? 0 }))
  },

  models(familyId?: string): (ProductModel & { familyId?: string })[] {
    const models = repository.getTable<ProductModel>(T.product_models)
    const famMap = new Map(repository.getTable<Product>(T.products).map((p) => [p.id, p.product_family_id]))
    return models
      .map((m) => ({ ...m, familyId: famMap.get(m.product_id) }))
      .filter((m) => !familyId || m.familyId === familyId)
  },
  /** 新增品牌型号配置行：在设备类型（Product）下创建型号（ProductModel）。
   *  兼容旧调用（仅传 product_family_id）：按 device_type_name ?? model 在族内复用/新建设备类型，
   *  不再为每个型号偷建重复 Product。 */
  addModel(data: { product_id?: string; product_family_id?: string; device_type_name?: string; model: string; specification?: string; unit?: string; grade_code?: string; status?: 'active' | 'disabled'; detail_html?: string; brand_id?: string }): ProductModel | undefined {
    let product: Product | undefined
    if (data.product_id) product = repository.getById<Product>(T.products, data.product_id)
    if (!product) {
      if (data.product_family_id) {
        const family = repository.getById<ProductFamily>(T.product_families, data.product_family_id)
        if (!family) return undefined
        product = this.resolveDeviceType({ name: data.device_type_name?.trim() || data.model, product_family_id: family.id })
      } else {
        // 顶层模型：设备类型直接按名称归属（子系统/类别由设备类型表单维护）
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
  /** 删除设备类型：若其下型号被项目引用则拒绝并给出明细；否则级联删除型号/价格/品牌绑定/档次绑定/定额材料 */
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
      repository.removeMany(T.prices, (r) => (r as Price).model_id === m.id)
      repository.removeMany(T.model_brands, (r) => (r as ModelBrand).model_id === m.id)
      repository.removeMany(T.model_grade_bindings, (r) => (r as ModelGradeBinding).model_id === m.id)
    }
    repository.removeMany(T.device_materials, (r) => (r as DeviceMaterial).product_id === id)
    repository.remove(T.products, id)
    return { ok: true }
  },
  removeModel(id: string): { ok: boolean; reason?: string } {
    const used = this.modelInUse(id)
    if (used) return { ok: false, reason: '该型号已被项目选型/清单引用，请改为「停用」而非删除' }
    // Delete 型号不删除设备类型（Product 为主体，可清空后整体删除）
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

  /** 设备单点定额材料（P4）：某设备 1 点位的材料配比清单 */
  materials(productId: string): DeviceMaterial[] {
    return repository
      .getTable<DeviceMaterial>(T.device_materials)
      .filter((m) => m.product_id === productId && m.enabled !== false)
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
  },
  /** 按类别取材料（cable=线缆 / conduit=管材 / aux=辅材 / other=其他） */
  materialBOM(productIds: string[]): DeviceMaterial[] {
    const ids = new Set(productIds)
    return repository
      .getTable<DeviceMaterial>(T.device_materials)
      .filter((m) => ids.has(m.product_id) && m.enabled !== false)
  },
  saveMaterial(data: Partial<DeviceMaterial>): DeviceMaterial {
    const existing = data.id ? repository.getById<DeviceMaterial>(T.device_materials, data.id) : undefined
    if (existing) {
      repository.update(T.device_materials, existing.id, { ...data, updated_at: nowIso() } as Record<string, unknown>)
      return repository.getById<DeviceMaterial>(T.device_materials, existing.id)!
    }
    const m: DeviceMaterial = {
      id: uid('dm'),
      product_id: data.product_id || '',
      category: data.category ?? 'other',
      name: data.name || '材料',
      unit: data.unit || '',
      quantity_per_point: data.quantity_per_point ?? 1,
      note: data.note,
      enabled: data.enabled ?? true,
    }
    repository.insert(T.device_materials, m)
    return m
  },
  removeMaterial(id: string) {
    repository.remove(T.device_materials, id)
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

/** 产品级搜索选项：点位"设备名称"选择器的数据源（产品名/族名/品牌/型号 均可检索） */
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
  /** 按系统过滤的产品选项（systemId 缺省 = 全部）。含启用型号的品牌/型号名，用于模糊搜索 */
  list(systemId?: string): ProductOption[] {
    const db = repository.db
    const catById = new Map((db[T.device_categories] ?? []).map((c) => [c.id, c as DeviceCategory]))
    const famById = new Map((db[T.product_families] ?? []).map((f) => [f.id, f as ProductFamily]))
    const brandNameById = new Map((db[T.brands] ?? []).map((b) => [b.id, (b as Brand).name]))
    const brandIdsByModel = new Map<string, string[]>()
    for (const mb of db[T.model_brands] ?? []) {
      const row = mb as ModelBrand
      const list = brandIdsByModel.get(row.model_id) ?? []
      list.push(row.brand_id)
      brandIdsByModel.set(row.model_id, list)
    }
    const modelsByProduct = new Map<string, ProductModel[]>()
    for (const m of db[T.product_models] ?? []) {
      const row = m as ProductModel
      const list = modelsByProduct.get(row.product_id) ?? []
      list.push(row)
      modelsByProduct.set(row.product_id, list)
    }
    const options: ProductOption[] = []
    for (const p of db[T.products] ?? []) {
      const prod = p as Product
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
      const name = prod.name
      const searchText = [name, family?.name, cat?.name, [...brandNames].join(' '), modelNames.join(' ')].filter(Boolean).join(' ')
      options.push({
        id: prod.id,
        name,
        familyName: family?.name,
        categoryName: cat?.name,
        systemId: sysId,
        unit,
        brandNames: [...brandNames],
        modelNames,
        searchText,
      })
    }
    return options.sort((a, b) => a.name.localeCompare(b.name))
  },

  /** 当前项目内最近使用的设备（按点位更新时间倒序去重），用于"最近使用"分组 */
  recentByProjectId(projectId: string, limit = 8): string[] {
    const db = repository.db
    const psOf = new Map((db[T.project_systems] ?? []).map((s) => [s.id, (s as ProjectSystem).project_id]))
    const byTime = new Map<string, number>()
    for (const p of db[T.points] ?? []) {
      const point = p as Point
      if (psOf.get(point.project_system_id) !== projectId || !point.device_id) continue
      const t = point.updated_at ? new Date(point.updated_at).getTime() : 0
      const prev = byTime.get(point.device_id) ?? 0
      if (t > prev) byTime.set(point.device_id, t)
    }
    // 无点位时兜底：项目选型记录也可能来自推导结果，但点位已覆盖主链路
    return [...byTime.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id)
  },

  /** 建筑 / 弱电间名称解析（供点位展示与导入匹配） */
  structureNamesOf(projectId: string): { buildingOf: Map<string, string>; telecomNameOf: Map<string, string> } {
    const db = repository.db
    const buildingOf = new Map<string, string>()
    for (const b of db[T.buildings] ?? []) {
      const row = b as { id: string; project_id: string; name: string }
      if (row.project_id === projectId) buildingOf.set(row.id, row.name)
    }
    const telecomNameOf = new Map<string, string>()
    for (const r of db[T.telecom_rooms] ?? []) {
      const row = r as TelecomRoom
      telecomNameOf.set(row.id, row.name)
    }
    return { buildingOf, telecomNameOf }
  },
}