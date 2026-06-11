'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { carregarConfiguradorCasasChecklist } from '@/lib/actions/kanban-configurador-casas';
import {
  labelFaixaMercado,
  ORDEM_FAIXAS_MERCADO,
  type FaixaMercado,
} from '@/lib/kanban/mapa-competidores-condominio';
import {
  parseConfiguradorCasasValores,
  serializeConfiguradorCasasValores,
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

  const faixasColunas = useMemo(
    () => ORDEM_FAIXAS_MERCADO.filter((f) => faixasAtivas.includes(f)),
    [faixasAtivas],
  );

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
      const merged = { ...res.valores.valores };
      for (const [chave, faixas] of Object.entries(prev.valores)) {
        merged[chave] = { ...merged[chave], ...faixas };
      }
      return { v: 1, valores: merged };
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
            Modelos únicos da Pré Batalha, ordenados por pódios (1º → 2º → 3º). Preencha o custo
            do configurador Moní em cada faixa aplicável.
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
        <div className="overflow-x-auto rounded-lg border border-stone-200">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/90 text-[11px] font-semibold uppercase tracking-wider text-stone-600">
                <th className="sticky left-0 z-10 bg-stone-50/95 px-3 py-2 text-left">#</th>
                <th className="sticky left-8 z-10 min-w-[7rem] bg-stone-50/95 px-3 py-2 text-left">
                  Modelo
                </th>
                <th className="min-w-[10rem] px-3 py-2 text-left">Faixas (até 3º)</th>
                <th className="px-3 py-2 text-center" title="1º lugares">
                  🥇
                </th>
                <th className="px-3 py-2 text-center" title="2º lugares">
                  🥈
                </th>
                <th className="px-3 py-2 text-center" title="3º lugares">
                  🥉
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
              {casas.map((casa, idx) => (
                <tr
                  key={casa.chave}
                  className="border-b border-stone-100 last:border-0 bg-white hover:bg-stone-50/80"
                >
                  <td className="sticky left-0 z-[1] bg-white px-3 py-2 text-xs tabular-nums text-stone-500">
                    {String(idx + 1).padStart(2, '0')}
                  </td>
                  <td className="sticky left-8 z-[1] bg-white px-3 py-2 font-medium text-stone-900">
                    {casa.rotulo}
                  </td>
                  <td className="px-3 py-2 text-xs text-stone-700">{casa.descricaoColocacoes}</td>
                  <td className="px-3 py-2 text-center text-xs font-semibold tabular-nums text-amber-700">
                    {casa.primeiros || '—'}
                  </td>
                  <td className="px-3 py-2 text-center text-xs font-semibold tabular-nums text-stone-500">
                    {casa.segundos || '—'}
                  </td>
                  <td className="px-3 py-2 text-center text-xs font-semibold tabular-nums text-amber-900/70">
                    {casa.terceiros || '—'}
                  </td>
                  {faixasColunas.map((faixa) => {
                    const colocou = casa.colocacoesTop3.some((c) => c.faixa === faixa);
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
