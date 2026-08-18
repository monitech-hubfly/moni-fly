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
import { filtrarSugestoesMencao } from '@/lib/kanban/mencao-comentario';
import {
  obterUsuariosMencaoPadrao,
  peekUsuariosMencaoPadrao,
} from '@/lib/mencoes/usuarios-mencao-cache';

type Sugestao = { id: string; nome: string };

type AnchorRect = { top: number; left: number; width: number };

type Props = {
  editorRef: RefObject<HTMLDivElement | null>;
  onInput: (html: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Substitui a busca padrão de usuários (ex: filtrar apenas team+admin). */
  buscarUsuarios?: (query: string) => Promise<{ id: string; nome: string }[]>;
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
  buscarUsuarios,
}: Props) {
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [posicaoAt, setPosicaoAt] = useState<number | null>(null);
  const [indiceSelecionado, setIndiceSelecionado] = useState(0);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const [carregandoLista, setCarregandoLista] = useState(false);
  const queryRef = useRef('');
  const customCacheRef = useRef<Sugestao[] | null>(null);
  const customInflightRef = useRef<Promise<Sugestao[]> | null>(null);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const fecharDropdown = useCallback(() => {
    setSugestoes([]);
    setPosicaoAt(null);
    setAnchor(null);
    setCarregandoLista(false);
    queryRef.current = '';
  }, []);

  const garantirLista = useCallback((): Promise<Sugestao[]> => {
    if (buscarUsuarios) {
      if (customCacheRef.current) return Promise.resolve(customCacheRef.current);
      if (!customInflightRef.current) {
        customInflightRef.current = buscarUsuarios('')
          .then((list) => {
            customCacheRef.current = list;
            return list;
          })
          .finally(() => {
            customInflightRef.current = null;
          });
      }
      return customInflightRef.current;
    }
    return obterUsuariosMencaoPadrao();
  }, [buscarUsuarios]);

  useEffect(() => {
    void garantirLista();
  }, [garantirLista]);

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

      const cached = buscarUsuarios ? customCacheRef.current : peekUsuariosMencaoPadrao();
      if (cached) {
        setCarregandoLista(false);
        setSugestoes(filtrarSugestoesMencao(cached, query));
        return;
      }

      setSugestoes(filtrarSugestoesMencao([], query));
      setCarregandoLista(true);
      void garantirLista()
        .then((lista) => {
          if (queryRef.current !== query) return;
          setCarregandoLista(false);
          setSugestoes(filtrarSugestoesMencao(lista, query));
          setAnchor(atualizarAnchor(el));
        })
        .catch(() => {
          if (queryRef.current !== query) return;
          setCarregandoLista(false);
        });
    },
    [buscarUsuarios, fecharDropdown, garantirLista],
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
    if (posicaoAt === null) return;
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
  }, [editorRef, posicaoAt]);

  const dropdown =
    portalReady && posicaoAt !== null && anchor ? (
      <ul
        role="listbox"
        aria-label="Mencionar usuário"
        className="fixed z-[9999] max-h-52 overflow-y-auto rounded-lg border border-stone-300 bg-white py-1 shadow-xl"
        style={{ top: anchor.top, left: anchor.left, width: anchor.width }}
      >
        {carregandoLista && sugestoes.length === 0 ? (
          <li className="px-3 py-2 text-sm text-stone-400">Carregando pessoas…</li>
        ) : sugestoes.length === 0 ? (
          <li className="px-3 py-2 text-sm text-stone-400">Nenhuma pessoa encontrada</li>
        ) : (
          sugestoes.map((s, i) => (
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
                {s.id === '__todos__' ? '📢 todos — notificar todos da Moní' : s.nome}
              </button>
            </li>
          ))
        )}
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
        onFocus={() => {
          void garantirLista();
        }}
        onBlur={() => {
          window.setTimeout(fecharDropdown, 150);
        }}
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData('text/plain');
          document.execCommand('insertText', false, text);
          const el = editorRef.current;
          if (el) onInput(el.innerHTML);
        }}
        className={className}
        data-placeholder={placeholder}
      />
      {dropdown && createPortal(dropdown, document.body)}
    </>
  );
}
