import { repository } from '../db/memory-db'
import { T } from '../types/domain'
import type { DesignResult, DeviceSelection, ProductModel, ProjectSystem, Brand } from '../types/domain'
import { DesignEngine, SelectionEngine, ValidationEngine } from '../engines'
import ctx from './ctx'
import { PointService } from './point.service'
import { TopologyService } from './topology.service'

/* ---------- 设计链 Service：推导 → 选型 → 结果 ---------- */
export const DesignService = {
  /** 跑 DesignEngine，写 design_results + 生成 device_selections（按项目系统档次 + 可选选型方案） */
  derive(psId: string, schemeId?: string) {
    const db = repository.db
    const ps = db[T.project_systems].find((r) => (r as ProjectSystem).id === psId) as ProjectSystem | undefined
    const grade = ps?.design_grade ?? 'standard'
    const { results } = DesignEngine.run(ctx, psId)
    const oldResults = db[T.design_results] ?? []
    repository.replace(
      T.design_results,
      oldResults.filter((r) => (r as DesignResult).project_system_id !== psId).concat(results),
    )
    // P5：默认取系统锁定的选型方案；未传则用系统默认方案
    const effectiveSchemeId = schemeId ?? repository.getById<{ selection_scheme_id?: string }>(T.project_systems, psId)?.selection_scheme_id
    const selections = SelectionEngine.deriveSelections(ctx, psId, grade, results, effectiveSchemeId)
    const oldSelections = db[T.device_selections] ?? []
    repository.replace(
      T.device_selections,
      oldSelections.filter((r) => (r as DeviceSelection).project_system_id !== psId).concat(selections),
    )
    // P6：推导后自动重建/同步拓扑（无节点则生成，有则同步数量、保留手动布局）
    if (TopologyService.nodes(psId).length) TopologyService.syncFromResults(psId, results)
    else TopologyService.rebuildFromResults(psId, results)
    return { results, selections, schemeId: effectiveSchemeId }
  },

  /** 为项目系统选定选型方案（落库） */
  setScheme(psId: string, schemeId: string | undefined) {
    repository.update(T.project_systems, psId, { selection_scheme_id: schemeId, updated_at: new Date().toISOString() })
  },

  results(psId: string): DesignResult[] {
    return repository.where<DesignResult>(T.design_results, (r) => r.project_system_id === psId)
  },

  selections(psId: string): (DeviceSelection & { modelName?: string; spec?: string; brand?: string })[] {
    const all = repository.getTable<DeviceSelection>(T.device_selections)
    const modelMap = new Map(repository.getTable<ProductModel>(T.product_models).map((m) => [m.id, m]))
    const brandMap = new Map(
      repository
        .getTable<{ model_id: string; brand_id: string }>(T.model_brands)
        .map((mb) => [mb.model_id, mb.brand_id]),
    )
    const brandName = new Map(repository.getTable<Brand>(T.brands).map((b) => [b.id, b.name]))
    return all
      .filter((s) => s.project_system_id === psId)
      .map((s) => {
        const m = modelMap.get(s.model_id)
        const bid = brandMap.get(s.model_id)
        return { ...s, modelName: m?.model, spec: m?.specification, brand: bid ? brandName.get(bid) : undefined }
      })
  },

  check(psId: string) {
    return ValidationEngine.check(ctx, psId)
  },

  /** 项目系统进度估算：从点位/推导/清单三环节加权 */
  progress(psId: string): number {
    const pts = PointService.list(psId).length
    const results = this.results(psId).length
    const selections = this.selections(psId).length
    const score = (pts > 0 ? 0.4 : 0) + (results > 0 ? 0.3 : 0) + (selections > 0 ? 0.3 : 0)
    return Math.round(score * 100)
  },
}