import { repository } from '../db/memory-db'
import { T } from '../types/domain'
import type { DesignResult, DeviceSelection, ProductModel, ProjectSystem, Brand, DesignRule } from '../types/domain'
import { DesignEngine, SelectionEngine, ValidationEngine } from '../engines'
import ctx from './ctx'
import { PointService } from './point.service'
import { TopologyService } from './topology.service'
import { ProjectService } from './project.service'
import { uid } from '../lib/utils'

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

  /**
   * 智能选型：按档次重算单个子系统的设备选型并落库（清旧写新 + 同步系统档位）。
   * 用于预算页"经济/标准/高端"一键切换；选型→清单→预算自动联动。
   */
  applyGrade(psId: string, grade: string): DeviceSelection[] {
    const results = this.results(psId)
    const selections = SelectionEngine.deriveSelections(ctx, psId, grade, results)
    const db = repository.db
    const old = db[T.device_selections] ?? []
    repository.replace(
      T.device_selections,
      old.filter((r) => (r as DeviceSelection).project_system_id !== psId).concat(selections),
    )
    repository.update(T.project_systems, psId, { design_grade: grade, updated_at: new Date().toISOString() })
    return selections
  },

  /** 项目级智能选型：遍历所有子系统换档，返回涉及的子系统数 */
  applyGradeToProject(projectId: string, grade: string): number {
    const systems = ProjectService.systems(projectId)
    for (const ps of systems) this.applyGrade(ps.id, grade)
    return systems.length
  },

  /** 预算清单·实时行内调整：写 device_selections 单行数量/单价（总价重算，换档丢失属推导语义） */
  updateSelection(id: string, patch: { quantity?: number; unit_price?: number }) {
    const s = repository.getById<DeviceSelection>(T.device_selections, id)
    if (!s) return
    const quantity = patch.quantity ?? s.quantity
    const unitPrice = patch.unit_price ?? s.unit_price
    repository.update(T.device_selections, id, {
      quantity,
      unit_price: unitPrice,
      total_price: quantity * unitPrice,
    })
  },
  /** 预算清单·实时删除选型行（重新生成清单时该行将不再出现） */
  removeSelection(id: string) {
    repository.remove(T.device_selections, id)
  },

  results(psId: string): DesignResult[] {
    return repository.where<DesignResult>(T.design_results, (r) => r.project_system_id === psId)
  },

  /* ---------- 推导规则自定义（v2 规则编辑器）：写入 design_rules（system_id 级，推导引擎按优先级执行） ---------- */
  /** 某项目系统生效规则（本项目使用） */
  rules(psId: string): DesignRule[] {
    const ps = repository.getById<ProjectSystem>(T.project_systems, psId)
    return repository
      .getTable<DesignRule>(T.design_rules)
      .filter((r) => r.enabled !== false && (!r.system_id || r.system_id === ps?.system_id))
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
  },
  /** 标准系统全部规则（含停用，供编辑器管理） */
  listRulesBySystem(systemId?: string): DesignRule[] {
    return repository
      .getTable<DesignRule>(T.design_rules)
      .filter((r) => (systemId ? r.system_id === systemId : true))
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
  },
  /** 新增规则（formula_json 为 evalExpr 表达式；target_type 与设备 kind 对齐来驱动选型/清单） */
  addRule(data: Partial<DesignRule>): DesignRule {
    const maxCode = repository
      .getTable<DesignRule>(T.design_rules)
      .filter((r) => r.system_id === data.system_id)
      .reduce((m, r) => Math.max(m, Number((r.code ?? 'R0').replace(/\D/g, '')) || 0), 0)
    const rule: DesignRule = {
      id: uid('rule'),
      system_id: data.system_id,
      code: `R-${(maxCode + 1).toString().padStart(3, '0')}`,
      name: data.name || '未命名规则',
      description: data.description,
      rule_type: data.rule_type ?? 'derive',
      source_type: data.source_type,
      target_type: data.target_type || 'device',
      condition_json: data.condition_json,
      formula_json: data.formula_json || 'camera_count',
      priority: data.priority ?? 10,
      version: '1.0',
      enabled: data.enabled ?? true,
    }
    repository.insert(T.design_rules, rule)
    return rule
  },
  updateRule(id: string, patch: Partial<DesignRule>) {
    repository.update(T.design_rules, id, patch)
  },
  removeRule(id: string) {
    repository.remove(T.design_rules, id)
  },

  selections(psId: string): (DeviceSelection & { modelName?: string; deviceName?: string; deviceCategory?: string; spec?: string; detail?: string; brand?: string })[] {
    const all = repository.getTable<DeviceSelection>(T.device_selections)
    const modelMap = new Map(repository.getTable<ProductModel>(T.product_models).map((m) => [m.id, m]))
    // 设备名称/类别：型号 → 产品（设备类型）名 + 产品类别（front/back/cable/aux 等五区分组键）
    const productMap = new Map(repository.getTable<{ id: string; name: string; category?: string }>(T.products).map((p) => [p.id, p]))
    const brandMap = new Map(
      repository
        .getTable<{ model_id: string; brand_id: string }>(T.model_brands)
        .map((mb) => [mb.model_id, mb.brand_id]),
    )
    const brandName = new Map(repository.getTable<Brand>(T.brands).map((b) => [b.id, b.name]))
    const textOf = (html?: string, max = 0) => {
      if (!html) return undefined
      const t = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      return max > 0 && t.length > max ? `${t.slice(0, max)}…` : t || undefined
    }
    return all
      .filter((s) => s.project_system_id === psId)
      .map((s) => {
        const m = modelMap.get(s.model_id)
        const prod = m ? productMap.get(m.product_id) : undefined
        const bid = brandMap.get(s.model_id)
        return {
          ...s,
          modelName: m?.model,
          deviceName: prod?.name,
          deviceCategory: prod?.category ?? 'other',
          spec: m?.specification,
          detail: m && textOf(m.detail_html),
          brand: bid ? brandName.get(bid) : undefined,
        }
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