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
import type { AreaRelatorio } from '@/hooks/useFechamentoBoneDayPorIndicadores';

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

// ── Coluna Resultado: 3 carinhas em ordem fixa IND → ENG → SIR ───────────────
function ColunaResultado({ scores }: { scores: AreaRelatorio['scores'] }) {
  const itens = [
    { label: 'IND', score: scores.indicadores },
    { label: 'ENG', score: scores.engajamento },
    { label: 'SIR', score: scores.sirene },
  ];
  return (
    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
      {itens.map(({ label, score }) => (
        <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <img
            src={getCarinhaImg(score)}
            alt={label}
            style={{ width: '36px', height: '36px', flexShrink: 0 }}
          />
          <span style={{ fontSize: '11px', fontFamily: 'var(--moni-font-sans)', color: 'var(--moni-text-tertiary)', fontWeight: 500 }}>
            {label}
          </span>
          <span style={{ fontSize: '13px', fontFamily: 'var(--moni-font-sans)', fontWeight: 700, color: getScoreColor(score) }}>
            {score !== null ? `${score}%` : '—'}
          </span>
        </div>
      ))}
    </div>
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
      <span style={{ fontSize: '13px', fontFamily: 'var(--moni-font-sans)', color: 'var(--moni-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
        {valor}
      </span>
    ) : (
      <span style={{ fontSize: '13px', fontFamily: 'var(--moni-font-sans)', color: 'var(--moni-text-tertiary)', fontStyle: 'italic' }}>—</span>
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
            fontSize: '13px',
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
              fontSize: '12px',
              fontFamily: 'var(--moni-font-sans)',
              background: 'var(--moni-navy-800)',
              color: 'var(--moni-text-inverse)',
              border: 'none',
              borderRadius: 'var(--moni-radius-md)',
              padding: '4px 12px',
              cursor: 'pointer',
              minHeight: '28px',
            }}
          >
            Salvar
          </button>
          <button
            type="button"
            onClick={() => { setTexto(valor); setEditando(false); }}
            style={{
              fontSize: '12px',
              fontFamily: 'var(--moni-font-sans)',
              background: 'transparent',
              color: 'var(--moni-text-tertiary)',
              border: '0.5px solid var(--moni-border-default)',
              borderRadius: 'var(--moni-radius-md)',
              padding: '4px 12px',
              cursor: 'pointer',
              minHeight: '28px',
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
        fontSize: '13px',
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

// ── Tabela de uma área ────────────────────────────────────────────────────────
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
    fontSize: '11px',
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
    fontSize: '14px',
    fontFamily: 'var(--moni-font-sans)',
    color: 'var(--moni-text-secondary)',
    borderBottom: '0.5px solid var(--moni-border-subtle)',
    verticalAlign: 'middle',
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, minWidth: '160px' }}>Área</th>
            <th style={{ ...thStyle, minWidth: '180px' }}>Resultado</th>
            <th style={{ ...thStyle, textAlign: 'center', minWidth: '100px' }}>Metas Concluídas</th>
            <th style={{ ...thStyle, textAlign: 'center', minWidth: '100px' }}>Metas em Aberto</th>
            <th style={{ ...thStyle, textAlign: 'center', minWidth: '80px' }}>Blockers</th>
            <th style={{ ...thStyle, minWidth: '200px' }}>Comentários</th>
          </tr>
        </thead>
        <tbody>
          {areas.map(area => (
            <tr key={area.id} style={{ transition: 'background 0.15s' }}>
              <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--moni-text-primary)', fontSize: '15px' }}>
                {area.nome}
              </td>
              <td style={tdStyle}>
                <ColunaResultado scores={area.scores} />
              </td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>
                <span style={{
                  display: 'inline-block',
                  fontSize: '18px',
                  fontWeight: 700,
                  color: area.metasConcluidas > 0 ? 'var(--moni-green-600)' : 'var(--moni-text-tertiary)',
                  fontFamily: 'var(--moni-font-sans)',
                }}>
                  {area.metasConcluidas}
                </span>
              </td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>
                <span style={{
                  display: 'inline-block',
                  fontSize: '18px',
                  fontWeight: 700,
                  color: area.metasEmAberto > 0 ? 'var(--moni-status-overdue-text)' : 'var(--moni-text-tertiary)',
                  fontFamily: 'var(--moni-font-sans)',
                }}>
                  {area.metasEmAberto}
                </span>
              </td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>
                <span style={{
                  display: 'inline-block',
                  fontSize: '18px',
                  fontWeight: 700,
                  color: area.blockersCount > 0 ? 'var(--moni-gold-600)' : 'var(--moni-text-tertiary)',
                  fontFamily: 'var(--moni-font-sans)',
                }}>
                  {area.blockersCount}
                </span>
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

        {/* Legenda mês */}
        <p style={{ fontSize: '14px', fontFamily: 'var(--moni-font-sans)', color: 'var(--moni-text-secondary)', marginTop: '-12px' }}>
          {getMonthLabel(mes)}
        </p>

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{ height: '120px', borderRadius: 'var(--moni-radius-lg)', background: 'var(--moni-surface-200)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
