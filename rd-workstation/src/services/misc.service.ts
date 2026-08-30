import { repository } from '../db/memory-db'
import { T } from '../types/domain'
import type { Task, Schedule, KnowledgeItem, Document, Revision, Goal, ActivityLog } from '../types/domain'
import { uid, todayISO } from '../lib/utils'

function nowIso() {
  return new Date().toISOString()
}

/** 目标联动（U2）：任务完成/取消时推进/回退关联叶子目标的 current_value（下限 0）。目标缺失静默跳过；
 *  metric（U3 自动统计）型目标由引擎按周期窗口实时计算，跳过手动推进，避免双通道污染。
 *  窗口约束：目标 start_date/end_date 设置后，处于周期外发生（at 截取到日）的变动不推进（与 U3 inWindow 语义对齐）。
 *  G8：推进/回退同时写 activity_logs（goal_id + task_id + note），供复盘时间线审计。 */
function advanceGoal(goalId: string, delta: number, at?: string, source?: string, taskId?: string) {
  const g = repository.getById<Goal>(T.goals, goalId)
  if (!g) return
  const isMetric = repository
    .getTable<{ goal_id: string; source_query?: string }>(T.goal_metrics)
    .some((m) => m.goal_id === goalId && m.source_query)
  if (isMetric) return
  const d = (at ?? '').slice(0, 10)
  if (g.start_date && d && d < g.start_date) return
  if (g.end_date && d && d > g.end_date) return
  repository.update(T.goals, goalId, { current_value: Math.max(0, (g.current_value ?? 0) + delta), updated_at: nowIso() })
  const log: ActivityLog = {
    id: uid('alog'),
    goal_id: goalId,
    task_id: taskId,
    started_at: at ?? nowIso(),
    note: `任务联动 ${delta > 0 ? `+${delta}` : delta}（${source ?? '状态切换'}）`,
    created_at: nowIso(),
  }
  repository.insert(T.activity_logs, log)
}

/* ---------- 任务 / 日程 / 知识 Service ---------- */
export const TaskService = {
  list(filter?: { projectId?: string; today?: boolean }): Task[] {
    let rows = repository.getTable<Task>(T.tasks)
    if (filter?.projectId) rows = rows.filter((t) => t.project_id === filter.projectId)
    if (filter?.today) {
      const d = todayISO()
      rows = rows.filter((t) => (t.due_at ?? '').slice(0, 10) === d || (t.created_at ?? '').slice(0, 10) === d)
    }
    return rows.sort((a, b) => (a.due_at ?? '').localeCompare(b.due_at ?? ''))
  },
  toggle(id: string) {
    const t = repository.getById<Task>(T.tasks, id)
    if (!t) return
    const done = t.status === 'done'
    const now = nowIso()
    // 完成时以当前时刻推进；取消时以原完成时刻回退（配合目标周期窗口过滤）
    const occurredAt = done ? (t.completed_at ?? now) : now
    repository.update(T.tasks, id, {
      status: done ? 'todo' : 'done',
      completed_at: done ? null : now,
      updated_at: now,
    })
    if (t.goal_id) advanceGoal(t.goal_id, done ? -1 : 1, occurredAt, done ? '取消完成' : '完成任务', t.id)
  },
  /** 看板拖拽：直接设置任务状态（U2：切换完成态时联动推进/回退目标） */
  setStatus(id: string, status: Task['status']) {
    const t = repository.getById<Task>(T.tasks, id)
    if (!t) return
    const wasDone = t.status === 'done'
    const isDone = status === 'done'
    const now = nowIso()
    const occurredAt = isDone && !wasDone ? now : t.completed_at ?? now
    repository.update(T.tasks, id, {
      status,
      completed_at: isDone ? now : null,
      updated_at: now,
    })
    if (t.goal_id && wasDone !== isDone) advanceGoal(t.goal_id, wasDone ? -1 : 1, occurredAt, wasDone ? '取消完成' : '完成任务', t.id)
  },
  /** 通用更新（G3/G7）：改挂目标时做双向校正——旧目标按完成态回退、新目标按完成态推进；任务不存在返回 undefined */
  update(id: string, patch: Partial<Task>): Task | undefined {
    const existing = repository.getById<Task>(T.tasks, id)
    if (!existing) return undefined
    if ('goal_id' in patch && (existing.goal_id ?? undefined) !== (patch.goal_id ?? undefined)) {
      const delta = existing.status === 'done' ? 1 : 0
      if (existing.goal_id) advanceGoal(existing.goal_id, -delta, existing.completed_at, '改挂目标（旧目标回退）', existing.id)
      if (patch.goal_id) advanceGoal(patch.goal_id, delta, existing.completed_at ?? nowIso(), delta > 0 ? '改挂目标计入' : '改挂目标', existing.id)
    }
    repository.update(T.tasks, id, { ...patch, updated_at: nowIso() } as Record<string, unknown>)
    return repository.getById<Task>(T.tasks, id)
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
    repository.insert(T.tasks, t)
    return t
  },
  /** 删除任务（G4）：已完成的挂接任务先回退目标（按原完成时刻），再直删记录；任务不存在返回 false */
  remove(id: string): boolean {
    const existing = repository.getById<Task>(T.tasks, id)
    if (!existing) return false
    if (existing.status === 'done' && existing.goal_id) advanceGoal(existing.goal_id, -1, existing.completed_at, '删除任务回退', existing.id)
    repository.remove(T.tasks, id)
    return true
  },
}

export const ScheduleService = {
  list(date?: string): Schedule[] {
    return repository.getTable<Schedule>(T.schedules).filter((s) => !date || s.start_at.slice(0, 10) === date)
  },
  /** 项目日程（项目级或经项目系统关联） */
  byProject(projectId: string): Schedule[] {
    return repository
      .getTable<Schedule>(T.schedules)
      .filter((s) => s.project_id === projectId || repository.getById<{ project_id: string }>(T.project_systems, s.project_system_id ?? '')?.project_id === projectId)
      .sort((a, b) => a.start_at.localeCompare(b.start_at))
  },
  /** 新建日程（F2：项目日程 tab 写入入口） */
  add(data: Partial<Schedule>): Schedule {
    const s: Schedule = {
      id: uid('sch'),
      title: data.title || '新日程',
      start_at: data.start_at || nowIso(),
      end_at: data.end_at,
      schedule_type: data.schedule_type ?? 'meeting',
      location: data.location,
      status: data.status ?? 'planned',
      project_id: data.project_id,
      project_system_id: data.project_system_id,
      task_id: data.task_id,
      created_at: nowIso(),
    }
    repository.insert(T.schedules, s)
    return s
  },
  /** 删除日程 */
  remove(id: string): boolean {
    const existing = repository.getById<Schedule>(T.schedules, id)
    if (!existing) return false
    repository.remove(T.schedules, id)
    return true
  },
}

export const KnowledgeService = {
  list(): KnowledgeItem[] {
    return repository.getTable<KnowledgeItem>(T.knowledge_items)
  },
}

/* ---------- 项目文档 / 复盘记录 Service ---------- */
export const DocumentService = {
  listByProject(projectId: string): Document[] {
    return repository
      .getTable<Document>(T.documents)
      .filter((d) => d.project_id === projectId && d.type !== 'review_record')
      .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
  },
  listReviews(projectId: string): Document[] {
    return repository
      .getTable<Document>(T.documents)
      .filter((d) => d.project_id === projectId && d.type === 'review_record')
      .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
  },
  /** 按子系统归类文档（v2 设计说明模块：该子系统挂载的设计说明/相关文档） */
  listByPsId(psId: string): Document[] {
    return repository
      .getTable<Document>(T.documents)
      .filter((d) => d.type !== 'review_record' && d.project_system_id === psId)
      .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
  },
  add(projectId: string, data: Partial<Document>): Document {
    const d: Document = {
      id: uid('doc'), project_id: projectId,
      type: data.type ?? 'note', title: data.title || '未命名文档',
      content: data.content, version: data.version ?? '0.1', status: data.status ?? 'draft',
      created_at: nowIso(),
    }
    repository.insert(T.documents, d)
    return d
  },
  update(id: string, patch: Partial<Document>) {
    repository.update(T.documents, id, patch)
  },
  remove(id: string) {
    repository.remove(T.documents, id)
  },
}

/* ---------- 版本（修订快照）Service：点位每次增删改自动落 revision，此处提供项目级查询与同一实体的相邻快照 ---------- */
export const RevisionService = {
  /** 项目内全部点位修订（时间倒序） */
  listByProject(projectId: string): Revision[] {
    const psIds = new Set(
      repository
        .getTable<{ id: string; project_id: string }>(T.project_systems)
        .filter((s) => s.project_id === projectId)
        .map((s) => s.id),
    )
    return repository
      .getTable<Revision>(T.revisions)
      .filter((r) => {
        if (r.entity_type !== 'point') return false
        const snap = r.snapshot_json as { project_system_id?: string } | undefined
        return Boolean(snap?.project_system_id && psIds.has(snap.project_system_id))
      })
      .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
  },

  /** 指定修订之前、同一实体的最近一条修订（供版本对比） */
  previous(entityId: string, beforeId: string): Revision | undefined {
    const before = repository.getById<Revision>(T.revisions, beforeId)
    if (!before) return undefined
    return repository
      .getTable<Revision>(T.revisions)
      .filter((r) => r.entity_id === entityId && r.id !== beforeId && (r.created_at ?? '') <= (before.created_at ?? ''))
      .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))[0]
  },
}