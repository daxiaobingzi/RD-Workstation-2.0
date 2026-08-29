import { useMemo } from 'react'
import { Gauge, AlertTriangle, Activity } from 'lucide-react'
import { useDB } from '../../../../db/memory-db'
import { T } from '../../../../types/domain'
import { TaskService, DesignService, BillService, BudgetService, ProjectService } from '../../../../services'
import { Progress } from '../../../../components/ui/progress'
import { cn } from '../../../../lib/utils'

/** 设计问题摘要：取当前项目第一个系统的校核结果 */
function useDesignIssues(projectId: string) {
  const systems = ProjectService.systems(projectId)
  const psId = systems[0]?.id
  const checks = psId ? DesignService.check(psId) : []
  const danger = checks.filter((c) => c.severity === 'danger')
  const warn = checks.filter((c) => c.severity === 'warn')
  return { danger, warn, checks }
}

/**
 * 概览增强三件套：自动进度 + 设计问题 + 最近修改（§5.2 进度不人工输入）
 */
export function OverviewMetrics({ projectId }: { projectId: string }) {
  const { danger, warn } = useDesignIssues(projectId)
  const issues = [...danger, ...warn].slice(0, 4)
  const hasDanger = danger.length > 0

  const progress = useMemo(() => {
    const systems = ProjectService.systems(projectId)
    const sysAvg = systems.length ? systems.reduce((s, x) => s + (x.progress || 0), 0) / systems.length : 0
    const tasks = TaskService.list({ projectId })
    const done = tasks.filter((t) => t.status === 'done').length
    const taskRate = tasks.length ? (done / tasks.length) * 100 : 0
    const billVersions = BillService.versions(projectId).length
    const budgets = BudgetService.byProject(projectId).length
    const deliver = billVersions > 0 || budgets > 0 ? 100 : 0
    return Math.round(sysAvg * 0.5 + taskRate * 0.3 + deliver * 0.2)
  }, [projectId])

  const recent = useMemo(() => {
    const items: { time: number; text: string }[] = []
    const db = useDB.getState().db
    for (const t of db[T.tasks] ?? []) {
      const row = t as unknown as { project_id?: string; completed_at?: string; title: string }
      if (row.project_id === projectId && row.completed_at) items.push({ time: new Date(row.completed_at).getTime(), text: `完成任务：${row.title}` })
    }
    for (const p of db[T.points] ?? []) {
      const row = p as unknown as { project_system_id: string; updated_at?: string; point_code?: string }
      if (row.updated_at && db[T.project_systems]?.some((s) => (s as unknown as { id: string }).id === row.project_system_id && (s as unknown as { project_id: string }).project_id === projectId)) {
        items.push({ time: new Date(row.updated_at).getTime(), text: `点位更新：${row.point_code}` })
      }
    }
    for (const v of db[T.bill_versions] ?? []) {
      const row = v as unknown as { project_id?: string; created_at?: string; name?: string; version_no?: string }
      if (row.project_id === projectId && row.created_at) items.push({ time: new Date(row.created_at).getTime(), text: `清单版本：${row.name}（${row.version_no}）` })
    }
    return items.sort((a, b) => b.time - a.time).slice(0, 6)
  }, [projectId])

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* 自动进度 */}
      <div className="rounded-lg border border-rule bg-surface p-3.5 shadow-sm">
        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-faint uppercase">
          <Gauge className="size-3.5 text-accent" />项目自动进度
        </p>
        <div className="flex items-center gap-3">
          <Progress value={progress} showLabel className="flex-1" />
          <span className="font-mono text-[15px] font-bold text-ink">{progress}%</span>
        </div>
        <p className="mt-1.5 text-[11px] text-faint">系统进度 50% + 任务完成 30% + 清单预算 20%，自动计算无需填写</p>
      </div>

      {/* 设计问题 */}
      <div className="rounded-lg border border-rule bg-surface p-3.5 shadow-sm">
        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-faint uppercase">
          <AlertTriangle className={cn('size-3.5', hasDanger ? 'text-danger' : 'text-ok')} />设计问题
        </p>
        {issues.length ? (
          <ul className="space-y-1">
            {issues.map((c, i) => (
              <li
                key={i}
                className={cn(
                  'truncate rounded-[6px] px-2 py-1 text-[12px]',
                  c.severity === 'danger' ? 'bg-danger-soft text-danger' : 'bg-warn-soft text-warn',
                )}
                title={c.message}
              >
                {c.message}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12px] text-muted">暂无校核问题 ✅</p>
        )}
        <p className="mt-1.5 text-[11px] text-faint">{danger.length} 严重 · {warn.length} 提示（来自设计校核）</p>
      </div>

      {/* 最近修改 */}
      <div className="rounded-lg border border-rule bg-surface p-3.5 shadow-sm">
        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-faint uppercase">
          <Activity className="size-3.5 text-accent2" />最近修改
        </p>
        {recent.length ? (
          <ul className="space-y-1">
            {recent.map((r, i) => (
              <li key={i} className="flex items-center gap-2 text-[12px] text-muted">
                <span className="shrink-0 font-mono text-[10.5px] text-faint">
                  {new Date(r.time).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })} {new Date(r.time).getHours()}:{String(new Date(r.time).getMinutes()).padStart(2, '0')}
                </span>
                <span className="truncate">{r.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12px] text-muted">项目暂无变更记录</p>
        )}
      </div>
    </div>
  )
}