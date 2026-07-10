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

const BOTTOM_GAP_PX = 16;

/**
 * Tabela larga: scroll horizontal + vertical no wrapper, com thead sticky.
 * overflow-x no wrapper quebra sticky vertical contra o AppShell; por isso a
 * área da tabela usa max-height dinâmico e scroll interno único.
 */
export function MoniTabelaScrollSync({ children, className = '' }: Props) {
  const mainRef = useRef<HTMLDivElement>(null);

  const updateLayout = useCallback(() => {
    const main = mainRef.current;
    if (!main) return;

    const top = Math.max(main.getBoundingClientRect().top, 0);
    const maxHeight = Math.max(window.innerHeight - top - BOTTOM_GAP_PX, 240);
    main.style.maxHeight = `${maxHeight}px`;

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
    window.addEventListener('scroll', updateLayout, true);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateLayout);
      window.removeEventListener('scroll', updateLayout, true);
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
