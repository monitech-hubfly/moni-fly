'use client';

import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Trophy } from 'lucide-react';
import {
  badgeCompatibilidade,
  formatConfrontosModeloGEP,
  formatModeloTopografia,
  formatPrecoAnuncio,
  type AnuncioAmeacadorPreBatalha,
  type BatalhaModeloAnuncioPreBatalha,
  type ConfrontosModeloFaixa,
  type RankingPorFaixaMercado,
  type ResultadoRankingModelo,
} from '@/lib/kanban/pre-batalha-compatibilidade';
import { gerarExplicacaoRankingFaixaPreBatalha } from '@/lib/kanban/pre-batalha-explicacao-faixa';
import { formatNotaAn, labelBadgeTipoAndarIncompativel } from '@/app/step-one/[id]/etapa/REGRAS_BATALHA';

function formatRank(posicao: number): string {
  return String(posicao).padStart(2, '0');
}

function mensagemFalhaRanking(
  item: ResultadoRankingModelo,
  falha: 'largura' | 'profundidade' | 'area' | 'topografia',
): string {
  if (falha === 'topografia') {
    return 'Topografia do modelo incompatível com o lote escolhido';
  }
  if (falha === 'largura') {
    return `Largura útil ${item.largura_util?.toFixed(1) ?? '—'}m < ${item.dimensao_x_m ?? '—'}m`;
  }
  if (falha === 'profundidade') {
    return `Profundidade útil ${item.profundidade_util?.toFixed(1) ?? '—'}m < ${item.dimensao_y_m ?? '—'}m`;
  }
  return `Área útil ${item.area_util?.toFixed(0) ?? '—'}m² < ${item.area_perimetro_m2 ?? '—'}m²`;
}

function formatMatchLote(item: ResultadoRankingModelo): string {
  return `${item.matchScore}/${item.totalAtributosLote}`;
}

function linhaNotasRanking(item: ResultadoRankingModelo): string {
  return `Lote: ${formatMatchLote(item)} | Preço: ${item.notaPrecoMedia} | Produto: ${item.notaProdutoMedia}`;
}

function linhaConfrontosRanking(item: ResultadoRankingModelo): string | null {
  if (!item.confrontosModelos) return null;
  return formatConfrontosModeloGEP(item.confrontosModelos);
}

function CelulaConfrontosGEP({ confrontos }: { confrontos: ConfrontosModeloFaixa }) {
  return (
    <span className="inline-flex flex-wrap justify-center gap-x-2 gap-y-0.5 text-[11px] font-semibold tabular-nums sm:text-xs">
      <span className="text-emerald-700">G: {confrontos.ganhos}</span>
      <span className="text-amber-800">E: {confrontos.empates}</span>
      <span className="text-red-700">P: {confrontos.perdas}</span>
    </span>
  );
}

function BadgeTipoAndarIncompativel({ item }: { item: ResultadoRankingModelo }) {
  if (!item.tipoAndareIncompativel) return null;
  const label = labelBadgeTipoAndarIncompativel(item.tipoPredominanteFaixa);
  if (!label) return null;
  return (
    <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-800 ring-1 ring-red-200">
      {label}
    </span>
  );
}

function BadgeTopografiaCompat({ topoCompativel }: { topoCompativel: boolean }) {
  if (topoCompativel) {
    return (
      <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-300">
        ✓ Topografia compatível
      </span>
    );
  }
  return (
    <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-800 ring-1 ring-red-300">
      ✗ Topografia incompatível
    </span>
  );
}

function notaCellClass(nota: number): string {
  if (nota >= 1) return 'text-emerald-700';
  if (nota >= 0) return 'text-amber-800';
  return 'text-red-700';
}

function PodiumTop3({ top3 }: { top3: ResultadoRankingModelo[] }) {
  const elegiveis = top3.filter(
    (item) => item.elegivel !== false && !item.tipoAndareIncompativel,
  );
  if (elegiveis.length === 0) return null;

  const slots: { item: ResultadoRankingModelo; pos: number; height: string; trophy: string }[] = [];
  if (elegiveis[1]) slots.push({ item: elegiveis[1], pos: 2, height: 'h-16', trophy: 'text-stone-400' });
  if (elegiveis[0]) slots.push({ item: elegiveis[0], pos: 1, height: 'h-20', trophy: 'text-amber-500' });
  if (elegiveis[2]) slots.push({ item: elegiveis[2], pos: 3, height: 'h-14', trophy: 'text-amber-700/80' });

  return (
    <div
      className="mb-5 rounded-xl border border-stone-200/80 bg-stone-900/5 px-4 py-4 backdrop-blur-sm"
      aria-label="Pódio — top 3 modelos"
    >
      <div className="flex items-end justify-center gap-3 sm:gap-6">
        {slots.map(({ item, pos, height, trophy }) => (
          <div
            key={item.catalogoId}
            className={`flex ${height} min-w-[5.5rem] max-w-[8rem] flex-1 flex-col items-center justify-end text-center sm:min-w-[6.5rem]`}
          >
            <Trophy className={`mb-1 h-6 w-6 shrink-0 sm:h-7 sm:w-7 ${trophy}`} aria-hidden />
            <span className="text-[10px] font-bold uppercase tracking-wide text-stone-500 sm:text-xs">
              {formatRank(pos)}
            </span>
            <span className="mt-0.5 line-clamp-2 text-xs font-semibold leading-tight text-stone-800">
              {formatModeloTopografia(item.modelo, item.topografia)}
            </span>
            <span className="mt-0.5 text-[11px] font-bold tabular-nums text-amber-900">
              {formatMatchLote(item)} atrib.
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BatalhasTable({ batalhas }: { batalhas: BatalhaModeloAnuncioPreBatalha[] }) {
  if (batalhas.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-stone-200 bg-stone-50/90 text-[11px] font-semibold uppercase tracking-wider text-stone-600">
            <th className="px-3 py-2 text-left sm:px-4">Modelo</th>
            <th className="px-3 py-2 text-left sm:px-4">Anúncio</th>
            <th className="px-3 py-2 text-right sm:px-4">Preço anúncio</th>
            <th className="px-3 py-2 text-right sm:px-4">INC + Kit</th>
            <th className="px-3 py-2 text-center sm:px-4">Match lote</th>
            <th className="px-3 py-2 text-center sm:px-4">Preço</th>
            <th className="px-3 py-2 text-center sm:px-4">Produto</th>
            <th className="px-3 py-2 text-center sm:px-4" title="Preço + Produto (sem eixo Lote)">
              Final
            </th>
          </tr>
        </thead>
        <tbody>
          {batalhas.map((b) => (
            <tr
              key={`${b.catalogoId}-${b.anuncioId}`}
              className="border-b border-stone-100 last:border-0 bg-white/50 hover:bg-stone-50/90"
            >
              <td className="px-3 py-2.5 sm:px-4">
                <span className="font-medium text-stone-900">
                  {formatModeloTopografia(b.modelo, b.topografia)}
                </span>
              </td>
              <td className="max-w-[12rem] truncate px-3 py-2.5 text-stone-700 sm:px-4" title={b.condominio}>
                {b.condominio}
              </td>
              <td className="px-3 py-2.5 text-right text-xs tabular-nums text-stone-600 sm:px-4">
                {b.precoAnuncio > 0 ? formatPrecoAnuncio(b.precoAnuncio) : '—'}
              </td>
              <td className="px-3 py-2.5 text-right text-xs tabular-nums text-stone-600 sm:px-4">
                {b.precoIncKitMoni != null && b.precoIncKitMoni > 0
                  ? formatPrecoAnuncio(b.precoIncKitMoni)
                  : '—'}
              </td>
              <td className="px-3 py-2.5 text-center text-sm font-semibold tabular-nums text-stone-800 sm:px-4">
                {b.matchScore}/{b.totalAtributosLote}
              </td>
              <td
                className={`px-3 py-2.5 text-center text-sm font-semibold tabular-nums sm:px-4 ${notaCellClass(b.notaPreco)}`}
              >
                {b.notaPreco}
              </td>
              <td
                className={`px-3 py-2.5 text-center text-sm font-semibold tabular-nums sm:px-4 ${notaCellClass(b.notaProduto)}`}
              >
                {b.notaProduto}
              </td>
              <td className="px-3 py-2.5 text-center sm:px-4">
                <span className="inline-flex min-w-[2rem] justify-center rounded-md bg-stone-900/5 px-1.5 py-0.5 text-xs font-bold tabular-nums text-stone-900">
                  {b.notaFinalLinha}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatAreaM2(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(valor)) return '—';
  return String(Math.round(valor));
}

function SugestaoAnexoResumoConsolidada({
  consolidada,
}: {
  consolidada: NonNullable<ResultadoRankingModelo['sugestaoAnexoConsolidada']>;
}) {
  return (
    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <p className="mb-1 font-semibold">📐 Sugestão de anexo</p>
      <p>
        Adicionar <strong>+{consolidada.m2Recomendado}m²</strong> de anexo (
        {consolidada.anexosRecomendados}x módulo de 20m²) elimina a penalização de tamanho em{' '}
        <strong>{consolidada.anunciosEliminados}</strong> de {consolidada.anunciosPenalizados}{' '}
        anúncios penalizantes.
      </p>
    </div>
  );
}

function SugestaoAnexoTamanho({ anuncio }: { anuncio: AnuncioAmeacadorPreBatalha }) {
  const sug = anuncio.sugestaoAnexo;
  if (!sug) return null;

  return (
    <div className="mt-1 rounded border border-amber-100 bg-amber-50 px-2 py-1 text-xs text-amber-800">
      Tamanho: anúncio {formatAreaM2(anuncio.areaAnuncioM2)}m² vs Moní{' '}
      {formatAreaM2(anuncio.areaMoniM2)}m² — <strong>+{sug.m2Anexo}m²</strong> de anexo (
      {sug.anexosNecessarios}x 20m²) eleva para {Math.round(sug.areaMoniComAnexo)}m²
      {sug.penalizacaoEliminada ? ' ✓ penalização eliminada' : ' (reduz penalização)'}
    </div>
  );
}

function DetalheModeloPreBatalha({ item }: { item: ResultadoRankingModelo }) {
  const temResumo = item.sugestaoAnexoConsolidada != null;
  const temAmeacadores = item.anunciosAmeacadores.length > 0;
  if (!temResumo && !temAmeacadores) return null;

  return (
    <div className="space-y-2">
      {temResumo ? (
        <SugestaoAnexoResumoConsolidada consolidada={item.sugestaoAnexoConsolidada!} />
      ) : null}
      {temAmeacadores ? (
        <ListaAnunciosAmeacadores anuncios={item.anunciosAmeacadores} />
      ) : null}
    </div>
  );
}

function ListaAnunciosAmeacadores({ anuncios }: { anuncios: AnuncioAmeacadorPreBatalha[] }) {
  if (anuncios.length === 0) return null;

  return (
    <div className="space-y-2 border-t border-stone-100 pt-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">
        Anúncios mais ameaçadores
      </p>
      <ul className="space-y-2">
        {anuncios.map((anuncio) => (
          <li key={anuncio.id} className="rounded-md border border-stone-100 bg-stone-50/80 px-2 py-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-xs">
              <span className="font-medium text-stone-800">{anuncio.condominio}</span>
              <span className="tabular-nums text-stone-600">
                Preço {anuncio.notaPreco} · Produto {anuncio.notaProduto}
              </span>
            </div>
            <SugestaoAnexoTamanho anuncio={anuncio} />
            {anuncio.notaAndares != null ? (
              <p className="mt-1 text-[11px] tabular-nums text-stone-600">
                {formatNotaAn(anuncio.notaAndares)}
              </p>
            ) : null}
            {anuncio.obsFlexivel && anuncio.obsFlexivel.length > 0 ? (
              <div className="mt-1 rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-800">
                {anuncio.obsFlexivel.map((obs, i) => (
                  <p key={i}>⚡ {obs}</p>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function LeaderboardTable({ ranking }: { ranking: ResultadoRankingModelo[] }) {
  let posicaoElegivel = 0;

  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200/90 bg-white/80 shadow-inner backdrop-blur-sm">
      <table className="w-full min-w-[580px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-stone-200 bg-stone-100/90 text-[11px] font-semibold uppercase tracking-wider text-stone-600">
            <th className="px-3 py-2.5 text-left sm:px-4">Rank</th>
            <th className="px-3 py-2.5 text-left sm:px-4">Modelo</th>
            <th className="px-3 py-2.5 text-center sm:px-4">Match lote</th>
            <th className="px-3 py-2.5 text-center sm:px-4">Preço</th>
            <th className="px-3 py-2.5 text-center sm:px-4">Produto</th>
            <th className="px-3 py-2.5 text-center sm:px-4" title="Preço + Produto (sem eixo Lote)">
              Nota final
            </th>
            <th
              className="px-3 py-2.5 text-center sm:px-4"
              title="Confrontos vs. outros modelos Moní da faixa (Preço + Produto por anúncio)"
            >
              G / E / P
            </th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((item) => {
            const inelegivel = item.elegivel === false;
            const incompatAndar = item.tipoAndareIncompativel === true;
            const posicao = inelegivel || incompatAndar ? null : ++posicaoElegivel;
            const destaqueTop3 = posicao != null && posicao <= 3;
            const compat = badgeCompatibilidade(item.notaFinal);
            const falhasGeometria = item.falhas.filter((f) => f !== 'topografia');

            return (
              <Fragment key={item.catalogoId}>
                <tr
                  className={`border-b border-stone-100 ${
                    inelegivel || incompatAndar
                      ? 'bg-white/40 opacity-60'
                      : destaqueTop3
                        ? 'bg-amber-50/80'
                        : 'bg-white/60 hover:bg-stone-50/90'
                  }`}
                >
                  <td className="px-3 py-3 font-bold tabular-nums text-stone-700 sm:px-4">
                    {posicao != null ? formatRank(posicao) : '—'}
                  </td>
                  <td className="px-3 py-3 sm:px-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-stone-900">
                        {formatModeloTopografia(item.modelo, item.topografia)}
                      </span>
                      <BadgeTopografiaCompat topoCompativel={item.topoCompativel} />
                      <BadgeTipoAndarIncompativel item={item} />
                      {inelegivel && falhasGeometria.length > 0 ? (
                        <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-800 ring-1 ring-red-200">
                          Não cabe
                        </span>
                      ) : !inelegivel ? (
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${compat.className}`}
                        >
                          {compat.label}
                        </span>
                      ) : null}
                    </div>
                    {!inelegivel ? (
                      <>
                        <p className="mt-0.5 text-[11px] font-medium text-stone-700">
                          Lote: {formatMatchLote(item)} atributos
                        </p>
                        <p className="mt-0.5 text-[11px] text-stone-500">{linhaNotasRanking(item)}</p>
                        {item.confrontosModelos ? (
                          <p className="mt-0.5 text-[11px] font-medium tabular-nums text-stone-600">
                            {formatConfrontosModeloGEP(item.confrontosModelos)}
                          </p>
                        ) : null}
                        {item.precoIncKitMoni != null && item.precoIncKitMoni > 0 ? (
                          <p className="mt-0.5 text-[11px] text-stone-500">
                            INC + Kit: {formatPrecoAnuncio(item.precoIncKitMoni)}
                          </p>
                        ) : null}
                      </>
                    ) : null}
                  </td>
                  {inelegivel ? (
                    <td colSpan={5} className="px-3 py-3 sm:px-4">
                      <ul className="space-y-1 text-xs text-red-800">
                        {item.falhas.map((falha) => (
                          <li key={falha}>{mensagemFalhaRanking(item, falha)}</li>
                        ))}
                      </ul>
                    </td>
                  ) : (
                    <>
                      <td className="px-3 py-3 text-center text-sm font-semibold tabular-nums sm:px-4 text-stone-800">
                        {formatMatchLote(item)}
                      </td>
                      <td
                        className={`px-3 py-3 text-center text-sm font-semibold tabular-nums sm:px-4 ${notaCellClass(item.notaPrecoMedia)}`}
                      >
                        {item.notaPrecoMedia}
                      </td>
                      <td
                        className={`px-3 py-3 text-center text-sm font-semibold tabular-nums sm:px-4 ${notaCellClass(item.notaProdutoMedia)}`}
                      >
                        {item.notaProdutoMedia}
                      </td>
                      <td className="px-3 py-3 text-center sm:px-4">
                        <span className="inline-flex min-w-[2.5rem] justify-center rounded-md bg-stone-900/5 px-2 py-1 text-sm font-bold tabular-nums text-stone-900">
                          {item.notaFinal}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center sm:px-4">
                        {item.confrontosModelos ? (
                          <CelulaConfrontosGEP confrontos={item.confrontosModelos} />
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
                      </td>
                    </>
                  )}
                </tr>
                {!inelegivel &&
                (item.sugestaoAnexoConsolidada != null || item.anunciosAmeacadores.length > 0) ? (
                  <tr key={`${item.catalogoId}-detalhe`} className="border-b border-stone-100 bg-white/40">
                    <td colSpan={7} className="px-3 pb-3 pt-0 sm:px-4">
                      <DetalheModeloPreBatalha item={item} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function linhaResumoRanking(item: ResultadoRankingModelo, posicaoElegivel: number | null): string {
  const rotulo = formatModeloTopografia(item.modelo, item.topografia);
  if (item.elegivel === false) {
    const falhas = item.falhas.map((f) => mensagemFalhaRanking(item, f)).join('; ');
    return `— ${rotulo}${falhas ? ` — ${falhas}` : ''}`;
  }
  const confrontos = linhaConfrontosRanking(item);
  const sufixoConfrontos = confrontos ? ` | ${confrontos}` : '';
  return `${posicaoElegivel}º ${rotulo} (${linhaNotasRanking(item)} | Final: ${item.notaFinal}${sufixoConfrontos})`;
}

function SubSecaoTabelaColapsavel({
  titulo,
  resumo,
  expandida,
  onToggle,
  panelId,
  children,
}: {
  titulo: string;
  resumo: ReactNode;
  expandida: boolean;
  onToggle: () => void;
  panelId: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-stone-200/90 bg-white/70 shadow-inner backdrop-blur-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expandida}
        aria-controls={panelId}
        className="flex w-full items-start justify-between gap-3 border-b border-stone-200 bg-stone-100/90 px-3 py-2.5 text-left transition hover:bg-stone-100"
      >
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-600">{titulo}</p>
          {!expandida ? <div className="mt-1.5">{resumo}</div> : null}
        </div>
        <span className="flex shrink-0 items-center gap-1 pt-0.5 text-[11px] font-medium text-stone-500">
          {expandida ? (
            <ChevronDown className="h-4 w-4" aria-hidden />
          ) : (
            <ChevronRight className="h-4 w-4" aria-hidden />
          )}
        </span>
      </button>
      {expandida ? (
        <div id={panelId} className="p-1 sm:p-2">
          {children}
        </div>
      ) : null}
    </div>
  );
}

const LIMITE_RESUMO_RANKING = 3;

function RankingResumoMinimizado({ ranking }: { ranking: ResultadoRankingModelo[] }) {
  if (ranking.length === 0) {
    return <p className="text-xs text-stone-500">Nenhum modelo ranqueado nesta faixa.</p>;
  }

  const elegiveis = ranking.filter((item) => item.elegivel !== false);
  const exibir = elegiveis.slice(0, LIMITE_RESUMO_RANKING);
  const elegiveisOcultos = Math.max(0, elegiveis.length - exibir.length);
  const inelegiveis = ranking.length - elegiveis.length;

  let posicaoElegivel = 0;

  return (
    <div>
      <ul className="space-y-1 text-xs leading-relaxed text-stone-700">
        {exibir.map((item) => {
          const pos = ++posicaoElegivel;
          return (
            <li
              key={item.catalogoId}
              className={`rounded-md px-2 py-1 ${
                pos <= 3 ? 'bg-amber-50/90 font-medium text-stone-800' : 'bg-white/60'
              }`}
            >
              {linhaResumoRanking(item, pos)}
            </li>
          );
        })}
      </ul>
      {elegiveisOcultos > 0 || inelegiveis > 0 ? (
        <p className="mt-1.5 px-2 text-[11px] text-stone-500">
          {elegiveisOcultos > 0 && inelegiveis > 0
            ? `+ ${elegiveisOcultos} ${elegiveisOcultos === 1 ? 'modelo' : 'modelos'} e ${inelegiveis} incompatíveis — expandir para ver`
            : elegiveisOcultos > 0
              ? `+ ${elegiveisOcultos} ${elegiveisOcultos === 1 ? 'modelo' : 'modelos'} — expandir para ver`
              : `${inelegiveis} ${inelegiveis === 1 ? 'modelo incompatível' : 'modelos incompatíveis'} — expandir para ver`}
        </p>
      ) : null}
    </div>
  );
}

function ExplicacaoFaixaPreBatalha({ grupo }: { grupo: RankingPorFaixaMercado }) {
  const paragrafos = gerarExplicacaoRankingFaixaPreBatalha(grupo);
  if (paragrafos.length === 0) return null;

  return (
    <div
      className="mx-4 mb-3 rounded-lg border border-sky-200/90 bg-sky-50/90 px-3 py-3 text-xs leading-relaxed text-sky-950 sm:mx-5"
      role="note"
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-sky-800">
        Por que este ranking nesta faixa?
      </p>
      {paragrafos.map((paragrafo, idx) => (
        <p key={idx} className={idx > 0 ? 'mt-2' : undefined}>
          {paragrafo}
        </p>
      ))}
    </div>
  );
}

function FaixaPreBatalhaColapsavel({
  grupo,
  expandida,
  onToggle,
}: {
  grupo: RankingPorFaixaMercado;
  expandida: boolean;
  onToggle: () => void;
}) {
  const panelId = `pre-batalha-faixa-${grupo.faixa}`;
  const [batalhasAbertas, setBatalhasAbertas] = useState(false);
  const [rankingAberto, setRankingAberto] = useState(false);

  useEffect(() => {
    if (!expandida) {
      setBatalhasAbertas(false);
      setRankingAberto(false);
    }
  }, [expandida]);

  return (
    <section className="overflow-hidden rounded-2xl border border-stone-300/70 bg-gradient-to-b from-stone-200/40 via-stone-50/90 to-white shadow-lg backdrop-blur-md">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expandida}
        aria-controls={panelId}
        className="flex w-full flex-col gap-2 px-4 py-3 text-left transition hover:bg-stone-100/40 sm:px-5 sm:py-4"
      >
        <div className="flex w-full items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-500">
              Mapa de competidores
            </p>
            <h3 className="mt-0.5 text-base font-bold uppercase tracking-wide text-stone-800 sm:text-lg">
              Faixa {grupo.faixaLabel}
            </h3>
            <p className="mt-1 text-xs text-stone-500">
              {grupo.quantidadeAnuncios}{' '}
              {grupo.quantidadeAnuncios === 1 ? 'anúncio' : 'anúncios'} ·{' '}
              {grupo.batalhas.length}{' '}
              {grupo.batalhas.length === 1 ? 'batalha' : 'batalhas'} ·{' '}
              {grupo.ranking.length}{' '}
              {grupo.ranking.length === 1 ? 'modelo' : 'modelos'}
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 pt-1 text-[11px] font-medium text-stone-600">
            {expandida ? (
              <>
                <ChevronDown className="h-5 w-5" aria-hidden />
                <span className="hidden sm:inline">Recolher</span>
              </>
            ) : (
              <>
                <ChevronRight className="h-5 w-5" aria-hidden />
                <span className="hidden sm:inline">Expandir</span>
              </>
            )}
          </span>
        </div>

        {!expandida ? (
          <div className="w-full border-t border-stone-200/80 pt-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-stone-500">
              Ranking agregado
            </p>
            <RankingResumoMinimizado ranking={grupo.ranking} />
          </div>
        ) : null}
      </button>

      <ExplicacaoFaixaPreBatalha grupo={grupo} />

      {expandida ? (
        <div id={panelId} className="space-y-4 border-t border-stone-200/80 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
          {grupo.batalhas.length > 0 ? (
            <SubSecaoTabelaColapsavel
              titulo="Batalhas — modelo × anúncio"
              resumo={
                <p className="text-xs text-stone-500">
                  {grupo.batalhas.length}{' '}
                  {grupo.batalhas.length === 1 ? 'batalha' : 'batalhas'} — clique para ver a lista
                </p>
              }
              expandida={batalhasAbertas}
              onToggle={() => setBatalhasAbertas((v) => !v)}
              panelId={`${panelId}-batalhas`}
            >
              <BatalhasTable batalhas={grupo.batalhas} />
            </SubSecaoTabelaColapsavel>
          ) : null}

          <SubSecaoTabelaColapsavel
            titulo="Ranking agregado"
            resumo={<RankingResumoMinimizado ranking={grupo.ranking} />}
            expandida={rankingAberto}
            onToggle={() => setRankingAberto((v) => !v)}
            panelId={`${panelId}-ranking`}
          >
            <PodiumTop3
              top3={grupo.ranking
                .filter((r) => r.elegivel !== false && !r.tipoAndareIncompativel)
                .slice(0, 3)}
            />
            <LeaderboardTable ranking={grupo.ranking} />
          </SubSecaoTabelaColapsavel>
        </div>
      ) : null}
    </section>
  );
}

type Props = {
  grupos: RankingPorFaixaMercado[];
};

/** Leaderboard Pré Batalha — faixas colapsáveis (resumo) com opção de expandir listas completas. */
export function PreBatalhaRankingLeaderboard({ grupos }: Props) {
  const [expandidas, setExpandidas] = useState<Set<string>>(() => new Set());

  if (grupos.length === 0) return null;

  const toggleFaixa = (faixa: string) => {
    setExpandidas((prev) => {
      const next = new Set(prev);
      if (next.has(faixa)) next.delete(faixa);
      else next.add(faixa);
      return next;
    });
  };

  const expandirTodas = () => setExpandidas(new Set(grupos.map((g) => g.faixa)));
  const recolherTodas = () => setExpandidas(new Set());

  return (
    <div className="space-y-4">
      {grupos.length > 1 ? (
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={expandirTodas}
            className="rounded-md border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-600 hover:bg-stone-50"
          >
            Expandir todas
          </button>
          <button
            type="button"
            onClick={recolherTodas}
            className="rounded-md border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-600 hover:bg-stone-50"
          >
            Recolher todas
          </button>
        </div>
      ) : null}

      <div className="space-y-4">
        {grupos.map((grupo) => (
          <FaixaPreBatalhaColapsavel
            key={grupo.faixa}
            grupo={grupo}
            expandida={expandidas.has(grupo.faixa)}
            onToggle={() => toggleFaixa(grupo.faixa)}
          />
        ))}
      </div>
    </div>
  );
}
