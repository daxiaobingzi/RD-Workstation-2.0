import * as React from 'react'
import { cn } from '../../lib/utils'

function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('text-[12px] font-medium text-muted leading-none', className)}
      {...props}
    />
  )
}

function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-8 w-full rounded-[6px] border border-rule bg-surface px-2.5 text-[13px] text-ink placeholder:text-faint',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'w-full rounded-[6px] border border-rule bg-surface px-2.5 py-2 text-[13px] text-ink placeholder:text-faint',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-8 w-full rounded-[6px] border border-rule bg-surface px-2 text-[13px] text-ink',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

function Field({
  label,
  children,
  className,
  required,
}: {
  label: string
  children: React.ReactNode
  className?: string
  required?: boolean
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label>
        {label}
        {required && <span className="text-danger"> *</span>}
      </Label>
      {children}
    </div>
  )
}

export { Input, Textarea, Select, Label, Field }
