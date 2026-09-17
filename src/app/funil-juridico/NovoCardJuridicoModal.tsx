'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { SearchableSelect } from '@/components/SearchableSelect';
import { criarCard } from '@/lib/actions/card-actions';
import { fetchMunicipiosPorUfs } from '@/lib/ibge';
import { UFS_BRASIL } from '@/lib/uf';
import type { KanbanNomeDisplay } from '@/components/kanban-shared/types';

type Fase = {
  id: string;
  nome: string;
  ordem: number;
};

type ModoAbertura = 'franqueado' | 'candidato';

const inputCls = 'mt-1 w-full px-3 py-2 text-sm';
const inputStyle = {
  border: '0.5px solid var(--moni-border-default)',
  borderRadius: 'var(--moni-radius-md)',
  fontFamily: 'var(--moni-font-sans)',
  color: 'var(--moni-text-primary)',
  background: 'var(--moni-surface-0, #fff)',
  minHeight: '44px',
} as const;

const triggerCls =
  'w-full px-3 py-2 text-sm disabled:opacity-60 border-[0.5px] border-[var(--moni-border-default)] rounded-[var(--moni-radius-md)]';

export function NovoCardJuridicoModal({
  kanbanId,
  kanbanNome,
  basePath = '/funil-juridico',
  onClose,
}: {
  kanbanId: string;
  kanbanNome: KanbanNomeDisplay;
  basePath?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [modo, setModo] = useState<ModoAbertura>('franqueado');

  const [franqueados, setFranqueados] = useState<
    { id: string; n_franquia: string; nome_completo: string }[]
  >([]);
  const [franqueadoRedeId, setFranqueadoRedeId] = useState('');
  const [faseId, setFaseId] = useState('');
  const [fases, setFases] = useState<Fase[]>([]);
  const [nomeCondominio, setNomeCondominio] = useState('');
  const [quadra, setQuadra] = useState('');
  const [lote, setLote] = useState('');

  const [nomeCandidato, setNomeCandidato] = useState('');
  const [estado, setEstado] = useState('');
  const [cidade, setCidade] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [cidades, setCidades] = useState<{ nome: string }[]>([]);
  const [carregandoCidades, setCarregandoCidades] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const supabase = createClient();
        const [{ data: fasesData }, { data: redesData }] = await Promise.all([
          supabase
            .from('kanban_fases')
            .select('id, nome, ordem')
            .eq('kanban_id', kanbanId)
            .eq('ativo', true)
            .order('ordem'),
          supabase.from('rede_franqueados').select('id, n_franquia, nome_completo').order('n_franquia'),
        ]);
        if (fasesData && fasesData.length > 0) {
          setFases(fasesData);
          setFaseId(fasesData[0].id);
        }
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
    })();
  }, [kanbanId]);

  useEffect(() => {
    setCidade('');
    if (!estado) {
      setCidades([]);
      return;
    }
    const controller = new AbortController();
    setCarregandoCidades(true);
    void (async () => {
      try {
        const lista = await fetchMunicipiosPorUfs([estado], controller.signal);
        if (!controller.signal.aborted) {
          setCidades(lista.map((m) => ({ nome: m.nome })));
        }
      } catch {
        if (!controller.signal.aborted) setCidades([]);
      } finally {
        if (!controller.signal.aborted) setCarregandoCidades(false);
      }
    })();
    return () => controller.abort();
  }, [estado]);

  const tituloPreview = useMemo(() => {
    if (modo === 'candidato') {
      const nome = nomeCandidato.trim();
      if (!nome) return '';
      const loc = [cidade.trim(), estado.trim()].filter(Boolean).join('/');
      return loc ? `${nome} — ${loc}` : nome;
    }
    const nFranquiaSelected = franqueados.find((f) => f.id === franqueadoRedeId)?.n_franquia ?? '';
    return [nFranquiaSelected, nomeCondominio.trim(), quadra.trim(), lote.trim()].filter(Boolean).join(' - ');
  }, [
    modo,
    nomeCandidato,
    cidade,
    estado,
    franqueados,
    franqueadoRedeId,
    nomeCondominio,
    quadra,
    lote,
  ]);

  const podeEnviar = useMemo(() => {
    if (!faseId || loading) return false;
    if (modo === 'candidato') {
      return Boolean(nomeCandidato.trim() && estado.trim() && cidade.trim());
    }
    return Boolean(
      franqueadoRedeId || nomeCondominio.trim() || quadra.trim() || lote.trim(),
    );
  }, [faseId, loading, modo, nomeCandidato, estado, cidade, franqueadoRedeId, nomeCondominio, quadra, lote]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!faseId) {
      setErro('Selecione a fase inicial.');
      return;
    }

    if (modo === 'candidato') {
      if (!nomeCandidato.trim()) {
        setErro('Informe o nome do candidato.');
        return;
      }
      if (!estado.trim()) {
        setErro('Selecione o estado.');
        return;
      }
      if (!cidade.trim()) {
        setErro('Selecione a cidade.');
        return;
      }
    } else if (!franqueadoRedeId && !nomeCondominio.trim() && !quadra.trim() && !lote.trim()) {
      setErro('Preencha o franqueado ou condomínio/quadra/lote — ou use a opção Candidato.');
      return;
    }

    const titulo = tituloPreview.trim();
    if (!titulo) {
      setErro('Não foi possível gerar o título do card.');
      return;
    }

    setLoading(true);
    try {
      const res =
        modo === 'candidato'
          ? await criarCard({
              titulo,
              kanban_nome: kanbanNome,
              fase_id: faseId,
              basePath,
              juridicoNomeCandidato: nomeCandidato.trim(),
              juridicoEstado: estado.trim(),
              juridicoCidade: cidade.trim(),
              juridicoObservacoes: observacoes.trim() || undefined,
            })
          : await criarCard({
              titulo,
              kanban_nome: kanbanNome,
              fase_id: faseId,
              basePath,
              nomeCondominio: nomeCondominio.trim() || undefined,
              quadra: quadra.trim() || undefined,
              lote: lote.trim() || undefined,
              redeFranqueadoId: franqueadoRedeId || undefined,
            });

      if (!res.ok) throw new Error(res.error);
      router.refresh();
      onClose();
    } catch (err) {
      console.error('Erro ao criar card:', err);
      setErro(err instanceof Error ? err.message : 'Erro ao criar card. Tente novamente.');
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
        className="relative max-h-[90vh] w-full overflow-y-auto bg-white"
        style={{
          maxWidth: '500px',
          borderRadius: 'var(--moni-radius-xl)',
          border: '0.5px solid var(--moni-border-default)',
          boxShadow: 'var(--moni-shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="novo-card-juridico-titulo"
      >
        <div
          className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4"
          style={{ borderColor: 'var(--moni-border-default)' }}
        >
          <h2
            id="novo-card-juridico-titulo"
            className="text-lg font-bold"
            style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-display)' }}
          >
            Novo Card
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 transition hover:opacity-80"
            style={{ color: 'var(--moni-text-tertiary)', minHeight: '44px', minWidth: '44px' }}
            aria-label="Fechar"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="p-6">
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                Como abrir o card
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(
                  [
                    { id: 'franqueado' as const, label: 'Com franqueado' },
                    { id: 'candidato' as const, label: 'Candidato' },
                  ] as const
                ).map((op) => {
                  const ativo = modo === op.id;
                  return (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => {
                        setModo(op.id);
                        setErro(null);
                      }}
                      className="px-3 py-2 text-sm font-medium transition"
                      style={{
                        minHeight: '44px',
                        borderRadius: 'var(--moni-radius-md)',
                        border: '0.5px solid var(--moni-border-default)',
                        background: ativo ? 'var(--moni-navy-800)' : 'transparent',
                        color: ativo ? '#fff' : 'var(--moni-text-secondary)',
                      }}
                    >
                      {op.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                Franqueado, condomínio, quadra e lote são opcionais neste funil.
              </p>
            </div>

            {modo === 'franqueado' ? (
              <>
                <div>
                  <label className="block text-sm font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                    Franqueado <span className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>(opcional)</span>
                  </label>
                  <SearchableSelect
                    value={franqueadoRedeId}
                    onChange={setFranqueadoRedeId}
                    disabled={loading}
                    placeholder="Selecione o franqueado"
                    searchPlaceholder="Buscar por FK ou nome"
                    size="md"
                    className="mt-1"
                    triggerClassName={triggerCls}
                    options={franqueados.map((f) => ({
                      value: f.id,
                      label: `${f.n_franquia} — ${f.nome_completo}`,
                    }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                    Nome do Condomínio{' '}
                    <span className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>(opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={nomeCondominio}
                    onChange={(e) => setNomeCondominio(e.target.value)}
                    placeholder="Ex: Condomínio Alphaville"
                    className={inputCls}
                    style={inputStyle}
                    disabled={loading}
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                      Quadra <span className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>(opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={quadra}
                      onChange={(e) => setQuadra(e.target.value)}
                      placeholder="Ex: A"
                      className={inputCls}
                      style={inputStyle}
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                      Lote <span className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>(opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={lote}
                      onChange={(e) => setLote(e.target.value)}
                      placeholder="Ex: 12"
                      className={inputCls}
                      style={inputStyle}
                      disabled={loading}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                    Nome do Candidato <span style={{ color: 'var(--moni-status-overdue-text)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={nomeCandidato}
                    onChange={(e) => setNomeCandidato(e.target.value)}
                    placeholder="Nome completo"
                    className={inputCls}
                    style={inputStyle}
                    disabled={loading}
                    maxLength={120}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                    Estado <span style={{ color: 'var(--moni-status-overdue-text)' }}>*</span>
                  </label>
                  <SearchableSelect
                    value={estado}
                    onChange={setEstado}
                    disabled={loading}
                    placeholder="Selecione o estado"
                    searchPlaceholder="Buscar estado"
                    size="md"
                    className="mt-1"
                    triggerClassName={triggerCls}
                    options={UFS_BRASIL.map((uf) => ({
                      value: uf.sigla,
                      label: `${uf.sigla} — ${uf.nome}`,
                    }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                    Cidade <span style={{ color: 'var(--moni-status-overdue-text)' }}>*</span>
                  </label>
                  <SearchableSelect
                    value={cidade}
                    onChange={setCidade}
                    disabled={loading || !estado || carregandoCidades}
                    placeholder={
                      !estado
                        ? 'Selecione o estado primeiro'
                        : carregandoCidades
                          ? 'Carregando cidades…'
                          : 'Selecione a cidade'
                    }
                    searchPlaceholder="Buscar cidade"
                    size="md"
                    className="mt-1"
                    triggerClassName={triggerCls}
                    options={cidades.map((c) => ({ value: c.nome, label: c.nome }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                    Observações/solicitações{' '}
                    <span className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>(opcional)</span>
                  </label>
                  <textarea
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Detalhes da solicitação"
                    className="mt-1 w-full px-3 py-2 text-sm"
                    style={{
                      ...inputStyle,
                      minHeight: '96px',
                      resize: 'vertical',
                    }}
                    disabled={loading}
                    rows={4}
                  />
                </div>
              </>
            )}

            <div>
              <label htmlFor="fase-juridico" className="block text-sm font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                Fase inicial <span style={{ color: 'var(--moni-status-overdue-text)' }}>*</span>
              </label>
              <SearchableSelect
                id="fase-juridico"
                value={faseId}
                onChange={setFaseId}
                disabled={loading}
                placeholder="Selecione a fase"
                searchPlaceholder="Buscar fase"
                size="md"
                className="mt-1"
                triggerClassName={triggerCls}
                options={fases.map((fase) => ({ value: fase.id, label: fase.nome }))}
              />
            </div>

            <div
              className="rounded-lg p-4"
              style={{
                background: 'var(--moni-surface-50)',
                border: '0.5px solid var(--moni-border-default)',
                borderRadius: 'var(--moni-radius-lg)',
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

            {erro ? (
              <p className="text-sm font-medium" style={{ color: 'var(--moni-status-overdue-text)' }} role="alert">
                {erro}
              </p>
            ) : null}

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <button
                type="submit"
                disabled={!podeEnviar}
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
                className="flex-1 px-6 py-2.5 text-sm font-medium transition hover:opacity-80"
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
