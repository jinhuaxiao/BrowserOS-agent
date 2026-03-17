'use client'

import { Fingerprint } from 'lucide-react'

export default function ProfilesPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-foreground">Profiles</h1>
      </div>

      <div className="rounded-xl border border-divider bg-surface shadow-sm p-12 text-center">
        <Fingerprint className="w-12 h-12 text-text-faint mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">
          No profiles yet
        </h2>
        <p className="text-sm text-text-faint max-w-md mx-auto">
          Browser profiles are managed in the Craft Agents desktop app. Connect
          your app to see synced profiles here.
        </p>
      </div>
    </div>
  )
}
