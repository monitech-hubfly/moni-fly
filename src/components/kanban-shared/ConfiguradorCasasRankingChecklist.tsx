'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Loader2, ChevronsDown, ChevronsUp } from 'lucide-react';
import { carregarConfiguradorCasasChecklist } from '@/lib/actions/kanban-configurador-casas';
import {
  labelFaixaMercado,
  ORDEM_FAIXAS_MERCADO,
  type FaixaMercado,
} from '@/lib/kanban/mapa-competidores-condominio';
import { modeloElegivelParaFaixa } from '@/lib/kanban/modelo-faixa-elegibilidade';
import {
  parseConfiguradorCasasValores,
  serializeConfiguradorCasasValores,
  mesclarValoresConfiguradorPorModelo,
  classeDestaquePodioConfigurador,
  CONFIGURADOR_CASAS_LINHAS_MINIMIZADO,
  type CasaConfiguradorRanking,
} from '@/lib/kanban/configurador-casas-ranking';
import { stepOneConfiguradorCasasHref } from '@/lib/kanban/stepone-fase-slugs';

type Props = {
  cardId: string;
  processoId?: string | null;
  itemLabel: string;
  obrigatorio?: boolean;
  valorInicial: string;
  podeEditar: boolean;
  onSave: (valor: string) => void | Promise<void>;
  salvando?: boolean;
};

export function ConfiguradorCasasRankingChecklist({
  cardId,
  processoId,
  itemLabel,
  obrigatorio = false,
  valorInicial,
  podeEditar,
  onSave,
  salvando = false,
}: Props) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [casas, setCasas] = useState<CasaConfiguradorRanking[]>([]);
  const [faixasAtivas, setFaixasAtivas] = useState<FaixaMercado[]>([]);
  const [valores, setValores] = useState(() => parseConfiguradorCasasValores(valorInicial));
  const [tabelaExpandida, setTabelaExpandida] = useState(false);

  const faixasColunas = useMemo(
    () => ORDEM_FAIXAS_MERCADO.filter((f) => faixasAtivas.includes(f)),
    [faixasAtivas],
  );

  const casasVisiveis = useMemo(() => {
    if (tabelaExpandida || casas.length <= CONFIGURADOR_CASAS_LINHAS_MINIMIZADO) return casas;
    return casas.slice(0, CONFIGURADOR_CASAS_LINHAS_MINIMIZADO);
  }, [casas, tabelaExpandida]);

  const ocultasCount = Math.max(0, casas.length - CONFIGURADOR_CASAS_LINHAS_MINIMIZADO);

  const recarregar = useCallback(async () => {
    const pid = processoId?.trim();
    const cid = cardId.trim();
    if (!pid || !cid) {
      setErro('Vincule um processo Step One ao card para carregar o ranking da Pré Batalha.');
      setCarregando(false);
      return;
    }
    setCarregando(true);
    setErro(null);
    const res = await carregarConfiguradorCasasChecklist(pid, cid);
    if (!res.ok) {
      setErro(res.error);
      setCasas([]);
      setFaixasAtivas([]);
      setCarregando(false);
      return;
    }
    setCasas(res.casas);
    setFaixasAtivas(res.faixasAtivas);
    setValores((prev) => {
      const base = mesclarValoresConfiguradorPorModelo(
        { v: 1, valores: { ...res.valores.valores, ...prev.valores } },
        res.casas,
      );
      return base;
    });
    setCarregando(false);
  }, [cardId, processoId]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  useEffect(() => {
    setValores(parseConfiguradorCasasValores(valorInicial));
  }, [valorInicial]);

  function valorCelula(chave: string, faixa: FaixaMercado): string {
    return valores.valores[chave]?.[faixa] ?? '';
  }

  async function atualizarValor(chave: string, faixa: FaixaMercado, raw: string) {
    const next = {
      v: 1 as const,
      valores: {
        ...valores.valores,
        [chave]: {
          ...valores.valores[chave],
          [faixa]: raw,
        },
      },
    };
    setValores(next);
    await onSave(serializeConfiguradorCasasValores(next));
  }

  const inputClass =
    'w-full min-w-[5.5rem] rounded-md border px-2 py-1 text-xs tabular-nums outline-none focus:ring-1' +
    ' bg-white border-[var(--moni-border-default)] text-[var(--moni-text-primary)]' +
    ' focus:ring-[var(--moni-primary-500)] focus:border-[var(--moni-primary-500)]';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
            {itemLabel}
            {obrigatorio && <span className="ml-1 text-red-500">*</span>}
            {salvando && <Loader2 size={10} className="ml-1 inline animate-spin" />}
          </p>
          <p className="mt-0.5 text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
            Uma linha por modelo e topografia, ordenada por quantidade de 1º, 2º, 3º, 4º… na Pré
            Batalha. Só é possível informar custo nas faixas em que o modelo pode ser ranqueado
            (regra por nome do modelo, independente da topografia). A tabela abre com as{' '}
            {CONFIGURADOR_CASAS_LINHAS_MINIMIZADO} primeiras linhas — expanda para ver todas.
          </p>
        </div>
        <a
          href={stepOneConfiguradorCasasHref()}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium"
          style={{
            borderColor: 'var(--moni-border-default)',
            color: 'var(--moni-text-secondary)',
            background: 'var(--moni-surface-100)',
          }}
        >
          Abrir configurador
          <ExternalLink size={12} />
        </a>
      </div>

      {carregando ? (
        <div
          className="flex items-center gap-2 py-6 text-xs"
          style={{ color: 'var(--moni-text-tertiary)' }}
        >
          <Loader2 size={14} className="animate-spin" />
          Carregando ranking da Pré Batalha…
        </div>
      ) : erro ? (
        <p className="text-xs text-red-600">{erro}</p>
      ) : casas.length === 0 ? (
        <p className="text-xs italic" style={{ color: 'var(--moni-text-tertiary)' }}>
          Nenhum modelo elegível na Pré Batalha. Conclua o mapa de competidores e a Pré Batalha
          antes de configurar as casas.
        </p>
      ) : (
        <div className="space-y-2">
        <div className="overflow-x-auto rounded-lg border border-stone-200">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/90 text-[11px] font-semibold uppercase tracking-wider text-stone-600">
                <th className="sticky left-0 z-10 bg-stone-50/95 px-3 py-2 text-left">#</th>
                <th className="sticky left-8 z-10 min-w-[7rem] bg-stone-50/95 px-3 py-2 text-left">
                  Modelo
                </th>
                <th className="min-w-[12rem] px-3 py-2 text-left">Colocações por faixa</th>
                <th className="px-3 py-2 text-center" title="1º lugares">
                  🥇
                </th>
                <th className="px-3 py-2 text-center" title="2º lugares">
                  🥈
                </th>
                <th className="px-3 py-2 text-center" title="3º lugares">
                  🥉
                </th>
                <th className="px-3 py-2 text-center" title="Colocações a partir do 4º">
                  4º+
                </th>
                {faixasColunas.map((faixa) => (
                  <th key={faixa} className="min-w-[6.5rem] px-2 py-2 text-right">
                    {labelFaixaMercado(faixa)}
                    <span className="mt-0.5 block text-[9px] font-normal normal-case text-stone-500">
                      Custo (R$)
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {casasVisiveis.map((casa, idx) => {
                const rowBg = classeDestaquePodioConfigurador(casa);
                const stickyBg =
                  casa.primeiros > 0
                    ? 'bg-amber-50/90'
                    : casa.segundos > 0
                      ? 'bg-stone-50/95'
                      : casa.terceiros > 0
                        ? 'bg-orange-50/50'
                        : 'bg-white';
                return (
                <tr
                  key={casa.chave}
                  className={`border-b border-stone-100 last:border-0 hover:bg-stone-50/80 ${rowBg}`}
                >
                  <td className={`sticky left-0 z-[1] px-3 py-2 text-xs tabular-nums text-stone-500 ${stickyBg}`}>
                    {String(idx + 1).padStart(2, '0')}
                  </td>
                  <td className={`sticky left-8 z-[1] px-3 py-2 font-medium text-stone-900 ${stickyBg}`}>
                    {casa.modelo}
                    <span className="mt-0.5 block text-[10px] font-normal capitalize text-stone-500">
                      {casa.topografia}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-stone-700">
                    {casa.colocacoesTop3.length > 0 ? (
                      <span className="font-medium text-stone-800">
                        {casa.colocacoesTop3
                          .sort((a, b) => a.posicao - b.posicao)
                          .map((c) => `${c.faixaLabel} (${c.posicao}º)`)
                          .join(', ')}
                      </span>
                    ) : null}
                    {casa.colocacoesOutras.length > 0 ? (
                      <span
                        className={
                          casa.colocacoesTop3.length > 0
                            ? 'mt-1 block text-stone-600'
                            : 'text-stone-700'
                        }
                      >
                        {casa.colocacoesOutras
                          .sort((a, b) => a.posicao - b.posicao)
                          .map((c) => `${c.faixaLabel} (${c.posicao}º)`)
                          .join(', ')}
                      </span>
                    ) : null}
                    {casa.colocacoesTop3.length === 0 && casa.colocacoesOutras.length === 0
                      ? '—'
                      : null}
                  </td>
                  <td className="px-3 py-2 text-center text-xs font-semibold tabular-nums text-amber-700">
                    {casa.primeiros || '—'}
                  </td>
                  <td className="px-3 py-2 text-center text-xs font-semibold tabular-nums text-stone-500">
                    {casa.segundos || '—'}
                  </td>
                  <td className="px-3 py-2 text-center text-xs font-semibold tabular-nums text-amber-900/70">
                    {casa.terceiros || '—'}
                  </td>
                  <td className="px-3 py-2 text-center text-xs tabular-nums text-stone-600">
                    {casa.demaisColocacoes || '—'}
                  </td>
                  {faixasColunas.map((faixa) => {
                    const elegivelFaixa = modeloElegivelParaFaixa(casa.modelo, faixa);
                    if (!elegivelFaixa) {
                      return (
                        <td
                          key={faixa}
                          className="px-2 py-1.5 text-center text-xs text-stone-400"
                          title="Modelo não ranqueável nesta faixa"
                        >
                          —
                        </td>
                      );
                    }
                    const colocou = casa.faixasComColocacao.includes(faixa);
                    return (
                      <td key={faixa} className="px-2 py-1.5">
                        <input
                          type="text"
                          inputMode="decimal"
                          className={
                            inputClass +
                            (colocou ? '' : ' opacity-60') +
                            (!podeEditar ? ' cursor-not-allowed bg-stone-50' : '')
                          }
                          placeholder="0,00"
                          disabled={!podeEditar}
                          value={valorCelula(casa.chave, faixa)}
                          onChange={(e) => {
                            if (!podeEditar) return;
                            const raw = e.target.value;
                            setValores((prev) => ({
                              v: 1,
                              valores: {
                                ...prev.valores,
                                [casa.chave]: {
                                  ...prev.valores[casa.chave],
                                  [faixa]: raw,
                                },
                              },
                            }));
                          }}
                          onBlur={(e) => {
                            if (!podeEditar) return;
                            void atualizarValor(casa.chave, faixa, e.target.value.trim());
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
        {ocultasCount > 0 ? (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setTabelaExpandida((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
            >
              {tabelaExpandida ? (
                <>
                  <ChevronsUp size={14} aria-hidden />
                  Minimizar tabela
                </>
              ) : (
                <>
                  <ChevronsDown size={14} aria-hidden />
                  Mostrar todas ({casas.length} linhas — +{ocultasCount} ocultas)
                </>
              )}
            </button>
          </div>
        ) : null}
        </div>
      )}
    </div>
  );
}
