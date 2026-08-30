import { useState } from 'react'
import { Settings2, Plus, Trash2, AlertTriangle, X, Pencil } from 'lucide-react'
import { useDB } from '../../../db/memory-db'
import { T, type Product } from '../../../types/domain'
import { DeviceService } from '../../../services'
import { Modal } from '../../../components/ui/dialog'
import { Button } from '../../../components/ui/button'
import { Input, Select, Field } from '../../../components/ui/field'
import { toast } from '../../../components/ui/toast'
import { cn } from '../../../lib/utils'

/** 页签栏入口按钮（设备中心） */
export function SystemManageButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ml-auto flex items-center gap-1 rounded-md border border-rule px-2.5 py-1 text-[12px] font-medium text-muted transition-colors hover:border-accent hover:text-accent"
      title="自定义设备系统：新增/编辑/删除，系统简写即设备编码前缀"
    >
      <Settings2 className="size-3.5" />管理系统
    </button>
  )
}

/** 设备系统管理：列表（分组）→ 编辑（名称/简写/分组）→ 删除（级联+引用保护） */
export default function SystemManageModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useDB((s) => s.db)
  const [editingId, setEditingId] = useState<string | null>(null) // null=未选中 / '__new'=新增
  const [form, setForm] = useState({ name: '', code: '', group: '', customGroup: '' })
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const [usedBlock, setUsedBlock] = useState<{ reason: string; used: { model: string; brand: string; projectNames: string[] }[] } | null>(null)
  const [renamingGroup, setRenamingGroup] = useState<string | null>(null)
  const [newGroupName, setNewGroupName] = useState('')

  const commitGroupRename = () => {
    if (renamingGroup == null) return
    const r = DeviceService.renameGroup(renamingGroup, newGroupName)
    if (!r.ok) { toast(r.reason ?? '重命名失败', 'warn') }
    else toast(r.reason ?? '分组已重命名')
    setRenamingGroup(null)
  }

  if (!open) return null

  const systems = DeviceService.systems()
  const groups = DeviceService.groups()
  const counts = new Map<string, number>()
  for (const p of useDB.getState().db[T.products] ?? []) {
    const sid = (p as Product).system_id ?? '__other'
    counts.set(sid, (counts.get(sid) ?? 0) + 1)
  }
  const editing = editingId ? (editingId === '__new' ? null : DeviceService.systemById(editingId)) : null
  const previewCodes = useDB.getState().db[T.products]
    .filter((p) => editingId && (p as Product).system_id === editingId && (p as Product).device_code)
    .slice(0, 4)
    .map((p) => (p as Product).device_code as string)
  const newPrefix = form.code.trim().toUpperCase()

  const reset = () => {
    setEditingId(null); setForm({ name: '', code: '', group: '', customGroup: '' }); setConfirmDel(null); setUsedBlock(null)
  }

  const pick = (id: string) => {
    const s = DeviceService.systemById(id)
    if (!s) return
    setEditingId(id)
    setForm({ name: s.name, code: s.code, group: s.group, customGroup: '' })
    setConfirmDel(null); setUsedBlock(null)
  }

  const startAdd = () => {
    setEditingId('__new')
    setForm({ name: '', code: '', group: groups[0] ?? '通用', customGroup: '' })
    setUsedBlock(null)
  }

  const save = () => {
    const name = form.name.trim()
    if (editingId === '__new') {
      const r = DeviceService.add({ name, code: form.code, group: form.customGroup.trim() || form.group })
      if (!r.ok) { toast(r.reason ?? '创建失败', 'error'); return }
      toast(`系统「${r.system?.name}」已创建`)
    } else {
      if (!editingId) return
      const oldCode = DeviceService.systemById(editingId)?.code
      const r = DeviceService.update(editingId, { name, code: form.code, group: form.customGroup.trim() || form.group })
      if (!r.ok) { toast(r.reason ?? '更新失败', 'error'); return }
      toast(newPrefix && newPrefix !== oldCode ? '系统已更新，设备编码前缀已同步' : '系统已更新')
    }
    reset()
  }

  const askDel = (id: string) => {
    if (confirmDel !== id) {
      setConfirmDel(id); setUsedBlock(null)
      window.setTimeout(() => setConfirmDel((c) => (c === id ? null : c)), 4000)
      return
    }
    const r = DeviceService.remove(id)
    setConfirmDel(null)
    if (!r.ok) {
      if (r.used?.length) { setUsedBlock({ reason: r.reason ?? '删除失败', used: r.used }) }
      else toast(r.reason ?? '删除失败', 'error')
      return
    }
    toast('系统已删除，其下设备已级联清理')
    if (editingId === id) reset()
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title="设备系统管理" width={860}>
      <div className="flex items-stretch gap-4">
        {/* 左：分组 → 系统列表（与右面板等高，列表区撑满） */}
        <div className="flex w-[300px] shrink-0 flex-col">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold tracking-wide text-faint uppercase">系统列表（按分组）</p>
            <Button size="xs" variant="outline" onClick={startAdd}><Plus className="size-3" />新增系统</Button>
          </div>
          <div className="min-h-[280px] flex-1 space-y-1 overflow-auto rounded-md border border-rule bg-surface-subtle/30 p-1.5">
            {groups.map((g) => (
              <div key={g} className="group">
                {/* 分组标题（可重命名） */}
                <div className="mt-2 mb-1 flex items-center gap-1 px-1">
                  {renamingGroup === g ? (
                    <input
                      autoFocus
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      onBlur={commitGroupRename}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitGroupRename(); if (e.key === 'Escape') setRenamingGroup(null) }}
                      className="h-5 w-40 rounded border border-accent bg-surface px-1 text-[11px] focus:outline-none"
                    />
                  ) : (
                    <p className="flex items-center gap-1 text-[10.5px] font-medium tracking-wide text-faint uppercase">
                      {g}
                      <button type="button" title="重命名分组" onClick={() => { setRenamingGroup(g); setNewGroupName(g) }} className="rounded p-0.5 opacity-0 text-faint transition-opacity hover:text-accent group-hover:opacity-100">
                        <Pencil className="size-3" />
                      </button>
                    </p>
                  )}
                </div>
                {systems.filter((s) => s.group === g).map((s) => (
                  <div key={s.id} className={cn('group flex items-center gap-1.5 rounded-md border px-2 py-1.5 transition-colors', editingId === s.id ? 'border-accent bg-accent-soft/30' : 'border-rule hover:bg-hover')}>
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-1.5 text-left" onClick={() => pick(s.id)} title="点击编辑（可重命名系统）">
                      <span className="shrink-0 rounded bg-accent-soft px-1 py-px font-mono text-[10.5px] text-accent">{s.code}</span>
                      <span className="truncate text-[12.5px] font-medium">{s.name}</span>
                      <span className="ml-auto shrink-0 font-mono text-[10px] text-faint">{counts.get(s.id) ?? 0}</span>
                    </button>
                    <button type="button" title="重命名系统" onClick={() => pick(s.id)} className="shrink-0 rounded p-0.5 text-faint opacity-0 transition-opacity hover:text-accent group-hover:opacity-100">
                      <Pencil className="size-3" />
                    </button>
                    <button type="button" className={cn('shrink-0 rounded p-0.5 text-faint hover:text-danger', confirmDel === s.id && 'bg-danger text-white')} title={confirmDel === s.id ? '再次点击确认删除（级联清理其下设备）' : '删除系统（级联清理其下设备）'} onClick={() => askDel(s.id)}>
                      {confirmDel === s.id ? <AlertTriangle className="size-3" /> : <Trash2 className="size-3" />}
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10.5px] leading-relaxed text-faint">
            删除系统将级联删除其下所有设备；型号已被项目选型/清单引用的系统无法删除。
          </p>
        </div>

        {/* 右：编辑面板 */}
        <div className="flex min-w-0 flex-1 flex-col rounded-lg border border-rule bg-surface-subtle/40 p-3">
          {!editingId ? (
            <p className="flex flex-1 items-center justify-center py-10 text-center text-[12.5px] text-faint">选择左侧系统进行编辑，或「新增系统」</p>
          ) : (
            <div className="space-y-3">
              <p className="text-[12.5px] font-semibold">{editingId === '__new' ? '新增系统' : `编辑系统：${editing?.name ?? ''}`}</p>
              <Field label="系统名称" required>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如 视频监控系统" className="h-7 text-[12px]" />
              </Field>
              <Field label="系统简写（设备编码前缀）" required>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="如 VSS（1~6 位大写字母/数字）"
                  className="h-7 w-40 font-mono text-[12px]"
                />
                {editingId !== '__new' && previewCodes.length > 0 && (
                  <p className="mt-1 text-[11px] text-muted">
                    改简写后设备编码将同步更新（序号保留）：
                    <span className="ml-1.5 space-x-1.5">
                      {previewCodes.map((c) => (
                        <code key={c} className="rounded bg-surface px-1 py-px font-mono text-[10.5px] text-faint line-through">{c}</code>
                      ))}
                      {newPrefix && newPrefix !== editing?.code && (
                        <span className="space-x-1.5">
                          {previewCodes.map((c) => (
                            <code key={`${newPrefix}-${c}`} className="rounded bg-accent-soft px-1 py-px font-mono text-[10.5px] text-accent">
                              {c.replace(/^[A-Z0-9]+/, newPrefix)}
                            </code>
                          ))}
                        </span>
                      )}
                    </span>
                  </p>
                )}
              </Field>
              <Field label="所属分组">
                <div className="flex gap-2">
                  <Select value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value, customGroup: e.target.value === '__new__' ? form.customGroup : '' })} className="h-7 text-[12px]">
                    {groups.map((g) => <option key={g} value={g}>{g}</option>)}
                    <option value="__new__">＋ 新建分组…</option>
                  </Select>
                  {form.group === '__new__' && (
                    <Input value={form.customGroup} onChange={(e) => setForm({ ...form, customGroup: e.target.value })} placeholder="新分组名称" className="h-7 w-32 text-[12px]" autoFocus />
                  )}
                </div>
              </Field>
              <div className="flex justify-end gap-2 border-t border-rule pt-3">
                <Button size="sm" variant="outline" onClick={reset}>取消</Button>
                <Button size="sm" onClick={save}>{editingId === '__new' ? '创建系统' : '保存修改'}</Button>
              </div>
              {usedBlock && (
                <div className="rounded-md border border-danger/30 bg-danger-soft/30 px-3 py-2">
                  <p className="flex items-center gap-1.5 text-[12px] font-medium text-danger"><AlertTriangle className="size-3.5" />{usedBlock.reason}</p>
                  <ul className="mt-1 space-y-0.5 pl-5 text-[12px] text-muted">
                    {usedBlock.used.map((u, i) => (
                      <li key={i}>「{u.model}」{u.brand ? `（${u.brand}）` : ''} —— 引用项目：{u.projectNames.join('、') || '未知项目'}</li>
                    ))}
                  </ul>
                  <p className="mt-1 text-[11px] text-faint">请先解除这些型号在项目中的引用（或改为停用）后再删除该系统的其他设备。</p>
                  <button type="button" className="mt-1 flex items-center gap-0.5 text-[11px] text-muted hover:text-ink" onClick={() => setUsedBlock(null)}><X className="size-3" />收起</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}