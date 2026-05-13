'use client';

import { useState } from 'react';
import { saveEtapa1, fetchAndSaveDadosIbgeEtapa1 } from './actions';
import type { MunicipioIbge } from '@/lib/ibge';

interface Etapa1FormProps {
  processoId: string;
  cidade: string;
  estado: string | null;
  initialNarrativa: string;
  initialAnaliseIbge: unknown;
  initialConcluida: boolean;
}

export function Etapa1Form({
  processoId,
  cidade,
  estado,
  initialNarrativa,
  initialAnaliseIbge,
  initialConcluida,
}: Etapa1FormProps) {
  const [narrativa, setNarrativa] = useState(initialNarrativa);
  const [analiseIbge, setAnaliseIbge] = useState<MunicipioIbge | null>(
    (initialAnaliseIbge as MunicipioIbge | null) ?? null,
  );
  const [concluida, setConcluida] = useState(initialConcluida);
  const [loading, setLoading] = useState(false);
  const [loadingIbge, setLoadingIbge] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await saveEtapa1(processoId, { narrativa, concluida });
    setLoading(false);
    if (result.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      setError(result.error);
    }
  };

  const handleBuscarIbge = async () => {
    if (!cidade.trim()) {
      setError('Informe a cidade do processo para buscar dados do IBGE.');
      return;
    }
    setError('');
    setLoadingIbge(true);
    const result = await fetchAndSaveDadosIbgeEtapa1(processoId, cidade.trim(), estado);
    setLoadingIbge(false);
    if (result.ok && result.data) {
      setAnaliseIbge(result.data);
    } else if (!result.ok) {
      setError(result.error);
    } else {
      setError('Erro ao buscar dados do IBGE.');
    }
  };

  return (
    <div className="mt-6 space-y-6">
      <div>
        <p className="text-sm text-stone-600">
          Praça:{' '}
          <strong>
            {cidade}
            {estado ? `, ${estado}` : ''}
          </strong>
        </p>
      </div>

      {/* Dados automáticos — IBGE */}
      <section className="rounded-lg border border-stone-200 bg-stone-50/80 p-4">
        <h3 className="font-medium text-stone-800">Dados automáticos (IBGE)</h3>
        <p className="mt-1 text-xs text-stone-500">
          Limites, divisão administrativa e regiões oficiais. Clique para carregar.
        </p>
        <button
          type="button"
          onClick={handleBuscarIbge}
          disabled={loadingIbge}
          className="mt-2 rounded-lg bg-stone-700 px-3 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-60"
        >
          {loadingIbge ? 'Buscando…' : 'Buscar dados do IBGE'}
        </button>
        {analiseIbge && (
          <div className="mt-3 rounded border border-stone-200 bg-white p-3 text-sm text-stone-700">
            <p>
              <strong>Município:</strong> {analiseIbge.nome} (ID {analiseIbge.id})
            </p>
            <p>
              <strong>UF:</strong> {analiseIbge.uf?.nome} ({analiseIbge.uf?.sigla})
            </p>
            <p>
              <strong>Região:</strong> {analiseIbge.regiao?.nome} ({analiseIbge.regiao?.sigla})
            </p>
            <p>
              <strong>Microrregião:</strong> {analiseIbge.microrregiao?.nome}
            </p>
            <p>
              <strong>Mesorregião:</strong> {analiseIbge.mesorregiao?.nome}
            </p>
            <p>
              <strong>Região imediata:</strong> {analiseIbge['regiao-imediata']?.nome}
            </p>
            <p>
              <strong>Região intermediária:</strong> {analiseIbge['regiao-intermediaria']?.nome}
            </p>
          </div>
        )}
      </section>

      {/* Atlas Brasil e Google Maps — em breve */}
      <section className="rounded-lg border border-amber-100 bg-amber-50/50 p-4">
        <h3 className="font-medium text-amber-900">Dados automáticos — outras fontes (em breve)</h3>
        <p className="mt-1 text-xs text-amber-800">
          A análise de praça passará a trazer dados automáticos destas fontes:
        </p>
        <ul className="mt-2 space-y-1 text-sm text-amber-800">
          <li>
            <strong>IBGE</strong> — já integrado acima (limites, regiões).
          </li>
          <li>
            <strong>Atlas Brasil (PNUD):</strong> demografia, IDHM, indicadores municipais —
            integração prevista.
          </li>
          <li>
            <strong>Google Maps / Places:</strong> parques, comércio, shoppings, eixos — exige
            configuração de API key.
          </li>
        </ul>
      </section>

      {/* Referência de imagens — em breve */}
      <section className="rounded-lg border border-sky-100 bg-sky-50/50 p-4">
        <h3 className="font-medium text-sky-900">Referência de imagens mapeadas (em breve)</h3>
        <p className="mt-1 text-xs text-sky-800">
          A ferramenta trará referência de imagens com todos os elementos urbanos mapeados para a
          praça:
        </p>
        <ul className="mt-2 grid list-inside list-disc grid-cols-1 gap-x-4 gap-y-1 text-sm text-sky-800 sm:grid-cols-2">
          <li>Escolas</li>
          <li>Hospitais</li>
          <li>Principais eixos</li>
          <li>Regiões mapeadas por renda</li>
          <li>Praças</li>
          <li>Shoppings</li>
          <li>Parques</li>
          <li>Demais elementos urbanos mapeados</li>
        </ul>
        <p className="mt-2 text-xs text-sky-700">
          Fontes previstas: Atlas Brasil, Google Maps e bases oficiais. Integração em
          desenvolvimento.
        </p>
      </section>

      {/* Narrativa */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="narrativa" className="block text-sm font-medium text-stone-700">
            Análise da praça (narrativa)
          </label>
          <p className="mt-1 text-xs text-stone-500">
            Use os dados automáticos acima e complemente com sua análise: parques, áreas nobres,
            regiões de alimentação, shoppings, eixo de expansão.
          </p>
          <textarea
            id="narrativa"
            value={narrativa}
            onChange={(e) => setNarrativa(e.target.value)}
            rows={8}
            className="mt-2 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
            placeholder="Digite aqui a análise da praça..."
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="concluida"
            checked={concluida}
            onChange={(e) => setConcluida(e.target.checked)}
            className="h-4 w-4 rounded border-stone-300 text-moni-accent focus:ring-moni-accent"
          />
          <label htmlFor="concluida" className="text-sm text-stone-700">
            Marcar etapa 1 como concluída
          </label>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-green-600">Salvo com sucesso.</p>}
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Salvando…' : 'Salvar'}
        </button>
      </form>
    </div>
  );
}
