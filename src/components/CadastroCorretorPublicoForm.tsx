'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'
import { RedeCorretorFichaForm } from '@/components/RedeCorretorFichaForm'
import {
  emptyRedeCorretorFichaDraft,
  redeCorretorFichaDraftToPatch,
  type RedeCorretorFichaDraft,
} from '@/lib/rede-corretor-ficha-draft'

type Props = {
  onSuccess?: () => void
}

export function CadastroCorretorPublicoForm({ onSuccess }: Props) {
  const router = useRouter()
  const [draft, setDraft] = useState<RedeCorretorFichaDraft>(() =>
    emptyRedeCorretorFichaDraft('pendente'),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const patch = redeCorretorFichaDraftToPatch(draft)
      const res = await fetch('/api/public/cadastro-corretor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const json = (await res.json().catch(() => null)) as
        | { ok: true }
        | { ok: false; error?: string }
        | null
      if (!res.ok || !json || !('ok' in json) || !json.ok) {
        setError(
          json && 'error' in json && json.error
            ? String(json.error)
            : 'Não foi possível enviar o cadastro.',
        )
        return
      }
      onSuccess?.()
      router.push('/cadastro/corretor/enviado')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-6">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      ) : null}

      <RedeCorretorFichaForm
        draft={draft}
        onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
        showStatus={false}
      />

      <button
        type="submit"
        disabled={saving}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0c2633] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#163d4d] disabled:opacity-60 sm:w-auto"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Enviar cadastro
      </button>
    </form>
  )
}
