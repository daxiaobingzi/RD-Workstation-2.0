import { Zap } from 'lucide-react'
import { BillService } from '../../../services'
import { Button } from '../../../components/ui/button'
import { Table, THead, TBody, TR, TH, TD, NumCell } from '../../../components/ui/table'
import { EmptyState } from '../../../components/ui/empty'
import { fmtMoney, fmtNum } from '../../../lib/utils'
import { StepCard } from '../panels/StepCard'

export function BillStep({ billItems, version, onGenerate }: { billItems: ReturnType<typeof BillService.items>; version?: { version_no: string; name?: string } | null; onGenerate: () => void }) {
  const total = billItems.reduce((s, i) => s + i.amount, 0)
  return (
    <StepCard title="清单" desc={version ? `当前版本 ${version.version_no}（${version.name}）` : '由设备选型生成，支持版本化'}>
      <div className="mb-3 flex justify-end"><Button size="sm" onClick={onGenerate}><Zap className="size-3.5" />生成清单版本</Button></div>
      <div className="overflow-auto rounded-md border border-rule">
        <Table>
          <THead><TR><TH>编码</TH><TH>名称</TH><TH>规格</TH><TH>数量</TH><TH>单价</TH><TH>金额</TH></TR></THead>
          <TBody>
            {billItems.map((i) => (
              <TR key={i.id} className="hover:bg-hover">
                <TD><NumCell>{i.item_code}</NumCell></TD>
                <TD className="font-medium">{i.item_name}</TD>
                <TD className="max-w-[220px] truncate text-muted">{i.specification}</TD>
                <TD><NumCell>{fmtNum(i.quantity)}</NumCell></TD>
                <TD className="font-mono text-[12px] text-muted">{fmtMoney(i.unit_price)}</TD>
                <TD className="font-mono text-[12.5px] font-semibold">{fmtMoney(i.amount)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
        {!billItems.length && <EmptyState icon={<Zap />} title="清单为空" description="先生成设备推导，再生成清单" action={<Button size="sm" onClick={onGenerate}><Zap className="size-3.5" />生成清单</Button>} />}
      </div>
      {billItems.length > 0 && <div className="mt-2 flex justify-end text-[13px]"><span className="text-muted">合计：</span><span className="ml-2 font-mono font-bold">{fmtMoney(total)}</span></div>}
    </StepCard>
  )
}