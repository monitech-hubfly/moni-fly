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
import { marcarModuloConcluido, atualizarProgresso, registrarInicioFaseCasa } from '@/lib/universidade/actions';
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

  const faseRegistrada = useMemo(() => {
    const mids = new Set(casa.modulos.map((m) => m.id));
    return progresso.some((p) => mids.has(p.modulo_id));
  }, [casa.modulos, progresso]);

  const [iniciandoFase, setIniciandoFase] = useState(false);
  const [erroInicio, setErroInicio] = useState<string | null>(null);

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

      {casa.modulos.length > 0 && !faseRegistrada ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 shadow-sm">
          <p className="font-medium text-amber-900">Explorar sem registrar progresso</p>
          <p className="mt-2 text-amber-950/90">
            Você pode abrir qualquer módulo e ler o conteúdo. Nada é gravado no tabuleiro até você iniciar esta fase
            de forma explícita.
          </p>
          {erroInicio ? <p className="mt-2 text-xs font-medium text-red-700">{erroInicio}</p> : null}
          <button
            type="button"
            disabled={iniciandoFase}
            onClick={async () => {
              setErroInicio(null);
              setIniciandoFase(true);
              try {
                const r = await registrarInicioFaseCasa(casa.id);
                if (!r.ok) {
                  setErroInicio(r.error ?? 'Não foi possível iniciar.');
                  return;
                }
                await refresh();
              } finally {
                setIniciandoFase(false);
              }
            }}
            className="mt-3 rounded-lg bg-moni-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {iniciandoFase ? 'Iniciando…' : 'Iniciar fase e registrar progresso'}
          </button>
        </div>
      ) : null}

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
                    podePersistirProgresso={faseRegistrada}
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
  podePersistirProgresso,
  onDone,
}: {
  modulo: UniModulo;
  progresso: UniProgresso | undefined;
  podePersistirProgresso: boolean;
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
        podePersistirProgresso={podePersistirProgresso}
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
        podePersistirProgresso={podePersistirProgresso}
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
        podePersistirProgresso={podePersistirProgresso}
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
        podePersistirProgresso={podePersistirProgresso}
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
      <div key={`${modulo.id}-persist-${podePersistirProgresso}`}>
        <ModuloQuiz
          conteudo={modulo.conteudo}
          podePersistirProgresso={podePersistirProgresso}
          onConcluir={async (nota) => {
            await marcarModuloConcluido(modulo.id, { nota });
            await onDone();
          }}
        />
      </div>
    );
  }
  return <p className="text-sm text-stone-500">Conteúdo indisponível para este módulo.</p>;
}
