'use client';

import { useEffect, useMemo, useState } from 'react';
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

  const tituloPreview = useMemo(() => {
    const nome = draft.funding_nome.trim();
    if (!nome) return '';
    const tipo = draft.funding_tipo.trim();
    const loc = draft.funding_localizacao.trim();
    return [nome, tipo, loc].filter(Boolean).join(' · ');
  }, [draft.funding_nome, draft.funding_tipo, draft.funding_localizacao]);

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
        proxima_atividade: draft.proxima_atividade.trim() || undefined,
        prazo_atividade: draft.prazo_atividade.trim() || undefined,
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
        className="relative w-full overflow-hidden bg-white"
        style={{
          maxWidth: '500px',
          borderRadius: 'var(--moni-radius-xl)',
          border: '0.5px solid var(--moni-border-default)',
          boxShadow: 'var(--moni-shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="novo-card-funding-titulo"
      >
        <div
          className="flex items-center justify-between border-b bg-white px-6 py-4"
          style={{
            borderColor: 'var(--moni-border-default)',
            borderTopLeftRadius: 'var(--moni-radius-xl)',
            borderTopRightRadius: 'var(--moni-radius-xl)',
          }}
        >
          <h2
            id="novo-card-funding-titulo"
            className="text-lg font-bold"
            style={{ color: 'var(--moni-text-primary)' }}
          >
            Novo Card
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="p-6">
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
            <FundingCardFormFields draft={draft} onChange={patchDraft} disabled={loading} />

            <div
              className="rounded-lg p-4"
              style={{
                background: 'var(--moni-surface-50)',
                border: '0.5px solid var(--moni-border-default)',
              }}
            >
              <p className="mb-2 text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
                PREVIEW DO TÍTULO
              </p>
              <p className="text-sm font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
                {tituloPreview || 'Preencha os campos acima'}
              </p>
              <p className="mt-1 text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                O título do card usará o nome informado
              </p>
            </div>

            {erro ? (
              <p className="text-sm font-medium" style={{ color: 'var(--moni-status-overdue-text)' }} role="alert">
                {erro}
              </p>
            ) : null}

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                style={{
                  background: 'var(--moni-navy-800)',
                  borderRadius: 'var(--moni-radius-md)',
                  minHeight: '44px',
                }}
              >
                {loading ? 'Criando...' : 'Criar Card'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-6 py-2.5 text-sm font-medium transition hover:bg-stone-50"
                style={{
                  background: 'transparent',
                  color: 'var(--moni-text-secondary)',
                  border: '0.5px solid var(--moni-border-default)',
                  borderRadius: 'var(--moni-radius-md)',
                  minHeight: '44px',
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
