import { useState } from 'react'
import { Plus, Trash2, Pencil } from 'lucide-react'
import type { DeviceMaterial, DeviceMaterialCategory } from '../../../types/domain'
import { DeviceService } from '../../../services'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/field'
import { toast } from '../../../components/ui/toast'

const CAT_LABEL: Record<DeviceMaterialCategory, string> = {
  cable: '线缆', conduit: '管材', aux: '辅材', other: '其他',
}

/** 设备单点定额材料（P4）：定义该设备 1 点位消耗的线缆/管材/辅材配比。
 *  推导时按 Σ点位台数 × 每点定额 生成工程量与清单材料；品牌/型号/单价供清单计价。 */
export function MaterialQuotaEditor({ productId, productName }: { productId: string; productName: string }) {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<DeviceMaterial>>({ category: 'cable', name: '', unit: '米', quantity_per_point: 1, brand: '', model: '', params: '', price: undefined })
  const materials = DeviceService.materials(productId)

  const startAdd = () => { setEditingId(null); setDraft({ category: 'cable', name: '', unit: '米', quantity_per_point: 1, brand: '', model: '', params: '', price: undefined }); setOpen(true) }
  const startEdit = (m: DeviceMaterial) => { setEditingId(m.id); setDraft({ ...m }); setOpen(true) }

  const saveDraft = () => {
    if (!draft.name?.trim()) { toast('请填写材料名称', 'warn'); return }
    if (!draft.quantity_per_point || draft.quantity_per_point <= 0) { toast('定额用量需大于 0', 'warn'); return }
    DeviceService.saveMaterial({ ...draft, id: editingId ?? undefined, product_id: productId, name: draft.name.trim() })
    toast(editingId ? '材料定额已更新' : '材料定额已保存')
    setOpen(false); setEditingId(null)
  }

  return (
    <Block title="单点定额材料（推导用）">
      {materials.length ? (
        <ul className="space-y-1">
          {materials.map((m) => (
            <li key={m.id} className="rounded-[6px] bg-surface-subtle/60 px-2 py-1 text-[12px]">
              <div className="flex items-center gap-1.5">
                <span className="rounded-full bg-surface-subtle px-1.5 text-[10px] text-faint">{CAT_LABEL[m.category]}</span>
                <span className="min-w-0 flex-1 truncate text-muted">{m.name}</span>
                {m.price != null && <span className="shrink-0 font-mono text-[11px] text-ink">¥{m.price}/{m.unit}</span>}
                <span className="shrink-0 font-mono text-[11px] text-faint">{m.quantity_per_point} {m.unit}/点</span>
                <button type="button" className="rounded p-0.5 text-faint hover:text-accent" title="编辑" onClick={() => startEdit(m)}><Pencil className="size-3" /></button>
                <button type="button" className="rounded p-0.5 text-faint hover:text-danger" title="删除" onClick={() => { DeviceService.removeMaterial(m.id); toast('已删除定额', 'info') }}><Trash2 className="size-3" /></button>
              </div>
              {[m.brand, m.model, m.params].some(Boolean) && (
                <p className="mt-0.5 truncate pl-1 text-[10.5px] text-faint">{[m.brand, m.model, m.params].filter(Boolean).join(' · ')}</p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11.5px] text-faint">未配置。推导材料（线缆/管材/辅材）需要在此定义每点定额。</p>
      )}

      {open ? (
        <div className="mt-2 space-y-1.5 rounded-md border border-accent/30 bg-accent-soft/30 p-2">
          <div className="grid grid-cols-[1fr_90px] gap-1.5">
            <select
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value as DeviceMaterialCategory })}
              className="h-7 rounded-[6px] border border-rule bg-surface px-2 text-[12px]"
            >
              {Object.entries(CAT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <Input value={draft.quantity_per_point} type="number" min={0.01} step={0.01} onChange={(e) => setDraft({ ...draft, quantity_per_point: Number(e.target.value) || 0 })} className="h-7 text-[12px]" placeholder="每点用量" />
          </div>
          <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="材料名称，如 六类非屏蔽双绞线" className="h-7 text-[12px]" />
          <div className="grid grid-cols-2 gap-1.5">
            <Input value={draft.brand ?? ''} onChange={(e) => setDraft({ ...draft, brand: e.target.value })} placeholder="品牌（清单计价）" className="h-7 text-[12px]" />
            <Input value={draft.model ?? ''} onChange={(e) => setDraft({ ...draft, model: e.target.value })} placeholder="型号" className="h-7 text-[12px]" />
          </div>
          <div className="grid grid-cols-[1fr_70px_56px] gap-1.5">
            <Input value={draft.params ?? ''} onChange={(e) => setDraft({ ...draft, params: e.target.value })} placeholder="参数（单行）" className="h-7 text-[12px]" />
            <Input value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} className="h-7 text-[12px]" placeholder="单位" />
            <Input type="number" min={0} step={0.01} value={draft.price ?? ''} onChange={(e) => setDraft({ ...draft, price: e.target.value === '' ? undefined : Number(e.target.value) })} className="h-7 text-[12px]" placeholder="单价¥" />
          </div>
          <div className="flex justify-end gap-1.5">
            <Button size="xs" variant="ghost" onClick={() => { setOpen(false); setEditingId(null) }}>取消</Button>
            <Button size="xs" onClick={saveDraft}><Plus className="size-3" />保存</Button>
          </div>
        </div>
      ) : (
        <Button size="xs" variant="outline" className="mt-2" onClick={startAdd}><Plus className="size-3" />添加定额材料</Button>
      )}
      <p className="mt-1.5 text-[10.5px] text-faint">作用于「{productName}」每 1 台/点位的消耗量；品牌/型号/参数/单价供清单计价（推导自动计入工程量与清单）。</p>
    </Block>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-rule pt-3">
      <p className="mb-1.5 text-[10.5px] font-semibold tracking-wide text-faint uppercase">{title}</p>
      {children}
    </div>
  )
}