'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { Etapa4CasasListagem } from '@/app/step-one/[id]/etapa/Etapa4CasasListagem';
import { KanbanFaseSecaoTabs } from '@/components/kanban-shared/KanbanFaseSecaoTabs';
import { carregarProspectsCondominioCard } from '@/lib/actions/kanban-condominio-pesquisa';
import {
  carregarMapaCompetidoresChecklist,
  type MapaCompetidoresChecklistData,
} from '@/lib/actions/kanban-mapa-competidores';
import {
  prospectsOrdenadosPorTicketCasas,
  type LinhaProspectCondominio,
} from '@/lib/kanban/condominio-prospect-pesquisa';
import {
  filtrarCasasPorCondominio,
  classificarFaixasMercado,
  linhaMapaCompetidoresCompleta,
  resumoFaixasMercado,
} from '@/lib/kanban/mapa-competidores-condominio';

function fmtMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

function fmtFaixaPreco(min: number | null, max: number | null): string | null {
  if (min == null || max == null) return null;
  if (min === max) return fmtMoeda(min);
  return `${fmtMoeda(min)} – ${fmtMoeda(max)}`;
}

function fmtFaixaPrecoM2(min: number | null, max: number | null): string | null {
  if (min == null || max == null) return null;
  if (min === max) return `${fmtMoeda(min)}/m²`;
  return `${fmtMoeda(min)}/m² – ${fmtMoeda(max)}/m²`;
}

type FaixaMercadoCardProps = {
  label: string;
  quantidade: number;
  precoMin: number | null;
  precoMax: number | null;
  precoM2Min: number | null;
  precoM2Max: number | null;
  bgClass: string;
  labelClass: string;
  countClass: string;
  priceClass: string;
  priceM2Class: string;
};

function FaixaMercadoCard({
  label,
  quantidade,
  precoMin,
  precoMax,
  precoM2Min,
  precoM2Max,
  bgClass,
  labelClass,
  countClass,
  priceClass,
  priceM2Class,
}: FaixaMercadoCardProps) {
  const faixaPreco = fmtFaixaPreco(precoMin, precoMax);
  const faixaPrecoM2 = fmtFaixaPrecoM2(precoM2Min, precoM2Max);

  return (
    <div className={`rounded-md p-2 text-center ${bgClass}`}>
      <p className={`text-xs font-medium ${labelClass}`}>{label}</p>
      <p className={`text-sm font-semibold ${countClass}`}>{quantidade} casas</p>
      {faixaPreco ? <p className={`text-xs ${priceClass}`}>{faixaPreco}</p> : null}
      {faixaPrecoM2 ? <p className={`text-[11px] ${priceM2Class}`}>{faixaPrecoM2}</p> : null}
    </div>
  );
}

type Props = {
  cardId: string;
  processoId?: string | null;
  itemLabel: string;
  podeEditar: boolean;
};

export function MapaCompetidoresChecklist({ cardId, processoId, itemLabel, podeEditar }: Props) {
  const [linhas, setLinhas] = useState<LinhaProspectCondominio[]>([]);
  const [rowIdAtivo, setRowIdAtivo] = useState<string | null>(null);
  const [dadosMapa, setDadosMapa] = useState<MapaCompetidoresChecklistData | null>(null);
  const [carregandoInicial, setCarregandoInicial] = useState(true);
  const [recarregando, setRecarregando] = useState(false);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const primeiraCargaRef = useRef(true);
  const recarregarPendingRef = useRef<(() => void) | null>(null);

  const resolverRecarregarPendente = useCallback(() => {
    const resolve = recarregarPendingRef.current;
    recarregarPendingRef.current = null;
    resolve?.();
  }, []);

  const recarregar = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      recarregarPendingRef.current = resolve;
      setTick((t) => t + 1);
    });
  }, []);

  useEffect(() => {
    primeiraCargaRef.current = true;
  }, [cardId]);

  useEffect(() => {
    const cid = cardId?.trim();
    if (!cid) {
      setErroCarregar('Card inválido.');
      setCarregandoInicial(false);
      resolverRecarregarPendente();
      return;
    }

    let cancelado = false;
    const isPrimeiraCarga = primeiraCargaRef.current;
    if (isPrimeiraCarga) {
      setCarregandoInicial(true);
      primeiraCargaRef.current = false;
    } else {
      setRecarregando(true);
    }
    setErroCarregar(null);

    void (async () => {
      try {
        const [prospectsRes, mapaRes] = await Promise.all([
          carregarProspectsCondominioCard(cid),
          carregarMapaCompetidoresChecklist(processoId, cid),
        ]);
        if (cancelado) return;

        if (!prospectsRes.ok) {
          setErroCarregar(prospectsRes.error);
          setLinhas([]);
          setDadosMapa(null);
          return;
        }
        if (!mapaRes.ok) {
          setErroCarregar(mapaRes.error);
          setLinhas(prospectsRes.linhas);
          setDadosMapa(mapaRes);
          return;
        }

        setLinhas(prospectsRes.linhas);
        setDadosMapa(mapaRes);
        const comNome = prospectsOrdenadosPorTicketCasas(prospectsRes.linhas);
        setRowIdAtivo((atual) => {
          if (atual && comNome.some((l) => l.row_id === atual)) return atual;
          return comNome[0]?.row_id ?? null;
        });
      } catch {
        if (!cancelado) setErroCarregar('Falha ao carregar mapa de competidores.');
      } finally {
        if (!cancelado) {
          setCarregandoInicial(false);
          setRecarregando(false);
          resolverRecarregarPendente();
        }
      }
    })();

    return () => {
      cancelado = true;
      resolverRecarregarPendente();
    };
  }, [cardId, processoId, tick, resolverRecarregarPendente]);

  const prospects = useMemo(() => prospectsOrdenadosPorTicketCasas(linhas), [linhas]);
  const casas = dadosMapa?.ok ? dadosMapa.casas : [];

  const tabsCondominio = useMemo(
    () =>
      prospects.map((p) => ({
        id: p.row_id,
        label: `${p.condominio.trim()}${linhaMapaCompetidoresCompleta(p, casas) ? ' ✓' : ''}`,
      })),
    [prospects, casas],
  );

  const linhaAtiva = useMemo(
    () => linhas.find((l) => l.row_id === rowIdAtivo) ?? null,
    [linhas, rowIdAtivo],
  );

  const casasDoCondominio = useMemo(() => {
    if (!linhaAtiva?.condominio?.trim()) return [];
    return filtrarCasasPorCondominio(casas, linhaAtiva.condominio);
  }, [casas, linhaAtiva]);

  const casasComFaixa = useMemo(
    () => classificarFaixasMercado(casasDoCondominio),
    [casasDoCondominio],
  );

  const resumoFaixas = useMemo(
    () => resumoFaixasMercado(casasDoCondominio),
    [casasDoCondominio],
  );

  const painelFaixasMercado =
    resumoFaixas && casasDoCondominio.length > 0 ? (
      <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
        <p className="mb-2 text-xs font-medium text-gray-500">
          Distribuição de mercado — mínimo R$ 4MM
        </p>
        <div className="grid grid-cols-3 gap-2">
          <FaixaMercadoCard
            label="Entrada"
            quantidade={resumoFaixas.entrada.quantidade}
            precoMin={resumoFaixas.entrada.precoMin}
            precoMax={resumoFaixas.entrada.precoMax}
            precoM2Min={resumoFaixas.entrada.precoM2Min}
            precoM2Max={resumoFaixas.entrada.precoM2Max}
            bgClass="bg-gray-100"
            labelClass="text-gray-500"
            countClass="text-gray-700"
            priceClass="text-gray-500"
            priceM2Class="text-gray-400"
          />
          <FaixaMercadoCard
            label="Intermediária"
            quantidade={resumoFaixas.intermediaria.quantidade}
            precoMin={resumoFaixas.intermediaria.precoMin}
            precoMax={resumoFaixas.intermediaria.precoMax}
            precoM2Min={resumoFaixas.intermediaria.precoM2Min}
            precoM2Max={resumoFaixas.intermediaria.precoM2Max}
            bgClass="bg-amber-50"
            labelClass="text-amber-700"
            countClass="text-amber-800"
            priceClass="text-amber-600"
            priceM2Class="text-amber-400"
          />
          <FaixaMercadoCard
            label="Premium"
            quantidade={resumoFaixas.premium.quantidade}
            precoMin={resumoFaixas.premium.precoMin}
            precoMax={resumoFaixas.premium.precoMax}
            precoM2Min={resumoFaixas.premium.precoM2Min}
            precoM2Max={resumoFaixas.premium.precoM2Max}
            bgClass="bg-blue-50"
            labelClass="text-blue-600"
            countClass="text-blue-700"
            priceClass="text-blue-500"
            priceM2Class="text-blue-300"
          />
        </div>
        {(resumoFaixas.premium_plus.quantidade > 0 ||
          resumoFaixas.premium_plus2.quantidade > 0 ||
          resumoFaixas.premium_plus3.quantidade > 0) && (
          <div className="mt-2 grid grid-cols-3 gap-2">
            {resumoFaixas.premium_plus.quantidade > 0 ? (
              <FaixaMercadoCard
                label="Premium+"
                quantidade={resumoFaixas.premium_plus.quantidade}
                precoMin={resumoFaixas.premium_plus.precoMin}
                precoMax={resumoFaixas.premium_plus.precoMax}
                precoM2Min={resumoFaixas.premium_plus.precoM2Min}
                precoM2Max={resumoFaixas.premium_plus.precoM2Max}
                bgClass="bg-indigo-50"
                labelClass="text-indigo-700"
                countClass="text-indigo-800"
                priceClass="text-indigo-600"
                priceM2Class="text-indigo-400"
              />
            ) : null}
            {resumoFaixas.premium_plus2.quantidade > 0 ? (
              <FaixaMercadoCard
                label="Premium++"
                quantidade={resumoFaixas.premium_plus2.quantidade}
                precoMin={resumoFaixas.premium_plus2.precoMin}
                precoMax={resumoFaixas.premium_plus2.precoMax}
                precoM2Min={resumoFaixas.premium_plus2.precoM2Min}
                precoM2Max={resumoFaixas.premium_plus2.precoM2Max}
                bgClass="bg-violet-50"
                labelClass="text-violet-700"
                countClass="text-violet-800"
                priceClass="text-violet-600"
                priceM2Class="text-violet-400"
              />
            ) : null}
            {resumoFaixas.premium_plus3.quantidade > 0 ? (
              <FaixaMercadoCard
                label="Premium+++"
                quantidade={resumoFaixas.premium_plus3.quantidade}
                precoMin={resumoFaixas.premium_plus3.precoMin}
                precoMax={resumoFaixas.premium_plus3.precoMax}
                precoM2Min={resumoFaixas.premium_plus3.precoM2Min}
                precoM2Max={resumoFaixas.premium_plus3.precoM2Max}
                bgClass="bg-purple-50"
                labelClass="text-purple-700"
                countClass="text-purple-800"
                priceClass="text-purple-600"
                priceM2Class="text-purple-400"
              />
            ) : null}
          </div>
        )}
      </div>
    ) : null;

  if (carregandoInicial) {
    return (
      <div className="flex items-center gap-2 py-3 text-sm" style={{ color: 'var(--moni-text-tertiary)' }}>
        <Loader2 size={14} className="animate-spin" />
        Carregando {itemLabel.toLowerCase()}…
      </div>
    );
  }

  if (erroCarregar || !dadosMapa?.ok) {
    return (
      <div>
        <p className="mb-1 text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
          {itemLabel}
        </p>
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {erroCarregar ??
            (dadosMapa && !dadosMapa.ok ? dadosMapa.error : null) ??
            'Processo Step One não vinculado a este card.'}
        </p>
      </div>
    );
  }

  return (
    <div>
      <span className="mb-1 block text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
        {itemLabel}
        <span className="ml-1 text-red-500">*</span>
      </span>
      <p className="mb-2 text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
        Para cada condomínio da Tabela de Condomínios, busque online, importe por planilha ou cadastre
        manualmente as casas do mapa de competidores.
      </p>

      {prospects.length === 0 ? (
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
          onAbaChange={(id) => setRowIdAtivo(id || null)}
          ariaLabel="Condomínios prospectados"
        >
          {linhaAtiva ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <BadgeConclusao completa={linhaMapaCompetidoresCompleta(linhaAtiva, casas)} />
                <span className="text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
                  {casasDoCondominio.length}{' '}
                  {casasDoCondominio.length === 1 ? 'listagem' : 'listagens'} neste condomínio
                </span>
                {recarregando ? (
                  <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
                    <Loader2 size={11} className="animate-spin" />
                    Atualizando…
                  </span>
                ) : null}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
                  Listagem de casas — busca online, planilha ou cadastro manual
                  <span className="ml-1 text-red-500">*</span>
                </p>
                <p className="text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
                  Busque online, importe planilha (.xlsx ou .csv) ou cadastre manualmente.
                </p>
                <div className="relative overflow-hidden rounded-xl border border-stone-200 bg-white">
                  {recarregando ? (
                    <div
                      className="pointer-events-none absolute inset-0 z-10 bg-white/60"
                      aria-hidden
                    />
                  ) : null}
                  <Etapa4CasasListagem
                    key={linhaAtiva.row_id}
                    readOnly={!podeEditar}
                    cardId={cardId}
                    processoId={dadosMapa.processoId}
                    casas={casasComFaixa}
                    cidadeInicial={dadosMapa.cidadeInicial}
                    estadoInicial={dadosMapa.estadoInicial}
                    ultimaValidacaoCasasManuaisEm={dadosMapa.ultimaValidacaoCasasManuaisEm}
                    condominioInicial={linhaAtiva.condominio.trim()}
                    painelAposBuscar={painelFaixasMercado}
                    onMutate={recarregar}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </KanbanFaseSecaoTabs>
      )}
    </div>
  );
}

function BadgeConclusao({ completa }: { completa: boolean }) {
  if (completa) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
        <CheckCircle2 size={12} />
        Sessão completa
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">
      <Circle size={12} />
      Pendente
    </span>
  );
}
