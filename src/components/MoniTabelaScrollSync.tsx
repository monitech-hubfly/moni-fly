'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  className?: string;
};

type ScrollMetrics = {
  left: number;
  width: number;
  scrollWidth: number;
  clientWidth: number;
  scrollLeft: number;
};

const MIN_THUMB_PX = 48;

/** Tabela larga com trilha horizontal fixa na base da viewport (arrastável). */
export function MoniTabelaScrollSync({ children, className = '' }: Props) {
  const mainRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [metrics, setMetrics] = useState<ScrollMetrics | null>(null);

  const readMetrics = useCallback((): ScrollMetrics | null => {
    const main = mainRef.current;
    if (!main) return null;
    const rect = main.getBoundingClientRect();
    return {
      left: rect.left,
      width: rect.width,
      scrollWidth: main.scrollWidth,
      clientWidth: main.clientWidth,
      scrollLeft: main.scrollLeft,
    };
  }, []);

  const updateLayout = useCallback(() => {
    if (draggingRef.current) return;
    setMetrics(readMetrics());
  }, [readMetrics]);

  const applyScrollLeft = useCallback((next: number) => {
    const main = mainRef.current;
    if (!main) return;
    const max = Math.max(0, main.scrollWidth - main.clientWidth);
    const clamped = Math.max(0, Math.min(max, next));
    main.scrollLeft = clamped;
    setMetrics((prev) => (prev ? { ...prev, scrollLeft: clamped } : readMetrics()));
  }, [readMetrics]);

  const onMainScroll = useCallback(() => {
    const main = mainRef.current;
    if (!main || draggingRef.current) return;
    const rect = main.getBoundingClientRect();
    setMetrics((prev) =>
      prev
        ? {
            ...prev,
            left: rect.left,
            width: rect.width,
            scrollWidth: main.scrollWidth,
            clientWidth: main.clientWidth,
            scrollLeft: main.scrollLeft,
          }
        : readMetrics(),
    );
  }, [readMetrics]);

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

  const maxScroll = metrics ? Math.max(0, metrics.scrollWidth - metrics.clientWidth) : 0;
  const showBar = Boolean(metrics && maxScroll > 1);
  const thumbWidth = showBar && metrics
    ? Math.max(MIN_THUMB_PX, (metrics.clientWidth / metrics.scrollWidth) * metrics.width)
    : 0;
  const trackTravel = metrics ? Math.max(0, metrics.width - thumbWidth) : 0;
  const thumbOffset =
    showBar && metrics && maxScroll > 0 ? (metrics.scrollLeft / maxScroll) * trackTravel : 0;

  const onThumbPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const main = mainRef.current;
    if (!main || maxScroll <= 0 || trackTravel <= 0) return;

    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startScroll = main.scrollLeft;

    const onMove = (ev: globalThis.PointerEvent) => {
      const dx = ev.clientX - startX;
      applyScrollLeft(startScroll + (dx / trackTravel) * maxScroll);
    };

    const onUp = (ev: globalThis.PointerEvent) => {
      draggingRef.current = false;
      e.currentTarget.releasePointerCapture(ev.pointerId);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      updateLayout();
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  };

  const onTrackPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).dataset.moniScrollThumb === '1') return;
    if (maxScroll <= 0 || trackTravel <= 0 || !metrics) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const targetOffset = Math.max(0, Math.min(trackTravel, clickX - thumbWidth / 2));
    applyScrollLeft((targetOffset / trackTravel) * maxScroll);
  };

  return (
    <>
      <div
        ref={mainRef}
        id="moni-tabela-scroll-region"
        className={`moni-tabela-scroll-main ${className}`.trim()}
        onScroll={onMainScroll}
      >
        {children}
      </div>
      {showBar && metrics ? (
        <div
          ref={trackRef}
          className="moni-tabela-scroll-track"
          style={{ left: metrics.left, width: metrics.width }}
          onPointerDown={onTrackPointerDown}
          role="scrollbar"
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={maxScroll}
          aria-valuenow={Math.round(metrics.scrollLeft)}
          aria-controls="moni-tabela-scroll-region"
        >
          <div
            data-moni-scroll-thumb="1"
            className="moni-tabela-scroll-thumb"
            style={{ width: thumbWidth, transform: `translateX(${thumbOffset}px)` }}
            onPointerDown={onThumbPointerDown}
          />
        </div>
      ) : null}
    </>
  );
}
