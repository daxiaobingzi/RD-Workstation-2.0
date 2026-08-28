import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { PenTool, LayoutTemplate, ArrowRight, Boxes, Zap, Clock } from 'lucide-react'
import { useDB } from '../domain/db'
import { T, type ProjectSystem, type SystemTemplate } from '../domain/types'
import { PointService, DesignService } from '../domain/services'
import { PageHeader } from '../components/ui/page-header'
import { StatusBadge } from '../components/ui/badge'
import { Progress } from '../components/ui/progress'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Table, THead, TBody, TR, TH, TD, NumCell } from '../components/ui/table'
import { EmptyState } from '../components/ui/empty'
import { fmtNum, cn } from '../lib/utils'

interface SystemRow {
  ps: ProjectSystem
  projectName: string
  systemName: string
  systemCode: string
  points: number
  derived: number
  gradeCode?: string
}

/** 设计模块：系统总览 · 最近设计 · 我的模板 */
export function DesignPage() {
  useDB((s) => s.db)
  const navigate = useNavigate()

  const rows = useMemo<SystemRow[]>(() => {
    const db = useDB.getState().db
    const projectMap = new Map(db[T.projects].map((p) => [p.id, p as unknown as { name: string }]))
    const systemMap = new Map(db[T.systems].map((s) => [s.id, s as unknown as { name: string; code: string }]))
    return (db[T.project_systems] as ProjectSystem[])
      .map((ps) => {
        const system = systemMap.get(ps.system_id)
        const points = PointService.list(ps.id).reduce((s, p) => s + (p.quantity || 0), 0)
        const derived = DesignService.results(ps.id).reduce((s, r) => s + (r.quantity || 0), 0)
        return {
          ps,
          projectName: projectMap.get(ps.project_id)?.name ?? '未知项目',
          systemName: system?.name ?? '未知系统',
          systemCode: system?.code ?? '',
          points,
          derived,
          gradeCode: ps.design_grade,
        }
      })
      .filter((r) => {
        const p = useDB.getState().getById<{ archived_at?: string }>(T.projects, r.ps.project_id)
        return !p?.archived_at
      })
      .sort((a, b) => ((b.ps.updated_at ?? '').localeCompare(a.ps.updated_at ?? '')))
  }, [])

  const templates = useMemo(() => {
    const db = useDB.getState().db
    const systemMap = new Map(db[T.systems].map((s) => [s.id, s as unknown as { name: string }]))
    return (db[T.system_templates] as SystemTemplate[]).map((t) => ({
      ...t,
      systemName: systemMap.get(t.system_id)?.name ?? '通用',
    }))
  }, [])

  const designing = rows.filter((r) => r.ps.status === 'designing' || r.ps.status === 'reviewing').length
  const completed = rows.filter((r) => r.ps.status === 'completed').length
  const totalPoints = rows.reduce((s, r) => s + r.points, 0)
  const totalDerived = rows.reduce((s, r) => s + r.derived, 0)
  const recent = rows.slice(0, 8)

  return (
    <div className="mx-auto max-w-[1080px] space-y-4 p-5">
      <PageHeader
        title="设计"
        subtitle="系统总览 · 最近设计 · 我的模板"
        actions={
          <Button size="sm" variant="outline" onClick={() => navigate('/projects')}>
            <ArrowRight className="size-3.5" />去项目选择系统
          </Button>
        }
      />

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={<PenTool className="size-4" />} label="设计中系统" value={`${designing}`} tone="text-accent" />
        <StatCard icon={<Boxes className="size-4" />} label="已完成系统" value={`${completed}`} tone="text-ok" />
        <StatCard icon={<Boxes className="size-4" />} label="点位总量" value={fmtNum(totalPoints)} tone="text-ink" />
        <StatCard icon={<Zap className="size-4" />} label="推导设备总量" value={fmtNum(totalDerived)} tone="text-ink" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* 最近设计 */}
        <section className="lg:col-span-7">
          <Panel title="最近设计" count={rows.length} icon={<Clock className="size-4" />}>
            <ul className="space-y-2">
              {recent.map((r) => (
                <li key={r.ps.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-lg border border-rule bg-surface-subtle/40 px-3 py-2.5 text-left transition-colors hover:border-accent/40 hover:bg-hover"
                    onClick={() => navigate(`/projects/${r.ps.project_id}/systems/${r.ps.id}`)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10.5px] text-faint">{r.systemCode}</span>
                        <span className="truncate text-[13px] font-semibold text-ink">{r.systemName}</span>
                        <Badge variant={gradeVariant(r.gradeCode)}>{gradeLabel(r.gradeCode)}</Badge>
                      </div>
                      <p className="mt-0.5 truncate text-[11.5px] text-muted">{r.projectName} · {fmtNum(r.points)} 点位 · {fmtNum(r.derived)} 推导设备</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Progress value={r.ps.progress} className="flex-1" />
                        <span className="font-mono text-[10.5px] text-muted">{r.ps.progress}%</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={r.ps.status} />
                      <ArrowRight className="size-3.5 text-faint" />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            {!rows.length && (
              <EmptyState icon={<PenTool />} title="还没有系统设计" description="先从项目页为项目添加子系统并进入设计" action={<Button size="sm" onClick={() => navigate('/projects')}>去项目</Button>} />
            )}
          </Panel>
        </section>

        {/* 我的模板 */}
        <section className="lg:col-span-5">
          <Panel title="我的模板" count={templates.length} icon={<LayoutTemplate className="size-4" />}>
            <ul className="space-y-2">
              {templates.map((t) => (
                <li key={t.id} className="rounded-lg border border-rule bg-surface-subtle/40 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 self-stretch rounded-full bg-accent2" />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold">{t.name}</p>
                      <p className="mt-0.5 line-clamp-1 text-[11.5px] text-muted">{t.description}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-[10.5px] text-faint">
                        <span>{t.systemName}</span>
                        <span>·</span>
                        <span className="font-mono">v{t.version}</span>
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {!templates.length && (
              <EmptyState icon={<LayoutTemplate />} title="暂无模板" description="从沉淀的完成系统中保存标准模板" />
            )}
          </Panel>
        </section>
      </div>

      {/* 系统总览表 */}
      <Panel title="系统总览" count={rows.length} icon={<PenTool className="size-4" />}>
        <div className="overflow-auto rounded-md border border-rule">
          <Table>
            <THead><TR><TH>项目 / 系统</TH><TH>档次</TH><TH>点位</TH><TH>推导</TH><TH>进度</TH><TH>状态</TH><TH></TH></TR></THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.ps.id} className="hover:bg-hover">
                  <TD>
                    <span className="block font-medium">{r.systemName}</span>
                    <span className="block font-mono text-[10.5px] text-faint">{r.projectName}</span>
                  </TD>
                  <TD><Badge variant={gradeVariant(r.gradeCode)}>{gradeLabel(r.gradeCode)}</Badge></TD>
                  <TD><NumCell>{fmtNum(r.points)}</NumCell></TD>
                  <TD><NumCell>{fmtNum(r.derived)}</NumCell></TD>
                  <TD><div className="w-28"><Progress value={r.ps.progress} /></div></TD>
                  <TD><StatusBadge status={r.ps.status} /></TD>
                  <TD>
                    <Button size="xs" variant="outline" onClick={() => navigate(`/projects/${r.ps.project_id}/systems/${r.ps.id}`)}>进入设计</Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      </Panel>
    </div>
  )
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg border border-rule bg-surface px-4 py-3 shadow-sm">
      <div className="flex items-center gap-1.5 text-[11px] text-muted">{icon}{label}</div>
      <p className={cn('mt-1 font-mono text-[22px] leading-none font-bold', tone)}>{value}</p>
    </div>
  )
}

function Panel({ title, count, icon, children }: { title: string; count?: number; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-rule bg-surface shadow-sm">
      <div className="flex items-center gap-2 border-b border-rule px-3.5 py-2.5">
        <span className="text-accent">{icon}</span>
        <h3 className="text-[13px] font-semibold">{title}</h3>
        {typeof count === 'number' && count > 0 && <span className="rounded-full bg-surface-subtle px-1.5 text-[10.5px] text-muted">{count}</span>}
      </div>
      <div className="px-3.5 py-3">{children}</div>
    </div>
  )
}

type GradeVariant = 'neutral' | 'warn' | 'accent' | 'accent2'
function gradeLabel(code?: string) {
  return { economic: '经济型', standard: '标准型', premium: '高端型' }[code ?? ''] ?? '未设定'
}
function gradeVariant(code?: string): GradeVariant {
  const map: Record<string, GradeVariant> = { economic: 'warn', standard: 'accent', premium: 'accent2' }
  return map[code ?? ''] ?? 'neutral'
}