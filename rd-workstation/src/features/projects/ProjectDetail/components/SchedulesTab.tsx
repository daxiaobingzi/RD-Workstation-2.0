import { useMemo, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import zhCnLocale from '@fullcalendar/core/locales/zh-cn'
import { Plus, CalendarPlus } from 'lucide-react'
import { useDB } from '../../../../db/memory-db'
import { ScheduleService } from '../../../../services'
import { Modal } from '../../../../components/ui/dialog'
import { Button } from '../../../../components/ui/button'
import { Field, Input } from '../../../../components/ui/field'
import { EmptyState } from '../../../../components/ui/empty'
import { toast } from '../../../../components/ui/toast'

/**
 * 项目日程 tab：FullCalendar（MIT，≈19k stars）周月/列表视图。
 * F2：补"新建日程"写入入口（写 schedules 表，project_id 归项目）+ 删除；
 * 事件使用 ISO 时间字符串。
 */
export function SchedulesTab({ projectId }: { projectId: string }) {
  useDB((s) => s.db)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('')
  const schedules = ScheduleService.byProject(projectId)

  const events = useMemo(
    () =>
      schedules.map((s) => ({
        id: s.id,
        title: s.title,
        start: s.start_at,
        end: s.end_at ?? s.start_at,
        // 同一天短日程 app ends 会因 end 等于 start 被 FC 截断，统一给 end 加 30 分钟
        ...(s.end_at ? {} : { end: (() => { const d = new Date(s.start_at); d.setMinutes(d.getMinutes() + 30); return d })() }),
        allDay: false,
      })),
    [schedules],
  )

  const submit = () => {
    if (!title.trim() || !date) { toast('请填写标题与日期', 'warn'); return }
    const iso = (t: string) => new Date(`${date}T${t || '09:00'}:00`).toISOString()
    ScheduleService.add({
      title: title.trim(),
      start_at: iso(start),
      end_at: end ? iso(end) : undefined,
      project_id: projectId,
    })
    toast('日程已添加')
    setTitle(''); setDate(''); setEnd('')
    setOpen(false)
  }

  const remove = (id: string) => {
    ScheduleService.remove(id)
    toast('日程已删除', 'info')
  }

  return (
    <div className="rounded-lg border border-rule bg-surface p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12px] text-muted">{schedules.length} 个日程</span>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="size-3.5" />新建日程</Button>
      </div>
      {!schedules.length ? (
        <EmptyState icon={<CalendarPlus className="size-7 text-faint" />} title="暂无日程" description="点击「新建日程」安排项目节点" />
      ) : (
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,listWeek' }}
          locale={zhCnLocale}
          initialView="timeGridWeek"
          height="auto"
          events={events}
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          eventDidMount={(info) => {
            info.el.addEventListener('contextmenu', (e) => {
              e.preventDefault()
              remove(info.event.id)
            })
          }}
        />
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="新建日程"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={submit}>创建</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="标题" required>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：系统图纸会审" autoFocus />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="日期" required>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="开始">
              <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field label="结束（可空）">
              <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </Field>
          </div>
          <p className="text-[11.5px] text-faint">日程归属于当前项目；右键日历中的日程可删除。</p>
        </div>
      </Modal>
    </div>
  )
}