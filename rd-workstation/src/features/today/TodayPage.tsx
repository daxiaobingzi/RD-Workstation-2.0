import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Target, ListTodo, CalendarClock, TrendingUp, CheckCircle2, Sparkles, ArrowRight, Repeat,
} from 'lucide-react'
import { useDB } from '../../db/memory-db'
import { T } from '../../types/domain'
import { TaskService, ScheduleService, DesignService, ProjectService } from '../../services'
import { StatusBadge } from '../../components/ui/badge'
import { Progress } from '../../components/ui/progress'
import { cn } from '../../lib/utils'

const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-danger',
  medium: 'bg-warn',
  low: 'bg-faint',
  urgent: 'bg-danger',
}

export function TodayPage() {
  useDB((s) => s.db)
  const navigate = useNavigate()
  const today = useMemo(() => {
    const now = new Date()
    return {
      date: `${now.getMonth() + 1}月${now.getDate()}日`,
      week: ['日', '一', '二', '三', '四', '五', '六'][now.getDay()],
    }
  }, [])

  const tasks = TaskService.list()
  const openTasks = tasks.filter((t) => t.status !== 'done')
  const todayTasks = openTasks.filter((t) => (t.due_at ?? '').slice(0, 10) === '2026-08-27')
  const schedules = ScheduleService.list('2026-08-27')
  const projects = ProjectService.list()
  const projectProgress = projects.map((p) => {
    const pss = ProjectService.systems(p.id)
    const avg = pss.length ? Math.round(pss.reduce((s, x) => s + x.progress, 0) / pss.length) : 0
    return { project: p, progress: avg }
  })
  const goals = useDB.getState().getTable<{ id: string; name: string; target_value?: number; current_value?: number; period_type: string }>(T.goals)
  const habits = useDB.getState().getTable<{ id: string; name: string }>(T.habits)
  const habitRecords = useDB.getState().getTable<{ habit_id: string; date: string; completed: boolean }>(T.habit_records)
  const vssChecks = DesignService.check('ps_vss_001')
  const aiWarnings = vssChecks.filter((c) => c.severity !== 'ok')

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

      {/* 今日重点 */}
      <div className="rounded-lg border border-accent/30 bg-gradient-to-r from-accent-soft to-accent2-soft px-4 py-3">
        <div className="flex items-center gap-2 text-[12px] font-semibold text-accent">
          <Target className="size-3.5" /> 今日重点
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <p className="text-[14px] font-medium text-ink">完成「苏州公安 · 视频监控」设计初稿（点位 / 设备 / 清单 / 预算全链落库）</p>
          <button
            type="button"
            onClick={() => navigate('/projects/proj_001/systems/ps_vss_001')}
            className="flex shrink-0 items-center gap-1 rounded-[6px] bg-accent px-2.5 py-1.5 text-[12px] font-medium text-white hover:bg-accent-strong"
          >
            进入工作区 <ArrowRight className="size-3.5" />
          </button>
        </div>
      </div>

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
                    {s.start_at.slice(11, 16)}
                    {s.end_at ? `–${s.end_at.slice(11, 16)}` : ''}
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
          <PanelCard icon={<ListTodo className="size-4" />} title="今日待办" count={todayTasks.length}>
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
                {openTasks.filter((t) => (t.due_at ?? '').slice(0, 10) !== '2026-08-27').slice(0, 3).map((t) => (
                  <li key={t.id} className="flex items-center gap-2 px-2 py-1 text-[12.5px] text-muted">
                    <span className={cn('size-1.5 shrink-0 rounded-full', PRIORITY_DOT[t.priority] ?? 'bg-faint')} />
                    <span className="flex-1 truncate">{t.title}</span>
                    {t.due_at && <span className="font-mono text-[10.5px] text-faint">{t.due_at.slice(5, 10)}</span>}
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

          <PanelCard icon={<Target className="size-4" />} title="目标进度" count={goals.length}>
            <ul className="space-y-2.5">
              {goals.slice(0, 2).map((g) => {
                const pct = g.target_value ? Math.round(((g.current_value ?? 0) / g.target_value) * 100) : 0
                return (
                  <li key={g.id}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[12.5px] text-ink">{g.name}</span>
                      <span className="font-mono text-[11px] text-muted">
                        {g.current_value}/{g.target_value}
                      </span>
                    </div>
                    <Progress value={pct} tone="accent2" />
                  </li>
                )
              })}
            </ul>
          </PanelCard>
        </section>
      </div>

      {/* 底部：习惯 + AI 建议 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        <section className="md:col-span-5">
          <PanelCard icon={<Repeat className="size-4" />} title="习惯打卡" count={habits.length}>
            <div className="flex flex-wrap gap-2">
              {habits.map((h) => {
                const done = habitRecords.some((r) => r.habit_id === h.id && r.date === '2026-08-27' && r.completed)
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
              <ul className="space-y-1.5">
                {aiWarnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 rounded-md bg-surface-subtle px-2.5 py-1.5 text-[12.5px] text-muted">
                    <span className={cn('mt-1 size-1.5 shrink-0 rounded-full', w.severity === 'danger' ? 'bg-danger' : 'bg-warn')} />
                    <span>
                      {w.message}
                      {w.severity === 'danger' && (
                        <button
                          type="button"
                          className="ml-2 text-[12px] font-medium text-accent hover:underline"
                          onClick={() => navigate('/projects/proj_001/systems/ps_vss_001')}
                        >
                          去处理
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12.5px] text-muted">设计链状态良好，暂无告警。</p>
            )}
          </PanelCard>
        </section>
      </div>
    </div>
  )
}

function PanelCard({
  icon, title, count, badge, children,
}: {
  icon: React.ReactNode
  title: string
  count?: number
  badge?: string
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
      </div>
      <div className="px-3.5 py-3">{children}</div>
    </div>
  )
}
