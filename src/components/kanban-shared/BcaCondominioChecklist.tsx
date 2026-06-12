'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Lock, Plus } from 'lucide-react';
import { KanbanFaseSecaoTabs } from '@/components/kanban-shared/KanbanFaseSecaoTabs';
import { carregarProspectsCondominioCard } from '@/lib/actions/kanban-condominio-pesquisa';
import {
  carregarBcaCondominioChecklistData,
  confirmarBcaCondominioCenario,
  criarBcaCondominioCenario,
  salvarBcaCondominioCenario,
  type BcaCondominioCenario,
  type CatalogoCasaBcaCondominio,
} from '@/lib/actions/kanban-bca-cenarios';
import {
  calcularBcaCondominioResultado,
  fmtMoedaBca,
  fmtPctBca,
} from '@/lib/funil-step-one/bca-fase-resultado';
import { prospectsOrdenadosPorTicketCasas } from '@/lib/kanban/condominio-prospect-pesquisa';

export type BcaCondominioChecklistProps = {
  cardId: string;
  processoId: string;
  itemLabel: string;
  obrigatorio: boolean;
};

type WizardStep = 'modelo' | 'custo' | 'terreno' | 'precos' | 'resultado';

const WIZARD_STEPS: { id: WizardStep; label: string }[] = [
  { id: 'modelo', label: 'Modelo' },
  { id: 'custo', label: 'Custo' },
  { id: 'terreno', label: 'Terreno' },
  { id: 'precos', label: 'Preços' },
  { id: 'resultado', label: 'Resultado' },
];

const inputClass =
  'w-full rounded-md border px-3 py-1.5 text-sm outline-none focus:ring-1' +
  ' bg-white border-[var(--moni-border-default)] text-[var(--moni-text-primary)]' +
  ' focus:ring-[var(--moni-primary-500)] focus:border-[var(--moni-primary-500)]';

function parseNumeroInput(raw: string): number | null {
  const t = raw.trim().replace(/\./g, '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function formatMoedaInput(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '';
  return Math.abs(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

function cenarioCompletoStep(c: BcaCondominioCenario, step: WizardStep): boolean {
  switch (step) {
    case 'modelo':
      return Boolean(c.catalogo_casa_id);
    case 'custo':
      return c.custo_casa != null && c.custo_casa !== 0;
    case 'terreno':
      return c.custo_terreno != null && c.custo_terreno !== 0;
    case 'precos':
      return (c.vgv_target ?? 0) > 0 && (c.vgv_liquidacao ?? 0) > 0;
    case 'resultado':
      return c.status === 'completo' || c.status === 'confirmado';
    default:
      return false;
  }
}

function filtrarCenariosCondominio(
  cenarios: BcaCondominioCenario[],
  rowId: string,
  condominioNome: string,
): BcaCondominioCenario[] {
  const nome = condominioNome.trim();
  return cenarios.filter(
    (c) =>
      (rowId && c.prospect_row_id === rowId) ||
      (nome && c.condominio_nome.trim() === nome),
  );
}

export function BcaCondominioChecklist({
  cardId,
  processoId,
  itemLabel,
  obrigatorio,
}: BcaCondominioChecklistProps) {
  const [linhas, setLinhas] = useState<{ row_id: string; condominio: string }[]>([]);
  const [rowIdAtivo, setRowIdAtivo] = useState<string | null>(null);
  const [catalogo, setCatalogo] = useState<CatalogoCasaBcaCondominio[]>([]);
  const [cenarios, setCenarios] = useState<BcaCondominioCenario[]>([]);
  const [cenarioAtivoId, setCenarioAtivoId] = useState<string | null>(null);
  const [wizardStep, setWizardStep] = useState<WizardStep>('modelo');
  const [carregandoInicial, setCarregandoInicial] = useState(true);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const pid = processoId.trim();
  const cid = cardId.trim();

  const recarregar = useCallback(async () => {
    if (!cid || !pid) {
      setErroCarregar('Vincule um processo Step One ao card para montar o BCA.');
      setCarregandoInicial(false);
      return;
    }
    setErroCarregar(null);
    const [prosRes, bcaRes] = await Promise.all([
      carregarProspectsCondominioCard(cid),
      carregarBcaCondominioChecklistData(cid, pid),
    ]);
    if (!prosRes.ok) {
      setErroCarregar(prosRes.error);
      setLinhas([]);
      setCarregandoInicial(false);
      return;
    }
    if (!bcaRes.ok) {
      setErroCarregar(bcaRes.error);
      setCarregandoInicial(false);
      return;
    }
    const ordenadas = prospectsOrdenadosPorTicketCasas(prosRes.linhas);
    setLinhas(ordenadas.map((l) => ({ row_id: l.row_id, condominio: l.condominio })));
    setCatalogo(bcaRes.catalogo);
    setCenarios(bcaRes.cenarios);
    setRowIdAtivo((atual) => {
      if (atual && ordenadas.some((l) => l.row_id === atual)) return atual;
      return ordenadas[0]?.row_id ?? null;
    });
    setCarregandoInicial(false);
  }, [cid, pid]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const linhaAtiva = linhas.find((l) => l.row_id === rowIdAtivo) ?? null;

  const cenariosDoCond = useMemo(() => {
    if (!linhaAtiva) return [];
    return filtrarCenariosCondominio(cenarios, linhaAtiva.row_id, linhaAtiva.condominio);
  }, [cenarios, linhaAtiva]);

  useEffect(() => {
    if (cenariosDoCond.length === 0) {
      setCenarioAtivoId(null);
      return;
    }
    if (!cenarioAtivoId || !cenariosDoCond.some((c) => c.id === cenarioAtivoId)) {
      setCenarioAtivoId(cenariosDoCond[0].id);
    }
  }, [cenariosDoCond, cenarioAtivoId]);

  const cenarioAtivo = cenariosDoCond.find((c) => c.id === cenarioAtivoId) ?? null;

  const tabsCondominio = useMemo(
    () =>
      linhas.map((row) => {
        const condCenarios = filtrarCenariosCondominio(cenarios, row.row_id, row.condominio);
        const temCompleto = condCenarios.some(
          (c) => c.status === 'completo' || c.status === 'confirmado',
        );
        return {
          id: row.row_id,
          label: `${row.condominio.trim()}${temCompleto ? ' ✓' : ''}`,
        };
      }),
    [linhas, cenarios],
  );

  const casaTabs = useMemo(
    () =>
      cenariosDoCond.map((c) => ({
        id: c.id,
        label: `${c.label || `Casa ${c.ordem}`}${
          c.status === 'completo' || c.status === 'confirmado' ? ' ✓' : ''
        }`,
      })),
    [cenariosDoCond],
  );

  const resultado = useMemo(() => {
    if (!cenarioAtivo) return null;
    return calcularBcaCondominioResultado({
      vgv_target: cenarioAtivo.vgv_target ?? 0,
      vgv_liquidacao: cenarioAtivo.vgv_liquidacao ?? 0,
      custo_casa: cenarioAtivo.custo_casa,
      custo_terreno: cenarioAtivo.custo_terreno,
      custo_projetos: cenarioAtivo.custo_projetos,
      mes_inicio_obra: cenarioAtivo.mes_inicio_obra,
      mes_venda_target: cenarioAtivo.mes_venda_target,
      cet_am: cenarioAtivo.cet_am,
      casa_nome: cenarioAtivo.casa_nome ?? 'Casa',
    });
  }, [cenarioAtivo]);

  const deltaPrecos = useMemo(() => {
    const t = cenarioAtivo?.vgv_target ?? 0;
    const l = cenarioAtivo?.vgv_liquidacao ?? 0;
    if (!t || !l) return null;
    return l / t - 1;
  }, [cenarioAtivo]);

  const comparativo = useMemo(() => {
    const confirmados = cenariosDoCond.filter(
      (c) => c.status === 'completo' || c.status === 'confirmado',
    );
    if (confirmados.length < 2) return null;
    return confirmados
      .map((c) => {
        const r = calcularBcaCondominioResultado({
          vgv_target: c.vgv_target ?? 0,
          vgv_liquidacao: c.vgv_liquidacao ?? 0,
          custo_casa: c.custo_casa,
          custo_terreno: c.custo_terreno,
          custo_projetos: c.custo_projetos,
          mes_inicio_obra: c.mes_inicio_obra,
          mes_venda_target: c.mes_venda_target,
          cet_am: c.cet_am,
          casa_nome: c.casa_nome ?? c.label,
        });
        return {
          id: c.id,
          nome: c.casa_nome ?? c.label,
          margemAlav: r?.margem_alav ?? 0,
        };
      })
      .sort((a, b) => b.margemAlav - a.margemAlav);
  }, [cenariosDoCond]);

  function aplicarCenarioAtualizado(atualizado: BcaCondominioCenario) {
    setCenarios((prev) => prev.map((c) => (c.id === atualizado.id ? atualizado : c)));
  }

  async function persistirPatch(
    patch: Parameters<typeof salvarBcaCondominioCenario>[0]['patch'],
  ) {
    if (!cenarioAtivo || !pid) return;
    setSalvando(true);
    setErroSalvar(null);
    const res = await salvarBcaCondominioCenario({
      cenarioId: cenarioAtivo.id,
      processoId: pid,
      patch,
    });
    setSalvando(false);
    if (!res.ok) {
      setErroSalvar(res.error);
      return;
    }
    aplicarCenarioAtualizado(res.cenario);
  }

  async function handleNovaCasa() {
    if (!linhaAtiva || !pid) return;
    const nextOrdem =
      cenariosDoCond.length > 0 ? Math.max(...cenariosDoCond.map((c) => c.ordem)) + 1 : 1;
    setSalvando(true);
    setErroSalvar(null);
    const res = await criarBcaCondominioCenario({
      cardId: cid,
      processoId: pid,
      prospectRowId: linhaAtiva.row_id,
      condominioNome: linhaAtiva.condominio,
      ordem: nextOrdem,
      label: `Casa ${nextOrdem}`,
    });
    setSalvando(false);
    if (!res.ok) {
      setErroSalvar(res.error);
      return;
    }
    setCenarios((prev) => [...prev, res.cenario]);
    setCenarioAtivoId(res.cenario.id);
    setWizardStep('modelo');
  }

  async function handleSelectModelo(casa: CatalogoCasaBcaCondominio) {
    if (!cenarioAtivo) return;
    setSalvando(true);
    setErroSalvar(null);
    const res = await salvarBcaCondominioCenario({
      cenarioId: cenarioAtivo.id,
      processoId: pid,
      patch: {
        catalogo_casa_id: casa.id,
        casa_nome: casa.nome,
        casa_area_m2: casa.area_m2,
        casa_largura_m: casa.largura_m,
        casa_profundidade_m: casa.profundidade_m,
        casa_quartos: casa.quartos,
        casa_suites: casa.suites,
        casa_banheiros: casa.banheiros,
        casa_vagas: casa.vagas,
        custo_projetos: casa.custo_projetos_padrao,
        mes_inicio_obra: casa.mes_inicio_obra_padrao ?? 7,
        fluxo_obra_json: casa.fluxo_obra_json,
      },
    });
    setSalvando(false);
    if (!res.ok) {
      setErroSalvar(res.error);
      return;
    }
    aplicarCenarioAtualizado(res.cenario);
    setWizardStep('custo');
  }

  async function handleConfirmarBca() {
    if (!cenarioAtivo || !resultado?.elegivel) return;
    setSalvando(true);
    setErroSalvar(null);
    const res = await confirmarBcaCondominioCenario(cenarioAtivo.id, pid);
    setSalvando(false);
    if (!res.ok) {
      setErroSalvar(res.error);
      return;
    }
    aplicarCenarioAtualizado(res.cenario);
  }

  const podeVerResultado =
    (cenarioAtivo?.vgv_target ?? 0) > 0 && (cenarioAtivo?.vgv_liquidacao ?? 0) > 0;

  if (carregandoInicial) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
        <Loader2 size={12} className="animate-spin" />
        Carregando BCA por condomínio...
      </div>
    );
  }

  if (erroCarregar && linhas.length === 0) {
    return <p className="text-xs text-red-500">{erroCarregar}</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <span className="mb-1 block text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
          {itemLabel || 'BCA por condomínio prospectado'}
          {obrigatorio ? <span className="ml-1 text-red-500">*</span> : null}
          {salvando ? <Loader2 size={10} className="ml-1 inline animate-spin" /> : null}
        </span>
        <p className="text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
          Para cada condomínio, monte o Business Case de cada casa candidata. O sistema calcula o
          resultado automaticamente.
        </p>
      </div>

      {linhas.length === 0 ? (
        <p
          className="rounded-md border px-3 py-4 text-sm italic"
          style={{ borderColor: 'var(--moni-border-default)', color: 'var(--moni-text-tertiary)' }}
        >
          Preencha a Tabela de Condomínios na fase Dados da Cidade primeiro.
        </p>
      ) : (
        <KanbanFaseSecaoTabs
          tabs={tabsCondominio}
          abaAtiva={rowIdAtivo ?? tabsCondominio[0]?.id ?? ''}
          onAbaChange={(id) => {
            setRowIdAtivo(id || null);
            setWizardStep('modelo');
          }}
          ariaLabel="Condomínios prospectados"
        >
          {linhaAtiva ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {casaTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setCenarioAtivoId(tab.id);
                      setWizardStep('modelo');
                    }}
                    className="rounded-md border px-3 py-1 text-xs font-medium"
                    style={{
                      borderColor:
                        cenarioAtivoId === tab.id
                          ? 'var(--moni-primary-500)'
                          : 'var(--moni-border-default)',
                      background: cenarioAtivoId === tab.id ? 'var(--moni-surface-100)' : 'white',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => void handleNovaCasa()}
                  disabled={salvando}
                  className="inline-flex items-center gap-1 rounded-md border border-dashed px-2 py-1 text-xs"
                  style={{ borderColor: 'var(--moni-border-default)', color: 'var(--moni-primary-600)' }}
                >
                  <Plus size={12} />
                  Casa
                </button>
              </div>

              {!cenarioAtivo ? (
                <p className="text-xs italic" style={{ color: 'var(--moni-text-tertiary)' }}>
                  Clique em «+ Casa» para iniciar um cenário BCA neste condomínio.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-1">
                    {WIZARD_STEPS.map((s) => {
                      const completo = cenarioCompletoStep(cenarioAtivo, s.id);
                      const bloqueado = s.id === 'resultado' && !podeVerResultado;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          disabled={bloqueado}
                          onClick={() => !bloqueado && setWizardStep(s.id)}
                          className="rounded px-2 py-0.5 text-[11px] font-medium disabled:cursor-not-allowed disabled:opacity-40"
                          style={{
                            background:
                              wizardStep === s.id ? 'var(--moni-primary-500)' : 'var(--moni-surface-100)',
                            color: wizardStep === s.id ? 'white' : 'var(--moni-text-secondary)',
                          }}
                        >
                          {completo ? '✓ ' : ''}
                          {s.label}
                        </button>
                      );
                    })}
                  </div>

                  {wizardStep === 'modelo' && (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {catalogo.map((casa) => {
                        const sel = cenarioAtivo.catalogo_casa_id === casa.id;
                        return (
                          <button
                            key={casa.id}
                            type="button"
                            onClick={() => void handleSelectModelo(casa)}
                            className="rounded-lg border p-3 text-left transition hover:border-stone-400"
                            style={{
                              borderColor: sel ? 'var(--moni-primary-500)' : 'var(--moni-border-default)',
                              background: sel ? 'var(--moni-surface-50)' : 'white',
                            }}
                          >
                            <p className="flex items-center gap-1 font-semibold text-stone-900">
                              {sel ? <CheckCircle2 size={14} className="text-emerald-600" /> : null}
                              {casa.nome ?? '—'}
                            </p>
                            <p className="mt-1 text-xs text-stone-500">
                              {casa.area_m2 ?? '—'} m² · {casa.largura_m ?? '—'}×{casa.profundidade_m ?? '—'} m
                            </p>
                            <p className="text-xs text-stone-500">
                              {casa.quartos ?? '—'} q · {casa.suites ?? '—'} suítes · {casa.banheiros ?? '—'} ban ·{' '}
                              {casa.vagas ?? '—'} vagas
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {wizardStep === 'custo' && (
                    <div className="max-w-md space-y-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                          Custo da casa — configurador Moní
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-stone-500">R$</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            className={inputClass}
                            defaultValue={formatMoedaInput(cenarioAtivo.custo_casa)}
                            key={`custo-${cenarioAtivo.id}-${cenarioAtivo.custo_casa}`}
                            onBlur={(e) => {
                              const v = parseNumeroInput(e.target.value);
                              if (v == null) return;
                              void persistirPatch({ custo_casa: -Math.abs(v) });
                            }}
                          />
                          {cenarioAtivo.casa_area_m2 && cenarioAtivo.custo_casa ? (
                            <span className="shrink-0 text-[11px] text-stone-500">
                              {fmtMoedaBca(
                                Math.abs(cenarioAtivo.custo_casa) / cenarioAtivo.casa_area_m2,
                              )}
                              /m²
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
                          Abra o configurador, selecione o modelo e informe o valor do orçamento
                        </p>
                      </div>
                      {cenarioCompletoStep(cenarioAtivo, 'custo') ? (
                        <button
                          type="button"
                          onClick={() => setWizardStep('terreno')}
                          className="rounded-md border px-3 py-1.5 text-xs font-medium"
                          style={{ borderColor: 'var(--moni-border-default)', color: 'var(--moni-primary-600)' }}
                        >
                          Avançar para Terreno →
                        </button>
                      ) : null}
                    </div>
                  )}

                  {wizardStep === 'terreno' && (
                    <div className="max-w-lg space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-medium">Custo do terreno (R$)</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            className={inputClass}
                            defaultValue={formatMoedaInput(cenarioAtivo.custo_terreno)}
                            key={`terreno-${cenarioAtivo.id}-${cenarioAtivo.custo_terreno}`}
                            onBlur={(e) => {
                              const v = parseNumeroInput(e.target.value);
                              if (v == null) return;
                              void persistirPatch({ custo_terreno: -Math.abs(v) });
                            }}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium">ITBI e outros (%)</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            className={inputClass}
                            defaultValue={String(
                              ((cenarioAtivo.itbi_percentual ?? 0.04) * 100).toFixed(1).replace('.', ','),
                            )}
                            key={`itbi-${cenarioAtivo.id}`}
                            onBlur={(e) => {
                              const v = parseNumeroInput(e.target.value);
                              if (v == null) return;
                              void persistirPatch({ itbi_percentual: v / 100 });
                            }}
                          />
                        </div>
                      </div>
                      <p className="flex items-center gap-1 text-xs text-stone-500">
                        <Lock size={12} />
                        Rentabilidade do terrenista: 15% a.a. — valor contratual Moní
                      </p>
                      {cenarioCompletoStep(cenarioAtivo, 'terreno') ? (
                        <button
                          type="button"
                          onClick={() => setWizardStep('precos')}
                          className="rounded-md border px-3 py-1.5 text-xs font-medium"
                          style={{ borderColor: 'var(--moni-border-default)', color: 'var(--moni-primary-600)' }}
                        >
                          Avançar para Preços de Venda →
                        </button>
                      ) : null}
                    </div>
                  )}

                  {wizardStep === 'precos' && (
                    <div className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-3">
                        {(
                          [
                            ['Target', 'vgv_target'],
                            ['Liquidação', 'vgv_liquidacao'],
                            ['Recompra', 'vgv_recompra'],
                          ] as const
                        ).map(([lbl, key]) => (
                          <div key={key}>
                            <label className="mb-1 block text-xs font-medium">{lbl} (R$)</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              className={inputClass}
                              defaultValue={formatMoedaInput(cenarioAtivo[key])}
                              key={`${key}-${cenarioAtivo.id}-${cenarioAtivo[key]}`}
                              onBlur={(e) => {
                                const v = parseNumeroInput(e.target.value);
                                if (v == null) return;
                                void persistirPatch({ [key]: v });
                              }}
                            />
                          </div>
                        ))}
                      </div>
                      {deltaPrecos != null ? (
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-[11px] font-medium ${
                            deltaPrecos >= -0.1
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {deltaPrecos >= -0.1 ? '∆ dentro do limite' : '∆ excede -10% ⚠'}
                        </span>
                      ) : null}
                      <div className="max-w-xs">
                        <label className="mb-1 block text-xs font-medium">CET % a.m.</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          className={inputClass}
                          defaultValue={((cenarioAtivo.cet_am ?? 0.021) * 100).toFixed(1).replace('.', ',')}
                          key={`cet-${cenarioAtivo.id}`}
                          onBlur={(e) => {
                            const v = parseNumeroInput(e.target.value);
                            if (v == null) return;
                            void persistirPatch({ cet_am: v / 100 });
                          }}
                        />
                      </div>
                      <p className="flex items-center gap-1 text-xs text-stone-500">
                        <Lock size={12} />
                        % Funding: 100% — padrão Moní
                      </p>
                      {podeVerResultado ? (
                        <button
                          type="button"
                          onClick={() => setWizardStep('resultado')}
                          className="rounded-md border px-3 py-1.5 text-xs font-medium"
                          style={{ borderColor: 'var(--moni-border-default)', color: 'var(--moni-primary-600)' }}
                        >
                          Ver resultado →
                        </button>
                      ) : null}
                    </div>
                  )}

                  {wizardStep === 'resultado' && resultado && cenarioAtivo && (
                    <ResultadoPanel
                      cenario={cenarioAtivo}
                      resultado={resultado}
                      salvando={salvando}
                      onEditar={() => setWizardStep('precos')}
                      onConfirmar={() => void handleConfirmarBca()}
                    />
                  )}
                </>
              )}

              {comparativo ? (
                <div className="rounded-lg bg-gray-900 p-3 text-stone-100">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
                    Comparativo — casas confirmadas
                  </p>
                  <div className="space-y-2">
                    {comparativo.map((c) => {
                      const pct = Math.max(0, Math.min(100, c.margemAlav * 100));
                      const cor = c.margemAlav >= 0.1 ? 'bg-emerald-500' : 'bg-amber-500';
                      return (
                        <div key={c.id} className="flex items-center gap-2 text-xs">
                          <span className="w-28 shrink-0 truncate font-medium">{c.nome}</span>
                          <div className="h-2 flex-1 overflow-hidden rounded bg-stone-700">
                            <div className={`h-full ${cor}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-12 shrink-0 text-right tabular-nums">
                            {fmtPctBca(c.margemAlav)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[10px] text-stone-400">
                    Margem após financiamento · mínimo elegível: 10%
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </KanbanFaseSecaoTabs>
      )}

      {linhas.length > 0 ? (
        <button
          type="button"
          disabled
          title="Em breve — condomínios vêm da Tabela de Condomínios"
          className="inline-flex items-center gap-1 rounded-md border border-dashed px-2 py-1 text-[11px] opacity-50"
          style={{ borderColor: 'var(--moni-border-default)', color: 'var(--moni-text-tertiary)' }}
        >
          <Plus size={11} />
          Condomínio
        </button>
      ) : null}

      {erroSalvar ? <p className="text-xs text-red-500">{erroSalvar}</p> : null}
    </div>
  );
}

function ResultadoPanel({
  cenario,
  resultado,
  salvando,
  onEditar,
  onConfirmar,
}: {
  cenario: BcaCondominioCenario;
  resultado: NonNullable<ReturnType<typeof calcularBcaCondominioResultado>>;
  salvando: boolean;
  onEditar: () => void;
  onConfirmar: () => void;
}) {
  const nome = cenario.casa_nome ?? cenario.label;
  const bg =
    resultado.estado === 'viavel'
      ? '#14532d'
      : resultado.estado === 'limite'
        ? '#713f12'
        : '#7f1d1d';

  let titulo = '🔴 Operação não elegível';
  let texto = '';
  if (resultado.estado === 'viavel') {
    titulo = '✅ Operação viável';
    texto = `O ${nome} apresenta uma operação sólida com VGV de ${fmtMoedaBca(cenario.vgv_target ?? 0)}. A margem de ${fmtPctBca(resultado.margem_bruta)} está dentro do exigido e, após o financiamento da obra, o resultado é de ${fmtPctBca(resultado.margem_alav)} — há espaço para imprevistos.`;
  } else if (resultado.estado === 'limite') {
    titulo = '🟡 Operação no limite';
    texto = `O ${nome} com VGV de ${fmtMoedaBca(cenario.vgv_target ?? 0)} é viável, mas opera perto do mínimo. A margem de ${fmtPctBca(resultado.margem_bruta)} está dentro do critério, porém após o financiamento chega a ${fmtPctBca(resultado.margem_alav)}. Confirme os custos antes de avançar.`;
  } else {
    const partes: string[] = [];
    if (resultado.margem_bruta < 0.1) {
      partes.push(`A margem de ${fmtPctBca(resultado.margem_bruta)} está abaixo do mínimo de 10%.`);
    }
    if (resultado.delta < -0.1) {
      partes.push(
        `O desconto de Liquidação vs Target (${fmtPctBca(resultado.delta)}) ultrapassa o limite de -10%.`,
      );
    }
    texto = partes.join(' ');
  }

  const deltaOk = resultado.delta >= -0.1;

  return (
    <div className="space-y-3">
      <div className="rounded-lg p-4 text-white" style={{ background: bg }}>
        <p className="font-semibold">{titulo}</p>
        <p className="mt-2 text-sm leading-relaxed opacity-95">{texto}</p>
      </div>

      <ul className="space-y-1 text-xs text-stone-700">
        <li>VGV Target: {fmtMoedaBca(cenario.vgv_target ?? 0)}</li>
        <li>Margem bruta: {fmtPctBca(resultado.margem_bruta)}</li>
        <li>
          Resultado após financiamento: {fmtPctBca(resultado.margem_alav)} · {fmtMoedaBca(resultado.result_alav)}
        </li>
        <li>Custo da casa: {fmtMoedaBca(resultado.custo_casa_abs)}</li>
        <li>Custo do terreno: {fmtMoedaBca(resultado.custo_terreno_abs)}</li>
        <li>
          ∆ Target vs Liquidação: {fmtPctBca(resultado.delta)}{' '}
          {deltaOk ? <span className="text-emerald-600">✓</span> : <span className="text-red-600">✗</span>}
        </li>
      </ul>

      <ul className="space-y-1 text-sm">
        <ChecklistLinha ok={resultado.margem_bruta >= 0.1} label="Margem final Target ≥ 10%" valor={fmtPctBca(resultado.margem_bruta)} />
        <ChecklistLinha ok={resultado.delta >= -0.1} label="∆ Target vs Liquidação ≤ -10%" valor={fmtPctBca(resultado.delta)} />
        <ChecklistLinha ok={resultado.margem_liquidacao >= 0} label="Margem final Liquidação ≥ 0%" valor={fmtPctBca(resultado.margem_liquidacao)} />
      </ul>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onEditar}
          className="rounded-md border px-3 py-1.5 text-xs font-medium"
          style={{ borderColor: 'var(--moni-border-default)' }}
        >
          ← Editar dados
        </button>
        {resultado.elegivel ? (
          <button
            type="button"
            disabled={salvando || cenario.status === 'completo'}
            onClick={onConfirmar}
            className="rounded-md bg-stone-900 px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {salvando ? 'Salvando…' : cenario.status === 'completo' ? '✓ BCA confirmado' : '✓ Confirmar este BCA'}
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-md bg-red-800 px-4 py-1.5 text-xs font-medium text-white opacity-80"
          >
            ✗ Não elegível
          </button>
        )}
      </div>
    </div>
  );
}

function ChecklistLinha({ ok, label, valor }: { ok: boolean; label: string; valor: string }) {
  return (
    <li className="flex items-center gap-2">
      <span>{ok ? '✅' : '❌'}</span>
      <span>
        {label} → <strong>{valor}</strong>
      </span>
    </li>
  );
}
