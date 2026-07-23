'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { upsertFaseChecklistResposta } from '@/lib/actions/card-actions';
import { SearchableSelect } from '@/components/SearchableSelect';
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
  /** Notifica o modal após persistir (ex.: atualizar calculadora). */
  onAlterado?: (faseId: string, valor: string) => void;
};

function normalizarValorLista(valor: string | null | undefined): string {
  const v = String(valor ?? '').trim();
  return isValorResponsavelDaFaseLista(v) ? v : '';
}

/** Campo «Responsável da fase» no painel lateral — lista Moní ou Franqueado. */
export function ResponsavelDaFaseSidebar({ cardId, faseId, readOnly = false, onAlterado }: Props) {
  const [itemId, setItemId] = useState<string | null>(null);
  const [valor, setValor] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  const selectOptions = useMemo(
    () => OPCOES_RESPONSAVEL_DA_FASE.map((opcao) => ({ value: opcao, label: opcao })),
    [],
  );

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
    const valorAnterior = valor;
    setValor(v);
    setSalvando(true);
    setErroSalvar(null);
    const res = await upsertFaseChecklistResposta({
      item_id: itemId,
      card_id: cardId,
      valor: v || null,
    });
    setSalvando(false);
    if (!res.ok) {
      setValor(valorAnterior);
      setErroSalvar(res.error ?? 'Não foi possível salvar o responsável da fase.');
      return;
    }
    onAlterado?.(faseId, v);
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
    <div>
      {salvando ? <Loader2 size={10} className="mb-1 inline animate-spin" /> : null}
      {erroSalvar ? (
        <p className="mb-1 text-[10px]" style={{ color: 'var(--moni-error-600, #9b2c2c)' }}>
          {erroSalvar}
        </p>
      ) : null}
      <SearchableSelect
        value={valor}
        onChange={(v) => void salvar(v)}
        options={selectOptions}
        placeholder="Selecione o responsável…"
        searchPlaceholder="Buscar…"
        size="compact"
        emptyOption={{ value: '', label: 'Selecione o responsável…' }}
        listMaxHeightClassName="max-h-48"
        triggerClassName="border-[var(--moni-border-default)] text-[var(--moni-text-primary)]"
        menuPortal
        disabled={salvando}
        aria-label="Responsável da fase"
      />
    </div>
  );
}
