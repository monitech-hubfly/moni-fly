'use client';

import { type CSSProperties, useEffect, useState } from 'react';
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

  useEffect(() => {
    const partes = parseTicketMedioFaixaPartes(value);
    setMin(partes.min);
    setMax(partes.max);
  }, [value]);

  function emit(minFmt: string, maxFmt: string, blur = false) {
    const full = montarTicketMedioFaixa(minFmt, maxFmt);
    onChange(full);
    if (blur) onBlur?.(full);
  }

  const labelStyle: CSSProperties = {
    color: 'var(--moni-text-tertiary)',
    fontSize: '0.7rem',
    whiteSpace: 'nowrap',
  };

  const fieldStyle: CSSProperties = {
    width: 72,
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
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 2,
        padding: '4px 6px',
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
