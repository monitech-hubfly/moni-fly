'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ChevronRight, Loader2 } from 'lucide-react';
import {
  concluirTrancheVinculoOperacoes,
  listarTrancheVinculosOperacoes,
  salvarTrancheVinculoOperacoes,
  type TrancheVinculoListItem,
} from '@/lib/actions/operacoes-tranche-vinculos';
import { configTrancheVinculo } from '@/lib/operacoes/tranche-vinculos-config';

type SidebarProps = {
  cardId: string;
  refreshKey: number;
  trancheSelecionado: number | null;
  onSelecionar: (index: number) => void;
};

export function KanbanCardModalOperacoesTrancheVinculosSidebar({
  cardId,
  refreshKey,
  trancheSelecionado,
  onSelecionar,
}: SidebarProps) {
  const [items, setItems] = useState<TrancheVinculoListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!cardId) {
      setItems([]);
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      const res = await listarTrancheVinculosOperacoes(cardId);
      if (!res.ok) {
        setErro(res.error);
        setItems([]);
        return;
      }
      setItems(res.items);
    } catch {
      setErro('Erro ao carregar vínculos.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [cardId]);

  useEffect(() => {
    void carregar();
  }, [carregar, refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-[11px] text-stone-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Carregando vínculos…
      </div>
    );
  }

  if (erro) {
    return <p className="rounded border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] text-red-800">{erro}</p>;
  }

  const filhoId = items[0]?.filhoCreditoObraId ?? null;
  const filhoFase = items[0]?.filhoFaseNome ?? null;

  return (
    <div className="space-y-2">
      {filhoId ? (
        <p className="text-[10px] leading-snug text-stone-500">
          Card Crédito Obra vinculado · fase atual:{' '}
          <span className="font-medium text-stone-700">{filhoFase ?? '—'}</span>
        </p>
      ) : (
        <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] text-amber-900">
          Nenhum card filho no Funil Crédito Obra. Abra a esteira antes de concluir vínculos.
        </p>
      )}
      <ul className="space-y-1">
        {items.map((item) => {
          const ativo = trancheSelecionado === item.index;
          const concluido = item.status === 'concluido';
          return (
            <li key={item.index}>
              <button
                type="button"
                onClick={() => onSelecionar(item.index)}
                className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-[11px] transition hover:bg-stone-50 ${
                  ativo ? 'border-violet-300 bg-violet-50 ring-1 ring-inset ring-violet-200' : 'border-stone-200 bg-white'
                }`}
              >
                <ChevronRight className="h-3 w-3 shrink-0 text-stone-400" aria-hidden />
                <span className="min-w-0 flex-1 font-medium text-stone-800">{item.nome}</span>
                {concluido ? (
                  <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-green-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-green-800 ring-1 ring-inset ring-green-200">
                    <CheckCircle2 className="h-2.5 w-2.5" aria-hidden />
                    Concluído
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-stone-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-stone-600 ring-1 ring-inset ring-stone-200">
                    Pendente
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type FormProps = {
  cardId: string;
  trancheIndex: number;
  basePath: string;
  refreshKey: number;
  podeGerenciar: boolean;
  cardDesabilitado?: boolean;
  onVoltar: () => void;
  onConcluido: () => void;
};

export function KanbanCardModalOperacoesTrancheVinculoForm({
  cardId,
  trancheIndex,
  basePath,
  refreshKey,
  podeGerenciar,
  cardDesabilitado = false,
  onVoltar,
  onConcluido,
}: FormProps) {
  const cfg = configTrancheVinculo(trancheIndex);
  const [pct, setPct] = useState('');
  const [nfts, setNfts] = useState('');
  const [evidencias, setEvidencias] = useState('');
  const [concluidoEm, setConcluidoEm] = useState<string | null>(null);
  const [filhoFaseNome, setFilhoFaseNome] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [concluindo, setConcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const readOnly = !podeGerenciar || cardDesabilitado || Boolean(concluidoEm);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setErro(null);
      setOkMsg(null);
      try {
        const res = await listarTrancheVinculosOperacoes(cardId);
        if (cancelled) return;
        if (!res.ok) {
          setErro(res.error);
          return;
        }
        const item = res.items.find((i) => i.index === trancheIndex);
        if (item) {
          setPct(item.pct_fisico_financeiro != null ? String(item.pct_fisico_financeiro) : '');
          setNfts(item.nfts_url ?? '');
          setEvidencias(item.evidencias_url ?? '');
          setConcluidoEm(item.concluido_em);
          setFilhoFaseNome(item.filhoFaseNome);
        }
      } catch {
        if (!cancelled) setErro('Erro ao carregar dados do vínculo.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [cardId, trancheIndex, refreshKey]);

  if (!cfg) {
    return <p className="text-xs text-stone-500">Vínculo inválido.</p>;
  }

  async function handleSalvar() {
    setErro(null);
    setOkMsg(null);
    setSalvando(true);
    try {
      const res = await salvarTrancheVinculoOperacoes({
        operacoesCardId: cardId,
        trancheIndex,
        pct_fisico_financeiro: pct.trim() || null,
        nfts_url: nfts.trim() || null,
        evidencias_url: evidencias.trim() || null,
        basePath,
      });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      setOkMsg('Rascunho salvo.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleConcluir() {
    if (!cfg) return;
    if (!confirm(`Concluir "${cfg.nome}" e mover o card Crédito Obra para "${cfg.faseDestinoLabel}"?`)) {
      return;
    }
    setErro(null);
    setOkMsg(null);
    setConcluindo(true);
    try {
      const res = await concluirTrancheVinculoOperacoes({
        operacoesCardId: cardId,
        trancheIndex,
        pct_fisico_financeiro: pct.trim() || null,
        nfts_url: nfts.trim() || null,
        evidencias_url: evidencias.trim() || null,
        basePath,
      });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      setConcluidoEm(new Date().toISOString());
      setOkMsg(`Vínculo concluído. Card Crédito Obra movido para "${cfg.faseDestinoLabel}".`);
      onConcluido();
    } finally {
      setConcluindo(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-stone-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Carregando…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-stone-900">{cfg.nome}</h4>
        <p className="mt-1 text-xs text-stone-600">
          Ao concluir, o card filho no Funil Crédito Obra será movido para{' '}
          <strong className="font-medium">{cfg.faseDestinoLabel}</strong>.
        </p>
        {filhoFaseNome ? (
          <p className="mt-1 text-[11px] text-stone-500">
            Fase atual do Crédito Obra: <span className="font-medium text-stone-700">{filhoFaseNome}</span>
          </p>
        ) : null}
        {concluidoEm ? (
          <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-800 ring-1 ring-inset ring-green-200">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            Concluído em {new Date(concluidoEm).toLocaleString('pt-BR')}
          </p>
        ) : null}
      </div>

      <div className="space-y-3 rounded-lg border border-stone-200 bg-white p-4 text-xs">
        <label className="block">
          <span className="font-medium text-stone-700">% físico financeiro</span>
          <input
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={pct}
            onChange={(e) => setPct(e.target.value)}
            disabled={readOnly}
            placeholder="Ex.: 72,5"
            className="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-800 disabled:bg-stone-50"
          />
        </label>
        <label className="block">
          <span className="font-medium text-stone-700">NFs (link)</span>
          <input
            type="url"
            value={nfts}
            onChange={(e) => setNfts(e.target.value)}
            disabled={readOnly}
            placeholder="https://…"
            className="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-800 disabled:bg-stone-50"
          />
        </label>
        <label className="block">
          <span className="font-medium text-stone-700">Evidências / fotos obra (link)</span>
          <input
            type="url"
            value={evidencias}
            onChange={(e) => setEvidencias(e.target.value)}
            disabled={readOnly}
            placeholder="https://…"
            className="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-800 disabled:bg-stone-50"
          />
        </label>
      </div>

      {erro ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{erro}</p>
      ) : null}
      {okMsg ? (
        <p className="rounded border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">{okMsg}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onVoltar}
          className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
        >
          Voltar
        </button>
        {podeGerenciar && !concluidoEm && !cardDesabilitado ? (
          <>
            <button
              type="button"
              onClick={() => void handleSalvar()}
              disabled={salvando || concluindo}
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-50 disabled:opacity-50"
            >
              {salvando ? 'Salvando…' : 'Salvar rascunho'}
            </button>
            <button
              type="button"
              onClick={() => void handleConcluir()}
              disabled={salvando || concluindo}
              className="rounded-lg border border-moni-primary bg-moni-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {concluindo ? 'Concluindo…' : 'Concluir vínculo'}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
