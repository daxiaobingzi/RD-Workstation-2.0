import type { DB } from '../db/memory-db'
import type { Row } from '../types/domain'
import { baseTables } from './seed-base'
import { deviceTables } from './seed-devices'
import { priceTables } from './seed-prices'
import { ruleTables } from './seed-rules'
import { demoProjectTables } from './seed-demo-project'
import { testProjectTables } from './seed-test-project'

/** 演示种子数据：苏州公安项目 · 视频监控 VSS 设计链全量数据 + 测试用丰富项目（proj_004 多系统全链） */
export function seedDB(): DB {
  const db: DB = {}

  const put = <T extends Row>(t: string, rows: T[]) => {
    db[t] = rows
  }
  const merge = <T extends Row>(t: string, rows: T[]) => {
    db[t] = [...(db[t] ?? []), ...rows]
  }

  /* ---------- 系统基础 ---------- */
  put('grades', baseTables.grades)
  put('system_templates', baseTables.system_templates)
  put('systems', baseTables.systems)
  put('selection_schemes', baseTables.selection_schemes)
  put('scheme_rules', baseTables.scheme_rules)

  /* ---------- 业态字典（全部为用户可增删改的自定义条目，无内置；演示项目已用业态预先入字典） ---------- */
  put('dictionaries', [
    { id: 'fmt_001', group_code: 'project_format', item_code: 'fmt_government', item_name: '政府 · 公共安全', sort_order: 1, enabled: true },
    { id: 'fmt_002', group_code: 'project_format', item_code: 'fmt_office', item_name: '办公 · 智能楼宇', sort_order: 2, enabled: true },
    { id: 'fmt_003', group_code: 'project_format', item_code: 'fmt_finance', item_name: '办公 · 金融', sort_order: 3, enabled: true },
    { id: 'fmt_004', group_code: 'project_format', item_code: 'fmt_medical', item_name: '医疗', sort_order: 4, enabled: true },
  ])

  /* ---------- 设备中心系统（可自定义的组织维度；seed 从标准系统派生 + 通用设备兜底） ---------- */
  put('device_systems', [
    ...baseTables.systems.map((s) => ({
      id: s.id,
      code: (s as unknown as { code: string }).code,
      name: (s as unknown as { name: string }).name,
      group: (s as unknown as { category?: string }).category || '通用',
      sort_order: (s as unknown as { sort_order?: number }).sort_order ?? 99,
      enabled: (s as unknown as { enabled?: boolean }).enabled !== false,
    })),
    { id: '__other', code: 'GEN', name: '通用设备', group: '通用', sort_order: 999, enabled: true },
  ])

  /* ---------- 设备域 ---------- */
  put('device_categories', deviceTables.device_categories)
  put('product_families', deviceTables.product_families)
  put('products', deviceTables.products)
  put('product_models', deviceTables.product_models)
  put('device_materials', deviceTables.device_materials)
  put('brands', deviceTables.brands)
  put('suppliers', deviceTables.suppliers)
  put('model_brands', deviceTables.model_brands)

  /* ---------- 价格域 ---------- */
  put('prices', priceTables.prices)
  put('model_grade_bindings', priceTables.model_grade_bindings)

  /* ---------- 项目域 ---------- */
  merge('projects', demoProjectTables.projects)
  merge('projects', testProjectTables.projects)
  put('buildings', [...(demoProjectTables.buildings ?? []), ...(testProjectTables.buildings ?? [])])
  put('telecom_rooms', [...(demoProjectTables.telecom_rooms ?? []), ...(testProjectTables.telecom_rooms ?? [])])
  put('project_systems', [...(demoProjectTables.project_systems ?? []), ...(testProjectTables.project_systems ?? [])])

  /* ---------- 设计域 ---------- */
  const designParameters = [...(baseTables.design_parameters ?? []), ...(testProjectTables.design_parameters ?? [])]
  put('design_parameters', designParameters)
  put('point_categories', baseTables.point_categories)
  put('points', [...(demoProjectTables.points ?? []), ...(testProjectTables.points ?? [])])
  put('design_results', [...(testProjectTables.design_results ?? [])])
  put('device_selections', [...(testProjectTables.device_selections ?? [])])

  /* ---------- 规则与结果 ---------- */
  put('design_rules', ruleTables.design_rules)
  put('rule_bindings', ruleTables.rule_bindings)

  /* ---------- 清单 / 预算（测试项目全链） ---------- */
  put('bill_versions', [...(testProjectTables.bill_versions ?? [])])
  put('bill_items', [...(testProjectTables.bill_items ?? [])])
  put('budgets', [...(testProjectTables.budgets ?? [])])
  put('budget_items', [...(testProjectTables.budget_items ?? [])])

  /* ---------- 个人工作域 ---------- */
  put('tasks', [...(demoProjectTables.tasks ?? []), ...(testProjectTables.tasks ?? [])])
  put('schedules', [...(demoProjectTables.schedules ?? []), ...(testProjectTables.schedules ?? [])])
  put('goals', demoProjectTables.goals)
  put('goal_metrics', demoProjectTables.goal_metrics)
  put('habits', demoProjectTables.habits)
  put('habit_records', demoProjectTables.habit_records)

  /* ---------- 知识域 ---------- */
  put('knowledge_items', demoProjectTables.knowledge_items)
  put('documents', [...(demoProjectTables.documents ?? []), ...(testProjectTables.documents ?? [])])
  put('revisions', [...(testProjectTables.revisions ?? [])])

  return db
}