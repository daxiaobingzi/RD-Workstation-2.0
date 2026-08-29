import { Package, RefreshCw } from 'lucide-react'
import { useDB } from '../../../db/memory-db'
import { T } from '../../../types/domain'
import { DesignService, DeviceService } from '../../../services'
import { Button } from '../../../components/ui/button'
import { Table, THead, TBody, TR, TH, TD, NumCell } from '../../../components/ui/table'
import { EmptyState } from '../../../components/ui/empty'
import { fmtNum } from '../../../lib/utils'
import { StepCard } from '../panels/StepCard'

const CAT_LABEL: Record<string, string> = { cable: '线缆', conduit: '管材', aux: '辅材', other_material: '其他材料' }
const CAT_ICON: Record<string, string> = { cable: 'text-accent', conduit: 'text-accent2', aux: 'text-warn', other_material: 'text-faint' }

/** 工程量步骤（P4）：材料类推导结果的汇总视图（∑点位 × 单点定额），供清单/预算引用 */
export function QuantityStep({ psId: _psId, results, onDerive }: { psId: string; results: ReturnType<typeof DesignService.results>; onDerive: () => void }) {
  const materials = results.filter((r) => (r.source_type === 'quota') || ['cable', 'conduit', 'aux', 'other_material'].includes(r.result_type))
  const totalByCat = (cat: string) => materials.filter((m) => m.result_type === cat).reduce((s, m) => s + (m.quantity || 0), 0)
  const missingQuota = DeviceService.materialBOM(
    useDB.getState().getTable<{ device_id?: string }>(T.points).filter((p) => p.device_id).map((p) => p.device_id ?? ''),
  ).length === 0 && materials.length === 0

  return (
    <StepCard title="工程量（材料汇总）" desc="由「设备单点定额材料」推导：∑点位台数 × 每点定额，生成线缆 / 管材 / 辅材工程量">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {Object.keys(CAT_LABEL).map((cat) => (
            <span key={cat} className="flex items-center gap-1.5 rounded-full bg-surface-subtle px-2.5 py-1 text-[12px] text-muted">
              <span className={`size-1.5 rounded-full ${CAT_ICON[cat]}`} />
              {CAT_LABEL[cat]} <b className="font-mono text-ink">{fmtNum(totalByCat(cat))}</b>
            </span>
          ))}
        </div>
        <Button size="sm" onClick={onDerive}><RefreshCw className="size-3.5" />重新推导</Button>
      </div>

      {materials.length ? (
        <div className="overflow-auto rounded-md border border-rule">
          <Table>
            <THead><TR><TH>类别</TH><TH>材料名称</TH><TH>推导口径</TH><TH>数量</TH><TH>单位</TH></TR></THead>
            <TBody>
              {materials.map((r) => (
                <TR key={r.id} className="hover:bg-hover">
                  <TD><span className={`flex items-center gap-1.5 text-[12px] ${CAT_ICON[r.result_type] ?? ''}`}><Package className="size-3.5" />{CAT_LABEL[r.result_type] ?? r.result_type}</span></TD>
                  <TD className="font-medium">{(r.rule_snapshot ?? '').replace('定额-', '') || r.result_type}</TD>
                  <TD className="font-mono text-[11.5px] text-muted">{r.formula_snapshot}</TD>
                  <TD><NumCell className="text-[14px] font-bold">{fmtNum(r.quantity)}</NumCell></TD>
                  <TD className="text-muted">{r.unit}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          icon={<Package />}
          title="暂无材料工程量"
          description="去「设备中心」为前端/后端设备配置单点定额材料，再执行推导"
          action={missingQuota ? undefined : <Button size="sm" onClick={onDerive}><RefreshCw className="size-3.5" />立即推导</Button>}
        />
      )}
      <p className="mt-2 text-[11.5px] text-faint">
        材料来源：设备中心的「单点定额材料」字段。不同前端/后端设备可配置各自的线缆、管材、辅材配比，推导时自动按点位台数放大。
      </p>
    </StepCard>
  )
}