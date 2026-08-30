import type * as XLSXNS from 'xlsx'
import { repository } from '../../db/memory-db'
import { T } from '../../types/domain'
import { BillService } from '../../services'

type Workbook = XLSXNS.WorkBook

const CATEGORY_LABEL: Record<string, string> = {
  front: '前端设备', back: '后端设备', cable: '管材线缆', aux: '辅材', other: '其他',
}

const HEAD = ['编码', '设备名称', '通用参数', '单位', '数量', '品牌', '型号', '详细参数', '单价', '金额']

type RichItem = ReturnType<typeof BillService.items>[number]

/** 将版本 items 组织为「系统 → 五区」分级的矩阵（方式一 主 Sheet 与 方式二 每系统 Sheet 共用） */
function buildSystemMatrix(items: RichItem[]): { rows: unknown[][]; bySystem: Map<string, { systemName: string; amount: number }> } {
  const bySystem = new Map<string, { systemName: string; amount: number }>()
  for (const i of items) {
    const key = i.project_system_id ?? '__none__'
    const cur = bySystem.get(key) ?? { systemName: projectSystemName(i.project_system_id), amount: 0 }
    cur.amount += i.amount || 0
    bySystem.set(key, cur)
  }
  const rows: unknown[][] = [HEAD]
  for (const psId of bySystem.keys()) {
    const sysItems = items.filter((i) => (i.project_system_id ?? '__none__') === psId)
    const info = bySystem.get(psId)!
    rows.push([`【${info.systemName}】`])
    const cats = ['front', 'back', 'cable', 'aux', 'other']
    for (const c of cats) {
      const inCat = sysItems.filter((i) => i.deviceCategory === c)
      if (!inCat.length) continue
      rows.push([`${CATEGORY_LABEL[c] ?? c}`])
      for (const i of inCat) {
        rows.push([i.item_code, i.deviceName ?? i.item_name, i.spec ?? i.specification, i.unit, i.quantity, i.brandName, i.item_name, i.detail, i.unit_price, i.amount])
      }
    }
  }
  return { rows, bySystem }
}

function groupRows(items: RichItem[]) {
  return buildSystemMatrix(items)
}

/** 汇总 sheet：系统 × 类别小计 + 总计（两模式共用） */
function buildSummary(items: RichItem[]): unknown[][] {
  const head = ['系统', '类别', '数量', '金额']
  const out: unknown[][] = [head]
  const bySys = new Map<string, Map<string, { quantity: number; amount: number }>>()
  let grandQty = 0
  let grandAmount = 0
  for (const i of items) {
    const key = i.project_system_id ?? '__none__'
    let catMap = bySys.get(key)
    if (!catMap) { catMap = new Map(); bySys.set(key, catMap) }
    const cat = CATEGORY_LABEL[i.deviceCategory ?? 'other'] ?? '其他'
    let row = catMap.get(cat)
    if (!row) { row = { quantity: 0, amount: 0 }; catMap.set(cat, row) }
    row.quantity += i.quantity || 0
    row.amount += i.amount || 0
    grandQty += i.quantity || 0
    grandAmount += i.amount || 0
  }
  for (const [psId, catMap] of bySys) {
    for (const [cat, r] of catMap) {
      out.push([projectSystemName(psId), cat, r.quantity, Math.round(r.amount * 100) / 100])
    }
  }
  out.push(['总计', '', grandQty, Math.round(grandAmount * 100) / 100])
  return out
}

function projectSystemName(psId?: string): string {
  if (!psId) return '未归入系统'
  const db = repository.db
  const ps = db[T.project_systems].find((r) => (r as { id: string }).id === psId) as { system_id: string } | undefined
  const sys = ps ? db[T.systems].find((s) => (s as { id: string }).id === ps.system_id) : undefined
  return (sys as { name?: string } | undefined)?.name ?? '未知系统'
}

async function writeWorkbook(wb: Workbook, projectId: string, label: string) {
  const XLSX = await import('xlsx')
  const bin = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([bin], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${projectId}-清单-${label}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

/** 方式一 · 整表分组：1 主 Sheet（全系统五区平铺）+ 1 汇总 Sheet */
export async function exportBillFlat(projectId: string, versionId: string) {
  const XLSX = await import('xlsx')
  const items = BillService.items(versionId)
  const { rows } = groupRows(items)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), '清单')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildSummary(items)), '汇总')
  await writeWorkbook(wb, projectId, '整表')
}

/** 方式二 · 每系统一表：每系统 1 Sheet（五区分组行）+ 1 汇总 Sheet */
export async function exportBillSplit(projectId: string, versionId: string) {
  const XLSX = await import('xlsx')
  const items = BillService.items(versionId)
  const { bySystem } = groupRows(items)
  const wb = XLSX.utils.book_new()
  for (const psId of bySystem.keys()) {
    const sysItems = items.filter((i) => (i.project_system_id ?? '__none__') === psId)
    const { rows } = buildSystemMatrix(sysItems)
    const name = projectSystemName(psId).slice(0, 28)
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name)
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildSummary(items)), '汇总')
  await writeWorkbook(wb, projectId, '分系统')
}