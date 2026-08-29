import { useEffect, useMemo, useState } from 'react'
import { Download, Plus, Trash2, Copy, Building2, Cable, Pencil, ArrowUp, ArrowDown, CornerUpLeft, CornerDownLeft } from 'lucide-react'
import { useDB } from '../../../db/memory-db'
import { T } from '../../../types/domain'
import type { Point } from '../../../types/domain'
import { PointService, DesignService, ProjectService } from '../../../services'
import type { PointDraft, AttachedPoint } from '../../../services'
import { DeviceProductOptions, type ProductOption } from '../../../services/device.catalog'
import { DeviceNameSelect } from '../components/DeviceNameSelect'
import { PointImportDialog } from '../importers/PointImport'
import { Button } from '../../../components/ui/button'
import { Field, Input, Select } from '../../../components/ui/field'
import { Modal } from '../../../components/ui/dialog'
import { NumCell } from '../../../components/ui/table'
import { DataTable, type DataColumn } from '../../../components/ui/data-table'
import { EmptyState } from '../../../components/ui/empty'
import { toast } from '../../../components/ui/toast'
import { fmtNum, cn } from '../../../lib/utils'
import { StepCard } from '../panels/StepCard'

/** 数量列排序：按原始数值（排序函数签名由列上下文推断） */
const qtySort = (a: { getValue: (id: string) => unknown }, b: { getValue: (id: string) => unknown }) =>
  (Number(a.getValue('quantity')) || 0) - (Number(b.getValue('quantity')) || 0)

/** 点位步骤：设备名称（关联设备中心）+ 建筑/弱电间 联动 + 数量 */
export function PointsStep({ psId, points }: { psId: string; points: Point[] }) {
  const [importOpen, setImportOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [batchOpen, setBatchOpen] = useState(false)
  const [structOpen, setStructOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const systemId = useDB.getState().getById<{ system_id: string }>(T.project_systems, psId)?.system_id ?? 'sys_vss'
  const projectId = PointService.projectIdOf(psId)
  const options = useMemo(() => DeviceProductOptions.list(systemId), [systemId])
  const recentIds = PointService.recentDeviceIds(psId)
  const attached = PointService.attach(points)
  const total = points.reduce((s, p) => s + (p.quantity || 0), 0)

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const selectAll = () => {
    setSelectedIds((prev) => (prev.size === attached.length ? new Set() : new Set(attached.map((p) => p.id))))
  }

  const refreshProgress = () => {
    useDB.getState().update(T.project_systems, psId, { progress: DesignService.progress(psId), updated_at: new Date().toISOString() })
  }

  const copyRow = (p: Point) => {
    PointService.add(psId, { device_id: p.device_id, building_id: p.building_id, telecom_room_id: p.telecom_room_id, quantity: p.quantity })
    refreshProgress()
    toast('已复制一行')
  }

  const onImported = (n: number) => {
    if (n > 0) refreshProgress()
    setImportOpen(false)
  }

  // TanStack Table 列定义：编号/数量按原始值排序，设备/建筑/弱电间走 accessorKey
  const columns = useMemo<DataColumn<AttachedPoint>[]>(
    () => [
      {
        id: 'select',
        header: () => (
          <input type="checkbox" checked={attached.length > 0 && attached.every((p) => selectedIds.has(p.id))} onChange={selectAll} className="accent-accent" aria-label="全选" />
        ),
        cell: ({ row }) => (
          <input type="checkbox" checked={selectedIds.has(row.original.id)} onChange={() => toggleSelect(row.original.id)} className="accent-accent" aria-label="选择行" />
        ),
        enableSorting: false,
      },
      { accessorKey: 'point_code', header: '编号', cell: ({ getValue }) => <NumCell>{String(getValue())}</NumCell> },
      {
        id: 'device',
        header: '设备名称',
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            <span className="font-medium">{row.original.deviceName ?? '—'}</span>
            {row.original.deviceFamily && deviceVariant(row.original.deviceFamily)}
          </span>
        ),
      },
      { accessorKey: 'buildingName', header: '建筑', cell: ({ getValue }) => <span className="text-muted">{String(getValue() ?? '—')}</span> },
      { accessorKey: 'telecomRoomName', header: '弱电间', cell: ({ getValue }) => <span className="text-muted">{String(getValue() ?? '—')}</span> },
      {
        accessorKey: 'quantity',
        header: '数量',
        sortingFn: qtySort,
        cell: ({ getValue }) => <NumCell>{fmtNum(Number(getValue()))}</NumCell>,
      },
      {
        id: 'actions',
        header: () => <span className="ml-auto font-normal">操作</span>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-0.5">
            <button type="button" className="rounded p-1 text-faint hover:bg-hover hover:text-accent" title="复制一行" onClick={() => copyRow(row.original)}><Copy className="size-3.5" /></button>
            <button type="button" className="rounded p-1 text-faint hover:bg-danger-soft hover:text-danger" title="删除" onClick={() => { PointService.remove(row.original.id); refreshProgress(); toast('点位已删除', 'info') }}><Trash2 className="size-3.5" /></button>
          </div>
        ),
        enableSorting: false,
      },
    ],
    [attached, selectedIds, selectAll, toggleSelect, copyRow, refreshProgress],
  )

  return (
    <StepCard title="点位录入" desc={`设备名称（关联设备中心）· 区域 · 弱电间 · 数量 · 共 ${points.length} 条 · ${fmtNum(total)} 台`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setStructOpen(true)}><Building2 className="size-3.5" />建筑结构</Button>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}><Download className="size-3.5" />批量导入</Button>
          <Button size="sm" variant="outline" onClick={() => setBatchOpen(true)}><Plus className="size-3.5" />批量新增</Button>
          <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="size-3.5" />添加点位</Button>
        </div>
      </div>

      {/* 批量选择操作条：删除 / 移动区域 / 移动弱电间 / 改设备 */}
      {selectedIds.size > 0 && (
        <BatchActionBar
          psId={psId}
          selectedIds={selectedIds}
          onClear={() => setSelectedIds(new Set())}
          onDone={refreshProgress}
        />
      )}

      <DataTable
        columns={columns}
        data={attached}
        getRowId={(p) => p.id}
        empty={
          <EmptyState icon={<Plus />} title="还没有点位" description="添加点位 / 批量新增 / 批量导入" action={<Button size="sm" onClick={() => setBatchOpen(true)}><Plus className="size-3.5" />批量新增</Button>} />
        }
      />

      {addOpen && (
        <PointForm
          psId={psId}
          projectId={projectId}
          options={options}
          recentIds={recentIds}
          onDone={() => { setAddOpen(false); refreshProgress() }}
          onCancel={() => setAddOpen(false)}
        />
      )}

      <StructureManager open={structOpen} onClose={() => setStructOpen(false)} projectId={projectId} />

      <BatchNewDialog open={batchOpen} onClose={() => setBatchOpen(false)} psId={psId} projectId={projectId} options={options} recentIds={recentIds} onDone={() => { setBatchOpen(false); refreshProgress() }} />

      <PointImportDialog open={importOpen} onClose={() => setImportOpen(false)} psId={psId} onImported={onImported} />
    </StepCard>
  )
}

function deviceVariant(family?: string) {
  return <span className="ml-1.5 rounded-full bg-surface-subtle px-1.5 py-0.5 text-[10.5px] text-muted">{family}</span>
}

/* ---------- 单条添加表单 ---------- */
function PointForm({
  psId, projectId, options, recentIds, onDone, onCancel,
}: {
  psId: string; projectId: string; options: ProductOption[]; recentIds: string[]; onDone: () => void; onCancel: () => void
}) {
  const [deviceId, setDeviceId] = useState<string | undefined>(options.find((o) => o.familyName === '摄像机')?.id)
  const [buildingId, setBuildingId] = useState(ProjectService.buildings(projectId)[0]?.id ?? '')
  const [telecomId, setTelecomId] = useState('')
  const [qty, setQty] = useState(1)

  const buildings = ProjectService.buildings(projectId)
  const telecoms = buildingId ? ProjectService.telecomRooms(buildingId) : []

  const submit = () => {
    if (!deviceId) { toast('请选择设备名称', 'warn'); return }
    if (!buildingId && !telecomId) { toast('请选择建筑或弱电间', 'warn'); return }
    PointService.add(psId, { device_id: deviceId, building_id: buildingId || undefined, telecom_room_id: telecomId || undefined, quantity: qty })
    toast('点位已添加')
    onDone()
  }

  return (
    <div className="mt-3 rounded-md border border-accent/30 bg-accent-soft/40 p-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Field label="设备名称" required className="md:col-span-2">
          <DeviceNameSelect value={deviceId} onChange={setDeviceId} options={options} recentIds={recentIds} />
        </Field>
        <Field label="建筑">
          <Select value={buildingId} onChange={(e) => { setBuildingId(e.target.value); setTelecomId('') }}>
            <option value="">未指定</option>
            {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Field>
        <Field label="弱电间">
          <Select value={telecomId} onChange={(e) => setTelecomId(e.target.value)}>
            <option value="">—</option>
            {telecoms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        </Field>
        <Field label="数量"><Input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} /></Field>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onCancel}>取消</Button>
        <Button size="sm" onClick={submit}>确认添加</Button>
      </div>
    </div>
  )
}

/* ---------- 批量新增：数据库表格样式（设备×建筑×弱电间×数量，多行编辑） ---------- */
interface BatchRow {
  key: number // 行标识（渲染唯一性）
  deviceId: string
  buildingId: string
  telecomId: string
  qty: number
  checked: boolean
}
let batchKeySeq = 1000
const newRow = (): BatchRow => ({ key: batchKeySeq++, deviceId: '', buildingId: '', telecomId: '', qty: 1, checked: false })

function BatchNewDialog({ open, onClose, psId, projectId, options, recentIds, onDone }: {
  open: boolean; onClose: () => void; psId: string; projectId: string; options: ProductOption[]; recentIds: string[]; onDone: () => void
}) {
  const buildings = ProjectService.buildings(projectId)
  const telecomByBuilding = (bid: string) => (bid ? ProjectService.telecomRooms(bid) : [])
  const setRow = (i: number, patch: Partial<BatchRow>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const [rows, setRows] = useState<BatchRow[]>([newRow()])
  const [selectAll, setSelectAll] = useState(false)

  // 每次打开重置为单行空表单
  useEffect(() => {
    if (open) { setRows([newRow()]); setSelectAll(false) }
  }, [open])

  const toggleOne = (i: number) => {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, checked: !r.checked } : r)))
  }
  const toggleAll = () => {
    setSelectAll((prev) => {
      const next = !prev
      setRows((rs) => rs.map((r) => ({ ...r, checked: next })))
      return next
    })
  }
  const insertAbove = (i: number) => setRows((rs) => [...rs.slice(0, i), newRow(), ...rs.slice(i)])
  const insertBelow = (i: number) => setRows((rs) => [...rs.slice(0, i + 1), newRow(), ...rs.slice(i + 1)])
  const removeRow = (i: number) => setRows((rs) => (rs.length <= 1 ? rs : rs.filter((_, j) => j !== i)))
  const moveUp = (i: number) => setRows((rs) => {
    if (i === 0) return rs
    const next = rs.slice()
    ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
    return next
  })
  const moveDown = (i: number) => setRows((rs) => {
    if (i >= rs.length - 1) return rs
    const next = rs.slice()
    ;[next[i], next[i + 1]] = [next[i + 1], next[i]]
    return next
  })

  const validRows = () => {
    const bad: string[] = []
    rows.forEach((r, i) => {
      if (!r.deviceId) bad.push(`第 ${i + 1} 行缺设备`)
      else if (!r.buildingId) bad.push(`第 ${i + 1} 行缺建筑`)
      else if (r.qty < 1) bad.push(`第 ${i + 1} 行数量无效`)
    })
    return bad
  }

  const submit = () => {
    const bad = validRows()
    if (bad.length) { toast(bad.join('；'), 'warn'); return }
    const drafts: PointDraft[] = rows.map((r) => ({
      device_id: r.deviceId,
      building_id: r.buildingId,
      telecom_room_id: r.telecomId || undefined,
      quantity: r.qty,
    }))
    const created = PointService.addMany(psId, drafts)
    toast(`已批量新增 ${created.length} 条点位`)
    setRows([newRow()])
    onDone()
  }

  return (
    <Modal open={open} onClose={onClose} title="批量新增点位" width={900}>
      <div className="space-y-3">
        <p className="text-[12px] text-muted">
          行式录入：每行 = 设备 × 建筑 × 弱电间 × 数量。一个建筑弱电间内同型号多台设备，填数量即可（一条点位 = 多台）。
          支持新增 / 上插 / 下插 / 删除 / 上下移动 / 勾选与全选。
        </p>
        <div className="max-h-[46vh] overflow-auto rounded-md border border-rule">
          <table className="w-full border-collapse text-[12.5px]">
            <thead className="sticky top-0 z-10 bg-surface">
              <tr className="border-b border-rule text-left">
                <th className="w-7 px-2 py-1.5">
                  <input type="checkbox" checked={selectAll} onChange={toggleAll} className="accent-accent" aria-label="全选" />
                </th>
                <th className="w-10 px-1 py-1.5 text-center text-faint">#</th>
                <th className="px-2 py-1.5 font-medium">设备名称</th>
                <th className="w-44 px-2 py-1.5 font-medium">建筑</th>
                <th className="w-44 px-2 py-1.5 font-medium">弱电间</th>
                <th className="w-20 px-2 py-1.5 font-medium">数量</th>
                <th className="w-40 px-1 py-1.5 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.key} className={cn('border-b border-rule/50', r.checked && 'bg-accent-soft/20')}>
                  <td className="px-2 py-1">
                    <input type="checkbox" checked={r.checked} onChange={() => toggleOne(i)} className="accent-accent" aria-label={`选择第 ${i + 1} 行`} />
                  </td>
                  <td className="px-1 py-1 text-center font-mono text-[11px] text-faint">{String(i + 1).padStart(2, '0')}</td>
                  <td className="px-2 py-1">
                    <DeviceNameSelect value={r.deviceId} onChange={(v) => setRow(i, { deviceId: v })} options={options} recentIds={recentIds} placeholder="选择设备…" />
                  </td>
                  <td className="px-2 py-1">
                    <Select value={r.buildingId} onChange={(e) => setRow(i, { buildingId: e.target.value, telecomId: '' })} className="h-7 w-full text-[12px]">
                      <option value="">选择建筑…</option>
                      {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </Select>
                  </td>
                  <td className="px-2 py-1">
                    <Select value={r.telecomId} onChange={(e) => setRow(i, { telecomId: e.target.value })} className="h-7 w-full text-[12px]" disabled={!r.buildingId}>
                      <option value="">—</option>
                      {telecomByBuilding(r.buildingId).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </Select>
                  </td>
                  <td className="px-2 py-1">
                    <Input type="number" min={1} value={r.qty} onChange={(e) => setRow(i, { qty: Math.max(1, Number(e.target.value) || 1) })} className="h-7 w-full text-[12px]" />
                  </td>
                  <td className="px-1 py-1">
                    <div className="flex justify-end gap-0.5">
                      <button type="button" className="rounded p-1 text-faint hover:bg-hover hover:text-accent" title="向上移动" onClick={() => moveUp(i)}><ArrowUp className="size-3.5" /></button>
                      <button type="button" className="rounded p-1 text-faint hover:bg-hover hover:text-accent" title="向下移动" onClick={() => moveDown(i)}><ArrowDown className="size-3.5" /></button>
                      <button type="button" className="rounded p-1 text-faint hover:bg-hover hover:text-accent" title="在上方插入一行" onClick={() => insertAbove(i)}><CornerUpLeft className="size-3.5" /></button>
                      <button type="button" className="rounded p-1 text-faint hover:bg-hover hover:text-accent" title="在下方插入一行" onClick={() => insertBelow(i)}><CornerDownLeft className="size-3.5" /></button>
                      <button type="button" className="rounded p-1 text-faint hover:bg-danger-soft hover:text-danger" title="删除本行" onClick={() => removeRow(i)}><Trash2 className="size-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between">
          <Button size="xs" variant="outline" onClick={() => setRows((rs) => [...rs, newRow()])}><Plus className="size-3" />底部新增一行</Button>
          <span className="font-mono text-[11.5px] text-faint">{rows.length} 行 · 预生成 {rows.filter((r) => r.deviceId && r.buildingId).reduce((s, r) => s + r.qty, 0)} 台设备</span>
        </div>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onClose}>取消</Button>
          <Button size="sm" onClick={submit}>新增 {rows.length} 条点位</Button>
        </div>
      </div>
    </Modal>
  )
}

/* ---------- 批量选择操作条 ---------- */
function BatchActionBar({ psId, selectedIds, onClear, onDone }: { psId: string; selectedIds: Set<string>; onClear: () => void; onDone: () => void }) {
  const projectId = PointService.projectIdOf(psId)
  const [moveBuilding, setMoveBuilding] = useState('')
  const [moveTelecom, setMoveTelecom] = useState('')
  const [newDevice, setNewDevice] = useState<string | undefined>()

  const systemId = useDB.getState().getById<{ system_id: string }>(T.project_systems, psId)?.system_id ?? 'sys_vss'
  const options = DeviceProductOptions.list(systemId)
  const buildings = ProjectService.buildings(projectId)

  const doMoveBuilding = () => {
    if (!moveBuilding) return
    PointService.batchSet([...selectedIds], { building_id: moveBuilding })
    toast(`已移动 ${selectedIds.size} 条到新建筑`)
    onDone(); onClear()
  }
  const doMoveTelecom = () => {
    if (!moveTelecom) return
    PointService.batchSet([...selectedIds], { telecom_room_id: moveTelecom || undefined })
    toast(`已移动 ${selectedIds.size} 条到新弱电间`)
    onDone(); onClear()
  }
  const doChangeDevice = () => {
    if (!newDevice || newDevice === '__none__') return
    PointService.batchSet([...selectedIds], { device_id: newDevice })
    toast(`已改设备为 ${selectedIds.size} 条`)
    setNewDevice(undefined)
    onDone(); onClear()
  }
  const doDelete = () => {
    PointService.removeMany([...selectedIds])
    toast(`已删除 ${selectedIds.size} 条点位`)
    onDone(); onClear()
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-accent/30 bg-accent-soft/30 px-3 py-2">
      <span className="text-[12px] font-semibold text-accent">已选 {selectedIds.size} 条</span>
      <div className="flex items-center gap-1.5">
        <Building2 className="size-3.5 text-faint" />
        <select value={moveBuilding} onChange={(e) => setMoveBuilding(e.target.value)} className="h-7 rounded-[6px] border border-rule bg-surface px-1.5 text-[12px]">
          <option value="">移动建筑…</option>
          {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <Button size="xs" variant="outline" disabled={!moveBuilding} onClick={doMoveBuilding}>移动</Button>
      </div>
      <div className="flex items-center gap-1.5">
        <Cable className="size-3.5 text-faint" />
        <select value={moveTelecom} onChange={(e) => setMoveTelecom(e.target.value)} className="h-7 rounded-[6px] border border-rule bg-surface px-1.5 text-[12px]">
          <option value="">移动弱电间…</option>
          {buildings.flatMap((b) => ProjectService.telecomRooms(b.id).map((r) => <option key={r.id} value={r.id}>{b.name} / {r.name}</option>))}
        </select>
        <Button size="xs" variant="outline" disabled={!moveTelecom} onClick={doMoveTelecom}>移动</Button>
      </div>
      <div className="flex items-center gap-1.5">
        <Pencil className="size-3.5 text-faint" />
        <div className="w-44"><DeviceNameSelect size="sm" value={newDevice} onChange={(id) => setNewDevice(id)} options={options} recentIds={[]} placeholder="改设备…" /></div>
        <Button size="xs" variant="outline" disabled={!newDevice} onClick={doChangeDevice}>改设备</Button>
      </div>
      <Button size="xs" variant="outline" className="text-danger" onClick={doDelete}><Trash2 className="size-3" />删除</Button>
      <Button size="xs" variant="ghost" className="ml-auto" onClick={onClear}>取消选择</Button>
    </div>
  )
}

/* ---------- 建筑 / 弱电间 结构管理 ---------- */
function StructureManager({ open, onClose, projectId }: { open: boolean; onClose: () => void; projectId: string }) {
  const [bldName, setBldName] = useState('')
  const [roomName, setRoomName] = useState('')
  const [selectedBld, setSelectedBld] = useState<string | undefined>()

  const buildings = ProjectService.buildings(projectId)
  const telecoms = selectedBld ? ProjectService.telecomRooms(selectedBld) : []
  const building = buildings.find((b) => b.id === selectedBld)

  const pickBuilding = (id: string) => { setSelectedBld(id); setRoomName('') }

  return (
    <Modal open={open} onClose={onClose} title="项目建筑结构：建筑 → 弱电间" width={600}>
      <div className="grid grid-cols-2 gap-3">
        {/* 建筑列表 */}
        <div className="rounded-md border border-rule">
          <div className="flex gap-1.5 border-b border-rule p-2">
            <Input value={bldName} onChange={(e) => setBldName(e.target.value)} placeholder="新增建筑…" className="h-7 text-[12px]" />
            <Button size="xs" onClick={() => { if (!bldName.trim()) return; const b = ProjectService.addBuilding(projectId, bldName.trim()); setBldName(''); pickBuilding(b.id) }}>添加</Button>
          </div>
          <ul className="max-h-60 overflow-auto p-1.5">
            {buildings.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => pickBuilding(b.id)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-[6px] px-2.5 py-1.5 text-[12.5px] transition-colors',
                    selectedBld === b.id ? 'bg-accent-soft font-medium text-accent' : 'text-muted hover:bg-hover hover:text-ink',
                  )}
                >
                  <span className="flex items-center gap-1.5"><Building2 className="size-3.5" />{b.name}</span>
                  <span className="font-mono text-[10.5px] text-faint">{ProjectService.telecomRooms(b.id).length}T</span>
                </button>
              </li>
            ))}
            {!buildings.length && <p className="px-2 py-3 text-center text-[12px] text-faint">还没有建筑，先添加一栋</p>}
          </ul>
        </div>

        {/* 弱电间 */}
        <div className="rounded-md border border-rule">
          <div className="border-b border-rule px-2 py-1.5 text-[12px] font-semibold text-muted">{building ? `${building.name} · 弱电间` : '弱电间'}</div>
          <div className="flex gap-1.5 p-2">
            <Input value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="新增弱电间…" disabled={!selectedBld} className="h-7 text-[12px]" />
            <Button size="xs" disabled={!selectedBld} onClick={() => { if (!selectedBld || !roomName.trim()) return; ProjectService.addTelecomRoom(selectedBld, roomName.trim()); setRoomName('') }}>添加</Button>
          </div>
          <ul className="max-h-44 overflow-auto px-1.5 pb-1.5">
            {telecoms.map((r) => (
              <li key={r.id} className="group flex items-center justify-between rounded-[6px] px-2 py-1 text-[12.5px] text-muted hover:bg-hover">
                <span><Cable className="mr-1.5 inline size-3 text-faint" />{r.name}</span>
                <button type="button" className="opacity-0 text-faint transition-opacity group-hover:opacity-100 hover:text-danger" onClick={() => { const rr = ProjectService.removeTelecomRoom(r.id); if (!rr.ok) toast(rr.reason ?? '无法删除', 'warn') }}><Trash2 className="size-3" /></button>
              </li>
            ))}
            {!telecoms.length && <p className="px-2 py-3 text-center text-[12px] text-faint">无弱电间</p>}
          </ul>
        </div>
      </div>
    </Modal>
  )
}