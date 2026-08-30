import { repository } from '../db/memory-db'
import { T } from '../types/domain'
import type { BillItem, Budget, BudgetItem, Product, ProductModel, ProductFamily, DeviceSelection, DesignResult } from '../types/domain'
import { BudgetEngine, SelectionEngine, PricingEngine } from '../engines'
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
   * 预算清单·实时视图（智能选型）：以「材料表同源数据」为展示基础 ——
   *  - 设备行：由 device_selections（当前选型）回溯设备中心富化（品牌/型号/参数/单价随所选型号实时）
   *  - 定额材料行：材料类推导结果（线缆/管材/辅材/其他材料），价格取定额材料表，缺价按材料均价兜底
   * 与材料表（BillEngine.generateProject）同源同口径 → 预算清单显示全部系统的全部分组（含纯材料系统）。
   * 「确认生成清单」才固化新版本（概算清单读快照）。
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

    const rows: {
      projectSystemId?: string
      selectionId?: string
      billItemId?: string
      quantity: number
      unit_price: number
      amount: number
      grade?: string
      item?: {
        deviceName?: string
        deviceCategory?: string
        unit?: string
        item_name?: string
        brandName?: string
        spec?: string
        specification?: string
        detail?: string
        deviceCode?: string
        remark?: string
      }
    }[] = []

    // ① 设备行：当前选型（与换档/批量选型即时联动）
    for (const s of (db[T.device_selections] ?? []) as DeviceSelection[]) {
      if (!psIds.has(s.project_system_id ?? '')) continue
      const m = s.model_id ? modelOf.get(s.model_id) : undefined
      const prod = m ? productOf.get(m.product_id) : undefined
      const bid = m ? brandIdOfModel.get(m.id) : undefined
      rows.push({
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
      })
    }

    // ② 定额材料行：材料类推导结果（source_type=quota）不带入设备选型，作为材料行展示（与材料表 BillEngine 同源：source_type==='quota'）
    const quotaZone = (resultType: string): string => {
      if (resultType === 'conduit' || resultType === 'cable') return 'cable'
      if (resultType === 'aux') return 'aux'
      return 'other'
    }
    // 材料均价兜底：与 BillEngine.generateProject 一致（按产品类别 cable/aux 材料类）
    const productCategory = new Map((db[T.products] ?? []).map((p) => [(p as unknown as { id: string }).id, (p as unknown as { category?: string }).category]))
    const materialModels = (db[T.product_models] ?? []).filter((m) => {
      const cat = (m as unknown as { product_id: string }).product_id ? productCategory.get((m as unknown as { product_id: string }).product_id) : undefined
      return cat === 'cable' || cat === 'aux'
    }) as ProductModel[]
    const avgPrice = materialModels.length
      ? materialModels.reduce((s, m) => s + PricingEngine.getPrice(ctx, m.id), 0) / materialModels.length
      : 0
    const matByName = new Map((db[T.device_materials] ?? []).filter((x) => (x as { enabled?: boolean }).enabled !== false).map((x) => [(x as unknown as { name: string }).name, x as unknown as { brand?: string; model?: string; params?: string; price?: number; unit?: string }]))
    for (const r of (db[T.design_results] ?? []) as DesignResult[]) {
      if (!psIds.has(r.project_system_id) || r.source_type !== 'quota') continue
      const name = (r.rule_snapshot ?? '').replace('定额-', '') || '材料'
      const mat = matByName.get(name)
      const price = mat?.price != null ? mat.price : avgPrice
      rows.push({
        projectSystemId: r.project_system_id,
        quantity: r.quantity,
        unit_price: price,
        amount: Math.round(price * r.quantity * 100) / 100,
        item: {
          deviceName: name,
          deviceCategory: quotaZone(r.result_type),
          unit: mat?.unit ?? r.unit ?? '项',
          brandName: mat?.brand,
          item_name: mat?.model,
          // 通用参数/详细参数：材料品牌/型号/参数规格（明细见 formula_snapshot）
          specification: [mat?.brand, mat?.model, mat?.params].filter(Boolean).join(' '),
          detail: r.formula_snapshot,
          remark: [mat?.brand, mat?.model, mat?.params].filter(Boolean).join(' ') || r.formula_snapshot,
        },
      })
    }
    return rows
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