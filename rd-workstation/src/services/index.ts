/**
 * RD Workstation 2.0 · Domain Services barrel
 * 业务编排层统一出口：页面侧 `import { xxx } from '../../services'` 保持不变。
 */
export { ProjectService } from './project.service'
export { SystemService } from './system.service'
export { parsePointRows, PointService } from './point.service'
export type { ImportPointRow, PointDraft, AttachedPoint } from './point.service'
/* 设备选项（点位录入下拉 / 设备中心联动） */
export { DeviceProductOptions } from './device.catalog'
export { DesignService } from './design.service'
export { BillService } from './bill.service'
export { BudgetService } from './budget.service'
export { TaskService, ScheduleService, KnowledgeService, DocumentService, RevisionService } from './misc.service'
export { GoalService } from './goal.service'
export { SchemeService } from './scheme.service'
export { TopologyService } from './topology.service'
export { DeviceService } from './device.service'
/* 项目中心 v2：业态字典 + 项目模版（按业态配置与套用） */
export { FormatService, ProjectTemplateService } from './project.center'
/* 设备中心顶层元数据（子系统页签 / 类别标签 / 设备类型视图） */
export { DEVICE_CATEGORIES } from './device.catalog'
export type { DeviceTypeView } from './device.catalog'