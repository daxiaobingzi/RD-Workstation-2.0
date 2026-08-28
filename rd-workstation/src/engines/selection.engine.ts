import type { DesignResult, DeviceSelection, Point, ProductModel } from '../types/domain'
import { T } from '../types/domain'
import { uid } from '../lib/utils'
import type { EngineCtx } from './ctx'
import { PricingEngine } from './pricing.engine'

/* ================= SelectionEngine：按档次选型号 ================= */
export type DeviceKind = 'camera' | 'poe_switch' | 'nvr' | 'hdd' | 'aggregation' | 'mount' | 'cable' | 'aux'

const KIND_TO_FAMILY: Record<string, string> = {
  camera: 'pf_cam', poe_switch: 'pf_poe', nvr: 'pf_nvr', hdd: 'pf_hdd', aggregation: 'pf_agg', mount: 'pf_mount', cable: 'pf_cable',
}

/** 点位类别（code）→ 摄像机产品偏好（室内/电梯半球，出入口/车道枪机，室外周界球机） */
const CATEGORY_PRODUCT: Record<string, string> = {
  indoor: 'prod_dome',
  elevator: 'prod_dome',
  entrance: 'prod_bullet',
  outdoor: 'prod_ptz',
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

  /** 为某设备类型 + 档次挑一个型号：激活型号中，绑定表优先，兜底型号 grade_code */
  pickModel(ctx: EngineCtx, kind: DeviceKind, grade: string): ProductModel | undefined {
    const famId = KIND_TO_FAMILY[kind]
    if (!famId) return undefined
    const fams = ctx.get<{ id: string; device_category_id: string }>(T.product_families).filter((f) => f.id === famId)
    if (!fams.length) return undefined
    const familyIds = new Set(fams.map((f) => f.id))
    const active = ctx
      .get<ProductModel>(T.product_models)
      .filter((m) => m.status !== 'disabled') // 停用型号不得参加选型
    const models = active.filter((m) => m.product_id && ctx.get<{ id: string; product_family_id: string }>(T.products).find((p) => p.id === m.product_id && familyIds.has(p.product_family_id)))
    const gradeId = this.gradeIdByCode(ctx, grade)
    const bound = models.filter((m) => this.isBoundToGrade(ctx, m.id, gradeId))
    const pool = bound.length ? bound : (models.filter((m) => m.grade_code === grade).length ? models.filter((m) => m.grade_code === grade) : models)
    return pool.length ? pool[0] : undefined
  },

  /** 按具体产品选型号（同一产品族内的分化，如半球 / 枪机 / 球机） */
  pickModelByProduct(ctx: EngineCtx, productId: string, grade: string): ProductModel | undefined {
    const models = ctx
      .get<ProductModel>(T.product_models)
      .filter((m) => m.product_id === productId && m.status !== 'disabled') // 停用型号不得参加选型
    if (!models.length) return undefined
    const gradeId = this.gradeIdByCode(ctx, grade)
    const bound = models.filter((m) => this.isBoundToGrade(ctx, m.id, gradeId))
    const pool = bound.length ? bound : (models.filter((m) => m.grade_code === grade).length ? models.filter((m) => m.grade_code === grade) : models)
    return pool[0]
  },

  /** 为项目系统 + 推导结果生成 DeviceSelection 列表（价格快照） */
  deriveSelections(ctx: EngineCtx, psId: string, grade: string, results: DesignResult[]): DeviceSelection[] {
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

    for (const r of results) {
      const kind = r.result_type as DeviceKind
      if (kind === 'camera') {
        // 摄像机按「点位类别 → 产品」拆分选型，模拟真实分布选型
        const points = ctx.get<Point>(T.points).filter((p) => p.project_system_id === psId)
        const catById = new Map(ctx.get<{ id: string; code: string; name: string }>(T.point_categories).map((c) => [c.id, c]))
        const groups = new Map<string, Point[]>()
        for (const p of points) {
          const key = p.category_id ?? '__none__'
          if (!groups.has(key)) groups.set(key, [])
          groups.get(key)!.push(p)
        }
        for (const [catId, pts] of groups) {
          const cat = catById.get(catId)
          const productId = cat ? CATEGORY_PRODUCT[cat.code] : undefined
          const model = productId
            ? this.pickModelByProduct(ctx, productId, grade)
            : this.pickModel(ctx, 'camera', grade)
          if (!model) continue
          const qty = pts.reduce((s, p) => s + (p.quantity || 0), 0)
          push(model, qty, `规则 ${r.rule_snapshot} 推导`, cat?.name ?? '未分类')
        }
        continue
      }
      const model = this.pickModel(ctx, kind, grade)
      if (!model) continue
      push(model, r.quantity, `规则 ${r.rule_snapshot} 推导`)
    }
    return selections
  },
}