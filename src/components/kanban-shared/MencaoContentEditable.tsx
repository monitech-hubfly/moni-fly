'use client';

import { useCallback, useEffect, useRef, useState, type LegacyRef, type RefObject } from 'react';
import { buscarUsuariosParaMencao } from '@/lib/actions/kanban-comentarios';

type Sugestao = { id: string; nome: string };

type Props = {
  editorRef: RefObject<HTMLDivElement | null>;
  onInput: (html: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
};

function textoAntesDoCursor(el: HTMLElement): string {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return '';
  const range = sel.getRangeAt(0);
  const pre = range.cloneRange();
  pre.selectNodeContents(el);
  pre.setEnd(range.endContainer, range.endOffset);
  return pre.toString();
}

export function MencaoContentEditable({
  editorRef,
  onInput,
  className,
  placeholder,
  disabled,
}: Props) {
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [posicaoAt, setPosicaoAt] = useState<number | null>(null);
  const [indiceSelecionado, setIndiceSelecionado] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fecharDropdown = useCallback(() => {
    setSugestoes([]);
    setPosicaoAt(null);
  }, []);

  const detectarMencao = useCallback(
    (el: HTMLElement) => {
      const antes = textoAntesDoCursor(el);
      const match = antes.match(/@(\p{L}+)$/u);
      if (!match) {
        fecharDropdown();
        return;
      }
      const inicio = antes.length - match[0].length;
      const query = match[1];
      setPosicaoAt(inicio);
      setIndiceSelecionado(0);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void buscarUsuariosParaMencao(query).then(setSugestoes);
      }, 200);
    },
    [fecharDropdown],
  );

  const selecionarSugestao = useCallback(
    (sugestao: Sugestao) => {
      const el = editorRef.current;
      if (!el || posicaoAt === null) return;

      const antes = textoAntesDoCursor(el);
      const match = antes.match(/@(\p{L}+)$/u);
      if (!match) return;

      const prefixo = antes.slice(0, posicaoAt);
      const sufixo = el.innerText.slice(antes.length);
      const novoTexto = `${prefixo}@${sugestao.nome} ${sufixo}`;

      el.innerText = novoTexto;
      onInput(el.innerHTML);

      fecharDropdown();

      const novoCursor = prefixo.length + sugestao.nome.length + 2;
      requestAnimationFrame(() => {
        el.focus();
        const range = document.createRange();
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let charCount = 0;
        let node: Node | null = walker.nextNode();
        while (node) {
          const len = (node.textContent ?? '').length;
          if (charCount + len >= novoCursor) {
            range.setStart(node, novoCursor - charCount);
            range.collapse(true);
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
            break;
          }
          charCount += len;
          node = walker.nextNode();
        }
      });
    },
    [editorRef, fecharDropdown, onInput, posicaoAt],
  );

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    onInput(el.innerHTML);
    if (!disabled) detectarMencao(el);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
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
    <div className="relative">
      {sugestoes.length > 0 ? (
        <ul className="absolute bottom-full left-0 z-[60] mb-1 max-h-48 w-64 overflow-y-auto rounded-lg border border-stone-300 bg-white py-1 shadow-lg">
          {sugestoes.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  selecionarSugestao(s);
                }}
                className={`w-full px-3 py-1.5 text-left text-sm transition-colors ${
                  i === indiceSelecionado
                    ? 'bg-stone-100 text-stone-900'
                    : 'text-stone-700 hover:bg-stone-50'
                }`}
              >
                {s.nome}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div
        ref={editorRef as LegacyRef<HTMLDivElement>}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        className={className}
        data-placeholder={placeholder}
      />
    </div>
  );
}
