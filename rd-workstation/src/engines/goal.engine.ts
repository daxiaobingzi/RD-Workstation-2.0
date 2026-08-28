import { T } from '../types/domain'
import type { EngineCtx } from './ctx'

/* ================= GoalEngine：目标自动计算 ================= */
export const GoalEngine = {
  /** source_query: completed_projects / active_projects / knowledge_count … */
  compute(ctx: EngineCtx, sourceQuery: string): number {
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
      default:
        return 0
    }
  },
}