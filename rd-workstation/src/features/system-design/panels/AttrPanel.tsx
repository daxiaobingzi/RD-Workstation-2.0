import { SystemService, DesignService } from '../../../services'
import { fmtNum } from '../../../lib/utils'

export function AttrPanel({ params, selections }: { params: ReturnType<typeof SystemService.params>; selections: ReturnType<typeof DesignService.selections> }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-[10.5px] font-semibold tracking-wide text-faint uppercase">设计参数</p>
        <dl className="space-y-1.5">
          {params.map((p) => (
            <div key={p.id} className="flex justify-between text-[12.5px]">
              <dt className="text-muted">{p.parameter_name}</dt>
              <dd className="font-mono font-medium">{String(p.value_json)}{p.unit ? ` ${p.unit}` : ''}</dd>
            </div>
          ))}
          {!params.length && <p className="text-[12px] text-faint">尚未设置参数</p>}
        </dl>
      </div>
      <div className="border-t border-rule pt-3">
        <p className="mb-1.5 text-[10.5px] font-semibold tracking-wide text-faint uppercase">设备选型（{selections.length}）</p>
        <ul className="space-y-1.5">
          {selections.map((s) => (
            <li key={s.id} className="text-[12px] text-muted">
              <span className="text-ink">{s.modelName}</span> × {fmtNum(s.quantity)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}