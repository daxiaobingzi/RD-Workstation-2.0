import { Sparkles } from 'lucide-react'
import { DesignService } from '../../../services'
import { DEFAULT_RULES } from '../../../engines/default-rules'

export function AIPanel({ checks, onGoto }: { checks: ReturnType<typeof DesignService.check>; onGoto: (s: string) => void }) {
  const warnCount = checks.filter((c) => c.severity !== 'ok').length
  // P3：设计参数步骤已取消，引用引擎兜底默认值
  const bit = DEFAULT_RULES.bitrateMbps
  const days = DEFAULT_RULES.storageDays
  const cameras = DesignService.selections('ps_vss_001').length
  void cameras
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-rule bg-surface-subtle p-3">
        <p className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold text-ink"><Sparkles className="size-3.5 text-accent" />今日建议</p>
        <ul className="space-y-1.5 text-[12px] text-muted">
          <li>• 当前码流 {bit}Mbps / 存储 {days} 天，可校核容量。</li>
          <li>• 缺价与校验共 {warnCount} 项，建议到「校核」处理。</li>
        </ul>
        <button type="button" className="mt-2 text-[12px] font-medium text-accent hover:underline" onClick={() => onGoto('validate')}>去校核 →</button>
      </div>
      <p className="text-[11px] text-faint">AI 建议经 Domain Service 落库，不直接写库。</p>
    </div>
  )
}