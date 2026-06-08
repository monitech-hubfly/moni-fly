'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { Etapa4Casas } from '@/app/step-one/[id]/etapa/Etapa4Casas';
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
  filtrarCasasMapaPorCondominio,
  linhaMapaCompetidoresCompleta,
} from '@/lib/kanban/mapa-competidores-condominio';

type Props = {
  cardId: string;
  processoId: string;
  itemLabel: string;
  podeEditar: boolean;
};

export function MapaCompetidoresChecklist({ cardId, processoId, itemLabel, podeEditar }: Props) {
  const [linhas, setLinhas] = useState<LinhaProspectCondominio[]>([]);
  const [rowIdAtivo, setRowIdAtivo] = useState<string | null>(null);
  const [dadosMapa, setDadosMapa] = useState<MapaCompetidoresChecklistData | null>(null);
  const [carregandoInicial, setCarregandoInicial] = useState(true);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const recarregar = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    const cid = cardId?.trim();
    const pid = processoId?.trim();
    if (!cid) {
      setErroCarregar('Card inválido.');
      setCarregandoInicial(false);
      return;
    }
    if (!pid) {
      setErroCarregar('Processo Step One não vinculado a este card.');
      setCarregandoInicial(false);
      return;
    }

    let cancelado = false;
    void (async () => {
      setCarregandoInicial(true);
      setErroCarregar(null);
      try {
        const [prospectsRes, mapaRes] = await Promise.all([
          carregarProspectsCondominioCard(cid),
          carregarMapaCompetidoresChecklist(pid, cid),
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
        if (!cancelado) setCarregandoInicial(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [cardId, processoId, tick]);

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

  const casasCondominioAtivo = useMemo(() => {
    if (!linhaAtiva?.condominio?.trim()) return [];
    return filtrarCasasMapaPorCondominio(casas, linhaAtiva.condominio);
  }, [casas, linhaAtiva]);

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
        Para cada condomínio da Tabela de Condomínios, varra a ZAP e cadastre as casas do mapa de competidores.
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
                  {casasCondominioAtivo.length}{' '}
                  {casasCondominioAtivo.length === 1 ? 'listagem' : 'listagens'} neste condomínio
                </span>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
                  Listagem de casas (ZAP)
                  <span className="ml-1 text-red-500">*</span>
                </p>
                <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                  <Etapa4Casas
                    key={`${linhaAtiva.row_id}-${dadosMapa.cidadeInicial}-${dadosMapa.estadoInicial}`}
                    listagemOnly
                    readOnly={!podeEditar}
                    processoId={dadosMapa.processoId}
                    casas={casasCondominioAtivo}
                    cidadeInicial={dadosMapa.cidadeInicial}
                    estadoInicial={dadosMapa.estadoInicial}
                    ultimaValidacaoCasasManuaisEm={dadosMapa.ultimaValidacaoCasasManuaisEm}
                    casasEscolhidas={[]}
                    catalogo={[]}
                    batalhasIniciais={[]}
                    condominioInicial={linhaAtiva.condominio.trim()}
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
