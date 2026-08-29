import { useState } from 'react'
import { DeviceService } from '../../../services'
import { Button } from '../../../components/ui/button'
import { Input, Select } from '../../../components/ui/field'
import { Modal } from '../../../components/ui/dialog'
import { toast } from '../../../components/ui/toast'

/* ---------- 价格治理（对齐 Vue PriceGovern）：缺价体检 / 按品牌批量调价(+取整) / 品牌替换 ---------- */
function PriceGovernModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<'audit' | 'adjust' | 'replace'>('audit')
  const brands = DeviceService.brands()
  const audit = tab === 'audit' ? DeviceService.brandAudit() : []
  const [adjBrand, setAdjBrand] = useState('')
  const [adjPct, setAdjPct] = useState(10)
  const [adjRound, setAdjRound] = useState(10)
  const [repOld, setRepOld] = useState('')
  const [repNew, setRepNew] = useState('')

  const doAdjust = () => {
    if (!adjBrand) { toast('请选择目标品牌', 'warn'); return }
    if (!adjPct) { toast('请输入调价百分比', 'warn'); return }
    const r = DeviceService.bulkAdjustPriceByBrand(adjBrand, Number(adjPct), Number(adjRound) || 0)
    toast(`已调整「${brands.find((b) => b.id === adjBrand)?.name}」：${r.adjusted} 个型号${r.skipped ? `，${r.skipped} 个缺价跳过` : ''}（涉及系统的设计需重新推导）`, 'success')
  }
  const doReplace = () => {
    if (!repOld || !repNew) { toast('请选择原品牌与新品牌', 'warn'); return }
    if (repOld === repNew) { toast('新旧品牌不能相同', 'warn'); return }
    const r = DeviceService.replaceBrand(repOld, repNew)
    toast(`已替换：${r.moved} 个型号由「${brands.find((b) => b.id === repOld)?.name}」改为「${brands.find((b) => b.id === repNew)?.name}」`, 'success')
  }

  return (
    <Modal open={open} onClose={onClose} title="价格治理 · 全库" width={720}>
      <div className="mb-3 flex gap-1.5">
        {([['audit', '缺价体检'], ['adjust', '按品牌批量调价'], ['replace', '品牌替换']] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${tab === key ? 'bg-accent text-white' : 'bg-surface-subtle text-muted hover:bg-hover'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'audit' && (
        <div>
          <p className="mb-2 text-[12px] text-muted">扫描全部设备类型的配置行，找出「未挂品牌 / 缺参考价」的型号，是报价前必做的一步。</p>
          {audit.length ? (
            <div className="max-h-[46vh] overflow-y-auto rounded-md border border-rule">
              <table className="w-full">
                <thead><tr className="border-b border-rule text-left text-[10.5px] text-faint">
                  <th className="px-2 py-1.5 font-medium">设备类型</th><th className="px-2 py-1.5 font-medium">品牌 / 型号</th><th className="px-2 py-1.5 font-medium">参考价</th><th className="px-2 py-1.5 text-right font-medium">问题</th>
                </tr></thead>
                <tbody>
                  {audit.map((r) => (
                    <tr key={r.modelId} className="border-b border-rule/40 text-[12px]">
                      <td className="px-2 py-1.5"><b>{r.deviceTypeName}</b></td>
                      <td className="px-2 py-1.5 text-muted">{r.brandName || '—'} {r.model}</td>
                      <td className="px-2 py-1.5 font-mono">{r.unitPrice > 0 ? `¥${r.unitPrice}` : '—'}</td>
                      <td className="px-2 py-1.5 text-right"><span className="rounded-full bg-danger-soft px-2 py-0.5 text-[11px] text-danger">{r.issue}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-md bg-ok-soft/40 px-3 py-6 text-center text-[12.5px] text-ok">所有配置行均已挂品牌且有参考价。</p>
          )}
        </div>
      )}

      {tab === 'adjust' && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <Select value={adjBrand} onChange={(e) => setAdjBrand(e.target.value)} className="h-8 text-[12px]">
              <option value="" disabled>选择品牌</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
            <Input type="number" value={String(adjPct)} onChange={(e) => setAdjPct(Number(e.target.value))} placeholder="调整百分比（如 10 = +10%）" className="h-8 text-[12px]" />
            <Select value={String(adjRound)} onChange={(e) => setAdjRound(Number(e.target.value))} className="h-8 text-[12px]">
              <option value="0">不取整</option>
              <option value="10">取整到 10 元</option>
              <option value="50">取整到 50 元</option>
              <option value="100">取整到 100 元</option>
            </Select>
          </div>
          <p className="text-[11.5px] text-faint">示例：某品牌全线涨价 8% → 选品牌、输入 8、取整到 10 → 该品牌所有型号参考价统一调整（覆写参考价，项目选型按新价重新推导生效）。</p>
          <div className="flex justify-end">
            <Button size="sm" onClick={doAdjust}>执行批量调价</Button>
          </div>
        </div>
      )}

      {tab === 'replace' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Select value={repOld} onChange={(e) => setRepOld(e.target.value)} className="h-8 text-[12px]">
              <option value="" disabled>原品牌（停产/弃用）</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
            <Select value={repNew} onChange={(e) => setRepNew(e.target.value)} className="h-8 text-[12px]">
              <option value="" disabled>新品牌（替换为）</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </div>
          <p className="text-[11.5px] text-faint">品牌停产/换主供时使用：原品牌下所有型号整体改绑到新品牌，参考价保持不变；可在替换后再用「按品牌批量调价」统一调整。</p>
          <div className="flex justify-end">
            <Button size="sm" onClick={doReplace}>执行替换</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default PriceGovernModal