/**
 * HeaderIconButton
 *
 * Unified icon button for panel headers (Navigator and Detail panels).
 * Provides consistent styling for all header action buttons.
 */

import { Tooltip, TooltipContent, TooltipTrigger } from '@craft-agent/ui'
import type * as React from 'react'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface HeaderIconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Icon as React element - caller controls size/styling */
  icon: React.ReactNode
  /** Optional tooltip text */
  tooltip?: string
}

export const HeaderIconButton = forwardRef<
  HTMLButtonElement,
  HeaderIconButtonProps
>(({ icon, tooltip, className, ...props }, ref) => {
  const button = (
    <button
      ref={ref}
      type="button"
      className={cn(
        'inline-flex items-center justify-center',
        'h-7 w-7 shrink-0 rounded-[4px] titlebar-no-drag',
        'text-foreground/50 hover:text-foreground hover:bg-foreground/5',
        'data-[state=open]:text-foreground data-[state=open]:bg-foreground/5',
        'transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent',
        'disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  )

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    )
  }

  return button
})
HeaderIconButton.displayName = 'HeaderIconButton'
