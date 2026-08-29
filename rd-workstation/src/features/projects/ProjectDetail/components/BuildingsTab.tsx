import { useState } from 'react'
import { Building2, Cable, Plus, Trash2, Pencil } from 'lucide-react'
import { useDB } from '../../../../db/memory-db'
import { ProjectService } from '../../../../services'
import { Button } from '../../../../components/ui/button'
import { Input } from '../../../../components/ui/field'
import { toast } from '../../../../components/ui/toast'
import { cn } from '../../../../lib/utils'

/**
 * 项目空间结构管理 tab：建筑 → 弱电间（增删改，删除带引用保护）
 * 与系统设计点位页的"建筑结构"弹窗共享同一套 ProjectService 数据源。
 */
export function BuildingsTab({ projectId }: { projectId: string }) {
  useDB((s) => s.db)
  const [selected, setSelected] = useState<string | undefined>()
  const [newNames, setNewNames] = useState<Record<'bld' | 'tr', string>>({ bld: '', tr: '' })
  const [editing, setEditing] = useState<{ kind: 'bld' | 'tr'; id: string } | undefined>()
  const [editName, setEditName] = useState('')

  const buildings = ProjectService.buildings(projectId)
  const building = buildings.find((b) => b.id === selected) ?? buildings[0]
  const telecoms = building ? ProjectService.telecomRooms(building.id) : []

  const addBuilding = () => {
    if (!newNames.bld.trim()) { toast('请输入建筑名称', 'warn'); return }
    const b = ProjectService.addBuilding(projectId, newNames.bld.trim())
    setNewNames((n) => ({ ...n, bld: '' }))
    setSelected(b.id)
  }
  const addRoom = () => {
    if (!building || !newNames.tr.trim()) return
    ProjectService.addTelecomRoom(building.id, newNames.tr.trim())
    setNewNames((n) => ({ ...n, tr: '' }))
  }

  const removeBuilding = (id: string) => {
    const r = ProjectService.removeBuilding(id)
    if (!r.ok) { toast(r.reason ?? '无法删除', 'warn'); return }
    if (selected === id) setSelected(undefined)
    toast('建筑已删除', 'info')
  }
  const removeRoom = (id: string) => {
    const r = ProjectService.removeTelecomRoom(id)
    if (!r.ok) { toast(r.reason ?? '无法删除', 'warn'); return }
    toast('弱电间已删除', 'info')
  }

  const startEdit = (kind: 'bld' | 'tr', id: string, name: string) => {
    setEditing({ kind, id })
    setEditName(name)
  }
  const saveEdit = () => {
    if (!editing || !editName.trim()) return
    if (editing.kind === 'bld') ProjectService.updateBuilding(editing.id, { name: editName.trim() })
    if (editing.kind === 'tr') ProjectService.updateTelecomRoom(editing.id, { name: editName.trim() })
    setEditing(undefined)
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* 建筑列表 */}
      <div className="rounded-lg border border-rule bg-surface shadow-sm">
        <div className="flex items-center gap-1.5 border-b border-rule px-3.5 py-2.5">
          <Building2 className="size-4 text-accent" />
          <h3 className="text-[13px] font-semibold">建筑</h3>
          <span className="ml-auto font-mono text-[11px] text-faint">{buildings.length}</span>
        </div>
        <div className="flex gap-1.5 p-2.5">
          <Input value={newNames.bld} onChange={(e) => setNewNames((n) => ({ ...n, bld: e.target.value }))} placeholder="新增建筑，如：A栋" className="h-7 text-[12px]" />
          <Button size="xs" onClick={addBuilding}><Plus className="size-3" /></Button>
        </div>
        <ul className="max-h-80 divide-y divide-rule overflow-auto">
          {buildings.map((b) => (
            <li key={b.id}>
              <div
                className={cn(
                  'group flex w-full items-center gap-2 px-3 py-2 text-[12.5px] transition-colors',
                  building?.id === b.id ? 'bg-accent-soft/60 font-medium text-accent' : 'text-muted hover:bg-hover hover:text-ink',
                )}
              >
                <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setSelected(b.id)}>
                  <Building2 className="size-3.5 shrink-0" />
                  {editing?.kind === 'bld' && editing.id === b.id ? (
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} onBlur={saveEdit} onKeyDown={(e) => e.key === 'Enter' && saveEdit()} className="h-6 w-full rounded border border-accent bg-surface px-1.5 text-[12.5px]" autoFocus />
                  ) : (
                    <span className="truncate">{b.name}</span>
                  )}
                </button>
                <span className="shrink-0 font-mono text-[10px] text-faint">{ProjectService.telecomRooms(b.id).length}T</span>
                <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
                  <button type="button" className="rounded p-1 text-faint hover:text-accent" title="重命名" onClick={() => startEdit('bld', b.id, b.name)}><Pencil className="size-3" /></button>
                  <button type="button" className="rounded p-1 text-faint hover:text-danger" title="删除" onClick={() => removeBuilding(b.id)}><Trash2 className="size-3" /></button>
                </div>
              </div>
            </li>
          ))}
          {!buildings.length && <li className="px-3 py-6 text-center text-[12px] text-faint">还没有建筑，先添加一栋</li>}
        </ul>
      </div>

      {/* 弱电间 */}
      <div className="rounded-lg border border-rule bg-surface shadow-sm">
        <div className="flex items-center gap-1.5 border-b border-rule px-3.5 py-2.5">
          <Cable className="size-4 text-accent2" />
          <h3 className="text-[13px] font-semibold">{building ? `${building.name} · 弱电间` : '弱电间'}</h3>
          <span className="ml-auto font-mono text-[11px] text-faint">{telecoms.length}</span>
        </div>
        <div className="flex gap-1.5 p-2.5">
          <Input value={newNames.tr} onChange={(e) => setNewNames((n) => ({ ...n, tr: e.target.value }))} placeholder={building ? '新增弱电间，如：1F-IDF' : '先选择建筑'} disabled={!building} className="h-7 text-[12px]" />
          <Button size="xs" disabled={!building} onClick={addRoom}><Plus className="size-3" /></Button>
        </div>
        <ul className="max-h-80 divide-y divide-rule overflow-auto">
          {telecoms.map((r) => (
            <li key={r.id} className="group flex items-center gap-2 px-3 py-2 text-[12.5px] text-muted hover:bg-hover">
              <Cable className="size-3.5 shrink-0 text-faint" />
              {editing?.kind === 'tr' && editing.id === r.id ? (
                <input value={editName} onChange={(e) => setEditName(e.target.value)} onBlur={saveEdit} onKeyDown={(e) => e.key === 'Enter' && saveEdit()} className="h-6 w-full rounded border border-accent bg-surface px-1.5 text-[12.5px]" autoFocus />
              ) : (
                <span className="min-w-0 flex-1 truncate">{r.name}</span>
              )}
              <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
                <button type="button" className="rounded p-1 text-faint hover:text-accent" onClick={() => startEdit('tr', r.id, r.name)}><Pencil className="size-3" /></button>
                <button type="button" className="rounded p-1 text-faint hover:text-danger" onClick={() => removeRoom(r.id)}><Trash2 className="size-3" /></button>
              </div>
            </li>
          ))}
          {!telecoms.length && building && <li className="px-3 py-6 text-center text-[12px] text-faint">该建筑还没有弱电间</li>}
        </ul>
      </div>

      <p className="text-[11.5px] text-faint lg:col-span-2">
        提示：被点位引用的 弱电间 不可删除（建筑需先清空弱电间），请先在点位中调整；系统设计工作区点位页的"建筑结构"与此处数据实时同步。
      </p>
    </div>
  )
}