import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

type AuthUser = {
  id: number
  name: string
  email: string
  createdAt: string
}

type LoginPayload = {
  email: string
  password: string
}

type AuthSession = {
  token: string
  expiresAtUtc: string
  user: AuthUser
}

type AuthContextValue = {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (payload: LoginPayload) => Promise<void>
  logout: () => void
}

const AUTH_STORAGE_KEY = 'nutrisaas.auth.session'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '') ?? ''
const FALLBACK_LOGIN_ERROR = 'Nao foi possivel autenticar. Verifique as credenciais.'
const FALLBACK_SESSION_ERROR = 'Nao foi possivel validar sua sessao.'

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

type ErrorResponse = {
  message?: string
}

type LoginResponse = AuthSession

function buildApiUrl(path: string) {
  if (!API_BASE_URL) {
    return path
  }

  return `${API_BASE_URL}${path}`
}

function clearPersistedSession() {
  localStorage.removeItem(AUTH_STORAGE_KEY)
}

async function extractErrorMessage(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as ErrorResponse
    if (body.message && body.message.trim()) {
      return body.message
    }
  } catch {
    // Ignora falha de parsing e usa fallback.
  }

  return fallback
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isActive = true

    const restoreSession = async () => {
      try {
        const stored = localStorage.getItem(AUTH_STORAGE_KEY)
        if (!stored) {
          return
        }

        const parsed = JSON.parse(stored) as Partial<AuthSession>
        if (!parsed.token || !parsed.user || !parsed.expiresAtUtc) {
          clearPersistedSession()
          return
        }

        if (new Date(parsed.expiresAtUtc).getTime() <= Date.now()) {
          clearPersistedSession()
          return
        }

        const meResponse = await fetch(buildApiUrl('/api/auth/me'), {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${parsed.token}`,
          },
        })

        if (!meResponse.ok) {
          clearPersistedSession()
          return
        }

        const meUser = (await meResponse.json()) as AuthUser

        if (!isActive) {
          return
        }

        const restoredSession: AuthSession = {
          token: parsed.token,
          expiresAtUtc: parsed.expiresAtUtc,
          user: meUser,
        }

        setToken(restoredSession.token)
        setUser(restoredSession.user)
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(restoredSession))
      } catch {
        if (isActive) {
          setToken(null)
          setUser(null)
        }
        clearPersistedSession()
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void restoreSession()

    return () => {
      isActive = false
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user && token),
      isLoading,
      login: async ({ email, password }) => {
        const response = await fetch(buildApiUrl('/api/auth/login'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email.trim(),
            password,
          }),
        })

        if (!response.ok) {
          const message = await extractErrorMessage(response, FALLBACK_LOGIN_ERROR)
          throw new Error(message)
        }

        const session = (await response.json()) as LoginResponse
        if (!session.token || !session.user) {
          throw new Error(FALLBACK_SESSION_ERROR)
        }

        setToken(session.token)
        setUser(session.user)
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
      },
      logout: () => {
        setToken(null)
        setUser(null)
        clearPersistedSession()
      },
    }),
    [isLoading, token, user]
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
