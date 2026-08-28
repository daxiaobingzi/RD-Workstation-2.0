import type { Point } from '../types/domain'
import { T } from '../types/domain'
import { DEFAULT_RULES } from './default-rules'

export type EngineCtx = {
  get: <T>(t: string) => T[]
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
  const bit = vars.bitrate_mbps ?? DEFAULT_RULES.bitrateMbps
  const days = vars.storage_days ?? DEFAULT_RULES.storageDays
  vars.storage_tb = (vars.camera_count * bit * days * 86400) / 8 / 1024 ** 3
  return vars
}