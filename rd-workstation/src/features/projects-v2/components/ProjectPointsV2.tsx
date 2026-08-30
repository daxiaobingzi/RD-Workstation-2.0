import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Upload, Download, Copy, Trash2, Building2 } from 'lucide-react'
import { useDB } from '../../../db/memory-db'
import { PointService, ProjectService, parsePointRows, DeviceProductOptions, type AttachedPoint, type PointDraft, type ImportPointRow } from '../../../services'
import { Button } from '../../../components/ui/button'
import { Field, Input, Select } from '../../../components/ui/field'
import { Modal } from '../../../components/ui/dialog'
import { Segmented } from '../../../components/ui/segmented'
import { toast } from '../../../components/ui/toast'
import { fmtNum } from '../../../lib/utils'
import { exportPointsXlsx } from '../lib/export-points-xlsx'

interface Row extends AttachedPoint {
  systemId: string
  systemCode: string
  systemName: string
}

/** 模块④ 项目级点表：本项目全部系统点位统一录入（树形分组：系统 → 点位行）
 *  支持：批量导入/批量新增/单个新增/导出 Excel；列宽拖、拖排序、全选、删除 */
export function ProjectPointsV2({ projectId }: { projectId: string }) {
  useDB((s) => s.db)
  const [sysFilter, setSysFilter] = useState('all') // 'all' | psId
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set())
  const [addOpen, setAddOpen] = useState(false)
  const [addMode, setAddMode] = useState<'single' | 'batch'>('single')
  const [importOpen, setImportOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [confirmDel, setConfirmDel] = useState(false)

  const systems = useMemo(() => ProjectService.systems(projectId), [projectId, useDB.getState().db])
  const all = useMemo<Row[]>(
    () =>
      PointService.allByProject(projectId).map((p) => ({
        ...p, systemId: p.project_system_id,
        systemCode: (p as unknown as { systemCode: string }).systemCode,
        systemName: (p as unknown as { systemName: string }).systemName,
      })),
    [projectId, useDB.getState().db],
  )
  // 折叠面板初始化：有数据的系统默认展开
  useEffect(() => {
    setOpenIds((prev) => {
      if (prev.size) return prev
      const next = new Set<string>()
      for (const s of systems) if (all.some((p) => p.systemId === s.id)) next.add(s.id)
      return next.size || systems.length ? next : prev
    })
  }, [systems, all])

  const filtered = useMemo(() => (sysFilter === 'all' ? all : all.filter((p) => p.systemId === sysFilter)), [all, sysFilter])

  const toggleSys = (id: string) => setOpenIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })

  // 行拖拽排序（系统内持久化 point.sort_order）
  const reorderPs = (psId: string, from: number, to: number) => {
    const rows = all.filter((p) => p.systemId === psId)
    if (from === to || from < 0 || to < 0 || from >= rows.length || to >= rows.length) return
    const next = [...rows]
    const [mv] = next.splice(from, 1)
    next.splice(to, 0, mv)
    next.forEach((p, i) => { if ((p.sort_order ?? 0) !== i) PointService.update(p.id, { sort_order: i }) })
  }

  const removePoint = (id: string, batch?: string[]) => {
    if (batch && batch.length) PointService.removeMany(batch)
    else PointService.remove(id)
    toast(batch && batch.length ? `已删除 ${batch.length} 个点位（快照已归档）` : '点位已删除（快照已归档）', 'info')
  }

  const pointsBySys = useMemo(() => {
    const map = new Map<string, Row[]>()
    for (const p of filtered) {
      const arr = map.get(p.systemId) ?? []
      arr.push(p)
      map.set(p.systemId, arr)
    }
    return map
  }, [filtered])

  const totalQty = filtered.reduce((s, p) => s + (p.quantity || 0), 0)

  return (
    <div className="space-y-3">
      {/* 工具条 */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-rule bg-surface px-3.5 py-2.5">
        <Segmented
          value={sysFilter}
          onChange={(v) => setSysFilter(v)}
          options={[
            { value: 'all', label: `全部系统 ${systems.length}` },
            ...systems.map((s) => ({ value: s.id, label: `${s.systemCode} · ${s.systemName}` })),
          ]}
        />
        <span className="text-[11.5px] text-faint">共 {filtered.length} 行 / 合计 {fmtNum(totalQty)} 个点位</span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}><Upload className="size-3.5" />批量导入</Button>
          <Button size="sm" variant="outline" onClick={() => { setAddMode('batch'); setAddOpen(true) }}><Plus className="size-3.5" />批量新增</Button>
          <Button size="sm" variant="outline" onClick={() => { setAddMode('single'); setAddOpen(true) }}><Plus className="size-3.5" />单个新增</Button>
          <Button size="sm" variant="outline" onClick={() => { exportPointsXlsx(projectId); toast('已导出点位 Excel（分系统 Sheet）') }}><Download className="size-3.5" />导出 Excel</Button>
        </div>
      </div>

      {/* 勾选操作独立条（选中时才出现，不挤压工具条） */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-accent/40 bg-accent-soft/30 px-3.5 py-2">
          <span className="text-[12.5px] font-medium text-accent">已选 {selected.size} 个点位</span>
          <span className="text-[11px] text-faint">跨系统累计勾选，可统一删除</span>
          <div className="ml-auto flex items-center gap-1.5">
            <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>取消选择</Button>
            <Button size="sm" variant="danger" onClick={() => {
              if (confirmDel) { removePoint('', [...selected]); setSelected(new Set()); setConfirmDel(false) }
              else { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 2500) }
            }}>
              <Trash2 className="size-3.5" />{confirmDel ? '再次点击确认删除' : '删除所选'}
            </Button>
          </div>
        </div>
      )}

      {/* 分组点表：系统面板 → 点位行（列：建筑/弱电间/设备名称/数量/操作） */}
      <div className="space-y-3">
        {systems.map((ps) => {
          const rows = pointsBySys.get(ps.id) ?? []
          const open = openIds.has(ps.id)
          return (
            <div key={ps.id} className="overflow-hidden rounded-lg border border-rule bg-surface">
              <div className="flex w-full items-center gap-2 border-b border-rule bg-surface-subtle/50 px-3 py-2">
                <button type="button" onClick={() => toggleSys(ps.id)} className="flex items-center gap-2 text-left">
                  {open ? <ChevronDown className="size-3.5 text-faint" /> : <ChevronRight className="size-3.5 text-faint" />}
                  <span className="font-mono text-[10.5px] text-faint">{ps.systemCode}</span>
                  <span className="text-[13px] font-semibold">{ps.systemName}</span>
                </button>
                <span className="ml-auto flex items-center gap-3 font-mono text-[11px] text-faint">
                  <span>{rows.length} 行 / {fmtNum(rows.reduce((s, p) => s + (p.quantity || 0), 0))} 点</span>
                </span>
              </div>
              {open && (
                <PointTable
                  rows={rows}
                  selected={selected}
                  onToggle={(id) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })}
                  onSelectAll={(ids) => setSelected((prev) => { const n = new Set(prev); const allSel = ids.every((i) => n.has(i)); if (allSel) ids.forEach((i) => n.delete(i)); else ids.forEach((i) => n.add(i)); return n })}
                  onReorder={reorderPs}
                  onRemove={removePoint}
                  onCopy={(p) => { PointService.add(ps.id, { device_id: p.device_id, building_id: p.building_id, telecom_room_id: p.telecom_room_id, quantity: p.quantity }); toast('已复制一行') }}
                />
              )}
            </div>
          )
        })}
        {!systems.length && <div className="rounded-lg border border-rule bg-surface p-10 text-center text-[12.5px] text-faint">还没有子系统。请先在主页面通过「项目模版」套用生成系统集，或在「概览」中添加系统。</div>}
      </div>

      {addOpen && (
        <PointAddModal
          projectId={projectId}
          systems={systems}
          mode={addMode}
          onClose={() => setAddOpen(false)}
        />
      )}
      <PointImportModal projectId={projectId} systems={systems} open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  )
}

/* ---------- 系统内点表（SortableTable 风格交互内嵌实现） ---------- */
function PointTable({
  rows, selected, onToggle, onSelectAll, onReorder, onRemove, onCopy,
}: {
  rows: Row[]
  selected: Set<string>
  onToggle: (id: string) => void
  onSelectAll: (ids: string[]) => void
  onReorder: (psId: string, from: number, to: number) => void
  onRemove: (id: string, batch?: string[]) => void
  onCopy: (p: Row) => void
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('points-table:w') ?? '{}') as Record<string, number> } catch { return {} }
  })
  const columns = [
    { key: 'building', title: '建筑', width: 150 },
    { key: 'room', title: '弱电间', width: 150 },
    { key: 'device', title: '设备名称', width: 300 },
    { key: 'quantity', title: '数量', width: 90 },
    { key: 'actions', title: '操作', width: 110 },
  ]
  const startResize = (e: React.PointerEvent, key: string) => {
    e.preventDefault()
    const th = (e.currentTarget as HTMLElement).parentElement as HTMLElement | null
    if (!th) return
    const startX = e.clientX
    const startW = th.getBoundingClientRect().width
    const move = (ev: PointerEvent) => {
      th.style.width = `${Math.max(60, startW + ev.clientX - startX)}px`
      setColWidths((prev) => {
        const next = { ...prev, [key]: Math.max(60, startW + ev.clientX - startX) }
        localStorage.setItem('points-table:w', JSON.stringify(next))
        return next
      })
    }
    const up = () => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
    }
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
  }
  const allIds = rows.map((p) => p.id)
  const allSel = allIds.length > 0 && allIds.every((id) => selected.has(id))

  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr className="bg-surface-subtle text-left text-[11px] text-muted">
            <th className="w-8 px-2 py-1.5">
              <input type="checkbox" className="accent-accent" checked={allSel} onChange={() => onSelectAll(allIds)} aria-label="全选" />
            </th>
            {columns.map((c) => (
              <th key={c.key} className="relative px-2.5 py-1.5 font-medium" style={{ minWidth: c.width, width: colWidths[c.key] }}>
                {c.title}
                <span className="absolute inset-y-0 -right-0.5 z-10 w-1.5 cursor-col-resize hover:bg-accent/40" onPointerDown={(e) => startResize(e, c.key)} title="拖动调整列宽" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((p, idx) => (
            <tr key={p.id} draggable className="group cursor-grab border-t border-rule/60 hover:bg-hover"
              onDragStart={() => setDragIdx(idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); if (dragIdx !== null && dragIdx !== idx) { onReorder(p.project_system_id ?? '', dragIdx, idx); setDragIdx(null) } }}
              onDragEnd={() => setDragIdx(null)}>
              <td className="px-2 py-1.5">
                <input type="checkbox" className="accent-accent" checked={selected.has(p.id)} onChange={() => onToggle(p.id)} aria-label="选择行" />
              </td>
              <td className="px-2.5 py-1.5"><span className="select-none text-faint">⋮⋮ </span>{p.buildingName ?? <span className="text-faint">—</span>}</td>
              <td className="px-2.5 py-1.5 text-muted">{p.telecomRoomName ?? '—'}</td>
              <td className="px-2.5 py-1.5 font-medium">{p.deviceName ?? '—'}</td>
              <td className="px-2.5 py-1.5 text-right font-mono">{fmtNum(p.quantity)}</td>
              <td className="px-2.5 py-1.5">
                <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button type="button" title="复制一行" onClick={() => onCopy(p)} className="rounded p-1 text-faint hover:bg-hover hover:text-accent"><Copy className="size-3.5" /></button>
                  <button type="button" title="删除" onClick={() => onRemove(p.id)} className="rounded p-1 text-faint hover:bg-hover hover:text-danger"><Trash2 className="size-3.5" /></button>
                </div>
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr><td colSpan={6} className="px-3 py-5 text-center text-[12px] text-faint">该系统暂无点位，可「批量导入 / 批量新增」</td></tr>
          )}
        </tbody>
      </table>
      <div className="flex items-center gap-1 px-2.5 py-1 text-[10px] text-faint">
        <Building2 className="size-3" />勾选后顶部出现「删除所选」· 拖动 ⋮⋮ 可在本系统内排序（跨系统各自排序）
      </div>
    </div>
  )
}

/* ---------- 批量/单个新增点位 ---------- */
function PointAddModal({ projectId, systems, mode, onClose }: { projectId: string; systems: ReturnType<typeof ProjectService.systems>; mode: 'single' | 'batch'; onClose: () => void }) {
  const [psId, setPsId] = useState(systems[0]?.id ?? '')
  const [rows, setRows] = useState<PointDraft[]>([{ device_id: '', quantity: 1 }])
  const systemId = useDB.getState().getById<{ system_id: string }>('project_systems', psId)?.system_id
  const options = useMemo(() => (systemId ? DeviceProductOptions.list(systemId) : DeviceProductOptions.list()), [systemId])
  const buildings = useMemo(() => ProjectService.buildings(projectId), [psId])

  const setRow = (i: number, patch: Partial<PointDraft>) => setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r))

  const save = () => {
    if (!psId) { toast('请先选择子系统', 'warn'); return }
    const drafts = rows.filter((r) => r.device_id && (r.quantity ?? 0) > 0)
    if (!drafts.length) { toast('至少填写一行设备 + 数量', 'warn'); return }
    if (mode === 'single') PointService.add(psId, drafts[0])
    else PointService.addMany(psId, drafts)
    toast(mode === 'single' ? '已新增点位' : `已批量新增 ${drafts.length} 个点位`)
    onClose()
  }

  return (
    <Modal
      open onClose={onClose}
      title={mode === 'single' ? '单个新增点位' : '批量新增点位'}
      width={720}
      footer={<><Button variant="outline" onClick={onClose}>取消</Button><Button onClick={save}>确认新增</Button></>}
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-muted">所属系统</span>
          <Select value={psId} onChange={(e) => setPsId(e.target.value)} className="h-7 w-52 text-[12.5px]">
            {systems.map((s) => <option key={s.id} value={s.id}>{s.systemCode} · {s.systemName}</option>)}
          </Select>
          <span className="ml-auto text-[11px] text-faint">{mode === 'single' ? '单行模式 · 缺省建筑/弱电间自动建档' : '多行模式 · 逐行填写'}</span>
        </div>

        <table className="w-full border-collapse text-[12.5px]">
          <thead><tr className="bg-surface-subtle text-left text-[11px] text-muted">
            <th className="px-2 py-1 font-medium">设备名称</th><th className="px-2 py-1 font-medium">建筑</th><th className="px-2 py-1 font-medium">弱电间</th><th className="w-20 px-2 py-1 text-right font-medium">数量</th>
            {mode === 'batch' && <th className="w-8 px-2 py-1"></th>}
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-rule/60">
                <td className="px-1 py-1">
                  <Select value={r.device_id} onChange={(e) => setRow(i, { device_id: e.target.value })} className="h-7 w-52 text-[12px]">
                    <option value="">选择设备…</option>
                    {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </Select>
                </td>
                <td className="px-1 py-1">
                  <Select value={r.building_id ?? ''} onChange={(e) => setRow(i, { building_id: e.target.value || undefined, telecom_room_id: undefined })} className="h-7 w-28 text-[12px]">
                    <option value="">（缺省自动建档）</option>
                    {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </Select>
                </td>
                <td className="px-1 py-1">
                  <Select value={r.telecom_room_id ?? ''} onChange={(e) => setRow(i, { telecom_room_id: e.target.value || undefined })} className="h-7 w-28 text-[12px]" disabled={!r.building_id}>
                    <option value="">（缺省自动建档）</option>
                    {(r.building_id ? ProjectService.telecomRooms(r.building_id) : []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </Select>
                </td>
                <td className="px-1 py-1">
                  <Input type="number" min={1} value={r.quantity ?? 1} onChange={(e) => setRow(i, { quantity: Number(e.target.value) || 1 })} className="h-7 w-20 text-right text-[12px]" />
                </td>
                {mode === 'batch' && (
                  <td className="px-1 py-1 text-center">
                    <button type="button" aria-label="删除行" onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))} className="rounded p-1 text-faint hover:text-danger"><Trash2 className="size-3.5" /></button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {mode === 'batch' && (
          <Button size="sm" variant="outline" onClick={() => setRows((prev) => [...prev, { device_id: '', quantity: 1 }])}><Plus className="size-3.5" />追加一行</Button>
        )}
      </div>
    </Modal>
  )
}

/* ---------- 批量导入：复用 PointService.parsePointRows / importRows，列口径加系统列 ---------- */
function PointImportModal({ projectId, systems, open, onClose }: { projectId: string; systems: ReturnType<typeof ProjectService.systems>; open: boolean; onClose: () => void }) {
  const [psId, setPsId] = useState(systems[0]?.id ?? '')
  const [text, setText] = useState('设备名称,建筑,弱电间,数量\n高清枪型摄像机,A栋,1F-IDF,12\n红外半球摄像机,A栋,,8')
  const [rows, setRows] = useState<ImportPointRow[] | null>(null)
  const [errors, setErrors] = useState<{ line: number; message: string }[]>([])

  const options = useMemo(() => DeviceProductOptions.list(), [])
  const parse = () => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    const matrix = lines.map((l) => (l.includes('\t') ? l.split('\t') : l.split(','))).map((r) => r.map((c) => c.trim()))
    const r = parsePointRows(matrix, { deviceOptions: options, projectId })
    setRows(r.rows)
    setErrors(r.errors)
  }
  const doImport = () => {
    if (!rows?.length || !psId) return
    const { created, errors: e } = PointService.importRows(psId, rows)
    toast(`成功导入 ${created.length} 条${errors.length + e.length ? `，跳过 ${errors.length + e.length} 条问题行` : ''}`)
    setRows(null)
    onClose()
  }
  const downloadTemplate = () => {
    const blob = new Blob(['\uFEFF系统,设备名称,建筑,弱电间,数量\n视频监控,高清枪型摄像机,A栋,1F-IDF,12'], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '点位导入模板.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Modal open={open} onClose={onClose} title="批量导入点位" width={760} footer={<><Button variant="outline" onClick={onClose}>取消</Button><Button onClick={doImport} disabled={!rows?.length}>导入{rows ? `（${rows.length} 条）` : ''}</Button></>}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-muted">导入到系统</span>
          <Select value={psId} onChange={(e) => setPsId(e.target.value)} className="h-7 w-52 text-[12.5px]">
            {systems.map((s) => <option key={s.id} value={s.id}>{s.systemCode} · {s.systemName}</option>)}
          </Select>
          <span className="ml-auto text-[11px] text-faint">首列可加「系统」列；未填系统落到当前选中系统</span>
        </div>
        <Field label="粘贴内容 / 表格文本（设备名称,建筑,弱电间,数量；缺失结构自动建档）">
          <textarea value={text} onChange={(e) => { setText(e.target.value); setRows(null) }} rows={6} className="w-full rounded-[6px] border border-rule bg-surface px-2.5 py-2 font-mono text-[12px] text-ink focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:outline-none" />
        </Field>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={parse}>解析预览</Button>
          <Button size="sm" variant="outline" onClick={downloadTemplate}><Download className="size-3.5" />下载导入模板</Button>
        </div>
        {rows && (
          <div className="rounded-md border border-rule">
            <div className="border-b border-rule bg-surface-subtle/60 px-3 py-1.5 text-[11.5px] text-muted">
              解析成功 {rows.length} 条 · {errors.length} 条问题行
            </div>
            {errors.length > 0 && (
              <ul className="border-b border-rule px-3 py-2 text-[11.5px] text-warn">
                {errors.slice(0, 5).map((e, i) => <li key={i}>第 {e.line} 行：{e.message}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}