/**
 * LoginScreen
 *
 * Full-screen login form for team authentication. Uses the TeamContext
 * for login state management.
 */

import * as React from 'react'
import { useTeam } from '@/contexts/TeamContext'

export function LoginScreen() {
  const { login } = useTeam()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      const result = await login({ email, password })
      if (!result.success) {
        setError(result.error || 'Login failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex h-full items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="font-serif font-medium text-3xl">Craft Agents</h1>
          <p className="mt-1 text-foreground/50 text-sm">
            Sign in to your account
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block font-medium text-sm">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
                placeholder="you@example.com"
              />
            </label>
          </div>
          <div>
            <label className="mb-1 block font-medium text-sm">
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
              />
            </label>
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-foreground py-2 font-medium text-background text-sm disabled:opacity-50"
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
