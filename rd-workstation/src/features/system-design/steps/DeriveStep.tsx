import { RefreshCw, Zap } from 'lucide-react'
import { useDB } from '../../../db/memory-db'
import { T } from '../../../types/domain'
import { PointService, DesignService } from '../../../services'
import { Button } from '../../../components/ui/button'
import { Table, THead, TBody, TR, TH, TD, NumCell } from '../../../components/ui/table'
import { EmptyState } from '../../../components/ui/empty'
import { fmtNum } from '../../../lib/utils'
import { StepCard } from '../panels/StepCard'
import { RuleConditionBadge } from '../panels/RuleConditionBadge'

export function DeriveStep({ psId, results, onDerive }: { psId: string; results: ReturnType<typeof DesignService.results>; onDerive: () => void }) {
  const points = PointService.list(psId)
  const cats = PointService.categories('sys_vss')
  const catName = new Map(cats.map((c) => [c.id, c.name]))
  const byCat = new Map<string, number>()
  for (const p of points) {
    const key = p.category_id ? (catName.get(p.category_id) ?? '未分类') : '未分类'
    byCat.set(key, (byCat.get(key) ?? 0) + (p.quantity || 0))
  }
  // 规则启用条件（来自 rules 表，供展示）
  const rules = useDB.getState().getTable<{ id: string; code: string; condition_json?: string; formula_json: string }>(T.design_rules)

  return (
    <StepCard title="设计推导" desc="DesignEngine 按规则（公式快照）从点位推导设备数量">
      <div className="mb-3 flex justify-end"><Button size="sm" onClick={onDerive}><RefreshCw className="size-3.5" />重新推导</Button></div>

      {byCat.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[11.5px] text-muted">类别分布：</span>
          {[...byCat.entries()].map(([name, qty]) => (
            <span key={name} className="rounded-full bg-surface-subtle px-2.5 py-0.5 text-[12px] text-muted">
              {name} <b className="font-mono text-ink">{fmtNum(qty)}</b>
            </span>
          ))}
        </div>
      )}

      <div className="overflow-auto rounded-md border border-rule">
        <Table>
          <THead><TR><TH>结果</TH><TH>规则</TH><TH>公式</TH><TH>数量</TH><TH>单位</TH></TR></THead>
          <TBody>
            {results.map((r) => (
              <TR key={r.id} className="hover:bg-hover">
                <TD className="font-medium">{resultTypeName(r.result_type)}</TD>
                <TD>
                  <span className="font-mono text-[11.5px] text-accent">{r.rule_snapshot}</span>
                  <RuleConditionBadge ruleCode={r.rule_snapshot ?? ''} rules={rules} />
                </TD>
                <TD className="font-mono text-[12px] text-muted">{r.formula_snapshot}</TD>
                <TD><NumCell className="text-[14px] font-bold">{fmtNum(r.quantity)}</NumCell></TD>
                <TD className="text-muted">{r.unit}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
        {!results.length && <EmptyState icon={<Zap />} title="还没有推导结果" action={<Button size="sm" onClick={onDerive}><RefreshCw className="size-3.5" />立即推导</Button>} />}
      </div>
      <p className="mt-2 text-[11.5px] text-faint">
        规则按优先级级联执行（POE→聚合、NVR、硬盘）；条件规则仅当变量满足时生成结果。
      </p>
    </StepCard>
  )
}

function resultTypeName(t: string) {
  return { camera: '摄像机', poe_switch: 'POE 交换机', nvr: 'NVR', hdd: '硬盘', aggregation: '汇聚交换机', mount: '支架', cable: '线缆' }[t] ?? t
}