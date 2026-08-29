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
  const projectProgress = projects.map((p) => {
    const pss = ProjectService.systems(p.id)
    const avg = pss.length ? Math.round(pss.reduce((s, x) => s + x.progress, 0) / pss.length) : 0
    return { project: p, progress: avg }
  })
  const goals = useDB.getState().getTable<{ id: string; name: string; target_value?: number; current_value?: number; period_type: string; status?: string }>(T.goals)
  const activeGoals = goals.filter((g) => g.status !== 'archived').slice(0, 3)
  const habits = useDB.getState().getTable<{ id: string; name: string }>(T.habits)
  const habitRecords = useDB.getState().getTable<{ habit_id: string; date: string; completed: boolean }>(T.habit_records)
  // AI 建议聚合所有项目 × 所有系统的校核告警（原仅取第一个项目的第一个系统）
  const aiWarnings = useMemo<{ severity: string; message: string; projectId: string; psId: string; systemName: string }[]>(() => {
    const out: { severity: string; message: string; projectId: string; psId: string; systemName: string }[] = []
    for (const p of projects) {
      for (const ps of ProjectService.systems(p.id)) {
        const checks = DesignService.check(ps.id).filter((c) => c.severity !== 'ok')
        for (const c of checks) out.push({ severity: c.severity, message: c.message, projectId: p.id, psId: ps.id, systemName: ps.systemName })
      }
    }
    return out
  }, [projects])

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

      {/* 今日重点：动态取进行中项目的第一个子系统（去硬编码 demo id/文案） */}
      {(() => {
        const active = projects.find((p) => p.status === 'designing' || p.status === 'reviewing') ?? projects[0]
        if (!active) return null
        const pss = ProjectService.systems(active.id)
        return (
          <div className="rounded-lg border border-accent/30 bg-gradient-to-r from-accent-soft to-accent2-soft px-4 py-3">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-accent">
              <Target className="size-3.5" /> 今日重点
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <p className="text-[14px] font-medium text-ink">
                {pss.length
                  ? `推进「${active.name} · ${pss[0].systemName}」设计（点位 / 设备 / 清单 / 预算全链落库）`
                  : `推进「${active.name}」：添加子系统完成设计初稿`}
              </p>
              {pss.length > 0 && (
                <button
                  type="button"
                  onClick={() => navigate(`/projects/${active.id}/systems/${pss[0].id}`)}
                  className="flex shrink-0 items-center gap-1 rounded-[6px] bg-accent px-2.5 py-1.5 text-[12px] font-medium text-white hover:bg-accent-strong"
                >
                  进入工作区 <ArrowRight className="size-3.5" />
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

        {/* 右：项目进度 */}
        <section className="space-y-4 md:col-span-3">
          <PanelCard icon={<TrendingUp className="size-4" />} title="项目进度" count={projectProgress.length}>
            <ul className="space-y-3">
              {projectProgress.map(({ project, progress }) => (
                <li key={project.id}>
                  <div className="mb-1 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => navigate(`/projects/${project.id}`)}
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
            {aiWarnings.length ? (
              <>
                <ul className="space-y-1.5">
                  {aiWarnings.slice(0, 6).map((w, i) => (
                    <li key={`${w.psId}-${i}`} className="flex items-start gap-2 rounded-md bg-surface-subtle px-2.5 py-1.5 text-[12.5px] text-muted">
                      <span className={cn('mt-1 size-1.5 shrink-0 rounded-full', w.severity === 'danger' ? 'bg-danger' : 'bg-warn')} />
                      <span>
                        <span className="font-medium text-ink">[{w.systemName}]</span> {w.message}
                        {w.severity === 'danger' && (
                          <button
                            type="button"
                            className="ml-2 text-[12px] font-medium text-accent hover:underline"
                            onClick={() => navigate(`/projects/${w.projectId}/systems/${w.psId}`)}
                          >
                            去处理
                          </button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                {aiWarnings.length > 6 && (
                  <p className="mt-1.5 text-[11.5px] text-faint">另有 {aiWarnings.length - 6} 条告警，请逐系统前往处理。</p>
                )}
              </>
            ) : (
              <p className="text-[12.5px] text-muted">设计链状态良好，暂无告警。</p>
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
