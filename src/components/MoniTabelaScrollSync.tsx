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
const PIN_EPS_PX = 2;

function scrollRootOf(wrap: HTMLElement | null): HTMLElement | null {
  if (!wrap) return null;
  const root = wrap.closest('.moni-app-main-scroll');
  return root instanceof HTMLElement ? root : null;
}

/**
 * Planilha: scroll X no wrap; Y no wrap só depois que título/abas/métricas saíram da tela.
 * O cabeçalho da tabela gruda no topo; o restante da página sobe normalmente.
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

    const scrollRoot = scrollRootOf(wrap);
    const rootRect = scrollRoot?.getBoundingClientRect();
    const footer = wrap.parentElement?.querySelector('.moni-tabela-footer');
    const footerH = footer instanceof HTMLElement ? footer.getBoundingClientRect().height : 0;
    const bottom = rootRect?.bottom ?? window.innerHeight;
    const rootTop = rootRect?.top ?? 0;
    // Altura = área útil do main scroll (não a partir do topo atual do wrap).
    // Assim título, abas e métricas ocupam espaço real e saem da tela ao descer.
    const available = Math.floor(bottom - rootTop - footerH - GAP_ABAIXO_PX);
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

    const scrollRoot = scrollRootOf(wrap);

    const onWheel = (e: WheelEvent) => {
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (!scrollRoot) return;

      const wrapTop = wrap.getBoundingClientRect().top;
      const rootTop = scrollRoot.getBoundingClientRect().top;
      const pinned = wrapTop <= rootTop + PIN_EPS_PX;

      if (e.deltaY > 0 && !pinned) {
        e.preventDefault();
        scrollRoot.scrollTop += e.deltaY;
        return;
      }

      if (e.deltaY < 0 && wrap.scrollTop <= 0) {
        e.preventDefault();
        scrollRoot.scrollTop += e.deltaY;
      }
    };

    const ro = new ResizeObserver(() => updateLayout());
    ro.observe(wrap);
    ro.observe(main);
    if (main.firstElementChild) ro.observe(main.firstElementChild);
    const parent = wrap.parentElement;
    if (parent) ro.observe(parent);
    if (scrollRoot) ro.observe(scrollRoot);

    wrap.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('resize', updateLayout);

    return () => {
      ro.disconnect();
      wrap.removeEventListener('wheel', onWheel);
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
