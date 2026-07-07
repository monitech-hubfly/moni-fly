'use client';

import { useEffect, useState } from 'react';
import {
  prepararHtmlComentarioExibicaoDom,
  prepararHtmlComentarioExibicaoSeguro,
} from '@/lib/kanban/comentario-linkify';

type Props = {
  conteudo: string | null | undefined;
  className?: string;
  style?: React.CSSProperties;
};

/** Exibe conteúdo HTML de comentário kanban com URLs clicáveis e sanitização segura. */
export function ComentarioConteudoHtml({ conteudo, className, style }: Props) {
  const raw = String(conteudo ?? '');
  const [html, setHtml] = useState(() => prepararHtmlComentarioExibicaoSeguro(raw));

  useEffect(() => {
    if (!raw.trim()) {
      setHtml('');
      return;
    }
    try {
      setHtml(prepararHtmlComentarioExibicaoDom(raw));
    } catch {
      setHtml(prepararHtmlComentarioExibicaoSeguro(raw));
    }
  }, [raw]);

  if (!html) return null;

  return (
    <p
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
