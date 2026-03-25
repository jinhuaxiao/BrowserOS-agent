import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-serif font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-foreground focus:ring-offset-1',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-foreground text-background shadow hover:bg-foreground/90',
        secondary:
          'border-transparent bg-foreground/5 text-foreground hover:bg-foreground/10',
        destructive:
          'border-transparent bg-destructive text-white shadow hover:bg-destructive/80',
        outline: 'text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
