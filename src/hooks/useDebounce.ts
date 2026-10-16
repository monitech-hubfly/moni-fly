'use client';

import { useEffect, useState } from 'react';

/**
 * Retorna uma versão "debounced" do valor fornecido.
 * O valor atualizado só é propagado após `delay` ms sem novas mudanças.
 *
 * @param value  Valor a ser debounced
 * @param delay  Atraso em milissegundos (padrão: 200ms)
 */
export function useDebounce<T>(value: T, delay = 200): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
