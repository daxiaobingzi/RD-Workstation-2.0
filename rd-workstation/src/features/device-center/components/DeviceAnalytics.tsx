import { BarChart3, PieChart, Flame } from 'lucide-react'
import { useDB } from '../../../db/memory-db'
import { T } from '../../../types/domain'
import { DeviceService } from '../../../services'
import { fmtMoney, fmtNum, cn } from '../../../lib/utils'

const BUCKETS = [
  { label: '< ¥500', min: 0, max: 500 },
  { label: '¥500~1k', min: 500, max: 1000 },
  { label: '¥1k~3k', min: 1000, max: 3000 },
  { label: '¥3k~1w', min: 3000, max: 10000 },
  { label: '≥ ¥1w', min: 10000, max: Infinity },
]

/** 设备数据中台：价格分布 / 品牌份额 / 使用热度 Top */
export function DeviceAnalytics() {
  useDB((s) => s.db)
  const db = useDB.getState().db
  const models = (db[T.product_models] ?? []) as unknown as { id: string; model: string; status?: string }[]
  const active = models.filter((m) => m.status !== 'disabled')

  // 价格分布
  const priceDist = BUCKETS.map((b) => ({
    ...b,
    count: active.filter((m) => { const p = DeviceService.price(m.id); return p >= b.min && p < b.max }).length,
  }))
  const distMax = Math.max(...priceDist.map((b) => b.count), 1)

  // 品牌份额（型号数）
  const brandShare = (() => {
    const agg = new Map<string, number>()
    for (const m of active) {
      const name = DeviceService.brandOf(m.id).name ?? '未指定品牌'
      agg.set(name, (agg.get(name) ?? 0) + 1)
    }
    return [...agg.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 6)
  })()
  const brandMax = Math.max(...brandShare.map((b) => b.count), 1)

  // 使用热度 Top（跨项目 device_selections 真实聚合）
  const topUsage = (() => {
    const agg = new Map<string, number>()
    for (const s of (db[T.device_selections] ?? []) as unknown as { model_id: string; quantity: number }[]) {
      agg.set(s.model_id, (agg.get(s.model_id) ?? 0) + (s.quantity || 0))
    }
    const nameOf = new Map(models.map((m) => [m.id, m.model]))
    const priceOf = (id: string) => DeviceService.price(id)
    return [...agg.entries()]
      .map(([id, qty]) => ({ id, qty, name: nameOf.get(id) ?? id, amount: qty * priceOf(id) }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 6)
  })()
  const usageMax = Math.max(...topUsage.map((u) => u.qty), 1)

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <section className="rounded-lg border border-rule bg-surface shadow-sm">
        <div className="flex items-center gap-2 border-b border-rule px-3.5 py-2.5">
          <BarChart3 className="size-4 text-accent" />
          <h3 className="text-[13px] font-semibold">价格分布（在售型号）</h3>
          <span className="ml-auto font-mono text-[10.5px] text-faint">{active.length}</span>
        </div>
        <div className="space-y-1.5 px-3.5 py-3">
          {priceDist.map((b) => (
            <div key={b.label} className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-[11px] text-muted">{b.label}</span>
              <div className="h-4 flex-1 overflow-hidden rounded-[4px] bg-rule/40">
                <div className="h-full rounded-[4px] bg-gradient-to-r from-accent to-accent2" style={{ width: `${(b.count / distMax) * 100}%` }} />
              </div>
              <span className="w-8 shrink-0 text-right font-mono text-[11px] text-muted">{b.count}</span>
            </div>
          ))}
          {!active.length && <p className="text-[11.5px] text-faint">暂无在售型号</p>}
        </div>
      </section>

      <section className="rounded-lg border border-rule bg-surface shadow-sm">
        <div className="flex items-center gap-2 border-b border-rule px-3.5 py-2.5">
          <PieChart className="size-4 text-accent2" />
          <h3 className="text-[13px] font-semibold">品牌份额（型号数）</h3>
        </div>
        <div className="space-y-1.5 px-3.5 py-3">
          {brandShare.map((b) => (
            <div key={b.name} className="flex items-center gap-2">
              <span className="w-20 shrink-0 truncate text-[11px] text-muted">{b.name}</span>
              <div className="h-4 flex-1 overflow-hidden rounded-[4px] bg-rule/40">
                <div className="h-full rounded-[4px] bg-accent2" style={{ width: `${(b.count / brandMax) * 100}%` }} />
              </div>
              <span className="w-8 shrink-0 text-right font-mono text-[11px] text-muted">{b.count}</span>
            </div>
          ))}
          {!brandShare.length && <p className="text-[11.5px] text-faint">暂无型号</p>}
        </div>
      </section>

      <section className="rounded-lg border border-rule bg-surface shadow-sm">
        <div className="flex items-center gap-2 border-b border-rule px-3.5 py-2.5">
          <Flame className="size-4 text-danger" />
          <h3 className="text-[13px] font-semibold">使用热度 Top（跨项目选型量）</h3>
        </div>
        <div className="space-y-1.5 px-3.5 py-3">
          {topUsage.map((u) => (
            <div key={u.id} className="flex items-center gap-2">
              <span className="w-24 shrink-0 truncate text-[11px] text-muted" title={u.name}>{u.name}</span>
              <div className="h-4 flex-1 overflow-hidden rounded-[4px] bg-rule/40">
                <div className={cn('h-full rounded-[4px]', u.qty === usageMax ? 'bg-danger' : 'bg-warn')} style={{ width: `${(u.qty / usageMax) * 100}%` }} />
              </div>
              <span className="w-16 shrink-0 text-right font-mono text-[11px] text-muted">{fmtNum(u.qty)} · {fmtMoney(u.amount)}</span>
            </div>
          ))}
          {!topUsage.length && <p className="text-[11.5px] text-faint">项目选型后展示热度</p>}
        </div>
      </section>
    </div>
  )
}