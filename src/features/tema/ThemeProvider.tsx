import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Tema = 'claro' | 'oscuro'

const KEY = 'gd-tema'

interface ThemeContextValue {
  tema: Tema
  setTema: (t: Tema) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function inicial(): Tema {
  try {
    const guardado = localStorage.getItem(KEY)
    if (guardado === 'claro' || guardado === 'oscuro') return guardado
  } catch {
    /* sin almacenamiento */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTemaState] = useState<Tema>(inicial)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema === 'oscuro' ? 'dark' : 'light')
  }, [tema])

  const setTema = useCallback((t: Tema) => {
    setTemaState(t)
    try {
      localStorage.setItem(KEY, t)
    } catch {
      /* sin almacenamiento */
    }
  }, [])

  const value = useMemo(() => ({ tema, setTema }), [tema, setTema])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTema(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTema debe usarse dentro de ThemeProvider')
  return ctx
}
