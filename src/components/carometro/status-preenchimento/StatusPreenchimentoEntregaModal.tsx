'use client';

import { useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  iniciaisNome,
  labelIntervaloSemana,
  prazoPassouSemana,
  registroDentroDoPrazoSemana,
  type RegistroStatusPreenchimento,
  type SemanaColuna,
} from '@/utils/statusPreenchimento';
import { registrarEventoStatusPreenchimento } from '@/utils/statusPreenchimentoLog';
import type { ResponsavelArea } from './useStatusPreenchimentoData';

export type EntregaModalContext = {
  registro: RegistroStatusPreenchimento;
  areaNome: string;
  responsavel: ResponsavelArea;
  col: SemanaColuna;
};

type Props = {
  open: boolean;
  onClose: () => void;
  supabase: SupabaseClient;
  context: EntregaModalContext | null;
  authUserId: string | null;
  authNome: string;
  isAdmin: boolean;
  onDesfeito: () => void | Promise<void>;
};

function formatarDataExtenso(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatarHora(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function StatusPreenchimentoEntregaModal({
  open,
  onClose,
  supabase,
  context,
  authUserId,
  authNome,
  isAdmin,
  onDesfeito,
}: Props) {
  const [confirmando, setConfirmando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setConfirmando(false);
      setErro(null);
    }
  }, [open]);

  const dentroPrazo = useMemo(() => {
    if (!context) return false;
    return !prazoPassouSemana(context.col.semanaIso, context.col.ano);
  }, [context]);

  const noPrazoRegistro = useMemo(() => {
    if (!context?.registro.registrado_em) return true;
    return registroDentroDoPrazoSemana(
      context.registro.registrado_em,
      context.col.semanaIso,
      context.col.ano,
    );
  }, [context]);

  const podeDesfazer = useMemo(() => {
    if (!context || !authUserId || !dentroPrazo) return false;
    const dono = context.registro.usuario_id === authUserId;
    return dono || isAdmin;
  }, [context, authUserId, dentroPrazo, isAdmin]);

  async function confirmarExclusao() {
    if (!context?.registro.id || !podeDesfazer) return;
    setSalvando(true);
    setErro(null);
    const { error } = await supabase
      .from('status_preenchimento_registros')
      .delete()
      .eq('id', context.registro.id);
    if (error) {
      setErro(error.message);
      setSalvando(false);
      return;
    }
    const desc = `Registro desfeito — ${context.areaNome} · S${context.col.semanaIso} · por ${authNome}`;
    void registrarEventoStatusPreenchimento(
      'status_preenchimento_desfeito',
      desc,
      context.areaNome,
      'DELETE',
    );
    setSalvando(false);
    setConfirmando(false);
    await onDesfeito();
    onClose();
  }

  if (!open || !context) return null;

  const { registro, areaNome, responsavel, col } = context;

  return (
    <div className="sp-modal-overlay" role="dialog" aria-modal="true">
      <div className="sp-modal sp-modal--entrega">
        <button type="button" className="sp-modal-close" onClick={onClose} aria-label="Fechar">
          ×
        </button>
        <h2 className="sp-entrega-title">Entrega Registrada</h2>
        <p className="sp-modal-sub">
          {areaNome} · S{col.semanaIso} · {labelIntervaloSemana(col.semanaIso, col.ano)}
        </p>

        <div className="sp-entrega-card">
          <div className="sp-entrega-row">
            <span className="sp-entrega-label">Responsável</span>
            <span className="sp-entrega-valor sp-entrega-valor--resp">
              <span className="sp-avatar">{iniciaisNome(responsavel.nome)}</span>
              {responsavel.nome}
            </span>
          </div>
          <div className="sp-entrega-row">
            <span className="sp-entrega-label">Registrado em</span>
            <span className="sp-entrega-valor">
              {formatarDataExtenso(registro.registrado_em)} às {formatarHora(registro.registrado_em)}
            </span>
          </div>
          <div className="sp-entrega-row">
            <span className="sp-entrega-label">Status</span>
            <span
              className={
                noPrazoRegistro ? 'sp-entrega-status sp-entrega-status--ok' : 'sp-entrega-status sp-entrega-status--late'
              }
            >
              {noPrazoRegistro ? '✓ No prazo' : '✗ Fora do prazo'}
            </span>
          </div>
        </div>

        <hr className="sp-entrega-sep" />

        {confirmando ? (
          <div className="sp-entrega-confirm">
            <p className="sp-entrega-confirm-text">
              Tem certeza? O registro será removido e a semana voltará para Pendente.
            </p>
            {erro && <p className="sp-modal-erro">{erro}</p>}
            <div className="sp-entrega-confirm-btns">
              <button type="button" className="sp-btn-secundario" onClick={() => setConfirmando(false)} disabled={salvando}>
                Cancelar
              </button>
              <button type="button" className="sp-btn-excluir-confirm" onClick={confirmarExclusao} disabled={salvando}>
                Confirmar exclusão
              </button>
            </div>
          </div>
        ) : (
          <>
            {podeDesfazer ? (
              <button type="button" className="sp-btn-desfazer" onClick={() => setConfirmando(true)}>
                Desfazer registro
              </button>
            ) : !dentroPrazo ? (
              <p className="sp-entrega-prazo-msg">O prazo desta semana encerrou — não é possível desfazer.</p>
            ) : null}
            {erro && <p className="sp-modal-erro">{erro}</p>}
            <div className="sp-entrega-footer">
              <button type="button" className="sp-btn-secundario" onClick={onClose}>
                Fechar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
