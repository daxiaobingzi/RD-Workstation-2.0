import { RefreshCw, Zap } from 'lucide-react'
import { DesignService } from '../../../services'
import { Button } from '../../../components/ui/button'
import { Table, THead, TBody, TR, TH, TD, NumCell } from '../../../components/ui/table'
import { EmptyState } from '../../../components/ui/empty'
import { fmtMoney, fmtNum, cn } from '../../../lib/utils'
import { StepCard } from '../panels/StepCard'

export function DevicesStep({ selections, onDerive }: { selections: ReturnType<typeof DesignService.selections>; onDerive: () => void }) {
  return (
    <StepCard title="设备选型" desc="按当前档次自动选型，价格取参考价快照">
      <div className="mb-3 flex justify-end"><Button size="sm" onClick={onDerive}><RefreshCw className="size-3.5" />重新推导</Button></div>
      <div className="overflow-auto rounded-md border border-rule">
        <Table>
          <THead><TR><TH>设备</TH><TH>规格</TH><TH>品牌</TH><TH>数量</TH><TH>单位</TH><TH>单价</TH><TH>金额</TH></TR></THead>
          <TBody>
            {selections.map((s) => (
              <TR key={s.id} className="hover:bg-hover">
                <TD className="font-medium">{s.modelName ?? s.model_id}</TD>
                <TD className="max-w-[220px] truncate text-muted">{s.spec}</TD>
                <TD className="text-muted">{s.brand ?? '—'}</TD>
                <TD><NumCell>{fmtNum(s.quantity)}</NumCell></TD>
                <TD className="text-muted">{s.unit}</TD>
                <TD className={cn('font-mono text-[12px]', !s.unit_price ? 'font-bold text-danger' : 'text-muted')}>{fmtMoney(s.unit_price)}</TD>
                <TD className="font-mono text-[12.5px] font-semibold">{fmtMoney(s.total_price)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
        {!selections.length && <EmptyState icon={<Zap />} title="尚未推导设备" description="点击「重新推导」，按设计规则自动生成设备选型" action={<Button size="sm" onClick={onDerive}><RefreshCw className="size-3.5" />立即推导</Button>} />}
      </div>
      <p className="mt-2 text-[11.5px] text-faint">提示：项目选型价为快照，不随设备库价格变动。</p>
    </StepCard>
  )
}