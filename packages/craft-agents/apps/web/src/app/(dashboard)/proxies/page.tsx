'use client'

import { Globe } from 'lucide-react'

export default function ProxiesPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-foreground">Proxies</h1>
      </div>

      <div className="rounded-xl border border-divider bg-surface shadow-sm p-12 text-center">
        <Globe className="w-12 h-12 text-text-faint mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">
          Proxy marketplace
        </h2>
        <p className="text-sm text-text-faint max-w-md mx-auto">
          Purchase residential, datacenter, and mobile proxies directly from the
          dashboard. Coming soon.
        </p>
      </div>
    </div>
  )
}
