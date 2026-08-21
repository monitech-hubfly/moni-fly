'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, Lock, Plus } from 'lucide-react';
import type { BcaInputs } from '@/lib/bca-calc';
import { BCA_DEFAULTS, calcBca } from '@/lib/bca-calc';
import {
  resolverCustoConfigurador,
  type ConfiguradorCasasValoresJson,
} from '@/lib/kanban/configurador-casas-ranking';
import {
  confirmarBcaCenario,
  carregarBcaChecklistData,
  criarBcaCenario,
  listarProspectsParaBca,
  salvarBcaCenario,
  type BcaCenarioRow,
  type CatalogoCasaBca,
} from '@/lib/actions/kanban-bca-cenarios';
import { BCA_WIZARD_STEPS, type BcaWizardStep } from '@/lib/kanban/bca-checklist';
import { gerarResumoBcaHumano } from '@/lib/kanban/bca-resumo-humano';
import { formatModeloTopografia } from '@/lib/kanban/pre-batalha-compatibilidade';
import {
  labelFaixaMercado,
  ORDEM_FAIXAS_MERCADO,
  type FaixaMercado,
} from '@/lib/kanban/mapa-competidores-condominio';
import { prospectsOrdenadosPorTicketCasas } from '@/lib/kanban/condominio-prospect-pesquisa';
import { KanbanFaseSecaoTabs } from '@/components/kanban-shared/KanbanFaseSecaoTabs';

type Props = {
  cardId: string;
  processoId?: string | null;
  itemLabel: string;
  podeEditar: boolean;
};

function fmtMoeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function fmtPct(v: number): string {
  return `${v.toFixed(1).replace('.', ',')}%`;
}

const inputClass =
  'w-full rounded-md border px-3 py-1.5 text-sm outline-none focus:ring-1' +
  ' bg-white border-[var(--moni-border-default)] text-[var(--moni-text-primary)]' +
  ' focus:ring-[var(--moni-primary-500)] focus:border-[var(--moni-primary-500)]';

export function BcaChecklistWidget({ cardId, processoId, itemLabel, podeEditar }: Props) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [catalogo, setCatalogo] = useState<CatalogoCasaBca[]>([]);
  const [cenarios, setCenarios] = useState<BcaCenarioRow[]>([]);
  const [custosConfigurador, setCustosConfigurador] = useState<ConfiguradorCasasValoresJson>({
    v: 1,
    valores: {},
  });
  const [prospectTabs, setProspectTabs] = useState<{ id: string; label: string; nome: string }[]>([]);
  const [condAtivo, setCondAtivo] = useState('');
  const [casaAtivaId, setCasaAtivaId] = useState<string | null>(null);
  const [wizardStep, setWizardStep] = useState<BcaWizardStep>('modelo');
  const [salvando, setSalvando] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recarregar = useCallback(async () => {
    const pid = processoId?.trim();
    const cid = cardId.trim();
    if (!pid || !cid) {
      setErro('Vincule um processo Step One ao card para usar o simulador BCA.');
      setCarregando(false);
      return;
    }
    setCarregando(true);
    setErro(null);
    try {
      const [prospectsRes, bcaRes] = await Promise.all([
        listarProspectsParaBca(cid),
        carregarBcaChecklistData(cid, pid),
      ]);
      if (!bcaRes.ok) {
        setErro(bcaRes.error);
        setCarregando(false);
        return;
      }
      if (!prospectsRes.ok) {
        setErro(prospectsRes.error);
        setCarregando(false);
        return;
      }
      const linhas = prospectsOrdenadosPorTicketCasas(prospectsRes.linhas);
      const tabs = linhas.map((p) => {
        const nome = String(p.condominio ?? '').trim() || 'Condomínio';
        return {
          id: p.row_id,
          label: nome,
          nome,
        };
      });
      setProspectTabs(tabs);
      setCatalogo(bcaRes.catalogo);
      setCenarios(bcaRes.cenarios);
      setCustosConfigurador(bcaRes.custosConfigurador);
      setCondAtivo((atual) => {
        if (atual && tabs.some((t) => t.id === atual)) return atual;
        return tabs[0]?.id ?? '';
      });
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : 'Falha ao carregar simulador BCA. Verifique migrations 328–330 no Supabase.',
      );
    } finally {
      setCarregando(false);
    }
  }, [cardId, processoId]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const cenariosDoCond = useMemo(
    () => cenarios.filter((c) => c.prospect_row_id === condAtivo),
    [cenarios, condAtivo],
  );

  const condNome = prospectTabs.find((t) => t.id === condAtivo)?.nome ?? '';

  useEffect(() => {
    if (cenariosDoCond.length === 0) {
      setCasaAtivaId(null);
      return;
    }
    if (!casaAtivaId || !cenariosDoCond.some((c) => c.id === casaAtivaId)) {
      setCasaAtivaId(cenariosDoCond[0].id);
    }
  }, [cenariosDoCond, casaAtivaId]);

  const cenarioAtivo = cenariosDoCond.find((c) => c.id === casaAtivaId) ?? null;

  const inputsAtivos: BcaInputs = useMemo(
    () => ({
      ...BCA_DEFAULTS,
      ...cenarioAtivo?.inputs,
      nome_condominio: condNome || cenarioAtivo?.inputs.nome_condominio,
    }),
    [cenarioAtivo, condNome],
  );

  const resultsAtivos = useMemo(() => {
    try {
      return calcBca(inputsAtivos);
    } catch {
      return null;
    }
  }, [inputsAtivos]);

  const resumoAtivo = useMemo(() => {
    if (!resultsAtivos) return null;
    return gerarResumoBcaHumano(inputsAtivos, resultsAtivos);
  }, [inputsAtivos, resultsAtivos]);

  const casaTabs = useMemo(
    () =>
      cenariosDoCond.map((c) => ({
        id: c.id,
        label: `Casa ${c.ordem}${c.status === 'confirmado' ? ' ✓' : ''}`,
      })),
    [cenariosDoCond],
  );

  const comparativo = useMemo(() => {
    const confirmados = cenariosDoCond.filter((c) => c.status === 'confirmado' && c.resultado);
    if (confirmados.length < 2) return null;
    return confirmados.map((c) => ({
      nome: c.inputs.nome_casa ?? `Casa ${c.ordem}`,
      pctVgv: c.resultado?.target.pct_vgv_alavancado ?? 0,
      margem: c.resultado?.margem_target_liquidacao ?? 0,
    }));
  }, [cenariosDoCond]);

  async function persistPatch(
    cenarioId: string,
    patch: Parameters<typeof salvarBcaCenario>[0]['patch'],
  ) {
    const pid = processoId?.trim();
    if (!pid || !podeEditar) return;
    setSalvando(true);
    const res = await salvarBcaCenario({ cenarioId, processoId: pid, patch });
    setSalvando(false);
    if (res.ok) {
      setCenarios((prev) => prev.map((c) => (c.id === res.cenario.id ? res.cenario : c)));
    } else {
      setErro(res.error);
    }
  }

  function scheduleSave(cenarioId: string, patch: Parameters<typeof salvarBcaCenario>[0]['patch']) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      void persistPatch(cenarioId, patch);
    }, 800);
  }

  function updateField<K extends keyof BcaInputs>(key: K, value: BcaInputs[K]) {
    if (!cenarioAtivo || !podeEditar) return;
    scheduleSave(cenarioAtivo.id, { [key]: value });
    setCenarios((prev) =>
      prev.map((c) =>
        c.id === cenarioAtivo.id ? { ...c, inputs: { ...c.inputs, [key]: value } } : c,
      ),
    );
  }

  async function handleNovaCasa() {
    const pid = processoId?.trim();
    if (!pid || !condAtivo || !podeEditar) return;
    const nextOrdem =
      cenariosDoCond.length > 0 ? Math.max(...cenariosDoCond.map((c) => c.ordem)) + 1 : 1;
    setSalvando(true);
    const res = await criarBcaCenario({
      cardId: cardId.trim(),
      processoId: pid,
      prospectRowId: condAtivo,
      condominioNome: condNome,
      ordem: nextOrdem,
    });
    setSalvando(false);
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    setCenarios((prev) => [...prev, res.cenario]);
    setCasaAtivaId(res.cenario.id);
    setWizardStep('modelo');
  }

  async function handleSelectModelo(cat: CatalogoCasaBca, faixa: FaixaMercado) {
    if (!cenarioAtivo || !podeEditar) return;
    const topo = cat.topografia ?? '';
    const custo = resolverCustoConfigurador(custosConfigurador, cat.id, topo, faixa, cat.nome);
    const patch: Parameters<typeof salvarBcaCenario>[0]['patch'] = {
      catalogo_casa_id: cat.id,
      topografia: topo,
      faixa_mercado: faixa,
      nome_casa: cat.nome ?? '',
      area_vendas_m2: cat.area_m2 ?? BCA_DEFAULTS.area_vendas_m2,
    };
    if (custo != null && custo > 0) patch.custo_casa = -Math.abs(custo);
    await persistPatch(cenarioAtivo.id, patch);
    setWizardStep('custo');
  }

  async function handleConfirmar() {
    if (!cenarioAtivo || !processoId?.trim() || !podeEditar) return;
    setSalvando(true);
    const res = await confirmarBcaCenario(cenarioAtivo.id, processoId.trim());
    setSalvando(false);
    if (res.ok) {
      setCenarios((prev) => prev.map((c) => (c.id === res.cenario.id ? res.cenario : c)));
    } else {
      setErro(res.error);
    }
  }

  const stepIndex = BCA_WIZARD_STEPS.findIndex((s) => s.id === wizardStep);

  if (carregando) {
    return (
      <div className="flex items-center gap-2 py-6 text-xs text-stone-500">
        <Loader2 size={14} className="animate-spin" />
        Carregando simulador BCA…
      </div>
    );
  }

  if (erro && prospectTabs.length === 0) {
    return <p className="text-xs text-red-600">{erro}</p>;
  }

  if (prospectTabs.length === 0) {
    return (
      <p className="text-xs italic text-stone-500">
        Cadastre condomínios na Tabela de Condomínios (fase Dados da Cidade) antes de montar o BCA.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
          {itemLabel}
          {salvando && <Loader2 size={10} className="ml-1 inline animate-spin" />}
        </p>
        <p className="mt-0.5 text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
          Abas por condomínio; dentro de cada uma, simule uma ou mais casas com resultado automático.
        </p>
      </div>

      {erro ? <p className="text-xs text-amber-700">{erro}</p> : null}

      <KanbanFaseSecaoTabs
        tabs={prospectTabs}
        abaAtiva={condAtivo}
        onAbaChange={setCondAtivo}
        ariaLabel="Condomínios prospectados"
      >
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {casaTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setCasaAtivaId(tab.id);
                  setWizardStep('modelo');
                }}
                className="rounded-md border px-3 py-1 text-xs font-medium"
                style={{
                  borderColor:
                    casaAtivaId === tab.id
                      ? 'var(--moni-primary-500)'
                      : 'var(--moni-border-default)',
                  background: casaAtivaId === tab.id ? 'var(--moni-surface-100)' : 'white',
                }}
              >
                {tab.label}
              </button>
            ))}
            {podeEditar ? (
              <button
                type="button"
                onClick={() => void handleNovaCasa()}
                className="inline-flex items-center gap-1 rounded-md border border-dashed px-2 py-1 text-xs"
                style={{ borderColor: 'var(--moni-border-default)' }}
              >
                <Plus size={12} />
                Casa
              </button>
            ) : null}
          </div>

          {!cenarioAtivo ? (
            <p className="text-xs text-stone-500">
              {podeEditar
                ? 'Clique em «+ Casa» para iniciar um cenário BCA neste condomínio.'
                : 'Nenhum cenário BCA neste condomínio.'}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1">
                {BCA_WIZARD_STEPS.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setWizardStep(s.id)}
                    className="rounded px-2 py-0.5 text-[11px] font-medium"
                    style={{
                      background: wizardStep === s.id ? 'var(--moni-primary-500)' : 'var(--moni-surface-100)',
                      color: wizardStep === s.id ? 'white' : 'var(--moni-text-secondary)',
                    }}
                  >
                    {i + 1}. {s.label}
                  </button>
                ))}
              </div>

              {wizardStep === 'modelo' && (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {catalogo.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      disabled={!podeEditar}
                      onClick={() =>
                        void handleSelectModelo(cat, cenarioAtivo.faixa_mercado ?? 'intermediaria')
                      }
                      className="rounded-lg border p-3 text-left transition hover:border-stone-400 disabled:opacity-60"
                      style={{
                        borderColor:
                          cenarioAtivo.catalogo_casa_id === cat.id
                            ? 'var(--moni-primary-500)'
                            : 'var(--moni-border-default)',
                      }}
                    >
                      <p className="font-semibold text-stone-900">
                        {formatModeloTopografia(cat.nome ?? '—', cat.topografia ?? '—')}
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        {cat.area_m2 ?? '—'} m² · {cat.quartos ?? '—'} q · {cat.banheiros ?? '—'} ban
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {wizardStep === 'custo' && (
                <div className="grid max-w-md gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-stone-600">
                      Faixa de mercado (para custo do Configurador)
                    </label>
                    <select
                      className={inputClass}
                      disabled={!podeEditar}
                      value={cenarioAtivo.faixa_mercado ?? 'intermediaria'}
                      onChange={(e) => {
                        const faixa = e.target.value as FaixaMercado;
                        if (!cenarioAtivo.catalogo_casa_id) return;
                        const custo = resolverCustoConfigurador(
                          custosConfigurador,
                          cenarioAtivo.catalogo_casa_id,
                          cenarioAtivo.topografia,
                          faixa,
                          cenarioAtivo.inputs?.nome_casa,
                        );
                        const patch: Parameters<typeof salvarBcaCenario>[0]['patch'] = {
                          faixa_mercado: faixa,
                        };
                        if (custo != null && custo > 0) patch.custo_casa = -Math.abs(custo);
                        void persistPatch(cenarioAtivo.id, patch);
                      }}
                    >
                      {ORDEM_FAIXAS_MERCADO.map((f) => (
                        <option key={f} value={f}>
                          {labelFaixaMercado(f)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-stone-600">
                      Custo da casa — Configurador (R$)
                    </label>
                    <input
                      type="number"
                      className={inputClass}
                      disabled={!podeEditar}
                      value={
                        inputsAtivos.custo_casa != null
                          ? Math.abs(Number(inputsAtivos.custo_casa))
                          : ''
                      }
                      onChange={(e) =>
                        updateField('custo_casa', -(Number(e.target.value) || 0))
                      }
                    />
                    <p className="mt-1 text-[10px] text-stone-400">
                      Preenchido automaticamente a partir da fase Configurador de Casas, se disponível.
                    </p>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-stone-600">
                      Área de vendas (m²)
                    </label>
                    <input
                      type="number"
                      className={inputClass}
                      disabled={!podeEditar}
                      value={inputsAtivos.area_vendas_m2 ?? ''}
                      onChange={(e) =>
                        updateField('area_vendas_m2', Number(e.target.value) || 0)
                      }
                    />
                  </div>
                </div>
              )}

              {wizardStep === 'terreno' && (
                <div className="grid max-w-md gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-stone-600">
                      Custo do terreno (R$)
                    </label>
                    <input
                      type="number"
                      className={inputClass}
                      disabled={!podeEditar}
                      value={
                        inputsAtivos.custo_terreno != null
                          ? Math.abs(Number(inputsAtivos.custo_terreno))
                          : ''
                      }
                      onChange={(e) =>
                        updateField('custo_terreno', -(Number(e.target.value) || 0))
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-stone-600">
                      ITBI (%)
                    </label>
                    <input
                      type="number"
                      step={0.01}
                      className={inputClass}
                      disabled={!podeEditar}
                      value={((inputsAtivos.itbi_percentual ?? 0.04) * 100).toFixed(0)}
                      onChange={(e) =>
                        updateField('itbi_percentual', (Number(e.target.value) || 0) / 100)
                      }
                    />
                  </div>
                  <p className="flex items-center gap-1 text-xs text-stone-500">
                    <Lock size={12} />
                    Rentabilidade terrenista: 15% a.a. (parâmetro padrão Moní)
                  </p>
                </div>
              )}

              {wizardStep === 'cenarios' && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead>
                      <tr className="border-b text-xs text-stone-500">
                        <th className="py-2 text-left">Cenário</th>
                        <th className="px-2 py-2 text-right">VGV (R$)</th>
                        <th className="px-2 py-2 text-right">% Permuta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          ['Target', 'vgv_target', 'permuta_target'],
                          ['Liquidação', 'vgv_liquidacao', 'permuta_liquidacao'],
                          ['Recompra', 'vgv_recompra', 'permuta_recompra'],
                        ] as const
                      ).map(([label, vgvKey, permKey]) => (
                        <tr key={vgvKey} className="border-b border-stone-100">
                          <td className="py-2 pr-2">{label}</td>
                          <td className="px-2 text-right">
                            <input
                              type="number"
                              className={inputClass + ' text-right'}
                              disabled={!podeEditar}
                              value={(inputsAtivos[vgvKey] as number) ?? ''}
                              onChange={(e) =>
                                updateField(vgvKey, Number(e.target.value) || 0)
                              }
                            />
                          </td>
                          <td className="px-2 text-right">
                            <input
                              type="number"
                              className={inputClass + ' text-right w-20'}
                              disabled={!podeEditar}
                              value={(((inputsAtivos[permKey] as number) ?? 0) * 100).toFixed(0)}
                              onChange={(e) =>
                                updateField(permKey, (Number(e.target.value) || 0) / 100)
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-3 grid max-w-md gap-2 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-stone-600">Funding (%)</label>
                      <input
                        type="number"
                        className={inputClass}
                        disabled={!podeEditar}
                        value={((inputsAtivos.percentual_funding ?? 1) * 100).toFixed(0)}
                        onChange={(e) =>
                          updateField('percentual_funding', (Number(e.target.value) || 100) / 100)
                        }
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-stone-600">CDI a.a. (%)</label>
                      <input
                        type="number"
                        className={inputClass}
                        disabled={!podeEditar}
                        value={((inputsAtivos.cdi_an ?? 0.15) * 100).toFixed(1)}
                        onChange={(e) =>
                          updateField('cdi_an', (Number(e.target.value) || 0) / 100)
                        }
                      />
                    </div>
                  </div>
                  {resultsAtivos ? (
                    <p
                      className={`mt-2 inline-block rounded px-2 py-1 text-xs ${
                        resultsAtivos.margem_target_liquidacao >= 10
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      Margem Target vs Liquidação:{' '}
                      {fmtPct(resultsAtivos.margem_target_liquidacao)}
                    </p>
                  ) : null}
                </div>
              )}

              {wizardStep === 'resultado' && resumoAtivo && resultsAtivos && (
                <div className="space-y-3">
                  <div
                    className={`rounded-lg border p-4 ${
                      resumoAtivo.status === 'viavel'
                        ? 'border-emerald-200 bg-emerald-50'
                        : resumoAtivo.status === 'limite'
                          ? 'border-amber-200 bg-amber-50'
                          : 'border-red-200 bg-red-50'
                    }`}
                  >
                    <p className="font-semibold text-stone-900">{resumoAtivo.titulo}</p>
                    <p className="mt-2 text-sm leading-relaxed text-stone-700">
                      {resumoAtivo.paragrafo}
                    </p>
                  </div>
                  <div className="rounded-lg bg-stone-900 p-4 text-stone-100">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <p className="text-[10px] uppercase text-stone-400">%VGV Target</p>
                        <p className="text-lg font-bold">{fmtPct(resumoAtivo.pctVgvTarget)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-stone-400">Margem T vs L</p>
                        <p className="text-lg font-bold">
                          {fmtPct(resumoAtivo.margemTargetLiquidacao)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-stone-400">TIR terrenista</p>
                        <p className="text-lg font-bold">
                          {(resumoAtivo.tirTerrenistaPctCdi / 100).toFixed(1).replace('.', ',')}× CDI
                        </p>
                      </div>
                    </div>
                  </div>
                  <ul className="space-y-1 text-sm">
                    {resumoAtivo.criterios.map((c) => (
                      <li key={c.label} className="flex items-center gap-2">
                        {c.ok ? (
                          <CheckCircle2 size={14} className="text-emerald-600" />
                        ) : (
                          <span className="inline-block h-3.5 w-3.5 rounded-full bg-red-400" />
                        )}
                        <span>
                          {c.label}: <strong>{c.detalhe}</strong>
                        </span>
                      </li>
                    ))}
                  </ul>
                  {podeEditar && cenarioAtivo.status !== 'confirmado' ? (
                    <button
                      type="button"
                      onClick={() => void handleConfirmar()}
                      className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white"
                    >
                      Confirmar este BCA
                    </button>
                  ) : cenarioAtivo.status === 'confirmado' ? (
                    <p className="text-xs font-medium text-emerald-700">BCA confirmado nesta casa.</p>
                  ) : null}
                </div>
              )}

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  disabled={stepIndex <= 0}
                  onClick={() => setWizardStep(BCA_WIZARD_STEPS[Math.max(0, stepIndex - 1)].id)}
                  className="inline-flex items-center gap-1 text-xs text-stone-600 disabled:opacity-40"
                >
                  <ChevronLeft size={14} />
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={stepIndex >= BCA_WIZARD_STEPS.length - 1}
                  onClick={() =>
                    setWizardStep(
                      BCA_WIZARD_STEPS[Math.min(BCA_WIZARD_STEPS.length - 1, stepIndex + 1)].id,
                    )
                  }
                  className="inline-flex items-center gap-1 text-xs text-stone-600 disabled:opacity-40"
                >
                  Próximo
                  <ChevronRight size={14} />
                </button>
              </div>
            </>
          )}

          {comparativo ? (
            <div className="rounded-lg border border-stone-200 bg-stone-800 p-3 text-stone-100">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
                Comparativo — casas confirmadas neste condomínio
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {comparativo.map((c) => (
                  <div key={c.nome} className="rounded bg-stone-900/80 p-2 text-xs">
                    <p className="font-medium">{c.nome}</p>
                    <p>%VGV Target: {fmtPct(c.pctVgv)} · Margem: {fmtPct(c.margem)}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </KanbanFaseSecaoTabs>
    </div>
  );
}
