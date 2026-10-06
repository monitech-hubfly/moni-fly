'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { recordFaqSearch, searchFaqArticles } from '@/lib/actions/faq-actions';
import type { FaqArticle, FaqCategory } from '@/types/faq';
import { FaqArticlePanel } from './FaqArticlePanel';
import { FaqCategoryCard } from './FaqCategoryCard';

const CHIPS = ['Carta Fiança', 'Hub Fly', 'Alvará', 'Terrenista', 'Sirene', 'Habite-se'] as const;

type Voto = 'sim' | 'nao';

function regexTermo(termo: string): RegExp | null {
  const mapa: Record<string, string> = {
    a: '[aáàâãä]',
    e: '[eéèêë]',
    i: '[iíìîï]',
    o: '[oóòôõö]',
    u: '[uúùûü]',
    c: '[cç]',
  };
  const corpo = [...termo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()]
    .map((char) => {
      if (mapa[char]) return mapa[char];
      return char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('');
  if (!corpo.trim()) return null;
  return new RegExp(`(${corpo})`, 'gi');
}

function destacar(texto: string, termo: string) {
  const regra = regexTermo(termo);
  if (!regra) return texto;
  const partes = texto.split(regra);
  return partes.map((parte, indice) => {
    if (indice % 2 === 1) {
      return (
        <mark key={`${indice}-${parte}`} className="bg-[var(--moni-gold-100)] text-[var(--moni-text-primary)]">
          {parte}
        </mark>
      );
    }
    return parte;
  });
}

export function FaqClient({
  categories,
  articles,
  erro,
}: {
  categories: FaqCategory[];
  articles: FaqArticle[];
  erro: boolean;
}) {
  const buscaRef = useRef<HTMLInputElement>(null);
  const [consulta, setConsulta] = useState('');
  const [resultados, setResultados] = useState<FaqArticle[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [artigoAberto, setArtigoAberto] = useState<FaqArticle | null>(null);
  const [painelAberto, setPainelAberto] = useState(false);
  const [votos, setVotos] = useState<Record<string, Voto>>({});

  const porCategoria = useMemo(() => {
    const mapa = new Map<string, FaqArticle[]>();
    for (const artigo of articles) {
      const lista = mapa.get(artigo.categoria_id) ?? [];
      lista.push(artigo);
      mapa.set(artigo.categoria_id, lista);
    }
    return mapa;
  }, [articles]);

  const nomeCategoria = useCallback(
    (categoriaId: string) => categories.find((categoria) => categoria.id === categoriaId)?.nome ?? '',
    [categories],
  );

  const fecharPainel = useCallback(() => {
    setPainelAberto(false);
    window.setTimeout(() => setArtigoAberto(null), 200);
  }, []);

  function abrirArtigo(artigo: FaqArticle) {
    setArtigoAberto(artigo);
    window.requestAnimationFrame(() => setPainelAberto(true));
  }

  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if ((evento.metaKey || evento.ctrlKey) && evento.key.toLowerCase() === 'k') {
        evento.preventDefault();
        buscaRef.current?.focus();
        buscaRef.current?.select();
      }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, []);

  useEffect(() => {
    const termo = consulta.trim();
    if (!termo) {
      setResultados(null);
      setBuscando(false);
      return;
    }

    let ativo = true;
    setBuscando(true);
    const ultimo = { termo: '', total: -1 };

    const timerBusca = window.setTimeout(() => {
      void searchFaqArticles(termo)
        .then((lista) => {
          if (!ativo) return;
          setResultados(lista);
          setBuscando(false);
          ultimo.termo = termo;
          ultimo.total = lista.length;
        })
        .catch(() => {
          if (!ativo) return;
          setResultados([]);
          setBuscando(false);
          ultimo.termo = termo;
          ultimo.total = 0;
        });
    }, 300);

    const timerRegistro = window.setTimeout(() => {
      const limite = Date.now() + 4000;
      const registrar = () => {
        if (!ativo) return;
        if (ultimo.termo === termo && ultimo.total >= 0) {
          void recordFaqSearch(termo, ultimo.total);
          return;
        }
        if (Date.now() > limite) return;
        window.setTimeout(registrar, 80);
      };
      registrar();
    }, 500);

    return () => {
      ativo = false;
      window.clearTimeout(timerBusca);
      window.clearTimeout(timerRegistro);
    };
  }, [consulta]);

  const modoBusca = consulta.trim().length > 0;

  return (
    <div className="min-h-full bg-[var(--moni-surface-50)]">
      <section className="px-4 pb-8 pt-10 sm:pt-14">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-[family-name:var(--moni-font-display)] text-[length:var(--moni-text-3xl)] font-semibold leading-tight text-[var(--moni-text-primary)]">
            Como podemos ajudar?
          </h1>
          <p className="mt-2 font-[family-name:var(--moni-font-sans)] text-[length:var(--moni-text-sm)] text-[var(--moni-text-tertiary)]">
            Base de conhecimento Moní para franqueados
          </p>
          <label className="relative mx-auto mt-6 block max-w-xl">
            <span className="sr-only">Buscar na Central de Ajuda</span>
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--moni-text-tertiary)]"
              aria-hidden
            />
            <input
              ref={buscaRef}
              value={consulta}
              onChange={(evento) => setConsulta(evento.target.value)}
              placeholder="Busque por tema, dúvida ou palavra"
              className="h-12 w-full rounded-[var(--moni-radius-pill)] border-[length:var(--moni-border-width)] border-solid border-[var(--moni-border-default)] bg-[var(--moni-surface-0)] pl-11 pr-16 font-[family-name:var(--moni-font-sans)] text-[length:var(--moni-text-base)] text-[var(--moni-text-primary)] shadow-[var(--moni-shadow-sm)] outline-none placeholder:text-[var(--moni-text-tertiary)] focus:shadow-[var(--moni-shadow-md)]"
            />
            {consulta ? (
              <button
                type="button"
                onClick={() => setConsulta('')}
                aria-label="Limpar busca"
                className="absolute right-3 top-1/2 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center text-[var(--moni-text-tertiary)]"
              >
                ✕
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-[var(--moni-radius-sm)] border-[length:var(--moni-border-width)] border-solid border-[var(--moni-border-default)] px-1.5 py-0.5 font-[family-name:var(--moni-font-sans)] text-[length:var(--moni-text-xs)] text-[var(--moni-text-tertiary)] sm:inline">
                ⌘K
              </kbd>
            )}
          </label>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setConsulta(chip)}
                className="inline-flex min-h-11 items-center rounded-[var(--moni-radius-pill)] border-[length:var(--moni-border-width)] border-solid border-[var(--moni-border-default)] bg-[var(--moni-surface-0)] px-3 font-[family-name:var(--moni-font-sans)] text-[length:var(--moni-text-sm)] text-[var(--moni-text-secondary)] transition-colors duration-200 hover:bg-[var(--moni-surface-100)]"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        {erro ? (
          <p className="text-center font-[family-name:var(--moni-font-sans)] text-[length:var(--moni-text-base)] text-[var(--moni-text-secondary)]">
            Não foi possível carregar a base de conhecimento agora.
          </p>
        ) : null}

        {modoBusca ? (
          <div className="mx-auto max-w-3xl">
            {buscando && resultados == null ? (
              <p className="font-[family-name:var(--moni-font-sans)] text-[length:var(--moni-text-sm)] text-[var(--moni-text-tertiary)]">
                Buscando...
              </p>
            ) : null}
            {resultados && resultados.length === 0 ? (
              <div className="rounded-[var(--moni-radius-lg)] border-[length:var(--moni-border-width)] border-solid border-[var(--moni-border-default)] bg-[var(--moni-surface-0)] p-6 text-center">
                <p className="font-[family-name:var(--moni-font-sans)] text-[length:var(--moni-text-base)] text-[var(--moni-text-secondary)]">
                  Nenhum artigo encontrado para essa busca.
                </p>
                <Link
                  href="/sirene/novo"
                  className="mt-4 inline-flex min-h-11 items-center font-[family-name:var(--moni-font-sans)] text-[length:var(--moni-text-sm)] font-medium text-[var(--moni-navy-800)] underline"
                >
                  Abrir chamado no Sirene
                </Link>
              </div>
            ) : null}
            {resultados && resultados.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {resultados.map((artigo) => (
                  <li key={artigo.id}>
                    <button
                      type="button"
                      onClick={() => abrirArtigo(artigo)}
                      className="flex min-h-11 w-full flex-col items-start gap-1 rounded-[var(--moni-radius-lg)] border-[length:var(--moni-border-width)] border-solid border-[var(--moni-border-default)] bg-[var(--moni-surface-0)] px-4 py-3 text-left shadow-[var(--moni-shadow-sm)] transition-shadow duration-200 hover:shadow-[var(--moni-shadow-md)]"
                    >
                      <span className="font-[family-name:var(--moni-font-sans)] text-[length:var(--moni-text-xs)] text-[var(--moni-text-tertiary)]">
                        {nomeCategoria(artigo.categoria_id)}
                      </span>
                      <span className="font-[family-name:var(--moni-font-sans)] text-[length:var(--moni-text-base)] font-medium text-[var(--moni-text-primary)]">
                        {destacar(artigo.pergunta, consulta)}
                      </span>
                      {artigo.resposta_resumida ? (
                        <span className="line-clamp-2 font-[family-name:var(--moni-font-sans)] text-[length:var(--moni-text-sm)] text-[var(--moni-text-secondary)]">
                          {destacar(artigo.resposta_resumida, consulta)}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((categoria) => (
              <FaqCategoryCard
                key={categoria.id}
                categoria={categoria}
                artigos={porCategoria.get(categoria.id) ?? []}
                onAbrir={abrirArtigo}
              />
            ))}
            <article className="flex h-full flex-col justify-between rounded-[var(--moni-radius-lg)] bg-[var(--moni-navy-800)] p-5 text-[var(--moni-text-inverse)] shadow-[var(--moni-shadow-card)]">
              <h2 className="font-[family-name:var(--moni-font-display)] text-[length:var(--moni-text-xl)] font-semibold leading-tight">
                Não encontrou o que precisa?
              </h2>
              <Link
                href="/sirene/novo"
                className="mt-6 inline-flex min-h-11 items-center justify-center rounded-[var(--moni-radius-md)] bg-[var(--moni-gold-400)] px-4 font-[family-name:var(--moni-font-sans)] text-[length:var(--moni-text-sm)] font-medium text-[var(--moni-navy-800)]"
              >
                Abrir chamado no Sirene
              </Link>
            </article>
          </div>
        )}
      </section>

      <FaqArticlePanel
        artigo={artigoAberto}
        categoriaNome={artigoAberto ? nomeCategoria(artigoAberto.categoria_id) : ''}
        aberto={painelAberto}
        voto={artigoAberto ? (votos[artigoAberto.id] ?? null) : null}
        onFechar={fecharPainel}
        onVoto={(articleId, voto) => setVotos((atual) => ({ ...atual, [articleId]: voto }))}
      />
    </div>
  );
}
