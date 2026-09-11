'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  listarPlanilhaLotesDoCard,
  uploadPlanilhaLotesDoCard,
  urlDownloadPlanilhaLotesDoCard,
  type PlanilhaLotesAnexo,
} from '@/lib/actions/loteadores-card-lotes';

type Props = {
  cardId: string;
};

export function KanbanCardModalListaLotes({ cardId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [anexo, setAnexo] = useState<PlanilhaLotesAnexo | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const r = await listarPlanilhaLotesDoCard(cardId);
      if (!r.ok) {
        setErro(r.error);
        setAnexo(null);
        return;
      }
      setAnexo(r.anexo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar a planilha.');
      setAnexo(null);
    } finally {
      setLoading(false);
    }
  }, [cardId]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  async function enviarArquivo(file: File) {
    setUploading(true);
    setErro(null);
    try {
      const fd = new FormData();
      fd.set('cardId', cardId);
      fd.set('file', file);
      const r = await uploadPlanilhaLotesDoCard(fd);
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setAnexo(r.anexo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao enviar o arquivo.');
    } finally {
      setUploading(false);
    }
  }

  async function handleVerLotes() {
    setBaixando(true);
    setErro(null);
    try {
      const r = await urlDownloadPlanilhaLotesDoCard(cardId);
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      const a = document.createElement('a');
      a.href = r.url;
      a.download = r.nome;
      a.rel = 'noopener';
      a.target = '_blank';
      a.click();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao baixar o arquivo.');
    } finally {
      setBaixando(false);
    }
  }

  if (loading) {
    return (
      <p className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Carregando planilha…
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {erro ? (
        <div
          className="rounded-md px-2 py-1.5 text-[11px]"
          style={{
            border: '0.5px solid var(--moni-status-overdue-border)',
            background: 'var(--moni-status-overdue-bg)',
            color: 'var(--moni-status-overdue-text)',
          }}
          role="alert"
        >
          {erro}
        </div>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void enviarArquivo(f);
          e.target.value = '';
        }}
      />

      {!anexo ? (
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-md px-3 py-1.5 text-xs font-medium sm:min-h-0"
          style={{
            background: 'var(--moni-navy-800)',
            color: 'var(--moni-text-inverse)',
          }}
        >
          {uploading ? 'Enviando…' : 'Anexar planilha de lotes'}
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px]" style={{ color: 'var(--moni-text-secondary)' }}>
            {anexo.nome}
            {anexo.enviadoEmLabel ? ` · enviado em ${anexo.enviadoEmLabel}` : ''}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={baixando || uploading}
              onClick={() => void handleVerLotes()}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-md px-3 py-1.5 text-xs font-medium sm:min-h-0"
              style={{
                background: 'var(--moni-navy-800)',
                color: 'var(--moni-text-inverse)',
              }}
            >
              {baixando ? 'Baixando…' : 'Ver Lotes'}
            </button>
            <button
              type="button"
              disabled={uploading || baixando}
              onClick={() => inputRef.current?.click()}
              className="inline-flex min-h-[44px] items-center justify-center rounded-md px-2 py-1 text-[11px] font-medium sm:min-h-0"
              style={{
                border: '0.5px solid var(--moni-border-default)',
                background: 'var(--moni-surface-0)',
                color: 'var(--moni-text-secondary)',
              }}
            >
              {uploading ? 'Enviando…' : 'Substituir'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
