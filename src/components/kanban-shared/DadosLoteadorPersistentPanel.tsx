'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronDown, ChevronRight, Copy, ExternalLink, Loader2 } from 'lucide-react';
import { RedeLoteadorFichaForm } from '@/components/RedeLoteadorFichaForm';
import {
  carregarRedeLoteadorChecklistData,
  carregarRedeLoteadorPorId,
  type RedeLoteadorChecklistModo,
} from '@/lib/actions/kanban-rede-loteador-checklist';
import {
  obterOuGerarLinkExternoLoteador,
  salvarRedeLoteadorPersistenteCard,
} from '@/lib/actions/loteador-externo-actions';
import {
  emptyRedeLoteadorFichaDraft,
  redeLoteadorRowToFichaDraft,
  type RedeLoteadorFichaDraft,
} from '@/lib/rede-loteador-ficha-draft';
import { calcularStatsFichaLoteador } from '@/lib/rede-loteador-ficha-stats';
import { createClient } from '@/lib/supabase/client';

type Props = {
  cardId: string;
  /** `sidebar`: corpo para a coluna esquerda do card (sem accordion próprio). */
  variant?: 'standalone' | 'sidebar';
  onSalvo?: (redeLoteadorId: string) => void;
};

export function DadosLoteadorPersistentPanel({
  cardId,
  variant = 'standalone',
  onSalvo,
}: Props) {
  const isSidebar = variant === 'sidebar';
  const [expanded, setExpanded] = useState(false);
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
  const [linkExterno, setLinkExterno] = useState<string | null>(null);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<string | null>(null);
  const [responsavelUltima, setResponsavelUltima] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const stats = useMemo(() => calcularStatsFichaLoteador(draft), [draft]);

  const recarregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    const [r, linkR] = await Promise.all([
      carregarRedeLoteadorChecklistData(cardId),
      obterOuGerarLinkExternoLoteador(cardId),
    ]);
    setLoading(false);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    if (linkR.ok) setLinkExterno(linkR.url);

    setModo(r.modoInicial);
    setVinculadoId(r.cardRedeLoteadorId);
    setSelecionadoId(r.cardRedeLoteadorId ?? '');
    setOpcoes(r.opcoes);
    setDraft(r.draftInicial);

    if (r.loteador?.updated_at) setUltimaAtualizacao(r.loteador.updated_at);

    const ultimaPor = r.loteador?.ultima_atualizacao_por ?? null;
    if (ultimaPor) {
      const supabase = createClient();
      const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', ultimaPor).maybeSingle();
      setResponsavelUltima(String((prof as { full_name?: string | null } | null)?.full_name ?? '').trim() || null);
    } else {
      setResponsavelUltima(null);
    }
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
    const r = await salvarRedeLoteadorPersistenteCard({
      cardId,
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
    setUltimaAtualizacao(r.updatedAt);
    if (modo === 'novo') setModo('existente');
    onSalvo?.(r.redeLoteadorId);
    void recarregar();
  };

  const copiarLink = async () => {
    if (!linkExterno) return;
    try {
      await navigator.clipboard.writeText(linkExterno);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setErro('Não foi possível copiar o link.');
    }
  };

  const fmtData = (iso: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('pt-BR');
    } catch {
      return iso;
    }
  };

  const resumoStats = (
    <div className={`flex flex-wrap gap-x-3 gap-y-1 ${isSidebar ? 'text-[10px] text-stone-500' : 'text-xs'}`}>
      <span>{stats.percentual}% preenchido</span>
      <span>{stats.preenchidos} preenchidos</span>
      <span>{stats.pendentes} pendentes</span>
      <span>Atualizado: {fmtData(ultimaAtualizacao)}</span>
      {responsavelUltima ? <span>Por: {responsavelUltima}</span> : null}
    </div>
  );

  const corpo = loading ? (
    <div className={`flex items-center gap-2 py-3 ${isSidebar ? 'text-[11px]' : 'text-sm'} text-stone-500`}>
      <Loader2 className="h-4 w-4 animate-spin" />
      Carregando…
    </div>
  ) : (
    <div className={isSidebar ? 'space-y-3' : 'space-y-4'}>
      {isSidebar ? resumoStats : null}

      {linkExterno ? (
        <div
          className={`flex flex-wrap items-center gap-2 rounded-md border border-stone-200 bg-white px-2 py-1.5 ${isSidebar ? 'text-[10px]' : 'text-xs'}`}
        >
          <ExternalLink className="h-3 w-3 shrink-0 text-stone-500" />
          <span className="min-w-0 flex-1 truncate text-stone-600">{linkExterno}</span>
          <button
            type="button"
            onClick={() => void copiarLink()}
            className="inline-flex items-center gap-0.5 rounded border border-stone-200 px-1.5 py-0.5 hover:bg-stone-50"
          >
            <Copy className="h-3 w-3" />
            {copiado ? 'Ok' : 'Copiar'}
          </button>
          <a
            href={linkExterno}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#0c2633] underline-offset-2 hover:underline"
          >
            Abrir
          </a>
        </div>
      ) : null}

      {!isSidebar ? (
        <p className="text-xs text-stone-500">
          Sincronizado com{' '}
          <Link href="/rede-franqueados?tab=loteadores" className="underline-offset-2 hover:underline">
            Rede de Loteadores
          </Link>
          .
        </p>
      ) : null}

      {vinculadoId ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-800">
          <Check className="h-3 w-3" />
          Loteador vinculado
        </span>
      ) : null}

      {erro ? (
        <div
          className={`rounded border border-red-200 bg-red-50 px-2 py-1.5 ${isSidebar ? 'text-[11px]' : 'text-sm'} text-red-800`}
          role="alert"
        >
          {erro}
        </div>
      ) : null}
      {msg ? (
        <div
          className={`rounded border border-green-200 bg-green-50 px-2 py-1.5 ${isSidebar ? 'text-[11px]' : 'text-sm'} text-green-900`}
          role="status"
        >
          {msg}
        </div>
      ) : null}

      <fieldset className="space-y-1.5">
        <legend className={`font-semibold uppercase tracking-wide text-stone-500 ${isSidebar ? 'text-[10px]' : 'text-xs'}`}>
          Vincular loteador
        </legend>
        <div className={`flex flex-wrap gap-3 ${isSidebar ? 'text-[11px]' : 'text-sm'}`}>
          <label className="flex cursor-pointer items-center gap-1.5 text-stone-800">
            <input
              type="radio"
              name={`modo-loteador-${cardId}`}
              checked={modo === 'novo'}
              onChange={() => onModoChange('novo')}
            />
            Novo
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 text-stone-800">
            <input
              type="radio"
              name={`modo-loteador-${cardId}`}
              checked={modo === 'existente'}
              onChange={() => onModoChange('existente')}
            />
            Existente
          </label>
        </div>
      </fieldset>

      {modo === 'existente' ? (
        <div className="space-y-1.5">
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Filtrar…"
            className={`w-full rounded-md border border-stone-300 px-2 py-1.5 ${isSidebar ? 'text-[11px]' : 'text-sm'}`}
          />
          <select
            value={selecionadoId}
            onChange={(e) => void onSelecionarExistente(e.target.value)}
            className={`w-full rounded-md border border-stone-300 px-2 py-1.5 ${isSidebar ? 'text-[11px]' : 'text-sm'}`}
          >
            <option value="">Selecione…</option>
            {opcoesFiltradas.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
                {o.cidade || o.estado ? ` — ${[o.cidade, o.estado].filter(Boolean).join('/')}` : ''}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <RedeLoteadorFichaForm
        draft={draft}
        onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
        showStatus={false}
        layout={isSidebar ? 'sidebar' : 'default'}
        sectionIdPrefix={`loteador-${cardId}`}
      />

      <button
        type="button"
        disabled={saving}
        onClick={() => void salvar()}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#0c2633] font-medium text-white hover:bg-[#0c2633]/90 disabled:opacity-60 ${isSidebar ? 'px-3 py-1.5 text-[11px]' : 'px-4 py-2 text-sm'}`}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Salvar dados do loteador
      </button>
    </div>
  );

  if (isSidebar) {
    return <div className="min-w-0">{corpo}</div>;
  }

  return (
    <div
      className="rounded-lg"
      style={{
        border: '0.5px solid var(--moni-border-default)',
        background: 'var(--moni-surface-50)',
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-stone-500" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-stone-500" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
            Dados do Loteador
          </p>
          {resumoStats}
        </div>
        {vinculadoId ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-800">
            <Check className="h-3 w-3" />
            Vinculado
          </span>
        ) : null}
      </button>

      {expanded ? (
        <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: 'var(--moni-border-default)' }}>
          {corpo}
        </div>
      ) : null}
    </div>
  );
}
