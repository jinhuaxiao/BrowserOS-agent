'use client'

import { Users } from 'lucide-react'

export default function TeamPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-foreground">Team</h1>
      </div>

      <div className="rounded-xl border border-divider bg-surface shadow-sm p-12 text-center">
        <Users className="w-12 h-12 text-text-faint mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">
          Set up your team
        </h2>
        <p className="text-sm text-text-faint max-w-md mx-auto mb-6">
          Create an organization to invite team members, assign roles, and share
          browser profiles.
        </p>
        <button className="px-4 py-2 rounded-full bg-primary text-text-inverse text-sm font-medium hover:bg-primary-hover transition-colors">
          Create Organization
        </button>
      </div>
    </div>
  )
}
