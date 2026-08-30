import { repository } from '../db/memory-db'
import { T } from '../types/domain'
import type { BillItem, Budget, BudgetItem, Product, ProductModel, ProductFamily, DeviceSelection } from '../types/domain'
import { BudgetEngine, SelectionEngine } from '../engines'
import ctx from './ctx'
import { uid } from '../lib/utils'
import { DesignService } from './design.service'
import { BillService } from './bill.service'

/* ---------- 预算 Service ---------- */
export const BudgetService = {
  generate(psId: string, projectId: string, billVersionId: string) {
    const { budget, items } = BudgetEngine.generate(ctx, psId, projectId, billVersionId)
    repository.insert(T.budgets, budget)
    repository.insertMany(T.budget_items, items)
    return { budget, items }
  },
  /** 项目级预算：基于清单版本的整表 items 生成一条预算（预算 tab「确认生成清单」联动） */
  generateProject(projectId: string, billVersionId: string) {
    const db = repository.db
    const billItems = db[T.bill_items].filter((i) => (i as BillItem).bill_version_id === billVersionId) as BillItem[]
    const total = billItems.reduce((s, i) => s + (i.amount || 0), 0)
    const budget: Budget = {
      id: uid('bud'), project_id: projectId, bill_version_id: billVersionId,
      budget_type: 'system', total_amount: total, status: 'draft',
      created_at: new Date().toISOString(),
    }
    const items: BudgetItem[] = billItems.filter((i) => i.project_system_id).map((i) => ({
      id: uid('bui'), budget_id: budget.id, project_system_id: i.project_system_id as string,
      bill_item_id: i.id, quantity: i.quantity, unit_price: i.unit_price, amount: i.amount,
    }))
    repository.insert(T.budgets, budget)
    repository.insertMany(T.budget_items, items)
    return { budget, items }
  },
  /** 设定目标预算，用于超支预警 */
  setTargetAmount(budgetId: string, amount: number) {
    repository.update(T.budgets, budgetId, { target_amount: amount })
  },
  byProject(projectId: string): Budget[] {
    return repository.where<Budget>(T.budgets, (r) => r.project_id === projectId)
  },
  items(budgetId: string): BudgetItem[] {
    return repository.where<BudgetItem>(T.budget_items, (r) => r.budget_id === budgetId)
  },
  /** 预算构成：按产品族聚合金额（供堆叠条形图） */
  byFamily(budgetId: string): { name: string; amount: number }[] {
    const items = this.items(budgetId)
    const db = repository.db
    const familyOfModel = new Map<string, string>()
    for (const m of db[T.product_models]) {
      const prod = db[T.products].find((p) => p.id === (m as ProductModel).product_id) as Product | undefined
      if (prod) familyOfModel.set(m.id, prod.product_family_id ?? '')
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

  /**
   * 预算清单·实时视图（智能选型）：直接以 device_selections 为数据源，逐行回溯设备中心富化。
   * 换档 / 批量选型后选型即变 → 本视图即时刷新（品牌/型号/详细参数/单价随所选型号实时）；
   * 与已确认的版本快照解耦，「确认生成清单」才固化新版本（概算清单读快照）。
   */
  liveByProject(projectId: string) {
    const db = repository.db
    const psIds = new Set(
      (db[T.project_systems] ?? []).filter((p) => (p as unknown as { project_id: string }).project_id === projectId).map((p) => (p as unknown as { id: string }).id),
    )
    const modelOf = new Map((db[T.product_models] ?? []).map((m) => [(m as { id: string }).id, m as ProductModel]))
    const productOf = new Map(
      (db[T.products] ?? []).map((p) => [(p as { id: string }).id, p as unknown as { name: string; category?: string; device_code?: string; specification?: string; unit?: string }]),
    )
    const brandIdOfModel = new Map((db[T.model_brands] ?? []).map((mb) => [(mb as unknown as { model_id: string }).model_id, (mb as unknown as { brand_id: string }).brand_id]))
    const brandNameOf = new Map((db[T.brands] ?? []).map((b) => [(b as { id: string }).id, (b as unknown as { name: string }).name]))
    const textOf = (html?: string, max = 100) => {
      if (!html) return undefined
      const t = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      if (!t) return undefined
      return t.length > max ? `${t.slice(0, max)}…` : t
    }
    return (db[T.device_selections] ?? [])
      .map((x) => x as DeviceSelection)
      .filter((s) => psIds.has(s.project_system_id ?? ''))
      .map((s) => {
        const m = s.model_id ? modelOf.get(s.model_id) : undefined
        const prod = m ? productOf.get(m.product_id) : undefined
        const bid = m ? brandIdOfModel.get(m.id) : undefined
        return {
          selectionId: s.id,
          projectSystemId: s.project_system_id,
          quantity: s.quantity,
          unit_price: s.unit_price,
          amount: s.total_price,
          grade: s.grade_code,
          item: {
            deviceName: prod?.name,
            deviceCategory: prod?.category ?? 'other',
            deviceCode: prod?.device_code,
            unit: prod?.unit ?? s.unit,
            item_name: m?.model,
            // 通用参数 = 设备类型 Product.specification（非富文本）；详细参数 = 型号 detail_html 纯文本
            spec: prod ? textOf(prod.specification) : undefined,
            specification: m?.specification,
            detail: m ? textOf(m.detail_html, 100) : undefined,
            brandName: bid ? brandNameOf.get(bid) : undefined,
          },
        }
      })
  },

  /** 行内手工调整（预算清单数量/单价）：同步 bill_item 与全部关联 budget_item（手工行打标记，重新生成时保留） */
  tuneByBillItem(billItemId: string, patch: { quantity?: number; unit_price?: number }) {
    const bi = repository.getById<BillItem>(T.bill_items, billItemId)
    if (!bi) return
    const quantity = patch.quantity ?? bi.quantity
    const unitPrice = patch.unit_price ?? bi.unit_price
    const tuned = patch.quantity !== undefined || patch.unit_price !== undefined
    repository.update(T.bill_items, billItemId, {
      quantity,
      unit_price: unitPrice,
      amount: quantity * unitPrice,
      manually_tuned: tuned ? true : bi.manually_tuned,
    })
    const items = repository.getTable<BudgetItem>(T.budget_items).filter((x) => x.bill_item_id === billItemId)
    for (const it of items) {
      repository.update(T.budget_items, it.id, { quantity, unit_price: unitPrice, amount: quantity * unitPrice })
    }
  },

  /** 行内备注：仅写 bill_item.remark（清单/预算/概算同源联动） */
  tuneRemarkByBillItem(billItemId: string, remark: string) {
    BillService.updateItem(billItemId, { remark })
  },

  /** 删除预算清单行：同步清除 bill_item 与关联 budget_item（金额随之重算） */
  removeByBillItem(billItemId: string) {
    repository.remove(T.bill_items, billItemId)
    repository.removeMany(T.budget_items, (x) => (x as BudgetItem).bill_item_id === billItemId)
  },
}