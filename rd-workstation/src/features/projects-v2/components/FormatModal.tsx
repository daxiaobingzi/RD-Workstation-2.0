import { useState } from 'react'
import { Plus, X, Pencil, Check } from 'lucide-react'
import { Modal } from '../../../components/ui/dialog'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/field'
import { toast } from '../../../components/ui/toast'
import { FormatService } from '../../../services'
import { cn } from '../../../lib/utils'

/** 业态管理弹窗：全部业态由用户自定义（新增 / 重命名 / 移除），无内置 */
export function FormatModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('')
  const [list, setList] = useState<string[]>(FormatService.list())
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const [renaming, setRenaming] = useState<string | null>(null)
  const [newName, setNewName] = useState('')

  const add = () => {
    const res = FormatService.add(name)
    if (!res.ok) { toast(res.message ?? '添加失败', 'warn'); return }
    toast(res.message ?? '业态已新增')
    setName('')
    setList(FormatService.list())
  }

  const commitRename = () => {
    if (renaming == null) return
    const res = FormatService.rename(renaming, newName)
    if (!res.ok) toast(res.message ?? '重命名失败', 'warn')
    else toast(res.message ?? '业态已重命名')
    setRenaming(null)
    setList(FormatService.list())
  }

  const toggleRemove = (f: string) => {
    setRemoved((prev) => {
      const next = new Set(prev)
      if (next.has(f)) next.delete(f)
      else next.add(f)
      return next
    })
  }

  const remove = () => {
    removed.forEach((f) => {
      const rows = FormatService.find(f)
      rows.forEach((r) => FormatService.removeItem(r.id))
    })
    toast(`已移除 ${removed.size} 个自定义业态`, 'info')
    setRemoved(new Set())
    setList(FormatService.list())
  }

  return (
    <Modal open={open} onClose={onClose} title="业态管理（自定义）" width={560}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>关闭</Button>
          {removed.size > 0 && <Button variant="danger" onClick={remove}>移除 {removed.size} 个（两次点击确认）</Button>}
        </>
      }>
      <div className="space-y-3">
        <p className="text-[12.5px] text-muted">项目「类型」列为<b>业态</b>；全部业态均可新增 / 重命名 / 移除。</p>
        <div className="rounded-lg border border-rule">
          <div className="flex items-center justify-between border-b border-rule bg-surface-subtle/60 px-3 py-1.5">
            <span className="font-mono text-[10.5px] text-faint">当前业态 {list.length} 个</span>
            <span className="font-mono text-[10.5px] text-faint">全局生效 · 作用于新建项目下拉与项目模版</span>
          </div>
          <div className="flex flex-wrap items-start gap-1.5 p-3">
            {list.map((f) => {
              if (renaming === f) {
                return (
                  <span key={f} className="flex items-center gap-1 rounded-full border border-accent bg-accent-soft/40 pl-1.5">
                    <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} onBlur={commitRename} onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(null) }} className="h-5 w-36 rounded-full bg-surface px-2 text-[12px] focus:outline-none" />
                    <button type="button" onClick={commitRename} className="rounded-full p-1 text-accent hover:bg-accent-soft" title="确认重命名"><Check className="size-3" /></button>
                  </span>
                )
              }
              return (
                <span key={f} className={cn('group/item flex items-center overflow-hidden rounded-full border text-[12px] transition-colors',
                  removed.has(f) ? 'border-danger bg-danger-soft/50 text-danger' : 'border-rule bg-surface text-ink hover:border-accent/40')}>
                  <button type="button" onClick={() => toggleRemove(f)} className="px-2.5 py-1">
                    {removed.has(f) ? <X className="mr-1 inline size-3 pb-px" /> : null}{f}
                  </button>
                  <button
                    type="button"
                    title="重命名该业态"
                    onClick={() => { setRenaming(f); setNewName(f) }}
                    className="border-l border-rule/60 px-1.5 py-1 text-faint opacity-0 transition-opacity hover:bg-hover hover:text-accent group-hover/item:opacity-100"
                  >
                    <Pencil className="size-3" />
                  </button>
                  <button type="button" title="移除该业态（两次点击）" onClick={() => toggleRemove(f)} className="border-l border-rule/60 px-1.5 py-1 text-faint opacity-0 transition-opacity hover:bg-hover hover:text-danger group-hover/item:opacity-100">
                    <X className="size-3" />
                  </button>
                </span>
              )
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="新增业态，如：数据中心 / 产业园…" onKeyDown={(e) => e.key === 'Enter' && add()} />
          <Button onClick={add}><Plus className="size-4" />添加业态</Button>
        </div>
        <p className="text-[11px] text-faint">数据落地：dictionaries 字典（group_code=project_format）开环存储；重命名会同步该业态下已建项目与按业态归档的模版。项目模版按业态配置与套用（业态切换 → 模版集联动）。</p>
      </div>
    </Modal>
  )
}