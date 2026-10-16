'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import type { QualificacaoTabelaLinha } from '@/lib/qualificacao-tabela';
import {
  formatarDataQualificacao,
  rotuloRespostaQualificacao,
} from '@/lib/formulario-qualificacao-labels';
import { linhasParaCsv } from '@/lib/csv-tabela-rede';
import { useDebounce } from '@/hooks/useDebounce';
import { MoniTabelaScrollSync } from '@/components/MoniTabelaScrollSync';
import { RedeTabelaToolbarBusca } from './RedeTabelaToolbarBusca';
import { ExportarEntidadeCSVButton } from './ExportarEntidadeCSVButton';
import { redeTh } from './rede-ui';

type FiltroResposta = 'todos' | 'com' | 'sem';

type Props = {
  linhas: QualificacaoTabelaLinha[];
  loadError?: boolean;
  children?: ReactNode;
};

const td = 'px-3 py-2.5 align-top text-[13px] leading-snug';
const thGroup =
  'border-b px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider';

const CSV_HEADERS = [
  'N de Franquia',
  'Franqueado',
  'Respondido em',
  'Cidade de atuação',
  'Estado',
  'Faixa de capital',
  'Valor declarado',
  'Conhecimento do mercado',
  'Experiência imobiliária',
  'Familiaridade com o processo Moní',
  'Horas por semana',
  'Tempo de resposta',
  'Agenda com terrenistas',
  'Workshops',
  'Contexto',
] as const;

function texto(valor: string | null | undefined): string {
  return String(valor ?? '').trim();
}

function celula(valor: string): string {
  return valor || '—';
}

function camposResposta(linha: QualificacaoTabelaLinha) {
  const r = linha.resposta;
  return {
    respondidoEm: r ? formatarDataQualificacao(r.criado_em) : '',
    cidade: texto(r?.cidade_atuacao),
    estado: texto(r?.estado_atuacao),
    capital: rotuloRespostaQualificacao('capital_faixa', r?.capital_faixa),
    valor: texto(r?.capital_valor_declarado),
    mercado: rotuloRespostaQualificacao('conhecimento_mercado', r?.conhecimento_mercado),
    experiencia: rotuloRespostaQualificacao('conhecimento_imob', r?.conhecimento_imob),
    moni: rotuloRespostaQualificacao('conhecimento_moni', r?.conhecimento_moni),
    horas: rotuloRespostaQualificacao('tempo_horas', r?.tempo_horas),
    resposta: rotuloRespostaQualificacao('tempo_resposta', r?.tempo_resposta),
    agenda: rotuloRespostaQualificacao('tempo_agenda', r?.tempo_agenda),
    workshops: rotuloRespostaQualificacao('workshops', r?.workshops),
    contexto: texto(r?.motivacao),
  };
}

function linhaCsv(linha: QualificacaoTabelaLinha): Record<string, string> {
  const c = camposResposta(linha);
  return {
    'N de Franquia': linha.nFranquia,
    Franqueado: linha.nome,
    'Respondido em': c.respondidoEm,
    'Cidade de atuação': c.cidade,
    Estado: c.estado,
    'Faixa de capital': c.capital,
    'Valor declarado': c.valor,
    'Conhecimento do mercado': c.mercado,
    'Experiência imobiliária': c.experiencia,
    'Familiaridade com o processo Moní': c.moni,
    'Horas por semana': c.horas,
    'Tempo de resposta': c.resposta,
    'Agenda com terrenistas': c.agenda,
    Workshops: c.workshops,
    Contexto: c.contexto,
  };
}

function bateBusca(linha: QualificacaoTabelaLinha, q: string): boolean {
  const c = camposResposta(linha);
  const blob = [
    linha.nFranquia,
    linha.nome,
    c.respondidoEm,
    c.cidade,
    c.estado,
    c.capital,
    c.valor,
    c.mercado,
    c.experiencia,
    c.moni,
    c.horas,
    c.resposta,
    c.agenda,
    c.workshops,
    c.contexto,
  ]
    .join(' ')
    .toLocaleLowerCase('pt-BR');
  return blob.includes(q);
}

function CelulaTexto({ valor, largo }: { valor: string; largo?: boolean }) {
  const cheio = texto(valor);
  return (
    <td className={td} style={{ color: 'var(--moni-text-secondary)', maxWidth: largo ? 280 : 220 }}>
      <span className="block whitespace-normal">{celula(cheio)}</span>
    </td>
  );
}

export function QualificacaoRespostasTabela({ linhas, loadError = false, children }: Props) {
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<FiltroResposta>('todos');
  const debouncedBusca = useDebounce(busca);

  const respondidos = useMemo(() => linhas.filter((l) => l.resposta).length, [linhas]);

  const visiveis = useMemo(() => {
    const q = debouncedBusca.trim().toLocaleLowerCase('pt-BR');
    return linhas.filter((linha) => {
      if (filtro === 'com' && !linha.resposta) return false;
      if (filtro === 'sem' && linha.resposta) return false;
      if (q && !bateBusca(linha, q)) return false;
      return true;
    });
  }, [linhas, filtro, debouncedBusca]);

  const filtros: { id: FiltroResposta; label: string }[] = [
    { id: 'todos', label: `Todos (${linhas.length})` },
    { id: 'com', label: `Com resposta (${respondidos})` },
    { id: 'sem', label: `Sem resposta (${linhas.length - respondidos})` },
  ];

  if (loadError) {
    return (
      <p className="text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
        Erro ao carregar as respostas do formulário de qualificação.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <RedeTabelaToolbarBusca
        value={busca}
        onChange={setBusca}
        placeholder="Pesquisar franqueado ou resposta…"
        ariaLabel="Pesquisar respostas de qualificação"
      >
        {children}
        <ExportarEntidadeCSVButton
          filenamePrefix="qualificacao-franqueados"
          disabled={visiveis.length === 0}
          gerarCsv={() => linhasParaCsv(CSV_HEADERS, visiveis.map(linhaCsv))}
        />
      </RedeTabelaToolbarBusca>

      <div className="flex flex-wrap items-center gap-2">
        {filtros.map((item) => {
          const ativo = filtro === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setFiltro(item.id)}
              className="rounded-lg px-3 text-xs font-medium"
              style={{
                minHeight: 44,
                border: '0.5px solid var(--moni-border-default)',
                background: ativo ? 'var(--moni-navy-800)' : 'transparent',
                color: ativo ? 'var(--moni-text-inverse)' : 'var(--moni-text-secondary)',
                fontFamily: 'var(--moni-font-sans)',
              }}
            >
              {item.label}
            </button>
          );
        })}
        <span className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
          Uma linha por franqueado, com o envio mais recente.
        </span>
      </div>

      <MoniTabelaScrollSync className="rounded-xl border-[0.5px] border-[var(--moni-border-default)] bg-[var(--moni-surface-0)] shadow-[var(--moni-shadow-card)]">
          <table className="min-w-[2200px] border-collapse text-left">
            <thead>
              <tr>
                <th
                  colSpan={3}
                  className={thGroup}
                  style={{
                    color: 'var(--moni-text-tertiary)',
                    borderColor: 'var(--moni-border-default)',
                    background: 'var(--moni-surface-50)',
                  }}
                >
                  Franqueado
                </th>
                <th
                  colSpan={2}
                  className={`${thGroup} border-l`}
                  style={{
                    color: 'var(--moni-text-tertiary)',
                    borderColor: 'var(--moni-border-default)',
                    background: 'var(--moni-surface-50)',
                  }}
                >
                  Atuação
                </th>
                <th
                  colSpan={2}
                  className={`${thGroup} border-l`}
                  style={{
                    color: 'var(--moni-text-tertiary)',
                    borderColor: 'var(--moni-border-default)',
                    background: 'var(--moni-surface-50)',
                  }}
                >
                  Capital
                </th>
                <th
                  colSpan={3}
                  className={`${thGroup} border-l`}
                  style={{
                    color: 'var(--moni-text-tertiary)',
                    borderColor: 'var(--moni-border-default)',
                    background: 'var(--moni-surface-50)',
                  }}
                >
                  Conhecimento
                </th>
                <th
                  colSpan={4}
                  className={`${thGroup} border-l`}
                  style={{
                    color: 'var(--moni-text-tertiary)',
                    borderColor: 'var(--moni-border-default)',
                    background: 'var(--moni-surface-50)',
                  }}
                >
                  Disponibilidade
                </th>
                <th
                  className={`${thGroup} border-l`}
                  style={{
                    color: 'var(--moni-text-tertiary)',
                    borderColor: 'var(--moni-border-default)',
                    background: 'var(--moni-surface-50)',
                  }}
                >
                  Contexto
                </th>
              </tr>
              <tr
                className="border-b"
                style={{
                  borderColor: 'var(--moni-border-default)',
                  background: 'var(--moni-surface-50)',
                }}
              >
                <th className={redeTh}>Nº</th>
                <th className={redeTh}>Franqueado</th>
                <th className={redeTh}>Respondido em</th>
                <th className={`${redeTh} border-l`} style={{ borderColor: 'var(--moni-border-default)' }}>
                  Cidade
                </th>
                <th className={redeTh}>Estado</th>
                <th className={`${redeTh} border-l`} style={{ borderColor: 'var(--moni-border-default)' }}>
                  Faixa de capital
                </th>
                <th className={redeTh}>Valor declarado</th>
                <th className={`${redeTh} border-l`} style={{ borderColor: 'var(--moni-border-default)' }}>
                  Mercado
                </th>
                <th className={redeTh}>Experiência</th>
                <th className={redeTh}>Processo Moní</th>
                <th className={`${redeTh} border-l`} style={{ borderColor: 'var(--moni-border-default)' }}>
                  Horas / semana
                </th>
                <th className={redeTh}>Tempo de resposta</th>
                <th className={redeTh}>Agenda</th>
                <th className={redeTh}>Workshops</th>
                <th className={`${redeTh} border-l`} style={{ borderColor: 'var(--moni-border-default)' }}>
                  Comentário
                </th>
              </tr>
            </thead>
            <tbody>
              {visiveis.length === 0 ? (
                <tr>
                  <td
                    colSpan={15}
                    className="px-3 py-8 text-sm"
                    style={{ color: 'var(--moni-text-tertiary)' }}
                  >
                    Nenhuma linha neste filtro.
                  </td>
                </tr>
              ) : (
                visiveis.map((linha) => {
                  const c = camposResposta(linha);
                  return (
                    <tr
                      key={linha.redeId}
                      className="border-b"
                      style={{ borderColor: 'var(--moni-border-default)' }}
                    >
                      <td className={`${td} whitespace-nowrap`} style={{ color: 'var(--moni-text-primary)' }}>
                        {celula(linha.nFranquia)}
                      </td>
                      <td className={td} style={{ color: 'var(--moni-text-primary)', minWidth: 180 }}>
                        <Link
                          href={`/rede-franqueados/${linha.redeId}/formulario-qualificacao`}
                          className="font-medium underline-offset-2 hover:underline"
                          style={{ color: 'var(--moni-navy-800)' }}
                        >
                          {celula(linha.nome)}
                        </Link>
                      </td>
                      <td className={`${td} whitespace-nowrap`} style={{ color: 'var(--moni-text-secondary)' }}>
                        {celula(c.respondidoEm)}
                      </td>
                      <CelulaTexto valor={c.cidade} />
                      <td className={`${td} whitespace-nowrap`} style={{ color: 'var(--moni-text-secondary)' }}>
                        {celula(c.estado)}
                      </td>
                      <CelulaTexto valor={c.capital} />
                      <CelulaTexto valor={c.valor} />
                      <CelulaTexto valor={c.mercado} />
                      <CelulaTexto valor={c.experiencia} />
                      <CelulaTexto valor={c.moni} />
                      <CelulaTexto valor={c.horas} />
                      <CelulaTexto valor={c.resposta} />
                      <CelulaTexto valor={c.agenda} />
                      <CelulaTexto valor={c.workshops} />
                      <CelulaTexto valor={c.contexto} largo />
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
      </MoniTabelaScrollSync>
    </div>
  );
}
