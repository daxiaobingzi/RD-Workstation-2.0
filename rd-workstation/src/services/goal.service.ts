import { repository } from '../db/memory-db'
import { T, type Goal, type GoalMetric, type Task, type ActivityLog } from '../types/domain'
import { GoalEngine } from '../engines/goal.engine'
import { uid } from '../lib/utils'

/* ================= GoalService：目标中心（U1） ================= */

export interface GoalNode extends Goal {
  children: GoalNode[]
}

function nowIso() {
  return new Date().toISOString()
}

function sortGoals(list: Goal[]): Goal[] {
  return list.slice().sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''))
}

export const GoalService = {
  /** 全部目标，按 start_date 升序 */
  list(): Goal[] {
    return sortGoals(repository.getTable<Goal>(T.goals))
  },

  /** 按 parent_goal_id 分组成树（根级 + children），组内保持 start_date 排序 */
  tree(): GoalNode[] {
    const nodes = new Map<string, GoalNode>()
    for (const g of sortGoals(repository.getTable<Goal>(T.goals))) {
      nodes.set(g.id, { ...g, children: [] })
    }
    const roots: GoalNode[] = []
    for (const node of nodes.values()) {
      const parent = node.parent_goal_id && nodes.get(node.parent_goal_id)
      if (parent) parent.children.push(node)
      else roots.push(node)
    }
    return roots
  },

  /** 新建目标：默认 status=active、period_type=year，返回完整记录 */
  add(data: Partial<Goal>): Goal {
    const g: Goal = {
      id: uid('goal'),
      name: data.name || '未命名目标',
      description: data.description,
      goal_type: data.goal_type ?? 'objective',
      period_type: data.period_type ?? 'year',
      parent_goal_id: data.parent_goal_id,
      start_date: data.start_date,
      end_date: data.end_date,
      target_value: data.target_value,
      current_value: data.current_value,
      status: data.status ?? 'active',
      created_at: nowIso(),
    }
    repository.insert(T.goals, g)
    return g
  },

  /** 更新目标，返回更新后记录；目标不存在返回 undefined */
  update(id: string, patch: Partial<Goal>): Goal | undefined {
    const existing = repository.getById<Goal>(T.goals, id)
    if (!existing) return undefined
    repository.update(T.goals, id, { ...patch, updated_at: nowIso() } as Record<string, unknown>)
    return repository.getById<Goal>(T.goals, id)
  },

  /** 删除目标；删除保护：存在子目标或被任务关联时拒绝 */
  remove(id: string): { ok: true } | { ok: false; reason: string } {
    const goal = repository.getById<Goal>(T.goals, id)
    if (!goal) return { ok: false, reason: '目标不存在' }
    const hasChildren = repository.getTable<Goal>(T.goals).some((x) => x.parent_goal_id === id)
    if (hasChildren) return { ok: false, reason: '该目标存在子目标，请先删除子目标' }
    const hasTasks = repository.getTable<Task>(T.tasks).some((t) => t.goal_id === id)
    if (hasTasks) return { ok: false, reason: '该目标已被任务关联，请先解除关联' }
    repository.remove(T.goals, id)
    return { ok: true }
  },

  /** 统一进度口径：叶子 = current/target；父目标 = 子项 value/target 累加（target<=0 时 pct=0） */
  progress(id: string): { value: number; target: number; pct: number } {
    const byId = new Map<string, Goal>()
    for (const g of repository.getTable<Goal>(T.goals)) byId.set(g.id, g)
    const walk = (goalId: string): { value: number; target: number } => {
      const goal = byId.get(goalId)!
      const kids = [...byId.values()].filter((x) => x.parent_goal_id === goalId)
      if (kids.length) {
        return kids.reduce(
          (acc, k) => {
            const r = walk(k.id)
            return { value: acc.value + r.value, target: acc.target + r.target }
          },
          { value: 0, target: 0 },
        )
      }
      return { value: goal.current_value ?? 0, target: goal.target_value ?? 0 }
    }
    const r = walk(id)
    const pct = r.target > 0 ? Math.round((r.value / r.target) * 100) : 0
    return { value: r.value, target: r.target, pct }
  },

  /** 按周期类型过滤（年/季/月/周） */
  byPeriod(type: Goal['period_type']): Goal[] {
    return sortGoals(repository.getTable<Goal>(T.goals).filter((g) => g.period_type === type))
  },

  /** 读取目标度量配置；无配置返回 undefined */
  metric(goalId: string): GoalMetric | undefined {
    return repository.getTable<GoalMetric>(T.goal_metrics).find((m) => m.goal_id === goalId)
  },

  /** 保存/覆盖目标度量配置（每目标至多一条，U1 只存不算，计算在 U3） */
  saveMetric(goalId: string, data: Partial<GoalMetric>): GoalMetric {
    const existing = repository.getTable<GoalMetric>(T.goal_metrics).find((m) => m.goal_id === goalId)
    if (existing) {
      const merged = { ...existing, ...data, goal_id: goalId }
      repository.update(T.goal_metrics, existing.id, merged as Record<string, unknown>)
      return merged
    }
    const metric: GoalMetric = {
      id: uid('gm'),
      goal_id: goalId,
      metric_type: data.metric_type ?? 'count',
      source_type: data.source_type,
      source_query: data.source_query,
      target_value: data.target_value,
      weight: data.weight,
    }
    repository.insert(T.goal_metrics, metric)
    return metric
  },

  /** metric 型目标实时值（U3）：按目标周期窗口调 GoalEngine 计算；无配置/无查询返回 null */
  metricCurrent(goalId: string): { value: number; source: string } | null {
    const goal = repository.getById<Goal>(T.goals, goalId)
    const metric = this.metric(goalId)
    if (!goal || !metric || !metric.source_query) return null
    const value = GoalEngine.compute(
      { get: <T_>(t: string) => repository.getTable(t) as T_[] },
      metric.source_query,
      goal.start_date,
      goal.end_date,
      goalId,
    )
    return { value, source: metric.source_query }
  },

  /** 记一笔进展（check-in 轻量版，U3）：写入 activity_logs；带 value 时同时覆盖目标当前值（手动覆盖） */
  logProgress(goalId: string, note: string, value?: number): ActivityLog {
    if (value != null) {
      const g = repository.getById<Goal>(T.goals, goalId)
      if (g) repository.update(T.goals, goalId, { current_value: Math.max(0, value), updated_at: nowIso() })
    }
    const log: ActivityLog = {
      id: uid('alog'),
      goal_id: goalId,
      started_at: nowIso(),
      note,
      created_at: nowIso(),
    }
    repository.insert(T.activity_logs, log)
    return log
  },

  /** 目标进展时间线（最近 5 条，倒序；同时间戳按插入次序靠前的排前） */
  progressLogs(goalId: string): ActivityLog[] {
    return repository
      .getTable<ActivityLog>(T.activity_logs)
      .map((l, idx) => ({ l, idx }))
      .filter(({ l }) => l.goal_id === goalId)
      .sort((a, b) => {
        const ca = a.l.created_at ?? ''
        const cb = b.l.created_at ?? ''
        if (ca !== cb) return cb.localeCompare(ca)
        return b.idx - a.idx
      })
      .map(({ l }) => l)
      .slice(0, 5)
  },
}