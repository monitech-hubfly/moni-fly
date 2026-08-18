'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, X } from 'lucide-react'
import {
  atualizarRedeCorretor,
  criarRedeCorretor,
} from '@/app/rede-franqueados/rede-corretores-actions'
import { redeAlertError, redeAlertSuccess, redeBtnGhost, redeBtnPrimary } from '@/app/rede-franqueados/rede-ui'
import { RedeCorretorFichaForm } from '@/components/RedeCorretorFichaForm'
import {
  emptyRedeCorretorFichaDraft,
  redeCorretorFichaDraftToPatch,
  redeCorretorRowToFichaDraft,
  type RedeCorretorFichaDraft,
} from '@/lib/rede-corretor-ficha-draft'
import type { RedeCorretorRow } from '@/lib/rede-corretores'

type Props = {
  row?: RedeCorretorRow | null
  onClose: () => void
}

export function RedeCorretorFichaModal({ row = null, onClose }: Props) {
  const router = useRouter()
  const criar = !row
  const [draft, setDraft] = useState<RedeCorretorFichaDraft>(() =>
    row ? redeCorretorRowToFichaDraft(row) : emptyRedeCorretorFichaDraft('em_analise'),
  )
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  useEffect(() => {
    setDraft(row ? redeCorretorRowToFichaDraft(row) : emptyRedeCorretorFichaDraft('em_analise'))
  }, [row])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const save = async () => {
    setSaving(true)
    setMsg(null)
    const patch = redeCorretorFichaDraftToPatch(draft)
    const r = criar
      ? await criarRedeCorretor(patch)
      : await atualizarRedeCorretor(row!.id, patch)
    setSaving(false)
    if (!r.ok) {
      setMsg({ tipo: 'erro', texto: r.error })
      return
    }
    setMsg({ tipo: 'ok', texto: r.mensagem })
    router.refresh()
    setTimeout(onClose, 600)
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rede-corretor-ficha-titulo"
      onClick={onClose}
    >
      <div
        className="my-4 w-full max-w-3xl rounded-xl border border-stone-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-stone-200 px-5 py-4">
          <div>
            <h2 id="rede-corretor-ficha-titulo" className="text-lg font-semibold text-stone-900">
              {criar ? 'Novo corretor' : 'Ficha do corretor'}
            </h2>
            <p className="mt-0.5 text-sm text-stone-600">
              {criar
                ? 'Preencha a ficha. O código (CR0001…) é gerado automaticamente ao salvar.'
                : row?.n_corretor
                  ? `${row.n_corretor} · ${row.nome}`
                  : row?.nome}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-stone-500 hover:bg-stone-100"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[calc(100vh-8rem)] space-y-4 overflow-y-auto px-5 py-4">
          {msg ? (
            <div className={msg.tipo === 'ok' ? redeAlertSuccess : redeAlertError} role="status">
              {msg.texto}
            </div>
          ) : null}

          <RedeCorretorFichaForm
            draft={draft}
            onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
          />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-stone-200 px-5 py-4">
          <button type="button" onClick={onClose} disabled={saving} className={redeBtnGhost}>
            Cancelar
          </button>
          <button type="button" onClick={() => void save()} disabled={saving} className={redeBtnPrimary}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {criar ? 'Cadastrar corretor' : 'Salvar ficha'}
          </button>
        </div>
      </div>
    </div>
  )
}
