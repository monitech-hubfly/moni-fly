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

/** Reserva mínima para contador + paginação abaixo da tabela (quando o footer é irmão). */
const FOOTER_RESERVE_PX = 56;
const BOTTOM_GAP_PX = 12;

/**
 * Tabela larga: scroll horizontal + vertical no wrapper, com thead sticky interno.
 *
 * Causa histórica da paginação “sumida”: o wrap era `position: sticky` + max-height ≈ viewport,
 * cobrindo o footer irmão (números de página) no scroll do AppShell. Agora o wrap não é sticky
 * (só o thead dentro do overflow) e o max-height reserva espaço do footer irmão.
 */
export function MoniTabelaScrollSync({ children, className = '' }: Props) {
  const mainRef = useRef<HTMLDivElement>(null);

  const updateLayout = useCallback(() => {
    const main = mainRef.current;
    if (!main) return;

    const wrap = main.parentElement;
    const footer = wrap?.nextElementSibling;
    const footerH =
      footer instanceof HTMLElement
        ? Math.max(footer.getBoundingClientRect().height, FOOTER_RESERVE_PX)
        : FOOTER_RESERVE_PX;

    const top = Math.max(main.getBoundingClientRect().top, 0);
    const maxHeight = Math.max(window.innerHeight - top - footerH - BOTTOM_GAP_PX, 200);
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

    const wrap = main.parentElement;
    const footer = wrap?.nextElementSibling;

    const ro = new ResizeObserver(() => updateLayout());
    ro.observe(main);
    if (main.firstElementChild) ro.observe(main.firstElementChild);
    if (footer instanceof HTMLElement) ro.observe(footer);

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
