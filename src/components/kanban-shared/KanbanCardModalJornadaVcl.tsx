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

type SimulacaoLinha = {
  id: string;
  quando: string;
  oferta: string;
  lote: string;
  valorLote: string;
  valorCasa: string;
  valorCustomizacao: string;
  valorJaPago: string;
};

const SEM_CORRETOR = 'Sem corretor — site Moní';

function moeda(raw: unknown): string {
  if (raw == null || raw === '') return '—';
  const n = Number(raw);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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

function textoInput(inputs: unknown, chave: string): string {
  if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs)) return '';
  return String((inputs as Record<string, unknown>)[chave] ?? '').trim();
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
  const [simulacoes, setSimulacoes] = useState<SimulacaoLinha[]>([]);

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
          'id, created_at, valor_lote, valor_casa, valor_customizacao, valor_ja_pago, inputs',
        )
        .eq('kanban_card_id', cardId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!ativo) return;
      if (error) {
        setErro(error.message);
        setLoading(false);
        return;
      }
      setSimulacoes(
        (data ?? []).map((row) => {
          const item = row as {
            id: string;
            created_at?: string | null;
            valor_lote?: number | null;
            valor_casa?: number | null;
            valor_customizacao?: number | null;
            valor_ja_pago?: number | null;
            inputs?: unknown;
          };
          const rotulo = textoInput(item.inputs, 'lote_rotulo');
          const codigo = textoInput(item.inputs, 'lote_codigo');
          return {
            id: item.id,
            quando: quando(item.created_at),
            oferta: textoInput(item.inputs, 'oferta_nome') || '—',
            lote: rotulo || codigo || '—',
            valorLote: moeda(item.valor_lote),
            valorCasa: moeda(item.valor_casa),
            valorCustomizacao: moeda(item.valor_customizacao),
            valorJaPago: moeda(item.valor_ja_pago),
          };
        }),
      );
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
      <p style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}>
        Nenhuma simulação ainda.
      </p>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 8, fontFamily: 'var(--moni-font-sans)' }}>
      {simulacoes.map((sim) => (
        <article
          key={sim.id}
          style={{
            border: 'var(--moni-border-width) solid var(--moni-border-default)',
            borderRadius: 'var(--moni-radius-md)',
            padding: 8,
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--moni-text-tertiary)' }}>{sim.quando}</div>
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--moni-text-primary)' }}>{sim.oferta}</div>
          <div style={{ fontSize: 12, color: 'var(--moni-text-secondary)' }}>Lote {sim.lote}</div>
          <div style={{ marginTop: 4, display: 'grid', gap: 2, fontSize: 11, color: 'var(--moni-text-secondary)' }}>
            <span>Terreno {sim.valorLote}</span>
            <span>Casa {sim.valorCasa}</span>
            <span>Customização {sim.valorCustomizacao}</span>
            <span>Já pago {sim.valorJaPago}</span>
          </div>
        </article>
      ))}
    </div>
  );
}
