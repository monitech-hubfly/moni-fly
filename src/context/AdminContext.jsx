import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isAdminRole, normalizeAccessRole } from '@/lib/authz'

/** Legado Vite: chave antiga do “modo admin manual” (não define mais permissão). */
const STORAGE_KEY = 'carometro_admin'

const AdminContext = createContext({
  isAdmin: false,
  accessRole: 'pending',
  setAdmin: () => {}
})

async function fetchProfileRole() {
  try {
    const supabase = createClient()
    const {
      data: { user }
    } = await supabase.auth.getUser()
    if (!user?.id) return 'pending'
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    return profile?.role ?? 'pending'
  } catch {
    return 'pending'
  }
}

/**
 * Permissões de edição no Carômetro derivam do papel em `profiles.role` (sessão),
 * não do localStorage `carometro_admin`.
 *
 * @param {string} [accessRole] — papel vindo do servidor (Next `AppShell`); se omitido, busca no cliente (Vite).
 */
export function AdminProvider({ children, accessRole }) {
  const [resolvedRole, setResolvedRole] = useState(() =>
    accessRole != null && accessRole !== '' ? normalizeAccessRole(accessRole) : 'pending'
  )

  useEffect(() => {
    if (accessRole != null && accessRole !== '') {
      setResolvedRole(normalizeAccessRole(accessRole))
      return
    }
    let cancelled = false
    void fetchProfileRole().then(role => {
      if (!cancelled) setResolvedRole(normalizeAccessRole(role))
    })
    return () => {
      cancelled = true
    }
  }, [accessRole])

  const isAdmin = useMemo(() => isAdminRole(resolvedRole), [resolvedRole])

  /** Mantido para o app Vite (`App.jsx`); não concede admin sem papel no sistema. */
  const setAdmin = useCallback(
    value => {
      if (!value) {
        if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY)
        return
      }
      if (isAdmin) {
        if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, 'true')
        return
      }
      window.alert(
        'Modo administrador é definido pelo seu perfil no sistema. Entre com uma conta cujo papel seja admin.'
      )
    },
    [isAdmin]
  )

  useEffect(() => {
    if (typeof localStorage === 'undefined') return
    if (isAdmin) localStorage.setItem(STORAGE_KEY, 'true')
    else localStorage.removeItem(STORAGE_KEY)
  }, [isAdmin])

  const value = useMemo(
    () => ({ isAdmin, accessRole: resolvedRole, setAdmin }),
    [isAdmin, resolvedRole, setAdmin]
  )

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
}

export function useAdmin() {
  return useContext(AdminContext)
}
