'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type Props = {
  children: ReactNode;
  className?: string;
};

/** Tabela larga com scroll horizontal nativo + barra fixa na base da viewport (sincronizada). */
export function MoniTabelaScrollSync({ children, className = '' }: Props) {
  const mainRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);
  const [barStyle, setBarStyle] = useState<{ left: number; width: number } | null>(null);
  const [scrollWidth, setScrollWidth] = useState(0);
  const [needsFixedBar, setNeedsFixedBar] = useState(false);

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
    const sw = main.scrollWidth;
    const cw = main.clientWidth;
    setScrollWidth(sw);
    setNeedsFixedBar(sw > cw + 1);
    setBarStyle({
      left: rect.left,
      width: cw,
    });
  }, []);

  useLayoutEffect(() => {
    updateLayout();
    requestAnimationFrame(updateLayout);
  }, [updateLayout, children]);

  useEffect(() => {
    if (needsFixedBar) syncFromMain();
  }, [needsFixedBar, scrollWidth, barStyle, syncFromMain]);

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

  return (
    <div className="moni-tabela-scroll-wrap">
      <div
        ref={mainRef}
        id="moni-tabela-scroll-region"
        className={`moni-tabela-scroll-main ${className}`.trim()}
        onScroll={syncFromMain}
      >
        {children}
      </div>
      {needsFixedBar && barStyle ? (
        <div
          ref={barRef}
          className="moni-tabela-scroll-bar"
          style={{ left: barStyle.left, width: barStyle.width }}
          onScroll={syncFromBar}
          role="scrollbar"
          aria-orientation="horizontal"
          aria-controls="moni-tabela-scroll-region"
        >
          <div className="moni-tabela-scroll-bar-spacer" style={{ width: scrollWidth }} />
        </div>
      ) : null}
    </div>
  );
}
