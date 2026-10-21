'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Copy, ExternalLink, Loader2, Share2 } from 'lucide-react'
import {
  criarRedeCorretor,
  enviarLinksDoCadastroNaRede,
  vincularEmpreendimentosDoNovoCorretor,
} from '@/app/rede-franqueados/rede-corretores-actions'
import { CorretorEmpreendimentosVinculo } from '@/components/CorretorEmpreendimentosVinculo'
import type { EmpreendimentoVinculoOpcao } from '@/lib/corretor-empreendimentos-vinculo'
import { redeAlertError, redeAlertSuccess, redeBtnGhost, redeBtnPrimary } from '@/app/rede-franqueados/rede-ui'
import { RedeCorretorFichaForm } from '@/components/RedeCorretorFichaForm'
import {
  emptyRedeCorretorFichaDraft,
  redeCorretorFichaDraftToPatch,
  type RedeCorretorFichaDraft,
} from '@/lib/rede-corretor-ficha-draft'
import { buildCadastroCorretorPublicUrl } from '@/lib/rede-corretor-persist'

export function CorretorNovoInternoClient({
  empreendimentos = [],
}: {
  empreendimentos?: EmpreendimentoVinculoOpcao[]
}) {
  const router = useRouter()
  const [draft, setDraft] = useState<RedeCorretorFichaDraft>(() =>
    emptyRedeCorretorFichaDraft('aprovado'),
  )
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [shareMsg, setShareMsg] = useState<string | null>(null)
  const [publicUrl, setPublicUrl] = useState('/cadastro/corretor')
  const [empreendimentoIds, setEmpreendimentoIds] = useState<string[]>([])

  useEffect(() => {
    setPublicUrl(buildCadastroCorretorPublicUrl(window.location.origin))
  }, [])

  async function copiarLink() {
    const url = buildCadastroCorretorPublicUrl(window.location.origin)
    try {
      await navigator.clipboard.writeText(url)
      setShareMsg('Link copiado para a área de transferência.')
    } catch {
      setShareMsg(`Copie manualmente: ${url}`)
    }
  }

  async function save() {
    setSaving(true)
    setMsg(null)
    const patch = redeCorretorFichaDraftToPatch(draft)
    const r = await criarRedeCorretor(patch)
    if (!r.ok) {
      setSaving(false)
      setMsg({ tipo: 'erro', texto: r.error })
      return
    }
    if (r.id && empreendimentoIds.length > 0) {
      const vinculo = await vincularEmpreendimentosDoNovoCorretor(r.id, empreendimentoIds)
      if (!vinculo.ok) {
        setSaving(false)
        setMsg({ tipo: 'erro', texto: `Corretor cadastrado, mas o vínculo falhou: ${vinculo.error}` })
        return
      }
    }
    let texto = r.mensagem
    if (r.id && draft.status === 'aprovado') {
      const email = await enviarLinksDoCadastroNaRede(r.id)
      if (email.ok) texto = email.mensagem
    }
    setSaving(false)
    setMsg({ tipo: 'ok', texto })
    router.refresh()
    setTimeout(() => router.push('/rede-franqueados?tab=corretores'), 700)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-stone-900">Compartilhar link de cadastro</p>
          <p className="mt-0.5 break-all text-xs text-stone-500">{publicUrl}</p>
          {shareMsg ? <p className="mt-1 text-xs text-emerald-700">{shareMsg}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void copiarLink()} className={redeBtnGhost}>
            <Copy className="h-4 w-4" />
            Copiar link
          </button>
          <a href={publicUrl} target="_blank" rel="noopener noreferrer" className={redeBtnGhost}>
            <ExternalLink className="h-4 w-4" />
            Abrir formulário
          </a>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Cadastro de Corretor Moní: ${publicUrl}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={redeBtnGhost}
          >
            <Share2 className="h-4 w-4" />
            WhatsApp
          </a>
        </div>
      </div>

      {msg ? (
        <div className={msg.tipo === 'ok' ? redeAlertSuccess : redeAlertError} role="status">
          {msg.texto}
        </div>
      ) : null}

      <div className="rounded-xl border border-stone-200 bg-white px-5 py-6 shadow-sm">
        <RedeCorretorFichaForm
          draft={draft}
          onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
          showStatus
        />

        <div className="mt-6">
          <CorretorEmpreendimentosVinculo
            modo="interno"
            empreendimentos={empreendimentos}
            selecionados={empreendimentoIds}
            onChange={setEmpreendimentoIds}
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 pt-4">
          <Link href="/rede-franqueados?tab=corretores" className={redeBtnGhost}>
            Voltar à lista
          </Link>
          <button type="button" onClick={() => void save()} disabled={saving} className={redeBtnPrimary}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Cadastrar corretor
          </button>
        </div>
      </div>
    </div>
  )
}
