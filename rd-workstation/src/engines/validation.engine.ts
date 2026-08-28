import type { DeviceSelection, Point, ProductModel } from '../types/domain'
import { T } from '../types/domain'
import type { EngineCtx } from './ctx'
import { DesignEngine } from './design.engine'
import { DEFAULT_RULES } from './default-rules'

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
    const hddTb = vars.hdd_count ? vars.hdd_count * DEFAULT_RULES.hddCapacityTb : 0
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