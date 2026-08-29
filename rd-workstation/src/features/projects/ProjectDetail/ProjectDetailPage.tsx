import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Plus, Building2, CheckCircle2, FileText, ChevronRight, Download, Upload, ArrowLeftRight, CalendarClock, Wallet } from 'lucide-react'
import { useDB } from '../../../db/memory-db'
import { T } from '../../../types/domain'
import { ProjectService, PointService, BillService, BudgetService, TaskService, SystemService, ScheduleService } from '../../../services'
import { StatusBadge } from '../../../components/ui/badge'
import { Progress } from '../../../components/ui/progress'
import { Modal } from '../../../components/ui/dialog'
import { Button } from '../../../components/ui/button'
import { Table, THead, TBody, TR, TH, TD, NumCell } from '../../../components/ui/table'
import { SortableTable, type SortableColumn } from '../../../components/ui/sortable-table'
import { DataLinkageStrip } from '../../../components/data-linkage-strip'
import { TaskFormModal } from '../../tasks/TaskFormModal'
import { OverviewMetrics } from './components/OverviewMetrics'
import { BuildingsTab } from './components/BuildingsTab'
import { SchedulesTab } from './components/SchedulesTab'
import { TasksTab } from './components/TasksTab'
import { DevicesTab } from './components/DevicesTab'
import { DocumentsTab } from './components/DocumentsTab'
import { VersionsTab } from './components/VersionsTab'
import { ReviewTab } from './components/ReviewTab'
import { toast } from '../../../components/ui/toast'
import { fmtMoney, fmtNum } from '../../../lib/utils'
import { cn } from '../../../lib/utils'

const TABS = ['overview', 'buildings', 'systems', 'tasks', 'schedules', 'points', 'devices', 'bills', 'budget', 'documents', 'revisions', 'review']

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  useDB((s) => s.db)
  const location = useLocation()
  const navigate = useNavigate()
  const [addSysOpen, setAddSysOpen] = useState(false)
  const [backupOpen, setBackupOpen] = useState(false)
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [selPsId, setSelPsId] = useState('')

  const project = projectId ? ProjectService.get(projectId) : undefined
  if (!project) {
    return <div className="p-8 text-muted">项目不存在或已删除。</div>
  }

  const tab = TABS.find((t) => location.pathname.endsWith(`/${t}`)) ?? 'overview'
  const systems = ProjectService.systems(project.id)
  const tasks = TaskService.list({ projectId: project.id })
  const budgets = BudgetService.byProject(project.id)
  const schedules = ScheduleService.byProject(project.id).filter((s) => new Date(s.start_at) >= new Date()).slice(0, 4)
  const docs = useDB.getState().getTable<{ id: string; project_id?: string; type?: string; title: string; version?: string; status?: string }>(T.documents).filter((d) => d.project_id === project.id)
  const overviewPs = systems[0]
  // D1：点位 tab 支持子系统切换；未指定时默认第一系统
  const pointPs = selPsId ? (systems.find((s) => s.id === selPsId) ?? systems[0]) : systems[0]
  const points = pointPs ? PointService.list(pointPs.id) : []

  const triggerExportBackup = () => {
    const json = ProjectService.exportBackup(project.id)
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.project_code}-backup.rdw.json`
    a.click()
    URL.revokeObjectURL(url)
    toast('项目备份已导出')
  }

  const renderTab = () => {
    switch (tab) {
      case 'overview':
        return (
          <div className="space-y-4">
            <OverviewMetrics projectId={project.id} />
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
                  {/* 预算状态（P1-3）：已生成预算显示总额，未生成提示 */}
                  <button
                    type="button"
                    onClick={() => navigate(`/projects/${project.id}/budget`)}
                    className="mt-3 flex w-full items-center gap-2 rounded-md border border-rule bg-surface-subtle/60 px-3 py-2 text-left transition-colors hover:border-accent/40"
                  >
                    <Wallet className={cn('size-3.5', budgets.length ? 'text-ok' : 'text-faint')} />
                    <span className="text-[12.5px] font-medium">项目预算</span>
                    {budgets.length ? (
                      <span className="ml-auto font-mono text-[12.5px] font-semibold text-ink">{fmtMoney(budgets.reduce((s, b) => s + b.total_amount, 0))}</span>
                    ) : (
                      <span className="ml-auto text-[12px] text-faint">未生成预算，点击前往 →</span>
                    )}
                  </button>
                </Panel>
              </section>
            </div>

            {overviewPs && (
              <Panel title="数据联动 · 视频监控系统">
                <DataLinkageStrip psId={overviewPs.id} projectId={project.id} />
              </Panel>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Panel
                title="近期任务"
                count={tasks.length}
                extra={<Button size="xs" variant="outline" onClick={() => setTaskModalOpen(true)}><Plus className="size-3" />新建</Button>}
              >
                <ul className="space-y-1">
                  {tasks.slice(0, 5).map((t) => (
                    <li key={t.id} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-hover">
                      <button type="button" aria-label={t.title} onClick={() => TaskService.toggle(t.id)} className="flex size-4 items-center justify-center rounded-[4px] border border-rule bg-surface">
                        {t.status === 'done' && <CheckCircle2 className="size-4 text-ok" />}
                      </button>
                      <span className={cn('flex-1 truncate text-[13px]', t.status === 'done' ? 'text-faint line-through' : 'text-ink')}>{t.title}</span>
                      <StatusBadge status={t.status === 'done' ? 'done' : t.status === 'doing' ? 'designing' : 'todo'} />
                    </li>
                  ))}
                  {!tasks.length && <p className="px-2 py-1 text-[12px] text-faint">暂无任务</p>}
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
                  {!schedules.length && <p className="px-2 py-1 text-[12px] text-faint">暂无排期，可在「日程」页添加</p>}
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

      case 'buildings':
        return <BuildingsTab projectId={project.id} />

      case 'systems':
        return (
          <div className="space-y-4">
            <div className="flex justify-end"><Button size="sm" variant="secondary" onClick={() => setAddSysOpen(true)}><Plus className="size-3.5" />添加系统</Button></div>
            <SystemsTable projectId={project.id} systems={systems} onOpen={(s) => navigate(`/projects/${project.id}/systems/${s}`)} />
          </div>
        )

      case 'tasks':
        return <TasksTab projectId={project.id} />

      case 'schedules':
        return <SchedulesTab projectId={project.id} />

      case 'points':
        return (
          <div className="space-y-3">
            {systems.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-muted">子系统</span>
                <select
                  value={pointPs?.id ?? ''}
                  onChange={(e) => setSelPsId(e.target.value)}
                  className="h-7 rounded-[6px] border border-rule bg-surface px-2 text-[12.5px]"
                >
                  {systems.map((s) => (
                    <option key={s.id} value={s.id}>{s.systemCode} · {s.systemName}</option>
                  ))}
                </select>
                {pointPs && <span className="font-mono text-[11px] text-faint">{points.length} 个点位</span>}
              </div>
            )}
            {pointPs ? (
              <PointsTable points={points} />
            ) : <p className="p-8 text-center text-muted">请先添加系统</p>}
          </div>
        )

      case 'bills':
        return <BillsTab projectId={project.id} />

      case 'budget':
        return <BudgetTab projectId={project.id} />

      case 'devices':
        return <DevicesTab projectId={project.id} />

      case 'documents':
        return <DocumentsTab projectId={project.id} />

      case 'revisions':
        return <VersionsTab projectId={project.id} />

      case 'review':
        return <ReviewTab projectId={project.id} projectName={project.name} />

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
        <div className="mt-1 flex items-center gap-2 text-[12.5px] text-muted">
          <span className="font-mono">{project.project_code}</span>
          <span>·</span>
          <StatusBadge status={project.status} />
          <span className="flex items-center gap-1"><Building2 className="size-3.5" />{project.building_type}</span>
          <span className="ml-auto">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={triggerExportBackup}><Download className="size-3.5" />导出备份</Button>
              <Button size="sm" variant="outline" onClick={() => setBackupOpen(true)}><Upload className="size-3.5" />导入备份</Button>
            </div>
          </span>
        </div>
      </div>
      {renderTab()}

      {/* 统一任务表单（P1-2）：项目主页新建任务，可关联目标 */}
      <TaskFormModal
        key={taskModalOpen ? 'open' : 'closed'}
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        projectId={project.id}
      />

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

      <ImportBackupModal open={backupOpen} onClose={() => setBackupOpen(false)} />
    </div>
  )
}

/* ---------- 导入备份弹窗 ---------- */
function ImportBackupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const doImport = (file?: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const res = ProjectService.importBackup(String(reader.result ?? ''))
      if (res.ok) toast(res.message ?? '已导入项目备份')
      else toast(res.message ?? '备份导入失败', 'warn')
      if (res.ok) onClose()
    }
    reader.readAsText(file)
  }
  return (
    <Modal open={open} onClose={onClose} title="导入项目备份" width={440}>
      <div className="space-y-3">
        <p className="text-[12.5px] text-muted">
          选择由本应用导出的 <span className="font-mono">*.rdw.json</span> 备份文件。导入将按 id 合并项目表数据：已存在的记录被覆盖，新记录被插入。
        </p>
        <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-rule py-8 text-faint transition-colors hover:border-accent/50 hover:text-accent">
          <Upload className="size-6" />
          <span className="text-[12.5px]">点击选择备份文件</span>
          <input ref={fileRef} type="file" accept=".json,.rdw.json" className="hidden" onChange={(e) => { doImport(e.target.files?.[0]); e.target.value = '' }} />
        </label>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onClose}>取消</Button>
          <Button size="sm" onClick={() => fileRef.current?.click()}>选择文件</Button>
        </div>
      </div>
    </Modal>
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
  return { overview: '概览', buildings: '建筑', systems: '系统', tasks: '任务', schedules: '日程', points: '点位', devices: '设备', bills: '清单', budget: '预算', documents: '文档', revisions: '版本', review: '复盘' }[tab] ?? tab
}

/** 项目系统列表（SortableTable：列宽拖/双击自适应/Ctrl+←→/列拖拽换序/布局记忆/行拖拽排序持久化） */
function SystemsTable({ projectId, systems, onOpen }: {
  projectId: string
  systems: ReturnType<typeof ProjectService.systems>
  onOpen: (psId: string) => void
}) {
  const [rows, setRows] = useState(systems)
  useEffect(() => { setRows(systems) }, [systems])
  const reorder = (from: number, to: number) => {
    if (from === to) return
    const next = [...rows]
    const [mv] = next.splice(from, 1)
    next.splice(to, 0, mv)
    setRows(next)
    next.forEach((s, i) => { if (s.sort_order !== i) ProjectService.updateSystem(s.id, { sort_order: i }) })
  }
  const columns = useMemo<SortableColumn<(typeof systems)[number]>[]>(() => [
    { key: 'systemName', title: '系统', width: 240, minWidth: 180, render: (s) => <span className="text-[13px] font-medium">{s.systemName}</span> },
    { key: 'systemCode', title: '编码', width: 130, render: (s) => <span className="font-mono text-[12px] text-muted">{s.systemCode || '—'}</span> },
    { key: 'design_grade', title: '档次', width: 100, render: (s) => <span className="text-muted">{gradeName(s.design_grade)}</span> },
    { key: 'progress', title: '进度', width: 160, render: (s) => <div className="w-36"><Progress value={s.progress} showLabel /></div> },
    { key: 'status', title: '状态', width: 90, render: (s) => <StatusBadge status={s.status} /> },
    { key: 'action', title: '操作', width: 110, render: (s) => <Button size="xs" variant="outline" onClick={() => onOpen(s.id)}>进入设计</Button> },
  ], [onOpen])
  return (
    <div className="rounded-lg border border-rule bg-surface">
      <SortableTable
        columns={columns}
        rows={rows}
        rowKey={(s) => s.id}
        storageKey={`psys-${projectId}`}
        onReorder={reorder}
      />
    </div>
  )
}

/** 点位表（SortableTable：列宽拖/双击自适应/Ctrl+←→/列拖拽换序/布局记忆/行拖拽排序持久化） */
function PointsTable({ points }: { points: ReturnType<typeof PointService.list> }) {
  const attached = useMemo(() => PointService.attach(points), [points])
  const [rows, setRows] = useState(attached)
  useEffect(() => { setRows(attached) }, [attached])
  const reorder = (from: number, to: number) => {
    if (from === to) return
    const next = [...rows]
    const [mv] = next.splice(from, 1)
    next.splice(to, 0, mv)
    setRows(next)
    next.forEach((p, i) => { if (p.sort_order !== i) PointService.update(p.id, { sort_order: i }) })
  }
  const columns = useMemo<SortableColumn<(typeof attached)[number]>[]>(() => [
    { key: 'point_code', title: '编号', width: 110, render: (p) => <span className="font-mono text-[12px] text-accent">{p.point_code}</span> },
    { key: 'device', title: '设备名称', width: 280, minWidth: 180, render: (p) => <span className="text-[13px] font-medium">{p.deviceName ?? '—'}</span> },
    { key: 'building', title: '建筑', width: 150, render: (p) => <span className="text-muted">{p.buildingName ?? '—'}</span> },
    { key: 'room', title: '弱电间', width: 150, render: (p) => <span className="text-muted">{p.telecomRoomName ?? '—'}</span> },
    { key: 'quantity', title: '数量', width: 90, align: 'right', render: (p) => <span className="font-mono text-[12px]">{fmtNum(p.quantity)}</span> },
  ], [])
  return (
    <div className="rounded-lg border border-rule bg-surface">
      <SortableTable
        columns={columns}
        rows={rows}
        rowKey={(p) => p.id}
        storageKey="points"
        onReorder={reorder}
        empty={<p className="px-4 py-6 text-center text-[12.5px] text-faint">暂无点位，请到系统设计工作区录入</p>}
      />
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
