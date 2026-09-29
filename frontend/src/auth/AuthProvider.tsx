import { useState, type ReactNode } from 'react'
import { AuthContext, homePath, type Role } from './AuthContext.ts'

const STORAGE_KEY = 'queuesmart.role'

function loadRole(): Role | null {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored && stored in homePath ? (stored as Role) : null
}

// Stand-in for real authentication: the current role is just remembered
// in localStorage. The Login screen and the API replace this later.
export default function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role | null>(loadRole)

  function setRole(next: Role | null) {
    if (next) localStorage.setItem(STORAGE_KEY, next)
    else localStorage.removeItem(STORAGE_KEY)
    setRoleState(next)
  }

  return <AuthContext value={{ role, setRole }}>{children}</AuthContext>
}
