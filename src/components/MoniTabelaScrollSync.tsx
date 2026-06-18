'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  className?: string;
};

/** Tabela larga com barra horizontal fixa na base da viewport, sincronizada com o scroll. */
export function MoniTabelaScrollSync({ children, className = '' }: Props) {
  const mainRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);
  const [barStyle, setBarStyle] = useState<{ left: number; width: number } | null>(null);
  const [scrollWidth, setScrollWidth] = useState(0);

  const syncFromMain = useCallback(() => {
    const main = mainRef.current;
    const bar = barRef.current;
    if (!main || !bar || syncingRef.current) return;
    syncingRef.current = true;
    bar.scrollLeft = main.scrollLeft;
    syncingRef.current = false;
  }, []);

  const syncFromBar = useCallback(() => {
    const main = mainRef.current;
    const bar = barRef.current;
    if (!main || !bar || syncingRef.current) return;
    syncingRef.current = true;
    main.scrollLeft = bar.scrollLeft;
    syncingRef.current = false;
  }, []);

  const updateLayout = useCallback(() => {
    const main = mainRef.current;
    if (!main) return;
    const rect = main.getBoundingClientRect();
    const nextWidth = Math.max(0, main.scrollWidth);
    setScrollWidth(nextWidth);
    setBarStyle({
      left: rect.left,
      width: rect.width,
    });
    syncFromMain();
  }, [syncFromMain]);

  useEffect(() => {
    updateLayout();
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

  return (
    <>
      <div
        ref={mainRef}
        className={`moni-tabela-scroll-main ${className}`.trim()}
        onScroll={syncFromMain}
      >
        {children}
      </div>
      {barStyle && scrollWidth > barStyle.width ? (
        <div
          ref={barRef}
          className="moni-tabela-scroll-bar"
          style={{ left: barStyle.left, width: barStyle.width }}
          onScroll={syncFromBar}
          aria-hidden
        >
          <div
            ref={spacerRef}
            className="moni-tabela-scroll-bar-spacer"
            style={{ width: scrollWidth }}
          />
        </div>
      ) : null}
    </>
  );
}
