'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  calcularStatusCelula,
  CORES_CELULA,
  iniciaisNome,
  labelIntervaloSemana,
  prazoPassouSemana,
  semanaEhAtual,
  semanaEhFutura,
  type RegistroStatusPreenchimento,
  type SemanaColuna,
  type StatusCelula,
} from '@/utils/statusPreenchimento';
import { registrarEventoStatusPreenchimento } from '@/utils/statusPreenchimentoLog';
import { isoWeek, isoWeekYear } from '@/utils/periodos';
import type { EntregaModalContext } from './StatusPreenchimentoEntregaModal';
import type { AreaComResponsaveis, ResponsavelArea } from './useStatusPreenchimentoData';

type Props = {
  areas: AreaComResponsaveis[];
  semanasColunas: SemanaColuna[];
  registros: RegistroStatusPreenchimento[];
  temDadosGanttAreaSemana: (areaId: string, col: SemanaColuna, usuarioId?: string) => boolean;
  temDadosIndicadoresAreaSemana: (areaId: string, col: SemanaColuna) => boolean;
  onCelulaClick: (areaId: string, responsavelId: string, col: SemanaColuna) => void;
  onCelulaOkClick: (payload: EntregaModalContext) => void;
  authUserId: string | null;
  authNome: string;
};

function CelulaStatus({
  status,
  tooltip,
  onClick,
  clicavel,
}: {
  status: StatusCelula;
  tooltip: string;
  onClick?: () => void;
  clicavel: boolean;
}) {
  if (status === 'futuro') {
    return <td className="sp-cell sp-cell--futuro" title="Semana futura" />;
  }
  const c = CORES_CELULA[status];
  return (
    <td
      className={`sp-cell${clicavel ? ' sp-cell--clicavel' : ''}`}
      style={{ background: c.bg }}
      title={tooltip}
      onClick={clicavel ? onClick : undefined}
      role={clicavel ? 'button' : undefined}
      tabIndex={clicavel ? 0 : undefined}
      onKeyDown={
        clicavel
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      <span className="sp-dot" style={{ background: c.dot }} />
    </td>
  );
}

export function StatusPreenchimentoBoard({
  areas,
  semanasColunas,
  registros,
  temDadosGanttAreaSemana,
  temDadosIndicadoresAreaSemana,
  onCelulaClick,
  onCelulaOkClick,
  authUserId,
  authNome,
}: Props) {
  const [anterioresExpandido, setAnterioresExpandido] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const hoje = useMemo(() => new Date(), []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  const semanaAtual = isoWeek(hoje);
  const anoAtual = isoWeekYear(hoje);

  const anteriores = semanasColunas.filter((c) => c.offset <= -2);
  const visiveis = semanasColunas.filter((c) => c.offset >= -1);

  const colunasRender = anterioresExpandido ? semanasColunas : [...(anteriores.length ? [{ compacta: true as const }] : []), ...visiveis];

  const labelAnteriores =
    anteriores.length >= 2
      ? `◀ S${anteriores[0].semanaIso}–S${anteriores[anteriores.length - 1].semanaIso}`
      : anteriores.length === 1
        ? `◀ S${anteriores[0].semanaIso}`
        : '◀ Anteriores';

  function tooltipCelula(
    status: StatusCelula,
    reg: RegistroStatusPreenchimento | undefined,
    areaNome: string,
    col: SemanaColuna,
  ): string {
    if (status === 'ok' && reg) {
      const d = new Date(reg.registrado_em);
      return `Registrado em ${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (status === 'nok') return 'Prazo encerrado sem registro de entrega';
    if (status === 'pendente') return 'Aguardando registro até a sexta-feira';
    if (status === 'sem_dados') return 'Sem dados em Gantt ou Indicadores — registro indisponível';
    if (status === 'futuro') return 'Semana ainda não iniciada';
    return `${areaNome} · S${col.semanaIso}`;
  }

  function handleClick(
    area: AreaComResponsaveis,
    resp: ResponsavelArea,
    col: SemanaColuna,
    status: StatusCelula,
    reg?: RegistroStatusPreenchimento,
  ) {
    if (semanaEhFutura(col.semanaIso, col.ano) || status === 'futuro') return;

    if (status === 'ok' && reg?.id) {
      const respRegistro =
        area.responsaveis.find((r) => r.usuarioId === reg.usuario_id) ??
        area.responsaveis.find((r) => !r.usuarioId.startsWith('nome:')) ??
        resp;
      onCelulaOkClick({
        registro: reg,
        areaNome: area.nome,
        responsavel: respRegistro,
        col,
      });
      return;
    }

    const isAtual = semanaEhAtual(col.semanaIso, col.ano, hoje);
    if (status === 'pendente' && isAtual) {
      onCelulaClick(area.id, resp.usuarioId, col);
      return;
    }

    if (status === 'nok' || prazoPassouSemana(col.semanaIso, col.ano, hoje)) {
      setToast('Prazo encerrado — registro não permitido.');
      void registrarEventoStatusPreenchimento(
        'status_preenchimento_bloqueado',
        `Tentativa de registro bloqueada — prazo encerrado — ${area.nome} · S${col.semanaIso} · por ${authNome}`,
        area.nome,
      );
    }
  }

  function celulaClicavel(status: StatusCelula, col: SemanaColuna, reg?: RegistroStatusPreenchimento): boolean {
    if (semanaEhFutura(col.semanaIso, col.ano) || status === 'futuro') return false;
    if (status === 'ok') return Boolean(reg?.id);
    if (status === 'pendente' && semanaEhAtual(col.semanaIso, col.ano, hoje)) return true;
    if (status === 'nok') return true;
    return false;
  }

  return (
    <div className="sp-board-wrap">
      {toast && (
        <div className="sp-toast" role="status">
          {toast}
        </div>
      )}
      <div className="sp-board-toolbar">
        {anteriores.length > 0 && (
          <button
            type="button"
            className="sp-toolbar-btn"
            onClick={() => setAnterioresExpandido((v) => !v)}
          >
            {anterioresExpandido ? 'Recolher anteriores' : 'Expandir'}
          </button>
        )}
      </div>

      <div className="sp-legenda">
        {(Object.keys(CORES_CELULA) as (keyof typeof CORES_CELULA)[]).map((k) => (
          <span key={k} className="sp-legenda-item">
            <span className="sp-dot" style={{ background: CORES_CELULA[k].dot }} />
            {CORES_CELULA[k].label}
          </span>
        ))}
      </div>

      <div className="sp-table-scroll">
        <table className="sp-table">
          <thead>
            <tr>
              <th className="sp-th-area">Área / Responsável</th>
              {colunasRender.map((col, idx) => {
                if ('compacta' in col && col.compacta) {
                  return (
                    <th key="compact" className="sp-th-compact" rowSpan={1}>
                      <span className="sp-th-vertical">{labelAnteriores}</span>
                    </th>
                  );
                }
                const c = col as SemanaColuna;
                const isAtual = c.semanaIso === semanaAtual && c.ano === anoAtual;
                const futuro = semanaEhFutura(c.semanaIso, c.ano);
                const bloqueado = prazoPassouSemana(c.semanaIso, c.ano);
                return (
                  <th
                    key={`${c.ano}-${c.semanaIso}`}
                    className={`sp-th-semana ${isAtual ? 'sp-th-semana--atual' : ''} ${futuro ? 'sp-th-semana--futuro' : ''}`}
                  >
                    <div>S{c.semanaIso}</div>
                    <div className="sp-th-datas">{labelIntervaloSemana(c.semanaIso, c.ano)}</div>
                    {bloqueado && !futuro && (
                      <div className="sp-th-bloqueado">
                        <span>🔒</span> bloqueado
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {areas.map((area) => {
              const rows =
                area.responsaveis.length > 0
                  ? area.responsaveis
                  : [{ usuarioId: '_vazio', nome: '—', email: null }];
              const multi = area.responsaveis.length > 1;

              return (
                <Fragment key={area.id}>
                  {multi && (
                    <tr className="sp-row-area">
                      <td colSpan={colunasRender.length + 1}>
                        <strong>{area.nome}</strong>
                        <span className="sp-area-count">
                          {area.responsaveis.length} responsáve{area.responsaveis.length === 1 ? 'l' : 'is'}
                        </span>
                      </td>
                    </tr>
                  )}
                  {rows.map((resp) => (
                    <tr key={`${area.id}-${resp.usuarioId}`} className="sp-row-resp">
                      <td className="sp-td-area">
                        {!multi && <span className="sp-area-inline">{area.nome}</span>}
                        <span className="sp-resp-line">
                          <span className="sp-avatar">{iniciaisNome(resp.nome)}</span>
                          {resp.nome}
                        </span>
                      </td>
                      {colunasRender.map((col) => {
                        if ('compacta' in col && col.compacta) {
                          const statuses = anteriores.map((c) => {
                            const temG = temDadosGanttAreaSemana(area.id, c, resp.usuarioId);
                            const temI = temDadosIndicadoresAreaSemana(area.id, c);
                            return calcularStatusCelula({
                              semanaIso: c.semanaIso,
                              ano: c.ano,
                              registros,
                              areaId: area.id,
                              usuarioId: resp.usuarioId.startsWith('nome:') ? authUserId || resp.usuarioId : resp.usuarioId,
                              temDadosGantt: temG,
                              temDadosIndicadores: temI,
                            });
                          });
                          const dot =
                            statuses.find((s) => s === 'nok') ||
                            statuses.find((s) => s === 'pendente') ||
                            statuses[0] ||
                            'sem_dados';
                          if (dot === 'futuro') {
                            return <td key="compact" className="sp-cell sp-cell--futuro" />;
                          }
                          const c = CORES_CELULA[dot as keyof typeof CORES_CELULA];
                          return (
                            <td key="compact" className="sp-cell sp-cell--compact" style={{ background: c?.bg }}>
                              <span className="sp-dot" style={{ background: c?.dot }} />
                            </td>
                          );
                        }
                        const c = col as SemanaColuna;
                        const uid = resp.usuarioId.startsWith('nome:') ? authUserId || resp.usuarioId : resp.usuarioId;
                        const temG = temDadosGanttAreaSemana(area.id, c, resp.usuarioId);
                        const temI = temDadosIndicadoresAreaSemana(area.id, c);
                        const status = calcularStatusCelula({
                          semanaIso: c.semanaIso,
                          ano: c.ano,
                          registros,
                          areaId: area.id,
                          usuarioId: uid || resp.usuarioId,
                          temDadosGantt: temG,
                          temDadosIndicadores: temI,
                        });
                        const reg = registros.find(
                          (r) =>
                            r.area_id === area.id &&
                            r.semana_iso === c.semanaIso &&
                            r.ano === c.ano &&
                            (r.usuario_id === uid || r.usuario_id === resp.usuarioId),
                        );
                        const clicavel = celulaClicavel(status, c, reg);
                        return (
                          <CelulaStatus
                            key={`${c.ano}-${c.semanaIso}`}
                            status={status}
                            tooltip={tooltipCelula(status, reg, area.nome, c)}
                            clicavel={clicavel}
                            onClick={() => handleClick(area, resp, c, status, reg)}
                          />
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
