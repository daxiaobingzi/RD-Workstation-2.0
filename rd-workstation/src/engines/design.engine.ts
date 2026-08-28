import type { DesignResult, Point } from '../types/domain'
import { T } from '../types/domain'
import { uid } from '../lib/utils'
import { buildVars, type EngineCtx } from './ctx'
import { evalCondition, evalExpr } from './expr'

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