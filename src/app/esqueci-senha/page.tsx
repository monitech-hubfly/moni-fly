"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      setSent(true);
    } catch {
      setError("Erro ao enviar. Tente de novo.");
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
        <div className="card w-full max-w-md">
          <h1 className="text-xl font-bold text-moni-dark">E-mail enviado</h1>
          <p className="mt-2 text-stone-600">
            Se existir uma conta com esse e-mail, você receberá um link para redefinir sua senha. Verifique a caixa de entrada e o spam.
          </p>
          <Link href="/login" className="mt-6 inline-block text-moni-accent hover:underline">
            Voltar ao login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
      <div className="card w-full max-w-md">
        <h1 className="text-xl font-bold text-moni-dark">Esqueci minha senha</h1>
        <p className="mt-2 text-sm text-stone-600">
          Informe o e-mail da sua conta. Enviaremos um link para você criar uma nova senha.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-stone-700">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Enviando…" : "Enviar link de redefinição"}
          </button>
        </form>
        <Link href="/login" className="mt-4 inline-block text-sm text-moni-accent hover:underline">
          Voltar ao login
        </Link>
      </div>
    </div>
  );
}
