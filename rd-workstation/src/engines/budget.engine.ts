import type { BillItem, Budget, BudgetItem } from '../types/domain'
import { T } from '../types/domain'
import { uid } from '../lib/utils'
import type { EngineCtx } from './ctx'

/* ================= BudgetEngine：预算 ================= */
export const BudgetEngine = {
  generate(ctx: EngineCtx, psId: string, projectId: string, billVersionId: string): { budget: Budget; items: BudgetItem[] } {
    const billItems = ctx.get<BillItem>(T.bill_items).filter((i) => i.bill_version_id === billVersionId)
    const total = billItems.reduce((s, i) => s + (i.amount || 0), 0)
    const budget: Budget = {
      id: uid('bud'),
      project_id: projectId,
      bill_version_id: billVersionId,
      budget_type: 'system',
      total_amount: total,
      status: 'draft',
      created_at: new Date().toISOString(),
    }
    const items: BudgetItem[] = billItems.map((i) => ({
      id: uid('bui'),
      budget_id: budget.id,
      project_system_id: psId,
      bill_item_id: i.id,
      quantity: i.quantity,
      unit_price: i.unit_price,
      amount: i.amount,
    }))
    return { budget, items }
  },
}