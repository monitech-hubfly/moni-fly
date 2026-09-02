import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isRedeStaffRole } from '@/lib/authz'
import { CorretorNovoInternoClient } from './CorretorNovoInternoClient'

export const dynamic = 'force-dynamic'

export default async function CorretoresNovoPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = (profile as { role?: string } | null)?.role
  if (!isRedeStaffRole(role)) redirect('/rede-franqueados')

  return (
    <div className="min-h-0 bg-[var(--moni-surface-50)]">
      <main className="mx-auto w-full min-w-0 max-w-3xl px-6 py-8">
        <header className="pb-6" style={{ borderBottom: '0.5px solid var(--moni-border-default, #e8e2da)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Rede Casa Moní</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-stone-900">
            Cadastro de Corretor
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-stone-600">
            Cadastro interno (status ativo por padrão). Use o link abaixo para enviar o formulário
            público aos corretores.
          </p>
        </header>

        <div className="mt-6">
          <CorretorNovoInternoClient />
        </div>
      </main>
    </div>
  )
}
