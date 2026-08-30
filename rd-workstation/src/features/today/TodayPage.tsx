import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Target, ListTodo, CalendarClock, TrendingUp, CheckCircle2, Sparkles, ArrowRight, Repeat, Plus, Pencil,
} from 'lucide-react'
import { useDB } from '../../db/memory-db'
import { T, type Task } from '../../types/domain'
import { TaskService, ScheduleService, DesignService, ProjectService, GoalService } from '../../services'
import { StatusBadge } from '../../components/ui/badge'
import { Progress } from '../../components/ui/progress'
import { Button } from '../../components/ui/button'
import { TaskFormModal } from '../tasks/TaskFormModal'
import { cn, todayISO } from '../../lib/utils'

const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-danger',
  medium: 'bg-warn',
  low: 'bg-faint',
  urgent: 'bg-danger',
}

export function TodayPage() {
  const db = useDB((s) => s.db)
  const navigate = useNavigate()
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)
  // 「今日重点」：当前选中项目（候选 = 智能排序前 5，可下拉切换；仅本日视图状态，不持久化）
  const [focusId, setFocusId] = useState<string | null>(null)
  const todayStr = todayISO()
  const today = useMemo(() => {
    const now = new Date()
    return {
      date: `${now.getMonth() + 1}月${now.getDate()}日`,
      week: ['日', '一', '二', '三', '四', '五', '六'][now.getDay()],
    }
  }, [])

  const tasks = TaskService.list()
  const openTasks = tasks.filter((t) => t.status !== 'done')
  const todayTasks = openTasks.filter((t) => (t.due_at ?? '').slice(0, 10) === todayStr)
  const schedules = ScheduleService.list(todayStr)
  // db 仅作订阅触发（useDB 变化时重算），引用稳定供下级 useMemo 复用
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const projects = useMemo(() => ProjectService.list(), [db])
  const projName = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects])
  // 今日工作台只聚焦进行中项目（designing / reviewing）：草稿、已完成不参与计算与展示，归档已被 list() 过滤
  const activeProjects = useMemo(
    () => projects.filter((p) => p.status === 'designing' || p.status === 'reviewing'),
    [projects],
  )
  const activeProjectProgress = activeProjects.map((p) => {
    const pss = ProjectService.systems(p.id)
    const avg = pss.length ? Math.round(pss.reduce((s, x) => s + x.progress, 0) / pss.length) : 0
    return { project: p, progress: avg }
  })
  const goals = useDB.getState().getTable<{ id: string; name: string; target_value?: number; current_value?: number; period_type: string; status?: string }>(T.goals)
  const activeGoals = goals.filter((g) => g.status !== 'archived').slice(0, 3)
  const habits = useDB.getState().getTable<{ id: string; name: string }>(T.habits)
  const habitRecords = useDB.getState().getTable<{ habit_id: string; date: string; completed: boolean }>(T.habit_records)
  // AI 建议：仅对进行中项目 × 子系统执行校核，按项目分组（解决不同项目同名系统无法区分）；项目内 danger 优先，项目按告警数降序
  const aiGroups = useMemo(() => {
    type AIItem = { severity: string; message: string; psId: string; systemName: string }
    const groups: { projectId: string; projectName: string; items: AIItem[] }[] = []
    for (const p of activeProjects) {
      const items: AIItem[] = []
      for (const ps of ProjectService.systems(p.id)) {
        for (const c of DesignService.check(ps.id)) {
          if (c.severity === 'ok') continue
          items.push({ severity: c.severity, message: c.message, psId: ps.id, systemName: ps.systemName })
        }
      }
      if (items.length) {
        items.sort((a, b) => (a.severity === 'danger' ? -1 : 1) - (b.severity === 'danger' ? -1 : 1))
        groups.push({ projectId: p.id, projectName: p.name, items })
      }
    }
    groups.sort((a, b) => b.items.length - a.items.length)
    return groups
  }, [activeProjects])

  // 今日重点 · 智能推荐：① 今日有截止任务 → ② AI 告警(danger×10/warn×1) → ③ 平均进度最低 → ④ 最近更新
  const focusRanked = useMemo(() => {
    const todayDueCount = new Map<string, number>()
    for (const t of openTasks) {
      if ((t.due_at ?? '').slice(0, 10) === todayStr) {
        const pid = t.project_id ?? ''
        todayDueCount.set(pid, (todayDueCount.get(pid) ?? 0) + 1)
      }
    }
    const warnScore = new Map<string, number>()
    for (const g of aiGroups) {
      const score = g.items.reduce((s, it) => s + (it.severity === 'danger' ? 10 : 1), 0)
      warnScore.set(g.projectId, (warnScore.get(g.projectId) ?? 0) + score)
    }
    const avgOf = (id: string) => {
      const pss = ProjectService.systems(id)
      return pss.length ? pss.reduce((s, x) => s + (x.progress || 0), 0) / pss.length : 0
    }
    return [...activeProjects]
      .map((p) => ({ p, due: todayDueCount.get(p.id) ?? 0, warn: warnScore.get(p.id) ?? 0, avg: avgOf(p.id) }))
      .sort((a, b) => b.due - a.due || b.warn - a.warn || a.avg - b.avg || (b.p.updated_at ?? '').localeCompare(a.p.updated_at ?? ''))
      .map((x) => x.p)
  }, [activeProjects, openTasks, aiGroups, todayStr])
  // 未在手选时取推荐首位；手选失效（如项目已归档）自动回退首位
  const focusProject = focusRanked.find((p) => p.id === (focusId ?? '')) ?? focusRanked[0]

  return (
    <div className="mx-auto max-w-[1080px] space-y-4 p-5">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight">今日工作台</h1>
          <p className="mt-1 text-[12.5px] text-muted">
            {today.date} 星期{today.week} · 专注当下，先做最重要的事
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status="designing" />
        </div>
      </div>

      {/* 今日重点：智能推荐（今日截止任务 → AI告警 → 进度最低 → 最近更新），无进行中项目则不展示 */}
      {(() => {
        if (!focusProject) return null
        const pss = ProjectService.systems(focusProject.id).slice().sort((a, b) => (a.progress ?? 0) - (b.progress ?? 0))
        const focusSys = pss[0]
        return (
          <div className="rounded-lg border border-accent/30 bg-gradient-to-r from-accent-soft to-accent2-soft px-4 py-3">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-accent">
              <Target className="size-3.5" /> 今日重点
              {focusRanked.length > 1 && (
                <select
                  value={focusProject.id}
                  onChange={(e) => setFocusId(e.target.value)}
                  title="候选项目按智能推荐排序，可手动切换"
                  className="ml-1 h-6 rounded-[6px] border border-accent/30 bg-surface px-1 text-[11px] font-normal text-ink"
                >
                  {focusRanked.slice(0, 5).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <p className="text-[14px] font-medium text-ink">
                {pss.length
                  ? `推进「${focusProject.name} · ${focusSys?.systemName}」设计（点位 / 设备 / 清单 / 预算全链落库）`
                  : `推进「${focusProject.name}」：添加子系统完成设计初稿`}
              </p>
              {pss.length > 0 && (
                <button
                  type="button"
                  onClick={() => navigate(`/projects-v2/${focusProject.id}/derive`)}
                  className="flex shrink-0 items-center gap-1 rounded-[6px] bg-accent px-2.5 py-1.5 text-[12px] font-medium text-white hover:bg-accent-strong"
                >
                  进入推导 <ArrowRight className="size-3.5" />
                </button>
              )}
            </div>
          </div>
        )
      })()}

      {/* 三栏主体 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        {/* 左：日程时间线 */}
        <section className="md:col-span-4">
          <PanelCard icon={<CalendarClock className="size-4" />} title="今日日程" count={schedules.length}>
            <ol className="relative space-y-3 border-l border-rule pl-4">
              {schedules.map((s) => (
                <li key={s.id} className="relative">
                  <span className="absolute -left-[21.5px] top-1 size-2 rounded-full border-2 border-accent bg-surface" />
                  <p className="text-[12.5px] font-medium text-ink">{s.title}</p>
                  <p className="font-mono text-[11px] text-muted">
                    {new Date(s.start_at).toTimeString().slice(0, 5)}
                    {s.end_at ? `–${new Date(s.end_at).toTimeString().slice(0, 5)}` : ''}
                    {s.location ? ` · ${s.location}` : ''}
                  </p>
                </li>
              ))}
            </ol>
            {!schedules.length && (
              <p className="text-[12px] text-faint">今天没有已排程的日程，安排第一件事？</p>
            )}
          </PanelCard>
        </section>

        {/* 中：待办收件箱 */}
        <section className="md:col-span-5">
          <PanelCard
            icon={<ListTodo className="size-4" />}
            title="今日待办"
            count={todayTasks.length}
            extra={
              <Button size="xs" variant="outline" onClick={() => setTaskModalOpen(true)}>
                <Plus className="size-3.5" />新建任务
              </Button>
            }
          >
            <ul className="space-y-1">
              {todayTasks.map((t) => (
                <li key={t.id} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-hover">
                  <button
                    type="button"
                    aria-label={t.title}
                    onClick={() => TaskService.toggle(t.id)}
                    className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-rule bg-surface hover:border-accent"
                  >
                    {t.status === 'done' && <CheckCircle2 className="size-4 text-ok" />}
                  </button>
                  <span className={cn('flex-1 text-[13px]', t.status === 'done' ? 'text-faint line-through' : 'text-ink')}>
                    {t.title}
                  </span>
                  <span
                    title={t.project_id ? '所属项目' : '未关联任何项目'}
                    className={cn('shrink-0 text-[10px]', t.project_id ? 'text-faint' : 'text-faint/70')}
                  >
                    {t.project_id ? projName.get(t.project_id) : '未关联项目'}
                  </span>
                  <span className={cn('size-1.5 rounded-full', PRIORITY_DOT[t.priority] ?? 'bg-faint')} />
                </li>
              ))}
              {!todayTasks.length && (
                <li className="px-2 py-1 text-[12px] text-faint">今日待办已清空 ✓</li>
              )}
            </ul>
            <div className="mt-3 border-t border-rule pt-2.5">
              <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase">更多未完成任务</p>
              <ul className="space-y-1">
                {openTasks.filter((t) => (t.due_at ?? '').slice(0, 10) !== todayStr).slice(0, 3).map((t) => (
                  <li
                    key={t.id}
                    onClick={() => setEditTask(t)}
                    title="点击编辑该任务（与项目任务 / 目标关联同一数据源）"
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-[12.5px] text-muted hover:bg-hover"
                  >
                    <span className={cn('size-1.5 shrink-0 rounded-full', PRIORITY_DOT[t.priority] ?? 'bg-faint')} />
                    <span className="flex-1 truncate">{t.title}</span>
                    <span
                      title={t.project_id ? '所属项目' : '未关联任何项目'}
                      className={cn('shrink-0 text-[10px]', t.project_id ? 'text-faint' : 'text-faint/70')}
                    >
                      {t.project_id ? projName.get(t.project_id) : '未关联项目'}
                    </span>
                    {t.due_at && <span className="font-mono text-[10.5px] text-faint">{t.due_at.slice(5, 10)}</span>}
                    <Pencil className="size-3 shrink-0 text-faint opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-100" />
                  </li>
                ))}
              </ul>
            </div>
          </PanelCard>
        </section>

        {/* 右：项目进度（仅进行中，超 5 折叠） */}
        <section className="space-y-4 md:col-span-3">
          <PanelCard icon={<TrendingUp className="size-4" />} title="项目进度" count={activeProjectProgress.length}>
            <ul className="space-y-3">
              {activeProjectProgress.slice(0, 5).map(({ project, progress }) => (
                <li key={project.id}>
                  <div className="mb-1 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => navigate(`/projects-v2/${project.id}`)}
                      className="max-w-[70%] truncate text-[12.5px] font-medium text-ink hover:text-accent"
                    >
                      {project.name}
                    </button>
                    <span className="font-mono text-[11px] text-muted">{progress}%</span>
                  </div>
                  <Progress value={progress} />
                </li>
              ))}
            </ul>
            {activeProjectProgress.length > 5 && (
              <button
                type="button"
                onClick={() => navigate('/projects-v2')}
                className="mt-2.5 w-full rounded-md border border-rule py-1 text-[12px] font-medium text-muted hover:bg-hover hover:text-ink"
              >
                另 {activeProjectProgress.length - 5} 个项目，查看全部 →
              </button>
            )}
            {!activeProjectProgress.length && (
              <p className="text-[12px] text-faint">当前没有进行中的项目，去项目中心创建吧。</p>
            )}
          </PanelCard>

          <PanelCard icon={<Target className="size-4" />} title="目标进度" count={activeGoals.length}>
            <ul className="space-y-2.5">
              {activeGoals.map((g) => {
                const prog = GoalService.progress(g.id)
                return (
                  <li key={g.id}>
                    <div className="mb-1 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => navigate('/goals')}
                        className="max-w-[70%] truncate text-[12.5px] text-ink hover:text-accent"
                      >
                        {g.name}
                      </button>
                      <span className="font-mono text-[11px] text-muted">
                        {prog.value}/{prog.target}
                      </span>
                    </div>
                    <Progress value={prog.pct} tone="accent2" />
                  </li>
                )
              })}
            </ul>
            {activeGoals.length > 0 && (
              <button
                type="button"
                onClick={() => navigate('/goals')}
                className="mt-2.5 w-full rounded-md border border-rule py-1 text-[12px] font-medium text-muted hover:bg-hover hover:text-ink"
              >
                查看全部目标
              </button>
            )}
          </PanelCard>
        </section>
      </div>

      {/* 底部：习惯 + AI 建议 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        <section className="md:col-span-5">
          <PanelCard icon={<Repeat className="size-4" />} title="习惯打卡" count={habits.length}>
            <div className="flex flex-wrap gap-2">
              {habits.map((h) => {
                const done = habitRecords.some((r) => r.habit_id === h.id && r.date === todayStr && r.completed)
                return (
                  <span
                    key={h.id}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium',
                      done ? 'bg-ok-soft text-ok' : 'border border-rule text-muted',
                    )}
                  >
                    {done && <CheckCircle2 className="size-3.5" />}
                    {h.name}
                  </span>
                )
              })}
            </div>
          </PanelCard>
        </section>
        <section className="md:col-span-7">
          <PanelCard icon={<Sparkles className="size-4" />} title="AI 建议" badge="今日简报">
            {aiGroups.length ? (
              <div className="space-y-2">
                {aiGroups.map((g) => {
                  const shown = g.items.slice(0, 4)
                  const rest = g.items.length - shown.length
                  return (
                    <div key={g.projectId} className="rounded-md border border-rule bg-surface-subtle/40">
                      <div className="flex items-center justify-between border-b border-rule/60 px-2.5 py-1.5">
                        <button
                          type="button"
                          onClick={() => navigate(`/projects-v2/${g.projectId}`)}
                          className="truncate text-[12.5px] font-semibold text-ink hover:text-accent"
                          title="打开项目"
                        >
                          {g.projectName}
                        </button>
                        <span className="ml-2 shrink-0 rounded-full bg-surface px-1.5 font-mono text-[10.5px] text-muted">{g.items.length} 条</span>
                      </div>
                      <ul className="space-y-0.5 p-1.5">
                        {shown.map((w, i) => (
                          <li key={`${g.projectId}-${i}`} className="flex items-start gap-1.5 rounded bg-surface px-2 py-1 text-[12.5px] text-muted">
                            <span className={cn('mt-1 size-1.5 shrink-0 rounded-full', w.severity === 'danger' ? 'bg-danger' : 'bg-warn')} />
                            <span className="min-w-0 flex-1">
                              <span className="mr-1 whitespace-nowrap rounded bg-surface-subtle px-1 py-px text-[10px]">{w.systemName}</span>
                              {w.message}
                            </span>
                            {w.severity === 'danger' && (
                              <button
                                type="button"
                                className="shrink-0 text-[12px] font-medium text-accent hover:underline"
                                onClick={() => navigate(`/projects-v2/${g.projectId}/derive`)}
                              >
                                去处理
                              </button>
                            )}
                          </li>
                        ))}
                        {rest > 0 && (
                          <li className="px-2 pt-0.5 text-[11.5px] text-faint">
                            另有 {rest} 条，请前往项目逐步处理。
                          </li>
                        )}
                      </ul>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-[12.5px] text-muted">所有进行中项目设计链状态良好，暂无告警。</p>
            )}
          </PanelCard>
        </section>
      </div>

      {/* 统一任务表单（P1-2）：今日页可新建任务，并支持关联目标（与项目任务/目标页联动）。新建后默认挂到今天。 */}
      <TaskFormModal
        key={taskModalOpen ? 'open' : 'closed'}
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
      />
      {/* 编辑任务（"更多未完成任务"点击行）——同一 tasks 表，与项目/目标任务同源 */}
      <TaskFormModal
        key={editTask ? `edit-${editTask.id}` : 'idle'}
        open={!!editTask}
        initial={editTask}
        onClose={() => setEditTask(null)}
      />
    </div>
  )
}

function PanelCard({
  icon, title, count, badge, extra, children,
}: {
  icon: React.ReactNode
  title: string
  count?: number
  badge?: string
  extra?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-rule bg-surface shadow-sm">
      <div className="flex items-center gap-2 border-b border-rule px-3.5 py-2.5">
        <span className="text-accent">{icon}</span>
        <h3 className="text-[13px] font-semibold">{title}</h3>
        {typeof count === 'number' && count > 0 && (
          <span className="rounded-full bg-surface-subtle px-1.5 text-[10.5px] text-muted">{count}</span>
        )}
        {badge && <span className="ml-auto text-[11px] text-faint">{badge}</span>}
        {extra && <span className="ml-auto">{extra}</span>}
      </div>
      <div className="px-3.5 py-3">{children}</div>
    </div>
  )
}
