/**
 * RD Workstation 2.0 · Domain Engines（纯计算层）
 * 数据库存「事实」，Engine 算「应该多少」。所有派生计算集中于此，UI 禁止绕过。
 */
export { DEFAULT_RULES } from './default-rules'
export { evalCondition, evalExpr } from './expr'
export { buildVars, type EngineCtx } from './ctx'
export { DesignEngine } from './design.engine'
export { PricingEngine } from './pricing.engine'
export { SelectionEngine, type DeviceKind } from './selection.engine'
export { BillEngine } from './bill.engine'
export { BudgetEngine } from './budget.engine'
export { ValidationEngine, type CheckResult } from './validation.engine'
export { GoalEngine } from './goal.engine'
export { SchedulingEngine } from './scheduling.engine'