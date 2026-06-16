'use client';

import { type CSSProperties, useEffect, useRef, useState } from 'react';
import {
  formatMoedaDigitosPtBr,
  montarTicketMedioFaixa,
  parseTicketMedioFaixaPartes,
} from '@/lib/kanban/ticket-medio-faixa';

type Props = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: (value: string) => void;
  inputStyle?: CSSProperties;
  className?: string;
};

export function TicketMedioFaixaInput({ value, onChange, onBlur, inputStyle, className }: Props) {
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const ultimoEmitidoRef = useRef<string | null>(null);

  useEffect(() => {
    if (value === ultimoEmitidoRef.current) return;
    const partes = parseTicketMedioFaixaPartes(value);
    setMin(partes.min);
    setMax(partes.max);
    ultimoEmitidoRef.current = value;
  }, [value]);

  function emit(minFmt: string, maxFmt: string, blur = false) {
    const full = montarTicketMedioFaixa(minFmt, maxFmt);
    ultimoEmitidoRef.current = full;
    onChange(full);
    if (blur) onBlur?.(full);
  }

  const labelStyle: CSSProperties = {
    color: 'var(--moni-text-tertiary)',
    fontSize: '0.7rem',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  };

  const fieldStyle: CSSProperties = {
    width: 68,
    minWidth: 68,
    flexShrink: 0,
    border: 'none',
    outline: 'none',
    padding: '4px 2px',
    background: 'transparent',
    fontSize: '0.75rem',
    color: 'var(--moni-text-primary)',
    textAlign: 'right',
    ...inputStyle,
  };

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexWrap: 'nowrap',
        alignItems: 'center',
        gap: 3,
        padding: '4px 6px',
        minWidth: 200,
      }}
    >
      <span style={labelStyle}>entre R$</span>
      <input
        type="text"
        inputMode="numeric"
        value={min}
        placeholder="0,00"
        aria-label="Valor mínimo"
        style={fieldStyle}
        onChange={(e) => {
          const fmt = formatMoedaDigitosPtBr(e.target.value);
          setMin(fmt);
          emit(fmt, max);
        }}
        onBlur={(e) => {
          const fmt = formatMoedaDigitosPtBr(e.target.value);
          setMin(fmt);
          emit(fmt, max, true);
        }}
      />
      <span style={labelStyle}>e R$</span>
      <input
        type="text"
        inputMode="numeric"
        value={max}
        placeholder="0,00"
        aria-label="Valor máximo"
        style={fieldStyle}
        onChange={(e) => {
          const fmt = formatMoedaDigitosPtBr(e.target.value);
          setMax(fmt);
          emit(min, fmt);
        }}
        onBlur={(e) => {
          const fmt = formatMoedaDigitosPtBr(e.target.value);
          setMax(fmt);
          emit(min, fmt, true);
        }}
      />
    </div>
  );
}
