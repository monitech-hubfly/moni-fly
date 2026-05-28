'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Loader2, Trash2 } from 'lucide-react';
import { previewDuplicatasRedeFranqueados, removerDuplicatasRedeFranqueados } from './actions';
import {
  redeAlertError,
  redeAlertSuccess,
  redeAlertWarning,
  redeBtnDestructive,
  redeBtnDestructiveOutline,
} from './rede-ui';

export function RemoverDuplicatasRedeButton() {
  const router = useRouter();
  const [loading, setLoading] = useState<'preview' | 'remove' | null>(null);
  const [preview, setPreview] = useState<{
    totalRemover: number;
    totalGrupos: number;
    amostra: string[];
  } | null>(null);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  const carregarPreview = async () => {
    setLoading('preview');
    setMsg(null);
    try {
      const r = await previewDuplicatasRedeFranqueados();
      if (!r.ok) {
        setPreview(null);
        setMsg({ tipo: 'erro', texto: r.error });
        return;
      }
      setPreview({
        totalRemover: r.totalRemover,
        totalGrupos: r.totalGrupos,
        amostra: r.grupos.slice(0, 8).map((g) => `${g.rotulo} (${g.linhas.length} linhas)`),
      });
      if (r.totalRemover === 0) {
        setMsg({ tipo: 'ok', texto: 'Nenhuma duplicata encontrada pelo Nº de Franquia ou pelo nome.' });
      }
    } finally {
      setLoading(null);
    }
  };

  const remover = async () => {
    if (!preview || preview.totalRemover === 0) {
      await carregarPreview();
      return;
    }
    const ok = window.confirm(
      `Remover ${preview.totalRemover} linha(s) duplicada(s) em ${preview.totalGrupos} grupo(s)?\n\n` +
        'Em cada grupo será mantida a linha mais completa (prioridade: quem tem card no Step 1). ' +
        'Vínculos de cards e perfis serão transferidos para a linha mantida.',
    );
    if (!ok) return;

    setLoading('remove');
    setMsg(null);
    try {
      const r = await removerDuplicatasRedeFranqueados();
      if (!r.ok) {
        setMsg({ tipo: 'erro', texto: r.error });
        return;
      }
      setMsg({ tipo: 'ok', texto: r.mensagem });
      setPreview(null);
      router.refresh();
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className={redeAlertWarning}>
      <div className="flex items-start gap-2">
        <Copy className="mt-0.5 h-4 w-4 shrink-0 text-amber-800" aria-hidden />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-medium text-amber-950">Linhas duplicadas</p>
          <p className="text-xs leading-relaxed text-amber-900/90">
            Agrupa por <strong>Nº de Franquia</strong> ou pelo <strong>nome</strong>. Mantém a linha mais
            completa e remove as outras, transferindo vínculos antes de excluir.
          </p>

          <div className="flex flex-wrap gap-2 border-t border-amber-200/60 pt-2">
            <button
              type="button"
              disabled={loading !== null}
              onClick={() => void carregarPreview()}
              className={redeBtnDestructiveOutline}
            >
              {loading === 'preview' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              Ver duplicatas
            </button>
            <button
              type="button"
              disabled={loading !== null || (preview !== null && preview.totalRemover === 0)}
              onClick={() => void remover()}
              className={redeBtnDestructive}
            >
              {loading === 'remove' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Remover duplicatas
            </button>
          </div>

          {preview && preview.totalRemover > 0 ? (
            <div className="rounded-md border border-amber-200/80 bg-white/90 px-3 py-2 text-xs text-amber-950">
              <p>
                <strong>{preview.totalRemover}</strong> linha(s) a remover em{' '}
                <strong>{preview.totalGrupos}</strong> grupo(s).
              </p>
              {preview.amostra.length > 0 ? (
                <ul className="mt-1 list-inside list-disc text-amber-900/90">
                  {preview.amostra.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                  {preview.totalGrupos > preview.amostra.length ? <li>…</li> : null}
                </ul>
              ) : null}
            </div>
          ) : null}

          {msg ? (
            <div
              className={msg.tipo === 'ok' ? redeAlertSuccess : redeAlertError}
              role="status"
            >
              {msg.texto}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
