import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-accent text-white hover:bg-accent-strong',
        secondary: 'bg-accent-soft text-accent hover:bg-selected',
        outline: 'border border-rule bg-surface text-ink hover:bg-hover',
        ghost: 'text-muted hover:bg-hover hover:text-ink',
        danger: 'bg-danger text-white hover:bg-red-600',
        success: 'bg-ok text-white hover:bg-green-600',
        link: 'text-accent underline-offset-4 hover:underline',
      },
      size: {
        xs: 'h-6 rounded-[5px] px-2 text-xs',
        sm: 'h-7 rounded-[6px] px-2.5 text-[13px]',
        md: 'h-8 rounded-[6px] px-3 text-[13px]',
        lg: 'h-9 rounded-[6px] px-4 text-sm',
        icon: 'size-7 rounded-[6px]',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
)
Button.displayName = 'Button'

export { Button, buttonVariants }
