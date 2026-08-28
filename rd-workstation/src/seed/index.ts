import type { DB } from '../db/memory-db'
import type { Row } from '../types/domain'
import { baseTables } from './seed-base'
import { deviceTables } from './seed-devices'
import { priceTables } from './seed-prices'
import { ruleTables } from './seed-rules'
import { demoProjectTables } from './seed-demo-project'

/** 演示种子数据：苏州公安项目 · 视频监控 VSS 设计链全量数据 */
export function seedDB(): DB {
  const db: DB = {}

  const put = <T extends Row>(t: string, rows: T[]) => {
    db[t] = rows
  }

  /* ---------- 系统基础 ---------- */
  put('grades', baseTables.grades)
  put('system_templates', baseTables.system_templates)
  put('systems', baseTables.systems)

  /* ---------- 设备域 ---------- */
  put('device_categories', deviceTables.device_categories)
  put('product_families', deviceTables.product_families)
  put('products', deviceTables.products)
  put('product_models', deviceTables.product_models)
  put('brands', deviceTables.brands)
  put('suppliers', deviceTables.suppliers)
  put('model_brands', deviceTables.model_brands)

  /* ---------- 价格域 ---------- */
  put('prices', priceTables.prices)
  put('model_grade_bindings', priceTables.model_grade_bindings)

  /* ---------- 项目域 ---------- */
  put('projects', demoProjectTables.projects)
  put('project_systems', demoProjectTables.project_systems)

  /* ---------- 设计域 ---------- */
  put('design_parameters', baseTables.design_parameters)
  put('point_categories', baseTables.point_categories)
  put('points', demoProjectTables.points)

  /* ---------- 规则与结果 ---------- */
  put('design_rules', ruleTables.design_rules)
  put('rule_bindings', ruleTables.rule_bindings)

  /* ---------- 个人工作域 ---------- */
  put('tasks', demoProjectTables.tasks)
  put('schedules', demoProjectTables.schedules)
  put('goals', demoProjectTables.goals)
  put('habits', demoProjectTables.habits)
  put('habit_records', demoProjectTables.habit_records)

  /* ---------- 知识域 ---------- */
  put('knowledge_items', demoProjectTables.knowledge_items)
  put('documents', demoProjectTables.documents)

  return db
}