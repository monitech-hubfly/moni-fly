'use client';

import { useEffect, useState } from 'react';

type DadosCidade = {
  populacao: string | null;
  pibPerCapita: string | null;
  rendaMedia: string | null;
  areaTerritorial: string | null;
  densidade: string | null;
};

type Props = {
  cidade: string;
  estado: string | null;
  /** Exibe título "Seção 1 — Dados da cidade" (padrão step-one legado). */
  showHeading?: boolean;
};

export function DadosCidadeIbgeSecao({ cidade, estado, showHeading = true }: Props) {
  const [dadosCidade, setDadosCidade] = useState<DadosCidade | null>(null);
  const [loadingDados, setLoadingDados] = useState(true);
  const [errorDados, setErrorDados] = useState('');

  useEffect(() => {
    if (!cidade.trim()) {
      setLoadingDados(false);
      setDadosCidade(null);
      return;
    }
    setLoadingDados(true);
    setErrorDados('');
    const params = new URLSearchParams({ cidade: cidade.trim() });
    if (estado?.trim()) params.set('estado', estado.trim());
    fetch(`/api/etapa1/dados-cidade?${params.toString()}`)
      .then((res) => res.json())
      .then((data: DadosCidade & { error?: string }) => {
        if (data.error) {
          setErrorDados(data.error);
          setDadosCidade(null);
        } else {
          setDadosCidade({
            populacao: data.populacao ?? null,
            pibPerCapita: data.pibPerCapita ?? null,
            rendaMedia: data.rendaMedia ?? null,
            areaTerritorial: data.areaTerritorial ?? null,
            densidade: data.densidade ?? null,
          });
        }
      })
      .catch(() => {
        setErrorDados('Erro ao carregar dados da cidade.');
        setDadosCidade(null);
      })
      .finally(() => setLoadingDados(false));
  }, [cidade, estado]);

  if (!cidade.trim()) {
    return (
      <p className="text-sm italic text-stone-500">
        Informe cidade e estado no processo para carregar os indicadores IBGE.
      </p>
    );
  }

  const compact = !showHeading;
  const labelClass = compact
    ? 'text-[10px] font-medium uppercase text-stone-500'
    : 'text-xs font-medium uppercase text-stone-500';
  const valueClass = compact
    ? 'mt-0.5 text-sm font-semibold text-stone-800'
    : 'mt-1 text-xl font-semibold text-stone-800';
  const cardClass = compact
    ? 'rounded-lg border border-stone-200 bg-white p-2 shadow-sm'
    : 'rounded-lg border border-stone-200 bg-white p-3 shadow-sm';

  return (
    <section className="rounded-xl border border-stone-200 bg-stone-50/80 p-4">
      {showHeading ? (
        <h2 className="text-lg font-semibold text-stone-800">Seção 1 — Dados da cidade</h2>
      ) : null}
      {errorDados ? <p className={`text-sm text-red-600 ${showHeading ? 'mt-3' : ''}`}>{errorDados}</p> : null}
      <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-5 ${showHeading ? 'mt-4' : 'mt-1'}`}>
        <div className={cardClass}>
          <p className={labelClass}>População</p>
          <p className={valueClass}>
            {loadingDados ? 'Carregando...' : dadosCidade?.populacao?.trim() || 'Dado não disponível'}
          </p>
        </div>
        <div className={cardClass}>
          <p className={labelClass}>PIB per capita</p>
          <p className={valueClass}>
            {loadingDados ? 'Carregando...' : dadosCidade?.pibPerCapita?.trim() || 'Dado não disponível'}
          </p>
        </div>
        <div className={cardClass}>
          <p className={labelClass}>Renda média domiciliar</p>
          <p className={valueClass}>
            {loadingDados ? 'Carregando...' : dadosCidade?.rendaMedia?.trim() || 'Dado não disponível'}
          </p>
        </div>
        <div className={cardClass}>
          <p className={labelClass}>Área territorial</p>
          <p className={valueClass}>
            {loadingDados ? 'Carregando...' : dadosCidade?.areaTerritorial?.trim() || 'Dado não disponível'}
          </p>
        </div>
        <div className={cardClass}>
          <p className={labelClass}>Densidade demográfica</p>
          <p className={valueClass}>
            {loadingDados ? 'Carregando...' : dadosCidade?.densidade?.trim() || 'Dado não disponível'}
          </p>
        </div>
      </div>
    </section>
  );
}
