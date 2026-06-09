'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  rankChamadoPainelUnificado,
  type PrioridadeLabel,
} from '@/lib/sirene-painel-chamados-rank';
import { getTodoSireneTopicos } from '@/app/carometro/todo/sirene-actions';

type SireneRow = {
  key: string;
  topicoId: number;
  chamadoId: number;
  numero: number;
  titulo: string;
  frankNome: string | null;
  trava: boolean;
  teTrata: boolean | null;
  responsavelId: string;
  responsavelNome: string | null;
  responsavelTime: string | null;
  status: string;
  prazo: string | null;
  comentariosCount: number;
  prioridadeLabel: PrioridadeLabel;
  prioridadeCriterio: string;
};

const P_STYLE: Record<PrioridadeLabel, { bg: string; color: string }> = {
  P1: { bg: '#5c1212', color: '#ffd5d5' },
  P2: { bg: '#6b2800', color: '#ffdcc8' },
  P3: { bg: '#5a4200', color: '#fff4c0' },
  P4: { bg: '#1a3d28', color: '#d4f0e0' },
  P5: { bg: '#1a2e52', color: '#cce0ff' },
  P6: { bg: '#3a3a3a', color: '#e8e8e8' },
};

const P_LEGENDA: { label: PrioridadeLabel; desc: string }[] = [
  { label: 'P1', desc: 'Franqueado + trava + atrasado' },
  { label: 'P2', desc: 'Trava + atrasado (sem franqueado)' },
  { label: 'P3', desc: 'Franqueado + trava (sem atraso)' },
  { label: 'P4', desc: 'Só trava (sem franqueado)' },
  { label: 'P5', desc: 'Franqueado (sem trava)' },
  { label: 'P6', desc: 'Demais' },
];

const STATUS_LABEL: Record<string, string> = {
  nao_iniciado: 'Não iniciado',
  em_andamento: 'Em andamento',
};

function fmtPrazo(iso: string | null): { texto: string; atrasado: boolean } {
  if (!iso) return { texto: '—', atrasado: false };
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return {
    texto: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`,
    atrasado: dt < hoje,
  };
}

const ROLES_VISIVEIS = ['admin', 'team'];

type SireneStats = { total: number; comTrava: number; atrasados: number; semPrazo: number }

export function TodoPainelSirene({ onCountReady }: { onCountReady?: (stats: SireneStats) => void }) {
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [rows, setRows] = useState<SireneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtroResp, setFiltroResp] = useState<string>('mine');

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      const { data: prof } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      const role = String((prof as { role?: string } | null)?.role ?? '').toLowerCase();
      setUserRole(role);
      if (!ROLES_VISIVEIS.includes(role)) { setLoading(false); return; }
      await carregarDados();
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function carregarDados() {
    setErro(null);

    const result = await getTodoSireneTopicos();
    if (!result.ok) { setErro(result.error); return; }

    const profileMap = new Map(result.profiles.map((p) => [p.id, { nome: p.nome, time: p.time }]));

    // Montar linhas — uma por responsável por tópico
    const built: SireneRow[] = [];
    for (const t of result.topicos) {
      const respIds = t.responsaveisIds.length ? t.responsaveisIds : t.responsavelId ? [t.responsavelId] : [];

      const rank = rankChamadoPainelUnificado({
        frank_id: t.frankId,
        trava: t.trava,
        te_trata: t.teTrata,
        data_vencimento: t.dataFim ?? t.chamadoDataVencimento ?? null,
        atividade_status: t.status,
      });

      for (const rid of respIds) {
        const prof = profileMap.get(rid);
        built.push({
          key: `${t.id}_${rid}`,
          topicoId: t.id,
          chamadoId: t.chamadoId,
          numero: t.numero,
          titulo: t.descricao,
          frankNome: t.frankNome,
          trava: t.trava,
          teTrata: t.teTrata,
          responsavelId: rid,
          responsavelNome: prof?.nome ?? (rid === t.responsavelId ? t.responsavelNome : null),
          responsavelTime: prof?.time ?? null,
          status: t.status,
          prazo: t.dataFim,
          comentariosCount: result.msgCounts[t.chamadoId] ?? 0,
          prioridadeLabel: rank.prioridade_label,
          prioridadeCriterio: rank.prioridade_criterio,
        });
      }
    }

    // Ordenação: prioridade ASC, prazo ASC NULLS LAST
    built.sort((a, b) => {
      const pc = a.prioridadeLabel.localeCompare(b.prioridadeLabel);
      if (pc !== 0) return pc;
      if (!a.prazo && !b.prazo) return 0;
      if (!a.prazo) return 1;
      if (!b.prazo) return -1;
      return a.prazo.localeCompare(b.prazo);
    });

    setRows(built);
    onCountReady?.({
      total: built.length,
      comTrava: built.filter((r) => r.trava).length,
      atrasados: built.filter((r) => r.prazo != null && fmtPrazo(r.prazo).atrasado).length,
      semPrazo: built.filter((r) => r.prazo == null).length,
    });
  }

  const responsaveis = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) {
      if (r.responsavelNome && !m.has(r.responsavelId))
        m.set(r.responsavelId, r.responsavelNome);
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }, [rows]);

  const rowsFiltrados = useMemo(() => {
    return rows.filter((r) => {
      if (filtroResp === 'mine' && r.responsavelId !== userId) return false;
      if (filtroResp !== 'mine' && filtroResp !== 'all' && r.responsavelId !== filtroResp) return false;
      return true;
    });
  }, [rows, filtroResp, userId]);

  // Não renderiza para roles não autorizados
  if (!loading && (!userRole || !ROLES_VISIVEIS.includes(userRole))) return null;

  return (
    <div style={{ padding: '0 2px' }}>
      {/* Legenda sempre visível */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, padding: '10px 12px', background: '#faf9f6', border: '1px solid #e0d9ce', borderRadius: 8 }}>
        {P_LEGENDA.map(({ label, desc }) => {
          const s = P_STYLE[label];
          return (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <span style={{ background: s.bg, color: s.color, fontWeight: 700, padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>
                {label}
              </span>
              <span style={{ color: '#555' }}>{desc}</span>
            </span>
          );
        })}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 12, color: '#888780', whiteSpace: 'nowrap' }}>Responsável</label>
          <select
            value={filtroResp}
            onChange={(e) => setFiltroResp(e.target.value)}
            style={{ fontSize: 12, border: '0.5px solid #e0d9ce', borderRadius: 6, padding: '4px 8px', background: '#fff', color: '#1D2F25' }}
          >
            <option value="mine">Meus</option>
            <option value="all">Todos</option>
            {responsaveis.map(([id, nome]) => (
              <option key={id} value={id}>{nome}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Conteúdo */}
      {loading ? (
        <p style={{ fontSize: 13, color: '#888780', padding: '0 4px' }}>Carregando…</p>
      ) : erro ? (
        <p style={{ fontSize: 13, color: '#c62828', padding: '0 4px' }}>{erro}</p>
      ) : rowsFiltrados.length === 0 ? (
        <p style={{ fontSize: 13, color: '#888780', padding: '0 4px' }}>Nenhum tópico ativo para os filtros selecionados.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e0d9ce', textAlign: 'left' }}>
                {['', 'Chamado', 'Tópico', 'Franqueado', 'Responsável', 'Status', 'Prazo', '💬'].map(
                  (h, i) => (
                    <th
                      key={i}
                      style={{ padding: '6px 10px', fontWeight: 600, color: '#555', fontSize: 11, whiteSpace: 'nowrap' }}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rowsFiltrados.map((r) => {
                const { texto: prazoTexto, atrasado } = fmtPrazo(r.prazo);
                const ps = P_STYLE[r.prioridadeLabel];
                return (
                  <tr key={r.key} style={{ borderBottom: '1px solid #f0ece5' }}>
                    <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>
                      <span
                        title={r.prioridadeCriterio}
                        style={{ background: ps.bg, color: ps.color, fontWeight: 700, padding: '2px 7px', borderRadius: 4, fontSize: 11, cursor: 'help' }}
                      >
                        {r.prioridadeLabel}
                      </span>
                    </td>
                    <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>
                      <Link
                        href={`/sirene/chamados?id=${r.chamadoId}`}
                        style={{ color: '#1a3d28', fontWeight: 600, textDecoration: 'none', fontSize: 12 }}
                      >
                        #{r.numero}
                      </Link>
                    </td>
                    <td style={{ padding: '7px 10px', maxWidth: 260 }}>
                      <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {r.titulo}
                      </span>
                    </td>
                    <td style={{ padding: '7px 10px', color: r.frankNome ? '#333' : '#bbb', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {r.frankNome ?? '—'}
                    </td>
                    <td style={{ padding: '7px 10px', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {r.responsavelNome ?? <span style={{ color: '#bbb' }}>—</span>}
                    </td>
                    <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 999,
                        background: r.status === 'em_andamento' ? '#e3f0fc' : '#f0ece5',
                        color: r.status === 'em_andamento' ? '#1a5a8a' : '#666',
                      }}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </td>
                    <td style={{ padding: '7px 10px', whiteSpace: 'nowrap', color: atrasado ? '#c62828' : '#333', fontWeight: atrasado ? 700 : 400 }}>
                      {prazoTexto}
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'center', whiteSpace: 'nowrap', color: r.comentariosCount > 0 ? '#1a3d28' : '#bbb', fontSize: 12 }}>
                      {r.comentariosCount > 0 ? `💬 ${r.comentariosCount}` : '💬'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
