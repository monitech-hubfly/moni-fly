import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default function CadastroCorretorEnviadoPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--moni-surface-50,#f7f5f2)] px-4 py-10">
      <div className="w-full max-w-lg rounded-xl border border-stone-200 bg-white px-6 py-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-stone-900">Cadastro recebido</h1>
        <p className="mt-2 text-sm text-stone-600">
          Seu cadastro foi recebido e será analisado em breve pela equipe Moní. Você pode fechar esta
          página.
        </p>
        <Link
          href="/cadastro/corretor"
          className="mt-6 inline-flex text-sm font-medium text-[#0c2633] underline-offset-2 hover:underline"
        >
          Enviar outro cadastro
        </Link>
      </div>
    </main>
  )
}
