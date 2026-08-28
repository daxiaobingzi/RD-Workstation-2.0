import * as React from 'react'
import { cn } from '../../lib/utils'

function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-lg border border-rule/80 bg-surface shadow-sm', className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center gap-2 px-4 pt-3.5 pb-0', className)} {...props} />
}

function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-[13px] font-semibold leading-none tracking-tight', className)} {...props} />
  )
}

function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-4 py-3.5', className)} {...props} />
}

/** 区块容器（次级面板） */
function Panel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-lg border border-rule/80 bg-surface shadow-sm overflow-hidden', className)}
      {...props}
    />
  )
}

export { Card, CardHeader, CardTitle, CardContent, Panel }
