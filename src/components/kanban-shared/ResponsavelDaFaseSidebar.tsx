'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { upsertFaseChecklistResposta } from '@/lib/actions/card-actions';
import { UsuarioChecklistSelect } from '@/components/kanban-shared/UsuarioChecklistSelect';
import {
  RESPONSAVEL_DA_FASE_TIPO_FRANQUEADO,
  RESPONSAVEL_DA_FASE_TIPO_MONI,
  buscarItensResponsavelDaFaseEdicao,
  isValorUsuarioUuid,
} from '@/lib/kanban/responsavel-fase-checklist';

type TipoResponsavelDaFase = 'franqueado' | 'moni' | '';

type Props = {
  cardId: string;
  faseId: string;
  nomeFranqueadoRede?: string | null;
  /** Catálogo Moní (profiles) para opção Moní. */
  opcoesMoni?: { id: string; nome: string }[];
  readOnly?: boolean;
};

function parseTipoValor(valor: string | null | undefined): TipoResponsavelDaFase {
  const v = String(valor ?? '').trim();
  if (v === RESPONSAVEL_DA_FASE_TIPO_FRANQUEADO) return 'franqueado';
  if (v === RESPONSAVEL_DA_FASE_TIPO_MONI) return 'moni';
  return '';
}

function tipoParaValor(tipo: TipoResponsavelDaFase): string {
  if (tipo === 'franqueado') return RESPONSAVEL_DA_FASE_TIPO_FRANQUEADO;
  if (tipo === 'moni') return RESPONSAVEL_DA_FASE_TIPO_MONI;
  return '';
}

function normalizarUuid(valor: string | null | undefined): string {
  const v = String(valor ?? '').trim();
  return v && isValorUsuarioUuid(v) ? v : '';
}

/** «Responsável da fase» — Franqueado (rede) ou Moní (time). */
export function ResponsavelDaFaseSidebar({
  cardId,
  faseId,
  nomeFranqueadoRede = null,
  opcoesMoni = [],
  readOnly = false,
}: Props) {
  const [tipoItemId, setTipoItemId] = useState<string | null>(null);
  const [usuarioItemId, setUsuarioItemId] = useState<string | null>(null);
  const [tipo, setTipo] = useState<TipoResponsavelDaFase>('');
  const [usuarioMoni, setUsuarioMoni] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const nomeRede = String(nomeFranqueadoRede ?? '').trim();

  useEffect(() => {
    if (!cardId.trim() || !faseId.trim()) {
      setCarregando(false);
      return;
    }

    let cancelado = false;
    void (async () => {
      setCarregando(true);
      const supabase = createClient();
      const itens = await buscarItensResponsavelDaFaseEdicao(supabase, faseId);

      if (!itens.tipoItemId || !itens.usuarioItemId) {
        if (!cancelado) {
          setTipoItemId(null);
          setUsuarioItemId(null);
          setTipo('');
          setUsuarioMoni('');
          setCarregando(false);
        }
        return;
      }

      const { data: respostas } = await supabase
        .from('kanban_fase_checklist_respostas')
        .select('item_id, valor')
        .eq('card_id', cardId)
        .in('item_id', [itens.tipoItemId, itens.usuarioItemId]);

      const map = new Map(
        ((respostas ?? []) as { item_id: string; valor?: string | null }[]).map((r) => [
          r.item_id,
          r.valor,
        ]),
      );

      if (!cancelado) {
        setTipoItemId(itens.tipoItemId);
        setUsuarioItemId(itens.usuarioItemId);
        setTipo(parseTipoValor(map.get(itens.tipoItemId) as string | null | undefined));
        setUsuarioMoni(normalizarUuid(map.get(itens.usuarioItemId) as string | null | undefined));
        setCarregando(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [cardId, faseId]);

  async function persistir(patch: {
    tipo?: TipoResponsavelDaFase;
    usuarioMoni?: string;
  }) {
    if (!tipoItemId || !usuarioItemId || readOnly) return;

    const nextTipo = patch.tipo !== undefined ? patch.tipo : tipo;
    const nextUsuario =
      patch.usuarioMoni !== undefined ? normalizarUuid(patch.usuarioMoni) : usuarioMoni;

    setSalvando(true);
    try {
      if (patch.tipo !== undefined) {
        setTipo(nextTipo);
        if (nextTipo === 'franqueado') {
          setUsuarioMoni('');
        }
      }
      if (patch.usuarioMoni !== undefined) {
        setUsuarioMoni(nextUsuario);
      }

      await upsertFaseChecklistResposta({
        item_id: tipoItemId,
        card_id: cardId,
        valor: tipoParaValor(nextTipo) || null,
        arquivo_path: null,
      });

      const valorUsuario =
        nextTipo === 'moni' ? nextUsuario || null : null;
      await upsertFaseChecklistResposta({
        item_id: usuarioItemId,
        card_id: cardId,
        valor: valorUsuario,
        arquivo_path: null,
      });
    } finally {
      setSalvando(false);
    }
  }

  async function selecionarTipo(novo: TipoResponsavelDaFase) {
    if (readOnly || novo === tipo) return;
    await persistir({ tipo: novo, usuarioMoni: novo === 'franqueado' ? '' : usuarioMoni });
  }

  const labelFranqueado = useMemo(() => {
    if (nomeRede) return nomeRede;
    return 'Franqueado não vinculado ao card';
  }, [nomeRede]);

  if (carregando) {
    return <p className="text-[10px] text-stone-400">Carregando…</p>;
  }

  if (!tipoItemId || !usuarioItemId) {
    return (
      <p className="text-[10px] text-stone-400">
        Campo não configurado nesta fase. Aplique a migration 403 no Supabase.
      </p>
    );
  }

  const btnBase =
    'flex-1 rounded-[var(--moni-radius-md)] border px-2 py-1.5 text-[10px] font-semibold transition min-h-[44px]';
  const btnAtivo = `${btnBase} border-[var(--moni-navy-800)] bg-[var(--moni-navy-800)] text-white`;
  const btnInativo = `${btnBase} border-[var(--moni-border-default)] bg-white text-[var(--moni-text-secondary)] hover:bg-[var(--moni-surface-50)]`;

  return (
    <div className="space-y-2">
      <div className="flex gap-1" role="group" aria-label="Tipo de responsável da fase">
        <button
          type="button"
          disabled={readOnly || salvando}
          className={tipo === 'franqueado' ? btnAtivo : btnInativo}
          onClick={() => void selecionarTipo('franqueado')}
        >
          Franqueado
        </button>
        <button
          type="button"
          disabled={readOnly || salvando}
          className={tipo === 'moni' ? btnAtivo : btnInativo}
          onClick={() => void selecionarTipo('moni')}
        >
          Moní
        </button>
      </div>

      {!tipo ? (
        <p className="text-[10px] text-[var(--moni-text-tertiary)]">Selecione Franqueado ou Moní.</p>
      ) : null}

      {tipo === 'franqueado' ? (
        <p className="text-[11px] text-[var(--moni-text-secondary)]">{labelFranqueado}</p>
      ) : null}

      {tipo === 'moni' ? (
        readOnly ? (
          <ResponsavelDaFaseMoniReadonly userId={usuarioMoni} opcoes={opcoesMoni} />
        ) : (
          <UsuarioChecklistSelect
            label=""
            value={usuarioMoni}
            salvando={salvando}
            opcoes={opcoesMoni}
            placeholder="Selecione o responsável Moní…"
            menuPortal
            onChange={(v) => void persistir({ usuarioMoni: v })}
          />
        )
      ) : null}
    </div>
  );
}

function ResponsavelDaFaseMoniReadonly({
  userId,
  opcoes,
}: {
  userId: string;
  opcoes: { id: string; nome: string }[];
}) {
  const hit = opcoes.find((o) => o.id === userId);
  if (hit?.nome) return <span className="text-[11px] text-stone-700">{hit.nome}</span>;
  return <ResponsavelDaFaseMoniReadonlyProfile userId={userId} />;
}

function ResponsavelDaFaseMoniReadonlyProfile({ userId }: { userId: string }) {
  const [nome, setNome] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setNome(null);
      return;
    }
    let cancelado = false;
    void (async () => {
      const supabase = createClient();
      const { data } = await supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle();
      if (!cancelado) {
        setNome(String((data as { full_name?: string | null } | null)?.full_name ?? '').trim() || userId.slice(0, 8));
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [userId]);

  if (!userId) return <span className="text-stone-400">Não definido</span>;
  return <span className="text-[11px] text-stone-700">{nome ?? '…'}</span>;
}
