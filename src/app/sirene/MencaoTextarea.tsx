'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { buscarUsuariosInternos } from './actions';

type Sugestao = { id: string; nome: string; avatar_url: string | null };

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  disabled?: boolean;
  desabilitarMencoes?: boolean;
};

export function MencaoTextarea({ value, onChange, placeholder, rows = 2, className, disabled, desabilitarMencoes = false }: Props) {
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [posicaoAt, setPosicaoAt] = useState<number | null>(null);
  const [indiceSelecionado, setIndiceSelecionado] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const detectarMencao = useCallback((texto: string, cursor: number) => {
    const antes = texto.slice(0, cursor);
    // Só abre dropdown para letras simples sem espaço (e.g. @jo, @maria)
    const match = antes.match(/@(\p{L}+)$/u);
    if (!match) {
      setPosicaoAt(null);
      setSugestoes([]);
      return;
    }
    const inicio = cursor - match[0].length;
    const query = match[1];
    setPosicaoAt(inicio);
    setIndiceSelecionado(0);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      buscarUsuariosInternos(query).then((res) => {
        setSugestoes(res);
      });
    }, 200);
  }, []);

  const fecharDropdown = useCallback(() => {
    setSugestoes([]);
    setPosicaoAt(null);
  }, []);

  const selecionarSugestao = useCallback(
    (sugestao: Sugestao) => {
      if (posicaoAt === null) return;
      const cursor = textareaRef.current?.selectionStart ?? value.length;
      const novoValor =
        value.slice(0, posicaoAt) + `@${sugestao.nome} ` + value.slice(cursor);
      onChange(novoValor);
      fecharDropdown();
      const novoCursor = posicaoAt + sugestao.nome.length + 2; // @ + nome + espaço
      setTimeout(() => {
        textareaRef.current?.setSelectionRange(novoCursor, novoCursor);
        textareaRef.current?.focus();
      }, 0);
    },
    [posicaoAt, value, onChange, fecharDropdown],
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    if (!desabilitarMencoes) detectarMencao(e.target.value, e.target.selectionStart);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (sugestoes.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndiceSelecionado((i) => (i + 1) % sugestoes.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndiceSelecionado((i) => (i - 1 + sugestoes.length) % sugestoes.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      const s = sugestoes[indiceSelecionado];
      if (s) {
        e.preventDefault();
        selecionarSugestao(s);
      }
    } else if (e.key === 'Escape') {
      fecharDropdown();
    }
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="relative min-w-[200px] flex-1">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={className}
        disabled={disabled}
      />
      {sugestoes.length > 0 && (
        <ul className="absolute bottom-full left-0 z-50 mb-1 w-64 overflow-hidden rounded-lg border border-stone-600 bg-stone-800 py-1 shadow-lg">
          {sugestoes.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault(); // mantém foco no textarea
                  selecionarSugestao(s);
                }}
                className={`w-full px-3 py-1.5 text-left text-sm transition-colors ${
                  i === indiceSelecionado
                    ? 'bg-stone-600 text-stone-100'
                    : 'text-stone-300 hover:bg-stone-700'
                }`}
              >
                {s.nome}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
