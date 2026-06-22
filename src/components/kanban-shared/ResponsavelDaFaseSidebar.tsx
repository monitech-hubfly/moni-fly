'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { upsertFaseChecklistResposta } from '@/lib/actions/card-actions';
import {
  aplicarResponsavelDaFasePadraoSeVazio,
  buscarItemIdResponsavelDaFaseEdicao,
  isValorResponsavelDaFaseLista,
  isValorUsuarioUuid,
  OPCOES_RESPONSAVEL_DA_FASE,
} from '@/lib/kanban/responsavel-fase-checklist';

type Props = {
  cardId: string;
  faseId: string;
  readOnly?: boolean;
};

function normalizarValorLista(valor: string | null | undefined): string {
  const v = String(valor ?? '').trim();
  return isValorResponsavelDaFaseLista(v) ? v : '';
}

/** Campo «Responsável da fase» no painel lateral — lista Moní ou Franqueado. */
export function ResponsavelDaFaseSidebar({ cardId, faseId, readOnly = false }: Props) {
  const [itemId, setItemId] = useState<string | null>(null);
  const [valor, setValor] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);

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
      let valorAtual = normalizarValorLista(valorBruto);

      if (!valorAtual || isValorUsuarioUuid(valorBruto)) {
        const { data: authData } = await supabase.auth.getUser();
        const aplicado = await aplicarResponsavelDaFasePadraoSeVazio(
          supabase,
          cardId,
          faseId,
          authData.user?.id ?? null,
        );
        if (aplicado) valorAtual = aplicado;
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

  async function salvar(novoValor: string) {
    if (!itemId || readOnly) return;
    const v = normalizarValorLista(novoValor);
    setValor(v);
    setSalvando(true);
    await upsertFaseChecklistResposta({
      item_id: itemId,
      card_id: cardId,
      valor: v || null,
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
        Campo não configurado nesta fase. Aplique a migration 406 no Supabase.
      </p>
    );
  }

  if (readOnly) {
    return (
      <p className="text-[11px] text-stone-700">
        {valor ? valor : <span className="text-stone-400">Não definido</span>}
      </p>
    );
  }

  return (
    <select
      className="w-full rounded-md px-2 py-2 text-[11px] disabled:opacity-60"
      style={{
        fontFamily: 'var(--moni-font-sans)',
        color: 'var(--moni-text-primary)',
        background: 'var(--moni-surface-0)',
        border: 'var(--moni-border-width) solid var(--moni-border-default)',
        borderRadius: 'var(--moni-radius-md)',
        minHeight: '44px',
      }}
      value={valor}
      disabled={salvando}
      onChange={(e) => void salvar(e.target.value)}
    >
      <option value="">Selecione…</option>
      {OPCOES_RESPONSAVEL_DA_FASE.map((opcao) => (
        <option key={opcao} value={opcao}>
          {opcao}
        </option>
      ))}
    </select>
  );
}
