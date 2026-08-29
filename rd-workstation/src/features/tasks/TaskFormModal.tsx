import { useState } from 'react'
import { Target, FolderKanban } from 'lucide-react'
import { useDB } from '../../db/memory-db'
import { type Task } from '../../types/domain'
import { TaskService, GoalService, ProjectService } from '../../services'
import { Modal } from '../../components/ui/dialog'
import { Button } from '../../components/ui/button'
import { Field, Input, Select, Textarea } from '../../components/ui/field'
import { toast } from '../../components/ui/toast'

export interface TaskFormValue {
  title: string
  description?: string
  priority: Task['priority']
  due_at?: string
  project_system_id?: string
  goal_id?: string
}

/**
 * 统一任务表单（P1-2）：新建 / 编辑任务共用。
 * 目标下拉取 GoalService（未归档目标），供项目任务、今日页、目标页三处联动。
 * 说明：goals 监听由 useDB 保证 —— 目标增删后组件随 db 订阅重渲染。
 */
export function TaskFormModal({
  open,
  onClose,
  initial,
  projectId,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  initial?: Task | null
  projectId?: string
  onSubmit?: (task: Task) => void
}) {
  useDB((s) => s.db)
  const editing = !!initial
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [priority, setPriority] = useState<Task['priority']>(initial?.priority ?? 'medium')
  const [due, setDue] = useState(initial?.due_at?.slice(0, 10) ?? '')
  const [sysId, setSysId] = useState(initial?.project_system_id ?? '')
  const [goalId, setGoalId] = useState(initial?.goal_id ?? '')
  const [projId, setProjId] = useState(initial?.project_id ?? projectId ?? '')

  const goals = GoalService.list().filter((g) => g.status !== 'archived')
  const systems = projectId ? ProjectService.systems(projectId) : []
  const projects = !projectId ? ProjectService.list() : []

  const submit = () => {
    if (!title.trim()) { toast('请输入任务标题', 'warn'); return }
    const payload: Partial<Task> = {
      title: title.trim(),
      description: description || undefined,
      priority,
      due_at: due ? new Date(`${due}T18:00:00`).toISOString() : undefined,
      project_system_id: sysId || undefined,
      goal_id: goalId || undefined,
      project_id: projId || undefined,
    }
    let saved: Task | undefined
    if (initial) {
      saved = TaskService.update(initial.id, payload)
      if (saved) toast('任务已更新')
    } else {
      saved = TaskService.add(payload)
      toast('任务已添加')
    }
    if (saved) onSubmit?.(saved)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? '编辑任务' : '新建任务'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button onClick={submit}>{editing ? '保存' : '创建'}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="任务标题" required>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="要做的事…" autoFocus />
        </Field>
        <Field label="描述">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="补充说明（可选）" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="优先级">
            <Select value={priority} onChange={(e) => setPriority(e.target.value as Task['priority'])}>
              <option value="urgent">紧急</option>
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </Select>
          </Field>
          <Field label="截止日期">
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
        </div>
        {!projectId && (
          <Field label="所属项目（可选）">
            <div className="relative">
              <FolderKanban className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
              <Select value={projId} onChange={(e) => setProjId(e.target.value)} className="pl-8">
                <option value="">不关联项目（仅今日页 / 目标可见）</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </div>
          </Field>
        )}
        <Field label="关联目标（可选）">
          <div className="relative">
            <Target className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
            <Select value={goalId} onChange={(e) => setGoalId(e.target.value)} className="pl-8">
              <option value="">不关联目标</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </Select>
          </div>
          {!goals.length && <p className="mt-1 text-[11.5px] text-faint">暂无进行中的目标，可在「目标」页创建后回来关联。</p>}
        </Field>
        {projectId && (
          <Field label="关联系统（可选）">
            <Select value={sysId} onChange={(e) => setSysId(e.target.value)}>
              <option value="">不关联系统</option>
              {systems.map((s) => (
                <option key={s.id} value={s.id}>{s.systemCode} · {s.systemName}</option>
              ))}
            </Select>
          </Field>
        )}
      </div>
    </Modal>
  )
}