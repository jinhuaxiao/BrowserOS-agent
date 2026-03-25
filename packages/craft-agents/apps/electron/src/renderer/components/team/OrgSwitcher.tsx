import { Building2, Check, ChevronDown } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTeam } from '@/contexts/TeamContext'
import { cn } from '@/lib/utils'
import type { Organization } from '../../../shared/types'

interface OrgSwitcherProps {
  className?: string
}

export function OrgSwitcher({ className }: OrgSwitcherProps) {
  const { session, logout } = useTeam()
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.electronAPI
      .teamListOrgs()
      .then(setOrgs)
      .catch(() => setOrgs([]))
  }, [session?.organization.id])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleSwitch = useCallback(
    async (org: Organization) => {
      if (org.id === session?.organization.id) {
        setOpen(false)
        return
      }
      setOpen(false)
      await logout()
    },
    [session?.organization.id, logout],
  )

  if (!session) return null

  const currentOrg = session.organization
  const showChevron = orgs.length > 1

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => showChevron && setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-md text-[13px] w-full',
          'text-foreground/60 hover:bg-foreground/5 transition-colors',
          showChevron && 'cursor-pointer',
          !showChevron && 'cursor-default',
        )}
      >
        <Building2 className="h-3.5 w-3.5 shrink-0 text-foreground/50" />
        <span className="truncate">{currentOrg.name}</span>
        {showChevron && (
          <ChevronDown
            className={cn(
              'h-3 w-3 shrink-0 text-foreground/50 transition-transform ml-auto',
              open && 'rotate-180',
            )}
          />
        )}
      </button>

      {open && (
        <div
          className={cn(
            'absolute left-0 top-full mt-1 z-50 min-w-[180px] w-full',
            'rounded-md border bg-white shadow-lg dark:bg-gray-900',
            'py-1',
          )}
        >
          {orgs.map((org) => {
            const isCurrent = org.id === currentOrg.id
            return (
              <button
                key={org.id}
                type="button"
                onClick={() => handleSwitch(org)}
                className={cn(
                  'flex items-center gap-2 w-full px-2.5 py-1.5 text-[13px] text-left',
                  'transition-colors',
                  isCurrent ? 'bg-foreground text-background' : 'hover:bg-foreground/5',
                )}
              >
                <Building2 className="h-3.5 w-3.5 shrink-0 text-foreground/50" />
                <span className="truncate">{org.name}</span>
                {isCurrent && (
                  <Check className="h-3.5 w-3.5 shrink-0 ml-auto text-foreground/50" />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
