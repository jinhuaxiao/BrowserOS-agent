/**
 * ProxiesPage
 *
 * Independent proxy pool management page.
 * Wraps the existing ProxyPoolPanel with a page-level header.
 */

import { ScrollArea } from '@/components/ui/scroll-area'
import { ProxyPoolPanel } from '@/components/browser-profiles/ProxyManagement/ProxyPoolPanel'
import { AcceleratorSettings } from '@/components/settings/AcceleratorSettings'

export default function ProxiesPage() {
  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Proxy Pool</h1>
          <p className="mt-1 text-foreground/50 text-sm">
            Manage proxies for browser profile isolation
          </p>
        </div>

        {/* Proxy List */}
        <div className="rounded-xl border border-border bg-card p-5">
          <ProxyPoolPanel />
        </div>

        {/* Accelerator Settings */}
        <div className="rounded-xl border border-border bg-card p-5">
          <AcceleratorSettings />
        </div>
      </div>
    </ScrollArea>
  )
}
