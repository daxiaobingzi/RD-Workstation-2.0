import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Calendar, CheckCircle2, GripVertical, Pencil, Trash2, Link2 } from 'lucide-react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { queryClient } from '../../../../lib/query-client'
import {
  DndContext, useDroppable, useDraggable, PointerSensor, useSensor, useSensors, closestCorners, type DragEndEvent,
} from '@dnd-kit/core'
import Gantt from 'frappe-gantt'
import '../../../../styles/frappe-gantt.css'
import type { Task } from '../../../../types/domain'
import { TaskService, ProjectService, GoalService } from '../../../../services'
import { Button } from '../../../../components/ui/button'
import { Input } from '../../../../components/ui/field'
import { Segmented } from '../../../../components/ui/segmented'
import { Table, THead, TBody, TR, TH, TD } from '../../../../components/ui/table'
import { StatusBadge } from '../../../../components/ui/badge'
import { toast } from '../../../../components/ui/toast'
import { TaskFormModal } from '../../../tasks/TaskFormModal'
import { cn } from '../../../../lib/utils'

type ViewMode = 'list' | 'board' | 'milestone'
const COLUMNS: { key: Task['status']; label: string; tone: string }[] = [
  { key: 'todo', label: '待办', tone: 'border-rule/60 bg-surface-subtle/40' },
  { key: 'doing', label: '进行中', tone: 'border-accent/30 bg-accent-soft/30' },
  { key: 'done', label: '已完成', tone: 'border-ok/30 bg-ok-soft/30' },
]

const PRIORITY: Record<string, string> = { urgent: 'text-danger', high: 'text-danger', medium: 'text-warn', low: 'text-faint' }

/** 项目任务 tab：列表 / 看板（dnd-kit 拖拽）/ 里程碑（frappe-gantt 时间线）。P1-2：统一任务表单（含目标选择）+ 编辑/删除。 */
export function TasksTab({ projectId }: { projectId: string }) {
  const [view, setView] = useState<ViewMode>('list')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const systems = ProjectService.systems(projectId)

  // 服务端状态：任务列表经 React Query 缓存，仓储变更由 RepoQueryBridge 自动失效刷新
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => TaskService.list({ projectId }),
  })

  // 变更走 mutation：乐观语义由 RepoQueryBridge 的统一失效兜底
  const toggleTask = useMutation({
    mutationFn: async (id: string) => TaskService.toggle(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tasks', projectId] }),
  })
  const setStatusTask = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Task['status'] }) => TaskService.setStatus(id, status),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tasks', projectId] }),
  })
  const deleteTask = useMutation({
    mutationFn: async (id: string) => TaskService.remove(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tasks', projectId] }),
  })

  const openCreate = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (t: Task) => { setEditing(t); setFormOpen(true) }

  const sysName = (id?: string) => systems.find((s) => s.id === id)?.systemName
  const sysColor = (id?: string) => {
    const idx = systems.findIndex((s) => s.id === id)
    return ['#2F5AF7', '#12A5BE', '#7A5AF7', '#E08E0B', '#16A34A', '#8AA1B8'][idx % 6]
  }

  const goalName = (id?: string) => GoalService.list().find((g) => g.id === id)?.name

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Segmented
          options={[
            { value: 'list', label: '列表' },
            { value: 'board', label: '看板' },
            { value: 'milestone', label: '里程碑' },
          ]}
          value={view}
          onChange={(v) => setView(v as ViewMode)}
        />
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-faint">{tasks.length} 任务</span>
          <Button size="sm" onClick={openCreate}><Plus className="size-3.5" />新建任务</Button>
        </div>
      </div>

      {view === 'list' && <TaskList projectId={projectId} tasks={tasks} sysName={sysName} goalName={goalName} onToggle={(id) => toggleTask.mutate(id)} onEdit={openEdit} onDelete={(id) => { if (confirm('确定删除该任务？')) { deleteTask.mutate(id); toast('任务已删除', 'info') } }} />}
      {view === 'board' && <TaskBoard projectId={projectId} tasks={tasks} sysName={sysName} sysColor={sysColor} onSetStatus={(id, status) => setStatusTask.mutate({ id, status })} onEdit={openEdit} onDelete={(id) => { if (confirm('确定删除该任务？')) { deleteTask.mutate(id); toast('任务已删除', 'info') } }} />}
      {view === 'milestone' && <TaskMilestone tasks={tasks} sysName={sysName} sysColor={sysColor} />}

      <TaskFormModal
        key={editing?.id ?? 'new'}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        initial={editing}
        projectId={projectId}
        onSubmit={() => queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })}
      />
    </div>
  )
}

/* ---------- 列表视图 ---------- */
function TaskList({ projectId: _projectId, tasks, sysName, goalName, onToggle, onEdit, onDelete }: {
  projectId: string; tasks: Task[]; sysName: (id?: string) => string | undefined
  goalName: (id?: string) => string | undefined
  onToggle: (id: string) => void; onEdit: (t: Task) => void; onDelete: (id: string) => void
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-rule bg-surface">
        <Table>
          <THead><TR><TH className="w-8"></TH><TH>任务</TH><TH>优先级</TH><TH>系统</TH><TH>目标</TH><TH>截止</TH><TH>状态</TH><TH className="w-24"></TH></TR></THead>
          <TBody>
            {tasks.map((t) => (
              <TR key={t.id} className="hover:bg-hover">
                <TD className="w-8 pr-0">
                  <button type="button" aria-label={t.title} onClick={() => onToggle(t.id)} className="flex size-4 items-center justify-center rounded-[4px] border border-rule bg-surface">
                    {t.status === 'done' && <CheckCircle2 className="size-4 text-ok" />}
                  </button>
                </TD>
                <TD className={cn('font-medium', t.status === 'done' && 'text-faint line-through')}>{t.title}</TD>
                <TD><span className={cn('text-[12px] font-medium', PRIORITY[t.priority])}>{t.priority === 'urgent' ? '紧急' : t.priority === 'high' ? '高' : t.priority === 'medium' ? '中' : '低'}</span></TD>
                <TD className="text-muted">{sysName(t.project_system_id) ?? '—'}</TD>
                <TD className="max-w-44 truncate text-accent" title={goalName(t.goal_id)}>
                  {t.goal_id ? <span className="flex items-center gap-1"><Link2 className="size-3" />{goalName(t.goal_id) ?? '目标'}</span> : <span className="text-faint">—</span>}
                </TD>
                <TD className="font-mono text-[12px] text-muted">{t.due_at?.slice(0, 10) ?? '—'}</TD>
                <TD><StatusBadge status={t.status === 'done' ? 'done' : t.status === 'doing' ? 'designing' : 'todo'} /></TD>
                <TD>
                  <div className="flex justify-end gap-0.5">
                    <button type="button" className="rounded p-1 text-faint hover:bg-hover hover:text-accent" title="编辑" onClick={() => onEdit(t)}><Pencil className="size-3.5" /></button>
                    <button type="button" className="rounded p-1 text-faint hover:bg-danger-soft hover:text-danger" title="删除" onClick={() => onDelete(t.id)}><Trash2 className="size-3.5" /></button>
                  </div>
                </TD>
              </TR>
            ))}
            {!tasks.length && <TR><TD colSpan={8} className="py-6 text-center text-faint">项目还没有任务</TD></TR>}
          </TBody>
        </Table>
      </div>
    </div>
  )
}

/* ---------- 看板视图（dnd-kit 拖拽换列） ---------- */
function TaskBoard({ projectId, tasks, sysName, sysColor, onSetStatus, onEdit, onDelete }: {
  projectId: string; tasks: Task[]; sysName: (id?: string) => string | undefined; sysColor: (id?: string) => string
  onSetStatus: (id: string, status: Task['status']) => void
  onEdit: (t: Task) => void; onDelete: (id: string) => void
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [title, setTitle] = useState('')

  const dragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const target = String(over.id)
    const task = tasks.find((t) => t.id === active.id)
    if (!task) return
    // over 是列 id（todo/doing/done）→ 直接移动；over 是任务卡片 → 取其状态列
    const col = COLUMNS.some((c) => c.key === target) ? target : tasks.find((t) => t.id === target)?.status ?? 'todo'
    if (col !== task.status) {
      onSetStatus(task.id, col as Task['status'])
      toast(`已移动到「${COLUMNS.find((c) => c.key === col)?.label}」`, 'info')
    }
  }

  const addToCol = (status: Task['status']) => {
    if (!title.trim()) { toast('请输入任务标题', 'warn'); return }
    TaskService.add({ title: title.trim(), status, project_id: projectId, source_type: 'manual' })
    setTitle('')
    toast('任务已添加')
    const sysCount = ProjectService.systems(projectId).length
    void sysCount
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={dragEnd}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {COLUMNS.map((col) => (
          <BoardColumn key={col.key} col={col} tasks={tasks.filter((t) => t.status === col.key)} sysName={sysName} sysColor={sysColor} onAdd={addToCol} title={title} setTitle={setTitle} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </div>
    </DndContext>
  )
}

function BoardColumn({ col, tasks, sysName, sysColor, onAdd, title, setTitle, onEdit, onDelete }: {
  col: { key: Task['status']; label: string; tone: string }
  tasks: Task[]
  sysName: (id?: string) => string | undefined
  sysColor: (id?: string) => string
  onAdd: (s: Task['status']) => void
  title: string
  setTitle: (v: string) => void
  onEdit: (t: Task) => void; onDelete: (id: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key })
  return (
    <div
      ref={setNodeRef}
      className={cn('flex min-h-56 flex-col rounded-lg border p-2 transition-colors', col.tone, isOver && 'ring-2 ring-accent/40')}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-[12.5px] font-semibold text-ink">{col.label}</p>
        <span className="rounded-full bg-surface-subtle px-1.5 font-mono text-[10.5px] text-muted">{tasks.length}</span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} sysName={sysName} sysColor={sysColor} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </div>
      <div className="mt-2 flex gap-1.5">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="新任务…" className="h-7 text-[12px]" onKeyDown={(e) => e.key === 'Enter' && onAdd(col.key)} />
        <Button size="xs" onClick={() => onAdd(col.key)}><Plus className="size-3" /></Button>
      </div>
    </div>
  )
}

function TaskCard({ task, sysName, sysColor, onEdit, onDelete }: { task: Task; sysName: (id?: string) => string | undefined; sysColor: (id?: string) => string; onEdit: (t: Task) => void; onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id })
  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={cn('group cursor-grab rounded-md border border-rule bg-surface p-2 shadow-sm transition-shadow hover:shadow', isDragging && 'z-10 opacity-80 shadow-lg')}
      {...listeners}
      {...attributes}
    >
      <div className="flex items-start gap-1.5">
        <GripVertical className="mt-0.5 size-3 shrink-0 text-faint" />
        <div className="min-w-0 flex-1">
          <p className={cn('text-[12.5px] font-medium', task.status === 'done' && 'text-faint line-through')}>{task.title}</p>
          <div className="mt-1 flex items-center gap-2">
            {task.project_system_id && <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: sysColor(task.project_system_id) }} />}
            <span className="truncate text-[11px] text-muted">{sysName(task.project_system_id) ?? '通用'}</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted">
            <span className={PRIORITY[task.priority]}>{task.priority === 'urgent' ? '紧急' : task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低'}</span>
            {task.due_at && <span className="flex items-center gap-0.5"><Calendar className="size-3" />{task.due_at.slice(0, 10)}</span>}
            {task.goal_id && <span className="flex items-center gap-0.5 text-accent"><Link2 className="size-3" />目标</span>}
          </div>
        </div>
        <div className="-mr-0.5 flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            className="rounded p-1 text-faint hover:bg-hover hover:text-accent"
            title="编辑"
            onClick={(e) => { e.stopPropagation(); onEdit(task) }}
          >
            <Pencil className="size-3" />
          </button>
          <button
            type="button"
            className="rounded p-1 text-faint hover:bg-danger-soft hover:text-danger"
            title="删除"
            onClick={(e) => { e.stopPropagation(); onDelete(task.id) }}
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---------- 里程碑视图（frappe-gantt 时间线） ---------- */
function TaskMilestone({ tasks, sysName, sysColor }: {
  tasks: Task[]; sysName: (id?: string) => string | undefined; sysColor: (id?: string) => string
}) {
  const ref = useRef<HTMLDivElement>(null)

  const ganttTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.due_at)
        .map((t) => {
          const start = (t.created_at ?? t.due_at!).slice(0, 10)
          const end = t.due_at!.slice(0, 10)
          const due = new Date(end).getTime()
          const created = new Date(start).getTime()
          // end 必须不早于 start
          const safeEnd = due >= created ? end : start
          return {
            id: t.id,
            name: t.title,
            start,
            end: safeEnd,
            progress: t.status === 'done' ? 100 : 0,
            custom_class: `gantt-sys-${t.project_system_id ?? 'none'}`,
          }
        }),
    [tasks],
  )

  useEffect(() => {
    if (!ref.current || !ganttTasks.length) return
    const el = ref.current
    // 每次渲染重建（HMR/数据变化）；先清空容器避免重复实例
    el.innerHTML = ''
    new Gantt(el, ganttTasks, { view_mode: 'Month', bar_height: 30, padding: 14, language: 'zh' })
    // 按系统着色（frappe-gantt 无逐任务颜色 API；SVG 用 fill）
    el.querySelectorAll<HTMLElement>('[class*="gantt-sys-"]').forEach((node) => {
      const cls = [...node.classList].find((c) => c.startsWith('gantt-sys-'))
      const sysId = cls?.replace('gantt-sys-', '') ?? ''
      if (!sysId || sysId === 'none') return
      const color = sysColor(sysId)
      ;(node.querySelector('.bar') as HTMLElement | null)?.style.setProperty('fill', color)
      ;(node.querySelector('.bar-progress') as HTMLElement | null)?.style.setProperty('fill', color)
    })
    return () => { el.innerHTML = '' }
  }, [ganttTasks, sysColor])

  if (!ganttTasks.length) {
    return <div className="rounded-lg border border-rule bg-surface py-10 text-center text-[12.5px] text-faint">暂无带截止时间的任务可作为里程碑</div>
  }

  return (
    <div className="rounded-lg border border-rule bg-surface p-3 shadow-sm">
      <p className="mb-2 text-[12px] text-muted">任务时间线（按创建 → 截止，系统不同颜色）。给任务设置"截止"即可出现在此视图。</p>
      <div ref={ref} className="overflow-x-auto" />
      <div className="mt-2 flex flex-wrap gap-3">
        {[...new Set(tasks.map((t) => t.project_system_id).filter(Boolean))].map((id) => (
          <span key={id} className="flex items-center gap-1.5 text-[11.5px] text-muted">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: sysColor(id) }} />{sysName(id)}
          </span>
        ))}
      </div>
    </div>
  )
}