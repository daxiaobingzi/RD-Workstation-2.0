import { repository } from '../db/memory-db'
import { T } from '../types/domain'
import type { SelectionScheme, SchemeRule } from '../types/domain'
import { uid } from '../lib/utils'

function nowIso() {
  return new Date().toISOString()
}

/** 选型方案（P5）：自定义"设备类型 → 品牌/档次/关键词偏好"的规则集，勾选后引擎按其选型 */
export const SchemeService = {
  list(systemId?: string): SelectionScheme[] {
    const rows = repository
      .getTable<SelectionScheme>(T.selection_schemes)
      .filter((s) => s.enabled !== false && (!systemId || !s.system_id || s.system_id === systemId))
      .sort((a, b) => (a.is_default ? -1 : 0) - (b.is_default ? -1 : 0))
    return rows
  },

  get(id: string): SelectionScheme | undefined {
    return repository.getById<SelectionScheme>(T.selection_schemes, id)
  },

  rules(schemeId: string): SchemeRule[] {
    return repository
      .getTable<SchemeRule>(T.scheme_rules)
      .filter((r) => r.scheme_id === schemeId)
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
  },

  add(data: Partial<SelectionScheme>): SelectionScheme {
    const now = nowIso()
    const scheme: SelectionScheme = {
      id: uid('sch'), name: data.name || '新选型方案',
      system_id: data.system_id, description: data.description,
      enabled: data.enabled ?? true, is_default: data.is_default ?? false,
      created_at: now, updated_at: now,
    }
    repository.insert(T.selection_schemes, scheme)
    return scheme
  },

  update(id: string, patch: Partial<SelectionScheme>) {
    repository.update(T.selection_schemes, id, { ...patch, updated_at: nowIso() })
  },

  remove(id: string) {
    repository.remove(T.selection_schemes, id)
    repository.removeMany(T.scheme_rules, (r) => (r as SchemeRule).scheme_id === id)
  },

  /** 仅一个方案可设为默认 */
  setDefault(id: string) {
    const all = repository.getTable<SelectionScheme>(T.selection_schemes)
    all.forEach((s) => repository.update(T.selection_schemes, s.id, { is_default: s.id === id, updated_at: nowIso() }))
  },

  addRule(schemeId: string, data: Partial<SchemeRule>): SchemeRule {
    const rule: SchemeRule = {
      id: uid('srl'), scheme_id: schemeId,
      kind: data.kind || 'other',
      family_id: data.family_id, brand_id: data.brand_id,
      grade_code: data.grade_code, model_keyword: data.model_keyword,
      prefer_lowest_price: data.prefer_lowest_price ?? false,
      priority: data.priority ?? 10, enabled: data.enabled ?? true,
    }
    repository.insert(T.scheme_rules, rule)
    return rule
  },

  updateRule(ruleId: string, patch: Partial<SchemeRule>) {
    repository.update(T.scheme_rules, ruleId, patch)
  },

  removeRule(ruleId: string) {
    repository.remove(T.scheme_rules, ruleId)
  },

  /** 项目系统当前启用的方案（缺省返回默认方案） */
  activeForSystem(systemId: string): SelectionScheme | undefined {
    return this.list(systemId)[0]
  },
}