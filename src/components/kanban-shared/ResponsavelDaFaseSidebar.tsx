'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { upsertFaseChecklistResposta } from '@/lib/actions/card-actions';
import { UsuarioChecklistSelect } from '@/components/kanban-shared/UsuarioChecklistSelect';
import {
  buscarItemIdResponsavelDaFaseEdicao,
  isValorUsuarioUuid,
  resolverProfileIdPorValorChecklistUsuario,
} from '@/lib/kanban/responsavel-fase-checklist';

type Props = {
  cardId: string;
  faseId: string;
  nomeFranqueadoRede?: string | null;
  opcoes?: { id: string; nome: string }[];
  readOnly?: boolean;
};

function normalizarValorUsuario(valor: string | null | undefined): string {
  const v = String(valor ?? '').trim();
  return v && isValorUsuarioUuid(v) ? v : '';
}

/** Campo «Responsável da fase» no painel lateral — mesma lista do responsável do card. */
export function ResponsavelDaFaseSidebar({
  cardId,
  faseId,
  nomeFranqueadoRede = null,
  opcoes,
  readOnly = false,
}: Props) {
  const [itemId, setItemId] = useState<string | null>(null);
  const [valor, setValor] = useState('');
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

      const iid = (await buscarItemIdResponsavelDaFaseEdicao(supabase, faseId)) ?? '';
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

      const valorBruto = (resp as { valor?: string | null } | null)?.valor;
      let valorAtual = normalizarValorUsuario(valorBruto);

      if (!valorAtual) {
        const resolvido = await resolverProfileIdPorValorChecklistUsuario(supabase, valorBruto);
        if (resolvido) {
          valorAtual = resolvido;
          await upsertFaseChecklistResposta({
            item_id: iid,
            card_id: cardId,
            valor: resolvido,
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
    const uid = normalizarValorUsuario(userId);
    setValor(uid);
    setSalvando(true);
    await upsertFaseChecklistResposta({
      item_id: itemId,
      card_id: cardId,
      valor: uid || null,
      arquivo_path: null,
    });
    setSalvando(false);
  }

  if (carregando) {
    return <p className="text-[10px] text-stone-400">Carregando responsável…</p>;
  }

  if (!itemId) {
    return (
      <p className="text-[10px] text-stone-400">
        Campo não configurado nesta fase. Aplique a migration 404 no Supabase.
      </p>
    );
  }

  if (readOnly) {
    return (
      <p className="text-[11px] text-stone-700">
        {valor ? (
          <ResponsavelDaFaseSidebarReadonly userId={valor} fallbackNome={nomeRede} />
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
      opcoes={opcoes}
      placeholder="Selecione o responsável…"
      selectedLabelOverride={!valor && nomeRede ? nomeRede : undefined}
      menuPortal
      onChange={(v) => void salvar(v)}
    />
  );
}

function ResponsavelDaFaseSidebarReadonly({
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
