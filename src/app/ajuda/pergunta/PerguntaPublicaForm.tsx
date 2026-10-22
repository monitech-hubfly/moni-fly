'use client';

import { useState } from 'react';
import Link from 'next/link';

export function PerguntaPublicaForm() {
  const [pergunta, setPergunta] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    const texto = pergunta.trim();
    if (texto.length < 8) {
      setErro('Escreva a pergunta.');
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const resposta = await fetch('/api/ajuda/pergunta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pergunta: texto }),
      });
      const corpo = (await resposta.json()) as { error?: string };
      if (!resposta.ok) {
        setErro(corpo.error ?? 'Não foi possível enviar agora.');
        return;
      }
      setEnviada(true);
    } catch {
      setErro('Não foi possível enviar agora.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-xl items-center px-4 py-10">
      <div
        className="w-full p-6 sm:p-8"
        style={{
          background: 'var(--moni-surface-0)',
          border: 'var(--moni-border-width) solid var(--moni-border-default)',
          borderRadius: 'var(--moni-radius-lg)',
          boxShadow: 'var(--moni-shadow-card)',
        }}
      >
        <Link href="/ajuda" className="text-sm" style={{ color: 'var(--moni-navy-800)', fontFamily: 'var(--moni-font-sans)' }}>
          ← Central de Ajuda
        </Link>
        <h1
          className="mt-4 text-3xl"
          style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
        >
          Não encontrou o que precisa?
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
          Envie a sua pergunta. Ela segue para a Gestão da FAQ, onde será respondida e publicada.
        </p>
        {enviada ? (
          <p className="mt-6 text-sm" style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' }}>
            Pergunta enviada.
          </p>
        ) : (
          <form onSubmit={(evento) => void enviar(evento)} className="mt-6">
            <label className="block text-sm" style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' }}>
              Pergunta
              <textarea
                value={pergunta}
                onChange={(evento) => setPergunta(evento.target.value)}
                required
                rows={6}
                maxLength={2000}
                className="mt-2 w-full px-3 py-2 text-sm outline-none"
                style={{
                  fontFamily: 'var(--moni-font-sans)',
                  color: 'var(--moni-text-primary)',
                  background: 'var(--moni-surface-0)',
                  border: 'var(--moni-border-width) solid var(--moni-border-default)',
                  borderRadius: 'var(--moni-radius-md)',
                  minHeight: 140,
                }}
              />
            </label>
            {erro ? (
              <p className="mt-2 text-sm" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
                {erro}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={enviando}
              className="mt-4 inline-flex w-full items-center justify-center text-sm text-white disabled:opacity-60"
              style={{
                minHeight: 44,
                background: 'var(--moni-navy-800)',
                borderRadius: 'var(--moni-radius-md)',
                fontFamily: 'var(--moni-font-sans)',
              }}
            >
              {enviando ? 'Enviando…' : 'Enviar pergunta'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
