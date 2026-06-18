'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { upsertFaseChecklistResposta } from '@/lib/actions/card-actions';
import { UsuarioChecklistSelect } from '@/components/kanban-shared/UsuarioChecklistSelect';
import {
  buscarItemIdResponsavelFaseEdicao,
  buscarValorResponsavelFaseAnterior,
} from '@/lib/kanban/responsavel-fase-checklist';

type Props = {
  cardId: string;
  faseId: string;
  readOnly?: boolean;
  onChange?: (userId: string, nome?: string | null) => void;
};

/** Campo «Responsável da fase» no painel lateral do modal (acima de Tags). */
export function ResponsavelFaseSidebar({ cardId, faseId, readOnly = false, onChange }: Props) {
  const [itemId, setItemId] = useState<string | null>(null);
  const [valor, setValor] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const syncFeitoRef = useRef('');

  useEffect(() => {
    syncFeitoRef.current = '';
  }, [cardId, faseId]);

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

      const { data: resp } = await supabase
        .from('kanban_fase_checklist_respostas')
        .select('valor')
        .eq('card_id', cardId)
        .eq('item_id', iid)
        .maybeSingle();

      let valorAtual = String((resp as { valor?: string | null } | null)?.valor ?? '').trim();

      const syncKey = `${cardId}:${faseId}`;
      if (!valorAtual && syncFeitoRef.current !== syncKey) {
        syncFeitoRef.current = syncKey;
        const herdado = await buscarValorResponsavelFaseAnterior(supabase, cardId, faseId);
        if (herdado) {
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
  }, [cardId, faseId]);

  async function salvar(userId: string) {
    if (!itemId || readOnly) return;
    setValor(userId);
    setSalvando(true);
    const res = await upsertFaseChecklistResposta({
      item_id: itemId,
      card_id: cardId,
      valor: userId || null,
      arquivo_path: null,
    });
    setSalvando(false);
    if (res.ok) onChange?.(userId);
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

  if (readOnly) {
    return (
      <p className="text-[11px] text-stone-700">
        {valor ? (
          <ResponsavelFaseSidebarReadonly userId={valor} />
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
      onChange={(v) => void salvar(v)}
    />
  );
}

function ResponsavelFaseSidebarReadonly({ userId }: { userId: string }) {
  const [nome, setNome] = useState<string | null>(null);

  useEffect(() => {
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

  return <span>{nome ?? '…'}</span>;
}
