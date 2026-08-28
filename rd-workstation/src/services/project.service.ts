import { useDB } from '../db/memory-db'
import { T } from '../types/domain'
import type { Project, ProjectSystem, StandardSystem } from '../types/domain'
import { uid } from '../lib/utils'

function nowIso() {
  return new Date().toISOString()
}

/* ---------- 项目 Service ---------- */
export const ProjectService = {
  list(): Project[] {
    return useDB.getState().getTable<Project>(T.projects).filter((p) => !p.archived_at)
  },
  get(id: string): Project | undefined {
    return useDB.getState().getById<Project>(T.projects, id)
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
    useDB.getState().insert(T.projects, p)
    return p
  },
  update(id: string, patch: Partial<Project>) {
    useDB.getState().update(T.projects, id, { ...patch, updated_at: nowIso() })
  },
  remove(id: string) {
    useDB.getState().remove(T.projects, id)
    useDB.getState().removeMany(T.project_systems, (r) => (r as ProjectSystem).project_id === id)
  },

  /** 项目系统（含标准系统名） */
  systems(projectId: string): (ProjectSystem & { systemName: string; systemCode: string })[] {
    const all = useDB.getState().getTable<ProjectSystem>(T.project_systems)
    const sysMap = new Map(useDB.getState().getTable<StandardSystem>(T.systems).map((s) => [s.id, s]))
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
    const existing = useDB.getState().where<ProjectSystem>(
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
      sort_order: useDB.getState().getTable<ProjectSystem>(T.project_systems).filter((s) => s.project_id === projectId).length + 1,
      created_at: nowIso(),
      updated_at: nowIso(),
    }
    useDB.getState().insert(T.project_systems, ps)
    return ps
  },

  removeSystem(psId: string) {
    useDB.getState().remove(T.project_systems, psId)
  },
}