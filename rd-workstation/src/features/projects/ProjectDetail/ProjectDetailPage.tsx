import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Plus, Building2, CheckCircle2, FileText, ChevronRight, Download, ArrowLeftRight } from 'lucide-react'
import { useDB } from '../../../db/memory-db'
import { T } from '../../../types/domain'
import { ProjectService, PointService, BillService, BudgetService, TaskService, SystemService } from '../../../services'
import { StatusBadge } from '../../../components/ui/badge'
import { Progress } from '../../../components/ui/progress'
import { Modal } from '../../../components/ui/dialog'
import { Button } from '../../../components/ui/button'
import { Table, THead, TBody, TR, TH, TD, NumCell } from '../../../components/ui/table'
import { DataLinkageStrip } from '../../../components/data-linkage-strip'
import { toast } from '../../../components/ui/toast'
import { fmtMoney, fmtNum } from '../../../lib/utils'
import { cn } from '../../../lib/utils'

const TABS = ['overview', 'systems', 'tasks', 'schedules', 'points', 'devices', 'bills', 'budget', 'documents', 'revisions', 'review']

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  useDB((s) => s.db)
  const location = useLocation()
  const navigate = useNavigate()
  const [addSysOpen, setAddSysOpen] = useState(false)

  const project = projectId ? ProjectService.get(projectId) : undefined
  if (!project) {
    return <div className="p-8 text-muted">项目不存在或已删除。</div>
  }

  const tab = TABS.find((t) => location.pathname.endsWith(`/${t}`)) ?? 'overview'
  const systems = ProjectService.systems(project.id)
  const tasks = TaskService.list({ projectId: project.id })
  const docs = useDB.getState().getTable<{ id: string; project_id?: string; type?: string; title: string; version?: string; status?: string }>(T.documents).filter((d) => d.project_id === project.id)
  const vssPs = systems[0]
  const points = vssPs ? PointService.list(vssPs.id) : []

  const renderTab = () => {
    switch (tab) {
      case 'overview':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <section className="lg:col-span-4">
                <Panel title="项目摘要">
                  <dl className="space-y-2 text-[12.5px]">
                    {[
                      ['业主', project.client_name],
                      ['项目类型', project.project_type],
                      ['建筑面积', `${fmtNum(project.building_area)} ㎡`],
                      ['层数', `${fmtNum(project.floor_count)} 层`],
                      ['设计阶段', project.design_stage],
                      ['默认档次', gradeName(project.default_grade_code)],
                      ['计划周期', `${project.start_date} ~ ${project.planned_end_date}`],
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
                <Panel title={`子系统进度（${systems.length}）`} extra={<Button size="sm" variant="secondary" onClick={() => setAddSysOpen(true)}><Plus className="size-3.5" />添加系统</Button>}>
                  <ul className="space-y-3">
                    {systems.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          className="mb-1 flex w-full items-center justify-between text-left"
                          onClick={() => navigate(`/projects/${project.id}/systems/${s.id}`)}
                        >
                          <span className="flex items-center gap-2 text-[13px] font-medium hover:text-accent">
                            <span className="font-mono text-[11px] text-faint">{s.systemCode}</span>
                            {s.systemName}
                            <ChevronRight className="size-3.5 text-faint" />
                          </span>
                          <span className="flex items-center gap-2">
                            <StatusBadge status={s.status} />
                            <span className="font-mono text-[11px] text-muted">{s.progress}%</span>
                          </span>
                        </button>
                        <Progress value={s.progress} />
                      </li>
                    ))}
                    {!systems.length && <p className="text-[12px] text-faint">还没有子系统，点击「添加系统」开始设计。</p>}
                  </ul>
                </Panel>
              </section>
            </div>

            {vssPs && (
              <Panel title="数据联动 · 视频监控系统">
                <DataLinkageStrip psId={vssPs.id} />
              </Panel>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Panel title="近期任务" count={tasks.length}>
                <ul className="space-y-1">
                  {tasks.slice(0, 5).map((t) => (
                    <li key={t.id} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-hover">
                      <button type="button" aria-label={t.title} onClick={() => TaskService.toggle(t.id)} className="flex size-4 items-center justify-center rounded-[4px] border border-rule bg-surface">
                        {t.status === 'done' && <CheckCircle2 className="size-4 text-ok" />}
                      </button>
                      <span className={cn('flex-1 text-[13px]', t.status === 'done' ? 'text-faint line-through' : 'text-ink')}>{t.title}</span>
                      <StatusBadge status={t.status === 'done' ? 'done' : t.status === 'doing' ? 'designing' : 'todo'} />
                    </li>
                  ))}
                  {!tasks.length && <p className="px-2 py-1 text-[12px] text-faint">暂无任务</p>}
                </ul>
              </Panel>
              <Panel title={`文档（${docs.length}）`}>
                <ul className="space-y-1">
                  {docs.map((d) => (
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
          </div>
        )

      case 'systems':
        return (
          <div className="space-y-4">
            <div className="flex justify-end"><Button size="sm" variant="secondary" onClick={() => setAddSysOpen(true)}><Plus className="size-3.5" />添加系统</Button></div>
            <div className="rounded-lg border border-rule bg-surface">
              <Table>
                <THead><TR><TH>系统</TH><TH>编码</TH><TH>档次</TH><TH>进度</TH><TH>状态</TH><TH>操作</TH></TR></THead>
                <TBody>
                  {systems.map((s) => (
                    <TR key={s.id} className="hover:bg-hover">
                      <TD className="font-medium">{s.systemName}</TD>
                      <TD><NumCell>{s.systemCode}</NumCell></TD>
                      <TD className="text-muted">{gradeName(s.design_grade)}</TD>
                      <TD><div className="w-36"><Progress value={s.progress} showLabel /></div></TD>
                      <TD><StatusBadge status={s.status} /></TD>
                      <TD>
                        <Button size="xs" variant="outline" onClick={() => navigate(`/projects/${project.id}/systems/${s.id}`)}>进入设计</Button>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          </div>
        )

      case 'tasks':
        return (
          <div className="rounded-lg border border-rule bg-surface">
            <Table>
              <THead><TR><TH></TH><TH>任务</TH><TH>优先级</TH><TH>截止</TH><TH>状态</TH></TR></THead>
              <TBody>
                {tasks.map((t) => (
                  <TR key={t.id}>
                    <TD className="w-8 pr-0">
                      <button type="button" aria-label={t.title} onClick={() => TaskService.toggle(t.id)} className="flex size-4 items-center justify-center rounded-[4px] border border-rule bg-surface">
                        {t.status === 'done' && <CheckCircle2 className="size-4 text-ok" />}
                      </button>
                    </TD>
                    <TD className="font-medium">{t.title}</TD>
                    <TD><PriorityChip p={t.priority} /></TD>
                    <TD className="font-mono text-[12px] text-muted">{t.due_at?.slice(0, 10)}</TD>
                    <TD><StatusBadge status={t.status === 'done' ? 'done' : t.status === 'blocked' ? 'blocked' : t.status === 'doing' ? 'designing' : 'todo'} /></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            {!tasks.length && <p className="px-4 py-6 text-center text-[12.5px] text-faint">暂无任务</p>}
          </div>
        )

      case 'points':
        return vssPs ? (
          <PointsTable psId={vssPs.id} points={points} />
        ) : <p className="p-8 text-center text-muted">请先添加系统</p>

      case 'bills':
        return <BillsTab projectId={project.id} />

      case 'budget':
        return <BudgetTab projectId={project.id} />

      default:
        return (
          <div className="flex h-64 items-center justify-center">
            <p className="text-[13px] text-faint">「{tabLabel(tab)}」标签页将在后续批次实现</p>
          </div>
        )
    }
  }

  return (
    <div className="mx-auto max-w-[1080px] space-y-4 p-5">
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight">{project.name}</h1>
        <p className="mt-1 flex items-center gap-2 text-[12.5px] text-muted">
          <span className="font-mono">{project.project_code}</span>
          <span>·</span>
          <StatusBadge status={project.status} />
          <span className="flex items-center gap-1"><Building2 className="size-3.5" />{project.building_type}</span>
        </p>
      </div>
      {renderTab()}

      <Modal
        open={addSysOpen}
        onClose={() => setAddSysOpen(false)}
        title="添加子系统"
        width={420}
      >
        <div className="space-y-1.5">
          {SystemService.listStandard().map((s) => {
            const exists = systems.some((x) => x.system_id === s.id)
            return (
              <button
                key={s.id}
                type="button"
                disabled={exists}
                onClick={() => {
                  ProjectService.addSystem(project.id, s.id, project.default_grade_code)
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

/* ---------- 子组件 ---------- */
function Panel({ title, extra, count, children }: { title: string; extra?: React.ReactNode; count?: number; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-rule bg-surface shadow-sm">
      <div className="flex items-center gap-2 border-b border-rule px-3.5 py-2.5">
        <h3 className="text-[13px] font-semibold">{title}</h3>
        {count !== undefined && count > 0 && <span className="rounded-full bg-surface-subtle px-1.5 text-[10.5px] text-muted">{count}</span>}
        <div className="ml-auto">{extra}</div>
      </div>
      <div className="px-3.5 py-3">{children}</div>
    </div>
  )
}

function gradeName(code?: string) {
  return { economic: '经济型', standard: '标准型', premium: '高端型' }[code ?? ''] ?? code ?? '—'
}

function tabLabel(tab: string) {
  return { overview: '概览', systems: '系统', tasks: '任务', schedules: '日程', points: '点位', devices: '设备', bills: '清单', budget: '预算', documents: '文档', revisions: '版本', review: '复盘' }[tab] ?? tab
}

function PriorityChip({ p }: { p: string }) {
  const map: Record<string, string> = { high: 'text-danger', medium: 'text-warn', low: 'text-faint', urgent: 'text-danger' }
  return <span className={cn('text-[12px] font-medium', map[p] ?? 'text-muted')}>{p === 'urgent' ? '紧急' : p === 'high' ? '高' : p === 'medium' ? '中' : '低'}</span>
}

function PointsTable({ psId, points }: { psId: string; points: ReturnType<typeof PointService.list> }) {
  const cats = PointService.categories(useDB.getState().getById<{ id: string; system_id: string }>(T.project_systems, psId)?.system_id ?? 'sys_vss')
  const catName = (id?: string) => cats.find((c) => c.id === id)?.name ?? '—'
  return (
    <div className="rounded-lg border border-rule bg-surface">
      <Table>
        <THead><TR><TH>编号</TH><TH>名称</TH><TH>类别</TH><TH>楼层</TH><TH>位置</TH><TH>数量</TH></TR></THead>
        <TBody>
          {points.map((p) => (
            <TR key={p.id} className="hover:bg-hover">
              <TD><NumCell>{p.point_code}</NumCell></TD>
              <TD className="font-medium">{p.point_name}</TD>
              <TD className="text-muted">{catName(p.category_id)}</TD>
              <TD className="text-muted">{p.floor}</TD>
              <TD className="text-muted">{p.space}</TD>
              <TD><NumCell>{fmtNum(p.quantity)}</NumCell></TD>
            </TR>
          ))}
        </TBody>
      </Table>
      {!points.length && <p className="px-4 py-6 text-center text-[12.5px] text-faint">暂无点位，请到系统设计工作区录入</p>}
    </div>
  )
}

function BillsTab({ projectId }: { projectId: string }) {
  const versions = BillService.versions(projectId)
  return (
    <div className="space-y-4">
      {versions.map((v) => {
        const items = BillService.items(v.id)
        const total = items.reduce((s, i) => s + i.amount, 0)
        const summary = BillService.summary(v.id)
        return (
          <Panel
            key={v.id}
            title={`${v.name}（${v.version_no}）`}
            extra={
              <div className="flex items-center gap-2">
                <StatusBadge status={v.status ?? 'draft'} />
                <Button size="xs" variant="outline" onClick={() => exportVersion(v, items, projectId)}>
                  <Download className="size-3" />导出 CSV
                </Button>
              </div>
            }
          >
            <Table>
              <THead><TR><TH>编码</TH><TH>名称</TH><TH>规格</TH><TH>类别</TH><TH>数量</TH><TH>单价</TH><TH>金额</TH></TR></THead>
              <TBody>
                {items.map((i) => (
                  <TR key={i.id}>
                    <TD><NumCell>{i.item_code}</NumCell></TD>
                    <TD className="font-medium">{i.item_name}</TD>
                    <TD className="max-w-[200px] truncate text-muted">{i.specification}</TD>
                    <TD><span className="rounded-full bg-surface-subtle px-2 py-0.5 text-[11px] text-muted">{i.category}</span></TD>
                    <TD><NumCell>{fmtNum(i.quantity)}</NumCell></TD>
                    <TD className="font-mono text-[12px] text-muted">{fmtMoney(i.unit_price)}</TD>
                    <TD className="font-mono text-[12.5px] font-semibold">{fmtMoney(i.amount)}</TD>
                  </TR>
                ))}
                {!items.length && <TR><TD colSpan={7} className="py-4 text-center text-faint">清单为空，请先在系统设计工作区生成</TD></TR>}
              </TBody>
            </Table>
            {summary.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 border-t border-rule pt-2 text-[12px] text-muted">
                {summary.map((s) => (
                  <span key={s.category}>{s.category}：<b className="font-mono text-ink">{fmtMoney(s.amount)}</b>（{fmtNum(s.quantity)}）</span>
                ))}
              </div>
            )}
            <div className="mt-2 flex justify-end text-[13px]"><span className="text-muted">合计：</span><span className="ml-2 font-mono font-bold">{fmtMoney(total)}</span></div>
          </Panel>
        )
      })}
      {!versions.length && (
        <div className="rounded-lg border border-rule bg-surface p-8 text-center text-[13px] text-faint">
          尚未生成清单版本。进入「系统设计工作区 → 清单」步骤生成。
        </div>
      )}
      <BillVersionCompare versions={versions} />
    </div>
  )
}

/** 清单版本对比：两个版本差异，按 item_code 匹配（added / removed / changed） */
function BillVersionCompare({ versions }: { versions: ReturnType<typeof BillService.versions> }) {
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  if (versions.length < 2) return null
  const va = versions.find((v) => v.id === a) ?? versions[0]
  const vb = versions.find((v) => v.id === b) ?? versions[1]
  const diff = BillService.compareVersions(va.id, vb.id)
  const row = (label: string, items: typeof diff.added, tone: string, showKey: (i: { quantity: number; unit_price: number; unit?: string; item_code?: string }) => string) =>
    items.length ? (
      <div className="mt-2">
        <p className={cn('text-[12px] font-semibold', tone)}>{label}</p>
        <Table>
          <THead><TR><TH>编码</TH><TH>名称</TH><TH>变化</TH><TH>金额</TH></TR></THead>
          <TBody>
            {items.map((i) => (
              <TR key={i.id}>
                <TD><NumCell>{i.item_code}</NumCell></TD>
                <TD className="font-medium">{i.item_name}</TD>
                <TD className="text-muted">{showKey(i)}</TD>
                <TD className="font-mono text-[12px]">{fmtMoney(i.amount)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    ) : null

  return (
    <div className="rounded-lg border border-rule bg-surface shadow-sm">
      <div className="flex items-center gap-2 border-b border-rule px-3.5 py-2.5">
        <ArrowLeftRight className="size-4 text-accent" />
        <h3 className="text-[13px] font-semibold">版本对比</h3>
      </div>
      <div className="space-y-3 px-3.5 py-3">
        <div className="flex items-center gap-2 text-[12.5px]">
          <select className="h-7 rounded-[6px] border border-rule bg-surface px-2 text-[12.5px]" value={va.id} onChange={(e) => setA(e.target.value)}>
            {versions.map((v) => <option key={v.id} value={v.id}>{v.version_no}</option>)}
          </select>
          <span className="text-faint">→</span>
          <select className="h-7 rounded-[6px] border border-rule bg-surface px-2 text-[12.5px]" value={vb.id} onChange={(e) => setB(e.target.value)}>
            {versions.map((v) => <option key={v.id} value={v.id}>{v.version_no}</option>)}
          </select>
          <span className="ml-auto text-[12px] text-muted">
            {va.version_no} → {vb.version_no}：新增 {diff.added.length} · 移除 {diff.removed.length} · 变化 {diff.changed.length}
          </span>
        </div>
        {row('新增', diff.added, 'text-ok', (i) => `${fmtNum(i.quantity)} ${i.unit || ''} @ ${fmtMoney(i.unit_price)}`)}
        {row('移除', diff.removed, 'text-danger', (i) => `${fmtNum(i.quantity)} ${i.unit || ''} @ ${fmtMoney(i.unit_price)}`)}
        {row('数量/单价变化', diff.changed, 'text-warn', (i) => {
          const old = versions.length ? BillService.items(va.id).find((x) => x.item_code === i.item_code) : undefined
          return old ? `${fmtNum(old.quantity)} → ${fmtNum(i.quantity)} / ${fmtMoney(old.unit_price)} → ${fmtMoney(i.unit_price)}` : ''
        })}
        {!diff.added.length && !diff.removed.length && !diff.changed.length && (
          <p className="text-[12px] text-faint">两个版本内容一致。</p>
        )}
      </div>
    </div>
  )
}

function exportVersion(v: { id: string; version_no: string }, _items: unknown[], projectId: string) {
  const csv = BillService.exportCSV(v.id)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${projectId}-清单-${v.version_no}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function BudgetTab({ projectId }: { projectId: string }) {
  const budgets = BudgetService.byProject(projectId)
  const vssBudget = BudgetService.items(budgets[0]?.id ?? '__none__')
  const total = budgets.reduce((s, b) => s + b.total_amount, 0)
  return (
    <div className="rounded-lg border border-rule bg-surface p-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[12px] text-muted">预算总额（当前版本）</p>
          <p className="font-display font-mono text-2xl font-bold text-ink">{fmtMoney(total)}</p>
        </div>
        <StatusBadge status={budgets.length ? 'draft' : 'todo'} />
      </div>
      {vssBudget.length > 0 && (
        <div className="mt-4 border-t border-rule pt-3">
          <p className="mb-2 text-[12px] font-semibold text-muted">预算明细</p>
          <Table>
            <THead><TR><TH>清单项</TH><TH>数量</TH><TH>单价</TH><TH>金额</TH></TR></THead>
            <TBody>
              {vssBudget.map((i) => (
                <TR key={i.id}>
                  <TD className="font-medium">{BillService.items(i.bill_item_id ?? '')?.[0]?.item_name ?? i.bill_item_id}</TD>
                  <TD><NumCell>{fmtNum(i.quantity)}</NumCell></TD>
                  <TD className="font-mono text-[12px] text-muted">{fmtMoney(i.unit_price)}</TD>
                  <TD className="font-mono text-[12.5px] font-semibold">{fmtMoney(i.amount)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
      {!budgets.length && <p className="mt-3 text-[12.5px] text-faint">暂无预算，生成清单后可生成预算。</p>}
    </div>
  )
}
