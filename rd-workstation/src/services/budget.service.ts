import { useDB } from '../db/memory-db'
import { T } from '../types/domain'
import type { BillItem, Budget, BudgetItem, Product, ProductModel, ProductFamily } from '../types/domain'
import { BudgetEngine, SelectionEngine } from '../engines'
import ctx from './ctx'
import { DesignService } from './design.service'

/* ---------- 预算 Service ---------- */
export const BudgetService = {
  generate(psId: string, projectId: string, billVersionId: string) {
    const { budget, items } = BudgetEngine.generate(ctx, psId, projectId, billVersionId)
    useDB.getState().insert(T.budgets, budget)
    useDB.getState().insertMany(T.budget_items, items)
    return { budget, items }
  },
  /** 设定目标预算，用于超支预警 */
  setTargetAmount(budgetId: string, amount: number) {
    useDB.getState().update(T.budgets, budgetId, { target_amount: amount })
  },
  byProject(projectId: string): Budget[] {
    return useDB.getState().where<Budget>(T.budgets, (r) => r.project_id === projectId)
  },
  items(budgetId: string): BudgetItem[] {
    return useDB.getState().where<BudgetItem>(T.budget_items, (r) => r.budget_id === budgetId)
  },
  /** 预算构成：按产品族聚合金额（供堆叠条形图） */
  byFamily(budgetId: string): { name: string; amount: number }[] {
    const items = this.items(budgetId)
    const db = useDB.getState().db
    const familyOfModel = new Map<string, string>()
    for (const m of db[T.product_models]) {
      const prod = db[T.products].find((p) => p.id === (m as ProductModel).product_id) as Product | undefined
      if (prod) familyOfModel.set(m.id, prod.product_family_id)
    }
    const famName = new Map(db[T.product_families].map((f) => [f.id, (f as ProductFamily).name]))
    const agg = new Map<string, number>()
    for (const it of items) {
      const billItem = db[T.bill_items].find((x) => x.id === it.bill_item_id) as BillItem | undefined
      const famId = billItem?.device_model_id ? familyOfModel.get(billItem.device_model_id) : undefined
      const name = famId ? (famName.get(famId) ?? '其他') : '其他'
      agg.set(name, (agg.get(name) ?? 0) + it.amount)
    }
    return [...agg.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
  },
  /** 档次估算：用同一推导结果为三档分别计算预算总额（不落库） */
  estimateByGrade(psId: string): { grade: string; label: string; total: number }[] {
    const results = DesignService.results(psId)
    const grades = [
      { code: 'economic', label: '经济型' },
      { code: 'standard', label: '标准型' },
      { code: 'premium', label: '高端型' },
    ]
    return grades.map((g) => {
      const sels = SelectionEngine.deriveSelections(ctx, psId, g.code, results)
      return { grade: g.code, label: g.label, total: sels.reduce((s, x) => s + x.total_price, 0) }
    })
  },
}