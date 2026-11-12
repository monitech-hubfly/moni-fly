'use client';

import { useState } from 'react';
import { DocumentArrowDownIcon, BookOpenIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

export type CondominioOpcaoLivro = {
  id: string;
  nome: string;
  cidade: string | null;
  estado: string | null;
};

const MODELOS_CASA = [
  { codigo: 'ALE',  nome: 'ALÊ',  area: '47,0 m²',    suites: 2, banheiros: 1, dimensoes: '3,50 × 12,00 m', preco: 'R$ 288.553,20' },
  { codigo: 'DUDA', nome: 'DUDA', area: '103,0 m²',   suites: 3, banheiros: 2, dimensoes: '9,00 × 13,00 m', preco: 'R$ 533.937,05' },
  { codigo: 'LU',   nome: 'LU',   area: '191,5 m²',   suites: 3, banheiros: 3, dimensoes: '12,20 × 19 m',   preco: 'R$ 1.151.798,00' },
  { codigo: 'ISA',  nome: 'ISA',  area: '237,1 m²',   suites: 3, banheiros: 4, dimensoes: '8 × 17 m',       preco: 'R$ 1.352.110,00' },
  { codigo: 'LIZ',  nome: 'LIZ',  area: '234,2 m²',   suites: 4, banheiros: 5, dimensoes: '10,5 × 21 m',   preco: 'R$ 1.687.745,00' },
  { codigo: 'VAL',  nome: 'VAL',  area: '360,5 m²',   suites: 4, banheiros: 4, dimensoes: '10 × 20 m',      preco: 'R$ 1.747.719,00' },
  { codigo: 'IVY',  nome: 'IVY',  area: '305,9 m²',   suites: 4, banheiros: 5, dimensoes: '10 × 17 m',      preco: 'R$ 1.925.960,00' },
  { codigo: 'EVA',  nome: 'EVA',  area: '369,6 m²',   suites: 4, banheiros: 5, dimensoes: '10 × 20 m',      preco: 'R$ 2.330.656,00' },
  { codigo: 'CISSA',nome: 'CISSA',area: '425,0 m²',   suites: 4, banheiros: 5, dimensoes: '11 × 35 m',      preco: 'R$ 2.408.889,00' },
  { codigo: 'SOL',  nome: 'SOL',  area: '339,6 m²',   suites: 4, banheiros: 5, dimensoes: '10 × 21 m',      preco: 'R$ 2.529.190,00' },
  { codigo: 'GAL',  nome: 'GAL',  area: '393,5 m²',   suites: 4, banheiros: 5, dimensoes: '11,60 × 20 m',   preco: 'R$ 2.639.884,00' },
  { codigo: 'LENA', nome: 'LENA', area: '708,3 m²',   suites: 6, banheiros: 8, dimensoes: '24 × 42 m',      preco: 'R$ 3.527.092,00' },
];

export function BookDoEmpreendimentoGerador({
  condominios,
}: {
  condominios: CondominioOpcaoLivro[];
}) {
  const [modeloSelecionado, setModeloSelecionado] = useState<string | null>(null);
  const [condominioId, setCondominioId] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const modelo = MODELOS_CASA.find((m) => m.codigo === modeloSelecionado);

  async function handleGerar() {
    if (!modeloSelecionado || !condominioId) return;
    setGerando(true);
    setErro(null);
    try {
      const site = siteUrl.trim();
      if (site) {
        const scrape = await fetch('/api/livro-empreendimento/scrape-condominio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ condominio_id: condominioId, site_url: site }),
        });
        const scrapeData = await scrape.json().catch(() => ({})) as { error?: string };
        if (!scrape.ok) {
          throw new Error(scrapeData.error ?? 'Não foi possível ler o site do condomínio');
        }
      }

      const res = await fetch('/api/livro-empreendimento/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ casa_codigo: modeloSelecionado, condominio_id: condominioId }),
      });

      const data = await res.json().catch(() => ({})) as { url?: string; error?: string };

      if (!res.ok) {
        throw new Error(data.error ?? 'Erro ao gerar o book');
      }

      if (!data.url) {
        throw new Error('URL do PDF não retornada pela API');
      }

      // Abre o PDF em nova aba — o signed URL do Storage permite download direto
      const a = document.createElement('a');
      a.href = data.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.download = `book-empreendimento-${modeloSelecionado}-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro desconhecido');
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--moni-surface-50)]">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-xs text-stone-400">
          <Link href="/apresentacoes" className="hover:text-[var(--moni-primary)]">
            Apresentações
          </Link>
          <span>/</span>
          <span className="text-stone-600">Book do Empreendimento</span>
        </div>

        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--moni-navy-800)]">
            <BookOpenIcon className="h-5 w-5 text-white" aria-hidden />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[var(--moni-navy-800)]">Book do Empreendimento</h1>
            <p className="text-sm text-stone-500">Selecione a casa e o condomínio. As folhas 2 e 3 saem dos dados do condomínio.</p>
          </div>
        </div>

        {/* Seletor de modelo */}
        <div className="mb-6 rounded-xl border border-[var(--moni-border)] bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-[var(--moni-navy-800)]">Modelo de casa</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {MODELOS_CASA.map((m) => (
              <button
                key={m.codigo}
                type="button"
                onClick={() => setModeloSelecionado(m.codigo)}
                className={`flex flex-col rounded-lg border p-3 text-left transition ${
                  modeloSelecionado === m.codigo
                    ? 'border-[var(--moni-navy-800)] bg-[var(--moni-navy-800)] text-white'
                    : 'border-[var(--moni-border)] bg-white text-[var(--moni-navy-800)] hover:border-[var(--moni-navy-800)] hover:bg-[var(--moni-light)]'
                }`}
              >
                <span className="text-sm font-bold">{m.nome}</span>
                <span className={`text-[11px] ${modeloSelecionado === m.codigo ? 'text-white/70' : 'text-stone-400'}`}>
                  {m.area} · {m.suites} suítes
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-[var(--moni-border)] bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-[var(--moni-navy-800)]">Condomínio</h2>
          <label className="mb-1 block text-xs text-stone-400" htmlFor="condominio-livro">
            Empreendimento das folhas 2 e 3
          </label>
          <select
            id="condominio-livro"
            value={condominioId}
            onChange={(event) => setCondominioId(event.target.value)}
            className="min-h-11 w-full rounded-lg border border-[var(--moni-border)] bg-white px-3 text-sm text-[var(--moni-navy-800)]"
          >
            <option value="">Selecione o condomínio</option>
            {condominios.map((condominio) => {
              const local = [condominio.cidade, condominio.estado].filter(Boolean).join(' / ');
              return (
                <option key={condominio.id} value={condominio.id}>
                  {local ? `${condominio.nome} — ${local}` : condominio.nome}
                </option>
              );
            })}
          </select>
          <label className="mb-1 mt-4 block text-xs text-stone-400" htmlFor="site-condominio">
            Site do condomínio
          </label>
          <input
            id="site-condominio"
            type="url"
            inputMode="url"
            placeholder="https://siteDoCondominio.com.br"
            value={siteUrl}
            onChange={(event) => setSiteUrl(event.target.value)}
            className="min-h-11 w-full rounded-lg border border-[var(--moni-border)] px-3 text-sm text-[var(--moni-navy-800)]"
          />
          <p className="mt-2 text-xs text-stone-400">
            Com a URL, a foto, a frase e as vantagens entram no PDF. Sem ela, as folhas usam nome, cidade e a descrição já cadastrada.
          </p>
        </div>

        {/* Resumo do modelo selecionado */}
        {modelo && (
          <div className="mb-6 rounded-xl border border-[var(--moni-border)] bg-white p-6 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-[var(--moni-navy-800)]">Resumo — Casa {modelo.nome}</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
              <div>
                <span className="text-xs text-stone-400">Área total</span>
                <p className="font-medium text-[var(--moni-navy-800)]">{modelo.area}</p>
              </div>
              <div>
                <span className="text-xs text-stone-400">Suítes</span>
                <p className="font-medium text-[var(--moni-navy-800)]">{modelo.suites}</p>
              </div>
              <div>
                <span className="text-xs text-stone-400">Banheiros</span>
                <p className="font-medium text-[var(--moni-navy-800)]">{modelo.banheiros}</p>
              </div>
              <div>
                <span className="text-xs text-stone-400">Dimensões</span>
                <p className="font-medium text-[var(--moni-navy-800)]">{modelo.dimensoes}</p>
              </div>
            </div>
            <div className="mt-3 border-t border-stone-100 pt-3">
              <span className="text-xs text-stone-400">Preço base</span>
              <p className="text-base font-semibold text-[var(--moni-gold-600)]">{modelo.preco}</p>
            </div>
          </div>
        )}

        {/* Erro */}
        {erro && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {erro}
          </div>
        )}

        {/* Botão gerar */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleGerar}
            disabled={!modeloSelecionado || !condominioId || gerando}
            className="flex items-center gap-2 rounded-lg bg-[var(--moni-navy-800)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--moni-secondary)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <DocumentArrowDownIcon className="h-4 w-4 shrink-0" aria-hidden />
            {gerando ? 'Gerando PDF…' : 'Gerar Book em PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}
