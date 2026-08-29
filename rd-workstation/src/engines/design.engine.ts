import type { DesignResult, Point, DeviceMaterial, Product } from '../types/domain'
import { T } from '../types/domain'
import { uid } from '../lib/utils'
import { buildVars, type EngineCtx } from './ctx'
import { evalCondition, evalExpr } from './expr'
import { deviceKindOf } from './selection.engine'

/** 设备类型上的数量推导链配置（Product.chain_json） */
export interface DeviceChain {
  mode: 'carry' | 'mul' | 'fixed'
  capacity: number
  source?: 'front' | string // 承接来源：front=全部前端点位合计 | 指定设备类型 id
  factor?: number
  reserve?: number
  round?: 'ceil' | 'floor'
}

function ensureChain(json?: string): DeviceChain | null {
  if (!json) return null
  try {
    const c = JSON.parse(json) as Partial<DeviceChain>
    if (!c.mode) return null
    return {
      mode: c.mode, capacity: Math.max(1, Number(c.capacity) || 1),
      source: c.source, factor: c.factor == null ? 1 : Number(c.factor),
      reserve: Number(c.reserve) || 0, round: c.round || 'ceil',
    }
  } catch {
    return null
  }
}

/* ================= DesignEngine：规则推导 → DesignResult ================= */
const RESULT_UNIT: Record<string, string> = {
  camera: '台', poe_switch: '台', nvr: '台', hdd: '块', aggregation: '台', mount: '套', cable: '箱',
}

/** 材料类别 → 结果类型（工程量/清单口径） */
const MATERIAL_RESULT_TYPE: Record<string, string> = {
  cable: 'cable', conduit: 'conduit', aux: 'aux', other: 'other_material',
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

    // P4：单点定额材料推导 —— 按点位设备 × 定额材料（device_materials）生成线缆/管材/辅材
    const materialResults = this.deriveMaterials(ctx, psId, points)
    results.push(...materialResults)

    // 设备链优先：设备类型（chain_json）按承接关系推导数量，结果并入结果集
    const chainResults = this.deriveDeviceChains(ctx, psId, systemId, vars, now)
    results.push(...chainResults)
    const chainKinds = new Set(chainResults.map((r) => r.result_type))

    const rules = ctx
      .get<{ system_id?: string; formula_json: string; code: string; target_type: string; name: string; source_type?: string; priority?: number; enabled?: boolean; condition_json?: string }>(T.design_rules)
      .filter((r) => r.enabled !== false && r.system_id === systemId)
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
    for (const rule of rules) {
      if (rule.target_type === 'camera') continue // 摄像机由汇总行生成
      if (chainKinds.has(rule.target_type)) continue // 该目标已被设备链覆盖（设备链优先）
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

  /** 设备链推导：设备类型按 chain_json 沿承接关系计算数量（前端点位合计 → 后端承载链） */
  deriveDeviceChains(ctx: EngineCtx, psId: string, systemId: string | undefined, vars: Record<string, number>, now: string): DesignResult[] {
    const chainDevices = ctx.get<Product>(T.products).filter((p) => p.system_id === systemId && p.chain_json)
    if (!chainDevices.length) return []
    const frontTotal = vars.camera_count || 0
    const qtyBy = new Map<string, number>()
    const results: DesignResult[] = []
    const pend = chainDevices.slice()
    let guard = 0
    while (pend.length && guard++ < 40) {
      let progressed = false
      for (let i = pend.length - 1; i >= 0; i--) {
        const p = pend[i]
        const c = ensureChain(p.chain_json)
        if (!c) { pend.splice(i, 1); continue }
        if (c.mode !== 'fixed' && c.source && c.source !== 'front' && !qtyBy.has(c.source)) continue // 来源设备未就绪，等待
        pend.splice(i, 1); progressed = true
        let qty: number
        if (c.mode === 'fixed') {
          qty = c.capacity
        } else {
          const base = !c.source || c.source === 'front' ? frontTotal : (qtyBy.get(c.source) ?? 0)
          qty = c.mode === 'mul'
            ? Math.round(base * c.capacity * (c.factor ?? 1))
            : Math.ceil(base / c.capacity * (c.factor ?? 1)) + (c.reserve ?? 0)
        }
        qty = Math.max(0, qty)
        qtyBy.set(p.id, qty)
        const kind = deviceKindOf(p)
        if (!kind) continue
        results.push({
          id: uid('dr'), project_system_id: psId,
          result_type: kind, source_type: 'chain', quantity: qty,
          unit: RESULT_UNIT[kind] ?? '台',
          formula_snapshot: c.mode === 'fixed'
            ? `固定 ${c.capacity}`
            : `${c.source === 'front' ? '前端合计' : '承接设备'}${c.factor !== 1 ? ` × ${c.factor}` : ''} / ${c.capacity}`,
          rule_snapshot: `链-${p.name}`,
          created_at: now,
        })
      }
      if (!progressed) { // 循环依赖兜底
        pend.forEach((p) => qtyBy.set(p.id, 0))
        pend.length = 0
      }
    }
    return results
  },

  /** P4：设备单点定额材料 → 材料推导结果（∑点位数量 × 每点定额） */
  deriveMaterials(ctx: EngineCtx, psId: string, points: Point[]): DesignResult[] {
    const now = new Date().toISOString()
    const deviceQty = new Map<string, number>()
    for (const p of points) {
      if (!p.device_id) continue
      deviceQty.set(p.device_id, (deviceQty.get(p.device_id) ?? 0) + (p.quantity || 0))
    }
    if (!deviceQty.size) return []

    const materials = ctx.get<DeviceMaterial>(T.device_materials).filter((m) => m.enabled !== false)
    const agg = new Map<string, { qty: number; unit: string }>()
    for (const m of materials) {
      const total = (deviceQty.get(m.product_id) ?? 0) * (m.quantity_per_point || 0)
      if (total <= 0) continue
      const key = `${m.category}|${m.name}|${m.unit}`
      const prev = agg.get(key)
      if (prev) prev.qty += total
      else agg.set(key, { qty: total, unit: m.unit || '' })
    }
    return [...agg.entries()].map(([key, v]) => {
      const [cat, name, unit] = key.split('|')
      return {
        id: uid('dr'),
        project_system_id: psId,
        result_type: MATERIAL_RESULT_TYPE[cat] ?? 'other_material',
        source_type: 'quota',
        source_id: undefined,
        quantity: Math.round(v.qty * 100) / 100,
        unit,
        formula_snapshot: `∑点位台数 × 单点定额（${name}）`,
        rule_snapshot: `定额-${name}`,
        created_at: now,
      }
    })
  },
}