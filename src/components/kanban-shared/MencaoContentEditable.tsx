'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type LegacyRef,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { buscarUsuariosParaMencao } from '@/lib/actions/kanban-comentarios';

type Sugestao = { id: string; nome: string };

type AnchorRect = { top: number; left: number; width: number };

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
  if (!el.contains(range.startContainer)) return '';
  const pre = range.cloneRange();
  pre.selectNodeContents(el);
  pre.setEnd(range.endContainer, range.endOffset);
  return pre.toString();
}

function atualizarAnchor(el: HTMLElement): AnchorRect {
  const rect = el.getBoundingClientRect();
  return {
    top: rect.bottom + 4,
    left: rect.left,
    width: Math.max(rect.width, 256),
  };
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
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryRef = useRef('');

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const fecharDropdown = useCallback(() => {
    setSugestoes([]);
    setPosicaoAt(null);
    setAnchor(null);
    queryRef.current = '';
  }, []);

  const detectarMencao = useCallback(
    (el: HTMLElement) => {
      const antes = textoAntesDoCursor(el);
      const match = antes.match(/@([\p{L}]*)$/u);
      if (!match) {
        fecharDropdown();
        return;
      }
      const inicio = antes.length - match[0].length;
      const query = match[1];
      setPosicaoAt((prev) => {
        if (prev !== inicio) setIndiceSelecionado(0);
        return inicio;
      });
      setAnchor(atualizarAnchor(el));
      queryRef.current = query;

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void buscarUsuariosParaMencao(query).then((res) => {
          if (queryRef.current !== query) return;
          setSugestoes(res);
          setAnchor(atualizarAnchor(el));
        });
      }, 150);
    },
    [fecharDropdown],
  );

  const selecionarSugestao = useCallback(
    (sugestao: Sugestao) => {
      const el = editorRef.current;
      if (!el || posicaoAt === null) return;

      const antes = textoAntesDoCursor(el);
      const match = antes.match(/@([\p{L}]*)$/u);
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

  const handleInput = (e: FormEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    onInput(el.innerHTML);
    if (!disabled) detectarMencao(el);
  };

  const handleKeyUp = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key === 'Escape') {
      fecharDropdown();
      return;
    }
    detectarMencao(e.currentTarget);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
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
    if (!sugestoes.length) return;
    const el = editorRef.current;
    if (!el) return;

    const sync = () => setAnchor(atualizarAnchor(el));
    sync();
    window.addEventListener('scroll', sync, true);
    window.addEventListener('resize', sync);
    return () => {
      window.removeEventListener('scroll', sync, true);
      window.removeEventListener('resize', sync);
    };
  }, [editorRef, sugestoes.length]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const dropdown =
    portalReady && sugestoes.length > 0 && anchor ? (
      <ul
        role="listbox"
        aria-label="Mencionar usuário"
        className="fixed z-[9999] max-h-52 overflow-y-auto rounded-lg border border-stone-300 bg-white py-1 shadow-xl"
        style={{ top: anchor.top, left: anchor.left, width: anchor.width }}
      >
        {sugestoes.map((s, i) => (
          <li key={s.id} role="option" aria-selected={i === indiceSelecionado}>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                selecionarSugestao(s);
              }}
              className={`w-full px-3 py-2 text-left text-sm transition-colors ${
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
    ) : null;

  return (
    <>
      <div
        ref={editorRef as LegacyRef<HTMLDivElement>}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyUp={handleKeyUp}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          window.setTimeout(fecharDropdown, 150);
        }}
        className={className}
        data-placeholder={placeholder}
      />
      {dropdown && createPortal(dropdown, document.body)}
    </>
  );
}
