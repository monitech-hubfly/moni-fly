'use client';

import { type CSSProperties, useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Search } from 'lucide-react';
import {
  listarCondominiosCadastro,
  sincronizarProspectComCadastro,
} from '@/lib/actions/kanban-card-condominio';
import {
  COLUNAS_TABELA_PROSPECT,
  confirmarLinhaProspectCadastroLocal,
  extrairCamposPesquisaGlobal,
  gerarRowIdProspect,
  LINHA_PROSPECT_VAZIA,
  linhaProspectAlteradaDesdeCarregamento,
  linhaProspectCadastroOk,
  linhaProspectCadastroPendente,
  linhaProspectDeCondominioRow,
  marcarLinhaProspectCadastroPendente,
  ordenarLinhasProspectPorTicketCasas,
  parseLinhasProspectCondominio,
  serializarLinhasProspectCondominio,
  type LinhaProspectCondominio,
} from '@/lib/kanban/condominio-prospect-pesquisa';
import { ticketMedioFaixaPreenchido } from '@/lib/kanban/ticket-medio-faixa';
import type { PracaCidade } from '@/lib/kanban/dados-cidade-praca-multi';
import {
  condominioRowMatchesBusca,
  condominioRowNaPraca,
  ordenarCondominiosPorNome,
  type CondominioRow,
} from '@/lib/condominios';
import type { FaseChecklistItem } from '@/lib/actions/card-actions';

type EstadoResposta = {
  valor: string;
  salvando: boolean;
};

type Props = {
  item: FaseChecklistItem;
  estado: EstadoResposta;
  onChange: (valor: string) => void;
  onBlur: (valor: string) => void;
  /** Praça da sessão (aba ou cidade/estado do checklist) — filtra o cadastro na busca. */
  pracaCidade?: PracaCidade | null;
};

export function TabelaCondominiosProspect({ item, estado, onChange, onBlur, pracaCidade = null }: Props) {
  const [linhas, setLinhas] = useState<LinhaProspectCondominio[]>(() =>
    parseLinhasProspectCondominio(estado.valor),
  );
  const [cadastro, setCadastro] = useState<CondominioRow[]>([]);
  const [loadingCadastro, setLoadingCadastro] = useState(true);
  const [buscaPorLinha, setBuscaPorLinha] = useState<Record<string, string>>({});
  const [pickerAberto, setPickerAberto] = useState<string | null>(null);
  const [salvandoLinha, setSalvandoLinha] = useState<string | null>(null);
  const [erroLinha, setErroLinha] = useState<Record<string, string>>({});

  const carregarCadastro = useCallback(async () => {
    setLoadingCadastro(true);
    try {
      setCadastro(ordenarCondominiosPorNome(await listarCondominiosCadastro()));
    } catch {
      setCadastro([]);
    } finally {
      setLoadingCadastro(false);
    }
  }, []);

  useEffect(() => {
    void carregarCadastro();
  }, [carregarCadastro]);

  const cadastroDaPraca = useMemo(() => {
    if (!pracaCidade) return [];
    return cadastro.filter((r) => condominioRowNaPraca(r, pracaCidade));
  }, [cadastro, pracaCidade]);

  function persistir(novas: LinhaProspectCondominio[], blur = false) {
    const finais = blur ? ordenarLinhasProspectPorTicketCasas(novas) : novas;
    setLinhas(finais);
    const json = serializarLinhasProspectCondominio(finais);
    onChange(json);
    if (blur) onBlur(json);
  }

  function atualizarLinha(idx: number, patch: Partial<LinhaProspectCondominio>, blur = false) {
    const novas = linhas.map((l, i) => {
      if (i !== idx) return l;
      const merged = { ...l, ...patch };
      if (
        patch.condominio !== undefined ||
        patch.descricao_breve !== undefined ||
        patch.ticket_lote !== undefined ||
        patch.ticket_casas !== undefined ||
        patch.ticket_m2 !== undefined ||
        patch.estimativa_giro !== undefined
      ) {
        return marcarLinhaProspectCadastroPendente(merged);
      }
      return merged;
    });
    persistir(novas, blur);
  }

  function adicionarLinha() {
    if (linhas.length >= 20) return;
    persistir([...linhas, { row_id: gerarRowIdProspect(), ...LINHA_PROSPECT_VAZIA }], true);
  }

  function removerLinha(idx: number) {
    const novas = linhas.filter((_, i) => i !== idx);
    const semVazias =
      novas.length === 0 ? [{ row_id: gerarRowIdProspect(), ...LINHA_PROSPECT_VAZIA }] : novas;
    persistir(semVazias, true);
  }

  function selecionarCadastro(idx: number, row: CondominioRow) {
    const atual = linhas[idx];
    const nova = linhaProspectDeCondominioRow(row, atual.row_id, {
      pesquisa_preenchida_em: atual.pesquisa_preenchida_em,
      ...extrairCamposPesquisaGlobal(atual),
      faixas: atual.faixas,
      lotes_disponiveis: atual.lotes_disponiveis,
      lotes_preenchidos_em: atual.lotes_preenchidos_em,
    });
    const novas = linhas.map((l, i) => (i === idx ? nova : l));
    setPickerAberto(null);
    setBuscaPorLinha((prev) => ({ ...prev, [nova.row_id]: '' }));
    persistir(novas, true);
  }

  async function confirmarLinha(idx: number) {
    const linha = linhas[idx];
    if (!linha.condominio?.trim()) return;

    if (!ticketMedioFaixaPreenchido(linha.ticket_lote)) {
      setErroLinha((prev) => ({
        ...prev,
        [linha.row_id]: 'Preencha Ticket Médio lote no formato entre R$ … e R$ …',
      }));
      return;
    }
    if (!ticketMedioFaixaPreenchido(linha.ticket_casas)) {
      setErroLinha((prev) => ({
        ...prev,
        [linha.row_id]: 'Preencha Ticket Médio casas no formato entre R$ … e R$ …',
      }));
      return;
    }
    if (!ticketMedioFaixaPreenchido(linha.ticket_m2)) {
      setErroLinha((prev) => ({
        ...prev,
        [linha.row_id]: 'Preencha Ticket Médio casas R$/m² no formato entre R$ … e R$ …',
      }));
      return;
    }

    const alterada = linhaProspectAlteradaDesdeCarregamento(linha);
    const apenasConfirmar = Boolean(linha.condominio_id) && !alterada;

    setSalvandoLinha(linha.row_id);
    setErroLinha((prev) => ({ ...prev, [linha.row_id]: '' }));

    try {
      const res = await sincronizarProspectComCadastro({
        condominioId: linha.condominio_id,
        nome: linha.condominio,
        descricao_breve: linha.descricao_breve ?? '',
        ticket_lote: linha.ticket_lote,
        ticket_casas: linha.ticket_casas,
        ticket_m2: linha.ticket_m2,
        estimativa_giro: linha.estimativa_giro,
        apenasConfirmar,
        cidade: pracaCidade?.cidade ?? null,
        estado: pracaCidade?.uf ?? null,
      });

      if (!res.ok) {
        setErroLinha((prev) => ({ ...prev, [linha.row_id]: res.error }));
        return;
      }

      await carregarCadastro();
      const confirmada = confirmarLinhaProspectCadastroLocal(linha, res.condominioId);
      const novas = linhas.map((l, i) => (i === idx ? confirmada : l));
      persistir(novas, true);
    } finally {
      setSalvandoLinha(null);
    }
  }

  const cellStyle: CSSProperties = {
    border: '1px solid var(--moni-border-default)',
    padding: 0,
    verticalAlign: 'top',
  };

  const inputCellStyle: CSSProperties = {
    width: '100%',
    border: 'none',
    outline: 'none',
    padding: '4px 8px',
    background: 'transparent',
    fontSize: '0.75rem',
    color: 'var(--moni-text-primary)',
    minWidth: 90,
  };

  const opcoesPorLinha = useMemo(() => {
    const map = new Map<string, CondominioRow[]>();
    for (const linha of linhas) {
      const q = (buscaPorLinha[linha.row_id] ?? '').trim();
      const base = q ? cadastroDaPraca.filter((r) => condominioRowMatchesBusca(r, q)) : [];
      map.set(linha.row_id, base.slice(0, 30));
    }
    return map;
  }, [linhas, buscaPorLinha, cadastroDaPraca]);

  function rotuloAcao(linha: LinhaProspectCondominio): string {
    if (!linha.condominio_id) return 'Cadastrar no Rede → Condomínios';
    if (linhaProspectAlteradaDesdeCarregamento(linha)) return 'Atualizar cadastro';
    return 'Confirmar dados do cadastro';
  }

  return (
    <div>
      <span className="mb-2 block text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
        {item.label}
        {item.obrigatorio && <span className="ml-1 text-red-500">*</span>}
        {estado.salvando && <Loader2 size={10} className="ml-1 inline animate-spin" />}
      </span>
      <p className="mb-2 text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
        {item.placeholder ??
          'Selecione condomínios do cadastro (Rede → Condomínios) ou cadastre novos. Tickets no formato entre R$ … e R$ …; confirme ou atualize o cadastro em cada linha.'}
      </p>
      {!pracaCidade ? (
        <p className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Selecione a praça (aba) ou preencha <strong>Cidade de interesse</strong> e <strong>Estado</strong> para
          buscar condomínios desta cidade.
        </p>
      ) : (
        <p className="mb-2 text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
          Exibindo condomínios cadastrados em{' '}
          <strong>
            {pracaCidade.cidade}/{pracaCidade.uf}
          </strong>
          .
        </p>
      )}
      {loadingCadastro ? (
        <div className="mb-2 flex items-center gap-2 text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
          <Loader2 size={12} className="animate-spin" />
          Carregando cadastro de condomínios…
        </div>
      ) : null}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
          <thead>
            <tr>
              {COLUNAS_TABELA_PROSPECT.map((col) => (
                <th
                  key={col.key}
                  style={{
                    border: '1px solid var(--moni-border-default)',
                    padding: '6px 8px',
                    textAlign: 'left',
                    fontWeight: 600,
                    background: 'var(--moni-surface-100)',
                    whiteSpace: 'nowrap',
                    color: 'var(--moni-text-secondary)',
                  }}
                >
                  {col.header}
                </th>
              ))}
              <th
                style={{
                  border: '1px solid var(--moni-border-default)',
                  padding: '6px 8px',
                  textAlign: 'left',
                  fontWeight: 600,
                  background: 'var(--moni-surface-100)',
                  whiteSpace: 'nowrap',
                  color: 'var(--moni-text-secondary)',
                  minWidth: 140,
                }}
              >
                Cadastro
              </th>
              <th
                style={{
                  border: '1px solid var(--moni-border-default)',
                  padding: '6px 4px',
                  width: 28,
                  background: 'var(--moni-surface-100)',
                }}
              />
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha, idx) => {
              const opcoes = opcoesPorLinha.get(linha.row_id) ?? [];
              const pickerOpen = pickerAberto === linha.row_id;
              const buscaLinha = (buscaPorLinha[linha.row_id] ?? '').trim();
              const pendente = linhaProspectCadastroPendente(linha);
              const ok = linhaProspectCadastroOk(linha);
              const salvando = salvandoLinha === linha.row_id;

              return (
                <tr key={linha.row_id}>
                  <td style={{ ...cellStyle, minWidth: 180, padding: '4px 6px' }}>
                    <div className="relative">
                      <div className="relative">
                        <Search
                          size={11}
                          className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2"
                          style={{ color: 'var(--moni-text-tertiary)' }}
                        />
                        <input
                          type="search"
                          value={pickerOpen ? (buscaPorLinha[linha.row_id] ?? linha.condominio) : linha.condominio}
                          placeholder="Buscar ou digitar nome…"
                          style={{ ...inputCellStyle, paddingLeft: 22 }}
                          onFocus={() => {
                            setPickerAberto(linha.row_id);
                            setBuscaPorLinha((prev) => ({
                              ...prev,
                              [linha.row_id]: prev[linha.row_id] ?? linha.condominio,
                            }));
                          }}
                          onChange={(e) => {
                            const v = e.target.value;
                            setBuscaPorLinha((prev) => ({ ...prev, [linha.row_id]: v }));
                            setPickerAberto(linha.row_id);
                            atualizarLinha(idx, { condominio: v, condominio_id: null });
                          }}
                          onBlur={() => {
                            window.setTimeout(() => {
                              setPickerAberto((atual) => (atual === linha.row_id ? null : atual));
                            }, 150);
                          }}
                        />
                      </div>
                      {pickerOpen && buscaLinha && opcoes.length > 0 ? (
                        <ul
                          className="absolute z-20 mt-0.5 max-h-36 w-full overflow-y-auto rounded border bg-white shadow-sm"
                          style={{ borderColor: 'var(--moni-border-default)' }}
                        >
                          {opcoes.map((r) => (
                            <li key={r.id}>
                              <button
                                type="button"
                                className="w-full px-2 py-1.5 text-left text-xs hover:bg-stone-50"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => selecionarCadastro(idx, r)}
                              >
                                {r.nome}
                                {r.cidade ? (
                                  <span className="ml-1 text-[10px] text-stone-500">
                                    — {r.cidade}
                                    {r.estado ? `/${r.estado}` : ''}
                                  </span>
                                ) : null}
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </td>
                  {COLUNAS_TABELA_PROSPECT.slice(1).map((col) => (
                    <td
                      key={col.key}
                      style={{
                        ...cellStyle,
                        minWidth: col.type === 'textarea' ? 200 : col.placeholder ? 168 : undefined,
                      }}
                    >
                      {col.type === 'textarea' ? (
                        <textarea
                          value={linha[col.key] ?? ''}
                          placeholder={'placeholder' in col ? col.placeholder : undefined}
                          rows={2}
                          style={{ ...inputCellStyle, minHeight: 44, resize: 'vertical' }}
                          onChange={(e) => atualizarLinha(idx, { [col.key]: e.target.value })}
                          onBlur={(e) => atualizarLinha(idx, { [col.key]: e.target.value }, true)}
                        />
                      ) : (
                        <input
                          type={col.type}
                          value={linha[col.key] ?? ''}
                          placeholder={'placeholder' in col ? col.placeholder : col.type === 'number' ? '0' : '—'}
                          style={inputCellStyle}
                          onChange={(e) => atualizarLinha(idx, { [col.key]: e.target.value })}
                          onBlur={(e) => atualizarLinha(idx, { [col.key]: e.target.value }, true)}
                        />
                      )}
                    </td>
                  ))}
                  <td style={{ ...cellStyle, padding: '6px 8px' }}>
                    {linha.condominio?.trim() ? (
                      <div className="space-y-1">
                        {ok ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700">
                            <Check size={12} />
                            Confirmado
                          </span>
                        ) : pendente ? (
                          <button
                            type="button"
                            disabled={salvando}
                            onClick={() => void confirmarLinha(idx)}
                            className="rounded border px-2 py-1 text-[10px] font-medium transition hover:bg-stone-50 disabled:opacity-50"
                            style={{
                              borderColor: 'var(--moni-border-default)',
                              color: 'var(--moni-primary-600)',
                            }}
                          >
                            {salvando ? 'Salvando…' : rotuloAcao(linha)}
                          </button>
                        ) : null}
                        {erroLinha[linha.row_id] ? (
                          <p className="text-[10px] text-red-600">{erroLinha[linha.row_id]}</p>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-[10px] italic" style={{ color: 'var(--moni-text-tertiary)' }}>
                        Selecione ou informe o condomínio
                      </span>
                    )}
                  </td>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => removerLinha(idx)}
                      title="Remover linha"
                      style={{
                        color: 'var(--moni-text-tertiary)',
                        fontSize: '1rem',
                        lineHeight: 1,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '0 4px',
                      }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {linhas.length < 20 && (
        <button
          type="button"
          onClick={adicionarLinha}
          style={{
            marginTop: 8,
            fontSize: '0.75rem',
            color: 'var(--moni-primary-600)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          + Adicionar linha
        </button>
      )}
    </div>
  );
}
