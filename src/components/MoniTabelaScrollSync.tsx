'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
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

function columnHeaderRow(thead: HTMLTableSectionElement): HTMLTableRowElement | null {
  let best: HTMLTableRowElement | null = null;
  for (const row of thead.rows) {
    if (!best || row.cells.length > best.cells.length) best = row;
  }
  return best;
}

/**
 * Planilha: scroll X no wrap; Y no wrap depois que título/abas/métricas saem da tela.
 * Se o scroll da página levar o thead para fora da área visível, uma cópia fixa
 * permanece no topo — o nome das colunas não some.
 */
export function MoniTabelaScrollSync({ children, className = '' }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const pinScrollRef = useRef<HTMLDivElement>(null);
  const pinTableRef = useRef<HTMLTableElement>(null);
  const pinSigRef = useRef('');
  const [pinMounted, setPinMounted] = useState(false);

  const syncHeaderPin = useCallback(() => {
    const wrap = wrapRef.current;
    const main = mainRef.current;
    const pin = pinRef.current;
    const pinScroll = pinScrollRef.current;
    const pinTable = pinTableRef.current;
    if (!wrap || !main || !pin || !pinScroll || !pinTable) return;

    const scrollRoot = scrollRootOf(wrap);
    const table = main.querySelector('table');
    const thead = table?.tHead ?? null;
    if (!scrollRoot || !table || !thead || thead.rows.length === 0) {
      pin.classList.remove('is-on');
      wrap.classList.remove('moni-tabela-head-covered');
      return;
    }

    const rootRect = scrollRoot.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const theadRect = thead.getBoundingClientRect();
    const tableRect = table.getBoundingClientRect();
    const visibleTop = Math.max(rootRect.top, Math.min(wrapRect.top, rootRect.bottom));
    const theadH = thead.offsetHeight;
    const headerFora =
      theadRect.top < visibleTop - PIN_EPS_PX && tableRect.bottom > visibleTop + Math.min(theadH, 24);

    pin.classList.toggle('is-on', headerFora);
    wrap.classList.toggle('moni-tabela-head-covered', headerFora);
    if (!headerFora) return;

    pin.style.top = `${Math.round(visibleTop)}px`;
    pin.style.left = `${Math.round(wrapRect.left)}px`;
    pin.style.width = `${wrap.clientWidth}px`;
    pin.style.height = `${theadH}px`;

    const sig = `${table.className}|${thead.innerText}|${thead.rows.length}|${[...thead.rows].map((r) => r.cells.length).join(',')}`;
    if (pinSigRef.current !== sig) {
      pinSigRef.current = sig;
      const clone = thead.cloneNode(true) as HTMLTableSectionElement;
      clone.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
      pinTable.className = table.className;
      pinTable.replaceChildren(clone);
    }

    if (!pinTable.onclick) {
      pinTable.onclick = (event) => {
        const liveTable = main.querySelector('table');
        const liveHead = liveTable?.tHead;
        if (!liveHead) return;
        const target = event.target instanceof Element ? event.target.closest('button, a') : null;
        if (!target || !pinTable.contains(target)) return;
        event.preventDefault();
        const selector = target.tagName === 'A' ? 'a' : 'button';
        const clones = [...pinTable.querySelectorAll(selector)];
        const reals = [...liveHead.querySelectorAll(selector)];
        const index = clones.indexOf(target as HTMLAnchorElement | HTMLButtonElement);
        const real = reals[index];
        if (real instanceof HTMLElement) real.click();
      };
    }

    const sourceRow = columnHeaderRow(thead);
    const colgroup = document.createElement('colgroup');
    if (sourceRow) {
      for (const cell of sourceRow.cells) {
        const col = document.createElement('col');
        col.style.width = `${cell.getBoundingClientRect().width}px`;
        colgroup.appendChild(col);
      }
    }
    pinTable.querySelector('colgroup')?.remove();
    pinTable.prepend(colgroup);
    pinTable.style.width = `${table.scrollWidth}px`;
    pinScroll.scrollLeft = wrap.scrollLeft;
  }, []);

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
    syncHeaderPin();
  }, [syncHeaderPin]);

  useEffect(() => {
    const pin = document.createElement('div');
    pin.className = 'moni-tabela-head-pin moni-tabela-scroll-main';
    const pinScroll = document.createElement('div');
    pinScroll.className = 'moni-tabela-head-pin-scroll';
    const pinTable = document.createElement('table');
    pinScroll.appendChild(pinTable);
    pin.appendChild(pinScroll);
    document.body.appendChild(pin);
    pinRef.current = pin;
    pinScrollRef.current = pinScroll;
    pinTableRef.current = pinTable;
    setPinMounted(true);
    return () => {
      pin.remove();
      pinRef.current = null;
      pinScrollRef.current = null;
      pinTableRef.current = null;
      pinSigRef.current = '';
    };
  }, []);

  useLayoutEffect(() => {
    updateLayout();
    requestAnimationFrame(updateLayout);
  }, [updateLayout, children, pinMounted]);

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

    let pinFrame = 0;
    const onScroll = () => {
      if (pinFrame) return;
      pinFrame = requestAnimationFrame(() => {
        pinFrame = 0;
        syncHeaderPin();
      });
    };

    wrap.addEventListener('wheel', onWheel, { passive: false });
    wrap.addEventListener('scroll', onScroll, { passive: true });
    scrollRoot?.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', updateLayout);

    return () => {
      ro.disconnect();
      if (pinFrame) cancelAnimationFrame(pinFrame);
      wrap.removeEventListener('wheel', onWheel);
      wrap.removeEventListener('scroll', onScroll);
      scrollRoot?.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', updateLayout);
    };
  }, [updateLayout, syncHeaderPin, pinMounted]);

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
