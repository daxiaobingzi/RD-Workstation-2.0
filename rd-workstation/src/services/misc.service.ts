import { useDB } from '../db/memory-db'
import { T } from '../types/domain'
import type { Task, Schedule, KnowledgeItem } from '../types/domain'
import { uid, todayISO } from '../lib/utils'

function nowIso() {
  return new Date().toISOString()
}

/* ---------- 任务 / 日程 / 知识 Service ---------- */
export const TaskService = {
  list(filter?: { projectId?: string; today?: boolean }): Task[] {
    let rows = useDB.getState().getTable<Task>(T.tasks)
    if (filter?.projectId) rows = rows.filter((t) => t.project_id === filter.projectId)
    if (filter?.today) {
      const d = todayISO()
      rows = rows.filter((t) => (t.due_at ?? '').slice(0, 10) === d || (t.created_at ?? '').slice(0, 10) === d)
    }
    return rows.sort((a, b) => (a.due_at ?? '').localeCompare(b.due_at ?? ''))
  },
  toggle(id: string) {
    const t = useDB.getState().getById<Task>(T.tasks, id)
    if (!t) return
    const done = t.status === 'done'
    useDB.getState().update(T.tasks, id, {
      status: done ? 'todo' : 'done',
      completed_at: done ? null : nowIso(),
      updated_at: nowIso(),
    })
  },
  add(data: Partial<Task>): Task {
    const t: Task = {
      id: uid('task'), title: data.title || '新任务', description: data.description,
      status: data.status ?? 'todo', priority: data.priority ?? 'medium',
      source_type: data.source_type, source_id: data.source_id,
      project_id: data.project_id, project_system_id: data.project_system_id, goal_id: data.goal_id,
      estimated_minutes: data.estimated_minutes, due_at: data.due_at,
      created_at: nowIso(), updated_at: nowIso(),
    }
    useDB.getState().insert(T.tasks, t)
    return t
  },
}

export const ScheduleService = {
  list(date?: string): Schedule[] {
    return useDB.getState().getTable<Schedule>(T.schedules).filter((s) => !date || s.start_at.slice(0, 10) === date)
  },
}

export const KnowledgeService = {
  list(): KnowledgeItem[] {
    return useDB.getState().getTable<KnowledgeItem>(T.knowledge_items)
  },
}