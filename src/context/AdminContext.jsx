import { createContext, useContext, useState, useEffect } from 'react'

const STORAGE_KEY = 'carometro_admin'

const AdminContext = createContext({ isAdmin: false, setAdmin: () => {} })

export function AdminProvider({ children }) {
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    setIsAdmin(localStorage.getItem(STORAGE_KEY) === 'true')
  }, [])

  function setAdmin(value) {
    if (!value) {
      localStorage.removeItem(STORAGE_KEY)
      setIsAdmin(false)
      return
    }

    const senhaEsperada = import.meta.env.VITE_ADMIN_PASSWORD
    if (senhaEsperada == null || String(senhaEsperada).trim() === '') {
      window.alert('Configuração de admin ausente.')
      return
    }

    const email = window.prompt('E-mail do administrador:')
    if (email !== 'danilo.n@moni.casa') {
      window.alert('Acesso negado.')
      return
    }

    const senha = window.prompt('Senha:')
    if (senha === senhaEsperada) {
      localStorage.setItem(STORAGE_KEY, 'true')
      setIsAdmin(true)
    } else {
      window.alert('Senha incorreta.')
    }
  }

  return (
    <AdminContext.Provider value={{ isAdmin, setAdmin }}>
      {children}
    </AdminContext.Provider>
  )
}

export function useAdmin() {
  return useContext(AdminContext)
}
