import { useState } from 'react'
import { Save, Trash2 } from 'lucide-react'
import type { Price } from '../../../types/domain'
import { DeviceService } from '../../../services'
import { Button } from '../../../components/ui/button'
import { Input, Select } from '../../../components/ui/field'
import { toast } from '../../../components/ui/toast'
import { fmtMoney, fmtNum } from '../../../lib/utils'
import { PRICE_TYPE_LABEL, PRICE_TYPES } from '../device-center.types'

/* ---------- R2：四类型价格编辑器 ---------- */
function PriceEditor({ modelId, prices, usageCount }: { modelId: string; prices: Price[]; usageCount: number }) {
  const [form, setForm] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    PRICE_TYPES.forEach((t) => {
      const p = prices.find((x) => x.price_type === t)
      init[t] = p ? String(p.price) : ''
      init[`${t}_date`] = p?.effective_date ? p.effective_date.slice(0, 10) : ''
    })
    return init
  })
  const suppliers = DeviceService.suppliers()
  const [supplierOf, setSupplierOf] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    PRICE_TYPES.forEach((t) => {
      const p = prices.find((x) => x.price_type === t)
      init[t] = p?.supplier_id ?? ''
    })
    return init
  })
  const refPrice = Number(form.reference) || 0

  const save = (t: (typeof PRICE_TYPES)[number]) => {
    const v = Number(form[t])
    if (v <= 0) {
      toast('价格须大于 0', 'warn')
      return
    }
    DeviceService.setPrice(modelId, t, v, {
      effective_date: form[`${t}_date`] || undefined,
      source: t === 'supplier' ? '供应商询价' : t === 'market' ? '市场参考' : '手动维护',
      supplier_id: supplierOf[t] || undefined,
    })
    // 「重新推导将使用新价」仅对参考价成立（引擎只取 reference）
    toast(
      t === 'reference'
        ? `已更新参考价 ¥${fmtNum(v)}` + (usageCount > 0 ? `；被 ${usageCount} 个系统选用，重新推导将使用新价，已生成清单为快照不受影响` : '')
        : `已更新${PRICE_TYPE_LABEL[t]} ¥${fmtNum(v)}（台账价，不影响推导与清单）`,
    )
  }

  return (
    <div className="space-y-1.5">
      <p className="font-mono text-[15px] font-bold text-ink">{refPrice > 0 ? fmtMoney(refPrice) : <span className="text-[12px] font-normal text-danger">当前无参考价</span>}</p>
      {PRICE_TYPES.map((t) => {
        const p = prices.find((x) => x.price_type === t)
        return (
          <div key={t} className="rounded-md border border-rule bg-surface-subtle/40 p-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-14 shrink-0 text-[11px] text-muted">{PRICE_TYPE_LABEL[t]}</span>
              <Input type="number" value={form[t]} onChange={(e) => setForm({ ...form, [t]: e.target.value })} placeholder="金额" className="h-6 flex-1 text-[12px]" />
              <Input type="date" value={form[`${t}_date`]} onChange={(e) => setForm({ ...form, [`${t}_date`]: e.target.value })} className="h-6 w-28 text-[11px]" />
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              {t === 'supplier' && (
                <Select value={supplierOf[t]} onChange={(e) => setSupplierOf({ ...supplierOf, [t]: e.target.value })} className="h-6 flex-1 text-[11px]">
                  <option value="">供应商…</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              )}
              {t !== 'supplier' && <span className="flex-1" />}
              <Button size="xs" variant="outline" onClick={() => save(t)}><Save className="size-3" />保存</Button>
              {p && (
                <button type="button" className="rounded p-1 text-faint hover:text-danger" title="删除该类型价格"
                  onClick={() => {
                    DeviceService.removePrice(p.id)
                    setForm((f) => ({ ...f, [t]: '', [`${t}_date`]: '' }))
                    setSupplierOf((s) => ({ ...s, [t]: '' }))
                    toast('已删除该类型价格', 'info')
                  }}>
                  <Trash2 className="size-3" />
                </button>
              )}
            </div>
          </div>
        )
      })}
      <p className="text-[10.5px] text-faint">参考价：推导选型采用；市场/供应商/项目价：台账管理。</p>
    </div>
  )
}

export default PriceEditor