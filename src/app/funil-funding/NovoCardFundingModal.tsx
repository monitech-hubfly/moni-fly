'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { criarCardFunding } from '@/lib/actions/card-actions';
import { FundingCardFormFields } from '@/components/kanban-shared/FundingCardFormFields';
import { fundingDraftVazio, type FundingCardDraft } from '@/lib/kanban/funding-card-fields';

export function NovoCardFundingModal({
  kanbanId,
  basePath = '/funil-funding',
  onClose,
}: {
  kanbanId: string;
  basePath?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [faseId, setFaseId] = useState('');
  const [draft, setDraft] = useState<FundingCardDraft>(() => fundingDraftVazio());

  useEffect(() => {
    void (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('kanban_fases')
        .select('id')
        .eq('kanban_id', kanbanId)
        .eq('ativo', true)
        .order('ordem')
        .limit(1);
      const id = String(data?.[0]?.id ?? '').trim();
      if (id) setFaseId(id);
    })();
  }, [kanbanId]);

  function patchDraft(patch: Partial<FundingCardDraft>) {
    setDraft((d) => ({ ...d, ...patch }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    const nome = draft.funding_nome.trim();
    const tipo = draft.funding_tipo;
    const localizacao = draft.funding_localizacao.trim();

    if (!tipo) {
      setErro('Selecione o tipo.');
      return;
    }
    if (!nome) {
      setErro('Informe o nome.');
      return;
    }
    if (!localizacao) {
      setErro('Informe a localização.');
      return;
    }
    if (!faseId) {
      setErro('Fase inicial não configurada. Recarregue após aplicar a migration.');
      return;
    }

    setLoading(true);
    try {
      const res = await criarCardFunding({
        fase_id: faseId,
        basePath,
        funding_nome: nome,
        funding_tipo: tipo,
        funding_localizacao: localizacao,
        funding_descritivo: draft.funding_descritivo.trim() || undefined,
        funding_proxima_atividade: draft.funding_proxima_atividade.trim() || undefined,
        funding_prazo_atividade: draft.funding_prazo_atividade.trim() || undefined,
      });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      router.refresh();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex w-full max-w-[500px] flex-col overflow-hidden bg-white"
        style={{
          borderRadius: 'var(--moni-radius-xl)',
          border: 'var(--moni-border-width) solid var(--moni-border-default)',
          boxShadow: 'var(--moni-shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="novo-card-funding-titulo"
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{
            background: 'var(--moni-navy-800)',
            color: 'var(--moni-text-inverse)',
          }}
        >
          <h2 id="novo-card-funding-titulo" className="text-base font-bold">
            Novo card — Funding
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 opacity-80 transition hover:bg-white/10 hover:opacity-100"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <FundingCardFormFields draft={draft} onChange={patchDraft} disabled={loading} />
            {erro ? (
              <p className="mt-3 text-xs font-medium text-[var(--moni-status-overdue-text)]">{erro}</p>
            ) : null}
          </div>

          <div
            className="flex shrink-0 justify-end gap-2 border-t px-5 py-4"
            style={{
              borderColor: 'var(--moni-border-default)',
              background: 'var(--moni-kanban-drawer-footer)',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="min-h-[44px] rounded-[var(--moni-radius-md)] border-[length:var(--moni-border-width)] border-[var(--moni-border-default)] bg-white px-4 py-2 text-xs font-semibold text-[var(--moni-text-secondary)] transition hover:bg-[var(--moni-surface-50)] disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="min-h-[44px] rounded-[var(--moni-radius-md)] px-5 py-2 text-xs font-bold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: 'var(--moni-navy-800)' }}
            >
              {loading ? 'Criando…' : 'Criar card'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
