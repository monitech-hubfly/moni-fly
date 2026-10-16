'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, ExternalLink, X } from 'lucide-react';
import { criarCardLoteadoresComCadastro } from '@/lib/actions/loteadores-novo-card';
import { obterLinkIntakePublicoLoteador } from '@/lib/actions/loteador-externo-actions';
import {
  emptyNovoCardLoteadoresFormulario,
  type NovoCardLoteadoresFormulario,
} from '@/lib/kanban/loteadores-novo-card-form';
import { NovoCardLoteadoresFormCampos } from '@/components/kanban-shared/NovoCardLoteadoresFormCampos';

export function NovoCardMonINCModal({
  faseId,
  kanbanId: _kanbanId,
  isAdmin,
  basePath = '/loteadores',
  onClose,
}: {
  faseId: string;
  kanbanId: string;
  /** Staff (admin/team) — Frank não gerencia cadastro. */
  isAdmin: boolean;
  basePath?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const podeGerirCadastro = Boolean(isAdmin);

  const [form, setForm] = useState<NovoCardLoteadoresFormulario>(emptyNovoCardLoteadoresFormulario);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [linkIntake, setLinkIntake] = useState<string | null>(null);
  const [linkCopiado, setLinkCopiado] = useState(false);

  useEffect(() => {
    if (!podeGerirCadastro) return;
    let cancelled = false;
    void obterLinkIntakePublicoLoteador().then((res) => {
      if (cancelled || !res.ok) return;
      setLinkIntake(res.url);
    });
    return () => {
      cancelled = true;
    };
  }, [podeGerirCadastro]);

  async function copiarLinkIntake() {
    if (!linkIntake) return;
    try {
      await navigator.clipboard.writeText(linkIntake);
      setLinkCopiado(true);
      window.setTimeout(() => setLinkCopiado(false), 1600);
    } catch {
      setErro('Não foi possível copiar o link.');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!podeGerirCadastro) {
      setErro('Sem permissão para criar card / cadastro de loteador (apenas staff).');
      return;
    }
    if (!faseId) {
      setErro('Fase inicial não configurada. Recarregue após aplicar a migration.');
      return;
    }

    setLoading(true);
    try {
      const res = await criarCardLoteadoresComCadastro({
        faseId,
        basePath,
        modo: 'novo',
        parceiro: form,
      });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      onClose();
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const labelStyle = { color: 'var(--moni-text-primary)' } as const;

  if (!podeGerirCadastro) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={onClose}
        role="presentation"
      >
        <div
          className="w-full max-w-md bg-white p-6"
          style={{
            borderRadius: 'var(--moni-radius-xl)',
            border: '0.5px solid var(--moni-border-default)',
          }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <p className="text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
            Frank e franqueados só visualizam o funil. A criação de cards e cadastros é restrita ao
            staff.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 min-h-[44px] w-full rounded-lg px-4 py-2 text-sm font-medium text-white"
            style={{ background: 'var(--moni-navy-800)', borderRadius: 'var(--moni-radius-md)' }}
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex max-h-[90vh] w-full flex-col overflow-hidden bg-white"
        style={{
          maxWidth: '720px',
          borderRadius: 'var(--moni-radius-xl)',
          border: '0.5px solid var(--moni-border-default)',
          boxShadow: 'var(--moni-shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="novo-card-moni-inc-titulo"
      >
        <div
          className="flex shrink-0 items-center justify-between border-b bg-white px-6 py-4"
          style={{ borderColor: 'var(--moni-border-default)' }}
        >
          <h2
            id="novo-card-moni-inc-titulo"
            className="text-lg font-bold"
            style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-display)' }}
          >
            Novo Card
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 overflow-y-auto p-6">
          {linkIntake ? (
            <div
              className="space-y-2 p-3"
              style={{
                border: '0.5px solid var(--moni-border-default)',
                borderRadius: 'var(--moni-radius-md)',
                background: 'var(--moni-surface-50)',
              }}
            >
              <p className="text-sm font-medium" style={labelStyle}>
                Link de preenchimento externo
              </p>
              <p className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                Sempre o mesmo. Cada envio cria o loteador, o condomínio já vinculado e um card na
                fase Entrar em contato.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <p
                  className="min-w-0 flex-1 truncate text-xs"
                  style={{ color: 'var(--moni-text-secondary)' }}
                  title={linkIntake}
                >
                  {linkIntake}
                </p>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => void copiarLinkIntake()}
                    className="inline-flex min-h-[44px] items-center gap-1.5 px-3 text-xs font-medium"
                    style={{
                      border: '0.5px solid var(--moni-border-default)',
                      borderRadius: 'var(--moni-radius-md)',
                      color: 'var(--moni-text-secondary)',
                      background: 'var(--moni-surface-0)',
                    }}
                  >
                    {linkCopiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {linkCopiado ? 'Copiado' : 'Copiar'}
                  </button>
                  <a
                    href={linkIntake}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[44px] items-center gap-1.5 px-3 text-xs font-medium"
                    style={{
                      border: '0.5px solid var(--moni-border-default)',
                      borderRadius: 'var(--moni-radius-md)',
                      color: 'var(--moni-text-secondary)',
                      background: 'var(--moni-surface-0)',
                    }}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Abrir
                  </a>
                </div>
              </div>
            </div>
          ) : null}

          <NovoCardLoteadoresFormCampos
            value={form}
            onChange={(patch) => setForm((atual) => ({ ...atual, ...patch }))}
            disabled={loading}
          />

          {erro ? (
            <p className="text-sm" role="alert" style={{ color: 'var(--moni-danger)' }}>
              {erro}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="min-h-[44px] px-4 py-2 text-sm font-medium"
              style={{
                border: '0.5px solid var(--moni-border-default)',
                borderRadius: 'var(--moni-radius-md)',
                color: 'var(--moni-text-secondary)',
                background: 'var(--moni-surface-0)',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="min-h-[44px] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              style={{
                background: 'var(--moni-navy-800)',
                borderRadius: 'var(--moni-radius-md)',
              }}
            >
              {loading ? 'Criando…' : 'Criar card'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
