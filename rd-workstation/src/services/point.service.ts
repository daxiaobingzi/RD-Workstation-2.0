import { useDB } from '../db/memory-db'
import { T } from '../types/domain'
import type { Point, PointCategory } from '../types/domain'
import { uid } from '../lib/utils'

function nowIso() {
  return new Date().toISOString()
}

/* ---------- 点位 Service ---------- */
export interface ImportPointRow {
  point_code?: string
  point_name: string
  category_id?: string
  category_name?: string
  floor?: string
  space?: string
  quantity: number
  remark?: string
}

/** 批量导入解析：支持 CSV / TSV / Excel 矩阵（首行可含表头） */
export function parsePointRows(rows: (string | number)[][], categories: PointCategory[]): { rows: ImportPointRow[]; errors: { line: number; message: string }[] } {
  const headerMap: Record<string, keyof ImportPointRow> = {
    named: 'point_name', name: 'point_name', point_name: 'point_name', 点位名称: 'point_name', 点名称: 'point_name', 名称: 'point_name', 点位数: 'point_name',
    category: 'category_name', category_name: 'category_name', 点类型: 'category_name', 点位类别: 'category_name', 类别: 'category_name', 分类: 'category_name', 摄像机类别: 'category_name',
    floor: 'floor', 楼层: 'floor',
    space: 'space', location: 'space', 位置: 'space', 区域: 'space', 区域位置: 'space',
    quantity: 'quantity', qty: 'quantity', count: 'quantity', 数量: 'quantity', 台数: 'quantity',
    remark: 'remark', note: 'remark', 备注: 'remark',
  }
  const nameAlias: Record<string, string> = { point_code: 'point_code', 编号: 'point_code', 点位编号: 'point_code', code: 'point_code' }

  // 类别匹配：名称 / 编码 / id
  const catByName = new Map(categories.map((c) => [c.name, c]))
  const catByCode = new Map(categories.map((c) => [c.code, c]))
  const catById = new Map(categories.map((c) => [c.id, c]))
  const matchCat = (raw: string) => catByName.get(raw) ?? catByCode.get(raw) ?? catById.get(raw) ?? catByName.get(raw.trim())

  const rowsOut: ImportPointRow[] = []
  const errors: { line: number; message: string }[] = []
  if (!rows.length) return { rows: rowsOut, errors }

  const first = rows[0]
  const headerKeys = first.map((c) => String(c).trim())
  const known = headerKeys.some((k) => Object.keys(headerMap).includes(k.toLowerCase()))
  const offset = known ? 1 : 0

  rows.slice(offset).forEach((raw, idx) => {
    const line = idx + offset + 1
    const cell = (i: number) => String(raw[i] ?? '').trim()
    let pointName = ''
    let categoryName = ''
    let floor = ''
    let space = ''
    let quantity = 1
    let remark = ''
    let pointCode: string | undefined

    if (known) {
      headerKeys.forEach((h, i) => {
        const key = headerMap[h.toLowerCase()]
        const v = cell(i)
        if (key === 'point_name') pointName = v
        else if (key === 'category_name') categoryName = v
        else if (key === 'floor') floor = v
        else if (key === 'space') space = v
        else if (key === 'quantity') quantity = Number(v) || 0
        else if (key === 'remark') remark = v
      })
      headerKeys.forEach((h, i) => {
        if (nameAlias[h.toLowerCase()]) pointCode = cell(i) || undefined
      })
    } else {
      pointName = cell(0)
      categoryName = cell(1)
      floor = cell(2)
      space = cell(3)
      quantity = Number(cell(4)) || 0
      remark = cell(5)
      pointCode = undefined
    }

    if (!pointName) {
      errors.push({ line, message: '缺少点位名称，已跳过' })
      return
    }
    if (quantity <= 0) {
      errors.push({ line, message: `「${pointName}」数量无效（${cell(4) || quantity}），已按 1 处理` })
      quantity = 1
    }
    const cat = categoryName ? matchCat(categoryName) : undefined
    rowsOut.push({
      point_code: pointCode,
      point_name: pointName,
      category_id: cat?.id,
      category_name: categoryName || cat?.name,
      floor,
      space,
      quantity,
      remark,
    })
  })
  return { rows: rowsOut, errors }
}

export const PointService = {
  list(psId: string): Point[] {
    return useDB.getState().getTable<Point>(T.points).filter((p) => p.project_system_id === psId)
  },
  categories(systemId: string): PointCategory[] {
    return useDB.getState().where<PointCategory>(T.point_categories, (r) => r.system_id === systemId && r.enabled !== false)
  },
  add(psId: string, data: Partial<Point>): Point {
    const pts = useDB.getState().getTable<Point>(T.points).filter((p) => p.project_system_id === psId)
    const p: Point = {
      id: uid('pt'),
      project_system_id: psId,
      point_code: data.point_code || `VSS-C-${String(pts.length + 1).padStart(3, '0')}`,
      point_name: data.point_name || '新点位',
      category_id: data.category_id,
      building: data.building,
      floor: data.floor,
      space: data.space,
      location: data.location ?? data.space,
      quantity: data.quantity ?? 1,
      unit: data.unit ?? '台',
      design_requirement: data.design_requirement,
      remark: data.remark,
      status: data.status ?? 'designed',
      created_at: nowIso(),
      updated_at: nowIso(),
    }
    useDB.getState().insert(T.points, p)
    return p
  },
  update(id: string, patch: Partial<Point>) {
    useDB.getState().update(T.points, id, { ...patch, updated_at: nowIso() })
  },
  remove(id: string) {
    useDB.getState().remove(T.points, id)
  },
  removeMany(ids: string[]) {
    useDB.getState().removeMany(T.points, (r) => ids.includes(r.id))
  },
  /** 批量导入点位（CSV/Excel 解析后的行） */
  addMany(psId: string, rows: ImportPointRow[]): Point[] {
    const pts = useDB.getState().getTable<Point>(T.points).filter((p) => p.project_system_id === psId)
    const created = rows.map((r, i) => {
      const p: Point = {
        id: uid('pt'),
        project_system_id: psId,
        point_code: r.point_code || (r.point_name.includes('VSS-C-')
          ? r.point_name
          : `VSS-C-${String(pts.length + i + 1).padStart(3, '0')}`),
        point_name: r.point_name,
        category_id: r.category_id,
        floor: r.floor,
        space: r.space,
        location: r.space,
        quantity: r.quantity || 1,
        unit: '台',
        remark: r.remark,
        status: 'designed',
        created_at: nowIso(),
        updated_at: nowIso(),
      }
      return p
    })
    useDB.getState().insertMany(T.points, created)
    return created
  },

  /** 批量导入模板（含示例行） */
  importTemplate(): string {
    return ['点位名称,类别,楼层,位置,数量,备注', '大厅高清枪机,室内摄像机,1F,大堂,12,标准档', '走廊半球,室内摄像机,2F,走廊,8,'].join('\n')
  },
  updateMany(updates: { id: string; patch: Partial<Point> }[]) {
    const { update } = useDB.getState()
    updates.forEach(({ id, patch }) => update(T.points, id, { ...patch, updated_at: nowIso() }))
  },
}