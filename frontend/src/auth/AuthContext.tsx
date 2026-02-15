import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

type AuthUser = {
  name: string
  email: string
}

type LoginPayload = {
  email: string
  password: string
}

type AuthContextValue = {
  user: AuthUser | null
  isLoading: boolean
  login: (payload: LoginPayload) => void
  logout: () => void
}

const AUTH_STORAGE_KEY = 'nutrisaas.auth.user'

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function getNameFromEmail(email: string) {
  const base = email.split('@')[0] ?? ''
  const cleaned = base.replace(/[._-]+/g, ' ').trim()
  if (!cleaned) return 'Usuario'

  return cleaned
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY)
      if (!stored) {
        setIsLoading(false)
        return
      }

      const parsed = JSON.parse(stored) as AuthUser
      if (parsed?.email) {
        setUser(parsed)
      }
    } catch {
      localStorage.removeItem(AUTH_STORAGE_KEY)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      login: ({ email, password }) => {
        // Password sera validada no backend quando a API real for conectada.
        void password

        const payload: AuthUser = {
          email: email.trim(),
          name: getNameFromEmail(email),
        }

        setUser(payload)
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload))
      },
      logout: () => {
        setUser(null)
        localStorage.removeItem(AUTH_STORAGE_KEY)
      },
    }),
    [isLoading, user]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider')
  }

  return context
}
