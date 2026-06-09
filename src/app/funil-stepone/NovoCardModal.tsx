'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { SearchableSelect } from '@/components/SearchableSelect';

type Fase = {
  id: string;
  nome: string;
  ordem: number;
};

export type TipoOrigemNovoCard = 'via_step_one' | 'hipotese_direta';

export function NovoCardModal({
  kanbanId,
  onClose,
  isAdmin,
  showTipoOrigem = false,
}: {
  kanbanId: string;
  onClose: () => void;
  isAdmin: boolean;
  /** Portfolio: campo informativo de origem (hipótese direta só admin/team). */
  showTipoOrigem?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [franqueados, setFranqueados] = useState<
    { id: string; n_franquia: string; nome_completo: string }[]
  >([]);
  const [franqueadoNome, setFranqueadoNome] = useState('');
  const [franqueadoRedeId, setFranqueadoRedeId] = useState('');
  const [faseId, setFaseId] = useState('');
  const [fases, setFases] = useState<Fase[]>([]);
  const [nomeCondominio, setNomeCondominio] = useState('');
  const [quadra, setQuadra] = useState('');
  const [lote, setLote] = useState('');
  const [tituloPreview, setTituloPreview] = useState('');
  const [tipoOrigem, setTipoOrigem] = useState<TipoOrigemNovoCard>('via_step_one');

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const nFranquiaSelected = franqueados.find((f) => f.id === franqueadoRedeId)?.n_franquia ?? '';
    const partes = [nFranquiaSelected, nomeCondominio.trim(), quadra.trim(), lote.trim()].filter(Boolean);
    setTituloPreview(partes.join(' - '));
  }, [franqueadoRedeId, franqueados, nomeCondominio, quadra, lote]);

  async function loadData() {
    try {
      const supabase = createClient();

      // Busca as fases
      const { data: fasesData } = await supabase
        .from('kanban_fases')
        .select('id, nome, ordem')
        .eq('kanban_id', kanbanId)
        .eq('ativo', true)
        .order('ordem');

      if (fasesData && fasesData.length > 0) {
        setFases(fasesData);
        setFaseId(fasesData[0].id); // Primeira fase como padrão
      }

      const { data: redesData } = await supabase
        .from('rede_franqueados')
        .select('id, n_franquia, nome_completo')
        .order('n_franquia');
      setFranqueados(
        redesData?.map((r) => ({
          id: String(r.id),
          n_franquia: String((r as { n_franquia?: string | null }).n_franquia ?? ''),
          nome_completo: String((r as { nome_completo?: string | null }).nome_completo ?? ''),
        })) ?? [],
      );
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!franqueadoRedeId || !faseId) return;

    setLoading(true);
    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const nFranquiaSelected = franqueados.find((f) => f.id === franqueadoRedeId)?.n_franquia ?? '';
      const partes = [nFranquiaSelected, nomeCondominio.trim(), quadra.trim(), lote.trim()].filter(Boolean);
      const tituloAuto = partes.join(' - ');

      const insertPayload: Record<string, unknown> = {
        kanban_id: kanbanId,
        fase_id: faseId,
        franqueado_id: user.id,
        rede_franqueado_id: franqueadoRedeId || null,
        titulo: tituloAuto,
        status: 'ativo',
      };
      if (showTipoOrigem && isAdmin && tipoOrigem === 'hipotese_direta') {
        insertPayload.origem_tipo = 'hipotese_direta';
      }

      const { error } = await supabase.from('kanban_cards').insert(insertPayload);

      if (error) throw error;

      if (nomeCondominio.trim() || quadra.trim() || lote.trim()) {
        const { data: cardCriado } = await supabase
          .from('kanban_cards')
          .select('id')
          .eq('kanban_id', kanbanId)
          .eq('titulo', tituloAuto)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cardCriado) {
          await supabase
            .from('kanban_cards')
            .update({
              nome_condominio: nomeCondominio.trim() || null,
              quadra: quadra.trim() || null,
              lote: lote.trim() || null,
            })
            .eq('id', (cardCriado as { id: string }).id);
        }
      }

      router.refresh();
      onClose();
    } catch (err) {
      console.error('Erro ao criar card:', err);
      alert('Erro ao criar card. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
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
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b bg-white px-6 py-4"
          style={{
            borderColor: 'var(--moni-border-default)',
            borderTopLeftRadius: 'var(--moni-radius-xl)',
            borderTopRightRadius: 'var(--moni-radius-xl)',
          }}
        >
          <h2 className="text-lg font-bold" style={{ color: 'var(--moni-text-primary)' }}>
            Novo Card
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Campo Franqueado (apenas para admin) */}
            <div>
              <label className="block text-sm font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                Franqueado <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={franqueadoRedeId}
                onChange={(id) => {
                  const selected = franqueados.find((f) => f.id === id);
                  setFranqueadoRedeId(id);
                  setFranqueadoNome(selected?.nome_completo ?? '');
                }}
                disabled={loading}
                placeholder="Selecione o franqueado"
                searchPlaceholder="Buscar por FK ou nome"
                size="md"
                className="mt-1"
                triggerClassName="rounded-lg border border-stone-300 px-3 py-2 text-sm"
                options={franqueados.map((f) => ({
                  value: f.id,
                  label: `${f.n_franquia} — ${f.nome_completo}`,
                }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                Nome do Condomínio <span className="text-stone-400 text-xs">(opcional)</span>
              </label>
              <input
                type="text"
                value={nomeCondominio}
                onChange={(e) => setNomeCondominio(e.target.value)}
                placeholder="Ex: Condomínio Alphaville"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                disabled={loading}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                  Quadra <span className="text-stone-400 text-xs">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={quadra}
                  onChange={(e) => setQuadra(e.target.value)}
                  placeholder="Ex: A"
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                  Lote <span className="text-stone-400 text-xs">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={lote}
                  onChange={(e) => setLote(e.target.value)}
                  placeholder="Ex: 12"
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  disabled={loading}
                />
              </div>
            </div>

            {showTipoOrigem && isAdmin ? (
              <div>
                <label className="block text-sm font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                  Origem do card
                </label>
                <SearchableSelect
                  value={tipoOrigem}
                  onChange={(v) => setTipoOrigem(v as TipoOrigemNovoCard)}
                  disabled={loading}
                  size="md"
                  className="mt-1"
                  emptyOption={null}
                  triggerClassName="rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  options={[
                    { value: 'via_step_one', label: 'Via Step One' },
                    { value: 'hipotese_direta', label: 'Hipótese direta' },
                  ]}
                />
                <p className="mt-1 text-xs text-stone-500">
                  Informativo para o time. &ldquo;Via Step One&rdquo; é o fluxo padrão.
                </p>
              </div>
            ) : null}

            {/* Campo Fase Inicial */}
            <div>
              <label htmlFor="fase" className="block text-sm font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                Fase inicial <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                id="fase"
                value={faseId}
                onChange={setFaseId}
                disabled={loading}
                placeholder="Selecione a fase"
                searchPlaceholder="Buscar fase"
                size="md"
                className="mt-1"
                triggerClassName="w-full px-4 py-2 text-sm disabled:bg-stone-50 border-[0.5px] border-[var(--moni-border-default)] rounded-[var(--moni-radius-md)]"
                options={fases.map((fase) => ({ value: fase.id, label: fase.nome }))}
              />
            </div>

            {/* Preview do Título Automático */}
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
                O título será gerado automaticamente ao criar o card
              </p>
            </div>

            {/* Botões */}
            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <button
                type="submit"
                disabled={loading || !faseId || !franqueadoRedeId}
                className="flex-1 px-6 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                style={{
                  background: 'var(--moni-navy-800)',
                  borderRadius: 'var(--moni-radius-md)',
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
