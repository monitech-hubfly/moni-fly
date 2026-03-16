'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { saveEtapa10, getBcaInputs, saveBcaInputs, type BcaOpcao } from './actions';
import {
  calcBca,
  calcObraMes8,
  calcVgvPlanta,
  BCA_DEFAULTS,
  type BcaInputs,
  type BcaResults,
  type CenarioResult,
} from '@/lib/bca-calc';

type CatalogoEscolhido = { catalogo_casa_id: string; ordem: number };

type CasaCatalogo = {
  id: string;
  nome: string | null;
  area_m2: number | null;
  quartos: number | null;
  preco_venda: number | null;
};

function buildDefaultOpcoes(
  catalogoEscolhidos: CatalogoEscolhido[],
  catalogo: CasaCatalogo[],
): BcaOpcao[] {
  return catalogoEscolhidos
    .sort((a, b) => a.ordem - b.ordem)
    .map((ce) => {
      const casa = catalogo.find((c) => c.id === ce.catalogo_casa_id);
      return {
        catalogo_casa_id: ce.catalogo_casa_id,
        titulo: casa?.nome ?? `Opção ${ce.ordem}`,
        descricao: '',
      };
    });
}

function fmtMoney(v: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(v);
}

function fmtPct(v: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(v / 100);
}

function ValCell({
  v,
  isPct = false,
  bold = false,
}: {
  v: number;
  isPct?: boolean;
  bold?: boolean;
}) {
  const text = isPct ? fmtPct(v) : fmtMoney(v);
  const isNeg = v < 0;
  return (
    <span className={bold ? 'font-bold' : isNeg ? 'text-red-600' : 'text-green-700'}>{text}</span>
  );
}

const OBRA_MES_KEYS = [
  'obra_mes1',
  'obra_mes2',
  'obra_mes3',
  'obra_mes4',
  'obra_mes5',
  'obra_mes6',
  'obra_mes7',
] as const;

export function Etapa10BCA({
  processoId,
  catalogoEscolhidos,
  catalogo,
  initialOpcoes = [],
  initialBcaInputs = null,
}: {
  processoId: string;
  catalogoEscolhidos: CatalogoEscolhido[];
  catalogo: CasaCatalogo[];
  initialOpcoes?: BcaOpcao[];
  initialBcaInputs?: Partial<BcaInputs> | null;
}) {
  const router = useRouter();
  const [inputs, setInputs] = useState<BcaInputs>(() => ({
    ...BCA_DEFAULTS,
    ...initialBcaInputs,
  }));
  const [results, setResults] = useState<BcaResults | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const [error, setError] = useState('');
  const [opcoes, setOpcoes] = useState<BcaOpcao[]>(() =>
    initialOpcoes?.length === 3 ? initialOpcoes : buildDefaultOpcoes(catalogoEscolhidos, catalogo),
  );
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputsRef = useRef<BcaInputs>(inputs);
  inputsRef.current = inputs;

  useEffect(() => {
    if (initialBcaInputs && Object.keys(initialBcaInputs).length > 0) {
      setInputs((prev) => ({ ...prev, ...initialBcaInputs }));
    } else {
      getBcaInputs(processoId).then((data) => {
        if (data && Object.keys(data).length > 0) setInputs((prev) => ({ ...prev, ...data }));
      });
    }
  }, [processoId, initialBcaInputs]);

  useEffect(() => {
    try {
      const r = calcBca(inputs);
      setResults(r);
    } catch {
      setResults(null);
    }
  }, [inputs]);

  const updateInput = useCallback(
    (key: keyof BcaInputs, value: string | number) => {
      setInputs((prev) => ({ ...prev, [key]: value }));
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = setTimeout(async () => {
        saveDebounceRef.current = null;
        const toSave = { ...inputsRef.current };
        delete (toSave as Record<string, unknown>)['obra_mes8'];
        delete (toSave as Record<string, unknown>)['vgv_planta'];
        setSaving(true);
        const res = await saveBcaInputs(processoId, toSave);
        setSaving(false);
        if (res.ok) setSaveToast(true);
        else setError(res.error ?? 'Erro ao salvar');
        setTimeout(() => setSaveToast(false), 2000);
      }, 1000);
    },
    [processoId],
  );

  const obraSum =
    (inputs.obra_mes1 ?? 0) +
    (inputs.obra_mes2 ?? 0) +
    (inputs.obra_mes3 ?? 0) +
    (inputs.obra_mes4 ?? 0) +
    (inputs.obra_mes5 ?? 0) +
    (inputs.obra_mes6 ?? 0) +
    (inputs.obra_mes7 ?? 0);
  const obraMes8 = calcObraMes8(inputs);
  const obraTotal = obraSum + obraMes8;
  const fluxoOk = Math.abs(obraTotal - 1) < 0.0001;
  const vgvPlanta = calcVgvPlanta(inputs);

  const margem = results?.margem_target_liquidacao ?? 0;
  const margemBadge =
    margem >= 10
      ? 'bg-green-100 text-green-800'
      : margem >= 5
        ? 'bg-amber-100 text-amber-800'
        : 'bg-red-100 text-red-800';

  const updateOpcao = useCallback(
    (index: number, field: 'titulo' | 'descricao', value: string) => {
      const next = opcoes.map((o, i) => (i === index ? { ...o, [field]: value } : o));
      setOpcoes(next);
      setSaving(true);
      saveEtapa10(processoId, { opcoes: next })
        .then((r) => {
          if (!r.ok) setError(r.error);
        })
        .finally(() => setSaving(false));
    },
    [opcoes, processoId],
  );

  const handleConcluir = async () => {
    setError('');
    setSaving(true);
    const res = await saveEtapa10(processoId, { opcoes, concluida: true });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  };

  const temTresModelos = catalogoEscolhidos.length === 3;

  return (
    <div className="mt-6 space-y-8">
      {saveToast && (
        <p className="rounded-lg bg-green-100 px-3 py-2 text-sm text-green-800">
          BCA salvo automaticamente.
        </p>
      )}

      {/* BLOCO 1: Identificação */}
      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h3 className="mb-3 text-lg font-semibold text-stone-800">Identificação</h3>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-stone-700">Nome do condomínio</label>
            <input
              type="text"
              className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
              value={inputs.nome_condominio ?? ''}
              onChange={(e) => updateInput('nome_condominio', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">Nome da casa</label>
            <input
              type="text"
              className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
              value={inputs.nome_casa ?? ''}
              onChange={(e) => updateInput('nome_casa', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">Área de vendas (m²)</label>
            <input
              type="number"
              min={1}
              className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
              value={inputs.area_vendas_m2 ?? ''}
              onChange={(e) => updateInput('area_vendas_m2', Number(e.target.value) || 0)}
            />
          </div>
        </div>
      </section>

      {/* BLOCO 2: Terreno */}
      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h3 className="mb-3 text-lg font-semibold text-stone-800">Terreno</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-stone-700">
              Custo do terreno (R$)
            </label>
            <input
              type="number"
              className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
              value={inputs.custo_terreno != null ? Math.abs(Number(inputs.custo_terreno)) : ''}
              onChange={(e) => updateInput('custo_terreno', -(Number(e.target.value) || 0))}
            />
          </div>
          <p className="self-end text-sm text-stone-500">ITBI: 4% (fixo)</p>
        </div>
      </section>

      {/* BLOCO 3: Casa */}
      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h3 className="mb-3 text-lg font-semibold text-stone-800">Casa</h3>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-stone-700">Custo da casa (R$)</label>
            <input
              type="number"
              className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
              value={inputs.custo_casa != null ? Math.abs(Number(inputs.custo_casa)) : ''}
              onChange={(e) => updateInput('custo_casa', -(Number(e.target.value) || 0))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">
              Mês de início da obra (1-48)
            </label>
            <input
              type="number"
              min={1}
              max={48}
              className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
              value={inputs.mes_inicio_obra ?? ''}
              onChange={(e) => updateInput('mes_inicio_obra', Number(e.target.value) || 3)}
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="mb-2 block text-sm font-medium text-stone-700">Fluxo de obra (%)</label>
          <div className="flex flex-wrap items-center gap-2">
            {OBRA_MES_KEYS.map((k, i) => (
              <div key={k} className="flex items-center gap-1">
                <span className="text-xs text-stone-500">M{i + 1}</span>
                <input
                  type="number"
                  step={0.01}
                  min={0}
                  max={1}
                  className="w-16 rounded border border-stone-300 px-1 py-1 text-sm"
                  value={((inputs[k] ?? 0) * 100).toFixed(0)}
                  onChange={(e) => updateInput(k, (Number(e.target.value) || 0) / 100)}
                />
              </div>
            ))}
            <div className="flex items-center gap-1">
              <span className="text-xs text-stone-500">M8</span>
              <input
                type="text"
                readOnly
                className="w-16 rounded border border-stone-200 bg-stone-100 px-1 py-1 text-sm text-stone-500"
                value={(obraMes8 * 100).toFixed(0)}
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-stone-500">M9</span>
              <input
                type="number"
                step={0.01}
                min={0}
                max={1}
                className="w-16 rounded border border-stone-300 px-1 py-1 text-sm"
                value={((inputs.obra_mes9 ?? 0) * 100).toFixed(0)}
                onChange={(e) => updateInput('obra_mes9', (Number(e.target.value) || 0) / 100)}
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-stone-500">M10</span>
              <input
                type="number"
                step={0.01}
                min={0}
                max={1}
                className="w-16 rounded border border-stone-300 px-1 py-1 text-sm"
                value={((inputs.obra_mes10 ?? 0) * 100).toFixed(0)}
                onChange={(e) => updateInput('obra_mes10', (Number(e.target.value) || 0) / 100)}
              />
            </div>
          </div>
          {!fluxoOk && (
            <p className="mt-2 rounded bg-amber-100 px-2 py-1 text-sm text-amber-800">
              Fluxo de obra deve somar 100%
            </p>
          )}
        </div>
      </section>

      {/* BLOCO 4: Taxas e despesas */}
      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h3 className="mb-3 text-lg font-semibold text-stone-800">Taxas e despesas</h3>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-stone-700">
              Comissão de vendas (%)
            </label>
            <input
              type="number"
              step={0.1}
              min={0}
              className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
              value={Math.abs((inputs.comissao_vendas ?? 0) * 100)
                .toFixed(1)
                .replace('.', ',')}
              onChange={(e) =>
                updateInput(
                  'comissao_vendas',
                  -(Number(e.target.value.replace(',', '.')) || 0) / 100,
                )
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">Impostos (%)</label>
            <input
              type="number"
              step={0.1}
              min={0}
              className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
              value={((inputs.impostos ?? 0) * 100).toFixed(1).replace('.', ',')}
              onChange={(e) =>
                updateInput('impostos', (Number(e.target.value.replace(',', '.')) || 0) / 100)
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">
              Taxa de plataforma (%)
            </label>
            <input
              type="number"
              step={0.1}
              min={0}
              className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
              value={Math.abs((inputs.taxa_plataforma ?? 0) * 100)
                .toFixed(1)
                .replace('.', ',')}
              onChange={(e) =>
                updateInput(
                  'taxa_plataforma',
                  -(Number(e.target.value.replace(',', '.')) || 0) / 100,
                )
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">
              Taxa de gestão Frank (%)
            </label>
            <input
              type="number"
              step={0.1}
              min={0}
              className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
              value={Math.abs((inputs.taxa_gestao_frank ?? 0) * 100)
                .toFixed(1)
                .replace('.', ',')}
              onChange={(e) =>
                updateInput(
                  'taxa_gestao_frank',
                  -(Number(e.target.value.replace(',', '.')) || 0) / 100,
                )
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">
              Projetos e taxa de obra (R$)
            </label>
            <input
              type="number"
              className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
              value={
                inputs.projetos_taxa_obra != null ? Math.abs(Number(inputs.projetos_taxa_obra)) : ''
              }
              onChange={(e) => updateInput('projetos_taxa_obra', -(Number(e.target.value) || 0))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">Capital de giro (R$)</label>
            <input
              type="number"
              className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
              value={
                inputs.capital_giro_inicial != null
                  ? Math.abs(Number(inputs.capital_giro_inicial))
                  : ''
              }
              onChange={(e) => updateInput('capital_giro_inicial', -(Number(e.target.value) || 0))}
            />
          </div>
        </div>
      </section>

      {/* BLOCO 5: Cenários */}
      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h3 className="mb-3 text-lg font-semibold text-stone-800">Cenários</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-stone-200">
                <th className="py-2 pr-4 text-left font-medium text-stone-700"></th>
                <th className="px-2 py-2 text-right font-medium text-stone-700">Planta</th>
                <th className="px-2 py-2 text-right font-medium text-stone-700">Target</th>
                <th className="px-2 py-2 text-right font-medium text-stone-700">Liquidação</th>
                <th className="px-2 py-2 text-right font-medium text-stone-700">Recompra</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-stone-100">
                <td className="py-1.5 pr-4 text-stone-600">VGV (R$)</td>
                <td className="px-2 text-right">{fmtMoney(vgvPlanta)}</td>
                <td className="px-2 text-right">
                  <input
                    type="number"
                    className="w-full rounded border border-stone-300 px-1 py-0.5 text-right text-sm"
                    value={inputs.vgv_target ?? ''}
                    onChange={(e) => updateInput('vgv_target', Number(e.target.value) || 0)}
                  />
                </td>
                <td className="px-2 text-right">
                  <input
                    type="number"
                    className="w-full rounded border border-stone-300 px-1 py-0.5 text-right text-sm"
                    value={inputs.vgv_liquidacao ?? ''}
                    onChange={(e) => updateInput('vgv_liquidacao', Number(e.target.value) || 0)}
                  />
                </td>
                <td className="px-2 text-right">
                  <input
                    type="number"
                    className="w-full rounded border border-stone-300 px-1 py-0.5 text-right text-sm"
                    value={inputs.vgv_recompra ?? ''}
                    onChange={(e) => updateInput('vgv_recompra', Number(e.target.value) || 0)}
                  />
                </td>
              </tr>
              <tr className="border-b border-stone-100">
                <td className="py-1.5 pr-4 text-stone-600">R$/m²</td>
                {(['planta', 'target', 'liquidacao', 'recompra'] as const).map((c) => (
                  <td key={c} className="px-2 text-right">
                    {results ? fmtMoney(results[c].vgv_por_m2) : '—'}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-stone-100">
                <td className="py-1.5 pr-4 text-stone-600">Mês venda</td>
                <td className="px-2 text-right">3 (fixo)</td>
                <td className="px-2 text-right">7 (fixo)</td>
                <td className="px-2 text-right">10 (fixo)</td>
                <td className="px-2 text-right">16 (fixo)</td>
              </tr>
              <tr className="border-b border-stone-100">
                <td className="py-1.5 pr-4 text-stone-600">% Permuta</td>
                {(
                  [
                    'permuta_planta',
                    'permuta_target',
                    'permuta_liquidacao',
                    'permuta_recompra',
                  ] as const
                ).map((k) => (
                  <td key={k} className="px-2 text-right">
                    <input
                      type="number"
                      step={0.01}
                      min={0}
                      max={1}
                      className="w-full rounded border border-stone-300 px-1 py-0.5 text-right text-sm"
                      value={((inputs[k] ?? 0) * 100).toFixed(0)}
                      onChange={(e) => updateInput(k, (Number(e.target.value) || 0) / 100)}
                    />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className={`mt-2 inline-block rounded px-2 py-1 text-sm ${margemBadge}`}>
          Margem Target vs Liquidação: {results ? fmtPct(results.margem_target_liquidacao) : '—'}
        </p>
      </section>

      {/* BLOCO 6: Funding */}
      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h3 className="mb-3 text-lg font-semibold text-stone-800">Funding</h3>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <label className="block text-sm font-medium text-stone-700">Funding (%)</label>
            <input
              type="number"
              step={0.01}
              min={0}
              max={1}
              className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
              value={((inputs.percentual_funding ?? 1) * 100).toFixed(0)}
              onChange={(e) =>
                updateInput('percentual_funding', (Number(e.target.value) || 100) / 100)
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">CDI a.a. (%)</label>
            <input
              type="number"
              step={0.1}
              className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
              value={((inputs.cdi_an ?? 0.15) * 100).toFixed(1).replace('.', ',')}
              onChange={(e) =>
                updateInput('cdi_an', (Number(e.target.value.replace(',', '.')) || 0) / 100)
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">Taxa juros a.a.</label>
            <p className="mt-1 text-sm font-medium">
              {results ? fmtPct(results.taxa_juros_an) : '—'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">TAC</label>
            <p className="mt-1 text-sm font-medium">{results ? fmtPct(results.tac) : '—'}</p>
          </div>
        </div>
      </section>

      {/* TABELA DE RESULTADOS */}
      {results && (
        <section className="overflow-x-auto rounded-xl border border-stone-200 bg-white p-4">
          <h3 className="mb-3 text-lg font-semibold text-stone-800">
            Resultados (somente leitura)
          </h3>
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-stone-200">
                <th className="py-2 pr-4 text-left font-medium text-stone-700">Métrica</th>
                <th className="px-2 py-2 text-right font-medium text-stone-700">Planta</th>
                <th className="px-2 py-2 text-right font-medium text-stone-700">Target</th>
                <th className="px-2 py-2 text-right font-medium text-stone-700">Liquidação</th>
                <th className="px-2 py-2 text-right font-medium text-stone-700">Recompra</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ['Venda líquida', (c: CenarioResult) => c.venda_liquida, false],
                  ['(-) Terreno base', (c: CenarioResult) => c.terreno_base, false],
                  ['(-) Terreno var.', (c: CenarioResult) => c.terreno_variavel, false],
                  ['(-) Custo casa', (c: CenarioResult) => c.casa, false],
                  ['(-) Taxa plataf.', (c: CenarioResult) => c.taxa_plataforma_valor, false],
                  ['(-) Taxa gestão', (c: CenarioResult) => c.taxa_gestao_valor, false],
                  ['(-) ITBI', (c: CenarioResult) => c.itbi_valor, false],
                  ['(-) Projetos', (c: CenarioResult) => c.projetos, false],
                  ['(-) Capital giro', (c: CenarioResult) => c.capital_giro, false],
                  ['Res. não alav. % VGV', (c: CenarioResult) => c.pct_vgv_nao_alavancado, true],
                  ['Juros/Custo fin.', (c: CenarioResult) => c.juros_custo_financeiro, false],
                  ['Res. alavancado', (c: CenarioResult) => c.resultado_alavancado, false],
                  ['Res. total Frank', (c: CenarioResult) => c.resultado_total_frank, true],
                  ['TIR consolidada %', (c: CenarioResult) => c.tir_consolidada_aa, true],
                  ['TIR investidor %', (c: CenarioResult) => c.tir_investidor_nao_alav_aa, true],
                  ['TIR terrenista %', (c: CenarioResult) => c.tir_terrenista_aa, true],
                  ['TIR/CDI', (c: CenarioResult) => c.tir_terrenista_pct_cdi, true],
                  ['VPL Inv. s/alav.', (c: CenarioResult) => c.vpl_investidor_nao_alav, false],
                  ['VPL Inv. c/alav.', (c: CenarioResult) => c.vpl_investidor_alav, false],
                  ['VPL Terrenista', (c: CenarioResult) => c.vpl_terrenista, false],
                  ['LTV', (c: CenarioResult) => c.ltv, true],
                  ['CET a.a. %', (c: CenarioResult) => c.cet_aa, true],
                ] as [string, (c: CenarioResult) => number, boolean][]
              ).map(([label, fn, isPct]) => (
                <tr key={label} className="border-b border-stone-100">
                  <td className="py-1 pr-4 text-stone-600">{label}</td>
                  {(['planta', 'target', 'liquidacao', 'recompra'] as const).map((nome) => (
                    <td key={nome} className="px-2 py-1 text-right">
                      <ValCell
                        v={fn(results[nome])}
                        isPct={isPct}
                        bold={label === 'Res. total Frank'}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {saving && <p className="text-sm text-stone-500">Salvando...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* 3 opções (títulos e descrições) — só aparece quando já há 3 modelos escolhidos na Etapa 7 */}
      {temTresModelos ? (
        <>
          <section className="rounded-xl border border-stone-200 bg-white p-4">
            <h3 className="mb-3 text-lg font-semibold text-stone-800">Opções de BCA (3 modelos)</h3>
            <p className="mb-4 text-sm text-stone-600">
              Título e descrição de cada opção para envio. Salvos automaticamente.
            </p>
            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-3">
              {opcoes.map((op, index) => (
                <div
                  key={op.catalogo_casa_id}
                  className="rounded-lg border border-stone-200 bg-stone-50 p-4"
                >
                  <h4 className="mb-2 text-sm font-medium text-stone-700">Opção {index + 1}</h4>
                  <input
                    type="text"
                    className="mb-2 w-full rounded border border-stone-300 p-2 text-sm"
                    value={op.titulo}
                    onChange={(e) => updateOpcao(index, 'titulo', e.target.value)}
                    placeholder="Título da opção"
                  />
                  <textarea
                    className="min-h-[80px] w-full rounded border border-stone-300 p-2 text-sm"
                    value={op.descricao ?? ''}
                    onChange={(e) => updateOpcao(index, 'descricao', e.target.value)}
                    placeholder="Descrição (opcional)"
                  />
                </div>
              ))}
            </div>
          </section>

          <button type="button" onClick={handleConcluir} disabled={saving} className="btn-primary">
            {saving ? 'Salvando...' : 'Marcar etapa como concluída'}
          </button>
        </>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Para preencher as 3 opções de BCA e marcar esta etapa como concluída, conclua antes a{' '}
          <strong>Etapa 7</strong> (Listagem, modelo e batalha) para escolher os 3 modelos do
          catálogo.
        </div>
      )}
    </div>
  );
}
