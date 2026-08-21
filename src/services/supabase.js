import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (process.env.NODE_ENV === 'development' && (!supabaseUrl || !supabaseAnonKey)) {
  console.error(
    '[Supabase] Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env — sem isso, audit_log e demais tabelas retornam 401/erro.'
  )
}

function fetchWithTimeout(input, init = {}) {
  // 10s estava abortando requests em redes lentas e gerando `AbortError: signal is aborted without reason`.
  // Mantemos timeout para não travar a UI, mas com folga.
  const timeoutMs = 30000

  const controller = new AbortController()
  const prevSignal = init.signal
  if (prevSignal) {
    if (prevSignal.aborted) controller.abort()
    else prevSignal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  const t = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(t))
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchWithTimeout }
})
