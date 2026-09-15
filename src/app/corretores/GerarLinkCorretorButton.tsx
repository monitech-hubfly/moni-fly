'use client';

import { useState, useTransition } from 'react';
import { Link2, Copy, Check } from 'lucide-react';
import { gerarLinkCorretorLead } from '@/lib/actions/corretor-lead-actions';

export function GerarLinkCorretorButton() {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState('');
  const [imobiliaria, setImobiliaria] = useState('');
  const [email, setEmail] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [pending, startTransition] = useTransition();

  function fechar() {
    setOpen(false);
    setNome('');
    setImobiliaria('');
    setEmail('');
    setLink(null);
    setErro(null);
    setCopiado(false);
  }

  function gerar() {
    setErro(null);
    setLink(null);
    startTransition(async () => {
      const res = await gerarLinkCorretorLead({
        nome_corretor: nome,
        imobiliaria_corretor: imobiliaria,
        email_corretor: email || null,
      });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      setLink(res.url ?? null);
    });
  }

  async function copiar() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setErro('Não foi possível copiar. Selecione o link manualmente.');
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--moni-radius-md)] px-3 py-2 text-sm font-medium text-white"
        style={{
          background: 'var(--moni-navy-800)',
          fontFamily: 'var(--moni-font-sans)',
        }}
      >
        <Link2 className="h-4 w-4" aria-hidden />
        Gerar link de corretor
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gerar-link-corretor-titulo"
        >
          <div
            className="w-full max-w-md rounded-[var(--moni-radius-lg)] bg-[var(--moni-surface-0)] p-5 shadow-[var(--moni-shadow-card)]"
            style={{ border: '0.5px solid var(--moni-border-default)' }}
          >
            <h2
              id="gerar-link-corretor-titulo"
              className="text-lg font-semibold"
              style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-display)' }}
            >
              Gerar link de corretor
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
              O corretor receberá um link público para indicar leads. Os cards entram em Oportunidade.
            </p>

            {!link ? (
              <div className="mt-4 space-y-3">
                <label className="block text-sm">
                  <span style={{ color: 'var(--moni-text-primary)' }}>Nome do corretor *</span>
                  <input
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="mt-1 w-full rounded-[var(--moni-radius-md)] px-3 py-2 text-sm"
                    style={{
                      border: '0.5px solid var(--moni-border-default)',
                      color: 'var(--moni-text-primary)',
                      minHeight: 44,
                    }}
                  />
                </label>
                <label className="block text-sm">
                  <span style={{ color: 'var(--moni-text-primary)' }}>Imobiliária *</span>
                  <input
                    value={imobiliaria}
                    onChange={(e) => setImobiliaria(e.target.value)}
                    className="mt-1 w-full rounded-[var(--moni-radius-md)] px-3 py-2 text-sm"
                    style={{
                      border: '0.5px solid var(--moni-border-default)',
                      color: 'var(--moni-text-primary)',
                      minHeight: 44,
                    }}
                  />
                </label>
                <label className="block text-sm">
                  <span style={{ color: 'var(--moni-text-primary)' }}>E-mail do corretor</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full rounded-[var(--moni-radius-md)] px-3 py-2 text-sm"
                    style={{
                      border: '0.5px solid var(--moni-border-default)',
                      color: 'var(--moni-text-primary)',
                      minHeight: 44,
                    }}
                  />
                </label>
                {erro ? (
                  <p className="text-sm" style={{ color: 'var(--moni-danger-600, #9b2c2c)' }}>
                    {erro}
                  </p>
                ) : null}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={fechar}
                    className="min-h-[44px] rounded-[var(--moni-radius-md)] px-3 text-sm"
                    style={{
                      border: '0.5px solid var(--moni-border-default)',
                      color: 'var(--moni-text-secondary)',
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={gerar}
                    className="min-h-[44px] rounded-[var(--moni-radius-md)] px-3 text-sm font-medium text-white disabled:opacity-60"
                    style={{ background: 'var(--moni-navy-800)' }}
                  >
                    {pending ? 'Gerando…' : 'Gerar link'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <p className="text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
                  Link gerado — copie e envie ao corretor:
                </p>
                <div
                  className="break-all rounded-[var(--moni-radius-md)] px-3 py-2 text-xs"
                  style={{
                    background: 'var(--moni-surface-50)',
                    border: '0.5px solid var(--moni-border-default)',
                    color: 'var(--moni-text-primary)',
                  }}
                >
                  {link}
                </div>
                {erro ? (
                  <p className="text-sm" style={{ color: 'var(--moni-danger-600, #9b2c2c)' }}>
                    {erro}
                  </p>
                ) : null}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={fechar}
                    className="min-h-[44px] rounded-[var(--moni-radius-md)] px-3 text-sm"
                    style={{
                      border: '0.5px solid var(--moni-border-default)',
                      color: 'var(--moni-text-secondary)',
                    }}
                  >
                    Fechar
                  </button>
                  <button
                    type="button"
                    onClick={() => void copiar()}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--moni-radius-md)] px-3 text-sm font-medium text-white"
                    style={{ background: 'var(--moni-navy-800)' }}
                  >
                    {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copiado ? 'Copiado' : 'Copiar link'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
