import { repository } from '../db/memory-db'
import { T } from '../types/domain'
import type { Project, ProjectSystem, StandardSystem, Building, TelecomRoom } from '../types/domain'
import { uid } from '../lib/utils'

function nowIso() {
  return new Date().toISOString()
}

/** 备份表名白名单（T 常量覆盖的业务表） */
const TABLE_NAMES = new Set<string>(Object.values(T))
function dbTableExists(name: string) {
  return TABLE_NAMES.has(name)
}

/* ---------- 项目 Service ---------- */
export const ProjectService = {
  list(): Project[] {
    return repository
      .getTable<Project>(T.projects)
      .filter((p) => !p.archived_at)
      .sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999))
  },
  /** 已归档项目（按归档时间倒序，供"已归档"视图使用；get/list 行为不变） */
  listArchived(): Project[] {
    return repository
      .getTable<Project>(T.projects)
      .filter((p) => !!p.archived_at)
      .sort((a, b) => (b.archived_at ?? '').localeCompare(a.archived_at ?? ''))
  },
  /** 归档项目：写入 archived_at 后，list / 今日工作台 / 清单 / 设计选择器均自动排除 */
  archive(id: string) {
    repository.update(T.projects, id, { archived_at: nowIso() })
  },
  /** 恢复归档项目：清空 archived_at（合并 patch 置 undefined，!archived_at 过滤对 undefined 生效） */
  restore(id: string) {
    repository.update(T.projects, id, { archived_at: undefined })
  },
  get(id: string): Project | undefined {
    return repository.getById<Project>(T.projects, id)
  },
  create(data: Partial<Project>): Project {
    const p: Project = {
      id: uid('proj'),
      project_code: data.project_code || `PJ-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`,
      name: data.name || '未命名项目',
      project_type: data.project_type,
      building_type: data.building_type,
      client_name: data.client_name,
      location: data.location,
      building_area: data.building_area,
      floor_count: data.floor_count,
      design_stage: data.design_stage || '方案',
      status: data.status || 'draft',
      default_grade_code: data.default_grade_code || 'standard',
      start_date: data.start_date,
      planned_end_date: data.planned_end_date,
      description: data.description,
      created_at: nowIso(),
      updated_at: nowIso(),
    }
    repository.insert(T.projects, p)
    return p
  },
  update(id: string, patch: Partial<Project>) {
    repository.update(T.projects, id, { ...patch, updated_at: nowIso() })
  },
  /** 删除项目：级联清除本项目全部关联数据（系统/点位/推导/选型/任务/日程/清单/预算/文档/版本快照） */
  remove(id: string) {
    const psIds = new Set(
      repository.getTable<ProjectSystem>(T.project_systems).filter((r) => r.project_id === id).map((r) => r.id),
    )
    const bldIds = new Set(
      repository.getTable<Building>(T.buildings).filter((r) => r.project_id === id).map((r) => r.id),
    )
    const roomIds = new Set(
      repository.getTable<TelecomRoom>(T.telecom_rooms).filter((r) => bldIds.has(r.building_id)).map((r) => r.id),
    )
    const billIds = new Set(
      repository.getTable<{ id: string; project_id?: string }>(T.bill_versions).filter((r) => r.project_id === id).map((r) => r.id),
    )
    const budgetIds = new Set(
      repository.getTable<{ id: string; project_id?: string }>(T.budgets).filter((r) => r.project_id === id).map((r) => r.id),
    )
    const hasPs = (psId?: string) => !!psId && psIds.has(psId)
    const hasBld = (bldId?: string) => !!bldId && bldIds.has(bldId)
    const hasRoom = (roomId?: string) => !!roomId && roomIds.has(roomId)

    // 项目本身
    repository.remove(T.projects, id)
    // 项目系统/空间结构
    repository.removeMany(T.project_systems, (r) => (r as ProjectSystem).project_id === id)
    repository.removeMany(T.buildings, (r) => (r as Building).project_id === id)
    repository.removeMany(T.telecom_rooms, (r) => hasBld((r as TelecomRoom).building_id))
    // 设计域（按系统/建筑/弱电间归属）
    repository.removeMany(T.design_parameters, (r) => hasPs((r as { project_system_id?: string }).project_system_id))
    repository.removeMany(T.points, (r) => hasPs((r as { project_system_id?: string }).project_system_id) || hasRoom((r as { telecom_room_id?: string }).telecom_room_id))
    repository.removeMany(T.design_results, (r) => hasPs((r as { project_system_id?: string }).project_system_id))
    repository.removeMany(T.device_selections, (r) => hasPs((r as { project_system_id?: string }).project_system_id))
    // 任务/日程
    repository.removeMany(T.tasks, (r) => (r as { project_id?: string }).project_id === id)
    repository.removeMany(T.schedules, (r) => (r as { project_id?: string }).project_id === id || hasPs((r as { project_system_id?: string }).project_system_id))
    // 清单/预算
    repository.removeMany(T.bill_versions, (r) => (r as { project_id?: string }).project_id === id)
    repository.removeMany(T.bill_items, (r) => billIds.has((r as { bill_version_id?: string }).bill_version_id ?? ''))
    repository.removeMany(T.budgets, (r) => (r as { project_id?: string }).project_id === id)
    repository.removeMany(T.budget_items, (r) => budgetIds.has((r as { budget_id?: string }).budget_id ?? ''))
    // 文档 / 点位快照（revisions）
    repository.removeMany(T.documents, (r) => (r as { project_id?: string }).project_id === id)
    repository.removeMany(T.revisions, (r) => {
      const snap = (r as { snapshot_json?: { project_system_id?: string } }).snapshot_json
      return (r as { entity_type?: string }).entity_type === 'point' && hasPs(snap?.project_system_id)
    })
  },

  /** 项目系统（含标准系统名） */
  systems(projectId: string): (ProjectSystem & { systemName: string; systemCode: string })[] {
    const all = repository.getTable<ProjectSystem>(T.project_systems)
    const sysMap = new Map(repository.getTable<StandardSystem>(T.systems).map((s) => [s.id, s]))
    return all
      .filter((ps) => ps.project_id === projectId)
      .map((ps) => ({
        ...ps,
        systemName: sysMap.get(ps.system_id)?.name ?? '未知系统',
        systemCode: sysMap.get(ps.system_id)?.code ?? '',
      }))
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  },

  addSystem(projectId: string, systemId: string, grade?: string): ProjectSystem {
    const existing = repository.where<ProjectSystem>(
      T.project_systems,
      (r) => r.project_id === projectId && r.system_id === systemId,
    )
    if (existing.length) return existing[0]
    const ps: ProjectSystem = {
      id: uid('ps'),
      project_id: projectId,
      system_id: systemId,
      status: 'draft',
      progress: 0,
      design_grade: grade,
      sort_order: repository.getTable<ProjectSystem>(T.project_systems).filter((s) => s.project_id === projectId).length + 1,
      created_at: nowIso(),
      updated_at: nowIso(),
    }
    repository.insert(T.project_systems, ps)
    return ps
  },

  removeSystem(psId: string) {
    repository.remove(T.project_systems, psId)
  },
  /** 项目系统更新（行拖拽排序写 sort_order 等） */
  updateSystem(id: string, patch: Partial<ProjectSystem>) {
    repository.update(T.project_systems, id, { ...patch, updated_at: nowIso() })
  },

  /* ---------- 项目空间结构：建筑 → 区域 / 弱电间 ---------- */
  buildings(projectId: string): Building[] {
    return repository
      .getTable<Building>(T.buildings)
      .filter((b) => b.project_id === projectId && b.enabled !== false)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  },
  addBuilding(projectId: string, name: string): Building {
    const bs = this.buildings(projectId)
    const b: Building = {
      id: uid('bld'),
      project_id: projectId,
      name: name || `建筑${bs.length + 1}`,
      sort_order: bs.length + 1,
      enabled: true,
      created_at: nowIso(),
      updated_at: nowIso(),
    }
    repository.insert(T.buildings, b)
    return b
  },
  updateBuilding(id: string, patch: Partial<Building>) {
    repository.update(T.buildings, id, { ...patch, updated_at: nowIso() })
  },
  removeBuilding(id: string): { ok: boolean; reason?: string } {
    const roomCnt = this.telecomRooms(id).length
    if (roomCnt) return { ok: false, reason: `该建筑下仍有 ${roomCnt} 个弱电间，请先清空` }
    repository.remove(T.buildings, id)
    return { ok: true }
  },

  telecomRooms(buildingId: string): TelecomRoom[] {
    return repository
      .getTable<TelecomRoom>(T.telecom_rooms)
      .filter((r) => r.building_id === buildingId && r.enabled !== false)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  },
  addTelecomRoom(buildingId: string, name: string): TelecomRoom {
    const rooms = this.telecomRooms(buildingId)
    const r: TelecomRoom = { id: uid('tr'), building_id: buildingId, name: name || `弱电间${rooms.length + 1}`, sort_order: rooms.length + 1, enabled: true }
    repository.insert(T.telecom_rooms, r)
    return r
  },
  updateTelecomRoom(id: string, patch: Partial<TelecomRoom>) {
    repository.update(T.telecom_rooms, id, patch)
  },
  removeTelecomRoom(id: string): { ok: boolean; reason?: string } {
    const inUse = repository.getTable<{ telecom_room_id?: string }>(T.points).some((p) => p.telecom_room_id === id)
    if (inUse) return { ok: false, reason: '该弱电间仍有点位引用，请先调整点位' }
    repository.remove(T.telecom_rooms, id)
    return { ok: true }
  },

  /* ---------- 项目备份：导出 / 导入（§50 .rdw 骨架，JSON 项目包） ---------- */
  /** 导出该项目涉及的全部业务表为 JSON 字符串 */
  exportBackup(projectId: string): string {
    const db = repository.db
    const systems = repository.getTable<ProjectSystem>(T.project_systems).filter((s) => s.project_id === projectId)
    const psIds = new Set(systems.map((s) => s.id))
    const buildings = repository.getTable<Building>(T.buildings).filter((b) => b.project_id === projectId)
    const bldIds = new Set(buildings.map((b) => b.id))
    const billVersions = repository.getTable<{ id: string; project_id?: string }>(T.bill_versions).filter((v) => v.project_id === projectId)
    const billIds = new Set(billVersions.map((v) => v.id))
    const budgets = repository.getTable<{ id: string; project_id?: string }>(T.budgets).filter((b) => b.project_id === projectId)
    const budgetIds = new Set(budgets.map((b) => b.id))

    const pick = (table: string, pred: (r: { [k: string]: unknown }) => boolean) => (db[table] ?? []).filter((r) => pred(r as { [k: string]: unknown }))

    const payload: Record<string, unknown[]> = {
      projects: pick(T.projects, (r) => r.id === projectId),
      buildings: pick(T.buildings, (r) => r.project_id === projectId),
      telecom_rooms: pick(T.telecom_rooms, (r) => bldIds.has(r.building_id as string)),
      project_systems: pick(T.project_systems, (r) => r.project_id === projectId),
      design_parameters: pick(T.design_parameters, (r) => psIds.has(r.project_system_id as string)),
      points: pick(T.points, (r) => psIds.has(r.project_system_id as string)),
      design_results: pick(T.design_results, (r) => psIds.has(r.project_system_id as string)),
      device_selections: pick(T.device_selections, (r) => psIds.has(r.project_system_id as string)),
      tasks: pick(T.tasks, (r) => r.project_id === projectId),
      schedules: pick(T.schedules, (r) => r.project_id === projectId || !!(r.project_system_id && psIds.has(r.project_system_id as string))),
      bill_versions: billVersions,
      bill_items: pick(T.bill_items, (r) => billIds.has(r.bill_version_id as string)),
      budgets: budgets,
      budget_items: pick(T.budget_items, (r) => budgetIds.has(r.budget_id as string)),
      documents: pick(T.documents, (r) => r.project_id === projectId),
      revisions: pick(T.revisions, (r) => {
        // 只导出本项目点位快照
        const snap = r.snapshot_json as { project_system_id?: string } | undefined
        return r.entity_type === 'point' && Boolean(snap?.project_system_id && psIds.has(snap.project_system_id))
      }),
    }
    return JSON.stringify({ app: 'rd-workstation', version: 1, exported_at: new Date().toISOString(), project_id: projectId, tables: payload })
  },

  /** 导入项目备份 JSON：按 id 逐行 upsert（已存在覆盖，不存在插入） */
  importBackup(json: string): { ok: boolean; message?: string } {
    let data: { project_id: string; tables: Record<string, { id: string }[]> }
    try {
      data = JSON.parse(json)
      if (!data?.tables || typeof data.tables !== 'object') return { ok: false, message: '备份文件格式不正确' }
    } catch {
      return { ok: false, message: '备份文件无法解析' }
    }
    for (const [table, rows] of Object.entries(data.tables)) {
      if (!Array.isArray(rows) || !dbTableExists(table)) continue
      const existing = new Map(repository.getTable<{ id: string }>(table).map((r) => [r.id, r]))
      for (const row of rows) {
        if (!row || typeof row.id !== 'string') continue
        if (existing.has(row.id)) repository.update(table, row.id, row)
        else repository.insert(table, row)
      }
    }
    return { ok: true, message: `已导入项目备份（${data.project_id}）` }
  },
}