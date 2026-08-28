/**
 * RD Workstation 2.0 · Domain Engines（纯计算层）
 * 数据库存「事实」，Engine 算「应该多少」。所有派生计算集中于此，UI 禁止绕过。
 */
import type {
  BillItem, BillVersion, Budget, BudgetItem, DesignResult, DeviceSelection,
  Point, ProductModel, Task,
} from '../types/domain'
import { T } from '../types/domain'
import { uid } from '../lib/utils'

export type EngineCtx = {
  get: <T>(t: string) => T[]
}

/* ================= 轻量表达式求值：ceil(camera_count/24) 等 ================= */
const FUNCS: Record<string, (...a: number[]) => number> = {
  ceil: Math.ceil, floor: Math.floor, round: Math.round,
  max: Math.max, min: Math.min, abs: Math.abs, sqrt: Math.sqrt,
}

function tokenize(expr: string): string[] {
  const tokens: string[] = []
  let i = 0
  const src = expr.replace(/\s+/g, '')
  while (i < src.length) {
    const c = src[i]
    if (/[0-9.]/.test(c)) {
      let j = i
      while (j < src.length && /[0-9.]/.test(src[j])) j++
      tokens.push(src.slice(i, j)); i = j; continue
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i
      while (j < src.length && /[a-zA-Z0-9_]/.test(src[j])) j++
      tokens.push(src.slice(i, j)); i = j; continue
    }
    if ('+-*/%^(),'.includes(c)) { tokens.push(c); i++; continue }
    i++
  }
  return tokens
}

export function evalExpr(expr: string, vars: Record<string, number>): number {
  const toks = tokenize(expr)
  const out: (string | number)[] = []
  const ops: string[] = []
  const prec: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 3 }
  const applyOp = () => {
    const op = ops.pop()!
    if (op === ',') return
    if (op in FUNCS) {
      const args: number[] = []
      while (out.length && typeof out[out.length - 1] === 'number') args.unshift(out.pop() as number)
      out.push(FUNCS[op](...args))
      return
    }
    const b = out.pop() as number
    const a = out.pop() as number
    switch (op) {
      case '+': out.push(a + b); break
      case '-': out.push(a - b); break
      case '*': out.push(a * b); break
      case '/': out.push(a / b); break
      case '%': out.push(a % b); break
      case '^': out.push(Math.pow(a, b)); break
    }
  }
  for (const t of toks) {
    if (t === '(') { ops.push(t); continue }
    if (t === ')') {
      while (ops.length && ops[ops.length - 1] !== '(') applyOp()
      ops.pop()
      if (ops.length && ops[ops.length - 1] in FUNCS) applyOp()
      continue
    }
    if (t === ',') {
      while (ops.length && ops[ops.length - 1] !== '(') applyOp()
      continue
    }
    if (t in prec) {
      while (ops.length && ops[ops.length - 1] !== '(' && (prec[ops[ops.length - 1]] ?? 0) >= prec[t]) applyOp()
      ops.push(t); continue
    }
    if (/^-?\d+(\.\d+)?$/.test(t)) { out.push(parseFloat(t)); continue }
    if (t in vars) { out.push(vars[t]); continue }
    if (t in FUNCS) { ops.push(t); continue }
    out.push(0)
  }
  while (ops.length) applyOp()
  return out.length ? (out.pop() as number) : 0
}

/* ================= 变量表构建 ================= */
export function buildVars(ctx: EngineCtx, psId: string, points: Point[]): Record<string, number> {
  const vars: Record<string, number> = {}
  for (const p of ctx.get<{ project_system_id: string; parameter_key: string; value_json: unknown }>(T.design_parameters)) {
    if (p.project_system_id === psId && typeof p.value_json === 'number') {
      vars[p.parameter_key] = p.value_json
    }
  }
  vars.camera_count = points.reduce((s, p) => s + (p.quantity || 0), 0)
  // 按点位类别统计：cnt_<类别code>，供分类 / 条件规则使用
  const catById = new Map(ctx.get<{ id: string; code: string; name: string }>(T.point_categories).map((c) => [c.id, c]))
  for (const p of points) {
    const code = p.category_id ? catById.get(p.category_id)?.code : undefined
    if (!code) continue
    vars[`cnt_${code}`] = (vars[`cnt_${code}`] ?? 0) + (p.quantity || 0)
  }
  // 派生存储需求
  const bit = vars.bitrate_mbps ?? 4
  const days = vars.storage_days ?? 30
  vars.storage_tb = (vars.camera_count * bit * days * 86400) / 8 / 1024 ** 3
  return vars
}

/* ================= 条件规则求值：camera_count > 0 && cnt_indoor >= 12 ================= */
export function evalCondition(cond: string | undefined, vars: Record<string, number>): boolean {
  if (!cond || !cond.trim()) return true
  for (const raw of cond.split('&&')) {
    const m = raw.trim().match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*(>=|<=|!=|==|>|<)\s*([-0-9.]+)$/)
    if (!m) continue
    const left = vars[m[1]] ?? 0
    const right = parseFloat(m[3])
    const pass =
      m[2] === '>=' ? left >= right : m[2] === '<=' ? left <= right : m[2] === '!=' ? left !== right
        : m[2] === '==' ? left === right : m[2] === '>' ? left > right : left < right
    if (!pass) return false
  }
  return true
}

/* ================= DesignEngine：规则推导 → DesignResult ================= */
const RESULT_UNIT: Record<string, string> = {
  camera: '台', poe_switch: '台', nvr: '台', hdd: '块', aggregation: '台', mount: '套', cable: '箱',
}

export const DesignEngine = {
  run(ctx: EngineCtx, psId: string): { results: DesignResult[]; vars: Record<string, number> } {
    const ps = ctx.get<{ id: string; system_id: string }>(T.project_systems).find((s) => s.id === psId)
    const systemId = ps?.system_id
    const points = ctx.get<Point>(T.points).filter((p) => p.project_system_id === psId)
    const vars = buildVars(ctx, psId, points)
    const results: DesignResult[] = []
    const now = new Date().toISOString()

    // 摄像机汇总行：保证清单包含前端设备，数量 = 全部点位台数
    results.push({
      id: uid('dr'), project_system_id: psId,
      result_type: 'camera', source_type: 'point',
      quantity: vars.camera_count || 0, unit: '台',
      formula_snapshot: 'camera_count', rule_snapshot: 'R-CAM-CAM（汇总）',
      created_at: now,
    })

    const rules = ctx
      .get<{ system_id?: string; formula_json: string; code: string; target_type: string; name: string; source_type?: string; priority?: number; enabled?: boolean; condition_json?: string }>(T.design_rules)
      .filter((r) => r.enabled !== false && r.system_id === systemId)
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
    for (const rule of rules) {
      if (rule.target_type === 'camera') continue // 摄像机由汇总行生成
      if (!evalCondition(rule.condition_json, vars)) continue
      const qty = evalExpr(rule.formula_json, vars)
      results.push({
        id: uid('dr'),
        project_system_id: psId,
        result_type: rule.target_type,
        source_type: rule.source_type ?? 'camera',
        quantity: qty,
        unit: RESULT_UNIT[rule.target_type] ?? '台',
        formula_snapshot: rule.formula_json,
        rule_snapshot: rule.code,
        created_at: now,
      })
      // 反馈回变量，支持级联规则
      if (rule.target_type === 'poe_switch') vars.poe_count = qty
      if (rule.target_type === 'nvr') vars.nvr_count = qty
      if (rule.target_type === 'hdd') vars.hdd_count = qty
      if (rule.target_type === 'aggregation') vars.agg_count = qty
    }
    return { results, vars }
  },
}

/* ================= PricingEngine：价格 ================= */
export const PricingEngine = {
  /** 取型号参考价（优先 reference，其次最新有效价） */
  getPrice(ctx: EngineCtx, modelId: string): number {
    const prices = ctx
      .get<{ model_id: string; price_type: string; price: number }>(T.prices)
      .filter((p) => p.model_id === modelId)
    if (!prices.length) return 0
    const ref = prices.find((p) => p.price_type === 'reference')
    return ref ? ref.price : prices[prices.length - 1].price
  },
}

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

/* ================= BillEngine：清单（版本化） ================= */
export const BillEngine = {
  generate(ctx: EngineCtx, psId: string, projectId: string): { version: BillVersion; items: BillItem[] } {
    const now = new Date().toISOString()
    const versions = ctx.get<BillVersion>(T.bill_versions).filter((v) => v.project_id === projectId)
    const versionNo = `V${versions.length + 1}`
    const version: BillVersion = {
      id: uid('bv'), project_id: projectId, version_no: versionNo, name: `清单 ${versionNo}`,
      source: 'engine', status: 'draft', created_at: now, updated_at: now,
    }
    const models = ctx.get<ProductModel>(T.product_models)
    const familyName = new Map(ctx.get<{ id: string; name: string }>(T.product_families).map((f) => [f.id, f.name]))
    const productOfModel = new Map(ctx.get<{ id: string; product_family_id: string; name: string }>(T.products).map((p) => [p.id, p]))
    const items: BillItem[] = ctx
      .get<DeviceSelection>(T.device_selections)
      .filter((s) => s.project_system_id === psId)
      .map((s, i) => {
        const model = models.find((m) => m.id === s.model_id)
        const famId = model ? productOfModel.get(model.product_id)?.product_family_id : undefined
        return {
          id: uid('bi'),
          bill_version_id: version.id,
          project_system_id: psId,
          device_model_id: s.model_id,
          item_code: `BI-${String(i + 1).padStart(3, '0')}`,
          item_name: model ? model.model : s.model_id,
          specification: model?.specification,
          unit: s.unit,
          quantity: s.quantity,
          unit_price: s.unit_price,
          amount: s.total_price,
          category: famId ? (familyName.get(famId) ?? s.remark ?? '推导设备') : (s.remark ?? '推导设备'),
          source_type: 'selection',
          source_id: s.id,
          sort_order: i,
        }
      })
    return { version, items }
  },
}

/* ================= BudgetEngine：预算 ================= */
export const BudgetEngine = {
  generate(ctx: EngineCtx, psId: string, projectId: string, billVersionId: string): { budget: Budget; items: BudgetItem[] } {
    const billItems = ctx.get<BillItem>(T.bill_items).filter((i) => i.bill_version_id === billVersionId)
    const total = billItems.reduce((s, i) => s + (i.amount || 0), 0)
    const budget: Budget = {
      id: uid('bud'),
      project_id: projectId,
      bill_version_id: billVersionId,
      budget_type: 'system',
      total_amount: total,
      status: 'draft',
      created_at: new Date().toISOString(),
    }
    const items: BudgetItem[] = billItems.map((i) => ({
      id: uid('bui'),
      budget_id: budget.id,
      project_system_id: psId,
      bill_item_id: i.id,
      quantity: i.quantity,
      unit_price: i.unit_price,
      amount: i.amount,
    }))
    return { budget, items }
  },
}

/* ================= ValidationEngine：确定性校核 ================= */
export interface CheckResult {
  type: string
  severity: 'ok' | 'warn' | 'danger'
  message: string
  entity?: string
}

export const ValidationEngine = {
  check(ctx: EngineCtx, psId: string): CheckResult[] {
    const checks: CheckResult[] = []
    const points = ctx.get<Point>(T.points).filter((p) => p.project_system_id === psId)
    const selections = ctx.get<DeviceSelection>(T.device_selections).filter((s) => s.project_system_id === psId)
    const models = ctx.get<ProductModel>(T.product_models)
    const { vars } = DesignEngine.run(ctx, psId)

    // 缺设备：点位 → 推导应有选型
    if (!selections.length) {
      checks.push({ type: 'missing_device', severity: 'danger', message: '尚无设备选型，请先生成推导结果' })
    }
    // 缺价
    const missing = selections.filter((s) => !s.unit_price || s.unit_price <= 0)
    if (missing.length) {
      checks.push({ type: 'missing_price', severity: 'warn', message: `${missing.length} 项设备缺价格`, entity: missing[0].model_id })
    } else if (selections.length) {
      checks.push({ type: 'missing_price', severity: 'ok', message: '设备价格完整' })
    }
    // 存储容量
    const hddTb = vars.hdd_count ? vars.hdd_count * 8 : 0
    if (vars.storage_tb > 0 && hddTb < vars.storage_tb) {
      checks.push({ type: 'storage', severity: 'danger', message: `存储容量不足：需求 ${vars.storage_tb.toFixed(1)}TB，硬盘提供 ${hddTb.toFixed(1)}TB` })
    } else if (vars.storage_tb > 0) {
      checks.push({ type: 'storage', severity: 'ok', message: `存储容量满足：${hddTb.toFixed(1)}TB ≥ ${vars.storage_tb.toFixed(1)}TB` })
    }
    // 点位为空
    if (!points.length) {
      checks.push({ type: 'no_point', severity: 'warn', message: '尚未录入摄像机点位' })
    } else {
      checks.push({ type: 'no_point', severity: 'ok', message: `点位已录入：${vars.camera_count} 台` })
    }
    // 摄像机选型缺失（推导增强后应有前端选型）
    const cameraSels = selections.filter((s) => {
      const m = models.find((x) => x.id === s.model_id)
      return m && ctx.get<{ id: string; product_family_id: string }>(T.products).find((p) => p.id === m.product_id)?.product_family_id === 'pf_cam'
    })
    if (points.length && !cameraSels.length) {
      checks.push({ type: 'missing_camera', severity: 'danger', message: '点位已录入但无摄像机选型，请重新推导' })
    } else if (cameraSels.length) {
      checks.push({ type: 'missing_camera', severity: 'ok', message: `摄像机选型：${cameraSels.length} 类${cameraSels.reduce((s, x) => s + x.quantity, 0)} 台` })
    }
    // 点位类别覆盖
    const catById = new Map(ctx.get<{ id: string; code: string; name: string }>(T.point_categories).map((c) => [c.id, c]))
    const uncategorized = points.filter((p) => !p.category_id || !catById.has(p.category_id))
    if (uncategorized.length) {
      checks.push({ type: 'category_coverage', severity: 'warn', message: `${uncategorized.length} 个点位未归类，将按默认产品选型` })
    }
    // 型号停用
    const disabledModels = new Set(models.filter((m) => m.status === 'disabled').map((m) => m.id))
    const usedDisabled = selections.filter((s) => disabledModels.has(s.model_id))
    if (usedDisabled.length) {
      checks.push({ type: 'disabled_model', severity: 'danger', message: `使用了 ${usedDisabled.length} 个已停用型号` })
    }
    return checks
  },
}

/* ================= GoalEngine：目标自动计算 ================= */
export const GoalEngine = {
  /** source_query: completed_projects / active_projects / knowledge_count … */
  compute(ctx: EngineCtx, sourceQuery: string): number {
    switch (sourceQuery) {
      case 'completed_projects':
        return ctx.get<{ status: string }>(T.projects).filter((p) => p.status === 'completed').length
      case 'active_projects':
        return ctx.get<{ status: string }>(T.projects).filter((p) => p.status === 'designing' || p.status === 'reviewing').length
      case 'knowledge_count':
        return ctx.get(T.knowledge_items).length
      case 'habit_completion': {
        const recs = ctx.get<{ completed: boolean }>(T.habit_records)
        return recs.length ? Math.round((recs.filter((r) => r.completed).length / recs.length) * 100) : 0
      }
      default:
        return 0
    }
  },
}

/* ================= SchedulingEngine：排程建议 ================= */
export const SchedulingEngine = {
  assess(tasks: Task[], now = Date.now()): { overdue: Task[]; today: Task[]; risk: Task[] } {
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(dayStart.getTime() + 86400000)
    const overdue: Task[] = []
    const today: Task[] = []
    const risk: Task[] = []
    for (const t of tasks) {
      if (t.status === 'done' || t.status === 'blocked') continue
      const due = t.due_at ? new Date(t.due_at).getTime() : null
      if (due === null) continue
      if (due < now) overdue.push(t)
      else if (due <= todayEnd.getTime()) today.push(t)
      else if (due < now + 3 * 86400000) risk.push(t)
    }
    return { overdue, today, risk }
  },
}
