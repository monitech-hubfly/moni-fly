'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { criarCardFunding } from '@/lib/actions/card-actions';
import { FundingCardFormFields } from '@/components/kanban-shared/FundingCardFormFields';
import { fundingDraftVazio, type FundingCardDraft } from '@/lib/kanban/funding-card-fields';
import { labelCadastroMoniCapital, type MoniCapitalCadastroRow } from '@/lib/moni-capital-cadastros';

type CadastroModo = 'nenhum' | 'existente' | 'novo';

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
  const [cadastroModo, setCadastroModo] = useState<CadastroModo>('nenhum');
  const [cadastros, setCadastros] = useState<MoniCapitalCadastroRow[]>([]);
  const [cadastroSelecionadoId, setCadastroSelecionadoId] = useState('');
  const [cadastroDraft, setCadastroDraft] = useState({
    broker_nome: '',
    broker_email: '',
    broker_telefone: '',
    investidor_nome: '',
    investidor_email: '',
    investidor_telefone: '',
  });

  useEffect(() => {
    void (async () => {
      const supabase = createClient();
      const [{ data: fases }, { data: rows }] = await Promise.all([
        supabase
          .from('kanban_fases')
          .select('id')
          .eq('kanban_id', kanbanId)
          .eq('ativo', true)
          .order('ordem')
          .limit(1),
        supabase
          .from('moni_capital_cadastros')
          .select('*')
          .is('kanban_card_id', null)
          .order('ordem', { ascending: true }),
      ]);
      const id = String(fases?.[0]?.id ?? '').trim();
      if (id) setFaseId(id);
      setCadastros((rows ?? []) as MoniCapitalCadastroRow[]);
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
    if (cadastroModo === 'existente' && !cadastroSelecionadoId) {
      setErro('Selecione um cadastro Moní Capital.');
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
        moni_capital_cadastro_id:
          cadastroModo === 'existente' ? cadastroSelecionadoId : undefined,
        criarCadastroMoniCapital:
          cadastroModo === 'novo'
            ? {
                broker_nome: cadastroDraft.broker_nome.trim() || null,
                broker_email: cadastroDraft.broker_email.trim() || null,
                broker_telefone: cadastroDraft.broker_telefone.trim() || null,
                investidor_nome: cadastroDraft.investidor_nome.trim() || null,
                investidor_email: cadastroDraft.investidor_email.trim() || null,
                investidor_telefone: cadastroDraft.investidor_telefone.trim() || null,
              }
            : undefined,
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

  const inputCls = 'mt-1 w-full px-3 py-2 text-sm';
  const inputStyle = {
    border: '0.5px solid var(--moni-border-default)',
    borderRadius: 'var(--moni-radius-md)',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative max-h-[90vh] w-full overflow-y-auto bg-white"
        style={{
          maxWidth: '560px',
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
          className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4"
          style={{ borderColor: 'var(--moni-border-default)' }}
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

            <fieldset className="space-y-3 rounded-lg p-4" style={{ border: '0.5px solid var(--moni-border-default)' }}>
              <legend className="px-1 text-sm font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
                Cadastro Moní Capital (opcional)
              </legend>
              <div className="flex flex-wrap gap-2">
                {(['nenhum', 'existente', 'novo'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setCadastroModo(m)}
                    className={`rounded px-2 py-1 text-xs font-medium ${cadastroModo === m ? 'text-white' : 'text-stone-600'}`}
                    style={{
                      background: cadastroModo === m ? 'var(--moni-navy-800)' : 'transparent',
                      border: '0.5px solid var(--moni-border-default)',
                    }}
                  >
                    {m === 'nenhum' ? 'Sem vínculo' : m === 'existente' ? 'Vincular existente' : 'Criar novo'}
                  </button>
                ))}
              </div>

              {cadastroModo === 'existente' ? (
                <select
                  value={cadastroSelecionadoId}
                  onChange={(e) => setCadastroSelecionadoId(e.target.value)}
                  className={inputCls}
                  style={inputStyle}
                  disabled={loading}
                >
                  <option value="">Selecione um cadastro</option>
                  {cadastros.map((c) => (
                    <option key={c.id} value={c.id}>
                      {labelCadastroMoniCapital(c)}
                    </option>
                  ))}
                </select>
              ) : null}

              {cadastroModo === 'novo' ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
                    Broker — nome
                    <input
                      type="text"
                      value={cadastroDraft.broker_nome}
                      onChange={(e) => setCadastroDraft((d) => ({ ...d, broker_nome: e.target.value }))}
                      className={inputCls}
                      style={inputStyle}
                      disabled={loading}
                    />
                  </label>
                  <label className="text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
                    Investidor — nome
                    <input
                      type="text"
                      value={cadastroDraft.investidor_nome}
                      onChange={(e) => setCadastroDraft((d) => ({ ...d, investidor_nome: e.target.value }))}
                      className={inputCls}
                      style={inputStyle}
                      disabled={loading}
                    />
                  </label>
                  <label className="text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
                    Broker — e-mail
                    <input
                      type="email"
                      value={cadastroDraft.broker_email}
                      onChange={(e) => setCadastroDraft((d) => ({ ...d, broker_email: e.target.value }))}
                      className={inputCls}
                      style={inputStyle}
                      disabled={loading}
                    />
                  </label>
                  <label className="text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
                    Investidor — e-mail
                    <input
                      type="email"
                      value={cadastroDraft.investidor_email}
                      onChange={(e) => setCadastroDraft((d) => ({ ...d, investidor_email: e.target.value }))}
                      className={inputCls}
                      style={inputStyle}
                      disabled={loading}
                    />
                  </label>
                </div>
              ) : null}
            </fieldset>

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
