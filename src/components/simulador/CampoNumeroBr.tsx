'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import {
  formatarNumeroInput,
  parsearNumeroInput,
} from '@/lib/simulador/formatar-numero-input';

type Props = {
  valor: number | null;
  onChange: (n: number | null) => void;
  inteiro?: boolean;
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
  id?: string;
  name?: string;
  disabled?: boolean;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
};

/**
 * Input numérico com máscara pt-BR.
 * O estado do pai continua número puro; a formatação é só de exibição.
 * Enquanto o campo está focado, o texto digitado é preservado (vírgula/parcial).
 */
export function CampoNumeroBr({
  valor,
  onChange,
  inteiro,
  placeholder,
  className,
  style,
  id,
  name,
  disabled,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedby,
}: Props) {
  const formatado = valor == null ? '' : formatarNumeroInput(valor, { inteiro });
  const [texto, setTexto] = useState(formatado);
  const [focado, setFocado] = useState(false);

  useEffect(() => {
    if (!focado) setTexto(formatado);
  }, [formatado, focado]);

  function emitir(raw: string) {
    if (raw.trim() === '') {
      onChange(null);
      return;
    }
    const n = parsearNumeroInput(raw);
    onChange(inteiro ? Math.round(n) : n);
  }

  return (
    <input
      id={id}
      name={name}
      className={className}
      style={style}
      type="text"
      inputMode={inteiro ? 'numeric' : 'decimal'}
      placeholder={placeholder}
      disabled={disabled}
      aria-invalid={ariaInvalid}
      aria-describedby={ariaDescribedby}
      value={focado ? texto : formatado}
      onFocus={() => {
        setFocado(true);
        setTexto(formatado);
      }}
      onChange={(e) => {
        const v = e.target.value;
        setTexto(v);
        emitir(v);
      }}
      onBlur={() => {
        emitir(texto);
        setFocado(false);
      }}
    />
  );
}
