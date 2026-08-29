import { describe, it, expect, beforeEach } from 'vitest'
import { useDB } from '../db/memory-db'
import { T, type Goal, type Task } from '../types/domain'
import { TaskService } from './misc.service'

/* ============ U2 目标-任务联动测试（TDD：先红后绿） ============ */

const baseTask: Task = {
  id: 't1', title: '任务1', status: 'todo', priority: 'medium',
  created_at: '2026-08-28T10:00:00.000Z', updated_at: '2026-08-28T10:00:00.000Z',
}

function resetDb(row: { goals?: Goal[]; tasks?: Task[] }) {
  useDB.setState({
    db: {
      [T.goals]: row.goals ?? [],
      [T.tasks]: row.tasks ?? [],
    },
  })
}

function goal(id: string): Goal {
  return useDB.getState().getById<Goal>(T.goals, id)!
}

describe('任务完成推进目标（U2 联动，计数口径）', () => {
  beforeEach(() =>
    resetDb({
      goals: [{ id: 'g1', name: '目标', period_type: 'month', target_value: 5, current_value: 1, status: 'active' }],
      tasks: [{ ...baseTask, goal_id: 'g1' }],
    }),
  )

  it('setStatus 置 done → 叶子目标 current_value +1', () => {
    TaskService.setStatus('t1', 'done')
    expect(goal('g1').current_value).toBe(2)
  })

  it('toggle 从未完成→完成同样推进 +1', () => {
    TaskService.toggle('t1')
    expect(goal('g1').current_value).toBe(2)
  })

  it('反勾 done→todo 回退 -1', () => {
    TaskService.setStatus('t1', 'done')
    TaskService.toggle('t1')
    expect(goal('g1').current_value).toBe(1)
  })

  it('同一目标重复完成后只计数一次（done→doing 不重复 +1）', () => {
    TaskService.setStatus('t1', 'done')
    TaskService.setStatus('t1', 'doing')
    TaskService.setStatus('t1', 'done')
    expect(goal('g1').current_value).toBe(2)
  })

  it('无 goal_id 的任务不触发联动', () => {
    resetDb({
      goals: [{ id: 'g1', name: '目标', period_type: 'month', target_value: 5, current_value: 1, status: 'active' }],
      tasks: [{ ...baseTask }],
    })
    TaskService.setStatus('t1', 'done')
    expect(goal('g1').current_value).toBe(1)
  })

  it('目标缺失（已被删除）时静默跳过不报错', () => {
    resetDb({ tasks: [{ ...baseTask, goal_id: 'gone' }] })
    expect(() => TaskService.setStatus('t1', 'done')).not.toThrow()
  })
})

describe('TaskService.update（挂接/解绑目标）', () => {
  beforeEach(() => resetDb({ tasks: [{ ...baseTask }] }))

  it('可为任务挂接 goal_id', () => {
    TaskService.update('t1', { goal_id: 'goal_x' })
    expect(useDB.getState().getById<Task>(T.tasks, 't1')?.goal_id).toBe('goal_x')
  })

  it('可解绑 goal_id（置 undefined 且不回退到 null 之外）', () => {
    TaskService.update('t1', { goal_id: 'goal_x' })
    TaskService.update('t1', { goal_id: undefined })
    expect(useDB.getState().getById<Task>(T.tasks, 't1')?.goal_id).toBeUndefined()
  })

  it('任务不存在时返回 undefined', () => {
    expect(TaskService.update('nope', { title: 'x' })).toBeUndefined()
  })
})