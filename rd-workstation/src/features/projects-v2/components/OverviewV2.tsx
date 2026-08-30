import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, CalendarClock, FileText, Plus, Gauge } from 'lucide-react'
import { useDB } from '../../../db/memory-db'
import { T } from '../../../types/domain'
import { ProjectService, PointService, BillService, BudgetService, TaskService, ScheduleService, SystemService } from '../../../services'
import { StatusBadge } from '../../../components/ui/badge'
import { Progress } from '../../../components/ui/progress'
import { Button } from '../../../components/ui/button'
import { Modal } from '../../../components/ui/dialog'
import { toast } from '../../../components/ui/toast'
import { fmtMoney, fmtNum, cn } from '../../../lib/utils'

/** 项目中心 v2 · ② 概览：照搬原方案布局，删除数据联动展示内容及代码；KPI=概算总额；子系统进度条后附概算价 */
export function OverviewV2({ projectId }: { projectId: string }) {
  useDB((s) => s.db)
  const navigate = useNavigate()
  const [addSysOpen, setAddSysOpen] = useState(false)
  const project = ProjectService.get(projectId)
  const systems = ProjectService.systems(projectId)
  const tasks = TaskService.list({ projectId })
  const schedules = ScheduleService.byProject(projectId).filter((s) => new Date(s.start_at) >= new Date()).slice(0, 4)
  const docs = useDB.getState().getTable<{ id: string; project_id?: string; type?: string; title: string; version?: string }>(T.documents).filter((d) => d.project_id === projectId && d.type !== 'review_record')

  const points = useMemo(() => PointService.allByProject(projectId), [projectId])
  const totalPoints = points.reduce((s, p) => s + (p.quantity || 0), 0)

  const budgets = useMemo(() => BudgetService.byProject(projectId), [projectId])
  const estimateTotal = useMemo(() => budgets.reduce((s, b) => s + (b.total_amount || 0), 0), [budgets])

  // 每个子系统的概算金额（按预算明细的 project_system_id 聚合；未生成则为 undefined → 不显示）
  const sysEstimate = useMemo(() => {
    const map = new Map<string, number>()
    for (const bd of budgets) {
      for (const it of BudgetService.items(bd.id)) {
        if (!it.project_system_id) continue
        map.set(it.project_system_id, (map.get(it.project_system_id) ?? 0) + (it.amount || 0))
      }
    }
    return map
  }, [budgets])

  const progress = useMemo(() => {
    const sysAvg = systems.length ? systems.reduce((s, x) => s + (x.progress || 0), 0) / systems.length : 0
    const done = tasks.filter((t) => t.status === 'done').length
    const taskRate = tasks.length ? (done / tasks.length) * 100 : 0
    const deliver = BillService.versions(projectId).length > 0 || budgets.length > 0 ? 100 : 0
    return Math.round(sysAvg * 0.5 + taskRate * 0.3 + deliver * 0.2)
  }, [systems, tasks, budgets, projectId])

  if (!project) return <div className="p-8 text-muted">项目不存在。</div>

  return (
    <div className="space-y-4">
      {/* 指标卡（无数据联动） */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Metric label="项目自动进度" value={`${progress}%`} sub="系统 50% + 任务 30% + 清单预算 20%" />
        <Metric label="子系统" value={String(systems.length)} sub={`${systems.filter((s) => s.status === 'completed').length} 个已完成`} />
        <Metric label="点位总数" value={fmtNum(totalPoints)} sub={`${points.length} 行点位`} />
        <Metric label="概算总额" value={fmtMoney(estimateTotal)} sub={budgets.length ? '已确认版本 · 未生成不显示' : '未生成概算'} accent={budgets.length > 0} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <section className="lg:col-span-4">
          <Panel title="项目摘要">
            <dl className="space-y-2 text-[12.5px]">
              {[
                ['业主', project.client_name],
                ['业态', project.project_type],
                ['建筑面积', `${fmtNum(project.building_area)} ㎡`],
                ['层数', `${fmtNum(project.floor_count)} 层`],
                ['设计阶段', project.design_stage],
                ['默认档次', gradeName(project.default_grade_code)],
                ['计划周期', `${project.start_date ?? '—'} ~ ${project.planned_end_date ?? '—'}`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right font-medium">{v || '—'}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </section>

        <section className="lg:col-span-8">
          <Panel
            title={`子系统进度（${systems.length}）`}
            hint="进度条后显示该项目概算价格，未生成则不显示"
            extra={<Button size="sm" variant="secondary" onClick={() => setAddSysOpen(true)}><Plus className="size-3.5" />添加系统</Button>}
          >
            <ul className="space-y-3">
              {systems.map((s) => {
                const est = sysEstimate.get(s.id)
                return (
                  <li key={s.id}>
                    <div className="mb-1 flex items-center gap-2 text-[12px]">
                      <span className="font-mono text-[11px] text-faint">{s.systemCode}</span>
                      <button type="button" className="truncate text-[13px] font-medium hover:text-accent" onClick={() => navigate(`/projects-v2/${project.id}/derive`)}>{s.systemName}</button>
                      <span className="ml-1"><StatusBadge status={s.status} /></span>
                      <span className="ml-auto flex items-center gap-2">
                        {est !== undefined ? (
                          <span className="font-mono text-[11.5px] font-semibold text-accent" title="该项目子系统概算金额">概算 {fmtMoney(est)}</span>
                        ) : (
                          <span className="text-[11px] text-faint">概算未生成</span>
                        )}
                        <span className="w-8 text-right font-mono text-[11px] text-muted">{s.progress}%</span>
                      </span>
                    </div>
                    <Progress value={s.progress} />
                  </li>
                )
              })}
              {!systems.length && <p className="text-[12px] text-faint">还没有子系统，可到「点位」页或项目详情添加系统。</p>}
            </ul>
            <div className="mt-2 flex rounded-md border border-accent/30 bg-accent-soft/30 px-3 py-2 text-[11.5px] text-accent">
              <Gauge className="mr-1.5 size-3.5" />概算未生成（未确认清单版本）的系统，进度条后不显示金额。
            </div>
          </Panel>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="近期任务" count={tasks.length} extra={<Button size="xs" variant="outline" onClick={() => navigate(`/projects-v2/${project.id}/review`)}><Plus className="size-3" />更多</Button>}>
          <ul className="space-y-1">
            {tasks.slice(0, 5).map((t) => (
              <li key={t.id} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-hover">
                <CheckCircle2 className={cn('size-4', t.status === 'done' ? 'text-ok' : 'text-faint')} />
                <span className={cn('flex-1 truncate text-[13px]', t.status === 'done' ? 'text-faint line-through' : 'text-ink')}>{t.title}</span>
                <StatusBadge status={t.status === 'done' ? 'done' : t.status === 'doing' ? 'designing' : 'todo'} />
              </li>
            ))}
            {!tasks.slice(0, 5).length && <p className="px-2 py-1 text-[12px] text-faint">暂无任务</p>}
          </ul>
        </Panel>
        <Panel title="近期日程" count={schedules.length}>
          <ul className="space-y-1">
            {schedules.map((s) => (
              <li key={s.id} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-hover">
                <CalendarClock className="size-3.5 shrink-0 text-accent" />
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{s.title}</span>
                <span className="shrink-0 font-mono text-[10.5px] text-faint">{s.start_at.slice(5, 10).replace('-', '/')}</span>
              </li>
            ))}
            {!schedules.length && <p className="px-2 py-1 text-[12px] text-faint">暂无排期</p>}
          </ul>
        </Panel>
        <Panel title="文档" count={docs.length}>
          <ul className="space-y-1">
            {docs.slice(0, 6).map((d) => (
              <li key={d.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] hover:bg-hover">
                <FileText className="size-3.5 shrink-0 text-accent2" />
                <span className="flex-1 truncate">{d.title}</span>
                <span className="font-mono text-[10.5px] text-faint">v{d.version}</span>
              </li>
            ))}
            {!docs.length && <p className="px-2 py-1 text-[12px] text-faint">暂无文档成果</p>}
          </ul>
        </Panel>
      </div>

      {/* 添加系统 */}
      <Modal open={addSysOpen} onClose={() => setAddSysOpen(false)} title="添加子系统" width={440}>
        <div className="space-y-1.5">
          {SystemService.listStandard().map((s) => {
            const exists = systems.some((x) => x.system_id === s.id)
            return (
              <button
                key={s.id}
                type="button"
                disabled={exists}
                onClick={() => {
                  ProjectService.addSystem(projectId, s.id, project.default_grade_code ?? 'standard')
                  toast(`已添加「${s.name}」`)
                  setAddSysOpen(false)
                }}
                className="flex w-full items-center justify-between rounded-md border border-rule px-3 py-2.5 text-left transition-colors hover:border-accent/40 disabled:opacity-50"
              >
                <span>
                  <span className="block text-[13px] font-medium">{s.name}</span>
                  <span className="block font-mono text-[11px] text-faint">{s.code} · {s.description}</span>
                </span>
                {exists ? <span className="text-[11.5px] text-faint">已添加</span> : <span className="text-[11.5px] text-accent">添加</span>}
              </button>
            )
          })}
        </div>
      </Modal>
    </div>
  )
}

function Metric({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-rule bg-surface p-3.5 shadow-sm">
      <p className="text-[11px] font-semibold tracking-wide text-faint uppercase">{label}</p>
      <p className={cn('mt-1 font-display font-mono text-[20px] font-bold', accent ? 'text-accent' : 'text-ink')}>{value}</p>
      <p className="mt-0.5 text-[11px] text-muted">{sub}</p>
    </div>
  )
}

function Panel({ title, hint, extra, count, children }: { title: string; hint?: string; extra?: React.ReactNode; count?: number; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-rule bg-surface shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-rule px-3.5 py-2.5">
        <h3 className="text-[13px] font-semibold">{title}</h3>
        {count !== undefined && count > 0 && <span className="rounded-full bg-surface-subtle px-1.5 text-[10.5px] text-muted">{count}</span>}
        {hint && <span className="text-[10.5px] text-faint">{hint}</span>}
        <div className="ml-auto">{extra}</div>
      </div>
      <div className="px-3.5 py-3">{children}</div>
    </div>
  )
}

function gradeName(code?: string) {
  return { economic: '经济型', standard: '标准型', premium: '高端型' }[code ?? ''] ?? code ?? '—'
}