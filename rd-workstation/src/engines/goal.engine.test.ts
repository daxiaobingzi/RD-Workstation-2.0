import { describe, it, expect } from 'vitest'
import { T } from '../types/domain'
import type { EngineCtx } from './ctx'
import { GoalEngine } from './goal.engine'

/* ============ U3 GoalEngine 扩展测试（TDD：先红后绿） ============ */

function ctxFor(rows: Record<string, unknown[]>): EngineCtx {
  return { get: (<T_>(t: string) => (rows[t] ?? []) as T_[]) }
}

const tasks = [
  { id: 't1', status: 'done', completed_at: '2026-08-03T10:00:00.000Z' },
  { id: 't2', status: 'done', completed_at: '2026-08-20T10:00:00.000Z' },
  { id: 't3', status: 'done', completed_at: '2026-09-01T10:00:00.000Z' },
  { id: 't4', status: 'todo' },
]

const projects = [
  { id: 'p1', status: 'completed', actual_end_date: '2026-08-10' },
  { id: 'p2', status: 'completed', actual_end_date: '2026-08-25' },
  { id: 'p3', status: 'completed', actual_end_date: '2026-09-02' },
  { id: 'p4', status: 'designing' },
]

const knowledge = [
  { id: 'k1', created_at: '2026-08-05T09:00:00.000Z' },
  { id: 'k2', created_at: '2026-08-30T09:00:00.000Z' },
  { id: 'k3', created_at: '2026-07-01T09:00:00.000Z' },
]

const habits = [
  { id: 'h1', completed: true, date: '2026-08-02' },
  { id: 'h2', completed: true, date: '2026-08-08' },
  { id: 'h3', completed: true, date: '2026-09-05' },
  { id: 'h4', completed: false, date: '2026-08-09' },
]

describe('GoalEngine 按周期统计（U3）', () => {
  it('task_done_by_period 统计窗口内已完成任务数（按 completed_at）', () => {
    const ctx = ctxFor({ [T.tasks]: tasks })
    expect(GoalEngine.compute(ctx, 'task_done_by_period', '2026-08-01', '2026-08-31')).toBe(2)
  })

  it('project_completed_by_period 统计窗口内完成项目数（按 actual_end_date）', () => {
    const ctx = ctxFor({ [T.projects]: projects })
    expect(GoalEngine.compute(ctx, 'project_completed_by_period', '2026-08-01', '2026-08-31')).toBe(2)
  })

  it('knowledge_added_by_period 统计窗口内新增知识数（按 created_at）', () => {
    const ctx = ctxFor({ [T.knowledge_items]: knowledge })
    expect(GoalEngine.compute(ctx, 'knowledge_added_by_period', '2026-08-01', '2026-08-31')).toBe(2)
  })

  it('habit_completed_by_period 统计窗口内打卡完成次数（按 date）', () => {
    const ctx = ctxFor({ [T.habit_records]: habits })
    expect(GoalEngine.compute(ctx, 'habit_completed_by_period', '2026-08-01', '2026-08-31')).toBe(2)
  })

  it('不传窗口时不做时间过滤（兼容旧行为）', () => {
    const ctx = ctxFor({ [T.tasks]: tasks })
    expect(GoalEngine.compute(ctx, 'task_done_by_period')).toBe(3)
  })

  it('既有 completed_projects 查询行为不变（含未完成项目不计数）', () => {
    const ctx = ctxFor({ [T.projects]: projects })
    expect(GoalEngine.compute(ctx, 'completed_projects')).toBe(3)
  })
})