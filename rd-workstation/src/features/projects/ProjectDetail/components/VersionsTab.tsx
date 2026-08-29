import { useMemo, useState } from 'react'
import { History, PlusCircle, PencilLine, Trash2, GitCompare } from 'lucide-react'
import { useDB } from '../../../../db/memory-db'
import type { Revision } from '../../../../types/domain'
import { RevisionService, PointService } from '../../../../services'
import type { AttachedPoint } from '../../../../services'
import { EmptyState } from '../../../../components/ui/empty'
import { Segmented } from '../../../../components/ui/segmented'
import { cn } from '../../../../lib/utils'

type Filter = 'all' | 'create' | 'update' | 'delete'

const TYPE_META: Record<string, { label: string; tone: string; icon: typeof PlusCircle }> = {
  create: { label: '新增', tone: 'bg-ok-soft/60 text-ok', icon: PlusCircle },
  update: { label: '更新', tone: 'bg-accent-soft/60 text-accent', icon: PencilLine },
  delete: { label: '删除', tone: 'bg-danger-soft/50 text-danger', icon: Trash2 },
}

/** 版本 tab：点位修订时间线（增删改自动快照）+ 相邻版本字段级对比 */
export function VersionsTab({ projectId }: { projectId: string }) {
  useDB((s) => s.db)
  const [filter, setFilter] = useState<Filter>('all')
  const [selectedId, setSelectedId] = useState<string>()

  const rows = RevisionService.listByProject(projectId)
  const counts = useMemo(
    () => ({
      all: rows.length,
      create: rows.filter((r) => r.change_type === 'create').length,
      update: rows.filter((r) => r.change_type === 'update').length,
      delete: rows.filter((r) => r.change_type === 'delete').length,
    }),
    [rows],
  )

  const filtered = rows.filter((r) => filter === 'all' || r.change_type === filter)

  // 按天分组
  const byDay = useMemo(() => {
    const map = new Map<string, Revision[]>()
    filtered.forEach((r) => {
      const day = (r.created_at ?? '').slice(0, 10)
      const list = map.get(day) ?? []
      list.push(r)
      map.set(day, list)
    })
    return [...map.entries()]
  }, [filtered])

  const selected = rows.find((r) => r.id === selectedId)
  const prev = selected ? RevisionService.previous(selected.entity_id, selected.id) : undefined

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-rule bg-surface px-3.5 py-2.5 text-[12px] text-muted">
        <Segmented
          value={filter}
          onChange={(v) => { setFilter(v as Filter); setSelectedId(undefined) }}
          options={[
            { value: 'all', label: `全部 ${counts.all}` },
            { value: 'create', label: `新增 ${counts.create}` },
            { value: 'update', label: `更新 ${counts.update}` },
            { value: 'delete', label: `删除 ${counts.delete}` },
          ]}
        />
        <span className="ml-auto flex items-center gap-1 font-mono text-[11px] text-faint">
          <History className="size-3" />点位每次增删改自动写入快照
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
        {/* 时间线 */}
        <div className="rounded-lg border border-rule bg-surface shadow-sm lg:col-span-4">
          <div className="flex items-center gap-2 border-b border-rule px-3.5 py-2.5">
            <History className="size-4 text-accent" />
            <h3 className="text-[13px] font-semibold">修订历史</h3>
            <span className="ml-auto font-mono text-[11px] text-faint">{filtered.length} 条</span>
          </div>
          <div className="max-h-[540px] overflow-auto">
            {byDay.map(([day, list]) => (
              <div key={day} className="border-b border-rule/60 last:border-0">
                <p className="sticky top-0 z-10 bg-surface-subtle px-3.5 py-1.5 font-mono text-[10.5px] text-faint">{day}</p>
                <ul className="divide-y divide-rule/50">
                  {list.map((r) => {
                    const meta = TYPE_META[r.change_type ?? ''] ?? TYPE_META.update
                    const Icon = meta.icon
                    const snap = r.snapshot_json as AttachedPoint | undefined
                    const active = selectedId === r.id
                    return (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(r.id)}
                          className={cn(
                            'flex w-full items-center gap-2.5 px-3.5 py-2 text-left transition-colors',
                            active ? 'bg-accent-soft/40' : 'hover:bg-hover',
                          )}
                        >
                          <Icon className={cn('size-3.5 shrink-0', meta.tone)} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12.5px] font-medium text-ink">{r.change_summary}</p>
                            <p className="truncate text-[11.5px] text-muted">
                              {snap?.deviceName ?? ''} · {snap?.buildingName ?? '—'} · {snap?.telecomRoomName ?? '—'}
                            </p>
                          </div>
                          <span className={cn('rounded-full px-1.5 py-0.5 text-[10.5px]', meta.tone)}>{meta.label}</span>
                          <span className="font-mono text-[10.5px] text-faint">{(r.created_at ?? '').slice(11, 19)}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
            {!byDay.length && (
              <EmptyState icon={<History />} title="暂无修订记录" description="到系统设计工作区增删改点位后，这里会记录每一次变更" />
            )}
          </div>
        </div>

        {/* 对比面板 */}
        <SnapshotDiff rev={selected} prev={prev} />
      </div>
    </div>
  )
}

/** 相邻版本快照对比：当前快照 vs 该点位上一次修订快照 */
function SnapshotDiff({ rev, prev }: { rev?: Revision; prev?: Revision }) {
  if (!rev) {
    return (
      <div className="rounded-lg border border-rule bg-surface lg:col-span-3">
        <div className="flex items-center gap-2 border-b border-rule px-3.5 py-2.5">
          <GitCompare className="size-4 text-accent2" />
          <h3 className="text-[13px] font-semibold">版本对比</h3>
        </div>
        <div className="flex h-48 flex-col items-center justify-center gap-2 text-center text-[12.5px] text-faint">
          <GitCompare className="size-6 opacity-40" />
          <p>从左侧选择一条修订，对比当前版本与上一次修订的差异</p>
        </div>
      </div>
    )
  }

  // 通过 attach 把快照附加上设备/建筑/弱电间名称
  const snap = rev.snapshot_json as AttachedPoint
  const prevSnap = prev?.snapshot_json as AttachedPoint | undefined
  const [cur, old] = PointService.attach([snap, ...(prevSnap ? [prevSnap] : [])])

  const fields: { label: string; newV: unknown; oldV?: unknown }[] = [
    { label: '编号', newV: cur.point_code, oldV: old?.point_code },
    { label: '设备名称', newV: cur.deviceName ?? '—', oldV: old?.deviceName },
    { label: '建筑', newV: cur.buildingName ?? '—', oldV: old?.buildingName },
    { label: '弱电间', newV: cur.telecomRoomName ?? '—', oldV: old?.telecomRoomName },
    { label: '数量', newV: cur.quantity, oldV: old?.quantity },
  ]

  return (
    <div className="rounded-lg border border-rule bg-surface shadow-sm lg:col-span-3">
      <div className="flex items-center gap-2 border-b border-rule px-3.5 py-2.5">
        <GitCompare className="size-4 text-accent2" />
        <h3 className="text-[13px] font-semibold">版本对比</h3>
        <span className="ml-auto rounded-full bg-surface-subtle px-1.5 font-mono text-[10.5px] text-muted">
          {rev.change_type === 'create' ? '新增' : rev.change_type === 'delete' ? '删除' : '更新'}
        </span>
      </div>
      <div className="space-y-1 p-3.5">
        <p className="text-[11.5px] text-faint">{rev.change_summary} · {(rev.created_at ?? '').slice(0, 16).replace('T', ' ')}</p>
        <div className="mt-2 overflow-hidden rounded-md border border-rule">
          <table className="w-full border-collapse text-[12.5px]">
            <tbody className="divide-y divide-rule/70">
              {fields.map((f) => {
                const changed = prevSnap ? String(f.newV) !== String(f.oldV) : false
                return (
                  <tr key={f.label} className="hover:bg-hover">
                    <td className="w-20 border-r border-rule bg-surface-subtle px-3 py-1.5 text-[11px] text-muted">{f.label}</td>
                    <td className="px-3 py-1.5">
                      {prevSnap ? (
                        <div className="space-y-0.5">
                          {changed ? (
                            <>
                              <span className="block text-[12px] text-faint line-through">{String(f.oldV ?? '—')}</span>
                              <span className="block text-[12.5px] font-medium text-ok">{String(f.newV)}</span>
                            </>
                          ) : (
                            <span className="text-[12.5px]">{String(f.newV)}</span>
                          )}
                        </div>
                      ) : (
                        <span className={cn('text-[12.5px]', rev.change_type === 'create' && 'font-medium text-ok')}>
                          {String(f.newV)}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {!prevSnap && rev.change_type === 'delete' && (
          <p className="pt-1.5 text-[11.5px] text-faint">该点位已删除，仅保留历史快照。</p>
        )}
      </div>
    </div>
  )
}