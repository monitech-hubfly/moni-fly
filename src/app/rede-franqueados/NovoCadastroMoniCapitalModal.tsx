'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, X } from 'lucide-react';
import { criarCadastroMoniCapital, obterProximoNCadastroMoniCapital } from '@/lib/moni-capital-cadastros-actions';

type Draft = {
  broker_nome: string;
  broker_email: string;
  broker_telefone: string;
  investidor_nome: string;
  investidor_email: string;
  investidor_telefone: string;
};

function emptyDraft(): Draft {
  return {
    broker_nome: '',
    broker_email: '',
    broker_telefone: '',
    investidor_nome: '',
    investidor_email: '',
    investidor_telefone: '',
  };
}

const inputCls = 'mt-1 w-full px-3 py-2 text-sm';
const inputStyle = {
  border: '0.5px solid var(--moni-border-default)',
  borderRadius: 'var(--moni-radius-md)',
};

export function NovoCadastroMoniCapitalModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [proximoNCadastro, setProximoNCadastro] = useState('MC0001');
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const res = await obterProximoNCadastroMoniCapital();
      if (res.ok) setProximoNCadastro(res.n_cadastro);
    })();
  }, [open]);

  function patch(p: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...p }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setLoading(true);
    try {
      const res = await criarCadastroMoniCapital({
        broker_nome: draft.broker_nome.trim() || null,
        broker_email: draft.broker_email.trim() || null,
        broker_telefone: draft.broker_telefone.trim() || null,
        investidor_nome: draft.investidor_nome.trim() || null,
        investidor_email: draft.investidor_email.trim() || null,
        investidor_telefone: draft.investidor_telefone.trim() || null,
        criarCardFunding: true,
      });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      setOpen(false);
      setDraft(emptyDraft());
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border bg-transparent px-4 py-2 text-sm font-semibold transition hover:bg-stone-100/80"
        style={{
          border: '0.5px solid var(--moni-border-default)',
          color: 'var(--moni-text-primary)',
          minHeight: '44px',
        }}
      >
        <UserPlus className="h-4 w-4" />
        Novo Cadastro
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className="relative w-full max-w-lg overflow-hidden bg-white"
            style={{
              borderRadius: 'var(--moni-radius-xl)',
              border: '0.5px solid var(--moni-border-default)',
              boxShadow: 'var(--moni-shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="novo-mc-cadastro-titulo"
          >
            <div
              className="flex items-center justify-between border-b px-6 py-4"
              style={{ borderColor: 'var(--moni-border-default)' }}
            >
              <h2
                id="novo-mc-cadastro-titulo"
                className="text-lg font-bold"
                style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-display)' }}
              >
                Novo Cadastro Moní Capital
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5 p-6">
              <p className="text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
                Nº do cadastro:{' '}
                <span className="font-semibold" style={{ color: 'var(--moni-navy-800)' }}>
                  {proximoNCadastro}
                </span>
                <span className="ml-1 text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                  (sequencial automático; MC0000 reservado)
                </span>
              </p>

              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
                  Broker
                </legend>
                <label className="block text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
                  Nome
                  <input
                    type="text"
                    value={draft.broker_nome}
                    onChange={(e) => patch({ broker_nome: e.target.value })}
                    className={inputCls}
                    style={inputStyle}
                  />
                </label>
                <label className="block text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
                  E-mail
                  <input
                    type="email"
                    value={draft.broker_email}
                    onChange={(e) => patch({ broker_email: e.target.value })}
                    className={inputCls}
                    style={inputStyle}
                  />
                </label>
                <label className="block text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
                  Telefone (DDD + número)
                  <input
                    type="tel"
                    value={draft.broker_telefone}
                    onChange={(e) => patch({ broker_telefone: e.target.value })}
                    className={inputCls}
                    style={inputStyle}
                  />
                </label>
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
                  Investidor
                </legend>
                <label className="block text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
                  Nome
                  <input
                    type="text"
                    value={draft.investidor_nome}
                    onChange={(e) => patch({ investidor_nome: e.target.value })}
                    className={inputCls}
                    style={inputStyle}
                  />
                </label>
                <label className="block text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
                  E-mail
                  <input
                    type="email"
                    value={draft.investidor_email}
                    onChange={(e) => patch({ investidor_email: e.target.value })}
                    className={inputCls}
                    style={inputStyle}
                  />
                </label>
                <label className="block text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
                  Telefone (DDD + número)
                  <input
                    type="tel"
                    value={draft.investidor_telefone}
                    onChange={(e) => patch({ investidor_telefone: e.target.value })}
                    className={inputCls}
                    style={inputStyle}
                  />
                </label>
              </fieldset>

              <p className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                Ao salvar, um card será criado automaticamente no Funil Funding (fase Leads).
              </p>

              {erro ? (
                <p className="text-sm font-medium" style={{ color: 'var(--moni-status-overdue-text)' }} role="alert">
                  {erro}
                </p>
              ) : null}

              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-6 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                  style={{
                    background: 'var(--moni-navy-800)',
                    borderRadius: 'var(--moni-radius-md)',
                    minHeight: '44px',
                  }}
                >
                  {loading ? 'Salvando…' : 'Criar cadastro'}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                  className="flex-1 px-6 py-2.5 text-sm font-medium transition hover:bg-stone-50"
                  style={{
                    color: 'var(--moni-text-secondary)',
                    border: '0.5px solid var(--moni-border-default)',
                    borderRadius: 'var(--moni-radius-md)',
                    minHeight: '44px',
                  }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
