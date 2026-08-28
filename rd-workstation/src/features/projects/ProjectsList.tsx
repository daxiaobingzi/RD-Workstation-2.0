import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, FolderKanban, LayoutList } from 'lucide-react'
import { useDB } from '../../db/memory-db'
import { ProjectService } from '../../services'
import type { Project } from '../../types/domain'
import { StatusBadge } from '../../components/ui/badge'
import { Progress } from '../../components/ui/progress'
import { Segmented } from '../../components/ui/segmented'
import { EmptyState } from '../../components/ui/empty'
import { Modal } from '../../components/ui/dialog'
import { Button } from '../../components/ui/button'
import { Field, Input, Select } from '../../components/ui/field'
import { Table, THead, TBody, TR, TH, TD, NumCell } from '../../components/ui/table'
import { PageHeader } from '../../components/ui/page-header'
import { toast } from '../../components/ui/toast'
import { fmtNum } from '../../lib/utils'

const STATUS_COLUMNS = [
  { key: 'draft', label: '草稿' },
  { key: 'designing', label: '设计中' },
  { key: 'reviewing', label: '评审中' },
  { key: 'completed', label: '已完成' },
]

export function ProjectsPage() {
  useDB((s) => s.db)
  const navigate = useNavigate()
  const [view, setView] = useState<'list' | 'board'>('list')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Partial<Project>>({ project_type: '办公 · 智能楼宇', default_grade_code: 'standard' })

  const projects = useMemo(() => {
    const all = ProjectService.list()
    if (!q.trim()) return all
    const kw = q.trim().toLowerCase()
    return all.filter((p) => [p.name, p.project_code, p.client_name, p.project_type].some((v) => v?.toLowerCase().includes(kw)))
  }, [q, useDB.getState().db])

  const progressOf = (id: string) => {
    const pss = ProjectService.systems(id)
    return pss.length ? Math.round(pss.reduce((s, x) => s + x.progress, 0) / pss.length) : 0
  }

  const createProject = () => {
    if (!form.name) {
      toast('请填写项目名称', 'warn')
      return
    }
    const p = ProjectService.create(form)
    toast(`项目「${p.name}」已创建`)
    setOpen(false)
    setForm({})
  }

  return (
    <div className="mx-auto max-w-[1080px] space-y-4 p-5">
      <PageHeader
        title="项目中心"
        subtitle="管理你的弱电 / 智能建筑项目"
        actions={
          <>
            <div className="relative">
              <Search className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-faint" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索项目…" className="w-52 pl-7" />
            </div>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: 'list', label: <span className="flex items-center gap-1"><LayoutList className="size-3.5" />列表</span> },
                { value: 'board', label: <span className="flex items-center gap-1"><FolderKanban className="size-3.5" />看板</span> },
              ]}
            />
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" /> 新建项目
            </Button>
          </>
        }
      />

      {projects.length === 0 && !q ? (
        <div className="rounded-lg border border-rule bg-surface">
          <EmptyState
            icon={<FolderKanban />}
            title="还没有项目"
            description="创建一个项目，开始你的弱电设计工作"
            action={<Button onClick={() => setOpen(true)}><Plus className="size-4" />新建第一个项目</Button>}
          />
        </div>
      ) : view === 'list' ? (
        <div className="rounded-lg border border-rule bg-surface">
          <Table>
            <THead>
              <TR>
                <TH>项目编号</TH><TH>名称</TH><TH>类型</TH><TH>业主</TH><TH>进度</TH><TH>状态</TH><TH>更新时间</TH>
              </TR>
            </THead>
            <TBody>
              {projects.map((p) => (
                <TR key={p.id} className="cursor-pointer hover:bg-hover" onClick={() => navigate(`/projects/${p.id}`)}>
                  <TD><NumCell>{p.project_code}</NumCell></TD>
                  <TD className="font-medium">{p.name}</TD>
                  <TD className="text-muted">{p.project_type}</TD>
                  <TD className="text-muted">{p.client_name}</TD>
                  <TD><div className="w-36"><Progress value={progressOf(p.id)} showLabel /></div></TD>
                  <TD><StatusBadge status={p.status} /></TD>
                  <TD className="font-mono text-[12px] text-faint">{p.updated_at.slice(5, 10)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
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
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => navigate(`/projects/${p.id}`)}
                      className="w-full rounded-md border border-rule bg-surface p-2.5 text-left shadow-sm transition-colors hover:border-accent/40"
                    >
                      <p className="truncate text-[12.5px] font-medium">{p.name}</p>
                      <p className="mt-0.5 font-mono text-[10.5px] text-faint">{p.project_code}</p>
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

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="新建项目"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={createProject}>创建项目</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="项目名称" required className="col-span-2">
            <Input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如：苏州XX公安项目" />
          </Field>
          <Field label="项目类型">
            <Select value={form.project_type} onChange={(e) => setForm({ ...form, project_type: e.target.value })}>
              <option>政府 · 公共安全</option>
              <option>办公 · 智能楼宇</option>
              <option>医疗</option>
              <option>教育</option>
              <option>酒店</option>
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
        {projects.length > 0 && (
          <p className="mt-3 text-[11.5px] text-faint">
            当前共 {fmtNum(projects.length)} 个项目
          </p>
        )}
      </Modal>
    </div>
  )
}
