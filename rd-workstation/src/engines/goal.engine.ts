import { T } from '../types/domain'
import type { EngineCtx } from './ctx'

/* ================= GoalEngine：目标自动计算 ================= */

/** 时间窗口过滤：ts（ISO 日期时间）落在 [from, to]（YYYY-MM-DD）内则通过；不传窗口则不过滤 */
function inWindow(ts: string | undefined, from?: string, to?: string): boolean {
  if (!from && !to) return true
  const d = (ts ?? '').slice(0, 10)
  if (!d) return false
  if (from && d < from) return false
  if (to && d > to) return false
  return true
}

export const GoalEngine = {
  /**
   * source_query: completed_projects / active_projects / knowledge_count /
   * habit_completion （无窗口） …
   * project_completed_by_period / task_done_by_period /
   * knowledge_added_by_period / habit_completed_by_period （带窗口，U3）
   */
  compute(ctx: EngineCtx, sourceQuery: string, from?: string, to?: string, goalId?: string): number {
    switch (sourceQuery) {
      case 'completed_projects':
        return ctx.get<{ status: string }>(T.projects).filter((p) => p.status === 'completed').length
      case 'active_projects':
        return ctx.get<{ status: string }>(T.projects).filter((p) => p.status === 'designing' || p.status === 'reviewing').length
      case 'knowledge_count':
        return ctx.get(T.knowledge_items).length
      case 'habit_completion': {
        const recs = ctx.get<{ completed: boolean }>(T.habit_records)
        return recs.length ? Math.round((recs.filter((r) => r.completed).length / recs.length) * 100) : 0
      }
      /* U3：按周期窗口统计 */
      case 'project_completed_by_period':
        return ctx
          .get<{ status: string; actual_end_date?: string }>(T.projects)
          .filter((p) => p.status === 'completed' && inWindow(p.actual_end_date, from, to)).length
      case 'task_done_by_period':
        return ctx
          .get<{ status: string; completed_at?: string; goal_id?: string }>(T.tasks)
          .filter((t) => t.status === 'done' && (!goalId || t.goal_id === goalId) && inWindow(t.completed_at, from, to)).length
      case 'knowledge_added_by_period':
        return ctx.get<{ created_at?: string }>(T.knowledge_items).filter((k) => inWindow(k.created_at, from, to)).length
      case 'habit_completed_by_period':
        return ctx
          .get<{ completed: boolean; date?: string }>(T.habit_records)
          .filter((r) => r.completed && inWindow(r.date, from, to)).length
      default:
        return 0
    }
  },
}