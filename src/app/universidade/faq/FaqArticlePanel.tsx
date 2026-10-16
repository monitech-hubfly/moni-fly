'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { recordFaqFeedback } from '@/lib/actions/faq-actions';
import type { FaqArticle } from '@/types/faq';

type Voto = 'sim' | 'nao';

export function FaqArticlePanel({
  artigo,
  categoriaNome,
  aberto,
  voto,
  onFechar,
  onVoto,
}: {
  artigo: FaqArticle | null;
  categoriaNome: string;
  aberto: boolean;
  voto: Voto | null;
  onFechar: () => void;
  onVoto: (articleId: string, voto: Voto) => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erroVoto, setErroVoto] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onFechar();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => {
      document.body.style.overflow = anterior;
      window.removeEventListener('keydown', aoTeclar);
    };
  }, [aberto, onFechar]);

  useEffect(() => {
    setErroVoto(false);
    setEnviando(false);
  }, [artigo?.id]);

  if (!artigo) return null;

  async function votar(helpful: boolean) {
    if (!artigo || enviando || voto) return;
    setEnviando(true);
    setErroVoto(false);
    try {
      await recordFaqFeedback(artigo.id, helpful);
      onVoto(artigo.id, helpful ? 'sim' : 'nao');
    } catch {
      setErroVoto(true);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className={`fixed inset-0 z-[80] ${aberto ? '' : 'pointer-events-none'}`} role="presentation">
      <button
        type="button"
        aria-label="Fechar artigo"
        onClick={onFechar}
        className={`absolute inset-0 bg-[color-mix(in_srgb,var(--moni-navy-800)_45%,transparent)] backdrop-blur-sm transition-opacity duration-200 ${
          aberto ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="faq-artigo-titulo"
        className={`absolute inset-y-0 right-0 flex w-full flex-col bg-[var(--moni-surface-0)] shadow-[var(--moni-shadow-lg)] transition-transform duration-200 sm:w-[560px] ${
          aberto ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--moni-border-default)] px-5 py-4 [border-bottom-width:var(--moni-border-width)]">
          <span className="inline-flex min-h-8 items-center rounded-[var(--moni-radius-pill)] bg-[var(--moni-surface-100)] px-3 font-[family-name:var(--moni-font-sans)] text-[length:var(--moni-text-xs)] font-medium text-[var(--moni-text-secondary)]">
            {categoriaNome || 'FAQ'}
          </span>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--moni-radius-md)] text-[var(--moni-text-primary)] transition-colors duration-200 hover:bg-[var(--moni-surface-100)]"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6">
          <h2
            id="faq-artigo-titulo"
            className="font-[family-name:var(--moni-font-display)] text-[length:var(--moni-text-2xl)] font-extrabold leading-tight text-[var(--moni-text-primary)]"
          >
            {artigo.pergunta}
          </h2>

          {artigo.resposta_resumida ? (
            <div className="mt-5 rounded-[var(--moni-radius-md)] border-l-[3px] border-[var(--moni-gold-400)] bg-[var(--moni-gold-50)] px-4 py-3 font-[family-name:var(--moni-font-sans)] text-[length:var(--moni-text-base)] leading-relaxed text-[var(--moni-text-secondary)]">
              {artigo.resposta_resumida}
            </div>
          ) : null}

          {artigo.resposta_completa ? (
            <div className="faq-md mt-6 font-[family-name:var(--moni-font-sans)] text-[length:var(--moni-text-base)] leading-relaxed text-[var(--moni-text-secondary)] [&_a]:text-[var(--moni-navy-800)] [&_a]:underline [&_blockquote]:my-4 [&_blockquote]:border-l-[3px] [&_blockquote]:border-[var(--moni-gold-400)] [&_blockquote]:bg-[var(--moni-gold-50)] [&_blockquote]:px-4 [&_blockquote]:py-3 [&_h1]:mb-3 [&_h1]:font-[family-name:var(--moni-font-display)] [&_h1]:text-[length:var(--moni-text-xl)] [&_h1]:font-semibold [&_h1]:text-[var(--moni-navy-800)] [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:font-[family-name:var(--moni-font-display)] [&_h2]:text-[length:var(--moni-text-lg)] [&_h2]:font-semibold [&_h2]:text-[var(--moni-navy-800)] [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:font-semibold [&_h3]:text-[var(--moni-navy-800)] [&_li]:mt-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-3 [&_strong]:font-semibold [&_strong]:text-[var(--moni-navy-800)] [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_table]:text-[length:var(--moni-text-sm)] [&_td]:border-b [&_td]:border-[var(--moni-border-default)] [&_td]:px-3 [&_td]:py-2 [&_td]:[border-bottom-width:var(--moni-border-width)] [&_th]:bg-[var(--moni-navy-800)] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-medium [&_th]:text-[var(--moni-text-inverse)] [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{artigo.resposta_completa}</ReactMarkdown>
            </div>
          ) : null}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--moni-border-default)] px-5 py-4 [border-top-width:var(--moni-border-width)]">
          {artigo.area_responsavel ? (
            <span className="inline-flex min-h-8 items-center rounded-[var(--moni-radius-pill)] bg-[var(--moni-surface-100)] px-3 font-[family-name:var(--moni-font-sans)] text-[length:var(--moni-text-xs)] text-[var(--moni-text-secondary)]">
              {artigo.area_responsavel}
            </span>
          ) : (
            <span />
          )}
          <div className="flex flex-wrap items-center gap-2">
            {voto ? (
              <p className="font-[family-name:var(--moni-font-sans)] text-[length:var(--moni-text-sm)] text-[var(--moni-text-secondary)]">
                Obrigado pelo retorno.
              </p>
            ) : (
              <>
                <span className="font-[family-name:var(--moni-font-sans)] text-[length:var(--moni-text-sm)] text-[var(--moni-text-secondary)]">
                  Isso foi útil?
                </span>
                <button
                  type="button"
                  disabled={enviando}
                  onClick={() => void votar(true)}
                  className="inline-flex min-h-11 items-center rounded-[var(--moni-radius-md)] bg-[var(--moni-navy-800)] px-4 font-[family-name:var(--moni-font-sans)] text-[length:var(--moni-text-sm)] text-[var(--moni-text-inverse)] disabled:opacity-60"
                >
                  Sim
                </button>
                <button
                  type="button"
                  disabled={enviando}
                  onClick={() => void votar(false)}
                  className="inline-flex min-h-11 items-center rounded-[var(--moni-radius-md)] border-[length:var(--moni-border-width)] border-solid border-[var(--moni-border-default)] px-4 font-[family-name:var(--moni-font-sans)] text-[length:var(--moni-text-sm)] text-[var(--moni-text-primary)] disabled:opacity-60"
                >
                  Não
                </button>
              </>
            )}
            {erroVoto ? (
              <p className="w-full font-[family-name:var(--moni-font-sans)] text-[length:var(--moni-text-xs)] text-[var(--moni-text-secondary)]">
                Não foi possível registrar agora.
              </p>
            ) : null}
          </div>
        </footer>
      </aside>
    </div>
  );
}
