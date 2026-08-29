import { useMemo, useState } from 'react'
import { CheckCircle2, Plus, Unlink, Link2, NotebookPen } from 'lucide-react'
import { useDB } from '../../../db/memory-db'
import type { Task } from '../../../types/domain'
import { TaskService, GoalService, ProjectService } from '../../../services'
import { Button } from '../../../components/ui/button'
import { Modal } from '../../../components/ui/dialog'
import { Input } from '../../../components/ui/field'
import { toast } from '../../../components/ui/toast'
import { cn } from '../../../lib/utils'

const STATUS_LABEL: Record<string, string> = {
  todo: '待处理', doing: '进行中', done: '已完成', blocked: '阻塞',
}

export function GoalTasksPanel({ goalId }: { goalId: string }) {
  const db = useDB((s) => s.db)
  const [addTitle, setAddTitle] = useState('')
  const [pickOpen, setPickOpen] = useState(false)
  const [checkin, setCheckin] = useState('')
  const [checkinValue, setCheckinValue] = useState('')

  // P1-1 修复：db 经由 useDB 订阅，操作（挂接/勾选/撤销）后 db 引用变化、
  // 组件重渲染后直接重算，不再依赖 useMemo 缓存导致"必须刷新浏览器"。
  const tasks = useMemo(() => TaskService.list().filter((t) => t.goal_id === goalId), [goalId, db])
  const logs = useMemo(() => GoalService.progressLogs(goalId), [goalId, db])
  // 任务行的项目归属标识（同 tasks 表；无归属显示"未关联项目"）
  const projName = useMemo(() => new Map(ProjectService.list().map((p) => [p.id, p.name])), [db])

  const addTask = () => {
    if (!addTitle.trim()) return
    TaskService.add({ title: addTitle.trim(), goal_id: goalId })
    setAddTitle('')
    toast('任务已创建并挂接目标')
  }

  const detach = (taskId: string) => {
    TaskService.update(taskId, { goal_id: undefined })
    toast('已解除任务关联')
  }

  const submitCheckin = () => {
    if (!checkin.trim()) return
    GoalService.logProgress(goalId, checkin.trim(), checkinValue ? Number(checkinValue) : undefined)
    setCheckin('')
    setCheckinValue('')
    toast('进展已记录')
  }

  return (
    <div className="ml-12 mt-1 space-y-3 rounded-lg border border-rule/60 bg-surface-subtle/50 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Input
          value={addTitle}
          onChange={(e) => setAddTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTask()}
          placeholder="输入任务名称，回车挂接到此目标…"
          className="h-7 text-[12.5px]"
        />
        <Button size="xs" variant="secondary" onClick={addTask} title="新建并挂接">
          <Plus className="size-3.5" />
        </Button>
        <Button size="xs" variant="outline" onClick={() => setPickOpen(true)} title="从已有任务中挂接">
          <Link2 className="size-3.5" /> 挂接
        </Button>
      </div>

      {tasks.length === 0 ? (
        <p className="px-1 py-1 text-[12px] text-faint">尚未关联任务，任务完成后将自动推进此目标。</p>
      ) : (
        <ul className="space-y-1">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-hover">
              <button
                type="button"
                aria-label={t.title}
                onClick={() => TaskService.toggle(t.id)}
                className="flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-rule bg-surface hover:border-accent"
              >
                {t.status === 'done' && <CheckCircle2 className="size-4 text-ok" />}
              </button>
              <span className={cn('flex-1 truncate text-[12.5px]', t.status === 'done' ? 'text-faint line-through' : 'text-ink')}>
                {t.title}
              </span>
              <span className="text-[10.5px] text-faint">{STATUS_LABEL[t.status]}</span>
              {t.due_at && <span className="font-mono text-[10.5px] text-faint">{t.due_at.slice(5, 10)}</span>}
              <span
                title={t.project_id ? '所属项目' : '未关联任何项目'}
                className={cn('shrink-0 text-[10px]', t.project_id ? 'text-faint' : 'text-faint/70')}
              >
                {t.project_id ? projName.get(t.project_id) : '未关联项目'}
              </span>
              <button
                type="button"
                onClick={() => detach(t.id)}
                className="rounded p-1 text-faint hover:bg-hover hover:text-danger"
                title="解除关联"
              >
                <Unlink className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* 进展记录（check-in 轻量版，U3） */}
      <div className="border-t border-rule/60 pt-2">
        <p className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-muted">
          <NotebookPen className="size-3" /> 记一笔进展
        </p>
        <div className="flex items-center gap-2">
          <Input value={checkin} onChange={(e) => setCheckin(e.target.value)} placeholder="完成情况 / 卡点…" className="h-7 flex-1 text-[12.5px]" />
          <Input type="number" value={checkinValue} onChange={(e) => setCheckinValue(e.target.value)} placeholder="数值(可空)" className="h-7 w-20 text-[12.5px]" />
          <Button size="xs" onClick={submitCheckin} disabled={!checkin.trim()}>记录</Button>
        </div>
        {logs.length > 0 && (
          <ul className="mt-2 space-y-1">
            {logs.slice(0, 3).map((l) => (
              <li key={l.id} className="flex items-baseline gap-2 text-[11.5px] text-muted">
                <span className="shrink-0 font-mono text-[10px] text-faint">{l.created_at?.slice(5, 16).replace('T', ' ')}</span>
                <span className="min-w-0 flex-1 truncate">{l.note}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <TaskPickModal open={pickOpen} onClose={() => setPickOpen(false)} goalId={goalId} excludeIds={new Set(tasks.map((t) => t.id))} />
    </div>
  )
}

/** 从全量未挂接任务中勾选挂接 */
function TaskPickModal({ open, onClose, goalId, excludeIds }: { open: boolean; onClose: () => void; goalId: string; excludeIds: Set<string> }) {
  const available = useMemo(() => TaskService.list().filter((t) => !t.goal_id && !excludeIds.has(t.id)), [excludeIds])
  const [picked, setPicked] = useState<Set<string>>(new Set())

  const togglePick = (id: string) => {
    const next = new Set(picked)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setPicked(next)
  }

  const save = () => {
    picked.forEach((id) => TaskService.update(id, { goal_id: goalId }))
    if (picked.size) toast(`已挂接 ${picked.size} 条任务`)
    setPicked(new Set())
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="挂接已有任务"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button onClick={save} disabled={picked.size === 0}>挂接（{picked.size}）</Button>
        </>
      }
    >
      {available.length === 0 ? (
        <p className="py-4 text-center text-[12.5px] text-faint">暂无未挂接的任务</p>
      ) : (
        <ul className="max-h-64 space-y-1 overflow-auto">
          {available.map((t: Task) => (
            <li key={t.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-hover">
                <input
                  type="checkbox"
                  className="accent-accent"
                  checked={picked.has(t.id)}
                  onChange={() => togglePick(t.id)}
                />
                <span className="flex-1 truncate text-[13px] text-ink">{t.title}</span>
                {t.status !== 'todo' && (
                  <span className={cn('text-[10.5px]', t.status === 'done' ? 'text-ok' : 'text-faint')}>
                    {STATUS_LABEL[t.status]}
                  </span>
                )}
              </label>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}