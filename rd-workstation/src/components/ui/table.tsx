import * as React from 'react'
import { cn } from '../../lib/utils'

/** 高密度数据表格：行高 32px、等宽数字列、行选中 */
function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className={cn('w-full overflow-auto', className)}>
      <table className="w-full border-collapse text-[13px]" {...props} />
    </div>
  )
}

function THead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('bg-surface-subtle', className)} {...props} />
}

function TBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-rule/70', className)} {...props} />
}

function TR({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn('h-8 transition-colors data-[selected=true]:bg-selected', className)}
      {...props}
    />
  )
}

function TH({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'sticky top-0 z-10 whitespace-nowrap border-b border-rule bg-surface-subtle px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted',
        className,
      )}
      {...props}
    />
  )
}

function TD({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn('whitespace-nowrap px-3 py-1.5 align-middle text-ink', className)}
      {...props}
    />
  )
}

/** 数字 / 编码列：等宽字体 + 品牌色 */
function NumCell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('font-mono text-[12.5px] text-accent', className)}>{children}</span>
}

export { Table, THead, TBody, TR, TH, TD, NumCell }
