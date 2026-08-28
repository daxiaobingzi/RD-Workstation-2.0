/**
 * RD Workstation 2.0 · Domain 类型定义（对应规格冻结的 43 张表）
 * Web 先行阶段：以 TypeScript 类型承载冻结 Schema；后续 SQLite/Drizzle 落地时一一映射。
 */

export type Row = { id: string }

/* ============ 系统基础域 ============ */
export interface AppSetting extends Row {
  key: string
  value_json: unknown
  updated_at?: string
}
export interface Dictionary extends Row {
  group_code: string
  item_code: string
  item_name: string
  sort_order?: number
  enabled?: boolean
  metadata_json?: string
}
export interface Grade extends Row {
  code: string
  name: string
  sort_order?: number
  description?: string
  enabled?: boolean
}

/* ============ 项目域 ============ */
export interface Project extends Row {
  project_code: string
  name: string
  project_type?: string
  building_type?: string
  client_name?: string
  location?: string
  building_area?: number
  floor_count?: number
  design_stage?: string
  status: 'draft' | 'designing' | 'reviewing' | 'completed' | 'archived'
  default_grade_code?: string
  start_date?: string
  planned_end_date?: string
  actual_end_date?: string
  description?: string
  created_at: string
  updated_at: string
  archived_at?: string
}
export interface ProjectSystem extends Row {
  project_id: string
  system_id: string
  status: 'draft' | 'designing' | 'reviewing' | 'completed'
  progress: number
  design_grade?: string
  sort_order?: number
  start_date?: string
  planned_end_date?: string
  actual_end_date?: string
  created_at: string
  updated_at: string
}
export interface StandardSystem extends Row {
  code: string
  name: string
  category?: string
  description?: string
  icon?: string
  sort_order?: number
  enabled?: boolean
  created_at?: string
  updated_at?: string
}
export interface SystemTemplate extends Row {
  system_id: string
  name: string
  version?: string
  description?: string
  content_json?: unknown
  enabled?: boolean
}

/* ============ 设计域 ============ */
export interface DesignParameter extends Row {
  project_system_id: string
  parameter_key: string
  parameter_name: string
  value_type: 'number' | 'string' | 'boolean'
  value_json: number | string | boolean
  unit?: string
  required?: boolean
  source?: string
}
export interface PointCategory extends Row {
  system_id: string
  code: string
  name: string
  description?: string
  default_unit?: string
  sort_order?: number
  enabled?: boolean
}
export interface Point extends Row {
  project_system_id: string
  point_code: string
  point_name: string
  category_id?: string
  building?: string
  floor?: string
  zone?: string
  space?: string
  location?: string
  quantity: number
  unit?: string
  design_requirement?: string
  remark?: string
  status: string
  created_at?: string
  updated_at?: string
}
export interface PointDeviceRequirement extends Row {
  point_id: string
  device_id: string
  quantity_factor?: number
  fixed_quantity?: number
  required?: boolean
  remark?: string
}
export interface DeviceSelection extends Row {
  project_system_id: string
  device_id?: string
  model_id: string
  selection_source?: string
  selection_reason?: string
  grade_code?: string
  quantity: number
  unit?: string
  unit_price: number
  total_price: number
  status?: string
  remark?: string
  created_at?: string
  updated_at?: string
}

/* ============ 设备域 ============ */
export interface DeviceCategory extends Row {
  system_id?: string
  code: string
  name: string
  category_type?: string
  sort_order?: number
  enabled?: boolean
}
export interface ProductFamily extends Row {
  device_category_id: string
  code?: string
  name: string
  description?: string
  sort_order?: number
  enabled?: boolean
}
export interface Product extends Row {
  product_family_id: string
  name: string
  manufacturer?: string
  description?: string
  created_at?: string
}
export interface ProductModel extends Row {
  product_id: string
  model: string
  specification?: string
  unit?: string
  grade_code?: string
  status?: 'active' | 'disabled'
  parameter_json?: Record<string, unknown>
  created_at?: string
}
export interface Brand extends Row {
  name: string
  manufacturer_type?: string
  website?: string
  remark?: string
}
export interface ModelBrand extends Row {
  model_id: string
  brand_id: string
  is_default?: boolean
  sort_order?: number
}
export interface Price extends Row {
  model_id: string
  price_type: 'reference' | 'market' | 'supplier' | 'project'
  price: number
  currency?: string
  effective_date?: string
  expire_date?: string
  source?: string
  supplier_id?: string
  remark?: string
}
export interface Supplier extends Row {
  name: string
  contact?: string
  phone?: string
  region?: string
  remark?: string
}

/* ============ 规则与结果 ============ */
export interface DesignRule extends Row {
  system_id?: string
  code: string
  name: string
  description?: string
  rule_type: string
  source_type?: string
  target_type?: string
  condition_json?: unknown
  formula_json: string
  priority?: number
  version?: string
  enabled?: boolean
}
export interface RuleBinding extends Row {
  rule_id: string
  source_device_id?: string
  target_device_id?: string
  project_system_id?: string
  override_json?: unknown
  enabled?: boolean
}
export interface DesignResult extends Row {
  project_system_id: string
  result_type: string
  source_type?: string
  source_id?: string
  quantity: number
  unit?: string
  formula_snapshot?: string
  rule_snapshot?: string
  created_at: string
}

/* ============ 清单预算域 ============ */
export interface BillVersion extends Row {
  project_id: string
  version_no: string
  name?: string
  source?: string
  status?: string
  created_by?: string
  created_at: string
  updated_at?: string
}
export interface BillItem extends Row {
  bill_version_id: string
  project_system_id?: string
  device_model_id?: string
  item_code?: string
  item_name: string
  specification?: string
  unit?: string
  quantity: number
  unit_price: number
  amount: number
  category?: string
  source_type?: string
  source_id?: string
  sort_order?: number
}
export interface Budget extends Row {
  project_id: string
  bill_version_id?: string
  budget_type?: string
  total_amount: number
  target_amount?: number
  status?: string
  created_at?: string
}
export interface BudgetItem extends Row {
  budget_id: string
  project_system_id?: string
  bill_item_id?: string
  quantity: number
  unit_price: number
  amount: number
  optimization_group?: string
  remark?: string
}
export interface ModelGradeBinding extends Row {
  model_id: string
  grade_id: string
  priority?: number
  is_default?: boolean
}

/* ============ 个人工作域 ============ */
export interface Task extends Row {
  title: string
  description?: string
  status: 'todo' | 'doing' | 'done' | 'blocked'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  source_type?: string
  source_id?: string
  project_id?: string
  project_system_id?: string
  goal_id?: string
  parent_task_id?: string
  estimated_minutes?: number
  actual_minutes?: number
  due_at?: string
  completed_at?: string
  created_at: string
  updated_at: string
}
export interface TaskLink extends Row {
  task_id: string
  entity_type: string
  entity_id: string
  relation_type?: string
}
export interface Schedule extends Row {
  task_id?: string
  title: string
  start_at: string
  end_at?: string
  schedule_type?: string
  location?: string
  status?: string
  project_id?: string
  project_system_id?: string
  created_at?: string
}
export interface ActivityLog extends Row {
  task_id?: string
  project_id?: string
  project_system_id?: string
  started_at?: string
  ended_at?: string
  duration_minutes?: number
  note?: string
  created_at?: string
}
export interface Goal extends Row {
  parent_goal_id?: string
  name: string
  description?: string
  goal_type?: string
  period_type: 'year' | 'quarter' | 'month' | 'week'
  start_date?: string
  end_date?: string
  target_value?: number
  current_value?: number
  status?: string
  created_at?: string
}
export interface GoalMetric extends Row {
  goal_id: string
  metric_type: string
  source_type?: string
  source_query?: string
  target_value?: number
  weight?: number
}
export interface Habit extends Row {
  name: string
  description?: string
  frequency_type?: string
  frequency_config?: unknown
  target_value?: number
  unit?: string
  goal_id?: string
  is_active?: boolean
  created_at?: string
}
export interface HabitRecord extends Row {
  habit_id: string
  date: string
  value?: number
  completed: boolean
  note?: string
  created_at?: string
}

/* ============ 知识 / 审计域 ============ */
export interface KnowledgeItem extends Row {
  type: 'standard' | 'manual' | 'case' | 'experience' | 'note' | 'article'
  title: string
  content?: string
  source?: string
  file_path?: string
  tags_json?: string[]
  created_at?: string
}
export interface KnowledgeLink extends Row {
  knowledge_id: string
  entity_type: string
  entity_id: string
  relation_type?: string
}
export interface Template extends Row {
  type: string
  name: string
  version?: string
  description?: string
  content_json?: unknown
  created_at?: string
}
export interface Document extends Row {
  project_id?: string
  project_system_id?: string
  type?: string
  title: string
  content?: string
  version?: string
  status?: string
  file_path?: string
  created_at?: string
}
export interface Attachment extends Row {
  project_id?: string
  project_system_id?: string
  entity_type?: string
  entity_id?: string
  file_name: string
  file_path?: string
  file_type?: string
  file_size?: number
  created_at?: string
}
export interface Revision extends Row {
  entity_type: string
  entity_id: string
  version_no?: string
  snapshot_json?: unknown
  change_type?: string
  change_summary?: string
  created_at: string
}
export interface AuditLog extends Row {
  entity_type: string
  entity_id: string
  action: 'create' | 'update' | 'delete' | 'move' | 'rebase'
  before_json?: unknown
  after_json?: unknown
  created_at: string
}

/* ============ 表名常量 ============ */
export const T = {
  app_settings: 'app_settings',
  dictionaries: 'dictionaries',
  grades: 'grades',
  projects: 'projects',
  project_systems: 'project_systems',
  systems: 'systems',
  system_templates: 'system_templates',
  design_parameters: 'design_parameters',
  point_categories: 'point_categories',
  points: 'points',
  point_device_requirements: 'point_device_requirements',
  device_selections: 'device_selections',
  device_categories: 'device_categories',
  product_families: 'product_families',
  products: 'products',
  product_models: 'product_models',
  brands: 'brands',
  model_brands: 'model_brands',
  prices: 'prices',
  suppliers: 'suppliers',
  design_rules: 'design_rules',
  rule_bindings: 'rule_bindings',
  design_results: 'design_results',
  bill_versions: 'bill_versions',
  bill_items: 'bill_items',
  budgets: 'budgets',
  budget_items: 'budget_items',
  model_grade_bindings: 'model_grade_bindings',
  tasks: 'tasks',
  task_links: 'task_links',
  schedules: 'schedules',
  activity_logs: 'activity_logs',
  goals: 'goals',
  goal_metrics: 'goal_metrics',
  habits: 'habits',
  habit_records: 'habit_records',
  knowledge_items: 'knowledge_items',
  knowledge_links: 'knowledge_links',
  templates: 'templates',
  documents: 'documents',
  attachments: 'attachments',
  revisions: 'revisions',
  audit_logs: 'audit_logs',
} as const
