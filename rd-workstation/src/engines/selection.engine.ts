import type { DesignResult, DeviceSelection, SchemeRule, Point, ProductModel, Product } from '../types/domain'
import { T } from '../types/domain'
import { uid } from '../lib/utils'
import type { EngineCtx } from './ctx'
import { PricingEngine } from './pricing.engine'

/* ================= SelectionEngine：按设备类型选择品牌型号配置行 =================
 * 顶层模型：点位"设备名称" → 设备类型（Product）→ 其下激活配置行，按 档次 + 选型方案 取一。 */
export type DeviceKind = 'camera' | 'poe_switch' | 'nvr' | 'hdd' | 'aggregation' | 'mount' | 'cable' | 'aux' | 'conduit' | 'other_material'

/** 材料类结果（cable/conduit/aux/other_material）不进设备选型，仅作为工程量/清单材料行 */
const MATERIAL_KINDS = new Set<DeviceKind>(['cable', 'conduit', 'aux', 'other_material'])

/** 设备类型 → 选型类别（kind）：用于承接推导结果与选型方案规则（过渡映射，新设备类型无匹配时返回 undefined 不参与选型） */
export function deviceKindOf(p: Product): DeviceKind | undefined {
  const n = p.name ?? ''
  if (n.includes('摄像机')) return 'camera'
  if (n.includes('支架')) return 'mount'
  if (n.toUpperCase().includes('NVR')) return 'nvr'
  if (n.includes('硬盘')) return 'hdd'
  if (n.includes('POE')) return 'poe_switch'
  if (n.includes('汇聚') || n.includes('核心')) return 'aggregation'
  if (n.includes('网线') || n.includes('线缆') || n.includes('线槽')) return 'cable'
  return undefined
}

export const SelectionEngine = {
  /** 档次 code → 档次记录（model_grade_bindings 以 grade_id 关联） */
  gradeIdByCode(ctx: EngineCtx, grade: string): string | undefined {
    return ctx.get<{ code: string; id: string }>(T.grades).find((g) => g.code === grade)?.id
  },

  /** 型号是否在绑定表中挂到某档（优先依据，其次兜底 grade_code） */
  isBoundToGrade(ctx: EngineCtx, modelId: string, gradeId: string | undefined): boolean {
    if (!gradeId) return false
    return ctx.get<{ model_id: string; grade_id: string }>(T.model_grade_bindings).some((b) => b.model_id === modelId && b.grade_id === gradeId)
  },

  /** 从型号池按方案规则优先选择（品牌/档次/关键词/低价），否则按绑定→grade 兜底 */
  pickFromPool(ctx: EngineCtx, models: ProductModel[], grade: string, rule?: SchemeRule): ProductModel | undefined {
    if (!models.length) return undefined
    const gradeId = this.gradeIdByCode(ctx, grade)
    if (rule) {
      const ruleGrade = rule.grade_code ?? grade
      const ruleGradeId = this.gradeIdByCode(ctx, ruleGrade)
      // 规则过滤池：品牌 → 档次 → 关键词
      let pool = models
      if (rule.brand_id) {
        const brandOf = new Set(
          ctx.get<{ model_id: string; brand_id: string }>(T.model_brands)
            .filter((mb) => mb.brand_id === rule.brand_id).map((mb) => mb.model_id),
        )
        const byBrand = pool.filter((m) => brandOf.has(m.id))
        if (byBrand.length) pool = byBrand
      }
      if (ruleGradeId) {
        const byGrade = pool.filter((m) => this.isBoundToGrade(ctx, m.id, ruleGradeId) || m.grade_code === ruleGrade)
        if (byGrade.length) pool = byGrade
      }
      if (rule.model_keyword?.trim()) {
        const kw = rule.model_keyword.trim().toLowerCase()
        const byKw = pool.filter((m) => [m.model, m.specification].join(' ').toLowerCase().includes(kw))
        if (byKw.length) pool = byKw
      }
      if (rule.prefer_lowest_price && pool.length > 1) {
        return [...pool].sort((a, b) => PricingEngine.getPrice(ctx, a.id) - PricingEngine.getPrice(ctx, b.id))[0]
      }
      return pool.length ? pool[0] : undefined
    }
    const bound = models.filter((m) => this.isBoundToGrade(ctx, m.id, gradeId))
    const pool = bound.length ? bound : (models.filter((m) => m.grade_code === grade).length ? models.filter((m) => m.grade_code === grade) : models)
    return pool[0]
  },

  /** 为项目系统 + 推导结果生成 DeviceSelection 列表（价格快照）。
   *  顶层模型：每个"设备类型"（推导结果匹配的 kind）选一条配置行；
   *  前端设备类型（点位"设备名称"）数量 = 点位合计，后端设备类型数量 = 推导 result 数量。 */
  deriveSelections(ctx: EngineCtx, psId: string, grade: string, results: DesignResult[], schemeId?: string): DeviceSelection[] {
    const dbLike = ctx.get
    const selections: DeviceSelection[] = []
    const push = (model: ProductModel, quantity: number, reason: string, categoryLabel?: string) => {
      const unitPrice = PricingEngine.getPrice(ctx, model.id)
      selections.push({
        id: uid('sel'), project_system_id: psId, model_id: model.id,
        selection_source: 'engine', selection_reason: reason, grade_code: grade,
        quantity, unit: model.unit ?? '台', unit_price: unitPrice, total_price: unitPrice * quantity,
        status: 'selected', remark: categoryLabel,
      })
    }

    const products = dbLike<Product>(T.products)
    const kindOfProduct = new Map(products.map((p) => [p.id, deviceKindOf(p)]))
    const productName = new Map(products.map((p) => [p.id, p.name]))
    // 推导所属子系统：设备选型仅命中同子系统内的设备类型（避免跨系统误选）
    const ps = dbLike<{ id: string; system_id: string }>(T.project_systems).find((x) => x.id === psId)
    const systemId = ps?.system_id
    // 点位按设备类型分组（前端点位；demo 中即摄像机类）
    const pointsByDevice = new Map<string, Point[]>()
    for (const p of dbLike<Point>(T.points).filter((p) => p.project_system_id === psId)) {
      if (!p.device_id) continue
      const list = pointsByDevice.get(p.device_id) ?? []
      list.push(p)
      pointsByDevice.set(p.device_id, list)
    }
    const allModels = dbLike<ProductModel>(T.product_models)

    for (const r of results) {
      const kind = r.result_type as DeviceKind
      if (MATERIAL_KINDS.has(kind)) continue
      // 该推导结果对应的设备类型集合（限同子系统）
      const targets = products.filter((p) => kindOfProduct.get(p.id) === kind && (systemId ? p.system_id === systemId : true))
      if (!targets.length) continue
      const rule = schemeId
        ? dbLike<SchemeRule>(T.scheme_rules).find((x) => x.scheme_id === schemeId && x.kind === kind && x.enabled !== false)
        : undefined
      for (const pt of targets) {
        const models = allModels.filter((m) => m.product_id === pt.id && m.status !== 'disabled')
        if (!models.length) continue
        const model = this.pickFromPool(ctx, models, grade, rule)
        if (!model) continue
        const pts = pointsByDevice.get(pt.id)
        const qty = pts ? pts.reduce((s, p) => s + (p.quantity || 0), 0) : r.quantity
        if (!qty) continue
        push(model, qty, `规则 ${r.rule_snapshot} 推导${schemeId ? '（方案选型）' : ''}`, productName.get(pt.id) ?? pt.name)
      }
    }
    return selections
  },
}