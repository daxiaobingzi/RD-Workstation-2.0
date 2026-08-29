import { useMemo } from 'react'
import { Boxes } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { ProjectService, DesignService } from '../../../../services'
import { DataTable, type DataColumn } from '../../../../components/ui/data-table'
import { Table, NumCell } from '../../../../components/ui/table'
import { EmptyState } from '../../../../components/ui/empty'
import { fmtMoney, fmtNum } from '../../../../lib/utils'

interface DeviceRow {
  id: string
  sysName: string
  brand?: string
  modelName?: string
  spec?: string
  quantity: number
  unit_price?: number
  total_price?: number
}

/** 数值列排序：按原始数字而非字符串 */
const numSort = (a: { getValue: (id: string) => unknown }, b: { getValue: (id: string) => unknown }, id: string) =>
  (Number(a.getValue(id)) || 0) - (Number(b.getValue(id)) || 0)

/**
 * 设备 tab：项目选型全量表格（TanStack Table 排序 + React Query 缓存）。
 * 数据为推导产物，只读；由 RepoQueryBridge 在仓储变更时自动刷新。
 */
export function DevicesTab({ projectId }: { projectId: string }) {
  const { data: rows = [] } = useQuery({
    queryKey: ['devices', projectId],
    queryFn: () => {
      const out: DeviceRow[] = []
      for (const ps of ProjectService.systems(projectId)) {
        for (const sel of DesignService.selections(ps.id)) {
          out.push({
            id: sel.id,
            sysName: ps.systemName,
            brand: sel.brand,
            modelName: sel.modelName,
            spec: sel.spec,
            quantity: sel.quantity || 0,
            unit_price: sel.unit_price,
            total_price: sel.total_price,
          })
        }
      }
      return out
    },
  })

  const totals = useMemo(
    () => ({
      count: rows.length,
      qty: rows.reduce((s, r) => s + (r.quantity || 0), 0),
      amt: rows.reduce((s, r) => s + (r.total_price || 0), 0),
    }),
    [rows],
  )

  const columns = useMemo<DataColumn<DeviceRow>[]>(
    () => [
      { accessorKey: 'sysName', header: '子系统', cell: ({ getValue }) => <span className="font-medium">{String(getValue())}</span> },
      { accessorKey: 'brand', header: '品牌', cell: ({ getValue }) => <span className="text-muted">{String(getValue() ?? '—')}</span> },
      { accessorKey: 'modelName', header: '型号', cell: ({ getValue }) => <NumCell>{String(getValue() ?? '—')}</NumCell> },
      {
        accessorKey: 'spec',
        header: '规格',
        cell: ({ getValue }) => <span className="block max-w-[260px] truncate text-muted">{String(getValue() ?? '—')}</span>,
      },
      { accessorKey: 'quantity', header: '数量', sortingFn: numSort, cell: ({ getValue }) => <NumCell>{fmtNum(Number(getValue()))}</NumCell> },
      { accessorKey: 'unit_price', header: '单价', sortingFn: numSort, cell: ({ getValue }) => <span className="font-mono text-[12px] text-muted">{fmtMoney(Number(getValue()) || undefined)}</span> },
      {
        accessorKey: 'total_price',
        header: '金额',
        sortingFn: numSort,
        cell: ({ getValue }) => <span className="font-mono text-[12.5px] font-semibold">{fmtMoney(Number(getValue()) || undefined)}</span>,
      },
    ],
    [],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 rounded-lg border border-rule bg-surface px-3.5 py-2.5 text-[12px] text-muted">
        <span>选型 <b className="font-mono text-ink">{totals.count}</b> 项</span>
        <span>合计数量 <b className="font-mono text-ink">{fmtNum(totals.qty)}</b></span>
        <span>合计金额 <b className="font-mono font-bold text-ink">{fmtMoney(totals.amt)}</b></span>
        <span className="ml-auto flex items-center font-mono text-[10.5px] text-faint">
          Derive 推导生成 · 点击列头排序
        </span>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        empty={
          <EmptyState icon={<Boxes />} title="暂无设备选型" description="进入系统设计工作区 → 推导，生成设备选型后展示" />
        }
      />

      {/* 按系统合计（不随排序变化） */}
      {rows.length > 0 && (
        <div className="rounded-lg border border-rule bg-surface">
          <p className="border-b border-rule px-3.5 py-2 text-[12px] font-semibold text-muted">按系统合计</p>
          <Table>
            <thead className="bg-surface-subtle"><tr><th className="px-3 py-2 text-left text-[11px] font-semibold text-muted">子系统</th><th className="px-3 py-2 text-left text-[11px] font-semibold text-muted">项数</th><th className="px-3 py-2 text-right text-[11px] font-semibold text-muted">金额</th></tr></thead>
            <tbody className="divide-y divide-rule/70">
              {groupBySys(rows).map(([name, list]) => (
                <tr key={name} className="h-8">
                  <td className="px-3 font-medium">{name}</td>
                  <td className="px-3 font-mono text-[12px] text-muted">{list.length}</td>
                  <td className="px-3 text-right font-mono text-[12.5px] font-semibold">{fmtMoney(list.reduce((s, r) => s + (r.total_price || 0), 0))}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  )
}

function groupBySys(rows: DeviceRow[]): [string, DeviceRow[]][] {
  const map = new Map<string, DeviceRow[]>()
  rows.forEach((r) => {
    const list = map.get(r.sysName) ?? []
    list.push(r)
    map.set(r.sysName, list)
  })
  return [...map.entries()]
}