import { describe, it, expect, beforeEach } from 'vitest'
import { useDB } from '../db/memory-db'
import { T, type Goal, type Task } from '../types/domain'
import { GoalService } from './goal.service'
import { TaskService } from './misc.service'

/* ============ U1 GoalService 测试（TDD：先红后绿） ============ */

function resetDb(rows: { goals?: Goal[]; tasks?: Task[] }) {
  useDB.setState({
    db: {
      [T.goals]: rows.goals ?? [],
      [T.tasks]: rows.tasks ?? [],
    },
  })
}

describe('GoalService.add', () => {
  beforeEach(() => resetDb({}))

  it('创建目标并返回完整记录（默认 status=active、生成 id/created_at）', () => {
    const g = GoalService.add({ name: '年度目标', period_type: 'year', target_value: 20 })
    expect(g.id).toBeTruthy()
    expect(g.created_at).toBeTruthy()
    expect(g).toMatchObject({ name: '年度目标', period_type: 'year', status: 'active', target_value: 20 })
    expect(GoalService.list()).toHaveLength(1)
  })

  it('支持挂接父目标形成层级', () => {
    const parent = GoalService.add({ name: '年目标', period_type: 'year' })
    const child = GoalService.add({ name: '季度子目标', period_type: 'quarter', parent_goal_id: parent.id })
    expect(child.parent_goal_id).toBe(parent.id)
    expect(GoalService.tree()).toHaveLength(1)
  })
})

describe('GoalService.list', () => {
  beforeEach(() =>
    resetDb({
      goals: [
        { id: 'g_late', name: '晚的', period_type: 'quarter', start_date: '2026-09-01', target_value: 5, status: 'active' },
        { id: 'g_early', name: '早的', period_type: 'year', start_date: '2026-01-01', target_value: 5, status: 'active' },
      ],
    }),
  )

  it('按 start_date 升序返回全部目标', () => {
    const list = GoalService.list()
    expect(list.map((g) => g.id)).toEqual(['g_early', 'g_late'])
  })
})

describe('GoalService.tree', () => {
  beforeEach(() =>
    resetDb({
      goals: [
        { id: 'r1', name: '根1', period_type: 'year', status: 'active' },
        { id: 'c1', name: '子1-1', period_type: 'quarter', parent_goal_id: 'r1', status: 'active' },
        { id: 'c2', name: '子1-2', period_type: 'month', parent_goal_id: 'r1', status: 'active' },
        { id: 'r2', name: '根2', period_type: 'year', status: 'active' },
      ],
    }),
  )

  it('按 parent_goal_id 分组为树，根级目标带 children', () => {
    const tree = GoalService.tree()
    expect(tree).toHaveLength(2)
    const root = tree.find((n) => n.id === 'r1')!
    expect(root.children.map((n) => n.id)).toEqual(['c1', 'c2'])
    expect(tree.find((n) => n.id === 'r2')!.children).toHaveLength(0)
  })
})

describe('GoalService.remove（删除保护）', () => {
  it('叶子目标可删除', () => {
    resetDb({ goals: [{ id: 'leaf', name: '叶', period_type: 'month', status: 'active' }] })
    const res = GoalService.remove('leaf')
    expect(res).toEqual({ ok: true })
    expect(GoalService.list()).toHaveLength(0)
  })

  it('有子目标时拒绝删除并返回原因', () => {
    resetDb({
      goals: [
        { id: 'parent', name: '父', period_type: 'year', status: 'active' },
        { id: 'child', name: '子', period_type: 'quarter', parent_goal_id: 'parent', status: 'active' },
      ],
    })
    const res = GoalService.remove('parent')
    expect(res).toEqual({ ok: false, reason: expect.stringContaining('子目标') })
    expect(GoalService.list()).toHaveLength(2)
  })

  it('被任务关联时拒绝删除并返回原因', () => {
    resetDb({
      goals: [{ id: 'g1', name: '目标', period_type: 'month', status: 'active' }],
      tasks: [{ id: 'task1', title: 't', status: 'todo', priority: 'medium', goal_id: 'g1', created_at: '', updated_at: '' } as Task],
    })
    const res = GoalService.remove('g1')
    expect(res).toEqual({ ok: false, reason: expect.stringContaining('任务') })
    expect(GoalService.list()).toHaveLength(1)
  })
})

describe('GoalService.progress', () => {
  beforeEach(() =>
    resetDb({
      goals: [
        { id: 'leaf', name: '叶子', period_type: 'month', target_value: 10, current_value: 4, status: 'active' },
        { id: 'parent', name: '父', period_type: 'quarter', target_value: 50, status: 'active' },
        { id: 'c_a', name: '子A', period_type: 'month', parent_goal_id: 'parent', target_value: 20, current_value: 5, status: 'active' },
        { id: 'c_b', name: '子B', period_type: 'month', parent_goal_id: 'parent', target_value: 30, current_value: 6, status: 'active' },
        { id: 'no_t', name: '无目标值', period_type: 'week', current_value: 3, status: 'active' },
      ],
    }),
  )

  it('叶子目标 = current/target', () => {
    expect(GoalService.progress('leaf')).toEqual({ value: 4, target: 10, pct: 40 })
  })

  it('父目标 = 子项 value/target 累加', () => {
    expect(GoalService.progress('parent')).toEqual({ value: 11, target: 50, pct: 22 })
  })

  it('无 target_value 时不崩溃，返回 target 0 pct 0', () => {
    expect(GoalService.progress('no_t')).toEqual({ value: 3, target: 0, pct: 0 })
  })
})

describe('GoalService.byPeriod', () => {
  beforeEach(() =>
    resetDb({
      goals: [
        { id: 'y1', name: '年', period_type: 'year', status: 'active' },
        { id: 'q1', name: '季', period_type: 'quarter', status: 'active' },
        { id: 'm1', name: '月', period_type: 'month', status: 'active' },
        { id: 'w1', name: '周', period_type: 'week', status: 'active' },
      ],
    }),
  )

  it('按周期类型过滤', () => {
    expect(GoalService.byPeriod('year').map((g) => g.id)).toEqual(['y1'])
    expect(GoalService.byPeriod('week').map((g) => g.id)).toEqual(['w1'])
  })
})

describe('GoalService.update', () => {
  beforeEach(() => resetDb({ goals: [{ id: 'g1', name: '原', period_type: 'month', status: 'active' }] }))

  it('更新字段并返回更新后记录', () => {
    const updated = GoalService.update('g1', { name: '新名', target_value: 99 })
    expect(updated).toMatchObject({ id: 'g1', name: '新名', target_value: 99 })
    expect(GoalService.list()[0].name).toBe('新名')
  })

  it('目标不存在时返回 undefined', () => {
    expect(GoalService.update('nope', { name: 'x' })).toBeUndefined()
  })
})

describe('GoalService.saveMetric / metric', () => {
  let g: Goal
  beforeEach(() => {
    resetDb({})
    g = GoalService.add({ name: '统计目标', period_type: 'quarter', goal_type: 'metric' })
  })

  it('保存度量配置并可读取', () => {
    const m = GoalService.saveMetric(g.id, {
      source_type: 'project',
      source_query: 'completed_projects',
      target_value: 15,
    })
    expect(m).toMatchObject({ goal_id: g.id, source_type: 'project', source_query: 'completed_projects', target_value: 15 })
    expect(GoalService.metric(g.id)).toMatchObject({ goal_id: g.id, source_query: 'completed_projects', target_value: 15 })
  })

  it('再次保存覆盖旧配置（不产生重复行）', () => {
    GoalService.saveMetric(g.id, { source_type: 'project', source_query: 'active_projects' })
    GoalService.saveMetric(g.id, { source_type: 'task', source_query: 'task_done_by_period' })
    expect(GoalService.metric(g.id)).toMatchObject({ source_type: 'task', source_query: 'task_done_by_period' })
  })

  it('无配置时读取返回 undefined', () => {
    expect(GoalService.metric(g.id)).toBeUndefined()
  })
})

describe('GoalService U3：metric 实时计算 + check-in 进展', () => {
  beforeEach(() =>
    resetDb({
      goals: [],
      tasks: [
        { id: 't1', title: 'a', status: 'done', priority: 'medium', completed_at: '2026-08-03T10:00:00.000Z', created_at: '', updated_at: '' },
        { id: 't2', title: 'b', status: 'done', priority: 'medium', completed_at: '2026-09-01T10:00:00.000Z', created_at: '', updated_at: '' },
        { id: 't3', title: 'c', status: 'todo', priority: 'medium', created_at: '', updated_at: '' },
      ],
    }),
  )

  it('metricCurrent 按目标周期窗口实时统计（task_done_by_period，仅统计挂接到该目标的任务）', () => {
    const g = GoalService.add({
      name: '本月完成任务 5 个', period_type: 'month', goal_type: 'metric',
      start_date: '2026-08-01', end_date: '2026-08-31', target_value: 5,
    })
    GoalService.saveMetric(g.id, { source_type: 'task', source_query: 'task_done_by_period', target_value: 5 })
    // G2：未挂接到该目标的任务不计入（t1/t2 均未挂 goal_id → 0）
    expect(GoalService.metricCurrent(g.id)).toEqual({ value: 0, source: 'task_done_by_period' })
    // 挂接 t1（8/3 完成，落在 8 月窗口）后计入 1
    TaskService.update('t1', { goal_id: g.id })
    expect(GoalService.metricCurrent(g.id)).toEqual({ value: 1, source: 'task_done_by_period' })
  })

  it('metricCurrent 无配置或未设查询时返回 null', () => {
    const g = GoalService.add({ name: '普通目标', period_type: 'month' })
    expect(GoalService.metricCurrent(g.id)).toBeNull()
    GoalService.saveMetric(g.id, { source_type: 'task' })
    expect(GoalService.metricCurrent(g.id)).toBeNull()
  })

  it('logProgress 写入 activity_logs，progressLogs 按时间倒序返回', () => {
    const g = GoalService.add({ name: '目标', period_type: 'month' })
    GoalService.logProgress(g.id, '第一条进展')
    GoalService.logProgress(g.id, '第二条进展')
    const logs = GoalService.progressLogs(g.id)
    expect(logs).toHaveLength(2)
    expect(logs[0].note).toBe('第二条进展')
    expect(logs[1].note).toBe('第一条进展')
  })

  it('logProgress 带 value 时同时覆盖目标当前值（手动覆盖）', () => {
    const g = GoalService.add({ name: '目标', period_type: 'month', current_value: 0 })
    GoalService.logProgress(g.id, '手动调到 3', 3)
    expect(GoalService.list().find((x) => x.id === g.id)!.current_value).toBe(3)
  })
})