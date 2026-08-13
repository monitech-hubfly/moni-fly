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

const MIN_TABELA_VIEWPORT_PX = 240;
const GAP_ABAIXO_PX = 12;

/**
 * Planilha: scroll X+Y no wrap. Cabeçalho gruda no topo e colunas sticky à esquerda
 * (mesmo recorte, como freeze panes do Sheets/Excel).
 */
export function MoniTabelaScrollSync({ children, className = '' }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  const updateLayout = useCallback(() => {
    const wrap = wrapRef.current;
    const main = mainRef.current;
    if (!wrap || !main) return;

    const firstHeadRow = main.querySelector('table thead tr:first-child');
    if (firstHeadRow instanceof HTMLElement) {
      main.style.setProperty('--moni-tabela-thead-row1-height', `${firstHeadRow.offsetHeight}px`);
    } else {
      main.style.removeProperty('--moni-tabela-thead-row1-height');
    }

    const scrollRoot =
      wrap.closest('.moni-app-main-scroll') instanceof HTMLElement
        ? (wrap.closest('.moni-app-main-scroll') as HTMLElement)
        : null;
    const rootRect = scrollRoot?.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const footer = wrap.parentElement?.querySelector('.moni-tabela-footer');
    const footerH = footer instanceof HTMLElement ? footer.getBoundingClientRect().height : 0;
    const bottom = rootRect?.bottom ?? window.innerHeight;
    const available = Math.floor(bottom - wrapRect.top - footerH - GAP_ABAIXO_PX);
    const maxH = Math.max(MIN_TABELA_VIEWPORT_PX, available);
    wrap.style.setProperty('--moni-tabela-scroll-max-height', `${maxH}px`);
  }, []);

  useLayoutEffect(() => {
    updateLayout();
    requestAnimationFrame(updateLayout);
  }, [updateLayout, children]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const main = mainRef.current;
    if (!wrap || !main) return;

    const ro = new ResizeObserver(() => updateLayout());
    ro.observe(wrap);
    ro.observe(main);
    if (main.firstElementChild) ro.observe(main.firstElementChild);
    const parent = wrap.parentElement;
    if (parent) ro.observe(parent);
    const scrollRoot = wrap.closest('.moni-app-main-scroll');
    if (scrollRoot instanceof HTMLElement) ro.observe(scrollRoot);

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
    <div ref={wrapRef} className="moni-tabela-scroll-wrap">
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
