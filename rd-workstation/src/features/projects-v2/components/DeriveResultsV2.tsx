import { useMemo, useState } from 'react'
import { Sigma, Play, BookMarked, Plus, AlertTriangle } from 'lucide-react'
import { useDB } from '../../../db/memory-db'
import { ProjectService, PointService, DesignService } from '../../../services'
import { Button } from '../../../components/ui/button'
import { toast } from '../../../components/ui/toast'
import { fmtNum, cn } from '../../../lib/utils'
import { RuleEditorModal } from './RuleEditorModal'

/** 模块⑤ 推导 + 推导规则：一键推导本项目全部子系统，展示公式快照与可自定义生效规则 */
export function DeriveResultsV2({ projectId }: { projectId: string }) {
  useDB((s) => s.db)
  const [deriving, setDeriving] = useState(false)
  const [rulePs, setRulePs] = useState<{ psId: string; systemId?: string; name: string } | null>(null)
  const systems = useMemo(() => ProjectService.systems(projectId), [projectId, useDB.getState().db])

  const runDeriveAll = () => {
    if (!systems.length) { toast('请先添加子系统', 'warn'); return }
    setDeriving(true)
    // 模拟异步，给 UI 反馈；实际为同步遍历（数据量小）
    setTimeout(() => {
      let n = 0
      let items = 0
      for (const ps of systems) {
        const { results } = DesignService.derive(ps.id)
        n += 1
        items += results.length
      }
      toast(`已推导 ${n} 个系统，生成 ${items} 条设备/材料数量结果`)
      setDeriving(false)
    }, 120)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-rule bg-surface px-4 py-3">
        <Sigma className="size-4 text-accent" />
        <div className="flex-1">
          <p className="text-[13px] font-semibold">推导 + 推导规则</p>
          <p className="text-[11.5px] text-faint">按规则（公式快照）从点位推导设备数量：设备中心设备 + 数量逻辑 + 单点定额材料</p>
        </div>
        <Button onClick={runDeriveAll} disabled={deriving}><Play className="size-4" />{deriving ? '推导中…' : '执行推导（本项目全部系统）'}</Button>
      </div>

      {systems.map((ps) => {
        const results = DesignService.results(ps.id)
        const points = PointService.list(ps.id)
        const selections = DesignService.selections(ps.id)
        const rules = DesignService.rules(ps.id)
        const quota = results.filter((r) => r.source_type === 'quota')
        return (
          <section key={ps.id} className="overflow-hidden rounded-lg border border-rule bg-surface">
            <div className="flex items-center gap-2 border-b border-rule bg-surface-subtle/50 px-3.5 py-2">
              <span className="font-mono text-[10.5px] text-faint">{ps.systemCode}</span>
              <span className="text-[13px] font-semibold">{ps.systemName}</span>
              <span className="ml-auto flex items-center gap-3 font-mono text-[11px] text-faint">
                <span>点位 {points.length} 行</span>
                <span>结果 {results.length} 条</span>
                <span>选型 {selections.length} 类</span>
              </span>
            </div>
            <div className="grid grid-cols-1 gap-0 lg:grid-cols-5">
              {/* 推导结果 */}
              <div className="lg:col-span-3">
                <Table title="推导结果（设备数量 · 公式快照）" head={['类别', '项', '数量', '公式快照']}>
                  {results.slice(0, 18).map((r, i) => (
                    <tr key={i} className="border-t border-rule/60 text-[12px]">
                      <td className="px-2.5 py-1.5">
                        <span className={cn('rounded-full px-1.5 text-[10px] font-semibold', r.source_type === 'quota' ? 'bg-ok-soft/60 text-ok' : 'bg-accent-soft text-accent')}>
                          {r.source_type === 'quota' ? '定额材料' : '设备'}
                        </span>
                      </td>
                      <td className="px-2.5 py-1.5 font-medium">{r.result_type.replace(/-/g, ' ')}</td>
                      <td className="px-2.5 py-1.5 text-right font-mono">{fmtNum(r.quantity)} {r.unit ?? ''}</td>
                      <td className="max-w-[280px] truncate px-2.5 py-1.5 font-mono text-[11px] text-muted" title={r.formula_snapshot}>{r.formula_snapshot || '—'}</td>
                    </tr>
                  ))}
                  {!results.length && <tr><td colSpan={4} className="px-3 py-5 text-center text-[12px] text-faint">尚未推导。点击顶部「执行推导」生成设备与定额材料数量。</td></tr>}
                </Table>
              </div>
              {/* 生效规则 + 已经生效选型 */}
              <div className="border-t border-rule lg:col-span-2 lg:border-t-0 lg:border-l">
                <div className="p-3">
                  <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase">
                    <BookMarked className="size-3.5" /><span>生效规则（按优先级）</span>
                    <button type="button" onClick={() => setRulePs({ psId: ps.id, systemId: ps.system_id, name: ps.systemName })} className="ml-auto flex items-center gap-0.5 rounded border border-accent/40 px-1.5 py-px text-[10px] font-semibold text-accent normal-case hover:bg-accent-soft">
                      <Plus className="size-3" />自定义规则
                    </button>
                  </div>
                  <ol className="space-y-1.5">
                    {rules.slice(0, 8).map((r) => (
                      <li key={r.id} className="flex gap-2 text-[12px]">
                        <span className="font-mono text-faint">{r.priority ?? 10}.</span>
                        <span className="flex-1">
                          <span className="text-ink">{r.name}</span>
                          <span className="block truncate font-mono text-[11px] text-muted" title={r.formula_json}>{r.formula_json}</span>
                        </span>
                      </li>
                    ))}
                    {!rules.length && <li className="text-[12px] text-faint">暂无规则（点「自定义规则」为本系统设备定义推导公式；缺省按点位合计与设备链推导）</li>}
                  </ol>
                </div>
                <div className="border-t border-rule p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase"><AlertTriangle className="size-3.5" />定额材料</p>
                  <p className="text-[12px] text-muted">{quota.length ? `${quota.length} 条（线缆/管材/辅材，随推导自动生成）` : '无定额材料'}</p>
                </div>
              </div>
            </div>
          </section>
        )
      })}
      {!systems.length && <div className="rounded-lg border border-rule bg-surface p-10 text-center text-[12.5px] text-faint">还没有子系统，无法推导。</div>}

      {/* 规则编辑器 */}
      {rulePs && (
        <RuleEditorModal
          systemId={rulePs.systemId}
          systemName={rulePs.name}
          open
          onClose={() => setRulePs(null)}
        />
      )}
    </div>
  )
}

function Table({ title, head, children }: { title: string; head: string[]; children: React.ReactNode }) {
  return (
    <div className="p-3">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase">{title}</p>
      <div className="overflow-auto rounded-md border border-rule">
        <table className="w-full border-collapse">
          <thead><tr className="bg-surface-subtle text-left text-[10.5px] text-faint">
            {head.map((h) => <th key={h} className="px-2.5 py-1.5 font-medium">{h}</th>)}
          </tr></thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  )
}