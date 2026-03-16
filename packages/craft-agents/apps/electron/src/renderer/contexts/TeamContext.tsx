import * as React from 'react'
import type {
  LoginInput,
  LoginResult,
  Member,
  Organization,
} from '../../shared/types'

export interface TeamSession {
  member: Omit<Member, 'passwordHash'>
  organization: Organization
}

interface TeamContextValue {
  session: TeamSession | null
  isLoading: boolean
  needsSetup: boolean
  login: (input: LoginInput) => Promise<LoginResult>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
}

const TeamContext = React.createContext<TeamContextValue | null>(null)

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<TeamSession | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [needsSetup, setNeedsSetup] = React.useState(false)

  const refreshSession = React.useCallback(async () => {
    try {
      const result = await window.electronAPI.teamGetSession()
      setSession(result)
    } catch {
      setSession(null)
    }
  }, [])

  const checkSetup = React.useCallback(async () => {
    try {
      const { needsSetup: needs } = await window.electronAPI.teamSetupCheck()
      setNeedsSetup(needs)
    } catch {
      setNeedsSetup(true)
    }
  }, [])

  React.useEffect(() => {
    const init = async () => {
      setIsLoading(true)
      await checkSetup()
      await refreshSession()
      setIsLoading(false)
    }
    init()
  }, [checkSetup, refreshSession])

  const login = React.useCallback(
    async (input: LoginInput): Promise<LoginResult> => {
      const result = await window.electronAPI.teamLogin(input)
      if (result.success && result.member && result.organization) {
        setSession({ member: result.member, organization: result.organization })
        setNeedsSetup(false)
      }
      return result
    },
    [],
  )

  const logout = React.useCallback(async () => {
    await window.electronAPI.teamLogout()
    setSession(null)
  }, [])

  const value = React.useMemo(
    () => ({ session, isLoading, needsSetup, login, logout, refreshSession }),
    [session, isLoading, needsSetup, login, logout, refreshSession],
  )

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>
}

export function useTeam(): TeamContextValue {
  const ctx = React.useContext(TeamContext)
  if (!ctx) throw new Error('useTeam must be used within TeamProvider')
  return ctx
}

export function useTeamSession(): TeamSession | null {
  return useTeam().session
}
