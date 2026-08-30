import type {
  ActivityLog,
  AppSetting,
  Attachment,
  AuditLog,
  BillItem,
  BillVersion,
  Brand,
  Budget,
  BudgetItem,
  Building,
  DesignParameter,
  DesignResult,
  DesignRule,
  DeviceCategory,
  DeviceMaterial,
  DeviceSelection,
  DeviceSystem,
  Dictionary,
  Document,
  Goal,
  GoalMetric,
  Grade,
  Habit,
  HabitRecord,
  KnowledgeItem,
  KnowledgeLink,
  ModelBrand,
  ModelGradeBinding,
  Point,
  PointCategory,
  PointDeviceRequirement,
  Price,
  Product,
  ProductFamily,
  ProductModel,
  Project,
  ProjectSystem,
  Revision,
  RuleBinding,
  Schedule,
  SchemeRule,
  SelectionScheme,
  StandardSystem,
  Supplier,
  SystemTemplate,
  Task,
  TaskLink,
  TelecomRoom,
  Template,
  TopologyEdge,
  TopologyNode,
} from './domain'

/** 冻结 Schema 的表名 → 行类型映射。避免 table 与泛型类型彼此脱节。 */
export interface TableMap {
  app_settings: AppSetting
  dictionaries: Dictionary
  grades: Grade
  projects: Project
  buildings: Building
  telecom_rooms: TelecomRoom
  project_systems: ProjectSystem
  systems: StandardSystem
  system_templates: SystemTemplate
  design_parameters: DesignParameter
  point_categories: PointCategory
  points: Point
  point_device_requirements: PointDeviceRequirement
  device_selections: DeviceSelection
  device_categories: DeviceCategory
  product_families: ProductFamily
  products: Product
  product_models: ProductModel
  device_systems: DeviceSystem
  device_materials: DeviceMaterial
  brands: Brand
  model_brands: ModelBrand
  prices: Price
  suppliers: Supplier
  design_rules: DesignRule
  rule_bindings: RuleBinding
  selection_schemes: SelectionScheme
  scheme_rules: SchemeRule
  topology_nodes: TopologyNode
  topology_edges: TopologyEdge
  design_results: DesignResult
  bill_versions: BillVersion
  bill_items: BillItem
  budgets: Budget
  budget_items: BudgetItem
  model_grade_bindings: ModelGradeBinding
  tasks: Task
  task_links: TaskLink
  schedules: Schedule
  activity_logs: ActivityLog
  goals: Goal
  goal_metrics: GoalMetric
  habits: Habit
  habit_records: HabitRecord
  knowledge_items: KnowledgeItem
  knowledge_links: KnowledgeLink
  templates: Template
  documents: Document
  attachments: Attachment
  revisions: Revision
  audit_logs: AuditLog
}

export type TableName = keyof TableMap
export type TableRow<K extends TableName> = TableMap[K]

/** 数据库运行时结构。未初始化的表允许暂时不存在。 */
export type DB = Partial<{
  [K in TableName]: TableMap[K][]
}>
