import { createContext, useContext, useState, useEffect } from 'react'
import { getMe, getStoredToken, storeToken, clearToken, login } from '../services/api'

const AuthContext = createContext(null)
const DEMO_EMAIL = 'demo@pdfpro.app'
const DEMO_PASSWORD = 'demo1234'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const boot = async () => {
      try {
        let token = getStoredToken()
        if (!token && import.meta.env.DEV) {
          const data = await login(DEMO_EMAIL, DEMO_PASSWORD)
          storeToken(data.access_token)
          token = data.access_token
        }
        if (!token) return
        const profile = await getMe()
        setUser(profile)
      } catch {
        clearToken()
      } finally {
        setLoading(false)
      }
    }
    boot()
  }, [])

  const signin = (token, userData) => {
    storeToken(token)
    setUser(userData)
  }

  const signout = () => {
    clearToken()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signin, signout, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
