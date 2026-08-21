'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  REDE_DIAG_HEADER_TOOLTIPS,
  type DiagnosticoHeaderKey,
} from '@/lib/rede-diagnostico-header-tooltips';

type Props = {
  tooltipKey: DiagnosticoHeaderKey;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function DiagnosticoHeaderTh({ tooltipKey, children, className, style }: Props) {
  const tip = REDE_DIAG_HEADER_TOOLTIPS[tooltipKey];
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const reposicionar = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.max(120, Math.min(rect.left + rect.width / 2, window.innerWidth - 120));
    setPos({ top: rect.bottom + 8, left });
  };

  useLayoutEffect(() => {
    if (!open) return;
    reposicionar();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => reposicionar();
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [open]);

  const popup =
    open && pos && typeof document !== 'undefined'
      ? createPortal(
          <div
            role="tooltip"
            id={`diag-header-tip-${tooltipKey}`}
            className="moni-diagnostico-header-tooltip"
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              transform: 'translateX(-50%)',
              zIndex: 9999,
            }}
          >
            <span className="moni-diagnostico-header-tooltip-title">{tip.title}</span>
            {tip.subtitle ? (
              <span className="moni-diagnostico-header-tooltip-sub">{tip.subtitle}</span>
            ) : null}
            <span className="moni-diagnostico-header-tooltip-desc">{tip.description}</span>
          </div>,
          document.body,
        )
      : null;

  return (
    <th className={className} style={style} scope="col">
      <span
        ref={triggerRef}
        className="moni-diagnostico-header-trigger"
        aria-describedby={open ? `diag-header-tip-${tooltipKey}` : undefined}
        onMouseEnter={() => {
          setOpen(true);
          reposicionar();
        }}
        onMouseLeave={() => setOpen(false)}
      >
        {children}
      </span>
      {popup}
    </th>
  );
}
