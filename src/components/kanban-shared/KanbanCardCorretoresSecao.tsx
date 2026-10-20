'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, Users } from 'lucide-react';
import {
  cadastroPreenchidoDoEmpreendimento,
  desvincularCorretorEmpreendimento,
  listarCorretoresVinculoEmpreendimento,
  resumoCorretoresDoCard,
  vincularCorretorEmpreendimento,
  type CampoCadastroPreenchido,
  type CorretorVinculoOpcao,
  type EmpreendimentoCorretoresResumo,
} from '@/app/rede-franqueados/imob-empreendimentos-actions';

type SecaoProps = {
  cardId: string;
  ativo: boolean;
  onAbrir: () => void;
  refreshKey?: number;
};

export function KanbanCardCorretoresSecao({ cardId, ativo, onAbrir, refreshKey = 0 }: SecaoProps) {
  const [resumo, setResumo] = useState<EmpreendimentoCorretoresResumo | null | undefined>(undefined);

  useEffect(() => {
    let cancelado = false;
    setResumo(undefined);
    void resumoCorretoresDoCard(cardId).then((res) => {
      if (cancelado) return;
      setResumo(res.ok ? res.resumo : null);
    });
    return () => {
      cancelado = true;
    };
  }, [cardId, refreshKey]);

  if (!resumo) return null;

  return (
    <div
      className="mb-2 overflow-hidden rounded-lg bg-white text-xs"
      style={{
        border: '0.5px solid var(--moni-border-default)',
        boxShadow: 'var(--moni-shadow-sm)',
      }}
    >
      <button
        type="button"
        onClick={onAbrir}
        className={`flex min-h-11 w-full items-center gap-2 p-2 text-left text-xs transition hover:bg-stone-50 ${
          ativo ? 'bg-[var(--moni-navy-50,#eef3f5)] ring-1 ring-inset ring-[var(--moni-navy-200,#b8ccd4)]' : ''
        }`}
      >
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-stone-500" aria-hidden />
        <Users className="h-3.5 w-3.5 shrink-0 text-stone-500" aria-hidden />
        <span className="text-xs font-semibold text-stone-800">Corretores</span>
        <span className="ml-auto shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold tabular-nums text-stone-600">
          {resumo.vinculados}
        </span>
      </button>
      {ativo ? (
        <p
          className="border-t px-2 pb-2 pt-1.5 text-[10px] text-stone-500"
          style={{ borderColor: 'var(--moni-border-subtle)' }}
        >
          Painel de corretores aberto — use <strong className="font-medium text-stone-700">Voltar</strong> no
          centro do card.
        </p>
      ) : (
        <p
          className="border-t px-2 pb-2 pt-1.5 text-[10px] text-stone-500"
          style={{ borderColor: 'var(--moni-border-subtle)' }}
        >
          {resumo.corretorDesteClienteNome ? (
            <>
              Corretor: <strong className="font-medium text-stone-700">{resumo.corretorDesteClienteNome}</strong>
              {' · '}
            </>
          ) : resumo.vinculados > 0 ? (
            <>
              {resumo.vinculados} vinculado{resumo.vinculados === 1 ? '' : 's'}
              {' · '}
            </>
          ) : null}
          {resumo.nome}
        </p>
      )}
    </div>
  );
}

type PainelProps = {
  cardId: string;
  onVoltar: () => void;
  onAlterou: () => void;
};

export function KanbanCardCorretoresPainel({ cardId, onVoltar, onAlterou }: PainelProps) {
  const [resumo, setResumo] = useState<EmpreendimentoCorretoresResumo | null | undefined>(undefined);
  const [corretores, setCorretores] = useState<CorretorVinculoOpcao[] | null>(null);
  const [vinculados, setVinculados] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState('');
  const [vinculandoId, setVinculandoId] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [cadastro, setCadastro] = useState<CampoCadastroPreenchido[] | null>(null);

  useEffect(() => {
    let cancelado = false;
    setResumo(undefined);
    setCorretores(null);
    setBusca('');
    setErro('');
    setCadastro(null);
    void resumoCorretoresDoCard(cardId).then((res) => {
      if (cancelado) return;
      if (!res.ok || !res.resumo) {
        setResumo(null);
        setCorretores([]);
        return;
      }
      setResumo(res.resumo);
      void cadastroPreenchidoDoEmpreendimento(res.resumo.empreendimentoId).then((cad) => {
        if (cancelado) return;
        setCadastro(cad.ok ? cad.campos : []);
      });
      void listarCorretoresVinculoEmpreendimento(res.resumo.empreendimentoId).then((lista) => {
        if (cancelado) return;
        if (!lista.ok) {
          setErro(lista.error);
          setCorretores([]);
          return;
        }
        setCorretores(lista.corretores);
        setVinculados(new Set(lista.vinculados));
      });
    });
    return () => {
      cancelado = true;
    };
  }, [cardId]);

  const ligados = useMemo(() => {
    const lista = (corretores ?? []).filter((c) => vinculados.has(c.id));
    const deste = resumo?.corretorDesteClienteId;
    if (!deste) return lista;
    return [...lista].sort((a, b) => (a.id === deste ? -1 : b.id === deste ? 1 : 0));
  }, [corretores, vinculados, resumo?.corretorDesteClienteId]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const lista = corretores ?? [];
    if (!q) return lista;
    return lista.filter((c) => {
      const nome = c.nome.toLowerCase();
      const codigo = String(c.n_corretor ?? '').toLowerCase();
      return nome.includes(q) || codigo.includes(q);
    });
  }, [corretores, busca]);

  async function toggleCorretor(corretorId: string) {
    if (!resumo) return;
    setVinculandoId(corretorId);
    setErro('');
    const ligado = vinculados.has(corretorId);
    const res = ligado
      ? await desvincularCorretorEmpreendimento(corretorId, resumo.empreendimentoId)
      : await vincularCorretorEmpreendimento(corretorId, resumo.empreendimentoId);
    setVinculandoId(null);
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    setVinculados((prev) => {
      const next = new Set(prev);
      if (ligado) next.delete(corretorId);
      else next.add(corretorId);
      return next;
    });
    onAlterou();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <button
        type="button"
        onClick={onVoltar}
        className="mb-4 inline-flex min-h-11 shrink-0 items-center gap-1.5 self-start rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-sm transition hover:bg-stone-50"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        Voltar
      </button>
      <div className="flex min-h-0 flex-1 flex-col">
        <h4 className="mb-2 text-sm font-semibold" style={{ color: 'var(--moni-text-secondary)' }}>
          Corretores vinculados
          {resumo ? (
            <span className="ml-2 text-xs font-normal text-stone-500">
              ({ligados.length} em {resumo.nome})
            </span>
          ) : null}
        </h4>
        {cadastro && cadastro.length > 0 ? (
          <div
            className="mb-3 max-h-48 overflow-y-auto rounded-lg bg-white p-3"
            style={{
              border: '0.5px solid var(--moni-border-default)',
              boxShadow: 'var(--moni-shadow-sm)',
            }}
          >
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-stone-500">
              Cadastro do empreendimento
            </p>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
              {cadastro.map((campo) => (
                <div key={campo.label} className="min-w-0">
                  <dt className="text-[10px] text-stone-400">{campo.label}</dt>
                  <dd className="truncate text-xs text-stone-800" title={campo.valor}>
                    {campo.valor}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
        <div
          className="flex min-h-0 flex-1 flex-col rounded-lg bg-white p-3"
          style={{
            border: '0.5px solid var(--moni-border-default)',
            boxShadow: 'var(--moni-shadow-sm)',
          }}
        >
          {corretores === null ? (
            <p className="text-xs text-stone-400">Carregando…</p>
          ) : ligados.length === 0 ? (
            <p className="text-xs text-stone-500">Nenhum corretor vinculado a este empreendimento.</p>
          ) : (
            <ul className="mb-4 max-h-64 space-y-1 overflow-y-auto">
              {ligados.map((c) => (
                <li
                  key={c.id}
                  className="rounded-md px-2 py-2 text-sm text-stone-800"
                  style={{ border: '0.5px solid var(--moni-border-subtle)' }}
                >
                  {c.nome}
                  {c.n_corretor ? <span className="ml-2 text-xs text-stone-400">#{c.n_corretor}</span> : null}
                  {c.id === resumo?.corretorDesteClienteId ? (
                    <span className="ml-2 text-[10px] font-medium" style={{ color: 'var(--moni-text-tertiary)' }}>
                      deste cliente
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-stone-500">
            Vincular corretor
          </p>
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar corretor…"
            className="mb-2 w-full rounded border border-stone-200 px-2 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-stone-400"
          />
          {corretores === null ? null : filtrados.length === 0 ? (
            <p className="text-xs text-stone-400">Nenhum corretor encontrado.</p>
          ) : (
            <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
              {filtrados.map((c) => {
                const ligado = vinculados.has(c.id);
                return (
                  <li key={c.id}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-1 text-xs hover:bg-stone-50">
                      <input
                        type="checkbox"
                        checked={ligado}
                        disabled={vinculandoId === c.id}
                        onChange={() => void toggleCorretor(c.id)}
                        className="h-4 w-4 rounded border-stone-300"
                      />
                      <span className="text-stone-800">{c.nome}</span>
                      {c.n_corretor ? <span className="text-stone-400">#{c.n_corretor}</span> : null}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          {erro ? <p className="mt-2 text-[10px] text-red-600">{erro}</p> : null}
        </div>
      </div>
    </div>
  );
}
