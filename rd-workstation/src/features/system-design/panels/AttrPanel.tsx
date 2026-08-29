import { DesignService } from '../../../services'
import { fmtNum } from '../../../lib/utils'

export function AttrPanel({ selections }: { selections: ReturnType<typeof DesignService.selections> }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-[10.5px] font-semibold tracking-wide text-faint uppercase">设备选型（{selections.length}）</p>
        <ul className="space-y-1.5">
          {selections.map((s) => (
            <li key={s.id} className="text-[12px] text-muted">
              <span className="text-ink">{s.modelName}</span> × {fmtNum(s.quantity)}
            </li>
          ))}
          {!selections.length && <p className="text-[12px] text-faint">先完成点位并执行推导</p>}
        </ul>
      </div>
    </div>
  )
}