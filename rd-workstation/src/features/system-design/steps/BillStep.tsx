import { useEffect, useMemo, useState } from 'react'
import { Zap } from 'lucide-react'
import { BillService } from '../../../services'
import type { BillItem } from '../../../types/domain'
import { Button } from '../../../components/ui/button'
import { EmptyState } from '../../../components/ui/empty'
import { SortableTable, type SortableColumn } from '../../../components/ui/sortable-table'
import { fmtMoney, fmtNum } from '../../../lib/utils'
import { StepCard } from '../panels/StepCard'

export function BillStep({ billItems, version, onGenerate }: { billItems: ReturnType<typeof BillService.items>; version?: { version_no: string; name?: string } | null; onGenerate: () => void }) {
  const total = billItems.reduce((s, i) => s + i.amount, 0)
  const totalQty = billItems.reduce((s, i) => s + i.quantity, 0)

  // 行拖拽排序：sort_order 持久化（刷新保持）
  const [rows, setRows] = useState<BillItem[]>(billItems)
  useEffect(() => { setRows(billItems) }, [billItems])
  const reorder = (from: number, to: number) => {
    if (from === to) return
    const next = [...rows]
    const [mv] = next.splice(from, 1)
    next.splice(to, 0, mv)
    setRows(next)
    next.forEach((i, idx) => { if (i.sort_order !== idx) BillService.updateItem(i.id, { sort_order: idx }) })
  }

  const columns = useMemo<SortableColumn<BillItem>[]>(() => [
    { key: 'item_code', title: '编码', width: 110, render: (i) => <span className="font-mono text-[12px] text-accent">{i.item_code}</span> },
    { key: 'item_name', title: '名称', width: 260, minWidth: 180, render: (i) => <span className="text-[13px] font-medium">{i.item_name}</span> },
    { key: 'specification', title: '规格', width: 280, minWidth: 160, render: (i) => <span className="block max-w-full truncate text-muted" title={i.specification ?? ''}>{i.specification ?? '—'}</span> },
    { key: 'quantity', title: '数量', width: 96, align: 'right', render: (i) => <span className="font-mono text-[12px]">{fmtNum(i.quantity)}</span> },
    { key: 'unit_price', title: '单价', width: 110, align: 'right', render: (i) => <span className="font-mono text-[12px] text-muted">{fmtMoney(i.unit_price)}</span> },
    { key: 'amount', title: '金额', width: 120, align: 'right', render: (i) => <span className="font-mono text-[13px] font-semibold">{fmtMoney(i.amount)}</span> },
  ], [])

  return (
    <StepCard title="清单" desc={version ? `当前版本 ${version.version_no}（${version.name}）` : '由设备选型生成，支持版本化'}>
      <div className="mb-3 flex justify-end"><Button size="sm" onClick={onGenerate}><Zap className="size-3.5" />生成清单版本</Button></div>
      <div className="overflow-hidden rounded-md border border-rule">
        {billItems.length ? (
          <>
            <div className="max-h-[420px] overflow-auto">
              <SortableTable<BillItem>
                columns={columns}
                rows={rows}
                rowKey={(i) => i.id}
                storageKey="bill-step"
                onReorder={reorder}
                empty={<EmptyState icon={<Zap />} title="清单为空" description="先生成设备推导，再生成清单" action={<Button size="sm" onClick={onGenerate}><Zap className="size-3.5" />生成清单</Button>} />}
              />
            </div>
            <div className="flex items-center justify-between border-t border-rule px-3 py-1.5 font-mono text-[11px] text-faint">
              <span>共 {billItems.length} 项</span>
              <span>合计数量 {fmtNum(totalQty)} · 合计金额 <b className="text-ink">{fmtMoney(total)}</b></span>
            </div>
          </>
        ) : (
          <EmptyState icon={<Zap />} title="清单为空" description="先生成设备推导，再生成清单" action={<Button size="sm" onClick={onGenerate}><Zap className="size-3.5" />生成清单</Button>} />
        )}
      </div>
    </StepCard>
  )
}