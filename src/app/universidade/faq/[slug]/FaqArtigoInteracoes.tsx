'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Check, Link2, LifeBuoy, ThumbsDown, ThumbsUp } from 'lucide-react';
import { enviarFeedbackFaq, incrementarViewFaq } from '@/lib/faq/actions';

const CHAMADO_HREF = '/sirene';

export function FaqArtigoInteracoes({ articleId, slug }: { articleId: string; slug: string }) {
  const [avaliacao, setAvaliacao] = useState<'sim' | 'nao' | 'ajuda' | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [comentario, setComentario] = useState('');
  const [copiado, setCopiado] = useState(false);
  const viewMarcada = useRef(false);

  useEffect(() => {
    if (viewMarcada.current) return;
    viewMarcada.current = true;
    void incrementarViewFaq(articleId);
  }, [articleId]);

  async function avaliar(tipo: 'sim' | 'nao' | 'ajuda') {
    setAvaliacao(tipo);
    if (tipo !== 'nao' && tipo !== 'ajuda') {
      await enviarFeedbackFaq({ articleId, wasHelpful: tipo === 'sim', needsSupport: false });
      setEnviado(true);
    }
  }

  async function enviarComComentario(needsSupport: boolean) {
    await enviarFeedbackFaq({
      articleId,
      wasHelpful: avaliacao === 'sim' ? true : avaliacao === 'nao' ? false : null,
      needsSupport,
      comment: comentario,
    });
    setEnviado(true);
  }

  async function copiarLink() {
    try {
      const url = `${window.location.origin}/universidade/faq/${slug}`;
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-stone-800">Esta resposta resolveu sua dúvida?</p>
        <button
          type="button"
          onClick={() => void copiarLink()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
        >
          {copiado ? <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden /> : <Link2 className="h-3.5 w-3.5" aria-hidden />}
          {copiado ? 'Link copiado!' : 'Copiar link'}
        </button>
      </div>

      {enviado ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Obrigado pelo seu feedback! Ele ajuda a melhorar a FAQ.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void avaliar('sim')}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
              avaliacao === 'sim' ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-stone-200 text-stone-700 hover:bg-stone-50'
            }`}
          >
            <ThumbsUp className="h-4 w-4" aria-hidden /> Sim
          </button>
          <button
            type="button"
            onClick={() => void avaliar('nao')}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
              avaliacao === 'nao' ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-stone-200 text-stone-700 hover:bg-stone-50'
            }`}
          >
            <ThumbsDown className="h-4 w-4" aria-hidden /> Não
          </button>
          <button
            type="button"
            onClick={() => void avaliar('ajuda')}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
              avaliacao === 'ajuda' ? 'border-moni-primary bg-stone-50 text-stone-900' : 'border-stone-200 text-stone-700 hover:bg-stone-50'
            }`}
          >
            <LifeBuoy className="h-4 w-4" aria-hidden /> Ainda preciso de ajuda
          </button>
        </div>
      )}

      {!enviado && (avaliacao === 'nao' || avaliacao === 'ajuda') ? (
        <div className="space-y-3 rounded-lg border border-stone-100 bg-stone-50 p-3">
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            rows={3}
            placeholder="Conte o que faltou nesta resposta (opcional)…"
            className="w-full rounded-lg border border-stone-200 bg-white p-2.5 text-sm outline-none focus:border-moni-primary focus:ring-2 focus:ring-moni-primary/20"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void enviarComComentario(avaliacao === 'ajuda')}
              className="rounded-lg bg-moni-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Enviar feedback
            </button>
            <Link
              href={CHAMADO_HREF}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-white"
            >
              <LifeBuoy className="h-4 w-4" aria-hidden /> Abrir chamado
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
