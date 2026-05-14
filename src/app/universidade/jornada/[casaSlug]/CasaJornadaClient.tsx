'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Circle,
  ClipboardList,
  FileText,
  PlayCircle,
  Puzzle,
} from 'lucide-react';
import type { CasaComModulos, UniModulo, UniProgresso } from '@/lib/universidade/types';
import { marcarModuloConcluido, atualizarProgresso } from '@/lib/universidade/actions';
import { useRouter } from 'next/navigation';
import { ModuloVideo } from '@/components/universidade/modulos/ModuloVideo';
import { ModuloChecklist } from '@/components/universidade/modulos/ModuloChecklist';
import { ModuloQuiz } from '@/components/universidade/modulos/ModuloQuiz';
import { ModuloLeitura } from '@/components/universidade/modulos/ModuloLeitura';
import { ModuloTemplate } from '@/components/universidade/modulos/ModuloTemplate';
import { ProgressBar } from '@/components/universidade/ProgressBar';

type Props = {
  casa: CasaComModulos;
  progresso: UniProgresso[];
};

function metaModulo(m: UniModulo): string {
  if (m.tipo === 'video') return m.conteudo ? `${m.conteudo.duracao_min} min` : '—';
  if (m.tipo === 'leitura') return m.conteudo ? `${m.conteudo.tempo_leitura_min} min` : '—';
  if (m.tipo === 'quiz') return 'Quiz';
  if (m.tipo === 'checklist') return 'Checklist';
  return 'Template';
}

function IconTipo({ tipo }: { tipo: UniModulo['tipo'] }) {
  const cls = 'h-4 w-4 shrink-0';
  if (tipo === 'video') return <PlayCircle className={cls} aria-hidden />;
  if (tipo === 'leitura') return <BookOpen className={cls} aria-hidden />;
  if (tipo === 'checklist') return <ClipboardList className={cls} aria-hidden />;
  if (tipo === 'quiz') return <Puzzle className={cls} aria-hidden />;
  return <FileText className={cls} aria-hidden />;
}

export function CasaJornadaClient({ casa, progresso }: Props) {
  const router = useRouter();
  const porModulo = useMemo(() => new Map(progresso.map((p) => [p.modulo_id, p])), [progresso]);

  const defaultActive = useMemo(() => {
    for (const m of casa.modulos) {
      const p = porModulo.get(m.id);
      if (p?.status === 'em_progresso') return m.id;
    }
    for (const m of casa.modulos) {
      const p = porModulo.get(m.id);
      if (!p || p.status === 'pendente') return m.id;
    }
    return casa.modulos[0]?.id ?? null;
  }, [casa.modulos, porModulo]);

  const [activeId, setActiveId] = useState<string | null>(defaultActive);

  const pct =
    casa.modulos.filter((m) => m.obrigatorio !== false).length > 0
      ? Math.round(
          (casa.modulos.filter((m) => m.obrigatorio !== false && porModulo.get(m.id)?.status === 'concluido').length /
            casa.modulos.filter((m) => m.obrigatorio !== false).length) *
            100,
        )
      : 0;

  async function refresh() {
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <nav className="text-xs text-stone-500">
        <Link href="/universidade" className="text-moni-primary hover:underline">
          Universidade
        </Link>
        <span className="mx-1">→</span>
        <span className="text-stone-700">{casa.titulo}</span>
      </nav>

      <header>
        <p className="font-mono text-xs text-stone-500">Casa {casa.numero}</p>
        <h1 className="mt-1 text-2xl font-semibold text-stone-900">{casa.titulo}</h1>
        {casa.descricao ? <p className="mt-2 text-sm text-stone-600">{casa.descricao}</p> : null}
        <div className="mt-4 max-w-md">
          <ProgressBar percentual={pct} cor="amber" />
        </div>
      </header>

      {casa.modulos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-200 bg-stone-50 px-4 py-10 text-center text-sm text-stone-600">
          Ainda não há módulos publicados nesta casa. Volte em breve ou fale com o time Moní.
        </p>
      ) : (
      <ol className="space-y-3">
        {casa.modulos.map((m) => {
          const p = porModulo.get(m.id);
          const st = p?.status ?? 'pendente';
          const ativo = activeId === m.id;
          const icon =
            st === 'concluido' ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden />
            ) : st === 'em_progresso' ? (
              <PlayCircle className="h-5 w-5 text-amber-600" aria-hidden />
            ) : (
              <Circle className="h-5 w-5 text-stone-300" aria-hidden />
            );

          return (
            <li key={m.id} className="rounded-xl border border-stone-200 bg-white">
              <button
                type="button"
                onClick={() => setActiveId(m.id)}
                className="flex w-full items-start gap-3 p-4 text-left hover:bg-stone-50"
              >
                <IconTipo tipo={m.tipo} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {icon}
                    <span className="text-sm font-medium text-stone-900">{m.titulo}</span>
                  </div>
                  <p className="mt-1 text-xs text-stone-500">{metaModulo(m)}</p>
                </div>
              </button>
              {ativo ? (
                <div className="border-t border-stone-100 p-4">
                  <ModuloBody
                    modulo={m}
                    progresso={p}
                    onDone={async () => {
                      await refresh();
                    }}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
      )}

      <Link href="/universidade" className="inline-block text-sm font-medium text-moni-primary hover:underline">
        ← Voltar ao tabuleiro
      </Link>
    </div>
  );
}

function ModuloBody({
  modulo,
  progresso,
  onDone,
}: {
  modulo: UniModulo;
  progresso: UniProgresso | undefined;
  onDone: () => Promise<void>;
}) {
  const concluido = progresso?.status === 'concluido';
  const dados = (progresso?.dados as Record<string, boolean> | undefined) ?? {};

  if (modulo.tipo === 'video' && modulo.conteudo) {
    return (
      <ModuloVideo
        tituloModulo={modulo.titulo}
        conteudo={modulo.conteudo}
        concluido={concluido}
        onConcluir={async () => {
          await marcarModuloConcluido(modulo.id);
          await onDone();
        }}
      />
    );
  }
  if (modulo.tipo === 'leitura' && modulo.conteudo) {
    return (
      <ModuloLeitura
        conteudo={modulo.conteudo}
        concluido={concluido}
        onConcluir={async () => {
          await marcarModuloConcluido(modulo.id);
          await onDone();
        }}
      />
    );
  }
  if (modulo.tipo === 'template' && modulo.conteudo) {
    return (
      <ModuloTemplate
        conteudo={modulo.conteudo}
        onConcluir={async () => {
          await marcarModuloConcluido(modulo.id);
          await onDone();
        }}
      />
    );
  }
  if (modulo.tipo === 'checklist' && modulo.conteudo) {
    return (
      <ModuloChecklist
        conteudo={modulo.conteudo}
        dados={dados}
        onAtualizar={async (d) => {
          await atualizarProgresso(modulo.id, 'em_progresso', d);
          await onDone();
        }}
        onConcluir={async (d) => {
          await marcarModuloConcluido(modulo.id, d);
          await onDone();
        }}
      />
    );
  }
  if (modulo.tipo === 'quiz' && modulo.conteudo) {
    return (
      <ModuloQuiz
        conteudo={modulo.conteudo}
        onConcluir={async (nota) => {
          await marcarModuloConcluido(modulo.id, { nota });
          await onDone();
        }}
      />
    );
  }
  return <p className="text-sm text-stone-500">Conteúdo indisponível para este módulo.</p>;
}
