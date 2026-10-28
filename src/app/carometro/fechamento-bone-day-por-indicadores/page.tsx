'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useEffectiveUser } from '@/hooks/useEffectiveUser';
import { SeletorUsuarioAdmin } from '@/components/carometro/todo/SeletorUsuarioAdmin';
import { BoneDayTabs } from '@/components/carometro/BoneDayTabs';
import {
  useFechamentoBoneDayPorIndicadores,
  getMonthLabel,
  getMonthOptions,
  GRUPOS_CONFIG,
} from '@/hooks/useFechamentoBoneDayPorIndicadores';
import type { AreaRelatorio, MetaSimples, BlockerSimples } from '@/hooks/useFechamentoBoneDayPorIndicadores';

// ── Imagem da carinha por score — thresholds idênticos ao sistema ─────────────
function getCarinhaImg(score: number | null): string {
  if (score === null) return '/carometro/carometro-emoji-branco.png';
  if (score >= 75) return '/carometro/carometro-emoji-verde-escuro.png';
  if (score >= 60) return '/carometro/carometro-emoji-verde-claro.png';
  if (score >= 30) return '/carometro/carometro-emoji-amarelo.png';
  return '/carometro/carometro-emoji-vermelho.png';
}

function getScoreColor(score: number | null): string {
  if (score === null) return 'var(--moni-text-tertiary)';
  if (score >= 75) return 'var(--moni-green-600)';
  if (score >= 60) return 'var(--moni-green-400)';
  if (score >= 30) return 'var(--moni-gold-600)';
  return 'var(--moni-status-overdue-text)';
}

// ── Cartões de resumo no topo ─────────────────────────────────────────────────
const GRUPOS_RESUMO = [
  { id: 'verde-escuro', label: 'Verde Escuro',  sublabel: 'Indicadores ≥ 75%', corFundo: 'var(--moni-green-800)', corTexto: 'var(--moni-text-inverse)' },
  { id: 'verde-claro',  label: 'Verde Claro',   sublabel: '60% – 74%',         corFundo: 'var(--moni-green-400)', corTexto: 'var(--moni-text-inverse)' },
  { id: 'amarelo',      label: 'Amarelo',        sublabel: '30% – 59%',         corFundo: 'var(--moni-gold-400)',  corTexto: 'var(--moni-earth-800)' },
  { id: 'vermelho',     label: 'Vermelho',       sublabel: 'Indicadores < 30%', corFundo: 'var(--moni-status-overdue-text)', corTexto: 'var(--moni-text-inverse)' },
] as const;

function CartoesResumo({ grupos }: { grupos: { id: string; areas: AreaRelatorio[] }[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
      {GRUPOS_RESUMO.map(g => {
        const count = grupos.find(gr => gr.id === g.id)?.areas.length ?? 0;
        return (
          <div
            key={g.id}
            style={{
              background: 'var(--moni-surface-0)',
              border: '0.5px solid var(--moni-border-default)',
              borderRadius: 'var(--moni-radius-lg)',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <span style={{
              fontSize: '32px',
              fontFamily: 'var(--moni-font-display)',
              fontWeight: 700,
              color: g.corFundo,
              lineHeight: 1,
            }}>
              {count}
            </span>
            <span style={{
              fontSize: '13px',
              fontFamily: 'var(--moni-font-sans)',
              fontWeight: 600,
              color: 'var(--moni-text-primary)',
            }}>
              {g.label}
            </span>
            <span style={{
              fontSize: '11px',
              fontFamily: 'var(--moni-font-sans)',
              color: 'var(--moni-text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              {g.sublabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Coluna Resultado: 3 carinhas em ordem fixa IND → ENG → SIR (vertical) ────
function ColunaResultado({ scores }: { scores: AreaRelatorio['scores'] }) {
  const itens = [
    { label: 'IND', score: scores.indicadores },
    { label: 'ENG', score: scores.engajamento },
    { label: 'SIR', score: scores.sirene },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {itens.map(({ label, score }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img
            src={getCarinhaImg(score)}
            alt={label}
            style={{ width: '43px', height: '43px', flexShrink: 0 }}
          />
          <span style={{ fontSize: '16px', fontFamily: 'var(--moni-font-sans)', color: 'var(--moni-text-tertiary)', fontWeight: 500, minWidth: '32px' }}>
            {label}
          </span>
          <span style={{ fontSize: '19px', fontFamily: 'var(--moni-font-sans)', fontWeight: 700, color: getScoreColor(score) }}>
            {score !== null ? `${score}%` : '—'}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Item individual de meta ────────────────────────────────────────────────────
function MetaItem({ m, concluida }: { m: MetaSimples; concluida: boolean }) {
  return (
    <li style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
      <span style={{
        flexShrink: 0,
        marginTop: '2px',
        fontSize: '14px',
        color: concluida ? 'var(--moni-green-600)' : 'var(--moni-text-tertiary)',
        fontWeight: 700,
      }}>
        {concluida ? '✓' : '–'}
      </span>
      <span style={{ flex: 1, fontSize: '16px', fontFamily: 'var(--moni-font-sans)', lineHeight: 1.45 }}>
        {m.is_chave && (
          <span style={{
            display: 'inline-block',
            fontSize: '12px',
            fontFamily: 'var(--moni-font-sans)',
            fontWeight: 700,
            color: 'var(--moni-gold-800)',
            background: 'var(--moni-gold-50)',
            border: '0.5px solid var(--moni-gold-400)',
            borderRadius: '4px',
            padding: '1px 5px',
            marginRight: '5px',
            verticalAlign: 'middle',
            letterSpacing: '0.04em',
          }}>
            CHAVE
          </span>
        )}
        <span style={{
          color: concluida ? 'var(--moni-text-tertiary)' : 'var(--moni-text-secondary)',
          textDecoration: concluida ? 'line-through' : 'none',
        }}>
          {m.descricao}
        </span>
        {m.meta_unidade && (
          <span style={{ color: 'var(--moni-text-tertiary)', textDecoration: 'none', marginLeft: '4px', fontSize: '14px' }}>
            · {m.meta_unidade}
          </span>
        )}
      </span>
    </li>
  );
}

// ── Lista de metas com separação Atingível / Recorrente ───────────────────────
function ListaMetas({ metas, concluidas }: { metas: MetaSimples[]; concluidas: boolean }) {
  if (metas.length === 0) {
    return (
      <span style={{ fontSize: '16px', fontFamily: 'var(--moni-font-sans)', color: 'var(--moni-text-tertiary)', fontStyle: 'italic' }}>—</span>
    );
  }

  const atingiveis = metas.filter(m => m.tipo?.toLowerCase() !== 'recorrente');
  const recorrentes = metas.filter(m => m.tipo?.toLowerCase() === 'recorrente');
  const temAmbos = atingiveis.length > 0 && recorrentes.length > 0;

  const subLabel = (texto: string) => (
    <p style={{
      margin: temAmbos ? '8px 0 4px' : '0 0 4px',
      fontSize: '11px',
      fontFamily: 'var(--moni-font-sans)',
      fontWeight: 600,
      color: 'var(--moni-text-tertiary)',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
    }}>
      {texto}
    </p>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {atingiveis.length > 0 && (
        <div>
          {temAmbos && subLabel('Atingível')}
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {atingiveis.map(m => <MetaItem key={m.id} m={m} concluida={concluidas} />)}
          </ul>
        </div>
      )}
      {recorrentes.length > 0 && (
        <div>
          {temAmbos && subLabel('Recorrente')}
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {recorrentes.map(m => <MetaItem key={m.id} m={m} concluida={concluidas} />)}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Lista de blockers ─────────────────────────────────────────────────────────
function ListaBlockers({ blockers }: { blockers: BlockerSimples[] }) {
  if (blockers.length === 0) {
    return (
      <span style={{ fontSize: '16px', fontFamily: 'var(--moni-font-sans)', color: 'var(--moni-text-tertiary)', fontStyle: 'italic' }}>—</span>
    );
  }
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {blockers.map(b => (
        <li key={b.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
          <span style={{ flexShrink: 0, marginTop: '2px', fontSize: '14px', color: 'var(--moni-status-overdue-text)', fontWeight: 700 }}>•</span>
          <span style={{ fontSize: '16px', fontFamily: 'var(--moni-font-sans)', color: 'var(--moni-status-overdue-text)', lineHeight: 1.45 }}>
            {b.descricao}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ── Editor de comentário inline ───────────────────────────────────────────────
function ComentarioCell({
  valor,
  isAdmin,
  onSalvar,
}: {
  valor: string;
  isAdmin: boolean;
  onSalvar: (v: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(valor);

  useEffect(() => {
    setTexto(valor);
  }, [valor]);

  if (!isAdmin) {
    return valor ? (
      <span style={{ fontSize: '16px', fontFamily: 'var(--moni-font-sans)', color: 'var(--moni-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
        {valor}
      </span>
    ) : (
      <span style={{ fontSize: '16px', fontFamily: 'var(--moni-font-sans)', color: 'var(--moni-text-tertiary)', fontStyle: 'italic' }}>—</span>
    );
  }

  if (editando) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '180px' }}>
        <textarea
          autoFocus
          rows={3}
          value={texto}
          onChange={e => setTexto(e.target.value)}
          style={{
            width: '100%',
            fontSize: '16px',
            fontFamily: 'var(--moni-font-sans)',
            color: 'var(--moni-text-secondary)',
            border: '0.5px solid var(--moni-border-default)',
            borderRadius: 'var(--moni-radius-md)',
            padding: '6px 8px',
            resize: 'vertical',
            outline: 'none',
            background: 'var(--moni-surface-0)',
            lineHeight: 1.5,
          }}
        />
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={() => { onSalvar(texto); setEditando(false); }}
            style={{
              fontSize: '14px',
              fontFamily: 'var(--moni-font-sans)',
              background: 'var(--moni-navy-800)',
              color: 'var(--moni-text-inverse)',
              border: 'none',
              borderRadius: 'var(--moni-radius-md)',
              padding: '4px 12px',
              cursor: 'pointer',
              minHeight: '32px',
            }}
          >
            Salvar
          </button>
          <button
            type="button"
            onClick={() => { setTexto(valor); setEditando(false); }}
            style={{
              fontSize: '14px',
              fontFamily: 'var(--moni-font-sans)',
              background: 'transparent',
              color: 'var(--moni-text-tertiary)',
              border: '0.5px solid var(--moni-border-default)',
              borderRadius: 'var(--moni-radius-md)',
              padding: '4px 12px',
              cursor: 'pointer',
              minHeight: '32px',
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditando(true)}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        background: 'transparent',
        border: 'none',
        padding: '4px 2px',
        cursor: 'pointer',
        fontSize: '16px',
        fontFamily: 'var(--moni-font-sans)',
        color: valor ? 'var(--moni-text-secondary)' : 'var(--moni-text-tertiary)',
        fontStyle: valor ? 'normal' : 'italic',
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
      }}
    >
      {valor || 'Adicionar comentário...'}
    </button>
  );
}

// ── Tabela de um grupo ────────────────────────────────────────────────────────
function TabelaGrupo({
  areas,
  isAdmin,
  onSalvarComentario,
}: {
  areas: AreaRelatorio[];
  isAdmin: boolean;
  onSalvarComentario: (areaId: string, texto: string) => void;
}) {
  if (areas.length === 0) {
    return (
      <p style={{ fontSize: '13px', fontFamily: 'var(--moni-font-sans)', color: 'var(--moni-text-tertiary)', fontStyle: 'italic', padding: '16px 20px' }}>
        Nenhuma área neste grupo para o mês selecionado.
      </p>
    );
  }

  const thStyle: React.CSSProperties = {
    padding: '10px 16px',
    fontSize: '13px',
    fontFamily: 'var(--moni-font-sans)',
    fontWeight: 600,
    color: 'var(--moni-text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    textAlign: 'left',
    borderBottom: '0.5px solid var(--moni-border-subtle)',
    whiteSpace: 'nowrap',
    background: 'var(--moni-surface-50)',
  };

  const tdStyle: React.CSSProperties = {
    padding: '14px 16px',
    fontSize: '17px',
    fontFamily: 'var(--moni-font-sans)',
    color: 'var(--moni-text-secondary)',
    borderBottom: '0.5px solid var(--moni-border-subtle)',
    verticalAlign: 'top',
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, minWidth: '140px' }}>Área</th>
            <th style={{ ...thStyle, minWidth: '180px' }}>Resultado</th>
            <th style={{ ...thStyle, minWidth: '180px' }}>Metas Concluídas</th>
            <th style={{ ...thStyle, minWidth: '180px' }}>Metas em Aberto</th>
            <th style={{ ...thStyle, minWidth: '160px' }}>Blockers</th>
            <th style={{ ...thStyle, minWidth: '200px' }}>Comentários</th>
          </tr>
        </thead>
        <tbody>
          {areas.map(area => (
            <tr key={area.id}>
              <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--moni-text-primary)', fontSize: '18px', verticalAlign: 'middle' }}>
                {area.nome}
              </td>
              <td style={{ ...tdStyle, verticalAlign: 'middle' }}>
                <ColunaResultado scores={area.scores} />
              </td>
              <td style={tdStyle}>
                <ListaMetas metas={area.metasConcluidas} concluidas={true} />
              </td>
              <td style={tdStyle}>
                <ListaMetas metas={area.metasEmAberto} concluidas={false} />
              </td>
              <td style={tdStyle}>
                <ListaBlockers blockers={area.blockers} />
              </td>
              <td style={tdStyle}>
                <ComentarioCell
                  valor={area.comentario}
                  isAdmin={isAdmin}
                  onSalvar={txt => onSalvarComentario(area.id, txt)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function FechamentoBoneDayPorIndicadoresPage() {
  const supabase = useMemo(() => createClient(), []);
  const { effectiveProfileId } = useEffectiveUser();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) { setIsAdmin(false); return; }
      const { data: prof } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      setIsAdmin((prof as { role?: string } | null)?.role === 'admin');
    })();
  }, [supabase]);

  const { grupos, mes, setMes, isLoading, error, salvarComentario } =
    useFechamentoBoneDayPorIndicadores(effectiveProfileId);

  const monthOptions = useMemo(() => getMonthOptions(), []);
  const admin = Boolean(isAdmin);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--moni-surface-50)' }}>
      <BoneDayTabs />

      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{
              fontFamily: 'var(--moni-font-display)',
              fontSize: '22px',
              fontWeight: 700,
              color: 'var(--moni-text-primary)',
              margin: 0,
            }}>
              Fechamento Boné Day por Indicadores
            </h1>
            <p style={{ fontSize: '13px', fontFamily: 'var(--moni-font-sans)', color: 'var(--moni-text-tertiary)', marginTop: '4px' }}>
              Áreas agrupadas pela nota de Indicadores do mês
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontFamily: 'var(--moni-font-sans)', color: 'var(--moni-text-tertiary)' }}>
                Mês:
              </label>
              <select
                value={mes}
                onChange={e => setMes(e.target.value)}
                style={{
                  fontSize: '13px',
                  fontFamily: 'var(--moni-font-sans)',
                  border: '0.5px solid var(--moni-border-default)',
                  borderRadius: 'var(--moni-radius-md)',
                  padding: '6px 10px',
                  background: 'var(--moni-surface-0)',
                  color: 'var(--moni-text-primary)',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                {monthOptions.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <SeletorUsuarioAdmin />
          </div>
        </div>

        {error && (
          <p style={{ fontSize: '12px', color: 'var(--moni-status-overdue-text)', fontFamily: 'var(--moni-font-sans)' }}>
            Erro: {error}
          </p>
        )}

        {/* Rótulo do mês */}
        <p style={{ fontSize: '14px', fontFamily: 'var(--moni-font-sans)', color: 'var(--moni-text-secondary)', marginTop: '-12px' }}>
          {getMonthLabel(mes)}
        </p>

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{ height: '80px', borderRadius: 'var(--moni-radius-lg)', background: 'var(--moni-surface-200)', animation: 'pulse 1.5s ease-in-out infinite' }} />
              ))}
            </div>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{ height: '120px', borderRadius: 'var(--moni-radius-lg)', background: 'var(--moni-surface-200)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        ) : (
          <>
            {/* Cartões de resumo */}
            <CartoesResumo grupos={grupos} />

            {/* Grupos com tabelas */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {GRUPOS_CONFIG.map(grupo => {
                const grupoData = grupos.find(g => g.id === grupo.id);
                const areasGrupo = grupoData?.areas ?? [];

                return (
                  <div
                    key={grupo.id}
                    style={{
                      background: 'var(--moni-surface-0)',
                      border: '0.5px solid var(--moni-border-default)',
                      borderRadius: 'var(--moni-radius-lg)',
                      overflow: 'hidden',
                      boxShadow: 'var(--moni-shadow-card, 0 1px 4px rgba(12,38,51,0.07))',
                    }}
                  >
                    {/* Cabeçalho do grupo */}
                    <div
                      style={{
                        background: grupo.corFundo,
                        padding: '12px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <h2 style={{
                        fontFamily: 'var(--moni-font-sans)',
                        fontSize: '15px',
                        fontWeight: 700,
                        color: grupo.corTexto,
                        margin: 0,
                      }}>
                        {grupo.label}
                      </h2>
                      <span style={{
                        fontSize: '12px',
                        fontFamily: 'var(--moni-font-sans)',
                        fontWeight: 600,
                        color: grupo.corTexto,
                        background: 'rgba(255,255,255,0.18)',
                        borderRadius: 'var(--moni-radius-md)',
                        padding: '2px 10px',
                        flexShrink: 0,
                      }}>
                        {areasGrupo.length} {areasGrupo.length === 1 ? 'área' : 'áreas'}
                      </span>
                    </div>

                    {/* Tabela */}
                    <TabelaGrupo
                      areas={areasGrupo}
                      isAdmin={admin}
                      onSalvarComentario={salvarComentario}
                    />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
