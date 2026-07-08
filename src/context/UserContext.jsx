/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useState } from 'react'

// 공개 사이트의 "로그인 회원" 세션 (프로토타입 — 실제 인증 아님)
const UserContext = createContext(null)
const STORAGE_KEY = 'medifront_user'

function readUser() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null
  } catch {
    return null
  }
}

export function UserProvider({ children }) {
  const [user, setUser] = useState(readUser)
  const [loginOpen, setLoginOpen] = useState(false)

  const login = useCallback((u) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
    setUser(u)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setUser(null)
  }, [])

  const openLogin = useCallback(() => setLoginOpen(true), [])
  const closeLogin = useCallback(() => setLoginOpen(false), [])

  return (
    <UserContext.Provider value={{ user, login, logout, loginOpen, openLogin, closeLogin }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  return useContext(UserContext)
}
