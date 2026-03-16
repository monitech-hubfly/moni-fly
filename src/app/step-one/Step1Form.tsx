'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createProcesso } from './actions';
import { UFS_BRASIL } from '@/lib/uf';

type CidadeIBGE = {
  id: number;
  nome: string;
};

export default function Step1Form() {
  const router = useRouter();
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [cidades, setCidades] = useState<CidadeIBGE[]>([]);
  const [buscaCidade, setBuscaCidade] = useState('');
  const [loadingCidades, setLoadingCidades] = useState(false);
  const [errorCidades, setErrorCidades] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!estado) {
      setCidades([]);
      setBuscaCidade('');
      setCidade('');
      setErrorCidades('');
      return;
    }

    const controller = new AbortController();
    const fetchCidades = async () => {
      try {
        setLoadingCidades(true);
        setErrorCidades('');
        const url = `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${estado}/municipios`;
        console.log('[step1] Fetch cidades IBGE:', url);
        const res = await fetch(url, { signal: controller.signal });
        console.log('[step1] Cidades status:', res.status);
        if (!res.ok) {
          throw new Error(`IBGE retornou ${res.status}`);
        }
        const lista = (await res.json()) as CidadeIBGE[];
        setCidades(Array.isArray(lista) ? lista : []);
        setBuscaCidade('');
        setCidade('');
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        console.log('[step1] Erro ao buscar cidades:', e);
        setErrorCidades('Não foi possível carregar a lista de cidades para este estado.');
        setCidades([]);
      } finally {
        setLoadingCidades(false);
      }
    };

    fetchCidades();

    return () => controller.abort();
  }, [estado]);

  const handleIniciar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cidade.trim()) return;
    setError('');
    setLoading(true);
    const result = await createProcesso(cidade.trim(), estado.trim());
    setLoading(false);
    if (result.ok) {
      router.push(`/step-one/${result.id}`);
      router.refresh();
    } else {
      setError(result.error);
    }
  };

  const cidadesFiltradas = buscaCidade.trim()
    ? cidades.filter((c) => c.nome.toLowerCase().includes(buscaCidade.trim().toLowerCase()))
    : cidades;

  return (
    <>
      <h1 className="moni-heading text-2xl">Iniciar Processo Step 1</h1>
      <p className="mt-2 text-stone-600">
        O Step 1 é o banco de informações por região/condomínio. Você aplica as etapas 1 a 5
        (análise da praça, condomínios, resumo, lotes e listagem de casas) e salva para usar no Step
        2.
      </p>
      <form onSubmit={handleIniciar} className="mt-8 space-y-4">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div>
            <label htmlFor="estado" className="block text-sm font-medium text-stone-700">
              Estado (UF)
            </label>
            <select
              id="estado"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="mt-1 w-full max-w-[280px] rounded-lg border border-stone-300 px-3 py-2 focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
            >
              <option value="">— Selecione o estado —</option>
              {UFS_BRASIL.map((uf) => (
                <option key={uf.sigla} value={uf.sigla}>
                  {uf.sigla} — {uf.nome}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-stone-500">
              Necessário para buscar dados do IBGE na Etapa 1.
            </p>
          </div>
          <div>
            <label htmlFor="cidade" className="block text-sm font-medium text-stone-700">
              Cidade *
            </label>
            <div className="mt-1 space-y-2">
              <input
                id="cidade-busca"
                type="text"
                value={buscaCidade}
                onChange={(e) => setBuscaCidade(e.target.value)}
                placeholder={estado ? 'Pesquisar cidade...' : 'Selecione primeiro o estado'}
                disabled={!estado || loadingCidades}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent disabled:bg-stone-100 disabled:text-stone-400"
              />
              <select
                id="cidade"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                disabled={!estado || loadingCidades || cidadesFiltradas.length === 0}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent disabled:bg-stone-100 disabled:text-stone-400"
                required
              >
                <option value="">
                  {loadingCidades
                    ? 'Carregando cidades...'
                    : !estado
                      ? 'Selecione primeiro o estado'
                      : cidadesFiltradas.length === 0
                        ? 'Nenhuma cidade encontrada para este filtro'
                        : 'Selecione a cidade'}
                </option>
                {cidadesFiltradas.map((c) => (
                  <option key={c.id} value={c.nome}>
                    {c.nome}
                  </option>
                ))}
              </select>
              {errorCidades && <p className="text-xs text-red-600">{errorCidades}</p>}
            </div>
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="pt-4">
          <button type="submit" disabled={loading} className="btn-primary w-full sm:w-auto">
            {loading ? 'Criando…' : 'Iniciar processo'}
          </button>
        </div>
      </form>
    </>
  );
}
