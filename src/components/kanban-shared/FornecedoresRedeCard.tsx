'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  atualizarVinculoCotacao,
  criarFornecedorRedeEVincular,
  listarFornecedoresRede,
  listarVinculosFornecedorCard,
  vincularFornecedorExistenteAoCard,
  type FornecedorCardVinculo,
  type FornecedorRede,
  type FornecedorRedeInput,
} from '@/lib/actions/fornecedores-rede';
import {
  normalizeBuscaKanbanTexto,
  textoMatchBuscaKanbanPalavras,
} from '@/components/kanban-shared/kanbanBoardFiltros';

type Props = {
  cardId: string;
};

const STATUS_COTACAO = ['em_avaliacao', 'aprovado', 'reprovado', 'perdido'] as const;

const campoStyle: CSSProperties = {
  border: 'var(--moni-border-width) solid var(--moni-border-default)',
  borderRadius: 'var(--moni-radius-md)',
  color: 'var(--moni-text-secondary)',
  fontFamily: 'var(--moni-font-sans)',
  background: 'var(--moni-surface-0, #fff)',
};

const labelStyle: CSSProperties = {
  color: 'var(--moni-text-primary)',
  fontFamily: 'var(--moni-font-sans)',
};

const VAZIO_FORM: FornecedorRedeInput = {
  nome: '',
  categoria: '',
  produtos: '',
  regiao_atuacao: '',
  prazo_entrega: '',
  frete_proprio: false,
  frete_tipo: null,
  fatura_para_spe: false,
  contato_responsavel: '',
  dados_empresa_anexo_url: '',
  volume_suportado: '',
  margem_loja_moni: null,
  forma_pagamento: '',
  prazo_garantia: '',
  politica_troca: '',
  ncm: '',
  anexo_proposta_url: '',
  status: 'em_avaliacao',
};

/** Cadastro / busca de Fornecedores em Rede — reutilizável entre funis. */
export function FornecedoresRedeCard({ cardId }: Props) {
  const [busca, setBusca] = useState('');
  const [lista, setLista] = useState<FornecedorRede[]>([]);
  const [vinculos, setVinculos] = useState<FornecedorCardVinculo[]>([]);
  const [formAberto, setFormAberto] = useState(false);
  const [form, setForm] = useState<FornecedorRedeInput>(VAZIO_FORM);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    const [rLista, rVinc] = await Promise.all([
      listarFornecedoresRede(),
      listarVinculosFornecedorCard(cardId),
    ]);
    if (!rLista.ok) setErro(rLista.error);
    else setLista(rLista.data);
    if (!rVinc.ok) setErro(rVinc.error);
    else setVinculos(rVinc.data);
    setCarregando(false);
  }, [cardId]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const idsVinculados = useMemo(
    () => new Set(vinculos.map((v) => v.fornecedor_id)),
    [vinculos],
  );

  const filtrados = useMemo(() => {
    const q = normalizeBuscaKanbanTexto(busca);
    if (!q) return lista;
    return lista.filter((f) => {
      const blob = [f.nome, f.categoria, f.regiao_atuacao, f.produtos]
        .map((x) => String(x ?? ''))
        .join(' ');
      return textoMatchBuscaKanbanPalavras(blob, busca);
    });
  }, [lista, busca]);

  async function selecionarExistente(fornecedorId: string) {
    setSalvando(true);
    setErro(null);
    const res = await vincularFornecedorExistenteAoCard({ cardId, fornecedorId });
    setSalvando(false);
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    await recarregar();
  }

  async function salvarNovo() {
    if (!String(form.nome ?? '').trim()) {
      setErro('Informe o nome do fornecedor.');
      return;
    }
    setSalvando(true);
    setErro(null);
    const payload: FornecedorRedeInput = {
      ...form,
      frete_tipo: form.frete_proprio ? form.frete_tipo : null,
    };
    const res = await criarFornecedorRedeEVincular({ cardId, fornecedor: payload });
    setSalvando(false);
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    setForm(VAZIO_FORM);
    setFormAberto(false);
    await recarregar();
  }

  async function patchVinculo(
    vinculoId: string,
    patch: {
      nps_cotacao?: number | null;
      status_cotacao?: string | null;
      motivo_perda_cotacao?: string | null;
    },
  ) {
    const res = await atualizarVinculoCotacao({ vinculoId, ...patch });
    if (!res.ok) setErro(res.error);
    else await recarregar();
  }

  return (
    <div
      className="space-y-4 rounded-lg p-4"
      style={{
        border: 'var(--moni-border-width) solid var(--moni-border-default)',
        borderRadius: 'var(--moni-radius-lg)',
        background: 'var(--moni-surface-50)',
        boxShadow: 'var(--moni-shadow-card)',
        fontFamily: 'var(--moni-font-sans)',
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold" style={labelStyle}>
          Fornecedores em Rede Casa Moní
        </h4>
        <button
          type="button"
          onClick={() => setFormAberto((v) => !v)}
          className="px-3 text-xs font-medium text-white"
          style={{
            background: 'var(--moni-navy-800)',
            borderRadius: 'var(--moni-radius-md)',
            minHeight: 44,
          }}
        >
          + Novo Fornecedor
        </button>
      </div>

      <input
        type="search"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome, categoria ou região…"
        className="w-full px-2 py-2 text-sm"
        style={campoStyle}
      />

      {erro ? (
        <p className="text-xs" style={{ color: 'var(--moni-error, #8B3A3A)' }}>
          {erro}
        </p>
      ) : null}

      {formAberto ? (
        <div
          className="grid gap-2 sm:grid-cols-2"
          style={{
            border: 'var(--moni-border-width) solid var(--moni-border-default)',
            borderRadius: 'var(--moni-radius-md)',
            padding: 12,
            background: 'var(--moni-surface-0, #fff)',
          }}
        >
          {(
            [
              ['nome', 'Nome do Fornecedor *'],
              ['categoria', 'Categoria / Grupo de fornecimento'],
              ['produtos', 'Produtos oferecidos'],
              ['regiao_atuacao', 'Região de atuação'],
              ['prazo_entrega', 'Prazo de entrega'],
              ['contato_responsavel', 'Contato do responsável'],
              ['dados_empresa_anexo_url', 'Dados da empresa (link/anexo)'],
              ['volume_suportado', 'Volume suportado'],
              ['forma_pagamento', 'Forma de pagamento'],
              ['prazo_garantia', 'Prazo de garantia'],
              ['politica_troca', 'Política de troca'],
              ['ncm', 'NCM'],
              ['anexo_proposta_url', 'Anexo da proposta (URL)'],
            ] as const
          ).map(([key, lab]) => (
            <label key={key} className="flex flex-col gap-1 text-[11px]" style={labelStyle}>
              {lab}
              <input
                className="px-2 py-1.5 text-xs"
                style={campoStyle}
                value={String(form[key] ?? '')}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            </label>
          ))}

          <label className="flex flex-col gap-1 text-[11px]" style={labelStyle}>
            Margem Loja Moní
            <input
              type="number"
              className="px-2 py-1.5 text-xs"
              style={campoStyle}
              value={form.margem_loja_moni ?? ''}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  margem_loja_moni: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
            />
          </label>

          <label className="flex items-center gap-2 text-[11px]" style={labelStyle}>
            <input
              type="checkbox"
              checked={Boolean(form.frete_proprio)}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  frete_proprio: e.target.checked,
                  frete_tipo: e.target.checked ? f.frete_tipo ?? 'fixo' : null,
                }))
              }
            />
            Frete próprio
          </label>

          {form.frete_proprio ? (
            <label className="flex flex-col gap-1 text-[11px]" style={labelStyle}>
              Tipo de frete
              <select
                className="px-2 py-1.5 text-xs"
                style={campoStyle}
                value={form.frete_tipo ?? 'fixo'}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    frete_tipo: e.target.value as 'fixo' | 'variavel',
                  }))
                }
              >
                <option value="fixo">Fixo</option>
                <option value="variavel">Variável</option>
              </select>
            </label>
          ) : null}

          <label className="flex items-center gap-2 text-[11px]" style={labelStyle}>
            <input
              type="checkbox"
              checked={Boolean(form.fatura_para_spe)}
              onChange={(e) => setForm((f) => ({ ...f, fatura_para_spe: e.target.checked }))}
            />
            Fatura para SPE
          </label>

          <div className="sm:col-span-2 flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={salvando}
              onClick={() => void salvarNovo()}
              className="px-3 text-xs font-medium text-white"
              style={{
                background: 'var(--moni-navy-800)',
                borderRadius: 'var(--moni-radius-md)',
                minHeight: 44,
              }}
            >
              {salvando ? 'Salvando…' : 'Salvar e vincular'}
            </button>
            <button
              type="button"
              onClick={() => {
                setFormAberto(false);
                setForm(VAZIO_FORM);
              }}
              className="px-3 text-xs"
              style={{
                border: 'var(--moni-border-width) solid var(--moni-border-default)',
                borderRadius: 'var(--moni-radius-md)',
                minHeight: 44,
                color: 'var(--moni-text-secondary)',
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-[11px] font-medium" style={{ color: 'var(--moni-text-tertiary)' }}>
          Resultados da busca {carregando ? '(carregando…)' : `(${filtrados.length})`}
        </p>
        <ul className="max-h-48 space-y-1 overflow-y-auto">
          {filtrados.map((f) => {
            const ja = idsVinculados.has(f.id);
            return (
              <li
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-2 px-2 py-1.5"
                style={{
                  border: 'var(--moni-border-width) solid var(--moni-border-default)',
                  borderRadius: 'var(--moni-radius-md)',
                  background: 'var(--moni-surface-0, #fff)',
                }}
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium" style={labelStyle}>
                    {f.nome || '—'}
                  </p>
                  <p className="truncate text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
                    {[f.categoria, f.regiao_atuacao].filter(Boolean).join(' · ') || 'Sem categoria/região'}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={ja || salvando}
                  onClick={() => void selecionarExistente(f.id)}
                  className="shrink-0 px-2 text-[11px] font-medium"
                  style={{
                    minHeight: 44,
                    borderRadius: 'var(--moni-radius-md)',
                    border: 'var(--moni-border-width) solid var(--moni-border-default)',
                    color: ja ? 'var(--moni-text-tertiary)' : 'var(--moni-navy-800)',
                    background: 'transparent',
                  }}
                >
                  {ja ? 'Vinculado' : 'Vincular'}
                </button>
              </li>
            );
          })}
          {!carregando && filtrados.length === 0 ? (
            <li className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
              Nenhum fornecedor encontrado.
            </li>
          ) : null}
        </ul>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-medium" style={labelStyle}>
          Vinculados a este card ({vinculos.length})
        </p>
        <ul className="space-y-2">
          {vinculos.map((v) => {
            const nome = v.fornecedor?.nome ?? 'Fornecedor';
            return (
              <li
                key={v.id}
                className="space-y-2 p-3"
                style={{
                  border: 'var(--moni-border-width) solid var(--moni-border-default)',
                  borderRadius: 'var(--moni-radius-md)',
                  background: 'var(--moni-surface-0, #fff)',
                }}
              >
                <p className="text-xs font-medium" style={labelStyle}>
                  {nome}
                </p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <label className="flex flex-col gap-1 text-[10px]" style={labelStyle}>
                    NPS da cotação
                    <input
                      type="number"
                      className="px-2 py-1.5 text-xs"
                      style={campoStyle}
                      value={v.nps_cotacao ?? ''}
                      onChange={(e) => {
                        const n = e.target.value === '' ? null : Number(e.target.value);
                        setVinculos((prev) =>
                          prev.map((x) => (x.id === v.id ? { ...x, nps_cotacao: n } : x)),
                        );
                      }}
                      onBlur={(e) => {
                        const n = e.target.value === '' ? null : Number(e.target.value);
                        void patchVinculo(v.id, { nps_cotacao: n });
                      }}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[10px]" style={labelStyle}>
                    Status
                    <select
                      className="px-2 py-1.5 text-xs"
                      style={campoStyle}
                      value={v.status_cotacao ?? 'em_avaliacao'}
                      onChange={(e) => {
                        const status_cotacao = e.target.value;
                        setVinculos((prev) =>
                          prev.map((x) => (x.id === v.id ? { ...x, status_cotacao } : x)),
                        );
                        void patchVinculo(v.id, { status_cotacao });
                      }}
                    >
                      {STATUS_COTACAO.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-[10px]" style={labelStyle}>
                    Motivo de perda
                    <input
                      className="px-2 py-1.5 text-xs"
                      style={campoStyle}
                      value={v.motivo_perda_cotacao ?? ''}
                      onChange={(e) => {
                        const motivo_perda_cotacao = e.target.value;
                        setVinculos((prev) =>
                          prev.map((x) => (x.id === v.id ? { ...x, motivo_perda_cotacao } : x)),
                        );
                      }}
                      onBlur={(e) =>
                        void patchVinculo(v.id, { motivo_perda_cotacao: e.target.value })
                      }
                    />
                  </label>
                </div>
              </li>
            );
          })}
          {vinculos.length === 0 ? (
            <li className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
              Nenhum fornecedor vinculado ainda.
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
