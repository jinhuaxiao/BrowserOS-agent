'use client'

import { CreditCard } from 'lucide-react'

export default function BillingPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-foreground">Billing</h1>
      </div>

      <div className="rounded-xl border border-divider bg-surface shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Current Plan
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold font-mono text-foreground">
              Free
            </div>
            <div className="text-sm text-text-muted">
              10 profiles &middot; 1 member
            </div>
          </div>
          <button className="px-4 py-2 rounded-full bg-primary text-text-inverse text-sm font-medium hover:bg-primary-hover transition-colors">
            Upgrade
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-divider bg-surface shadow-sm p-12 text-center">
        <CreditCard className="w-12 h-12 text-text-faint mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">
          No payment history
        </h2>
        <p className="text-sm text-text-faint max-w-md mx-auto">
          Your billing history and invoices will appear here once you upgrade
          your plan.
        </p>
      </div>
    </div>
  )
}
