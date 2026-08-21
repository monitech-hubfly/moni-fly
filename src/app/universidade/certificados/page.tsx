import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCertificados } from '@/lib/universidade/queries';
import { Award, Lock } from 'lucide-react';

export const dynamic = 'force-dynamic';

const NIVEL_INFO: Array<{ nivel: number; titulo: string; subtitulo: string; requisito: string }> = [
  { nivel: 1, titulo: 'Fundamentos', subtitulo: 'Base do ecossistema', requisito: 'Concluir as casas 0 e 1 (Boas-vindas e Ecossistema).' },
  { nivel: 2, titulo: 'Step One', subtitulo: 'Mapeamento da região', requisito: 'Concluir a casa 2 (Step One).' },
  { nivel: 3, titulo: 'BCA e hipótese', subtitulo: 'Liquidez e viabilidade', requisito: 'Concluir a casa 3 (Hipótese de liquidez).' },
  { nivel: 4, titulo: 'Negociação', subtitulo: 'Comitê e propostas', requisito: 'Concluir as casas 4 e 5 (Comitê e Negociação).' },
  { nivel: 5, titulo: 'Operação completa', subtitulo: 'Da legalização à pré-obra', requisito: 'Concluir as casas 6 a 9 (Check legal até Pré-obra).' },
];

export default async function UniversidadeCertificadosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/universidade/certificados');

  const certs = await getCertificados(supabase, user.id);
  const porNivel = new Map(certs.map((c) => [c.nivel, c]));
  const nivelAtual = certs.length ? Math.max(...certs.map((c) => c.nivel)) : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <h1 className="text-2xl font-semibold text-stone-900">Suas certificações</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {NIVEL_INFO.map((n) => {
          const row = porNivel.get(n.nivel);
          const emitido = Boolean(row);
          const destaque = n.nivel === nivelAtual && emitido;
          return (
            <article
              key={n.nivel}
              className={`flex flex-col rounded-xl border p-5 shadow-sm ${
                emitido
                  ? 'border-[var(--moni-status-done-border)] bg-[var(--moni-status-done-bg)]'
                  : 'border-stone-200 bg-[var(--moni-surface-100)]'
              } ${destaque ? 'ring-2 ring-[var(--moni-status-done-border)]' : ''}`}
            >
              <div className="flex items-center gap-2">
                {emitido ? (
                  <Award className="h-5 w-5 text-[var(--moni-status-done-text)]" aria-hidden />
                ) : (
                  <Lock className="h-5 w-5 text-stone-400" aria-hidden />
                )}
                <span className="text-xs font-bold text-stone-500">Nível {n.nivel}</span>
              </div>
              <h2 className="mt-2 text-lg font-semibold text-stone-900">{n.titulo}</h2>
              <p className="text-xs text-stone-600">{n.subtitulo}</p>
              {emitido && row?.emitido_em ? (
                <p className="mt-3 text-xs text-stone-600">Emitido em {new Date(row.emitido_em).toLocaleDateString('pt-BR')}</p>
              ) : (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold text-stone-500">Bloqueado</p>
                  <p className="text-xs leading-relaxed text-stone-600">{n.requisito}</p>
                </div>
              )}
            </article>
          );
        })}
      </div>
      <Link href="/universidade" className="text-sm font-medium text-moni-primary hover:underline">
        ← Voltar ao tabuleiro
      </Link>
    </div>
  );
}
