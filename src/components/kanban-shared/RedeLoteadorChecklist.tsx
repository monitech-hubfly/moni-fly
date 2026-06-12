'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, ExternalLink, Loader2 } from 'lucide-react';
import { RedeLoteadorFichaForm } from '@/components/RedeLoteadorFichaForm';
import {
  carregarRedeLoteadorChecklistData,
  carregarRedeLoteadorPorId,
  salvarRedeLoteadorChecklistFunil,
  type RedeLoteadorChecklistModo,
} from '@/lib/actions/kanban-rede-loteador-checklist';
import {
  emptyRedeLoteadorFichaDraft,
  redeLoteadorRowToFichaDraft,
  type RedeLoteadorFichaDraft,
} from '@/lib/rede-loteador-ficha-draft';

type Props = {
  cardId: string;
  itemId: string;
  itemLabel: string;
  onSalvo?: (redeLoteadorId: string) => void;
};

export function RedeLoteadorChecklist({ cardId, itemId, itemLabel, onSalvo }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [modo, setModo] = useState<RedeLoteadorChecklistModo>('novo');
  const [selecionadoId, setSelecionadoId] = useState('');
  const [vinculadoId, setVinculadoId] = useState<string | null>(null);
  const [opcoes, setOpcoes] = useState<{ id: string; nome: string; cidade: string | null; estado: string | null }[]>(
    [],
  );
  const [draft, setDraft] = useState<RedeLoteadorFichaDraft>(() => emptyRedeLoteadorFichaDraft('em_analise'));
  const [busca, setBusca] = useState('');

  const recarregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    const r = await carregarRedeLoteadorChecklistData(cardId);
    setLoading(false);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    setModo(r.modoInicial);
    setVinculadoId(r.cardRedeLoteadorId);
    setSelecionadoId(r.cardRedeLoteadorId ?? '');
    setOpcoes(r.opcoes);
    setDraft(r.draftInicial);
  }, [cardId]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const opcoesFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return opcoes;
    return opcoes.filter((o) => {
      const blob = [o.nome, o.cidade, o.estado].filter(Boolean).join(' ').toLowerCase();
      return blob.includes(q);
    });
  }, [opcoes, busca]);

  const onModoChange = (next: RedeLoteadorChecklistModo) => {
    setModo(next);
    setMsg(null);
    if (next === 'novo') {
      setSelecionadoId('');
      setDraft(emptyRedeLoteadorFichaDraft('em_analise'));
    } else if (vinculadoId) {
      setSelecionadoId(vinculadoId);
    }
  };

  const onSelecionarExistente = async (id: string) => {
    setSelecionadoId(id);
    setMsg(null);
    if (!id) {
      setDraft(emptyRedeLoteadorFichaDraft('em_analise'));
      return;
    }
    setSaving(true);
    const r = await carregarRedeLoteadorPorId(id);
    setSaving(false);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    setDraft(redeLoteadorRowToFichaDraft(r.loteador));
  };

  const salvar = async () => {
    setSaving(true);
    setErro(null);
    setMsg(null);
    const r = await salvarRedeLoteadorChecklistFunil({
      cardId,
      itemId,
      modo,
      redeLoteadorIdSelecionado: modo === 'existente' ? selecionadoId : null,
      draft,
    });
    setSaving(false);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    setMsg(r.mensagem);
    setVinculadoId(r.redeLoteadorId);
    setSelecionadoId(r.redeLoteadorId);
    if (modo === 'novo') setModo('existente');
    onSalvo?.(r.redeLoteadorId);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-stone-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando cadastro de loteadores…
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-stone-200 bg-stone-50/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-stone-800">{itemLabel}</p>
          <p className="mt-0.5 text-xs text-stone-500">
            Os dados são salvos em{' '}
            <Link href="/rede-franqueados?tab=loteadores" className="text-[#0c2633] underline-offset-2 hover:underline">
              Rede de Franqueados → Rede de Loteadores
            </Link>
            .
          </p>
        </div>
        {vinculadoId ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-800">
            <Check className="h-3 w-3" />
            Vinculado
          </span>
        ) : null}
      </div>

      {erro ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {erro}
        </div>
      ) : null}
      {msg ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900" role="status">
          {msg}
        </div>
      ) : null}

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold uppercase tracking-wide text-stone-500">Modo de cadastro</legend>
        <div className="flex flex-wrap gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-800">
            <input
              type="radio"
              name={`modo-loteador-${itemId}`}
              checked={modo === 'novo'}
              onChange={() => onModoChange('novo')}
            />
            Cadastrar novo loteador
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-800">
            <input
              type="radio"
              name={`modo-loteador-${itemId}`}
              checked={modo === 'existente'}
              onChange={() => onModoChange('existente')}
            />
            Selecionar loteador existente
          </label>
        </div>
      </fieldset>

      {modo === 'existente' ? (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-stone-600">Loteador na rede</label>
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Filtrar por nome ou cidade…"
            className="w-full max-w-md rounded-md border border-stone-300 px-3 py-2 text-sm"
          />
          <select
            value={selecionadoId}
            onChange={(e) => void onSelecionarExistente(e.target.value)}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
          >
            <option value="">— Selecione —</option>
            {opcoesFiltradas.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
                {o.cidade || o.estado ? ` · ${[o.cidade, o.estado].filter(Boolean).join(' / ')}` : ''}
              </option>
            ))}
          </select>
          {vinculadoId ? (
            <Link
              href="/rede-franqueados?tab=loteadores"
              className="inline-flex items-center gap-1 text-xs text-stone-600 hover:text-stone-900"
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir tabela na Rede de Loteadores
              <ExternalLink className="h-3 w-3" />
            </Link>
          ) : null}
        </div>
      ) : null}

      <RedeLoteadorFichaForm
        draft={draft}
        onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
        showStatus={modo === 'existente'}
        sectionIdPrefix={`funil-${itemId}`}
      />

      <div className="flex justify-end border-t border-stone-200 pt-3">
        <button
          type="button"
          onClick={() => void salvar()}
          disabled={saving || !draft.nome.trim() || (modo === 'existente' && !selecionadoId)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#0c2633] px-4 py-2 text-sm font-medium text-white hover:bg-[#163d4d] disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {modo === 'novo' ? 'Cadastrar na Rede de Loteadores' : 'Salvar e vincular ao card'}
        </button>
      </div>
    </div>
  );
}
