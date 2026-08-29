import { useState } from 'react'
import { Settings2 } from 'lucide-react'
import { useDB } from '../../../db/memory-db'
import { T } from '../../../types/domain'
import { DeviceService } from '../../../services'
import type { DeviceChain } from '../../../engines/design.engine'
import { Button } from '../../../components/ui/button'
import { Input, Select } from '../../../components/ui/field'
import { toast } from '../../../components/ui/toast'

/* ---------- 数量逻辑（设备链）：设备类型承接关系推导配置，可读可改 ---------- */
function ChainQuotaPanel({ productId, systemId }: { productId: string; systemId?: string }) {
  const db = useDB((s) => s.db)
  const chain = (db[T.products] ?? []).find((p) => (p as { id: string }).id === productId) as { id: string; chain_json?: string } | undefined
  const chainJson = chain?.chain_json
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Partial<DeviceChain>>({})

  const parsed = chainJson ? parseChain(chainJson) : null
  const deviceTypes = DeviceService.deviceTypes({ systemId })

  const startEdit = () => {
    setDraft(parsed ?? { mode: 'carry', capacity: 1, source: 'front', factor: 1, reserve: 0, round: 'ceil' })
    setEditing(true)
  }
  const save = () => {
    const c: DeviceChain = {
      mode: draft.mode ?? 'carry',
      capacity: Math.max(1, Number(draft.capacity) || 1),
      source: draft.mode === 'fixed' ? undefined : (draft.source || 'front'),
      factor: draft.mode === 'fixed' ? undefined : Number(draft.factor ?? 1),
      reserve: draft.mode === 'fixed' ? undefined : Number(draft.reserve ?? 0),
      round: draft.mode === 'fixed' ? undefined : (draft.round ?? 'ceil'),
    }
    DeviceService.updateDeviceType(productId, { chain_json: JSON.stringify(c) })
    setEditing(false)
    toast('数量链已保存（推导时优先使用）', 'success')
  }
  const clear = () => {
    DeviceService.updateDeviceType(productId, { chain_json: undefined })
    setEditing(false)
    toast('已清除设备链（回落到设计规则驱动）', 'info')
  }

  return (
    <div>
      {!editing && (
        <div>
          {parsed ? (
            <p className="text-[12px] text-muted">
              数量链：{chainText(parsed, deviceTypes)}
            </p>
          ) : (
            <p className="text-[11.5px] text-faint">未配置设备链（按设计规则推导）；可在此配置承接关系</p>
          )}
          <Button size="xs" variant="outline" className="mt-1.5" onClick={startEdit}><Settings2 className="size-3" />{parsed ? '编辑数量链' : '配置数量链'}</Button>
        </div>
      )}

      {editing && (
        <div className="space-y-1.5 rounded-md border border-rule bg-surface-subtle/40 p-2">
          <div className="flex items-center gap-1.5">
            <span className="w-10 shrink-0 text-[10.5px] text-muted">方式</span>
            <Select value={draft.mode ?? 'carry'} onChange={(e) => setDraft({ ...draft, mode: e.target.value as DeviceChain['mode'] })} className="h-6 flex-1 text-[11px]">
              <option value="carry">承接（÷容量）</option>
              <option value="mul">倍乘（×容量）</option>
              <option value="fixed">固定</option>
            </Select>
          </div>
          {draft.mode !== 'fixed' && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-10 shrink-0 text-[10.5px] text-muted">来源</span>
                <Select
                  value={draft.source ?? 'front'}
                  onChange={(e) => setDraft({ ...draft, source: e.target.value })}
                  className="h-6 flex-1 text-[11px]"
                >
                  <option value="front">全部前端点位合计</option>
                  {deviceTypes.map((dt) => dt.product.id !== productId && <option key={dt.product.id} value={dt.product.id}>{dt.product.name}</option>)}
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <label className="flex items-center gap-1 text-[10.5px] text-muted">容量
                  <Input type="number" min={1} value={String(draft.capacity ?? 1)} onChange={(e) => setDraft({ ...draft, capacity: Number(e.target.value) })} className="h-6 text-[11px]" />
                </label>
                <label className="flex items-center gap-1 text-[10.5px] text-muted">系数
                  <Input type="number" step="0.01" value={String(draft.factor ?? 1)} onChange={(e) => setDraft({ ...draft, factor: Number(e.target.value) })} className="h-6 text-[11px]" />
                </label>
                <label className="flex items-center gap-1 text-[10.5px] text-muted">冗余
                  <Input type="number" min={0} value={String(draft.reserve ?? 0)} onChange={(e) => setDraft({ ...draft, reserve: Number(e.target.value) })} className="h-6 text-[11px]" />
                </label>
              </div>
            </>
          )}
          <div className="flex items-center gap-1.5">
            <Button size="xs" onClick={save}>保存</Button>
            <Button size="xs" variant="outline" onClick={() => setEditing(false)}>取消</Button>
            {chainJson && <Button size="xs" variant="ghost" className="ml-auto text-danger hover:bg-danger-soft" onClick={clear}>清除</Button>}
          </div>
        </div>
      )}
    </div>
  )
}

function parseChain(json: string): DeviceChain {
  try {
    const c = JSON.parse(json) as Partial<DeviceChain>
    return { mode: c.mode ?? 'carry', capacity: Math.max(1, Number(c.capacity) || 1), source: c.source, factor: c.factor ?? 1, reserve: Number(c.reserve) || 0, round: c.round ?? 'ceil' }
  } catch {
    return { mode: 'carry', capacity: 1, source: 'front', factor: 1, reserve: 0, round: 'ceil' }
  }
}

function chainText(c: DeviceChain, types: { product: { id: string; name: string } }[]): string {
  if (c.mode === 'fixed') return `固定 ${c.capacity}`
  const src = c.source === 'front'
    ? '前端点位合计'
    : (types.find((t) => t.product.id === c.source)?.product.name ?? '指定设备')
  const head = c.mode === 'mul' ? `${src} × ${c.capacity}` : `${src} ÷ ${c.capacity}`
  const factor = c.factor && c.factor !== 1 ? ` × ${c.factor}` : ''
  const round = c.round === 'floor' ? '（向下取整）' : ''
  return head + factor + round
}

export default ChainQuotaPanel