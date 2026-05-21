'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PastelariaCardView } from '@/lib/pastelaria/api-client';
import {
  createAreaPessoa,
  fetchPastelariaAreaPessoas,
  PastelariaApiError,
} from '@/lib/pastelaria/api-client';
import {
  diaUnidadeFromRow,
  formatDiaHorasResumo,
  formatTotalHorasLabel,
  PASTELARIA_DIAS_HORAS,
  totalHorasConvertidas,
  totalHorasFromDias,
} from '@/lib/pastelaria/converter';
import type {
  PastelariaColuna,
  PastelariaEstimativaUnidade,
  PastelariaHorasRow,
  PastelariaHorasSemanaSave,
} from '@/lib/pastelaria/types';
import {
  responsavelAvatarStyle,
  responsavelDisplayNome,
  responsavelIniciais,
} from '@/lib/pastelaria/responsavel';
import {
  getDiasDaSemana,
  semanaAtualLabel,
  semanaLabelFromNum,
} from '@/lib/pastelaria/week';
import { isoWeek } from '@/utils/periodos';
import { parseSemanaMetaTexto } from '@/utils/metaCiclo';

const ADD_PESSOA_OPTION = '__add_pessoa__';
/** Janela retroativa do seletor de semana no modal de horas (inclui a semana atual). */
const MODAL_HORAS_SEMANAS_RETRO = 20;

const MESES_ABREV = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
] as const;

const DIAS_SEMANA_ABREV = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const;

function formatDataDia(d: Date): string {
  return `${d.getDate()}-${MESES_ABREV[d.getMonth()]}`;
}

function formatNomeDia(d: Date): string {
  return `(${DIAS_SEMANA_ABREV[d.getDay()]})`;
}

function isMesmoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

type AreaOption = { id: string; nome: string };
type PessoaOption = { id: string; nome: string };

export type NovoPastelForm = {
  nome: string;
  area_id: string;
  estimativa_valor: string;
  estimativa_unidade: 'h' | 'min';
  semana_origem: string;
  responsavel_id: string;
};

type HorasDiaCell = { valor: string; unidade: PastelariaEstimativaUnidade };
type HorasGrid = Record<
  string,
  { seg: HorasDiaCell; ter: HorasDiaCell; qua: HorasDiaCell; qui: HorasDiaCell; sex: HorasDiaCell }
>;

type PastelariaModalsProps = {
  areas: AreaOption[];
  semanaAtual: string;
  semanasOpcoes: string[];
  areaPessoas: PessoaOption[];
  loggedUserName: string;
  defaultAreaId: string;
  onReloadAreaPessoas: (areaId: string) => Promise<void>;
  novoOpen: boolean;
  novoColunaDestino: PastelariaColuna;
  saving: boolean;
  onCloseNovo: () => void;
  onSaveNovo: (form: NovoPastelForm, colunaDestino: PastelariaColuna) => void;
  reclassCard: PastelariaCardView | null;
  onCloseReclass: () => void;
  onSaveReclass: (payload: {
    action: 'redirect' | 'return';
    destino: string | null;
    justificativa: string;
  }) => void;
  horasCard: PastelariaCardView | null;
  horasInicial: PastelariaHorasRow[];
  onCloseHoras: () => void;
  onSaveHoras: (row: PastelariaHorasSemanaSave) => void | Promise<void>;
  detailCard: PastelariaCardView | null;
  detailHoras: PastelariaHorasRow[];
  onCloseDetail: () => void;
  onDetailAceitar: () => void;
  onDetailReclassificar: () => void;
  onDetailHoras: () => void;
  onDetailMoverProxima: () => void;
  onSaveDetailResponsavel: (payload: {
    responsavel_id: string | null;
    responsavel_nome?: string | null;
  }) => void;
  onDetailExcluir: () => void;
};

function defaultResponsavelId(pessoas: PessoaOption[], loggedUserName: string): string {
  const me = loggedUserName.trim().toLocaleLowerCase('pt-BR');
  if (!me) return pessoas[0]?.id ?? '';
  const found = pessoas.find((p) => p.nome.trim().toLocaleLowerCase('pt-BR') === me);
  return found?.id ?? pessoas[0]?.id ?? '';
}

function emptyHorasDia(): HorasDiaCell {
  return { valor: '', unidade: 'h' };
}

function horasDiaFromRow(
  row: PastelariaHorasRow | undefined,
  dia: (typeof PASTELARIA_DIAS_HORAS)[number]['key'],
): HorasDiaCell {
  return {
    valor: row?.[dia] != null ? String(row[dia]) : '',
    unidade: diaUnidadeFromRow(row, dia),
  };
}

function horasToGrid(rows: PastelariaHorasRow[], semanas: string[]): HorasGrid {
  const grid: HorasGrid = {};
  for (const s of semanas) {
    const row = rows.find((r) => r.semana === s);
    grid[s] = {
      seg: horasDiaFromRow(row, 'seg'),
      ter: horasDiaFromRow(row, 'ter'),
      qua: horasDiaFromRow(row, 'qua'),
      qui: horasDiaFromRow(row, 'qui'),
      sex: horasDiaFromRow(row, 'sex'),
    };
  }
  return grid;
}

export function PastelariaModals({
  areas,
  semanaAtual,
  semanasOpcoes,
  areaPessoas,
  loggedUserName,
  defaultAreaId,
  onReloadAreaPessoas,
  novoOpen,
  novoColunaDestino,
  saving,
  onCloseNovo,
  onSaveNovo,
  reclassCard,
  onCloseReclass,
  onSaveReclass,
  horasCard,
  horasInicial,
  onCloseHoras,
  onSaveHoras,
  detailCard,
  detailHoras,
  onCloseDetail,
  onDetailAceitar,
  onDetailReclassificar,
  onDetailHoras,
  onDetailMoverProxima,
  onSaveDetailResponsavel,
  onDetailExcluir,
}: PastelariaModalsProps) {
  const [novoForm, setNovoForm] = useState<NovoPastelForm>({
    nome: '',
    area_id: '',
    estimativa_valor: '1',
    estimativa_unidade: 'h',
    semana_origem: semanaAtual,
    responsavel_id: '',
  });

  const [novoPessoas, setNovoPessoas] = useState<PessoaOption[]>([]);
  const [novoPessoasLoading, setNovoPessoasLoading] = useState(false);
  const [novoAddPessoaOpen, setNovoAddPessoaOpen] = useState(false);
  const [novoAddPessoaNome, setNovoAddPessoaNome] = useState('');
  const [novoAddPessoaSaving, setNovoAddPessoaSaving] = useState(false);
  const [novoAddPessoaError, setNovoAddPessoaError] = useState<string | null>(null);

  const [detailResponsavelId, setDetailResponsavelId] = useState('');
  const [detailPessoas, setDetailPessoas] = useState<PessoaOption[]>([]);
  const [detailPessoasLoading, setDetailPessoasLoading] = useState(false);

  const [reclassAction, setReclassAction] = useState<'redirect' | 'return'>('redirect');
  const [reclassDestino, setReclassDestino] = useState('');
  const [reclassJustificativa, setReclassJustificativa] = useState('');
  const [reclassTouched, setReclassTouched] = useState(false);

  const semanaAtualIso = semanaAtualLabel();

  const semanasHoras = useMemo(() => {
    const atual = parseSemanaMetaTexto(semanaAtualIso) ?? isoWeek(new Date());
    const lo = Math.max(1, atual - MODAL_HORAS_SEMANAS_RETRO);
    const labels: string[] = [];
    for (let n = lo; n <= atual; n++) {
      labels.push(semanaLabelFromNum(n));
    }
    return labels.length > 0 ? labels : [semanaAtualIso];
  }, [semanaAtualIso]);

  const semanaMinimaHoras = semanasHoras[0] ?? semanaAtualIso;

  const [horasGrid, setHorasGrid] = useState<HorasGrid>({});
  const [semanaHorasIdx, setSemanaHorasIdx] = useState(0);

  const loadNovoPessoas = useCallback(
    async (areaId: string, preselectUser = true) => {
      if (!areaId) {
        setNovoPessoas([]);
        setNovoForm((f) => ({ ...f, responsavel_id: '' }));
        return;
      }
      setNovoPessoasLoading(true);
      try {
        const list = await fetchPastelariaAreaPessoas(areaId);
        setNovoPessoas(list);
        if (preselectUser) {
          setNovoForm((f) => ({
            ...f,
            responsavel_id: defaultResponsavelId(list, loggedUserName),
          }));
        }
      } catch {
        setNovoPessoas([]);
      } finally {
        setNovoPessoasLoading(false);
      }
    },
    [loggedUserName],
  );

  useEffect(() => {
    if (!novoOpen) {
      setNovoAddPessoaOpen(false);
      setNovoAddPessoaNome('');
      setNovoAddPessoaError(null);
      return;
    }
    const areaInicial = (defaultAreaId || areas[0]?.id) ?? '';
    setNovoForm({
      nome: '',
      area_id: areaInicial,
      estimativa_valor: '1',
      estimativa_unidade: 'h',
      semana_origem: semanaAtual,
      responsavel_id: '',
    });
    if (areaInicial) void loadNovoPessoas(areaInicial, true);
  }, [novoOpen, areas, semanaAtual, defaultAreaId, loadNovoPessoas]);

  useEffect(() => {
    if (!detailCard) return;
    setDetailResponsavelId(detailCard.responsavel_id ?? '');
    const area = detailCard.area_id;
    if (!area) {
      setDetailPessoas([]);
      return;
    }
    setDetailPessoasLoading(true);
    void fetchPastelariaAreaPessoas(area)
      .then((list) => setDetailPessoas(list))
      .catch(() => setDetailPessoas([]))
      .finally(() => setDetailPessoasLoading(false));
  }, [detailCard]);

  useEffect(() => {
    if (!horasCard) return;
    const atualIdx = semanasHoras.indexOf(semanaAtualIso);
    setSemanaHorasIdx(atualIdx >= 0 ? atualIdx : Math.max(0, semanasHoras.length - 1));
    setHorasGrid(horasToGrid(horasInicial, semanasHoras));
  }, [horasCard?.id, semanasHoras, semanaAtualIso]);

  useEffect(() => {
    if (!horasCard) return;
    const fromApi = horasToGrid(horasInicial, semanasHoras);
    setHorasGrid((prev) => {
      if (Object.keys(prev).length === 0) return fromApi;
      const merged = { ...prev };
      for (const sem of Object.keys(fromApi)) {
        if (horasInicial.some((r) => r.semana === sem)) {
          merged[sem] = fromApi[sem];
        }
      }
      for (const sem of semanasHoras) {
        if (!merged[sem]) merged[sem] = fromApi[sem];
      }
      return merged;
    });
  }, [horasCard, horasInicial, semanasHoras]);

  const semanaHorasAtiva = semanasHoras[semanaHorasIdx] ?? semanaAtualIso;
  const diasSemanaAtiva = useMemo(
    () => getDiasDaSemana(semanaHorasAtiva),
    [semanaHorasAtiva],
  );
  const celulasSemanaAtiva = horasGrid[semanaHorasAtiva] ?? {
    seg: emptyHorasDia(),
    ter: emptyHorasDia(),
    qua: emptyHorasDia(),
    qui: emptyHorasDia(),
    sex: emptyHorasDia(),
  };

  const totalSemanaAtiva = useMemo(
    () => totalHorasFromDias(celulasSemanaAtiva),
    [celulasSemanaAtiva],
  );

  const detalheTotalSemana = useMemo(() => {
    const partes = PASTELARIA_DIAS_HORAS.map(({ key }) =>
      formatDiaHorasResumo(key, Number(celulasSemanaAtiva[key].valor || 0), celulasSemanaAtiva[key].unidade),
    ).filter(Boolean);
    return partes.length > 0 ? partes.join(' + ') : 'nenhum dia preenchido';
  }, [celulasSemanaAtiva]);

  const hoje = useMemo(() => new Date(), []);

  const setCelulaDia = useCallback(
    (dia: (typeof PASTELARIA_DIAS_HORAS)[number]['key'], patch: Partial<HorasDiaCell>) => {
      setHorasGrid((g) => ({
        ...g,
        [semanaHorasAtiva]: {
          seg: g[semanaHorasAtiva]?.seg ?? emptyHorasDia(),
          ter: g[semanaHorasAtiva]?.ter ?? emptyHorasDia(),
          qua: g[semanaHorasAtiva]?.qua ?? emptyHorasDia(),
          qui: g[semanaHorasAtiva]?.qui ?? emptyHorasDia(),
          sex: g[semanaHorasAtiva]?.sex ?? emptyHorasDia(),
          [dia]: {
            ...(g[semanaHorasAtiva]?.[dia] ?? emptyHorasDia()),
            ...patch,
          },
        },
      }));
    },
    [semanaHorasAtiva],
  );

  const buildSaveRow = useCallback((): PastelariaHorasSemanaSave => {
    const g = horasGrid[semanaHorasAtiva] ?? {
      seg: emptyHorasDia(),
      ter: emptyHorasDia(),
      qua: emptyHorasDia(),
      qui: emptyHorasDia(),
      sex: emptyHorasDia(),
    };
    return {
      semana: semanaHorasAtiva,
      seg: Number(g.seg.valor || 0),
      seg_unidade: g.seg.unidade,
      ter: Number(g.ter.valor || 0),
      ter_unidade: g.ter.unidade,
      qua: Number(g.qua.valor || 0),
      qua_unidade: g.qua.unidade,
      qui: Number(g.qui.valor || 0),
      qui_unidade: g.qui.unidade,
      sex: Number(g.sex.valor || 0),
      sex_unidade: g.sex.unidade,
    };
  }, [horasGrid, semanaHorasAtiva]);

  useEffect(() => {
    if (!reclassCard) return;
    setReclassAction('redirect');
    setReclassDestino('');
    setReclassJustificativa('');
    setReclassTouched(false);
  }, [reclassCard]);

  const reclassInvalid = reclassTouched && !reclassJustificativa.trim();

  const destinoOpcoes = useMemo(() => {
    const areaOpts = areas.map((a) => ({ value: `area:${a.id}`, label: a.nome }));
    const pessoaOpts = areaPessoas.map((p) => ({ value: `pessoa:${p.id}`, label: p.nome }));
    return [...areaOpts, ...pessoaOpts];
  }, [areas, areaPessoas]);

  const handleNovoAddPessoa = async () => {
    const nome = novoAddPessoaNome.trim();
    const areaId = novoForm.area_id;
    if (!nome || !areaId) return;
    setNovoAddPessoaSaving(true);
    setNovoAddPessoaError(null);
    try {
      const pessoa = await createAreaPessoa(areaId, nome);
      await onReloadAreaPessoas(areaId);
      const list = await fetchPastelariaAreaPessoas(areaId);
      setNovoPessoas(list);
      setNovoForm((f) => ({ ...f, responsavel_id: pessoa.id }));
      setNovoAddPessoaOpen(false);
      setNovoAddPessoaNome('');
    } catch (e) {
      setNovoAddPessoaError(
        e instanceof PastelariaApiError ? e.message : 'Erro ao adicionar pessoa.',
      );
    } finally {
      setNovoAddPessoaSaving(false);
    }
  };

  const detailResponsavelNome = useMemo(() => {
    if (!detailCard) return null;
    return responsavelDisplayNome(detailCard);
  }, [detailCard]);

  const handleConfirmReclass = () => {
    setReclassTouched(true);
    if (!reclassJustificativa.trim()) return;
    const destinoLabel =
      reclassAction === 'redirect'
        ? destinoOpcoes.find((o) => o.value === reclassDestino)?.label ?? reclassDestino
        : null;
    onSaveReclass({
      action: reclassAction,
      destino: destinoLabel || null,
      justificativa: reclassJustificativa.trim(),
    });
  };

  return (
    <>
      <style>{`
        .pastelaria-modal--form {
          width: 100%;
          max-width: 520px;
          margin: auto;
          max-height: calc(100vh - 32px);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .pastelaria-modal--form .modal-body {
          overflow: visible;
          flex: 0 0 auto;
        }
        .pastelaria-modal--form .modal-footer {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 0.5rem;
          flex-shrink: 0;
          flex-wrap: wrap;
        }
        .pastelaria-btn-criar {
          background: #1a3d28;
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .pastelaria-btn-criar:hover:not(:disabled) {
          background: #245a38;
        }
        .pastelaria-btn-criar:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }
        .pastelaria-modal--horas {
          width: 500px;
          max-width: 95vw;
          overflow-x: hidden;
        }
        .pastelaria-horas-body {
          display: flex;
          flex-direction: column;
          gap: 12px;
          overflow-x: hidden;
        }
        .pastelaria-horas-week-nav {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        .pastelaria-horas-week-nav__btn {
          width: 32px;
          height: 32px;
          border: 1px solid var(--moni-borda, #ddd);
          border-radius: var(--border-radius-md, 8px);
          background: #fff;
          font-size: 14px;
          line-height: 1;
          cursor: pointer;
          color: var(--moni-texto, #333);
        }
        .pastelaria-horas-week-nav__btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
          pointer-events: none;
        }
        .pastelaria-horas-week-nav__label {
          font-size: 15px;
          font-weight: 700;
          min-width: 36px;
          text-align: center;
        }
        .pastelaria-horas-week-badge {
          font-size: 10px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 999px;
          background: #e1f5ee;
          color: #0f6e56;
          white-space: nowrap;
        }
        .pastelaria-horas-hint {
          margin: 0;
          font-size: 12px;
          color: var(--moni-texto-muted, #666);
          line-height: 1.4;
        }
        .pastelaria-horas-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 8px;
          width: 100%;
        }
        .pastelaria-horas-dia {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 6px;
          min-width: 0;
        }
        .pastelaria-horas-dia__data {
          font-size: 12px;
          font-weight: 700;
          text-align: center;
          color: var(--moni-texto, #333);
          line-height: 1.2;
        }
        .pastelaria-horas-dia__nome {
          font-size: 10px;
          text-align: center;
          color: var(--moni-texto-muted, #888);
          line-height: 1.2;
        }
        .pastelaria-horas-dia--hoje .pastelaria-horas-dia__data,
        .pastelaria-horas-dia--preenchido .pastelaria-horas-dia__data {
          color: #0f6e56;
        }
        .pastelaria-horas-dia__input {
          width: 100%;
          box-sizing: border-box;
          padding: 6px 4px;
          text-align: center;
          height: 36px;
          border-radius: var(--border-radius-md, 8px);
          border: 1px solid var(--moni-borda, #ddd);
          font-size: 13px;
        }
        .pastelaria-horas-dia--hoje .pastelaria-horas-dia__input {
          border-color: #5dcaa5;
        }
        .pastelaria-horas-dia--preenchido .pastelaria-horas-dia__input {
          background: #f0fbf7;
          border-color: #9fe1cb;
        }
        .pastelaria-horas-dia__unidade {
          width: 100%;
          box-sizing: border-box;
          padding: 4px 6px;
          height: 28px;
          border-radius: var(--border-radius-md, 8px);
          border: 1px solid var(--moni-borda, #ddd);
          font-size: 11px;
          appearance: none;
          background: #fff;
          color: var(--moni-texto-muted, #888);
          text-align: center;
        }
        .pastelaria-horas-dia--preenchido .pastelaria-horas-dia__unidade {
          color: var(--moni-texto, #333);
        }
        .pastelaria-horas-divider {
          border: none;
          border-top: 1px solid var(--moni-borda, #e8e8e8);
          margin: 4px 0 0;
        }
        .pastelaria-horas-footer {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: nowrap;
        }
        .pastelaria-horas-total__label {
          font-size: 11px;
          color: var(--moni-texto-muted, #888);
        }
        .pastelaria-horas-total__valor {
          font-size: 14px;
          font-weight: 700;
          color: var(--moni-texto, #333);
        }
        .pastelaria-horas-total__detalhe {
          font-size: 10px;
          color: var(--moni-texto-muted, #888);
          margin-top: 2px;
          max-width: 220px;
          line-height: 1.35;
        }
        .pastelaria-horas-footer__actions {
          display: flex;
          gap: 8px;
          flex-shrink: 0;
        }
        .pastelaria-btn-salvar-horas {
          background: #1a3d28;
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
        }
        .pastelaria-btn-salvar-horas:hover:not(:disabled) {
          background: #245a38;
        }
        .pastelaria-btn-salvar-horas:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }
        .pastelaria-reclass-just {
          width: 100%;
          min-height: 100px;
          resize: vertical;
          box-sizing: border-box;
          padding: 0.65rem 0.75rem;
          border-radius: 8px;
          border: 1px solid var(--moni-borda, #ddd);
          font-size: 0.9rem;
          font-family: inherit;
          line-height: 1.45;
        }
        .pastelaria-reclass-just:focus {
          outline: none;
          border-color: var(--moni-dourado, #b8860b);
          box-shadow: 0 0 0 1px rgba(184, 134, 11, 0.18);
        }
        .pastelaria-reclass-footer {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .pastelaria-btn-enviar-reclass {
          background: #1a3d28;
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .pastelaria-btn-enviar-reclass:hover:not(:disabled) {
          background: #245a38;
        }
        .pastelaria-btn-enviar-reclass:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }
        .pastelaria-add-pessoa {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 8px;
        }
        .pastelaria-add-pessoa input {
          width: 100%;
          height: 40px;
          padding: 0 0.75rem;
          border-radius: 8px;
          border: 1px solid var(--moni-borda, #ddd);
          font-size: 0.9rem;
          box-sizing: border-box;
        }
        .pastelaria-add-pessoa__err {
          margin: 0;
          font-size: 12px;
          color: #b91c1c;
        }
        .pastelaria-detail-responsavel {
          padding-bottom: 12px;
          margin-bottom: 8px;
          border-bottom: 1px solid var(--moni-borda, #e5e2dc);
        }
        .pastelaria-detail-responsavel__label {
          display: block;
          font-size: 0.8rem;
          font-weight: 600;
          margin-bottom: 6px;
          color: var(--moni-texto, #333);
        }
        .pastelaria-detail-responsavel__atual {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }
        .pastelaria-detail-responsavel__save {
          margin-top: 8px;
        }
      `}</style>
      {novoOpen ? (
        <div
          className="modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) onCloseNovo();
          }}
        >
          <div
            className="modal-card pastelaria-modal pastelaria-modal--form"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pastelaria-novo-title"
          >
            <div className="modal-header">
              <div>
                <h2 id="pastelaria-novo-title">Novo Pastel</h2>
                <p className="modal-subtitle">
                  O card será criado em {novoColunaDestino === 'doing' ? 'Em Andamento' : 'Mapeados'}.
                </p>
              </div>
              <button type="button" className="modal-close-btn" onClick={onCloseNovo} aria-label="Fechar" disabled={saving}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-field">
                <label htmlFor="pastelaria-novo-nome">Nome</label>
                <input
                  id="pastelaria-novo-nome"
                  type="text"
                  value={novoForm.nome}
                  onChange={(e) => setNovoForm((f) => ({ ...f, nome: e.target.value }))}
                />
              </div>
              <div className="modal-field">
                <label htmlFor="pastelaria-novo-area">Área</label>
                <select
                  id="pastelaria-novo-area"
                  value={novoForm.area_id}
                  onChange={(e) => {
                    const nextArea = e.target.value;
                    setNovoForm((f) => ({ ...f, area_id: nextArea, responsavel_id: '' }));
                    setNovoAddPessoaOpen(false);
                    void loadNovoPessoas(nextArea, true);
                  }}
                >
                  <option value="">Selecione</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="modal-field">
                <label htmlFor="pastelaria-novo-responsavel">Responsável</label>
                <select
                  id="pastelaria-novo-responsavel"
                  value={novoAddPessoaOpen ? ADD_PESSOA_OPTION : novoForm.responsavel_id}
                  disabled={!novoForm.area_id || novoPessoasLoading}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === ADD_PESSOA_OPTION) {
                      setNovoAddPessoaOpen(true);
                      setNovoAddPessoaError(null);
                      return;
                    }
                    setNovoAddPessoaOpen(false);
                    setNovoForm((f) => ({ ...f, responsavel_id: v }));
                  }}
                >
                  {novoPessoasLoading ? (
                    <option value="">Carregando…</option>
                  ) : (
                    <>
                      {novoPessoas.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome}
                        </option>
                      ))}
                      <option value={ADD_PESSOA_OPTION}>+ Adicionar pessoa…</option>
                    </>
                  )}
                </select>
                {novoAddPessoaOpen ? (
                  <div className="pastelaria-add-pessoa">
                    <input
                      type="text"
                      placeholder="Nome da pessoa"
                      value={novoAddPessoaNome}
                      onChange={(e) => setNovoAddPessoaNome(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void handleNovoAddPessoa();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="pastelaria-btn-criar"
                      disabled={novoAddPessoaSaving || !novoAddPessoaNome.trim()}
                      onClick={() => void handleNovoAddPessoa()}
                    >
                      {novoAddPessoaSaving ? 'Adicionando…' : 'Adicionar'}
                    </button>
                    {novoAddPessoaError ? (
                      <p className="pastelaria-add-pessoa__err">{novoAddPessoaError}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="modal-field-row">
                <div className="modal-field">
                  <label htmlFor="pastelaria-novo-estimativa">Estimativa</label>
                  <input
                    id="pastelaria-novo-estimativa"
                    type="number"
                    min={0}
                    step="0.5"
                    value={novoForm.estimativa_valor}
                    onChange={(e) => setNovoForm((f) => ({ ...f, estimativa_valor: e.target.value }))}
                  />
                </div>
                <div className="modal-field modal-field-unidade">
                  <label htmlFor="pastelaria-novo-unidade">Unidade</label>
                  <select
                    id="pastelaria-novo-unidade"
                    value={novoForm.estimativa_unidade}
                    onChange={(e) =>
                      setNovoForm((f) => ({
                        ...f,
                        estimativa_unidade: e.target.value as 'h' | 'min',
                      }))
                    }
                  >
                    <option value="h">h</option>
                    <option value="min">min</option>
                  </select>
                </div>
              </div>
              <div className="modal-field">
                <label htmlFor="pastelaria-novo-semana">Semana de origem</label>
                <select
                  id="pastelaria-novo-semana"
                  value={novoForm.semana_origem}
                  onChange={(e) => setNovoForm((f) => ({ ...f, semana_origem: e.target.value }))}
                >
                  {semanasOpcoes.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn" onClick={onCloseNovo} disabled={saving}>
                Cancelar
              </button>
              <button
                type="button"
                className="pastelaria-btn-criar"
                disabled={saving || !novoForm.nome.trim() || !novoForm.semana_origem}
                onClick={() => onSaveNovo(novoForm, novoColunaDestino)}
              >
                {saving ? 'Salvando…' : 'Criar Pastel'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {reclassCard ? (
        <div
          className="modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) onCloseReclass();
          }}
        >
          <div className="modal-card pastelaria-modal" role="dialog" aria-modal="true" aria-labelledby="pastelaria-reclass-title">
            <div className="modal-header">
              <div>
                <h2 id="pastelaria-reclass-title">Reclassificar</h2>
                <p className="modal-subtitle">{reclassCard.nome}</p>
              </div>
              <button type="button" className="modal-close-btn" onClick={onCloseReclass} aria-label="Fechar" disabled={saving}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p className="pastelaria-reclass-meta">
                {reclassCard.source ? <>Origem: {reclassCard.source}</> : null}
                {reclassCard.opened_by ? (
                  <>
                    {reclassCard.source ? ' · ' : null}
                    Aberto por: {reclassCard.opened_by}
                  </>
                ) : null}
              </p>
              <div className="pastelaria-alert-warn" role="note">
                Justificativa obrigatória. O solicitante será notificado.
              </div>
              <div className="modal-field">
                <label htmlFor="pastelaria-reclass-action">Ação</label>
                <select
                  id="pastelaria-reclass-action"
                  value={reclassAction}
                  onChange={(e) => setReclassAction(e.target.value as 'redirect' | 'return')}
                >
                  <option value="redirect">Redirecionar</option>
                  <option value="return">Devolver ao solicitante</option>
                </select>
              </div>
              {reclassAction === 'redirect' ? (
                <div className="modal-field">
                  <label htmlFor="pastelaria-reclass-destino">Destino</label>
                  <select
                    id="pastelaria-reclass-destino"
                    value={reclassDestino}
                    onChange={(e) => setReclassDestino(e.target.value)}
                  >
                    <option value="">Selecione área ou pessoa</option>
                    {destinoOpcoes.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="modal-field modal-field--full">
                <label htmlFor="pastelaria-reclass-just">Justificativa</label>
                <textarea
                  id="pastelaria-reclass-just"
                  rows={4}
                  value={reclassJustificativa}
                  className={`pastelaria-reclass-just${reclassInvalid ? ' pastelaria-input-invalid' : ''}`}
                  onChange={(e) => setReclassJustificativa(e.target.value)}
                  onBlur={() => setReclassTouched(true)}
                />
              </div>
            </div>
            <div className="modal-footer pastelaria-reclass-footer">
              <button type="button" className="btn" onClick={onCloseReclass} disabled={saving}>
                Cancelar
              </button>
              <button
                type="button"
                className="pastelaria-btn-enviar-reclass"
                disabled={saving}
                onClick={handleConfirmReclass}
                aria-label="Enviar reclassificação"
              >
                {saving ? 'Enviando…' : 'Enviar reclassificação'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {horasCard ? (
        <div
          className="modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) onCloseHoras();
          }}
        >
          <div
            className="modal-card pastelaria-modal pastelaria-modal--horas"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pastelaria-horas-title"
          >
            <div className="modal-header">
              <div>
                <h2 id="pastelaria-horas-title" className="pastelaria-horas-title">
                  {horasCard.nome.length > 48 ? `${horasCard.nome.slice(0, 48)}…` : horasCard.nome}
                </h2>
                <p className="modal-subtitle">Registrar horas por dia</p>
              </div>
              <button type="button" className="modal-close-btn" onClick={onCloseHoras} aria-label="Fechar" disabled={saving}>
                ×
              </button>
            </div>
            <div className="modal-body pastelaria-horas-body">
              <div className="pastelaria-horas-week-nav">
                <button
                  type="button"
                  className="pastelaria-horas-week-nav__btn"
                  aria-label="Semana anterior"
                  disabled={semanaHorasAtiva === semanaMinimaHoras || saving}
                  onClick={() => setSemanaHorasIdx((i) => Math.max(0, i - 1))}
                >
                  &lt;
                </button>
                <span className="pastelaria-horas-week-nav__label">{semanaHorasAtiva}</span>
                {semanaHorasAtiva === semanaAtualIso ? (
                  <span className="pastelaria-horas-week-badge">semana atual</span>
                ) : null}
                <button
                  type="button"
                  className="pastelaria-horas-week-nav__btn"
                  aria-label="Próxima semana"
                  disabled={semanaHorasAtiva === semanaAtualIso || saving}
                  onClick={() =>
                    setSemanaHorasIdx((i) => Math.min(semanasHoras.length - 1, i + 1))
                  }
                >
                  &gt;
                </button>
              </div>
              <p className="pastelaria-horas-hint">
                Informe o tempo em cada dia útil. A unidade pode ser horas ou minutos, por dia.
              </p>
              <div className="pastelaria-horas-grid">
                {PASTELARIA_DIAS_HORAS.map((d, idx) => {
                  const dataDia = diasSemanaAtiva[idx];
                  const inputId = `pastelaria-horas-${semanaHorasAtiva}-${d.key}`;
                  const selectId = `pastelaria-horas-${semanaHorasAtiva}-${d.key}-unidade`;
                  const cell = celulasSemanaAtiva[d.key];
                  const valorNum = Number(cell.valor || 0);
                  const ehHoje = dataDia ? isMesmoDia(dataDia, hoje) : false;
                  const preenchido = valorNum > 0;
                  const diaClass = [
                    'pastelaria-horas-dia',
                    ehHoje ? 'pastelaria-horas-dia--hoje' : '',
                    preenchido ? 'pastelaria-horas-dia--preenchido' : '',
                  ]
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <div key={d.key} className={diaClass}>
                      <div>
                        <div className="pastelaria-horas-dia__data">
                          {dataDia ? formatDataDia(dataDia) : d.label}
                        </div>
                        <div className="pastelaria-horas-dia__nome">
                          {dataDia ? formatNomeDia(dataDia) : `(${d.label.toLowerCase()})`}
                        </div>
                      </div>
                      <input
                        id={inputId}
                        className="pastelaria-horas-dia__input"
                        type="number"
                        min={0}
                        step={0.5}
                        placeholder="0"
                        value={cell.valor}
                        onChange={(e) => setCelulaDia(d.key, { valor: e.target.value })}
                      />
                      <select
                        id={selectId}
                        className="pastelaria-horas-dia__unidade"
                        aria-label={`Unidade ${d.label} ${semanaHorasAtiva}`}
                        value={cell.unidade}
                        onChange={(e) =>
                          setCelulaDia(d.key, {
                            unidade: e.target.value === 'min' ? 'min' : 'h',
                          })
                        }
                      >
                        <option value="h">horas</option>
                        <option value="min">minutos</option>
                      </select>
                    </div>
                  );
                })}
              </div>
              <hr className="pastelaria-horas-divider" />
            </div>
            <div className="modal-footer pastelaria-horas-footer">
              <div className="pastelaria-horas-total">
                <div className="pastelaria-horas-total__label">Total da semana</div>
                <div className="pastelaria-horas-total__valor">
                  {formatTotalHorasLabel(totalSemanaAtiva)}
                </div>
                <div className="pastelaria-horas-total__detalhe">{detalheTotalSemana}</div>
              </div>
              <div className="pastelaria-horas-footer__actions">
                <button type="button" className="btn" onClick={onCloseHoras} disabled={saving}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="pastelaria-btn-salvar-horas"
                  disabled={saving}
                  onClick={() => void onSaveHoras(buildSaveRow())}
                >
                  {saving ? 'Salvando…' : 'Salvar horas'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {detailCard ? (
        <div
          className="modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) onCloseDetail();
          }}
        >
          <div
            className="modal-card pastelaria-modal pastelaria-modal--form"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pastelaria-detail-title"
          >
            <div className="modal-header">
              <div>
                <h2 id="pastelaria-detail-title">{detailCard.nome}</h2>
                <p className="modal-subtitle">{detailCard.area_nome ?? 'Sem área'}</p>
              </div>
              <button type="button" className="modal-close-btn" onClick={onCloseDetail} aria-label="Fechar" disabled={saving}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="pastelaria-detail-responsavel">
                <span className="pastelaria-detail-responsavel__label">Responsável</span>
                {detailResponsavelNome ? (
                  <div className="pastelaria-detail-responsavel__atual">
                    <span
                      className="pastelaria-resp-avatar"
                      style={responsavelAvatarStyle(detailResponsavelNome)}
                    >
                      {responsavelIniciais(detailResponsavelNome)}
                    </span>
                    <span>{detailResponsavelNome}</span>
                  </div>
                ) : (
                  <span className="pastelaria-resp-vazio">Sem responsável</span>
                )}
                <div className="modal-field" style={{ marginTop: 8 }}>
                  <label htmlFor="pastelaria-detail-responsavel">Alterar responsável</label>
                  <select
                    id="pastelaria-detail-responsavel"
                    value={detailResponsavelId}
                    disabled={!detailCard.area_id || detailPessoasLoading || saving}
                    onChange={(e) => setDetailResponsavelId(e.target.value)}
                  >
                    <option value="">Sem responsável</option>
                    {detailPessoas.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="pastelaria-btn-criar pastelaria-detail-responsavel__save"
                  disabled={
                    saving ||
                    detailPessoasLoading ||
                    detailResponsavelId === (detailCard.responsavel_id ?? '')
                  }
                  onClick={() =>
                    onSaveDetailResponsavel({
                      responsavel_id: detailResponsavelId || null,
                    })
                  }
                >
                  Salvar responsável
                </button>
              </div>
              <dl className="pastelaria-detail-dl">
                <div>
                  <dt>Status</dt>
                  <dd>{detailCard.coluna}</dd>
                </div>
                {detailCard.source ? (
                  <div>
                    <dt>Origem</dt>
                    <dd>{detailCard.source}</dd>
                  </div>
                ) : null}
                {detailCard.opened_by ? (
                  <div>
                    <dt>Aberto por</dt>
                    <dd>{detailCard.opened_by}</dd>
                  </div>
                ) : null}
              </dl>
              <h3 className="pastelaria-detail-h3">Histórico de horas</h3>
              {detailHoras.length === 0 ? (
                <p className="modal-hint">Nenhuma hora registrada.</p>
              ) : (
                <ul className="pastelaria-detail-horas">
                  {detailHoras.map((h) => {
                    const total = totalHorasConvertidas(h);
                    const pct = Math.min(100, (total / 40) * 100);
                    return (
                      <li key={h.id}>
                        <span>{h.semana}</span>
                        <div className="pastelaria-detail-bar">
                          <span style={{ width: `${pct}%` }} />
                        </div>
                        <span>{total}h</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="modal-footer pastelaria-detail-footer">
              {detailCard.coluna === 'inbox' ? (
                <>
                  <button type="button" className="btn pastelaria-btn--aceitar" onClick={onDetailAceitar} disabled={saving}>
                    Aceitar
                  </button>
                  <button type="button" className="btn pastelaria-btn--reclass" onClick={onDetailReclassificar} disabled={saving}>
                    Reclassificar
                  </button>
                </>
              ) : null}
              <button type="button" className="btn" onClick={onDetailHoras} disabled={saving}>
                Registrar horas
              </button>
              {detailCard.coluna !== 'done' ? (
                <button type="button" className="btn btn-primary" onClick={onDetailMoverProxima} disabled={saving}>
                  Mover para próxima coluna
                </button>
              ) : null}
              <button type="button" className="btn btn-danger" onClick={onDetailExcluir} disabled={saving}>
                Excluir
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
