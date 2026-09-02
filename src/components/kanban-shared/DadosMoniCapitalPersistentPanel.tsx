'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, ExternalLink, Loader2 } from 'lucide-react';
import {
  carregarMoniCapitalCadastroCardData,
  carregarMoniCapitalCadastroPorId,
  salvarMoniCapitalCadastroNoCard,
  type MoniCapitalCadastroModo,
} from '@/lib/actions/kanban-moni-capital-cadastro';
import type { MoniCapitalCadastroUpsertDados } from '@/lib/moni-capital-cadastros';
import { displayOrDash } from '@/lib/kanban/kanban-card-modal-detalhes';

type Props = {
  cardId: string;
  podeEditar?: boolean;
  onSalvo?: () => void;
};

const inputCls = 'mt-0.5 w-full rounded-md border px-2 py-1 text-xs';
const inputStyle = {
  border: '0.5px solid var(--moni-border-default)',
  borderRadius: 'var(--moni-radius-md)',
};

function emptyDraft(): Required<{ [K in keyof MoniCapitalCadastroUpsertDados]: string }> {
  return {
    broker_nome: '',
    broker_email: '',
    broker_telefone: '',
    investidor_nome: '',
    investidor_email: '',
    investidor_telefone: '',
  };
}

export function DadosMoniCapitalPersistentPanel({ cardId, podeEditar = false, onSalvo }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [modo, setModo] = useState<MoniCapitalCadastroModo>('novo');
  const [selecionadoId, setSelecionadoId] = useState('');
  const [vinculadoId, setVinculadoId] = useState<string | null>(null);
  const [nCadastro, setNCadastro] = useState<string | null>(null);
  const [opcoes, setOpcoes] = useState<{ id: string; label: string }[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState(false);

  const recarregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    const r = await carregarMoniCapitalCadastroCardData(cardId);
    setLoading(false);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    setModo(r.modoInicial);
    setVinculadoId(r.cardCadastroId);
    setSelecionadoId(r.cardCadastroId ?? '');
    setNCadastro(r.cadastro?.n_cadastro ?? null);
    setOpcoes(r.opcoes.map((o) => ({ id: o.id, label: o.label })));
    setDraft({
      broker_nome: r.draftInicial.broker_nome ?? '',
      broker_email: r.draftInicial.broker_email ?? '',
      broker_telefone: r.draftInicial.broker_telefone ?? '',
      investidor_nome: r.draftInicial.investidor_nome ?? '',
      investidor_email: r.draftInicial.investidor_email ?? '',
      investidor_telefone: r.draftInicial.investidor_telefone ?? '',
    });
  }, [cardId]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const opcoesFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return opcoes;
    return opcoes.filter((o) => o.label.toLowerCase().includes(q));
  }, [opcoes, busca]);

  const onModoChange = (next: MoniCapitalCadastroModo) => {
    setModo(next);
    setMsg(null);
    if (next === 'novo') {
      setSelecionadoId('');
      setDraft(emptyDraft());
    } else if (vinculadoId) {
      setSelecionadoId(vinculadoId);
    }
  };

  const onSelecionarExistente = async (id: string) => {
    setSelecionadoId(id);
    setMsg(null);
    if (!id) {
      setDraft(emptyDraft());
      setNCadastro(null);
      return;
    }
    const r = await carregarMoniCapitalCadastroPorId(id);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    setNCadastro(r.cadastro.n_cadastro);
    setDraft({
      broker_nome: r.cadastro.broker_nome ?? '',
      broker_email: r.cadastro.broker_email ?? '',
      broker_telefone: r.cadastro.broker_telefone ?? '',
      investidor_nome: r.cadastro.investidor_nome ?? '',
      investidor_email: r.cadastro.investidor_email ?? '',
      investidor_telefone: r.cadastro.investidor_telefone ?? '',
    });
  };

  const salvar = async () => {
    setSaving(true);
    setErro(null);
    setMsg(null);
    const res = await salvarMoniCapitalCadastroNoCard({
      cardId,
      modo,
      cadastroId: selecionadoId,
      dados: {
        broker_nome: draft.broker_nome.trim() || null,
        broker_email: draft.broker_email.trim() || null,
        broker_telefone: draft.broker_telefone.trim() || null,
        investidor_nome: draft.investidor_nome.trim() || null,
        investidor_email: draft.investidor_email.trim() || null,
        investidor_telefone: draft.investidor_telefone.trim() || null,
      },
    });
    setSaving(false);
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    setMsg(res.mensagem);
    setEditando(false);
    await recarregar();
    onSalvo?.();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-stone-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Carregando cadastro…
      </div>
    );
  }

  if (erro && !vinculadoId) {
    return <p className="text-xs text-red-600">{erro}</p>;
  }

  if (!editando && vinculadoId) {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-x-2 gap-y-2">
          <div className="col-span-2">
            <div className="text-[11px] font-medium text-stone-500">Nº Cadastro</div>
            <div className="text-xs font-medium text-stone-800">{displayOrDash(nCadastro)}</div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-stone-500">Broker — Nome</div>
            <div className="text-xs text-stone-800">{displayOrDash(draft.broker_nome)}</div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-stone-500">Broker — E-mail</div>
            <div className="text-xs text-stone-800">{displayOrDash(draft.broker_email)}</div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-stone-500">Broker — Telefone</div>
            <div className="text-xs text-stone-800">{displayOrDash(draft.broker_telefone)}</div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-stone-500">Investidor — Nome</div>
            <div className="text-xs text-stone-800">{displayOrDash(draft.investidor_nome)}</div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-stone-500">Investidor — E-mail</div>
            <div className="text-xs text-stone-800">{displayOrDash(draft.investidor_email)}</div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-stone-500">Investidor — Telefone</div>
            <div className="text-xs text-stone-800">{displayOrDash(draft.investidor_telefone)}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {podeEditar ? (
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="rounded border px-3 py-1 text-xs text-stone-600 hover:bg-stone-50"
              style={{ border: '0.5px solid var(--moni-border-default)' }}
            >
              Alterar vínculo
            </button>
          ) : null}
          <Link
            href="/rede-franqueados?tab=moni-capital"
            className="inline-flex items-center gap-1 rounded border px-3 py-1 text-xs text-stone-600 hover:bg-stone-50"
            style={{ border: '0.5px solid var(--moni-border-default)' }}
          >
            Ver na Rede
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
        {msg ? <p className="text-[11px] text-green-700">{msg}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {podeEditar ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onModoChange('existente')}
            className={`rounded px-2 py-1 text-[11px] font-medium ${
              modo === 'existente' ? 'text-white' : 'text-stone-600'
            }`}
            style={{
              background: modo === 'existente' ? 'var(--moni-navy-800)' : 'transparent',
              border: '0.5px solid var(--moni-border-default)',
            }}
          >
            Vincular existente
          </button>
          <button
            type="button"
            onClick={() => onModoChange('novo')}
            className={`rounded px-2 py-1 text-[11px] font-medium ${
              modo === 'novo' ? 'text-white' : 'text-stone-600'
            }`}
            style={{
              background: modo === 'novo' ? 'var(--moni-navy-800)' : 'transparent',
              border: '0.5px solid var(--moni-border-default)',
            }}
          >
            Criar novo
          </button>
        </div>
      ) : null}

      {modo === 'existente' ? (
        <div className="space-y-2">
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cadastro…"
            className={inputCls}
            style={inputStyle}
            disabled={!podeEditar}
          />
          <select
            value={selecionadoId}
            onChange={(e) => void onSelecionarExistente(e.target.value)}
            className={inputCls}
            style={inputStyle}
            disabled={!podeEditar}
          >
            <option value="">Selecione um cadastro</option>
            {opcoesFiltradas.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="space-y-2 rounded border p-2" style={{ border: '0.5px solid var(--moni-border-default)' }}>
        <p className="text-[11px] font-semibold text-stone-600">Broker</p>
        <Campo label="Nome" value={draft.broker_nome} onChange={(v) => setDraft((d) => ({ ...d, broker_nome: v }))} disabled={!podeEditar || modo === 'existente'} />
        <Campo label="E-mail" value={draft.broker_email} onChange={(v) => setDraft((d) => ({ ...d, broker_email: v }))} disabled={!podeEditar || modo === 'existente'} type="email" />
        <Campo label="Telefone" value={draft.broker_telefone} onChange={(v) => setDraft((d) => ({ ...d, broker_telefone: v }))} disabled={!podeEditar || modo === 'existente'} type="tel" />
      </div>

      <div className="space-y-2 rounded border p-2" style={{ border: '0.5px solid var(--moni-border-default)' }}>
        <p className="text-[11px] font-semibold text-stone-600">Investidor</p>
        <Campo label="Nome" value={draft.investidor_nome} onChange={(v) => setDraft((d) => ({ ...d, investidor_nome: v }))} disabled={!podeEditar || modo === 'existente'} />
        <Campo label="E-mail" value={draft.investidor_email} onChange={(v) => setDraft((d) => ({ ...d, investidor_email: v }))} disabled={!podeEditar || modo === 'existente'} type="email" />
        <Campo label="Telefone" value={draft.investidor_telefone} onChange={(v) => setDraft((d) => ({ ...d, investidor_telefone: v }))} disabled={!podeEditar || modo === 'existente'} type="tel" />
      </div>

      {erro ? <p className="text-xs text-red-600">{erro}</p> : null}
      {msg ? <p className="text-xs text-green-700">{msg}</p> : null}

      {podeEditar ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void salvar()}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
            style={{ background: 'var(--moni-navy-800)' }}
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            {modo === 'novo' ? 'Criar e vincular' : 'Vincular'}
          </button>
          {editando ? (
            <button
              type="button"
              onClick={() => {
                setEditando(false);
                void recarregar();
              }}
              disabled={saving}
              className="rounded border px-3 py-1 text-xs text-stone-600"
              style={{ border: '0.5px solid var(--moni-border-default)' }}
            >
              Cancelar
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
  disabled,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  type?: string;
}) {
  return (
    <label className="block text-[11px] font-medium text-stone-500">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={inputCls}
        style={inputStyle}
      />
    </label>
  );
}
