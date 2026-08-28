import { DeviceService } from '../../../services'
import { Modal } from '../../../components/ui/dialog'
import { fmtMoney } from '../../../lib/utils'
import { cn } from '../../../lib/utils'

/* ---------- R3：价格影响分析 ---------- */
function PriceImpactModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  const impact = DeviceService.priceImpact()
  const totalDiff = impact.reduce((s, r) => s + r.diff, 0)
  return (
    <Modal open={open} onClose={onClose} title="价格影响分析（最新参考价 vs 项目快照）" width={640}>
      <p className="-mt-1 mb-2 text-[12px] text-muted">
        按设备库当前参考价重算已选型系统的金额，与生成时的价格快照对比。差额为正表示按新价将上涨。此分析不写库。
      </p>
      <ul className="space-y-1.5">
        {impact.map((r) => (
          <li key={r.psId} className="flex items-center justify-between rounded-md border border-rule px-3 py-2 text-[12.5px]">
            <span>
              <b>{r.systemName}</b>
              <span className="ml-1.5 text-[11px] text-muted">{r.projectName}</span>
            </span>
            <span className="font-mono text-[12px]">
              <span className="text-muted">{fmtMoney(r.oldTotal)}</span>
              <span className="mx-1 text-faint">→</span>
              <span className="font-semibold">{fmtMoney(r.newTotal)}</span>
              <span className={cn('ml-2 font-bold', r.diff > 0 ? 'text-danger' : 'text-ok')}>
                {r.diff > 0 ? '+' : ''}{fmtMoney(r.diff)}
              </span>
            </span>
          </li>
        ))}
        {!impact.length && <li className="rounded-md border border-rule px-3 py-4 text-center text-[12px] text-faint">当前设备库价格与项目快照一致（或暂无选型数据）</li>}
      </ul>
      {impact.length > 0 && (
        <div className="mt-3 flex justify-end gap-2 border-t border-rule pt-2.5 text-[13px]">
          <span className="text-muted">影响合计：</span>
          <span className={cn('font-mono font-bold', totalDiff > 0 ? 'text-danger' : 'text-ok')}>{totalDiff > 0 ? '+' : ''}{fmtMoney(totalDiff)}</span>
        </div>
      )}
    </Modal>
  )
}

export default PriceImpactModal