'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { upsertFaseChecklistResposta } from '@/lib/actions/card-actions';
import { UsuarioChecklistSelect } from '@/components/kanban-shared/UsuarioChecklistSelect';
import {
  buscarItemIdResponsavelFaseEdicao,
  buscarValorResponsavelFaseAnterior,
  isKanbanFunilStepOneId,
  isValorUsuarioUuid,
  sincronizarResponsavelFaseStepOne,
} from '@/lib/kanban/responsavel-fase-checklist';

type Props = {
  cardId: string;
  faseId: string;
  kanbanId?: string | null;
  /** Funil Step One: nome em `rede_franqueados` quando não há profile vinculado. */
  nomeFranqueadoRede?: string | null;
  readOnly?: boolean;
  onChange?: (userId: string, nome?: string | null) => void;
};

function normalizarValorUsuario(valor: string | null | undefined): string {
  const v = String(valor ?? '').trim();
  return v && isValorUsuarioUuid(v) ? v : '';
}

/** Campo «Responsável da fase» no painel lateral do modal (acima de Tags). */
export function ResponsavelFaseSidebar({
  cardId,
  faseId,
  kanbanId = null,
  nomeFranqueadoRede = null,
  readOnly = false,
  onChange,
}: Props) {
  const [itemId, setItemId] = useState<string | null>(null);
  const [valor, setValor] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const syncFeitoRef = useRef('');

  const stepOne = isKanbanFunilStepOneId(kanbanId);
  const somenteLeitura = readOnly;
  const nomeRede = String(nomeFranqueadoRede ?? '').trim();

  useEffect(() => {
    syncFeitoRef.current = '';
  }, [cardId, faseId, kanbanId]);

  useEffect(() => {
    if (!cardId.trim() || !faseId.trim()) {
      setCarregando(false);
      return;
    }

    let cancelado = false;
    void (async () => {
      setCarregando(true);
      const supabase = createClient();

      const iid = (await buscarItemIdResponsavelFaseEdicao(supabase, faseId)) ?? '';
      if (!iid) {
        if (!cancelado) {
          setItemId(null);
          setValor('');
          setCarregando(false);
        }
        return;
      }

      if (stepOne) {
        const franqueadoId = await sincronizarResponsavelFaseStepOne(supabase, cardId, faseId);
        const { data: resp } = await supabase
          .from('kanban_fase_checklist_respostas')
          .select('valor')
          .eq('card_id', cardId)
          .eq('item_id', iid)
          .maybeSingle();
        let valorAtual = normalizarValorUsuario((resp as { valor?: string | null } | null)?.valor);
        if (!valorAtual && franqueadoId) valorAtual = franqueadoId;

        if (!cancelado) {
          setItemId(iid);
          setValor(valorAtual);
          setCarregando(false);
        }
        return;
      }

      const { data: resp } = await supabase
        .from('kanban_fase_checklist_respostas')
        .select('valor')
        .eq('card_id', cardId)
        .eq('item_id', iid)
        .maybeSingle();

      let valorAtual = normalizarValorUsuario((resp as { valor?: string | null } | null)?.valor);

      const syncKey = `${cardId}:${faseId}`;
      if (!valorAtual && syncFeitoRef.current !== syncKey) {
        syncFeitoRef.current = syncKey;
        const herdado = await buscarValorResponsavelFaseAnterior(supabase, cardId, faseId);
        if (herdado && isValorUsuarioUuid(herdado)) {
          valorAtual = herdado;
          await upsertFaseChecklistResposta({
            item_id: iid,
            card_id: cardId,
            valor: herdado,
            arquivo_path: null,
          });
        }
      }

      if (!cancelado) {
        setItemId(iid);
        setValor(valorAtual);
        setCarregando(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [cardId, faseId, kanbanId, stepOne]);

  async function salvar(userId: string) {
    if (!itemId || somenteLeitura) return;
    const uid = normalizarValorUsuario(userId);
    setValor(uid);
    setSalvando(true);
    const res = await upsertFaseChecklistResposta({
      item_id: itemId,
      card_id: cardId,
      valor: uid || null,
      arquivo_path: null,
    });
    setSalvando(false);
    if (res.ok) {
      onChange?.(uid, null);
    }
  }

  if (carregando) {
    return <p className="text-[10px] text-stone-400">Carregando responsável…</p>;
  }

  if (!itemId) {
    return (
      <p className="text-[10px] text-stone-400">
        Campo não configurado nesta fase. Aplique a migration 380 no Supabase.
      </p>
    );
  }

  if (somenteLeitura) {
    return (
      <p className="text-[11px] text-stone-700">
        {valor ? (
          <ResponsavelFaseSidebarReadonly userId={valor} fallbackNome={nomeRede} />
        ) : nomeRede ? (
          nomeRede
        ) : (
          <span className="text-stone-400">Não definido</span>
        )}
      </p>
    );
  }

  return (
    <UsuarioChecklistSelect
      label=""
      value={valor}
      salvando={salvando}
      placeholder="Selecione o responsável…"
      selectedLabelOverride={!valor && nomeRede ? nomeRede : undefined}
      menuPortal
      onChange={(v) => void salvar(v)}
    />
  );
}

function ResponsavelFaseSidebarReadonly({
  userId,
  fallbackNome = null,
}: {
  userId: string;
  fallbackNome?: string | null;
}) {
  const [nome, setNome] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      const supabase = createClient();
      const { data } = await supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle();
      if (!cancelado) {
        const fn = String((data as { full_name?: string | null } | null)?.full_name ?? '').trim();
        setNome(fn || String(fallbackNome ?? '').trim() || userId.slice(0, 8));
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [userId, fallbackNome]);

  return <span>{nome ?? '…'}</span>;
}
