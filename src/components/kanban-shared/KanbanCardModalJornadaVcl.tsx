'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Modo = 'dados' | 'simulacoes';

type DadosCliente = {
  nome: string;
  telefone: string;
  loteamentos: string[];
  corretor: string;
};

type SimulacaoColuna = {
  id: string;
  quando: string;
  valores: Record<string, string>;
  itens: { item: string; valor: string }[];
  fluxo: { mes: string; descricao: string; entrada: string; saidas: string }[];
};

const SEM_CORRETOR = 'Sem corretor — site Moní';

const LINHAS: { id: string; label: string }[] = [
  { id: 'oferta', label: 'Oferta / modelo' },
  { id: 'lote', label: 'Lote' },
  { id: 'terreno', label: 'Valor do terreno' },
  { id: 'jaPago', label: 'Valor já pago' },
  { id: 'acoplamento', label: 'Acoplamento' },
  { id: 'customizacao', label: 'Customização (total)' },
  { id: 'prazoObra', label: 'Prazo da obra' },
  { id: 'renda', label: 'Renda' },
  { id: 'financiamento', label: 'Prazo e taxa do financiamento' },
  { id: 'entrada', label: 'Entrada' },
  { id: 'mensal', label: 'Parcela mensal' },
  { id: 'unica', label: 'Parcela única' },
  { id: 'saldo', label: 'Saldo a financiar' },
];

function moeda(raw: unknown): string {
  if (raw == null || raw === '') return '—';
  const n = Number(raw);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function numero(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function objeto(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

function quando(iso: unknown): string {
  const s = String(iso ?? '').trim();
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function telefoneExibicao(raw: string): string {
  const digitos = raw.replace(/\D/g, '');
  const nacional = digitos.length > 11 && digitos.startsWith('55') ? digitos.slice(-11) : digitos;
  if (nacional.length === 11) {
    return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 7)}-${nacional.slice(7)}`;
  }
  if (nacional.length === 10) {
    return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 6)}-${nacional.slice(6)}`;
  }
  return raw.trim() || '—';
}

function texto(raw: unknown): string {
  const s = String(raw ?? '').trim();
  return s || '—';
}

function taxaTexto(snapshot: Record<string, unknown>, coluna: number | null): string {
  const percentual = numero(snapshot.taxa_percentual);
  const pct = percentual ?? (coluna == null ? null : Math.abs(coluna) <= 1 ? coluna * 100 : coluna);
  if (pct == null) return '—';
  return `${pct.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% a.a.`;
}

function lerItens(raw: unknown): { item: string; valor: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const row = objeto(item);
    const nome = String(row.item ?? row.nome ?? '').trim();
    if (!nome && row.valor == null) return [];
    return [{ item: nome || 'Item', valor: moeda(row.valor) }];
  });
}

function lerFluxo(raw: unknown): SimulacaoColuna['fluxo'] {
  if (!Array.isArray(raw)) return [];
  return raw.map((linha) => {
    const row = objeto(linha);
    return {
      mes: String(row.mes ?? '—'),
      descricao: texto(row.descricao),
      entrada: moeda(row.entrada_cliente),
      saidas: moeda(row.saidas_total),
    };
  });
}

function montarColuna(row: Record<string, unknown>): SimulacaoColuna {
  const inputs = objeto(row.inputs);
  const snapshot = objeto(row.resultado);
  const anos = numero(snapshot.prazo_financiamento_anos ?? row.prazo_financiamento_anos);
  const taxa = taxaTexto(snapshot, numero(row.taxa_financiamento_anual));
  const prazoObra = numero(snapshot.prazo_obra_meses ?? inputs.prazo_obra_meses ?? row.prazo_meses);
  const financiamento =
    anos == null && taxa === '—' ? '—' : `${anos != null ? `${anos} anos` : '—'} · ${taxa}`;
  const itensFonte = Array.isArray(snapshot.customizacao_itens)
    ? snapshot.customizacao_itens
    : row.customizacao_itens;
  return {
    id: String(row.id),
    quando: quando(row.created_at),
    valores: {
      oferta: texto(snapshot.oferta_nome ?? inputs.oferta_nome),
      lote: texto(snapshot.lote ?? inputs.lote_rotulo ?? inputs.lote_codigo),
      terreno: moeda(snapshot.valor_terreno ?? row.valor_lote),
      jaPago: moeda(snapshot.valor_ja_pago ?? row.valor_ja_pago),
      acoplamento: moeda(snapshot.acoplamento ?? inputs.acoplamento ?? inputs.valor_acoplamento),
      customizacao: moeda(snapshot.customizacao_total ?? row.valor_customizacao),
      prazoObra: prazoObra != null ? `${prazoObra} meses` : '—',
      renda: moeda(snapshot.renda ?? inputs.renda ?? row.renda_cliente),
      financiamento,
      entrada: moeda(snapshot.entrada ?? inputs.entrada),
      mensal: moeda(snapshot.parcela_mensal ?? inputs.parcela_mensal),
      unica: moeda(snapshot.parcela_unica ?? inputs.parcela_unica),
      saldo: moeda(snapshot.saldo_a_financiar ?? inputs.saldo_a_financiar),
    },
    itens: lerItens(itensFonte),
    fluxo: lerFluxo(snapshot.fluxo),
  };
}

function mudou(coluna: SimulacaoColuna, anterior: SimulacaoColuna | undefined, linha: string): boolean {
  if (!anterior) return false;
  return coluna.valores[linha] !== anterior.valores[linha];
}

export function KanbanCardModalJornadaVcl({
  cardId,
  modo,
}: {
  cardId: string;
  modo: Modo;
}) {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState<DadosCliente | null>(null);
  const [simulacoes, setSimulacoes] = useState<SimulacaoColuna[]>([]);
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    setErro(null);

    const supabase = createClient();

    async function carregar() {
      if (modo === 'dados') {
        const { data, error } = await supabase
          .from('kanban_cards')
          .select('titulo, vc_telefone, nome_condominio, rede_corretor_id')
          .eq('id', cardId)
          .maybeSingle();
        if (!ativo) return;
        if (error || !data) {
          setErro(error?.message ?? 'Não foi possível carregar os dados do cliente.');
          setLoading(false);
          return;
        }
        const row = data as {
          titulo?: string | null;
          vc_telefone?: string | null;
          nome_condominio?: string | null;
          rede_corretor_id?: string | null;
        };
        const corretorId = String(row.rede_corretor_id ?? '').trim();
        let corretor = SEM_CORRETOR;
        if (corretorId) {
          const { data: corretorRow } = await supabase
            .from('rede_corretores')
            .select('nome')
            .eq('id', corretorId)
            .maybeSingle();
          const nome = String((corretorRow as { nome?: string | null } | null)?.nome ?? '').trim();
          corretor = nome || 'Corretor vinculado';
        }

        const { data: tagsRows } = await supabase
          .from('kanban_card_tags')
          .select('kanban_tags(nome)')
          .eq('card_id', cardId);
        const nomes = new Set<string>();
        for (const item of tagsRows ?? []) {
          const tag = (item as { kanban_tags?: { nome?: string | null } | { nome?: string | null }[] | null })
            .kanban_tags;
          const nome = Array.isArray(tag) ? tag[0]?.nome : tag?.nome;
          const limpo = String(nome ?? '').trim();
          if (limpo) nomes.add(limpo);
        }
        const condominio = String(row.nome_condominio ?? '').trim();
        if (nomes.size === 0 && condominio) nomes.add(condominio);

        if (!ativo) return;
        setDados({
          nome: String(row.titulo ?? '').trim() || '—',
          telefone: telefoneExibicao(String(row.vc_telefone ?? '')),
          loteamentos: [...nomes],
          corretor,
        });
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('simulacoes_pagamento')
        .select(
          'id, created_at, inputs, resultado, valor_lote, valor_casa, valor_customizacao, valor_ja_pago, renda_cliente, prazo_meses, prazo_financiamento_anos, taxa_financiamento_anual',
        )
        .eq('kanban_card_id', cardId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (!ativo) return;
      if (error) {
        setErro(error.message);
        setLoading(false);
        return;
      }
      setSimulacoes((data ?? []).map((item) => montarColuna(item as Record<string, unknown>)));
      setLoading(false);
    }

    void carregar().catch(() => {
      if (!ativo) return;
      setErro('Não foi possível carregar esta seção.');
      setLoading(false);
    });

    return () => {
      ativo = false;
    };
  }, [cardId, modo]);

  if (loading) {
    return <p style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}>Carregando…</p>;
  }
  if (erro) {
    return <p style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>{erro}</p>;
  }

  if (modo === 'dados' && dados) {
    const linhas = [
      ['Nome', dados.nome],
      ['Telefone', dados.telefone],
      ['Loteamento de origem', dados.loteamentos.length > 0 ? dados.loteamentos.join(', ') : '—'],
      ['Corretor', dados.corretor],
    ] as const;
    return (
      <div style={{ display: 'grid', gap: 8, fontFamily: 'var(--moni-font-sans)' }}>
        {linhas.map(([label, valor]) => (
          <div key={label}>
            <div style={{ fontSize: 11, color: 'var(--moni-text-tertiary)' }}>{label}</div>
            <div style={{ fontSize: 12, color: 'var(--moni-text-primary)' }}>{valor}</div>
          </div>
        ))}
      </div>
    );
  }

  if (simulacoes.length === 0) {
    return (
      <p style={{ margin: 0, color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}>
        O cliente ainda não fez nenhuma simulação.
      </p>
    );
  }

  const selecionada = simulacoes.find((sim) => sim.id === selecionadaId) ?? null;
  const temDestaque = simulacoes.some((sim, index) =>
    LINHAS.some((linha) => mudou(sim, simulacoes[index + 1], linha.id)),
  );

  return (
    <div style={{ display: 'grid', gap: 10, fontFamily: 'var(--moni-font-sans)', minWidth: 0 }}>
      {temDestaque ? (
        <p style={{ margin: 0, fontSize: 11, color: 'var(--moni-text-tertiary)' }}>
          Valores em destaque mudaram em relação à simulação anterior.
        </p>
      ) : null}
      <div style={{ overflowX: 'auto', width: '100%', maxWidth: '100%' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: '100%' }}>
          <thead>
            <tr>
              <th
                style={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 1,
                  background: 'var(--moni-surface-0)',
                  textAlign: 'left',
                  fontWeight: 500,
                  fontSize: 11,
                  color: 'var(--moni-text-tertiary)',
                  padding: '8px 10px',
                  borderBottom: 'var(--moni-border-width) solid var(--moni-border-default)',
                  minWidth: 148,
                }}
              >
                {' '}
              </th>
              {simulacoes.map((sim, index) => {
                const ativa = sim.id === selecionadaId;
                const numero = simulacoes.length - index;
                return (
                  <th
                    key={sim.id}
                    style={{
                      padding: 0,
                      borderBottom: 'var(--moni-border-width) solid var(--moni-border-default)',
                      background: ativa ? 'var(--moni-surface-50)' : 'var(--moni-surface-0)',
                      minWidth: 148,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setSelecionadaId((atual) => (atual === sim.id ? null : sim.id))}
                      style={{
                        width: '100%',
                        minHeight: 44,
                        padding: '8px 10px',
                        border: 0,
                        background: 'transparent',
                        color: 'var(--moni-text-primary)',
                        fontFamily: 'var(--moni-font-sans)',
                        fontSize: 12,
                        fontWeight: 600,
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ display: 'block' }}>{`Simulação ${numero}`}</span>
                      <span
                        style={{
                          display: 'block',
                          marginTop: 2,
                          fontSize: 11,
                          fontWeight: 500,
                          color: 'var(--moni-text-tertiary)',
                        }}
                      >
                        {sim.quando}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {LINHAS.map((linha) => (
              <tr key={linha.id}>
                <th
                  scope="row"
                  style={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 1,
                    background: 'var(--moni-surface-0)',
                    textAlign: 'left',
                    fontWeight: 500,
                    fontSize: 11,
                    color: 'var(--moni-text-secondary)',
                    padding: '8px 10px',
                    borderBottom: 'var(--moni-border-width) solid var(--moni-border-default)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {linha.label}
                </th>
                {simulacoes.map((sim, index) => {
                  const destaque = mudou(sim, simulacoes[index + 1], linha.id);
                  const ativa = sim.id === selecionadaId;
                  return (
                    <td
                      key={sim.id}
                      style={{
                        padding: 0,
                        borderBottom: 'var(--moni-border-width) solid var(--moni-border-default)',
                        background: destaque
                          ? 'var(--moni-gold-50)'
                          : ativa
                            ? 'var(--moni-surface-50)'
                            : 'transparent',
                        minWidth: 148,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setSelecionadaId((atual) => (atual === sim.id ? null : sim.id))}
                        style={{
                          width: '100%',
                          minHeight: 44,
                          padding: '8px 10px',
                          border: 0,
                          background: 'transparent',
                          color: 'var(--moni-text-primary)',
                          fontFamily: 'var(--moni-font-sans)',
                          fontSize: 12,
                          fontWeight: destaque ? 600 : 400,
                          textAlign: 'left',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {sim.valores[linha.id]}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selecionada ? (
        <div
          style={{
            display: 'grid',
            gap: 12,
            padding: 10,
            border: 'var(--moni-border-width) solid var(--moni-border-default)',
            borderRadius: 'var(--moni-radius-md)',
            background: 'var(--moni-surface-0)',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--moni-text-primary)' }}>
            {selecionada.quando}
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--moni-text-tertiary)', marginBottom: 6 }}>
              Customização
            </div>
            {selecionada.itens.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12, color: 'var(--moni-text-tertiary)' }}>Nenhum item.</p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 4 }}>
                {selecionada.itens.map((item) => (
                  <li
                    key={`${item.item}-${item.valor}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      fontSize: 12,
                      color: 'var(--moni-text-secondary)',
                    }}
                  >
                    <span>{item.item}</span>
                    <span style={{ color: 'var(--moni-text-primary)', whiteSpace: 'nowrap' }}>{item.valor}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--moni-text-tertiary)', marginBottom: 6 }}>
              Fluxo de pagamento
            </div>
            {selecionada.fluxo.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12, color: 'var(--moni-text-tertiary)' }}>
                Esta simulação não tem o fluxo gravado.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      {['Mês', 'Descrição', 'Pagamento', 'Saídas'].map((titulo) => (
                        <th
                          key={titulo}
                          style={{
                            textAlign: 'left',
                            fontWeight: 500,
                            color: 'var(--moni-text-tertiary)',
                            padding: '6px 8px',
                            borderBottom: 'var(--moni-border-width) solid var(--moni-border-default)',
                          }}
                        >
                          {titulo}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selecionada.fluxo.map((linha, index) => (
                      <tr key={`${linha.mes}-${linha.descricao}-${index}`}>
                        <td style={{ padding: '6px 8px', color: 'var(--moni-text-primary)' }}>{linha.mes}</td>
                        <td style={{ padding: '6px 8px', color: 'var(--moni-text-secondary)' }}>{linha.descricao}</td>
                        <td style={{ padding: '6px 8px', color: 'var(--moni-text-primary)', whiteSpace: 'nowrap' }}>
                          {linha.entrada}
                        </td>
                        <td style={{ padding: '6px 8px', color: 'var(--moni-text-primary)', whiteSpace: 'nowrap' }}>
                          {linha.saidas}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
