import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  className?: string;
};

/** Tabela larga: scroll horizontal único no wrapper + thead sticky no scroll vertical da página. */
export function MoniTabelaScrollSync({ children, className = '' }: Props) {
  return (
    <div className="moni-tabela-scroll-wrap">
      <div className={`moni-tabela-scroll-main ${className}`.trim()}>{children}</div>
    </div>
  );
}
