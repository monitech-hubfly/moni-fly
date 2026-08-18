import { CadastroCorretorPublicoForm } from '@/components/CadastroCorretorPublicoForm'

export const dynamic = 'force-dynamic'

export default function CadastroCorretorPublicoPage() {
  return (
    <main className="min-h-screen bg-[var(--moni-surface-50,#f7f5f2)] px-4 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-8 rounded-xl border border-stone-200 bg-white px-6 py-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Moní · Rede Casa Moní</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">
            Cadastro de Corretor
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            Preencha seus dados. Após o envio, a equipe Moní analisará o cadastro antes da ativação.
          </p>
        </header>

        <div className="rounded-xl border border-stone-200 bg-white px-5 py-6 shadow-sm sm:px-6">
          <CadastroCorretorPublicoForm />
        </div>
      </div>
    </main>
  )
}
