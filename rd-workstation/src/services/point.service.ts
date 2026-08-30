import { repository } from '../db/memory-db'
import { T } from '../types/domain'
import type { Point, StandardSystem, ProjectSystem, Revision } from '../types/domain'
import { uid } from '../lib/utils'
import { DeviceProductOptions, type ProductOption } from './device.catalog'
import { ProjectService } from './project.service'

function nowIso() {
  return new Date().toISOString()
}

/** 写一条点位快照（版本 tab / 最近修改 数据源） */
function writeSnapshot(point: Point, action: 'create' | 'update' | 'delete', summary: string) {
  const rev: Revision = {
    id: uid('rev'),
    entity_type: 'point',
    entity_id: point.id,
    snapshot_json: point,
    change_type: action,
    change_summary: summary,
    created_at: nowIso(),
  }
  repository.insert(T.revisions, rev)
}

/* ---------- 点位 Service（点位 = 设备名称 + 建筑 + 弱电间 + 数量） ---------- */
export interface PointDraft {
  point_code?: string
  device_id: string
  building_id?: string
  telecom_room_id?: string
  quantity: number
  unit?: string
}

export interface ImportPointRow {
  point_code?: string
  device_name?: string
  building_name?: string
  telecom_room_name?: string
  quantity: number
}

/** 点位展示行：附加设备 / 建筑 / 弱电间名称 */
export interface AttachedPoint extends Point {
  deviceName?: string
  deviceFamily?: string
  buildingName?: string
  telecomRoomName?: string
}

/** 批量导入解析：支持 CSV / TSV / Excel 矩阵（首行可含表头）。列：设备名称,建筑,弱电间,数量 */
export function parsePointRows(
  rows: (string | number)[][],
  opts: { deviceOptions: ProductOption[]; projectId: string },
): { rows: ImportPointRow[]; errors: { line: number; message: string }[] } {
  const headerMap: Record<string, keyof ImportPointRow> = {
    device: 'device_name', device_name: 'device_name', name: 'device_name', 设备名称: 'device_name', 设备名: 'device_name', 设备: 'device_name',
    building: 'building_name', building_name: 'building_name', 建筑: 'building_name', 楼栋: 'building_name',
    telecom: 'telecom_room_name', telecom_room: 'telecom_room_name', 弱电间: 'telecom_room_name', 弱电房: 'telecom_room_name',
    quantity: 'quantity', qty: 'quantity', count: 'quantity', 数量: 'quantity', 台数: 'quantity',
  }
  const codeAlias: Record<string, string> = { point_code: 'point_code', 编号: 'point_code', 点位编号: 'point_code', code: 'point_code' }

  /** 设备名称匹配：精确 → 全名 contains → searchText contains（取第一个） */
  const matchDevice = (raw: string): ProductOption | undefined => {
    const name = raw.trim()
    if (!name) return undefined
    const exact = opts.deviceOptions.find((o) => o.name === name || o.name.includes(name) || name.includes(o.name))
    if (exact) return exact
    const kw = name.toLowerCase()
    return opts.deviceOptions.find((o) => o.searchText.toLowerCase().includes(kw))
  }

  const rowsOut: ImportPointRow[] = []
  const errors: { line: number; message: string }[] = []
  if (!rows.length) return { rows: rowsOut, errors }

  const first = rows[0]
  const headerKeys = first.map((c) => String(c).trim())
  const known = headerKeys.some((k) => Object.keys(headerMap).includes(k.toLowerCase()) || Object.keys(codeAlias).includes(k.toLowerCase()))
  const offset = known ? 1 : 0

  rows.slice(offset).forEach((raw, idx) => {
    const line = idx + offset + 1
    const cell = (i: number) => String(raw[i] ?? '').trim()
    const row: ImportPointRow = { quantity: 1 }

    if (known) {
      headerKeys.forEach((h, i) => {
        const key = headerMap[h.toLowerCase()]
        const v = cell(i)
        if (key === 'device_name') row.device_name = v
        else if (key === 'building_name') row.building_name = v
        else if (key === 'telecom_room_name') row.telecom_room_name = v
        else if (key === 'quantity') row.quantity = Number(v) || 0
        else if (codeAlias[h.toLowerCase()]) row.point_code = v || undefined
      })
    } else {
      row.device_name = cell(0)
      row.building_name = cell(1)
      row.telecom_room_name = cell(2)
      row.quantity = Number(cell(3)) || 0
    }

    if (!row.device_name) {
      errors.push({ line, message: '缺少设备名称，已跳过' })
      return
    }
    if (!matchDevice(row.device_name)) {
      errors.push({ line, message: `设备「${row.device_name}」不在设备中心，已跳过` })
      return
    }
    if (row.quantity <= 0) {
      errors.push({ line, message: `「${row.device_name}」数量无效，已按 1 处理` })
      row.quantity = 1
    }
    rowsOut.push(row)
  })
  return { rows: rowsOut, errors }
}

/** 系统编码（点位编号前缀） */
function systemCodeOf(psId: string): string {
  const ps = repository.getById<ProjectSystem>(T.project_systems, psId)
  const sys = ps ? repository.getById<StandardSystem>(T.systems, ps.system_id) : undefined
  return sys?.code ?? 'PT'
}

export const PointService = {
  list(psId: string): Point[] {
    return repository
      .getTable<Point>(T.points)
      .filter((p) => p.project_system_id === psId)
      .sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999) || (a.point_code ?? '').localeCompare(b.point_code ?? ''))
  },

  /** 项目级点位（v2 点表）：本项目全部子系统的点位，附 系统名/系统编码 与 设备/建筑/弱电间名 */
  allByProject(projectId: string): (AttachedPoint & { systemName: string; systemCode: string })[] {
    const pss = repository
      .getTable<ProjectSystem>(T.project_systems)
      .filter((s) => s.project_id === projectId)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    const sysMap = new Map(repository.getTable<StandardSystem>(T.systems).map((s) => [s.id, s]))
    const out: (AttachedPoint & { systemName: string; systemCode: string })[] = []
    for (const ps of pss) {
      const sys = sysMap.get(ps.system_id)
      for (const p of PointService.attach(PointService.list(ps.id))) {
        out.push({ ...p, systemName: sys?.name ?? '未知系统', systemCode: sys?.code ?? '' })
      }
    }
    // 同系统内保持点位编号稳定，跨系统按系统序
    return out
  },

  /** 汇总点位所在的项目 id（用于结构解析 / 最近使用） */
  projectIdOf(psId: string): string {
    return repository.getById<ProjectSystem>(T.project_systems, psId)?.project_id ?? ''
  },

  /** 附加名称：设备 / 建筑 / 弱电间 */
  attach(points: Point[]): AttachedPoint[] {
    const projIds = new Set(points.map((p) => PointService.projectIdOf(p.project_system_id)))
    const projectId = [...projIds][0] ?? ''
    const deviceName = new Map<string, { name: string; family?: string }>()
    for (const o of DeviceProductOptions.list()) deviceName.set(o.id, { name: o.name, family: o.familyName })
    const { buildingOf, telecomNameOf } = DeviceProductOptions.structureNamesOf(projectId)
    return points.map((p) => ({
      ...p,
      deviceName: deviceName.get(p.device_id)?.name,
      deviceFamily: deviceName.get(p.device_id)?.family,
      buildingName: p.building_id ? buildingOf.get(p.building_id) : undefined,
      telecomRoomName: p.telecom_room_id ? telecomNameOf.get(p.telecom_room_id) : undefined,
    }))
  },

  /** 当前项目最近使用的设备 id（按点位更新时间倒序） */
  recentDeviceIds(psId: string, limit = 8): string[] {
    return DeviceProductOptions.recentByProjectId(PointService.projectIdOf(psId), limit)
  },

  add(psId: string, draft: PointDraft): Point {
    const pts = repository.getTable<Point>(T.points).filter((p) => p.project_system_id === psId)
    const p: Point = {
      id: uid('pt'),
      project_system_id: psId,
      point_code: draft.point_code || `${systemCodeOf(psId)}-${String(pts.length + 1).padStart(3, '0')}`,
      device_id: draft.device_id,
      building_id: draft.building_id,
      telecom_room_id: draft.telecom_room_id,
      quantity: draft.quantity ?? 1,
      unit: draft.unit ?? '台',
      status: 'designed',
      created_at: nowIso(),
      updated_at: nowIso(),
    }
    repository.insert(T.points, p)
    writeSnapshot(p, 'create', `新增点位 ${p.point_code}`)
    return p
  },

  update(id: string, patch: Partial<Point>) {
    const old = repository.getById<Point>(T.points, id)
    repository.update(T.points, id, { ...patch, updated_at: nowIso() })
    if (old) writeSnapshot({ ...old, ...patch }, 'update', `更新点位 ${old.point_code}`)
  },

  remove(id: string) {
    const old = repository.getById<Point>(T.points, id)
    repository.remove(T.points, id)
    if (old) writeSnapshot(old, 'delete', `删除点位 ${old.point_code}`)
  },

  removeMany(ids: string[]) {
    const removed = repository.getTable<Point>(T.points).filter((p) => ids.includes(p.id))
    repository.removeMany(T.points, (r) => ids.includes(r.id))
    removed.forEach((p) => writeSnapshot(p, 'delete', `删除点位 ${p.point_code}`))
  },

  /** 批量新增（草稿已含解析后的 id） */
  addMany(psId: string, drafts: PointDraft[]): Point[] {
    const pts = repository.getTable<Point>(T.points).filter((p) => p.project_system_id === psId)
    const created = drafts.map((d, i) => {
      const p: Point = {
        id: uid('pt'),
        project_system_id: psId,
        point_code: d.point_code || `${systemCodeOf(psId)}-${String(pts.length + i + 1).padStart(3, '0')}`,
        device_id: d.device_id,
        building_id: d.building_id,
        telecom_room_id: d.telecom_room_id,
        quantity: d.quantity || 1,
        unit: d.unit ?? '台',
        status: 'designed',
        created_at: nowIso(),
        updated_at: nowIso(),
      }
      return p
    })
    repository.insertMany(T.points, created)
    created.forEach((p) => writeSnapshot(p, 'create', `新增点位 ${p.point_code}`))
    return created
  },

  /** 批量修改（改设备 / 移动建筑 / 移动弱电间）：同一 patch 应用到多行 */
  batchSet(ids: string[], patch: Partial<Point>) {
    const { update } = repository
    ids.forEach((id) => {
      const old = repository.getById<Point>(T.points, id)
      update(T.points, id, { ...patch, updated_at: nowIso() })
      if (old) writeSnapshot({ ...old, ...patch }, 'update', `批量更新点位 ${old.point_code}`)
    })
  },

  /** 批量导入：按名称解析设备与结构，缺失的建筑/弱电间自动建档 */
  importRows(psId: string, rows: ImportPointRow[]): { created: Point[]; errors: { line?: number; message: string }[] } {
    const projectId = PointService.projectIdOf(psId)
    const errors: { line?: number; message: string }[] = []
    const drafts: PointDraft[] = []

    const findOrCreate = {
      building: (name: string) => {
        if (!name) return undefined
        const bs = ProjectService.buildings(projectId)
        const found = bs.find((b) => b.name === name)
        if (found) return found
        return ProjectService.addBuilding(projectId, name)
      },
      telecom: (buildingId: string, name: string) => {
        if (!buildingId || !name) return undefined
        const rooms = ProjectService.telecomRooms(buildingId)
        const found = rooms.find((r) => r.name === name)
        if (found) return found
        return ProjectService.addTelecomRoom(buildingId, name)
      },
    }

    const resolveOne = (r: ImportPointRow): { ok: boolean; message?: string } => {
      const option = [...DeviceProductOptions.list()].find((o) => o.name === r.device_name || r.device_name?.includes(o.name))
        ?? [...DeviceProductOptions.list()].find((o) => r.device_name && o.searchText.toLowerCase().includes(r.device_name.toLowerCase()))
      if (!option) return { ok: false, message: `设备「${r.device_name}」不在设备中心，已跳过` }
      const building = findOrCreate.building(r.building_name ?? '')
      const telecom = building ? findOrCreate.telecom(building.id, r.telecom_room_name ?? '') : undefined
      drafts.push({
        point_code: r.point_code,
        device_id: option.id,
        building_id: building?.id,
        telecom_room_id: telecom?.id,
        quantity: r.quantity || 1,
      })
      return { ok: true }
    }

    rows.forEach((r) => {
      const res = resolveOne(r)
      if (!res.ok) errors.push({ message: res.message ?? '解析失败' })
    })
    const created = PointService.addMany(psId, drafts)
    return { created, errors }
  },

  /** 批量导入模板（含示例行） */
  importTemplate(): string {
    return ['设备名称,建筑,弱电间,数量', '红外半球摄像机,A栋,1F-IDF,12', '高清枪型摄像机,A栋,,18'].join('\n')
  },

  updateMany(updates: { id: string; patch: Partial<Point> }[]) {
    const { update } = repository
    updates.forEach(({ id, patch }) => update(T.points, id, { ...patch, updated_at: nowIso() }))
  },
}