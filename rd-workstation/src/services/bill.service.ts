import { repository } from '../db/memory-db'
import { T } from '../types/domain'
import type { BillItem, BillVersion } from '../types/domain'
import { BillEngine } from '../engines'
import ctx from './ctx'

/* ---------- 清单 Service ---------- */
export const BillService = {
  generate(psId: string, projectId: string) {
    const { version, items } = BillEngine.generate(ctx, psId, projectId)
    repository.insert(T.bill_versions, version)
    repository.insertMany(T.bill_items, items)
    return { version, items }
  },
  versions(projectId: string): BillVersion[] {
    return repository
      .where<BillVersion>(T.bill_versions, (r) => r.project_id === projectId)
      .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
  },
  items(billVersionId: string): BillItem[] {
    return repository
      .where<BillItem>(T.bill_items, (r) => r.bill_version_id === billVersionId)
      .sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999))
  },
  /** 手工调整清单项（数量 / 单价 / 排序），自动重算金额 */
  updateItem(id: string, patch: Partial<Pick<BillItem, 'quantity' | 'unit_price' | 'sort_order'>>) {
    const it = repository.getById<BillItem>(T.bill_items, id)
    if (!it) return
    const quantity = patch.quantity ?? it.quantity
    const unitPrice = patch.unit_price ?? it.unit_price
    repository.update(T.bill_items, id, {
      quantity,
      unit_price: unitPrice,
      amount: quantity * unitPrice,
      ...(patch.sort_order != null ? { sort_order: patch.sort_order } : {}),
    })
  },
  /** 按类别汇总（供分类小计） */
  summary(billVersionId: string): { category: string; count: number; quantity: number; amount: number }[] {
    const agg = new Map<string, { count: number; quantity: number; amount: number }>()
    for (const i of this.items(billVersionId)) {
      const key = i.category || '未分类'
      const cur = agg.get(key) ?? { count: 0, quantity: 0, amount: 0 }
      cur.count += 1
      cur.quantity += i.quantity || 0
      cur.amount += i.amount || 0
      agg.set(key, cur)
    }
    return [...agg.entries()]
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.amount - a.amount)
  },
  /** 导出 CSV（含 BOM，Excel 直接打开不乱码） */
  exportCSV(billVersionId: string): string {
    const esc = (v: unknown) => {
      const s = String(v ?? '')
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const head = ['编码', '名称', '规格', '类别', '单位', '数量', '单价', '金额']
    const lines = this.items(billVersionId).map((i) =>
      [i.item_code, i.item_name, i.specification, i.category, i.unit, i.quantity, i.unit_price, i.amount].map(esc).join(','),
    )
    return '\uFEFF' + [head.join(','), ...lines].join('\n')
  },
  remove(versionId: string) {
    repository.remove(T.bill_versions, versionId)
    repository.removeMany(T.bill_items, (r) => (r as BillItem).bill_version_id === versionId)
  },
  /** 版本对比：added / removed / changed（按 item_code 匹配） */
  compareVersions(v1Id: string, v2Id: string) {
    const items1 = this.items(v1Id)
    const items2 = this.items(v2Id)
    const key = (i: BillItem) => i.item_code ?? i.id
    const map1 = new Map(items1.map((i) => [key(i), i]))
    const map2 = new Map(items2.map((i) => [key(i), i]))
    const added = items2.filter((i) => !map1.has(key(i)))
    const removed = items1.filter((i) => !map2.has(key(i)))
    const changed = items2.filter((i) => {
      const a = map1.get(key(i))
      return !!a && (a.quantity !== i.quantity || a.unit_price !== i.unit_price)
    })
    return { added, removed, changed }
  },
}