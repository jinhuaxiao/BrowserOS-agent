'use client'

import { useSession } from '@/lib/auth-client'

export default function SettingsPage() {
  const { data: session } = useSession()

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-8">Settings</h1>

      <div className="space-y-6">
        <div className="rounded-xl border border-divider bg-surface shadow-sm p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Profile
          </h2>
          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Name
              </label>
              <input
                type="text"
                defaultValue={session?.user.name || ''}
                className="w-full px-3 py-2 rounded-lg border border-divider bg-surface-offset text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Email
              </label>
              <input
                type="email"
                defaultValue={session?.user.email || ''}
                disabled
                className="w-full px-3 py-2 rounded-lg border border-divider bg-surface-offset text-text-muted text-sm"
              />
            </div>
            <button className="px-4 py-2 rounded-full bg-primary text-text-inverse text-sm font-medium hover:bg-primary-hover transition-colors">
              Save Changes
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-divider bg-surface shadow-sm p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Desktop App Connection
          </h2>
          <p className="text-sm text-text-faint mb-4">
            Connect your Craft Agents desktop app to enable cloud sync.
          </p>
          <div className="flex items-center gap-3">
            <code className="px-3 py-2 rounded-lg bg-surface-offset text-sm text-foreground font-mono">
              {typeof window !== 'undefined' ? window.location.origin : ''}
            </code>
            <button className="px-3 py-2 rounded-full border border-divider text-sm text-foreground hover:bg-surface-offset transition-colors">
              Copy URL
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-error/20 bg-surface p-6">
          <h2 className="text-lg font-semibold text-error mb-2">Danger Zone</h2>
          <p className="text-sm text-text-faint mb-4">
            Permanently delete your account and all associated data.
          </p>
          <button className="px-4 py-2 rounded-full border border-error text-error text-sm font-medium hover:bg-error/10 transition-colors">
            Delete Account
          </button>
        </div>
      </div>
    </div>
  )
}
