/**
 * SetupOrgScreen
 *
 * First-run setup screen for creating the initial organization and admin account.
 * Uses the electronAPI directly for org setup, then refreshes the TeamContext session.
 */

import * as React from 'react'
import { useTeam } from '@/contexts/TeamContext'

export function SetupOrgScreen() {
  const { refreshSession } = useTeam()
  const [orgName, setOrgName] = React.useState('')
  const [orgSlug, setOrgSlug] = React.useState('')
  const [adminName, setAdminName] = React.useState('')
  const [adminEmail, setAdminEmail] = React.useState('')
  const [adminPassword, setAdminPassword] = React.useState('')
  const [error, setError] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleOrgNameChange = (name: string) => {
    setOrgName(name)
    setOrgSlug(
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      await window.electronAPI.teamSetupOrg({
        name: orgName,
        slug: orgSlug,
        adminName,
        adminEmail,
        adminPassword,
      })
      await refreshSession()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex h-full items-center justify-center">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="font-serif font-medium text-3xl">
            Welcome to Craft Agents
          </h1>
          <p className="mt-1 text-foreground/50 text-sm">
            Set up your organization to get started
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4 rounded-lg border border-border p-4">
            <h3 className="font-medium text-sm">Organization</h3>
            <div>
              <label className="mb-1 block font-medium text-sm">
                Name
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => handleOrgNameChange(e.target.value)}
                  required
                  className="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
                  placeholder="My Company"
                />
              </label>
            </div>
            <div>
              <label className="mb-1 block font-medium text-sm">
                Slug
                <input
                  type="text"
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(e.target.value)}
                  required
                  className="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
                  placeholder="my-company"
                />
              </label>
            </div>
          </div>

          <div className="space-y-4 rounded-lg border border-border p-4">
            <h3 className="font-medium text-sm">Admin Account</h3>
            <div>
              <label className="mb-1 block font-medium text-sm">
                Name
                <input
                  type="text"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  required
                  className="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
                  placeholder="Admin Name"
                />
              </label>
            </div>
            <div>
              <label className="mb-1 block font-medium text-sm">
                Email
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  required
                  className="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
                  placeholder="admin@example.com"
                />
              </label>
            </div>
            <div>
              <label className="mb-1 block font-medium text-sm">
                Password
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  required
                  minLength={6}
                  className="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
                  placeholder="Min 6 characters"
                />
              </label>
            </div>
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-foreground py-2.5 font-medium text-background text-sm disabled:opacity-50"
          >
            {isSubmitting ? 'Setting up...' : 'Create Organization'}
          </button>
        </form>
      </div>
    </div>
  )
}
