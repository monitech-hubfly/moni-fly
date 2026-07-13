'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChevronDown, Search, Eye, Clock, Star, LifeBuoy, AlertCircle, X } from 'lucide-react';
import type { FaqArticleView, FaqCategory } from '@/lib/faq/types';
import { buscarArtigos, realceSegmentos } from '@/lib/faq/search';
import { incrementarViewFaq, registrarBuscaFaq } from '@/lib/faq/actions';

const PROSE =
  'max-w-none space-y-3 text-sm leading-relaxed text-stone-800 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:text-[15px] [&_h2]:font-semibold [&_h2]:text-stone-900 [&_h2:first-child]:mt-0 [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5';

type Props = {
  categorias: FaqCategory[];
  artigos: FaqArticleView[];
  erro?: boolean;
};

function Realce({ texto, termo }: { texto: string; termo: string }) {
  if (!termo.trim()) return <>{texto}</>;
  const segs = realceSegmentos(texto, termo);
  return (
    <>
      {segs.map((s, i) =>
        s.match ? (
          <mark key={i} className="rounded bg-amber-100 px-0.5 text-stone-900">
            {s.texto}
          </mark>
        ) : (
          <span key={i}>{s.texto}</span>
        ),
      )}
    </>
  );
}

export function FaqClient({ categorias, artigos, erro }: Props) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [catAtiva, setCatAtiva] = useState<string | null>(null); // slug da categoria
  const [aberto, setAberto] = useState<string | null>(null); // id do artigo aberto no accordion
  const viewsRegistradas = useRef<Set<string>>(new Set());

  // debounce da busca
  useEffect(() => {
    setCarregando(true);
    const t = setTimeout(() => {
      setDebounced(query);
      setCarregando(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const buscando = debounced.trim().length >= 2;

  const resultados = useMemo(() => {
    if (!buscando) return null;
    return buscarArtigos(artigos, debounced).map((r) => r.artigo);
  }, [artigos, debounced, buscando]);

  // registra a busca (métrica independente)
  useEffect(() => {
    if (!buscando) return;
    const count = resultados?.length ?? 0;
    void registrarBuscaFaq(debounced, count);
  }, [debounced, buscando, resultados]);

  const destaques = useMemo(() => artigos.filter((a) => a.is_featured).slice(0, 6), [artigos]);
  const maisAcessadas = useMemo(
    () => [...artigos].sort((a, b) => b.view_count - a.view_count).filter((a) => a.view_count > 0).slice(0, 5),
    [artigos],
  );
  const recentes = useMemo(
    () =>
      [...artigos]
        .sort((a, b) => String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? '')))
        .slice(0, 5),
    [artigos],
  );

  const listaBase = useMemo(() => {
    if (buscando) return resultados ?? [];
    if (catAtiva) return artigos.filter((a) => a.category_slug === catAtiva);
    return artigos;
  }, [buscando, resultados, catAtiva, artigos]);

  const contagemPorCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of artigos) {
      if (!a.category_slug) continue;
      m.set(a.category_slug, (m.get(a.category_slug) ?? 0) + 1);
    }
    return m;
  }, [artigos]);

  function abrir(id: string) {
    setAberto((cur) => {
      const novo = cur === id ? null : id;
      if (novo && !viewsRegistradas.current.has(novo)) {
        viewsRegistradas.current.add(novo);
        void incrementarViewFaq(novo);
      }
      return novo;
    });
  }

  const chamadoHref = '/sirene';

  if (erro) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="flex flex-col items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <AlertCircle className="h-8 w-8 text-red-600" aria-hidden />
          <p className="text-sm font-medium text-red-800">Não foi possível carregar a FAQ agora.</p>
          <p className="text-sm text-red-700">Tente recarregar a página. Se o problema persistir, abra um chamado.</p>
          <Link href={chamadoHref} className="mt-2 rounded-lg bg-moni-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            Abrir chamado
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">FAQ da Universidade Moní</h1>
        <p className="mt-1 max-w-2xl text-sm text-stone-600">
          Encontre respostas rápidas sobre o modelo Casa Moní, processos, documentos, ferramentas e operação da sua
          unidade.
        </p>
      </header>

      {/* Busca em destaque */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Digite uma pergunta ou assunto. Ex.: ITBI, permuta, BCA, crédito, obra..."
          className="w-full rounded-xl border border-stone-300 bg-white py-3.5 pl-12 pr-11 text-sm text-stone-900 shadow-sm outline-none placeholder:text-stone-400 focus:border-moni-primary focus:ring-2 focus:ring-moni-primary/20"
          aria-label="Buscar na FAQ"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            aria-label="Limpar busca"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>

      {/* Estado inicial: categorias + destaques + listas auxiliares */}
      {!buscando ? (
        <>
          <section aria-labelledby="cats-heading" className="space-y-3">
            <h2 id="cats-heading" className="text-sm font-semibold text-stone-800">
              Categorias
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCatAtiva(null)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  catAtiva === null ? 'bg-moni-primary text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                Todas ({artigos.length})
              </button>
              {categorias.map((c) => {
                const n = contagemPorCat.get(c.slug) ?? 0;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCatAtiva(c.slug)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      catAtiva === c.slug ? 'bg-moni-primary text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                    title={c.description ?? undefined}
                  >
                    {c.name} {n > 0 ? `(${n})` : ''}
                  </button>
                );
              })}
            </div>
          </section>

          {catAtiva === null && destaques.length > 0 ? (
            <section aria-labelledby="destaques-heading" className="space-y-3">
              <h2 id="destaques-heading" className="flex items-center gap-2 text-sm font-semibold text-stone-800">
                <Star className="h-4 w-4 text-amber-500" aria-hidden /> Perguntas em destaque
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {destaques.map((a) => (
                  <Link
                    key={a.id}
                    href={`/universidade/faq/${a.slug}`}
                    className="flex flex-col rounded-xl border border-stone-200 bg-white p-4 text-left shadow-sm transition hover:shadow-md"
                  >
                    <span className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
                      {a.category_name ?? 'Geral'}
                    </span>
                    <span className="mt-1 text-sm font-semibold leading-snug text-stone-900">{a.question}</span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {catAtiva === null && (maisAcessadas.length > 0 || recentes.length > 0) ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {maisAcessadas.length > 0 ? (
                <section className="space-y-2">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-800">
                    <Eye className="h-4 w-4 text-stone-500" aria-hidden /> Mais acessadas
                  </h2>
                  <ul className="space-y-1.5">
                    {maisAcessadas.map((a) => (
                      <li key={a.id}>
                        <Link href={`/universidade/faq/${a.slug}`} className="text-sm text-moni-primary hover:underline">
                          {a.question}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              <section className="space-y-2">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-800">
                  <Clock className="h-4 w-4 text-stone-500" aria-hidden /> Atualizadas recentemente
                </h2>
                <ul className="space-y-1.5">
                  {recentes.map((a) => (
                    <li key={a.id}>
                      <Link href={`/universidade/faq/${a.slug}`} className="text-sm text-moni-primary hover:underline">
                        {a.question}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          ) : null}
        </>
      ) : null}

      {/* Contador de resultados / carregando */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-stone-500" aria-live="polite">
          {carregando
            ? 'Buscando…'
            : buscando
              ? `${listaBase.length} resultado${listaBase.length === 1 ? '' : 's'} para “${debounced}”`
              : catAtiva
                ? `${listaBase.length} pergunta${listaBase.length === 1 ? '' : 's'} nesta categoria`
                : `${listaBase.length} pergunta${listaBase.length === 1 ? '' : 's'} no total`}
        </p>
      </div>

      {/* Lista (accordion) */}
      {listaBase.length === 0 && !carregando ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-stone-300 bg-stone-50 p-10 text-center">
          <p className="text-sm font-medium text-stone-700">Nenhuma pergunta encontrada para “{debounced}”.</p>
          <p className="text-sm text-stone-500">Tente outros termos ou abra um chamado para falar com o time Moní.</p>
          <Link href={chamadoHref} className="mt-1 inline-flex items-center gap-2 rounded-lg bg-moni-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            <LifeBuoy className="h-4 w-4" aria-hidden /> Abrir chamado
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {listaBase.map((a) => {
            const ativo = aberto === a.id;
            return (
              <li key={a.id} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                <button
                  type="button"
                  onClick={() => abrir(a.id)}
                  className="flex w-full items-start justify-between gap-3 p-4 text-left hover:bg-stone-50"
                  aria-expanded={ativo}
                >
                  <span className="min-w-0 flex-1">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
                      {a.category_name ?? 'Geral'}
                    </span>
                    <span className="mt-0.5 block text-sm font-semibold text-stone-900">
                      <Realce texto={a.question} termo={buscando ? debounced : ''} />
                    </span>
                    {!ativo && a.short_answer ? (
                      <span className="mt-1 block line-clamp-2 text-xs text-stone-500">{a.short_answer}</span>
                    ) : null}
                  </span>
                  <ChevronDown
                    className={`mt-0.5 h-5 w-5 shrink-0 text-stone-400 transition ${ativo ? 'rotate-180' : ''}`}
                    aria-hidden
                  />
                </button>
                {ativo ? (
                  <div className="border-t border-stone-100 p-4">
                    <div className={PROSE}>
                      <ReactMarkdown>{a.answer}</ReactMarkdown>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-stone-100 pt-3 text-xs">
                      <Link href={`/universidade/faq/${a.slug}`} className="font-semibold text-moni-primary hover:underline">
                        Abrir página completa
                      </Link>
                      <Link href={chamadoHref} className="inline-flex items-center gap-1.5 text-stone-500 hover:text-stone-800">
                        <LifeBuoy className="h-3.5 w-3.5" aria-hidden /> Abrir chamado
                      </Link>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
