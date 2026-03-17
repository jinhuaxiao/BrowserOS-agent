'use client'

import {
  CreditCard,
  Fingerprint,
  Globe,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from '@/lib/auth-client'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/profiles', icon: Fingerprint, label: 'Profiles' },
  { href: '/team', icon: Users, label: 'Team' },
  { href: '/proxies', icon: Globe, label: 'Proxies' },
  { href: '/billing', icon: CreditCard, label: 'Billing' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { data: session, isPending } = useSession()

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-text-muted">Loading...</div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-text-muted mb-4">Please sign in to continue</p>
          <Link
            href="/sign-in"
            className="px-4 py-2 rounded-full bg-primary text-text-inverse text-sm font-medium"
          >
            Sign In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-60 border-r border-divider bg-surface flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-divider">
          <Link href="/dashboard" className="text-lg font-bold text-foreground">
            Craft Agents
          </Link>
        </div>

        <nav className="flex-1 py-4 px-3">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-primary text-text-inverse font-medium rounded-full'
                        : 'text-text-muted hover:bg-surface-offset hover:text-foreground rounded-lg',
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="p-3 border-t border-divider">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center text-primary text-sm font-medium">
              {session.user.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground truncate">
                {session.user.name}
              </div>
              <div className="text-xs text-text-faint truncate">
                {session.user.email}
              </div>
            </div>
            <button
              onClick={() => signOut()}
              className="text-text-faint hover:text-foreground transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-8 py-8">{children}</div>
      </main>
    </div>
  )
}
