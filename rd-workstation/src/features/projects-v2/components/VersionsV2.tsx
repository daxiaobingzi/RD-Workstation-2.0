import { useMemo, useState } from 'react'
import { GitCompare, History, PlusCircle, PencilLine, Trash2, ChevronDown, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react'
import { useDB } from '../../../db/memory-db'
import { T } from '../../../types/domain'
import { BillService, RevisionService } from '../../../services'
import { Segmented } from '../../../components/ui/segmented'
import { EmptyState } from '../../../components/ui/empty'
import { toast } from '../../../components/ui/toast'
import { fmtMoney, fmtNum, cn } from '../../../lib/utils'

type Filter = 'added' | 'removed' | 'quant' | 'price'

/** 模块⑩ 版本：点位修订时间线（保留）+ 清单版本对比富化（统计卡 / 按系统分组 / 筛选） */
export function VersionsV2({ projectId }: { projectId: string }) {
  useDB((s) => s.db)
  const [view, setView] = useState<'bill' | 'point'>('bill')
  const [va, setVa] = useState('')
  const [vb, setVb] = useState('')
  const [filters, setFilters] = useState<Set<Filter>>(new Set<Filter>(['added', 'quant', 'price']))

  const versions = useMemo(() => BillService.versions(projectId), [projectId, useDB.getState().db])
  const idA = va || versions[1]?.id || versions[0]?.id || ''
  const idB = vb || versions[0]?.id || ''

  const diff = useMemo(() => {
    if (!idA || !idB || idA === idB) return null
    return BillService.compareVersions(idA, idB)
  }, [idA, idB, useDB.getState().db])

  const stats = useMemo(() => {
    if (!diff) return null
    const itemsA = BillService.items(idA)
    const sumA = itemsA.reduce((s, i) => s + (i.amount || 0), 0)
    const sumB = BillService.items(idB).reduce((s, i) => s + (i.amount || 0), 0)
    const changedRows = diff.changed.map((c) => {
      const old = itemsA.find((x) => x.item_code === c.item_code || x.device_model_id === c.device_model_id)
      return { ...c, oldQty: old?.quantity ?? 0, oldPrice: old?.unit_price ?? 0 }
    })
    return {
      added: diff.added.length,
      removed: diff.removed.length,
      quantChanged: changedRows.filter((c) => c.quantity !== c.oldQty).length,
      priceChanged: changedRows.filter((c) => c.unit_price !== c.oldPrice).length,
      delta: sumB - sumA,
    }
  }, [diff, idA, idB])

  const groupedDiff = useMemo(() => {
    if (!diff) return []
    const psMap = new Map((useDB.getState().db[T.project_systems] as { id: string; system_id: string }[]).map((p) => [p.id, p.system_id]))
    const sysMap = new Map((useDB.getState().db[T.systems] as { id: string; name: string }[]).map((s) => [s.id, s]))
    const rows: { sysKey: string; sysName: string; kind: 'added' | 'removed' | 'changed'; label: string; item: (typeof diff.added)[number]; oldQty?: number; oldPrice?: number }[] = []
    const itemsA = BillService.items(idA)
    for (const a of diff.added) rows.push({ sysKey: a.project_system_id ?? '__none__', sysName: sysName(psMap, sysMap, a.project_system_id), kind: 'added', label: '新增', item: a })
    for (const r of diff.removed) rows.push({ sysKey: r.project_system_id ?? '__none__', sysName: sysName(psMap, sysMap, r.project_system_id), kind: 'removed', label: '移除', item: r })
    for (const c of diff.changed) {
      const old = itemsA.find((x) => x.item_code === c.item_code || x.device_model_id === c.device_model_id)
      rows.push({ sysKey: c.project_system_id ?? '__none__', sysName: sysName(psMap, sysMap, c.project_system_id), kind: 'changed', label: '变化', item: c, oldQty: old?.quantity ?? 0, oldPrice: old?.unit_price ?? 0 })
    }
    const map = new Map<string, typeof rows>()
    for (const r of rows) {
      const arr = map.get(r.sysKey) ?? []
      arr.push(r)
      map.set(r.sysKey, arr)
    }
    return [...map.values()].map((items) => ({
      sysKey: items[0].sysKey,
      sysName: items[0].sysName,
      delta: items.reduce((s, x) => s + ((x.kind === 'added' ? x.item.amount ?? 0 : x.kind === 'removed' ? -(x.item.amount ?? 0) : ((x.item.amount ?? 0) - (x.oldQty ?? 0) * (x.oldPrice ?? 0)))) , 0),
      items,
    }))
  }, [diff, idA, useDB.getState().db])

  const toggleFilter = (f: Filter) => {
    setFilters((prev) => {
      const n = new Set(prev)
      if (n.has(f)) n.delete(f)
      else n.add(f)
      return n
    })
  }
  const visible = (kind: 'added' | 'removed' | 'changed') => {
    if (kind === 'added') return filters.has('added')
    if (kind === 'removed') return filters.has('removed')
    return filters.has('quant') || filters.has('price')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-rule bg-surface px-3.5 py-2.5">
        <GitCompare className="size-4 text-accent" />
        <span className="text-[13px] font-semibold">版本模块（富化对比）</span>
        <div className="ml-auto">
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'bill', label: '清单版本对比' },
              { value: 'point', label: '点位修订时间线' },
            ]}
          />
        </div>
      </div>

      {view === 'bill' ? (
        <>
          {versions.length >= 2 ? (
            <Space>
              {/* 版本选择 + 统计卡 */}
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-rule bg-surface px-3.5 py-2.5 text-[12.5px]">
                <span className="text-muted">对比版本</span>
                <select value={idA} onChange={(e) => setVa(e.target.value)} className="h-7 rounded-[6px] border border-rule bg-surface px-2 font-mono text-[11.5px]">
                  {versions.map((v) => <option key={v.id} value={v.id}>{v.version_no}</option>)}
                </select>
                <span className="text-faint">→</span>
                <select value={idB} onChange={(e) => setVb(e.target.value)} className="h-7 rounded-[6px] border border-rule bg-surface px-2 font-mono text-[11.5px]">
                  {versions.map((v) => <option key={v.id} value={v.id}>{v.version_no}</option>)}
                </select>
                <span className="ml-auto flex items-center gap-2">
                  {(['added', 'removed', 'quant', 'price'] as Filter[]).map((f) => (
                    <button key={f} type="button" onClick={() => toggleFilter(f)}
                      className={cn('rounded-full border px-2 py-0.5 text-[11px] transition-colors', filters.has(f) ? 'border-accent bg-accent-soft text-accent' : 'border-rule text-faint')}>
                      {f === 'added' ? '新增' : f === 'removed' ? '移除' : f === 'quant' ? '数量变化' : '单价变化'}
                    </button>
                  ))}
                  <button type="button" className="rounded p-1 text-faint hover:text-accent" title="版本明细（移除/拒）" onClick={() => { const v = versions[0]; if (v) { toast(`版本 ${v.version_no}（${v.status === 'confirmed' ? '已确认' : '草稿'}）可切换`) } }}>⋯</button>
                </span>
              </div>

              {stats && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {[
                    { k: '新增项', v: `+${stats.added}`, cls: 'text-ok' },
                    { k: '移除项', v: `-${stats.removed}`, cls: 'text-danger' },
                    { k: '数量变化', v: String(stats.quantChanged), cls: '' },
                    { k: '单价变化', v: String(stats.priceChanged), cls: '' },
                    { k: '金额增量', v: `${stats.delta >= 0 ? '+' : ''}${fmtMoney(stats.delta)}`, cls: stats.delta >= 0 ? 'text-warn' : 'text-ok' },
                  ].map((s) => (
                    <div key={s.k} className="rounded-lg border border-rule bg-surface px-3 py-2">
                      <p className="text-[10.5px] text-faint">{s.k}</p>
                      <p className={cn('font-mono text-[15px] font-bold', s.cls)}>{s.v}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* 按系统分组差异 */}
              {groupedDiff.filter((g) => g.items.some((x) => visible(x.kind))).map((g, gi) => (
                <GroupPanel key={g.sysKey} title={`${g.sysName} · ${gi + 1}`} delta={g.delta}>
                  <table className="w-full border-collapse text-[12px]">
                    <thead><tr className="bg-surface-subtle text-left text-[10.5px] text-faint">
                      <th className="px-2 py-1 font-medium">变化</th><th className="px-2 py-1 font-medium">设备名称</th>
                      <th className="px-2 py-1 text-right font-medium">V(old)数量</th><th className="px-2 py-1 text-right font-medium">V(new)数量</th>
                      <th className="px-2 py-1 text-right font-medium">V(old)单价</th><th className="px-2 py-1 text-right font-medium">V(new)单价</th>
                      <th className="px-2 py-1 text-right font-medium">金额变动</th>
                    </tr></thead>
                    <tbody>
                      {g.items.filter((x) => visible(x.kind)).map((x, i) => (
                        <tr key={i} className="border-t border-rule/60">
                          <td className="px-2 py-1"><Tag kind={x.kind} /></td>
                          <td className="px-2 py-1 font-medium">{x.item.deviceName ?? x.item.item_name}</td>
                          <td className="px-2 py-1 text-right font-mono">{x.kind === 'added' ? '—' : fmtNum(x.oldQty ?? x.item.quantity)}</td>
                          <td className="px-2 py-1 text-right font-mono">{x.kind === 'removed' ? '—' : fmtNum(x.item.quantity)}</td>
                          <td className="px-2 py-1 text-right font-mono">{x.kind === 'added' ? '—' : fmtMoney(x.oldPrice ?? x.item.unit_price)}</td>
                          <td className="px-2 py-1 text-right font-mono">{x.kind === 'removed' ? '—' : fmtMoney(x.item.unit_price)}</td>
                          <td className="px-2 py-1 text-right font-mono">{x.kind === 'added' ? <span className="text-ok">+{fmtMoney(x.item.amount ?? 0)}</span> : x.kind === 'removed' ? <span className="text-danger">-{fmtMoney(x.item.amount ?? 0)}</span> : <span className={cn((x.item.amount ?? 0) - (x.oldQty ?? 0) * (x.oldPrice ?? 0) >= 0 ? 'text-warn' : 'text-ok')}>{fmtMoney((x.item.amount ?? 0) - (x.oldQty ?? 0) * (x.oldPrice ?? 0))}</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </GroupPanel>
              ))}
              {!groupedDiff.length && <div className="rounded-lg border border-rule bg-surface p-8 text-center text-[12.5px] text-faint">两个版本内容一致。</div>}
            </Space>
          ) : (
            <EmptyState icon={<GitCompare />} title="需要至少 2 个清单版本" description="在预算清单页点击「确认生成清单」生成新版本后可对比差异" />
          )}
        </>
      ) : (
        <PointTimeline projectId={projectId} />
      )}
    </div>
  )
}

function Space({ children }: { children: React.ReactNode }) {
  return <div className="space-y-3">{children}</div>
}

function GroupPanel({ title, delta, children }: { title: string; delta: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="overflow-hidden rounded-lg border border-rule bg-surface">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 border-b border-rule bg-surface-subtle/50 px-3.5 py-2 text-left text-[13px] font-semibold">
        {open ? <ChevronDown className="size-3.5 text-faint" /> : <ChevronRight className="size-3.5 text-faint" />}
        {title}
        <span className={cn('ml-auto flex items-center gap-1 font-mono text-[12px] font-semibold', delta >= 0 ? 'text-warn' : 'text-ok')}>
          {delta >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}{fmtMoney(delta)}
        </span>
      </button>
      {open && <div className="overflow-auto p-1">{children}</div>}
    </div>
  )
}

function Tag({ kind }: { kind: 'added' | 'removed' | 'changed' }) {
  const map = {
    added: { label: '新增', cls: 'bg-ok-soft/60 text-ok' },
    removed: { label: '移除', cls: 'bg-danger-soft/50 text-danger' },
    changed: { label: '数量/单价变化', cls: 'bg-accent-soft text-accent' },
  }
  const m = map[kind]
  return <span className={cn('rounded-full px-1.5 py-px text-[10px] font-semibold', m.cls)}>{m.label}</span>
}

function sysName(psMap: Map<string, string>, sysMap: Map<string, { name: string }>, psId?: string): string {
  if (!psId) return '未归入系统'
  const sid = psMap.get(psId)
  return sid ? (sysMap.get(sid)?.name ?? '未知系统') : '未知系统'
}

/* ---------- 点位修订时间线（复用原 VersionsTab 能力） ---------- */
const TYPE_META: Record<string, { label: string; tone: string; icon: typeof PlusCircle }> = {
  create: { label: '新增', tone: 'text-ok', icon: PlusCircle },
  update: { label: '更新', tone: 'text-accent', icon: PencilLine },
  delete: { label: '删除', tone: 'text-danger', icon: Trash2 },
}

function PointTimeline({ projectId }: { projectId: string }) {
  const rows = useMemo(() => RevisionService.listByProject(projectId), [projectId, useDB.getState().db])
  const [filter, setFilter] = useState('all')
  const filtered = rows.filter((r) => filter === 'all' || r.change_type === filter)
  const byDay = useMemo(() => {
    const m = new Map<string, typeof rows>()
    for (const r of filtered) {
      const day = (r.created_at ?? '').slice(0, 10)
      const arr = m.get(day) ?? []
      arr.push(r)
      m.set(day, arr)
    }
    return [...m.entries()]
  }, [filtered])

  return (
    <div className="rounded-lg border border-rule bg-surface">
      <div className="flex flex-wrap items-center gap-3 border-b border-rule px-3.5 py-2.5">
        <History className="size-4 text-accent" />
        <span className="text-[13px] font-semibold">点位修订历史</span>
        <div className="ml-auto">
          <Segmented
            value={filter}
            onChange={(v) => setFilter(v as string)}
            options={[
              { value: 'all', label: `全部 ${rows.length}` },
              { value: 'create', label: `新增 ${rows.filter((r) => r.change_type === 'create').length}` },
              { value: 'update', label: `更新 ${rows.filter((r) => r.change_type === 'update').length}` },
              { value: 'delete', label: `删除 ${rows.filter((r) => r.change_type === 'delete').length}` },
            ]}
          />
        </div>
      </div>
      <div className="max-h-[560px] overflow-auto">
        {byDay.map(([day, list]) => (
          <div key={day}>
            <p className="sticky top-0 z-10 bg-surface-subtle px-3.5 py-1.5 font-mono text-[10.5px] text-faint">{day}</p>
            <ul className="divide-y divide-rule/50">
              {list.map((r) => {
                const meta = TYPE_META[r.change_type ?? ''] ?? TYPE_META.update
                const Icon = meta.icon
                const snap = r.snapshot_json as { deviceName?: string; buildingName?: string; telecomRoomName?: string } | undefined
                return (
                  <li key={r.id} className="flex items-center gap-2.5 px-3.5 py-2">
                    <Icon className={cn('size-3.5 shrink-0', meta.tone)} />
                    <p className="truncate text-[12.5px] text-ink">{r.change_summary}</p>
                    <p className="truncate text-[11.5px] text-muted">{snap?.deviceName ?? ''} · {snap?.buildingName ?? '—'} · {snap?.telecomRoomName ?? '—'}</p>
                    <span className={cn('ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold', meta.tone)}>{meta.label}</span>
                    <span className="shrink-0 font-mono text-[10.5px] text-faint">{(r.created_at ?? '').slice(11, 19)}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
        {!byDay.length && <EmptyState icon={<History />} title="暂无修订记录" description="点位每次增删改自动写入快照，这里展示变更历史" />}
      </div>
    </div>
  )
}