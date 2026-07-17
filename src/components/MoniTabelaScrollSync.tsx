'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react';

type Props = {
  children: ReactNode;
  className?: string;
};

/**
 * Tabela larga: scroll horizontal no wrapper (sem max-height / scroll vertical interno).
 * A página (AppShell) rola verticalmente; o thead sticky só se aplica no eixo do wrap
 * (útil com cabeçalho de duas linhas via --moni-tabela-thead-row1-height).
 */
export function MoniTabelaScrollSync({ children, className = '' }: Props) {
  const mainRef = useRef<HTMLDivElement>(null);

  const updateLayout = useCallback(() => {
    const main = mainRef.current;
    if (!main) return;

    // Sem altura fixa: evita scrollbar vertical no container da tabela.
    main.style.removeProperty('max-height');

    const firstHeadRow = main.querySelector('table thead tr:first-child');
    if (firstHeadRow instanceof HTMLElement) {
      main.style.setProperty('--moni-tabela-thead-row1-height', `${firstHeadRow.offsetHeight}px`);
    } else {
      main.style.removeProperty('--moni-tabela-thead-row1-height');
    }
  }, []);

  useLayoutEffect(() => {
    updateLayout();
    requestAnimationFrame(updateLayout);
  }, [updateLayout, children]);

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;

    const ro = new ResizeObserver(() => updateLayout());
    ro.observe(main);
    if (main.firstElementChild) ro.observe(main.firstElementChild);

    window.addEventListener('resize', updateLayout);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateLayout);
    };
  }, [updateLayout]);

  const style = {
    '--moni-tabela-thead-row1-height': '0px',
  } as CSSProperties;

  return (
    <div className="moni-tabela-scroll-wrap">
      <div
        ref={mainRef}
        className={`moni-tabela-scroll-main ${className}`.trim()}
        style={style}
      >
        {children}
      </div>
    </div>
  );
}
