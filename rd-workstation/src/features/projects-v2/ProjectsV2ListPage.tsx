import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, FolderKanban, LayoutList, Archive, ArchiveRestore, RotateCcw, Trash2, LayoutTemplate } from 'lucide-react'
import { useDB } from '../../db/memory-db'
import { useDBTable } from '../../db/selectors'
import { ProjectService, FormatService } from '../../services'
import type { Project } from '../../types/domain'
import { StatusBadge } from '../../components/ui/badge'
import { Progress } from '../../components/ui/progress'
import { Segmented } from '../../components/ui/segmented'
import { EmptyState } from '../../components/ui/empty'
import { Modal } from '../../components/ui/dialog'
import { Button } from '../../components/ui/button'
import { Field, Input, Select } from '../../components/ui/field'
import { SortableTable, type SortableColumn } from '../../components/ui/sortable-table'
import { Table, THead, TBody, TR, TH, TD, NumCell } from '../../components/ui/table'
import { toast } from '../../components/ui/toast'
import { cn } from '../../lib/utils'
import { TemplateModal } from './components/TemplateModal'
import { FormatModal } from './components/FormatModal'

const STATUS_COLUMNS = [
  { key: 'draft', label: '草稿' },
  { key: 'designing', label: '设计中' },
  { key: 'reviewing', label: '评审中' },
  { key: 'completed', label: '已完成' },
]

/** 项目中心 v2 · 主页面：项目列表 + 项目模版（按业态）+ 导出/导入备份、归档、级联删除 */
export function ProjectsV2ListPage() {
  useDBTable('projects')
  useDBTable('project_systems')
  useDBTable('systems')
  const navigate = useNavigate()
  const [view, setView] = useState<'list' | 'board'>('list')
  const [tab, setTab] = useState<'active' | 'archived'>('active')
  const [q, setQ] = useState('')
  const [format, setFormat] = useState('全部业态')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [form, setForm] = useState<Partial<Project>>({ project_type: '', default_grade_code: 'standard' })
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)
  const [backupOpen, setBackupOpen] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [formatOpen, setFormatOpen] = useState(false)

  const formats = useMemo(() => FormatService.list(), [useDB.getState().db])

  const projects = useMemo(() => {
    let all = ProjectService.list()
    if (q.trim()) {
      const kw = q.trim().toLowerCase()
      all = all.filter((p) => [p.name, p.project_code, p.client_name, p.project_type].some((v) => v?.toLowerCase().includes(kw)))
    }
    if (format !== '全部业态') all = all.filter((p) => p.project_type === format)
    return all
  }, [q, format, useDB.getState().db])

  const archivedProjects = useMemo(() => ProjectService.listArchived(), [useDB.getState().db])
  const [archivedQ, setArchivedQ] = useState('')
  const archivedFiltered = useMemo(() => {
    const kw = archivedQ.trim().toLowerCase()
    return kw ? archivedProjects.filter((p) => [p.name, p.project_code, p.client_name, p.project_type].some((v) => v?.toLowerCase().includes(kw))) : archivedProjects
  }, [archivedProjects, archivedQ])

  // 行拖拽排序：localStorage 记忆 + sort_order 持久化
  const [rows, setRows] = useState<Project[]>(projects)
  useEffect(() => { setRows(projects) }, [projects])
  const reorder = (from: number, to: number) => {
    if (from === to) return
    const next = [...rows]
    const [mv] = next.splice(from, 1)
    next.splice(to, 0, mv)
    setRows(next)
    next.forEach((p, i) => { if (p.sort_order !== i) ProjectService.update(p.id, { sort_order: i }) })
  }

  const askConfirm = (id: string, cb: () => void) => {
    if (confirmId === id) { setConfirmId(null); cb(); return }
    setConfirmId(id)
    window.setTimeout(() => setConfirmId((c) => (c === id ? null : c)), 2500)
  }
  const archiveProject = (p: Project) => {
    ProjectService.archive(p.id)
    toast(`项目「${p.name}」已归档，可在"已归档"视图恢复`)
  }
  const restoreProject = (p: Project) => {
    ProjectService.restore(p.id)
    toast(`项目「${p.name}」已恢复`)
  }
  const confirmDeleteProject = () => {
    if (!deleteTarget) return
    ProjectService.remove(deleteTarget.id)
    toast(`项目「${deleteTarget.name}」及其关联数据已删除`, 'info')
    setDeleteTarget(null)
  }

  const progressOf = (id: string) => {
    const pss = ProjectService.systems(id)
    return pss.length ? Math.round(pss.reduce((s, x) => s + x.progress, 0) / pss.length) : 0
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ project_type: formats[0] ?? '', default_grade_code: 'standard', design_stage: '方案' })
    setOpen(true)
  }
  const openEdit = (p: Project) => {
    setEditing(p)
    setForm({ ...p })
    setOpen(true)
  }
  const submitProject = () => {
    if (!form.name) { toast('请填写项目名称', 'warn'); return }
    const patch = {
      project_code: form.project_code,
      name: form.name,
      project_type: form.project_type,
      client_name: form.client_name,
      building_area: form.building_area,
      floor_count: form.floor_count,
      design_stage: form.design_stage,
      default_grade_code: form.default_grade_code,
    }
    if (editing) {
      ProjectService.update(editing.id, patch)
      toast(`项目「${form.name}」已更新`)
    } else {
      const p = ProjectService.create(patch)
      toast(`项目「${p.name}」已创建`)
    }
    setOpen(false)
    setEditing(null)
    setForm({})
  }

  // 导出 / 导入备份
  const triggerExportBackup = (p: Project) => {
    const json = ProjectService.exportBackup(p.id)
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${p.project_code}-backup.rdw.json`
    a.click()
    URL.revokeObjectURL(url)
    toast('项目备份已导出')
  }
  const doImportBackup = (file?: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const res = ProjectService.importBackup(String(reader.result ?? ''))
      if (res.ok) toast(res.message ?? '已导入项目备份')
      else toast(res.message ?? '备份导入失败', 'warn')
      if (res.ok) setBackupOpen(false)
    }
    reader.readAsText(file)
  }

  const columns = useMemo<SortableColumn<Project>[]>(() => [
    { key: 'project_code', title: '项目编号', width: 128, render: (p) => <span className="font-mono text-[12px] text-accent">{p.project_code}</span> },
    { key: 'name', title: '名称', width: 300, minWidth: 200, locked: true, render: (p) => (
        <button type="button" className="cursor-pointer text-left text-[13px] font-medium hover:text-accent" onClick={() => navigate(`/projects-v2/${p.id}`)} title="打开项目">{p.name}</button>) },
    { key: 'project_type', title: '业态', width: 150, render: (p) => <span className="text-muted">{p.project_type || '—'}</span> },
    { key: 'client_name', title: '业主', width: 170, render: (p) => <span className="text-muted">{p.client_name ?? '—'}</span> },
    { key: 'progress', title: '进度', width: 160, render: (p) => <div className="w-36"><Progress value={progressOf(p.id)} showLabel /></div> },
    { key: 'status', title: '状态', width: 92, render: (p) => <StatusBadge status={p.status} /> },
    { key: 'updated_at', title: '更新时间', width: 108, render: (p) => <span className="font-mono text-[12px] text-faint">{p.updated_at.slice(5, 10)}</span> },
    { key: 'actions', title: '操作', width: 150, locked: true, render: (p) => (
        <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          <button type="button" title="导出备份" onClick={() => triggerExportBackup(p)} className="rounded p-1 text-faint transition-colors hover:bg-hover hover:text-accent">
            <RotateCcw className="size-3.5" />
          </button>
          <button type="button" title="编辑项目" onClick={() => openEdit(p)} className="rounded p-1 text-faint transition-colors hover:bg-hover hover:text-accent">
            <span className="text-[12px] font-semibold">✎</span>
          </button>
          <button type="button" title="删除项目（连同全部关联数据）" onClick={() => setDeleteTarget(p)} className="rounded p-1 text-faint transition-colors hover:bg-hover hover:text-danger">
            <Trash2 className="size-3.5" />
          </button>
          <button type="button" title="归档项目（需两次点击确认）" onClick={() => askConfirm(`archive-${p.id}`, () => archiveProject(p))} className={cn('rounded p-1 transition-colors', confirmId === `archive-${p.id}` ? 'bg-danger text-white' : 'text-faint hover:bg-hover hover:text-danger')}>
            {confirmId === `archive-${p.id}` ? <RotateCcw className="size-3.5" /> : <Archive className="size-3.5" />}
          </button>
        </div>) },
  ], [navigate, progressOf, confirmId, askConfirm, archivedProjects.length])

  return (
    <div className="mx-auto max-w-[1080px] space-y-4 p-5">
      {/* 主页面题头：标题行 + 独立工具行（两行布局，避免与功能行冲突） */}
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight">项目中心</h1>
        <p className="mt-1 text-[12.5px] text-muted">管理你的弱电 / 智能建筑项目</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={tab}
          onChange={(t) => setTab(t as 'active' | 'archived')}
          options={[
            { value: 'active', label: <span className="flex items-center gap-1"><LayoutList className="size-3.5" />进行中 <span className="font-mono text-[10.5px] opacity-70">{projects.length}</span></span> },
            { value: 'archived', label: <span className="flex items-center gap-1"><Archive className="size-3.5" />已归档 <span className="font-mono text-[10.5px] opacity-70">{archivedProjects.length}</span></span> },
          ]}
        />
        {tab === 'active' && (
          <>
            <div className="relative">
              <Search className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-faint" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索项目…" className="w-44 pl-7" />
            </div>
            <Select value={format} onChange={(e) => setFormat(e.target.value)} className="h-8 w-44 text-[12.5px]">
              <option>全部业态</option>
              {formats.map((f) => <option key={f} value={f}>{f}</option>)}
            </Select>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: 'list', label: <span className="flex items-center gap-1"><LayoutList className="size-3.5" />列表</span> },
                { value: 'board', label: <span className="flex items-center gap-1"><FolderKanban className="size-3.5" />看板</span> },
              ]}
            />
          </>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setTemplateOpen(true)}><LayoutTemplate className="size-4" />项目模版</Button>
          <Button variant="outline" onClick={() => setFormatOpen(true)}>＋ 自定义业态</Button>
          <Button variant="outline" onClick={() => setBackupOpen(true)}>导入备份</Button>
          <Button onClick={openCreate}><Plus className="size-4" />新建项目</Button>
        </div>
      </div>

      {tab === 'archived' ? (
        <div className="rounded-lg border border-rule bg-surface">
          <div className="flex items-center gap-2 border-b border-rule px-3 py-2">
            <div className="relative">
              <Search className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-faint" />
              <Input value={archivedQ} onChange={(e) => setArchivedQ(e.target.value)} placeholder="搜索已归档项目…" className="h-7 w-56 pl-7 text-[12.5px]" />
            </div>
            <span className="ml-auto font-mono text-[11px] text-faint">{archivedFiltered.length} 个已归档项目</span>
          </div>
          {archivedFiltered.length ? (
            <Table>
              <THead><TR><TH>项目编号</TH><TH>名称</TH><TH>业态</TH><TH>业主</TH><TH>归档时间</TH><TH>操作</TH></TR></THead>
              <TBody>
                {archivedFiltered.map((p) => (
                  <TR key={p.id}>
                    <TD><NumCell>{p.project_code}</NumCell></TD>
                    <TD className="font-medium">
                      <button type="button" className="cursor-pointer text-left text-[12.5px] hover:text-accent" onClick={() => navigate(`/projects-v2/${p.id}`)} title="打开项目">{p.name}</button>
                    </TD>
                    <TD className="text-muted">{p.project_type ?? '—'}</TD>
                    <TD className="text-muted">{p.client_name ?? '—'}</TD>
                    <TD className="font-mono text-[12px] text-faint">{p.archived_at?.slice(0, 10) ?? '—'}</TD>
                    <TD>
                      <Button size="xs" variant="outline" onClick={() => askConfirm(`restore-${p.id}`, () => restoreProject(p))} className={cn(confirmId === `restore-${p.id}` && 'bg-accent text-white')}>
                        {confirmId === `restore-${p.id}` ? '再次点击确认' : <><ArchiveRestore className="size-3" />恢复</>}
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <EmptyState icon={<Archive />} title={archivedProjects.length ? '没有匹配的已归档项目' : '还没有已归档项目'} description={archivedProjects.length ? '换个关键词试试' : '完成或暂停的项目可归档到这里，随时可恢复'} />
          )}
        </div>
      ) : projects.length === 0 && !q && format === '全部业态' ? (
        <div className="rounded-lg border border-rule bg-surface">
          <EmptyState
            icon={<FolderKanban />}
            title="还没有项目"
            description="创建一个项目，或先「项目模版」按业态一键生成项目骨架"
            action={<Button onClick={openCreate}><Plus className="size-4" />新建第一个项目</Button>}
          />
        </div>
      ) : view === 'list' ? (
        <div className="rounded-lg border border-rule bg-surface">
          <SortableTable<Project>
            columns={columns}
            rows={rows}
            rowKey={(p) => p.id}
            storageKey="projects-v2"
            onReorder={reorder}
            onRowDoubleClick={(p) => openEdit(p)}
          />
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {STATUS_COLUMNS.map((col) => {
            const items = projects.filter((p) => p.status === col.key)
            return (
              <div key={col.key} className="rounded-lg border border-rule bg-surface-subtle/60">
                <div className="flex items-center justify-between border-b border-rule px-3 py-2">
                  <span className="text-[12.5px] font-semibold">{col.label}</span>
                  <span className="rounded-full bg-surface px-1.5 text-[10.5px] text-muted">{items.length}</span>
                </div>
                <div className="space-y-2 p-2">
                  {items.map((p) => (
                    <button key={p.id} type="button" onClick={() => navigate(`/projects-v2/${p.id}`)} className="w-full rounded-md border border-rule bg-surface p-2.5 text-left shadow-sm transition-colors hover:border-accent/40">
                      <p className="truncate text-[12.5px] font-medium">{p.name}</p>
                      <p className="mt-0.5 font-mono text-[10.5px] text-faint">{p.project_code} · {p.project_type ?? '—'}</p>
                      <div className="mt-2"><Progress value={progressOf(p.id)} /></div>
                    </button>
                  ))}
                  {!items.length && <p className="px-1 py-3 text-center text-[11.5px] text-faint">暂无</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 新建/编辑项目：业态下拉 + 自定义 */}
      <Modal
        open={open}
        onClose={() => { setOpen(false); setEditing(null) }}
        title={editing ? '编辑项目' : '新建项目'}
        footer={
          <>
            <Button variant="outline" onClick={() => { setOpen(false); setEditing(null) }}>取消</Button>
            <Button onClick={submitProject}>{editing ? '保存修改' : '创建项目'}</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="项目名称" required className="col-span-2">
            <Input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如：苏州XX酒店项目" />
          </Field>
          <Field label="项目编号">
            <Input value={form.project_code ?? ''} onChange={(e) => setForm({ ...form, project_code: e.target.value })} placeholder={editing ? '' : '留空自动生成'} />
          </Field>
          <Field label="业态（原类型，可自定义）">
            <Select value={form.project_type ?? ''} onChange={(e) => { const v = e.target.value; if (v === '__format__') { setFormatOpen(true); setForm({ ...form, project_type: formats[0] ?? '' }) } else { setForm({ ...form, project_type: v === '__custom__' ? '' : v }) } }}>
              {formats.map((f) => <option key={f} value={f}>{f}</option>)}
              <option value="__format__">＋ 新增业态（管理）…</option>
            </Select>
          </Field>
          <Field label="业主">
            <Input value={form.client_name ?? ''} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
          </Field>
          <Field label="建筑面积 (㎡)">
            <Input type="number" value={form.building_area ?? ''} onChange={(e) => setForm({ ...form, building_area: Number(e.target.value) || undefined })} />
          </Field>
          <Field label="层数">
            <Input type="number" value={form.floor_count ?? ''} onChange={(e) => setForm({ ...form, floor_count: Number(e.target.value) || undefined })} />
          </Field>
          <Field label="设计阶段">
            <Select value={form.design_stage} onChange={(e) => setForm({ ...form, design_stage: e.target.value })}>
              <option>方案</option><option>初设</option><option>施工图</option>
            </Select>
          </Field>
          <Field label="默认档次">
            <Select value={form.default_grade_code} onChange={(e) => setForm({ ...form, default_grade_code: e.target.value })}>
              <option value="economic">经济型</option>
              <option value="standard">标准型</option>
              <option value="premium">高端型</option>
            </Select>
          </Field>
        </div>
      </Modal>

      {/* 项目模版（按业态配置与套用） */}
      <TemplateModal
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        formats={formats}
        onApplied={(p) => { toast(`已套用模版创建项目「${p.name}」`); navigate(`/projects-v2/${p.id}`) }}
      />

      {/* 业态管理（自定义） */}
      <FormatModal open={formatOpen} onClose={() => setFormatOpen(false)} />

      {/* 导入备份 */}
      <Modal open={backupOpen} onClose={() => setBackupOpen(false)} title="导入项目备份" width={440}>
        <div className="space-y-3">
          <p className="text-[12.5px] text-muted">
            选择由本应用导出的 <span className="font-mono">*.rdw.json</span> 备份文件。导入将按 id 合并项目表数据：已存在的记录被覆盖，新记录被插入。
          </p>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-rule py-8 text-faint transition-colors hover:border-accent/50 hover:text-accent">
            <ArchiveRestore className="size-6" />
            <span className="text-[12.5px]">点击选择备份文件</span>
            <input type="file" accept=".json,.rdw.json" className="hidden" onChange={(e) => { doImportBackup(e.target.files?.[0]); e.target.value = '' }} />
          </label>
        </div>
      </Modal>

      {/* 删除项目确认（弹窗）：级联删除本项目全部关联数据，不可恢复 */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="删除项目"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>取消</Button>
            <Button variant="danger" onClick={confirmDeleteProject}><Trash2 className="size-3.5" />确认删除</Button>
          </>
        }
      >
        <div className="space-y-2">
          <p className="text-[13px] text-ink">
            确定要删除项目 <span className="font-semibold text-danger">「{deleteTarget?.name}」</span> 吗？
          </p>
          <p className="rounded-md bg-danger-soft/50 px-3 py-2 text-[12px] leading-relaxed text-danger">
            该操作将<strong>永久删除</strong>此项目的全部关联数据：子系统、点位、推导结果、设备选型、任务、日程、清单版本、预算、文档与版本快照，<strong>无法恢复</strong>。建议先「导出备份」留存。
          </p>
          {deleteTarget && (
            <p className="text-[11.5px] text-faint">
              项目编号 {deleteTarget.project_code} · 业态 {deleteTarget.project_type ?? '—'} · 已归档 {deleteTarget.archived_at ? '是' : '否'}
            </p>
          )}
        </div>
      </Modal>
    </div>
  )
}
