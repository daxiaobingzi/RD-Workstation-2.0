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
  /** 行拖拽排序序号（列表视图） */
  sort_order?: number
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
/** 设备中心系统（设备主数据组织维度，可自定义）：id 稳定（sys_vss 等），code 为设备编码前缀简写（唯一） */
export interface DeviceSystem extends Row {
  /** 系统简写（设备编码前缀）：大写字母/数字，全局唯一，如 VSS/GEN */
  code: string
  /** 系统名称：如"视频监控系统" */
  name: string
  /** 所属分组：安防/信息网络/机房/公共设施/楼宇控制/通用…（可自定义新增） */
  group: string
  sort_order?: number
  enabled?: boolean
  created_at?: string
  updated_at?: string
}
export interface Building extends Row {
  project_id: string
  name: string
  sort_order?: number
  enabled?: boolean
  created_at?: string
  updated_at?: string
}
export interface TelecomRoom extends Row {
  building_id: string
  name: string
  sort_order?: number
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
  /** 设备中心产品（设备名称），如"高清枪型摄像机" */
  device_id: string
  /** 项目建筑 */
  building_id?: string
  /** 项目弱电间（建筑→弱电间） */
  telecom_room_id?: string
  quantity: number
  unit?: string
  status: string
  /** 行拖拽排序序号（列表视图） */
  sort_order?: number
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
/** 设备类型（设备主数据主体）：语义对齐 Vue 初版"设备字典"中的设备类型（如"网络摄像机(枪式)"）。
 *  顶层归属：子系统（system_id）→ 设备类型；类别（category）为设备类型属性字段；
 *  点位"设备名称"、单点定额材料、数量推导链均挂在设备类型上；其下型号（ProductModel）为品牌型号配置行。 */
export interface Product extends Row {
  /** 兼容过渡：U4 摘除引擎引用后可移除；新数据不再依赖 */
  product_family_id?: string
  name: string
  manufacturer?: string
  /** 通用参数（富文本 HTML）：设备类型的通用说明/参数，如带宽、夜视能力、接口等 */
  specification?: string
  unit?: string
  /** 子系统归属（sys_vss 等，与 SYSTEM_GROUPS 键一致）——顶层组织属性 */
  system_id?: string
  /** 类别标签（front/back/net/cable/aux…，与 DeviceCategory.category_type 一致） */
  category?: string
  /** 设备类型编码（唯一）：{系统简写}-{分类拼音首字母}-{三位序号}，如 VSS-QD-001；由 DeviceCode 服务自动分配 */
  device_code?: string
  description?: string
  /** 设备级数量推导链配置（U4 使用）：mode=carry/mul/fixed；source=front/指定设备；factor/reserve/round */
  chain_json?: string
  /** 行拖拽排序序号（列表视图） */
  sort_order?: number
  created_at?: string
}

/** 设备单点定额材料（P4）：挂载在设备（Product）上，定义"1 点位消耗的材料配比"。
 *  推导时按 Σ点位数量 × 定额 生成材料数量，用于工程量/清单的线缆、管材、辅材。 */
export type DeviceMaterialCategory = 'cable' | 'conduit' | 'aux' | 'other'
export interface DeviceMaterial extends Row {
  product_id: string
  category: DeviceMaterialCategory
  name: string
  unit: string
  /** 每 1 点位（每台设备）的定额用量，如 0.3 米/点位 或 1 套/点位 */
  quantity_per_point: number
  /** 材料品牌（清单按 品牌+型号 定位材料价格） */
  brand?: string
  /** 材料型号（单行文字） */
  model?: string
  /** 材料参数（单行文字） */
  params?: string
  /** 材料单价（按单位计价；清单材料行优先取此价） */
  price?: number
  note?: string
  enabled?: boolean
}
/** 品牌型号配置行：设备类型下的一条"品牌+型号+详细参数+档次+参考价"。
 *  多品牌备选 = 同一设备类型下多条配置行（各挂不同品牌）。 */
export interface ProductModel extends Row {
  product_id: string
  model: string
  /** 传承字段：型号规格（短文本，兼容旧链路/清单展示）；新数据尽量写入 detail_html */
  specification?: string
  unit?: string
  grade_code?: string
  status?: 'active' | 'disabled'
  /** 详细参数（供应商实际型号参数，富文本 HTML） */
  detail_html?: string
  created_at?: string
}
export interface Brand extends Row {
  name: string
  manufacturer_type?: string
  website?: string
  remark?: string
}
/** 型号 ↔ 品牌关联：一个型号绑定一个品牌；多品牌备选体现为同一设备类型下多个型号各挂不同品牌 */
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

/* ============ 选型方案（P5）============ */
/** 选型方案：一组"设备类型 → 选型偏好"规则的集合。勾选方案后引擎按其执行选型。 */
export interface SelectionScheme extends Row {
  name: string
  system_id?: string
  description?: string
  enabled?: boolean
  is_default?: boolean
  created_at?: string
  updated_at?: string
}
/** 方案内的选型规则：某设备类型（kind）在指定设备族内，按品牌/档次/型号关键词偏好选型 */
export interface SchemeRule extends Row {
  scheme_id: string
  kind: string
  family_id?: string
  brand_id?: string
  grade_code?: string
  model_keyword?: string
  prefer_lowest_price?: boolean
  priority?: number
  enabled?: boolean
}

/** 拓扑节点（P6）：系统结构图节点，手动或由推导结果自动生成 */
export interface TopologyNode extends Row {
  project_system_id: string
  kind: string
  label: string
  quantity?: number
  x?: number
  y?: number
  auto?: boolean
  color?: string
  created_at?: string
}
/** 拓扑连线（P6）：上游 → 下游（如 摄像机 → POE交换机） */
export interface TopologyEdge extends Row {
  project_system_id: string
  from_kind: string
  to_kind: string
  label?: string
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
  /** 手工调整标记：数量/单价被手工改过，重新生成清单时保留此行的手工值 */
  manually_tuned?: boolean
  /** 备注（单行文本，材料表/预算清单/概算清单行内编辑） */
  remark?: string
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
  goal_id?: string
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
  buildings: 'buildings',
  telecom_rooms: 'telecom_rooms',
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
  device_systems: 'device_systems',
  device_materials: 'device_materials',
  brands: 'brands',
  model_brands: 'model_brands',
  prices: 'prices',
  suppliers: 'suppliers',
  design_rules: 'design_rules',
  rule_bindings: 'rule_bindings',
  selection_schemes: 'selection_schemes',
  scheme_rules: 'scheme_rules',
  topology_nodes: 'topology_nodes',
  topology_edges: 'topology_edges',
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
