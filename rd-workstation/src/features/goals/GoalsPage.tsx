import { useMemo, useState } from 'react'
import { Target, ChevronDown, ChevronRight, Plus, Pencil, Trash2, ListTodo } from 'lucide-react'
import { useDB } from '../../db/memory-db'
import { type Goal } from '../../types/domain'
import { GoalService, type GoalNode } from '../../services/goal.service'
import { GoalTasksPanel } from './components/GoalTasksPanel'
import { PageHeader } from '../../components/ui/page-header'
import { Badge, StatusBadge } from '../../components/ui/badge'
import { Progress } from '../../components/ui/progress'
import { Segmented } from '../../components/ui/segmented'
import { Button } from '../../components/ui/button'
import { Modal } from '../../components/ui/dialog'
import { Field, Input, Textarea, Select } from '../../components/ui/field'
import { EmptyState } from '../../components/ui/empty'
import { toast } from '../../components/ui/toast'
import { cn } from '../../lib/utils'

const PERIOD_LABEL: Record<string, string> = {
  year: '年度', quarter: '季度', month: '月度', week: '周',
}

const METRIC_SOURCES = [
  { value: 'project_completed_by_period', label: '周期内完成项目数', group: 'project' },
  { value: 'task_done_by_period', label: '周期内完成任务数', group: 'task' },
  { value: 'knowledge_added_by_period', label: '周期内新增知识', group: 'knowledge' },
  { value: 'habit_completed_by_period', label: '周期内习惯打卡次数', group: 'habit' },
  { value: 'completed_projects', label: '累计完成项目数（不限周期）', group: 'project' },
  { value: 'habit_completion', label: '习惯完成率 %（不限周期）', group: 'habit' },
]

/** 今天（YYYY-MM-DD） */
function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function GoalsPage() {
  useDB((s) => s.db)
  const [periodFilter, setPeriodFilter] = useState<Goal['period_type'] | 'all'>('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Goal | null>(null)
  const [tasksOpen, setTasksOpen] = useState<Set<string>>(new Set())

  // 目标量小（个人工具），db 订阅触发重渲染后直接重算，无需 useMemo
  const tree = GoalService.tree()
  const filtered = periodFilter === 'all'
    ? tree
    : tree.filter((n) => n.period_type === periodFilter || n.children.some((c) => c.period_type === periodFilter))

  const toggleExpand = (id: string) => {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpanded(next)
  }

  const toggleTasks = (id: string) => {
    const next = new Set(tasksOpen)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setTasksOpen(next)
  }

  const handleDelete = (goal: Goal) => {
    const res = GoalService.remove(goal.id)
    if (!res.ok) {
      toast(res.reason, 'error')
      return
    }
    toast('目标已删除')
  }

  return (
    <div className="mx-auto max-w-[1080px] space-y-4 p-5">
      <PageHeader
        title="目标"
        subtitle="年 / 季 / 月 / 周 — 目标到任务的拆解与追踪"
        actions={
          <Button onClick={() => { setEditing(null); setModalOpen(true) }}>
            <Plus className="size-4" /> 新建目标
          </Button>
        }
      />

      <div className="flex items-center gap-3">
        <Segmented
          options={[
            { value: 'all', label: '全部' },
            { value: 'year', label: '年度' },
            { value: 'quarter', label: '季度' },
            { value: 'month', label: '月度' },
            { value: 'week', label: '周' },
          ]}
          value={periodFilter}
          onChange={(v) => setPeriodFilter(v as Goal['period_type'] | 'all')}
        />
      </div>

      <div className="space-y-1">
        {filtered.length === 0 && (
          <EmptyState
            icon={<Target className="size-8 text-faint" />}
            title="暂无目标"
            description="点击右上角新建目标，开启年度规划"
          />
        )}
        {filtered.map((node) => (
          <GoalRow
            key={node.id}
            node={node}
            depth={0}
            expanded={expanded}
            tasksOpen={tasksOpen}
            onToggle={toggleExpand}
            onToggleTasks={toggleTasks}
            onEdit={(g) => { setEditing(g); setModalOpen(true) }}
            onDelete={handleDelete}
          />
        ))}
      </div>

      <GoalFormModal
        key={editing?.id ?? 'new'}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
      />
    </div>
  )
}

/* ---------- 目标树行（递归） ---------- */
function GoalRow({
  node,
  depth,
  expanded,
  tasksOpen,
  onToggle,
  onToggleTasks,
  onEdit,
  onDelete,
}: {
  node: GoalNode
  depth: number
  expanded: Set<string>
  tasksOpen: Set<string>
  onToggle: (id: string) => void
  onToggleTasks: (id: string) => void
  onEdit: (g: Goal) => void
  onDelete: (g: Goal) => void
}) {
  const isExpanded = expanded.has(node.id)
  const showTasks = tasksOpen.has(node.id)
  const manual = GoalService.progress(node.id)
  const auto = GoalService.metricCurrent(node.id) // metric 型目标实时值（U3）
  const prog = auto ? { value: auto.value, target: node.target_value ?? 0, pct: auto.value > 0 && (node.target_value ?? 0) > 0 ? Math.round((auto.value / (node.target_value ?? 1)) * 100) : 0 } : manual
  const hasChildren = node.children.length > 0
  const late = node.status !== 'archived' && node.end_date && node.end_date < today() && prog.pct < 100

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-3 rounded-lg border border-rule bg-surface px-3 py-2.5 transition-colors hover:border-accent/30',
          showTasks && 'border-accent/40',
          depth > 0 && 'ml-4',
        )}
      >
        <button
          type="button"
          onClick={() => hasChildren && onToggle(node.id)}
          className={cn('flex size-5 shrink-0 items-center justify-center rounded text-faint', !hasChildren && 'invisible')}
        >
          {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] font-medium text-ink">{node.name}</span>
            <Badge variant="outline">{PERIOD_LABEL[node.period_type]}</Badge>
            {auto && <Badge variant="accent2">自动</Badge>}
            {late && <Badge variant="warn">落后</Badge>}
            {node.status === 'archived' && <StatusBadge status="archived" className="text-[10.5px]" />}
          </div>
          <div className="mt-1.5">
            <Progress value={prog.pct} showLabel tone="accent" />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onToggleTasks(node.id)}
            className={cn('rounded-md p-1.5 hover:bg-hover', showTasks ? 'text-accent' : 'text-muted hover:text-ink')}
            title="关联任务"
          >
            <ListTodo className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onEdit(node)}
            className="rounded-md p-1.5 text-muted hover:bg-hover hover:text-ink"
            title="编辑"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(node)}
            className="rounded-md p-1.5 text-muted hover:bg-hover hover:text-danger"
            title="删除"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {showTasks && (hasChildren ? (
        <p className="ml-12 mt-1 rounded-lg border border-rule/60 bg-surface-subtle/50 px-3 py-2 text-[12px] text-faint">
          父目标为子目标汇总，请将任务挂接到具体子目标。
        </p>
      ) : (
        <GoalTasksPanel goalId={node.id} />
      ))}

      {isExpanded && node.children.map((child) => (
        <GoalRow
          key={child.id}
          node={child}
          depth={depth + 1}
          expanded={expanded}
          tasksOpen={tasksOpen}
          onToggle={onToggle}
          onToggleTasks={onToggleTasks}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

/* ---------- CRUD 弹窗（key 重置：每次编辑/新建重挂载实例） ---------- */
function GoalFormModal({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: Goal | null }) {
  const [name, setName] = useState(editing?.name ?? '')
  const [desc, setDesc] = useState(editing?.description ?? '')
  const [period, setPeriod] = useState<Goal['period_type']>(editing?.period_type ?? 'year')
  const [parentId, setParentId] = useState(editing?.parent_goal_id ?? '')
  const [target, setTarget] = useState(editing?.target_value != null ? String(editing.target_value) : '')
  const [current, setCurrent] = useState(editing?.current_value != null ? String(editing.current_value) : '')
  const [goalType, setGoalType] = useState<'objective' | 'metric'>(editing?.goal_type === 'metric' ? 'metric' : 'objective')
  const [metricSource, setMetricSource] = useState('')
  const metricRef = GoalService.metric(editing?.id ?? '')
  const effectiveSource = metricSource || metricRef?.source_query || ''

  const parents = useMemo(() => GoalService.list().filter((g) => g.id !== editing?.id), [editing])

  const submit = () => {
    const payload: Partial<Goal> = {
      name,
      description: desc,
      period_type: period,
      parent_goal_id: parentId || undefined,
      target_value: target ? Number(target) : undefined,
      current_value: goalType === 'metric' ? undefined : current ? Number(current) : undefined,
      goal_type: goalType,
    }
    const saved = editing ? GoalService.update(editing.id, payload) : GoalService.add(payload)
    if (saved && goalType === 'metric' && effectiveSource) {
      GoalService.saveMetric(saved.id, { source_type: 'count', source_query: effectiveSource, target_value: target ? Number(target) : undefined })
    }
    if (editing) toast('目标已更新')
    else toast('目标已创建')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? '编辑目标' : '新建目标'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button onClick={submit}>保存</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="目标名称" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：2026 年完成 20 个项目" />
        </Field>
        <Field label="描述">
          <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} placeholder="补充说明…" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="周期类型" required>
            <Select value={period} onChange={(e) => setPeriod(e.target.value as Goal['period_type'])}>
              <option value="year">年度</option>
              <option value="quarter">季度</option>
              <option value="month">月度</option>
              <option value="week">周</option>
            </Select>
          </Field>
          <Field label="目标类型">
            <Select value={goalType} onChange={(e) => setGoalType(e.target.value as 'objective' | 'metric')}>
              <option value="objective">常规目标（手动/任务推进）</option>
              <option value="metric">自动统计（绑定数据源）</option>
            </Select>
          </Field>
        </div>
        {goalType === 'metric' && (
          <Field label="统计来源（U3 引擎按周期实时计算）">
            <Select value={effectiveSource} onChange={(e) => setMetricSource(e.target.value)}>
              <option value="">请选择统计来源</option>
              {METRIC_SOURCES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </Select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="父目标（可选）">
            <Select value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">无</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </Field>
          <Field label={goalType === 'metric' ? '目标值' : '目标值（可选）'}>
            <Input type="number" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="如 20" />
          </Field>
        </div>
        {goalType !== 'metric' && (
          <Field label="当前值">
            <Input type="number" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="0" />
          </Field>
        )}
      </div>
    </Modal>
  )
}