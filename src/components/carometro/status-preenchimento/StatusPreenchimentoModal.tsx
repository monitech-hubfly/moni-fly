'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ganttRowNaSemanaIso,
  iniciaisNome,
  labelIntervaloSemana,
  labelPrazoSexta,
  parseResponsaveisGantt,
  prazoPassouSemana,
  type SemanaColuna,
} from '@/utils/statusPreenchimento';
import { registrarEventoStatusPreenchimento } from '@/utils/statusPreenchimentoLog';
import type { AreaComResponsaveis, ResponsavelArea } from './useStatusPreenchimentoData';

type Props = {
  open: boolean;
  onClose: () => void;
  supabase: SupabaseClient;
  areas: AreaComResponsaveis[];
  semanaInicial: SemanaColuna;
  areaInicialId: string | null;
  responsavelInicialId: string | null;
  ganttRows: {
    responsavel: string | null;
    semanas_selecionadas?: unknown;
    semana_inicio?: number | null;
    semana_fim?: number | null;
    acoes?: { tarefas?: { area_id?: string } | { area_id?: string }[] };
  }[];
  indicadorIdsPorArea: Record<string, string[]>;
  lancamentosInd: { indicador_id: string; semana: number; semana_ano?: number | null; valor?: unknown }[];
  onConfirmado: () => void;
};

export function StatusPreenchimentoModal({
  open,
  onClose,
  supabase,
  areas,
  semanaInicial,
  areaInicialId,
  responsavelInicialId,
  ganttRows,
  indicadorIdsPorArea,
  lancamentosInd,
  onConfirmado,
}: Props) {
  const [areaId, setAreaId] = useState(areaInicialId || '');
  const [responsavelId, setResponsavelId] = useState(responsavelInicialId || '');
  const [semana, setSemana] = useState(semanaInicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [okGantt, setOkGantt] = useState(false);
  const [okInd, setOkInd] = useState(false);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authNome, setAuthNome] = useState('');

  useEffect(() => {
    if (!open) return;
    setAreaId(areaInicialId || areas[0]?.id || '');
    setResponsavelId(responsavelInicialId || '');
    setSemana(semanaInicial);
    setErro(null);
    supabase.auth.getUser().then(({ data }) => {
      setAuthUserId(data.user?.id ?? null);
      setAuthNome(data.user?.email ?? 'Usuário');
    });
  }, [open, areaInicialId, responsavelInicialId, semanaInicial, areas, supabase]);

  const area = useMemo(() => areas.find((a) => a.id === areaId), [areas, areaId]);
  const responsaveis = area?.responsaveis ?? [];
  const responsavel = responsaveis.find((r) => r.usuarioId === responsavelId) ?? responsaveis[0];

  useEffect(() => {
    if (!open || !areaId) return;
    const ids = responsaveis.map((r) => r.usuarioId);
    if (!responsavelId || !ids.includes(responsavelId)) {
      if (responsaveis[0]) setResponsavelId(responsaveis[0].usuarioId);
    }
  }, [open, areaId, responsavelId, responsaveis]);

  function handleAreaChange(novaAreaId: string) {
    setAreaId(novaAreaId);
    const novaArea = areas.find((a) => a.id === novaAreaId);
    const primeiro = novaArea?.responsaveis[0];
    setResponsavelId(primeiro?.usuarioId ?? '');
  }

  const validarDados = useCallback(async () => {
    if (!areaId || !responsavel) {
      setOkGantt(false);
      setOkInd(false);
      return;
    }
    const nomeLower = responsavel.nome.toLowerCase();
    const rowsArea = ganttRows.filter((g) => {
      const tarefa = Array.isArray(g.acoes?.tarefas) ? g.acoes!.tarefas![0] : g.acoes?.tarefas;
      if (tarefa?.area_id !== areaId) return false;
      if (!ganttRowNaSemanaIso(g, semana.semanaIso)) return false;
      const resp = parseResponsaveisGantt(g.responsavel);
      if (!resp.length) return true;
      return resp.some((n) => n.toLowerCase() === nomeLower);
    });
    setOkGantt(rowsArea.length > 0);

    const indIds = indicadorIdsPorArea[areaId] || [];
    const temInd = lancamentosInd.some((l) => {
      if (!indIds.includes(l.indicador_id)) return false;
      if (Number(l.semana) !== semana.semanaIso) return false;
      const anoL = l.semana_ano != null ? Number(l.semana_ano) : semana.ano;
      if (anoL !== semana.ano) return false;
      return l.valor != null && String(l.valor).trim() !== '';
    });
    setOkInd(temInd);
  }, [areaId, responsavel, ganttRows, semana, indicadorIdsPorArea, lancamentosInd]);

  useEffect(() => {
    validarDados();
  }, [validarDados]);

  const bloqueadoPrazo = prazoPassouSemana(semana.semanaIso, semana.ano);
  const podeConfirmar = !bloqueadoPrazo && !salvando && !!authUserId;

  async function confirmar() {
    if (!podeConfirmar || !area || !authUserId) return;
    const uid =
      responsavel.usuarioId.startsWith('nome:') || !responsavel.usuarioId.includes('-')
        ? authUserId
        : responsavel.usuarioId;
    setSalvando(true);
    setErro(null);
    const { error } = await supabase.from('status_preenchimento_registros').insert({
      area_id: areaId,
      usuario_id: uid,
      semana_iso: semana.semanaIso,
      ano: semana.ano,
      status: 'ok',
    });
    if (error) {
      setErro(error.message);
      setSalvando(false);
      return;
    }
    const desc = `Entrega registrada — ${area.nome} · S${semana.semanaIso} · por ${authNome}`;
    void registrarEventoStatusPreenchimento('status_preenchimento', desc, area.nome);
    setSalvando(false);
    onConfirmado();
    onClose();
  }

  if (!open) return null;

  return (
    <div className="sp-modal-overlay" role="dialog" aria-modal="true">
      <div className="sp-modal">
        <button type="button" className="sp-modal-close" onClick={onClose} aria-label="Fechar">
          ×
        </button>
        <div className="sp-modal-header">
          <h2>Registrar Entrega Semanal</h2>
          <span className="sp-modal-prazo-badge">Prazo: {labelPrazoSexta(semana.semanaIso, semana.ano)}</span>
        </div>
        <p className="sp-modal-sub">
          {area?.nome ?? '—'} · S{semana.semanaIso} · {labelIntervaloSemana(semana.semanaIso, semana.ano)}
        </p>

        <div className="sp-modal-fields">
          <label>
            Área
            <select value={areaId} onChange={(e) => handleAreaChange(e.target.value)}>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </select>
          </label>

          <div className="sp-modal-responsaveis">
            <span className="sp-modal-resp-label">Responsável</span>
            {responsaveis.length === 0 && (
              <p className="sp-modal-resp-vazio">Nenhum responsável com ações no Gantt para esta área.</p>
            )}
            {responsaveis.length === 1 && (
              <div className="sp-modal-resp-unico" aria-disabled="true">
                <span className="sp-avatar">{iniciaisNome(responsaveis[0].nome)}</span>
                <span>{responsaveis[0].nome}</span>
              </div>
            )}
            {responsaveis.length > 1 && (
              <div className="sp-modal-resp-btns">
                {responsaveis.map((r: ResponsavelArea) => (
                  <button
                    key={r.usuarioId}
                    type="button"
                    className={responsavelId === r.usuarioId ? 'sp-resp-btn sp-resp-btn--active' : 'sp-resp-btn'}
                    onClick={() => setResponsavelId(r.usuarioId)}
                  >
                    <span className="sp-avatar">{iniciaisNome(r.nome)}</span>
                    {r.nome}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <ul className="sp-checklist">
          <li className={okGantt ? 'sp-check sp-check--ok' : 'sp-check sp-check--neutro'}>
            <span className="sp-check-icon">{okGantt ? '✓' : '○'}</span>
            Planejamento (Gantt) — atividades e execuções encontradas
          </li>
          <li className={okInd ? 'sp-check sp-check--ok' : 'sp-check sp-check--neutro'}>
            <span className="sp-check-icon">{okInd ? '✓' : '○'}</span>
            Indicadores — valores e status da área na semana
          </li>
        </ul>

        <p className="sp-modal-hint">
          Para garantir uma reunião produtiva, confirme o registro apenas após preencher o Planejamento (Gantt) e os
          Indicadores da semana.
        </p>

        {bloqueadoPrazo && (
          <p className="sp-modal-aviso sp-modal-aviso--bloqueio">Prazo encerrado — registro bloqueado após a sexta-feira.</p>
        )}
        {erro && <p className="sp-modal-erro">{erro}</p>}

        <button
          type="button"
          className="sp-btn-confirmar"
          disabled={!podeConfirmar}
          onClick={confirmar}
        >
          Confirmar entrega
        </button>
      </div>
    </div>
  );
}
