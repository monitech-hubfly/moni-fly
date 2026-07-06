'use client';

import { useMemo } from 'react';
import { prepararHtmlComentarioExibicao } from '@/lib/kanban/comentario-linkify';

type Props = {
  conteudo: string;
  className?: string;
  style?: React.CSSProperties;
};

/** Exibe conteúdo HTML de comentário kanban com URLs clicáveis e sanitização segura. */
export function ComentarioConteudoHtml({ conteudo, className, style }: Props) {
  const html = useMemo(() => prepararHtmlComentarioExibicao(conteudo), [conteudo]);

  if (!html) return null;

  return (
    <p
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
