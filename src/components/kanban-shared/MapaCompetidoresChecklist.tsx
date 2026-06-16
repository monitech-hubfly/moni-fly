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
          Distribuição de mercado — mínimo R$ 4MM (busca ZAP)
        </p>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-md bg-gray-100 p-2 text-center">
            <p className="text-xs font-medium text-gray-500">Entrada</p>
            <p className="text-sm font-semibold text-gray-700">
              {resumoFaixas.entrada.quantidade} casas
            </p>
            <p className="text-xs text-gray-400">até {fmtMoeda(resumoFaixas.entrada.corteMax)}</p>
          </div>
          <div className="rounded-md bg-amber-50 p-2 text-center">
            <p className="text-xs font-medium text-amber-700">Intermediária</p>
            <p className="text-sm font-semibold text-amber-800">
              {resumoFaixas.intermediaria.quantidade} casas
            </p>
            <p className="text-xs text-amber-500">
              {fmtMoeda(resumoFaixas.intermediaria.corteMin)} –{' '}
              {fmtMoeda(resumoFaixas.intermediaria.corteMax)}
            </p>
          </div>
          <div className="rounded-md bg-blue-50 p-2 text-center">
            <p className="text-xs font-medium text-blue-600">Premium</p>
            <p className="text-sm font-semibold text-blue-700">
              {resumoFaixas.premium.quantidade} casas
            </p>
            <p className="text-xs text-blue-400">
              {resumoFaixas.premium.quantidade > 0 ? (
                <>
                  {fmtMoeda(resumoFaixas.premium.corteMin)} – {fmtMoeda(resumoFaixas.premium.corteMax)}
                </>
              ) : (
                <>acima de {fmtMoeda(resumoFaixas.corte2)} (&lt; R$ 10MM)</>
              )}
            </p>
          </div>
        </div>
        {(resumoFaixas.premium_plus.quantidade > 0 ||
          resumoFaixas.premium_plus2.quantidade > 0 ||
          resumoFaixas.premium_plus3.quantidade > 0) && (
          <div className="mt-2 grid grid-cols-3 gap-2">
            {resumoFaixas.premium_plus.quantidade > 0 ? (
              <div className="rounded-md bg-indigo-50 p-2 text-center">
                <p className="text-xs font-medium text-indigo-700">Premium+</p>
                <p className="text-sm font-semibold text-indigo-800">
                  {resumoFaixas.premium_plus.quantidade} casas
                </p>
                <p className="text-xs text-indigo-500">≥ {fmtMoeda(10_000_000)}</p>
              </div>
            ) : null}
            {resumoFaixas.premium_plus2.quantidade > 0 ? (
              <div className="rounded-md bg-violet-50 p-2 text-center">
                <p className="text-xs font-medium text-violet-700">Premium++</p>
                <p className="text-sm font-semibold text-violet-800">
                  {resumoFaixas.premium_plus2.quantidade} casas
                </p>
                <p className="text-xs text-violet-500">≥ {fmtMoeda(15_000_000)}</p>
              </div>
            ) : null}
            {resumoFaixas.premium_plus3.quantidade > 0 ? (
              <div className="rounded-md bg-purple-50 p-2 text-center">
                <p className="text-xs font-medium text-purple-700">Premium+++</p>
                <p className="text-sm font-semibold text-purple-800">
                  {resumoFaixas.premium_plus3.quantidade} casas
                </p>
                <p className="text-xs text-purple-500">≥ {fmtMoeda(20_000_000)}</p>
              </div>
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
        Para cada condomínio da Tabela de Condomínios, varra a ZAP, importe por planilha ou cadastre
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
                  Listagem de casas — ZAP, planilha ou cadastro manual
                  <span className="ml-1 text-red-500">*</span>
                </p>
                <p className="text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
                  Busque na ZAP, importe planilha (.xlsx ou .csv) ou cadastre manualmente.
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
