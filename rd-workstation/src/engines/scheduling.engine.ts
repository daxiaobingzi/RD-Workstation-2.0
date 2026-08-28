import type { Task } from '../types/domain'

/* ================= SchedulingEngine：排程建议 ================= */
export const SchedulingEngine = {
  assess(tasks: Task[], now = Date.now()): { overdue: Task[]; today: Task[]; risk: Task[] } {
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(dayStart.getTime() + 86400000)
    const overdue: Task[] = []
    const today: Task[] = []
    const risk: Task[] = []
    for (const t of tasks) {
      if (t.status === 'done' || t.status === 'blocked') continue
      const due = t.due_at ? new Date(t.due_at).getTime() : null
      if (due === null) continue
      if (due < now) overdue.push(t)
      else if (due <= todayEnd.getTime()) today.push(t)
      else if (due < now + 3 * 86400000) risk.push(t)
    }
    return { overdue, today, risk }
  },
}