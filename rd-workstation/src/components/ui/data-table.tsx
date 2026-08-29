import { useMemo, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import {
  useTable,
  tableFeatures,
  coreFeatures,
  rowSortingFeature,
  columnVisibilityFeature,
  createSortedRowModel,
  sortFns,
  flexRender,
} from '@tanstack/react-table'
import type { ColumnDef, RowData } from '@tanstack/react-table'
import { Table, THead, TBody, TR, TH, TD } from './table'
import { cn } from '../../lib/utils'

/**
 * TanStack Table v9 组合式特性：核心特性 + 客户端排序 + 列可见性。
 * 注意：v9 中 Row#getVisibleCells 由 columnVisibilityFeature 提供，必须注册。
 * 静态定义在模块级（官方推荐），供所有 DataTable 实例复用。
 */
const features = tableFeatures({
  ...coreFeatures,
  rowSortingFeature,
  columnVisibilityFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns,
})

/** 业务表格列定义（TFeatures 放宽以复用同一 features 配置） */
export type DataColumn<T extends RowData> = ColumnDef<any, T, unknown>

interface DataTableProps<T extends RowData> {
  columns: DataColumn<T>[]
  data: T[]
  getRowId?: (row: T) => string
  /** 无数据时的占位内容 */
  empty?: ReactNode
  className?: string
}

/**
 * 通用数据表：基于 TanStack Table v9 的 `useTable`，列头点击排序。
 * 与 `components/ui/table` 的视觉样式保持一致。
 */
export function DataTable<T extends RowData>({ columns, data, getRowId, empty, className }: DataTableProps<T>) {
  const table = useTable(
    useMemo(() => ({ features, data, columns, ...(getRowId ? { getRowId } : {}) }), [data, columns, getRowId]),
  )
  const rows = table.getRowModel().rows

  return (
    <div className={cn('overflow-auto rounded-md border border-rule', className)}>
      <Table>
        <THead>
          {table.getHeaderGroups().map((hg) => (
            <TR key={hg.id}>
              {hg.headers.map((header) => (
                <TH key={header.id} className={cn(header.column.getCanSort() && 'cursor-pointer select-none')}>
                  {header.isPlaceholder ? null : (
                    <button
                      type="button"
                      onClick={header.column.getToggleSortingHandler()}
                      disabled={!header.column.getCanSort()}
                      aria-label={header.column.columnDef.header?.toString()}
                      className={cn('flex w-full items-center gap-1', !header.column.getCanSort() && 'cursor-default')}
                    >
                      <span className="min-w-0">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </span>
                      {header.column.getCanSort() &&
                        (header.column.getIsSorted() === 'asc' ? (
                          <ArrowUp className="size-3 shrink-0 text-accent" />
                        ) : header.column.getIsSorted() === 'desc' ? (
                          <ArrowDown className="size-3 shrink-0 text-accent" />
                        ) : (
                          <ArrowUpDown className="size-3 shrink-0 opacity-40" />
                        ))}
                    </button>
                  )}
                </TH>
              ))}
            </TR>
          ))}
        </THead>
        <TBody>
          {rows.map((row) => (
            <TR key={row.id} className="hover:bg-hover">
              {row.getVisibleCells().map((cell) => (
                <TD key={cell.id} className={cn(cell.column.id === 'select' && 'pr-0')}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TD>
              ))}
            </TR>
          ))}
        </TBody>
      </Table>
      {!rows.length && empty}
    </div>
  )
}