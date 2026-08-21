'use client';

import { createPortal } from 'react-dom';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, ArrowRight, MoreHorizontal, RotateCcw, TrendingDown, TrendingUp } from 'lucide-react';
import {
  arquivarCard,
  moverCardParaFase,
  registrarConfirmacaoFaseLoteadores,
  registrarPerda,
  registrarGanho,
  buscarMotivosPerda,
  reativarPerdaCard,
} from '@/lib/actions/card-actions';
import {
  MOTIVOS_ARQUIVAMENTO_CATEGORIAS,
  MOTIVO_ARQUIVAMENTO_OBS_MAX,
  MOTIVO_ARQUIVAMENTO_OBS_MIN,
  formatMotivoArquivamento,
  isMotivoArquivamentoOutro,
} from '@/lib/kanban/motivos-arquivamento';
import {
  deveConfirmarSaidaFaseLoteadores,
  loteadoresAssinouTituloPorSlug,
  loteadoresConfirmacaoTitulo,
  type LoteadoresConfirmacaoFaseTipo,
} from '@/lib/kanban/loteadores-confirmacao-fase';

const PERDA_GANHO_ENABLED = true;

type ProximaFase = { id: string; nome: string };

type Props = {
  cardId: string;
  origem?: 'legado' | 'nativo';
  basePath: string;
  kanbanNome?: string;
  kanbanId?: string;
  /** Slug da fase atual do card (para pop-up Assinou?). */
  faseAtualSlug?: string | null;
  /** Próxima fase ativa do funil (por `ordem`). `null` quando o card já está na última fase. */
  proximaFase: ProximaFase | null;
  cardArquivado?: boolean;
  cardResultado?: 'perda' | 'ganho' | null;
};

type Vista = 'menu' | 'arquivar' | 'perda' | 'ganho';

const LARGURA_MENU = 200;

export function KanbanCardMenu({
  cardId,
  origem = 'nativo',
  basePath,
  kanbanNome,
  kanbanId,
  faseAtualSlug = null,
  proximaFase,
  cardArquivado = false,
  cardResultado = null,
}: Props) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [vista, setVista] = useState<Vista>('menu');
  const [categoria, setCategoria] = useState('');
  const [observacaoOutro, setObservacaoOutro] = useState('');
  const [motivosPerda, setMotivosPerda] = useState<{ id: string; descricao: string }[]>([]);
  const [motivoSelecionado, setMotivoSelecionado] = useState('');
  const [justificativaPerda, setJustificativaPerda] = useState('');
  const [justificativaGanho, setJustificativaGanho] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [assinouPendente, setAssinouPendente] = useState<{
    tipo: LoteadoresConfirmacaoFaseTipo;
    titulo: string;
  } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const reposicionar = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.max(8, Math.min(rect.right - LARGURA_MENU, window.innerWidth - LARGURA_MENU - 8));
    setPos({ top: rect.bottom + 6, left });
  };

  useEffect(() => {
    if (!aberto) return;
    reposicionar();
    const onDown = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setAberto(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberto(false);
    };
    const onReflow = () => reposicionar();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [aberto]);

  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (aberto) {
      setAberto(false);
      return;
    }
    setVista('menu');
    setCategoria('');
    setObservacaoOutro('');
    setMotivoSelecionado('');
    setJustificativaPerda('');
    setJustificativaGanho('');
    setErro(null);
    reposicionar();
    setAberto(true);
  }

  function executarAvancar() {
    if (!proximaFase) return;
    setErro(null);
    startTransition(async () => {
      const res = await moverCardParaFase({
        cardId,
        novaFaseId: proximaFase.id,
        basePath,
        kanbanNome,
      });
      if (!res.ok) {
        window.alert(res.error ?? 'Não foi possível avançar o card de fase.');
        return;
      }
      setAssinouPendente(null);
      setAberto(false);
      router.refresh();
    });
  }

  function handleAvancar() {
    if (!proximaFase) return;
    const tipo = deveConfirmarSaidaFaseLoteadores({
      kanbanId,
      faseSlug: faseAtualSlug,
      origemCard: origem,
      direcao: 'avancar',
    });
    if (tipo) {
      setAssinouPendente({
        tipo,
        titulo:
          loteadoresAssinouTituloPorSlug(faseAtualSlug) ?? loteadoresConfirmacaoTitulo(tipo),
      });
      return;
    }
    executarAvancar();
  }

  function confirmarAssinou(confirmou: boolean) {
    if (!confirmou) {
      setAssinouPendente(null);
      return;
    }
    if (!assinouPendente) return;
    startTransition(async () => {
      const reg = await registrarConfirmacaoFaseLoteadores({
        cardId,
        tipo: assinouPendente.tipo,
        basePath,
      });
      if (!reg.ok) {
        window.alert(reg.error ?? 'Não foi possível registrar a confirmação.');
        return;
      }
      executarAvancar();
    });
  }

  function handleArquivar() {
    setErro(null);
    const cat = categoria.trim();
    if (!cat) {
      setErro('Selecione o motivo do arquivamento.');
      return;
    }
    const motivo = formatMotivoArquivamento(cat, observacaoOutro);
    if (isMotivoArquivamentoOutro(cat)) {
      const obs = observacaoOutro.trim();
      if (obs.length < MOTIVO_ARQUIVAMENTO_OBS_MIN || obs.length > MOTIVO_ARQUIVAMENTO_OBS_MAX) {
        setErro(`Para "Outro", descreva o motivo (${MOTIVO_ARQUIVAMENTO_OBS_MIN}–${MOTIVO_ARQUIVAMENTO_OBS_MAX} caracteres).`);
        return;
      }
    }
    startTransition(async () => {
      const res = await arquivarCard({ cardId, motivo, basePath, origem });
      if (!res.ok) {
        setErro(res.error ?? 'Não foi possível arquivar o card.');
        return;
      }
      setAberto(false);
      router.refresh();
    });
  }

  async function abrirPerda() {
    setErro(null);
    setVista('perda');
    if (motivosPerda.length === 0) {
      const m = await buscarMotivosPerda();
      setMotivosPerda(m);
    }
  }

  function handlePerda() {
    setErro(null);
    if (!motivoSelecionado) { setErro('Selecione o motivo da perda.'); return; }
    startTransition(async () => {
      const res = await registrarPerda({
        cardId,
        motivoId: motivoSelecionado,
        justificativa: justificativaPerda || null,
        basePath,
        kanbanNome,
      });
      if (!res.ok) { setErro(res.error ?? 'Erro ao registrar perda.'); return; }
      setAberto(false);
      router.refresh();
    });
  }

  function handleGanho() {
    setErro(null);
    startTransition(async () => {
      const res = await registrarGanho({
        cardId,
        justificativa: justificativaGanho || null,
        basePath,
        kanbanNome,
      });
      if (!res.ok) { setErro(res.error ?? 'Erro ao registrar ganho.'); return; }
      setAberto(false);
      router.refresh();
    });
  }

  function handleReativarPerda() {
    setErro(null);
    if (!window.confirm('Reativar este card? Ele voltará ao funil como ativo.')) return;
    startTransition(async () => {
      const res = await reativarPerdaCard({ cardId, basePath });
      if (!res.ok) { setErro(res.error ?? 'Erro ao reativar o card.'); return; }
      setAberto(false);
      router.refresh();
    });
  }

  const cardPerdaArquivada = cardArquivado && cardResultado === 'perda';

  const dropdown = aberto && pos ? (
    <div
      ref={menuRef}
      role="menu"
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, width: LARGURA_MENU }}
      className="moni-kanban-card-menu"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {vista === 'menu' && (
        <>
          {cardPerdaArquivada ? (
            <button
              type="button"
              role="menuitem"
              className="moni-kanban-card-menu-item"
              style={{ color: 'var(--moni-status-ok-text)' }}
              disabled={pending}
              onClick={handleReativarPerda}
            >
              <RotateCcw className="h-4 w-4 shrink-0" aria-hidden />
              <span>Reativar</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                role="menuitem"
                className="moni-kanban-card-menu-item"
                disabled={!proximaFase || pending}
                title={proximaFase ? `Avançar para "${proximaFase.nome}"` : 'Já está na última fase'}
                onClick={handleAvancar}
              >
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
                <span>Avançar fase</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="moni-kanban-card-menu-item moni-kanban-card-menu-item--danger"
                disabled={pending}
                onClick={() => { setErro(null); setVista('arquivar'); }}
              >
                <Archive className="h-4 w-4 shrink-0" aria-hidden />
                <span>Arquivar</span>
              </button>
              {PERDA_GANHO_ENABLED && (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    className="moni-kanban-card-menu-item moni-kanban-card-menu-item--danger"
                    disabled={pending}
                    onClick={() => { setErro(null); void abrirPerda(); }}
                  >
                    <TrendingDown className="h-4 w-4 shrink-0" aria-hidden />
                    <span>Perda</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="moni-kanban-card-menu-item"
                    style={{ color: 'var(--moni-status-ok-text)' }}
                    disabled={pending}
                    onClick={() => { setErro(null); setVista('ganho'); }}
                  >
                    <TrendingUp className="h-4 w-4 shrink-0" aria-hidden />
                    <span>Ganho</span>
                  </button>
                </>
              )}
            </>
          )}
        </>
      )}

      {vista === 'arquivar' && (
        <div className="moni-kanban-card-menu-arquivar">
          <p className="moni-kanban-card-menu-label">Motivo do arquivamento</p>
          <select
            className="moni-kanban-card-menu-select"
            value={categoria}
            onChange={(e) => { setCategoria(e.target.value); setErro(null); }}
          >
            <option value="">Selecione…</option>
            {MOTIVOS_ARQUIVAMENTO_CATEGORIAS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {isMotivoArquivamentoOutro(categoria) ? (
            <textarea
              className="moni-kanban-card-menu-textarea"
              value={observacaoOutro}
              onChange={(e) => setObservacaoOutro(e.target.value)}
              placeholder="Descreva o motivo…"
              rows={2}
              maxLength={MOTIVO_ARQUIVAMENTO_OBS_MAX}
            />
          ) : null}
          {erro ? <p className="moni-kanban-card-menu-erro">{erro}</p> : null}
          <div className="moni-kanban-card-menu-actions">
            <button
              type="button"
              className="moni-kanban-card-menu-btn moni-kanban-card-menu-btn--ghost"
              disabled={pending}
              onClick={() => { setVista('menu'); setErro(null); }}
            >
              Voltar
            </button>
            <button
              type="button"
              className="moni-kanban-card-menu-btn moni-kanban-card-menu-btn--danger"
              disabled={pending}
              onClick={handleArquivar}
            >
              {pending ? 'Arquivando…' : 'Arquivar'}
            </button>
          </div>
        </div>
      )}

      {vista === 'perda' && (
        <div className="moni-kanban-card-menu-arquivar">
          <p className="moni-kanban-card-menu-label">Motivo da perda</p>
          <select
            className="moni-kanban-card-menu-select"
            value={motivoSelecionado}
            onChange={(e) => { setMotivoSelecionado(e.target.value); setErro(null); }}
          >
            <option value="">Selecione…</option>
            {motivosPerda.map((m) => (
              <option key={m.id} value={m.id}>{m.descricao}</option>
            ))}
          </select>
          <textarea
            className="moni-kanban-card-menu-textarea"
            value={justificativaPerda}
            onChange={(e) => setJustificativaPerda(e.target.value)}
            placeholder="Justificativa adicional (opcional)…"
            rows={2}
          />
          {erro && <p className="moni-kanban-card-menu-erro">{erro}</p>}
          <div className="moni-kanban-card-menu-actions">
            <button
              type="button"
              className="moni-kanban-card-menu-btn moni-kanban-card-menu-btn--ghost"
              disabled={pending}
              onClick={() => { setVista('menu'); setErro(null); }}
            >
              Voltar
            </button>
            <button
              type="button"
              className="moni-kanban-card-menu-btn moni-kanban-card-menu-btn--danger"
              disabled={pending}
              onClick={handlePerda}
            >
              {pending ? 'Registrando…' : 'Confirmar perda'}
            </button>
          </div>
        </div>
      )}

      {vista === 'ganho' && (
        <div className="moni-kanban-card-menu-arquivar">
          <p className="moni-kanban-card-menu-label">Registrar ganho</p>
          <textarea
            className="moni-kanban-card-menu-textarea"
            value={justificativaGanho}
            onChange={(e) => setJustificativaGanho(e.target.value)}
            placeholder="Justificativa (opcional)…"
            rows={3}
          />
          {erro && <p className="moni-kanban-card-menu-erro">{erro}</p>}
          <div className="moni-kanban-card-menu-actions">
            <button
              type="button"
              className="moni-kanban-card-menu-btn moni-kanban-card-menu-btn--ghost"
              disabled={pending}
              onClick={() => { setVista('menu'); setErro(null); }}
            >
              Voltar
            </button>
            <button
              type="button"
              className="moni-kanban-card-menu-btn"
              style={{ background: 'var(--moni-status-ok-bg)', color: 'var(--moni-status-ok-text)' }}
              disabled={pending}
              onClick={handleGanho}
            >
              {pending ? 'Registrando…' : 'Confirmar ganho'}
            </button>
          </div>
        </div>
      )}
    </div>
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        onMouseDown={(e) => e.stopPropagation()}
        className="moni-kanban-card-footer-menu"
        aria-label="Ações do card"
        aria-haspopup="menu"
        aria-expanded={aberto}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </button>
      {typeof document !== 'undefined' && dropdown ? createPortal(dropdown, document.body) : null}
      {assinouPendente && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/50 p-4">
              <div
                className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
                role="dialog"
                aria-modal="true"
                style={{
                  borderRadius: 'var(--moni-radius-lg)',
                  border: 'var(--moni-border-width) solid var(--moni-border-default)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3
                  className="text-base font-semibold"
                  style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
                >
                  {assinouPendente.titulo}
                </h3>
                <p className="mt-3 text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
                  Confirme se o documento foi assinado para avançar de fase.
                </p>
                <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => confirmarAssinou(false)}
                    className="min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium"
                    style={{
                      borderRadius: 'var(--moni-radius-md)',
                      border: 'var(--moni-border-width) solid var(--moni-border-default)',
                      color: 'var(--moni-text-secondary)',
                    }}
                  >
                    Não
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => confirmarAssinou(true)}
                    className="min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium text-white"
                    style={{
                      borderRadius: 'var(--moni-radius-md)',
                      background: 'var(--moni-navy-800)',
                    }}
                  >
                    {pending ? 'Salvando…' : 'Sim'}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
