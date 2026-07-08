import { guardLoginRequired } from '@/lib/auth-guard';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { MarcarLidoButton } from './MarcarLidoButton';
import { MarcarTodosLidoButton } from './MarcarTodosLidoButton';
import { CategoriaAlerta, categorizarAlerta } from './categorizar';

function rotuloTipo(tipo: string): string {
  if (tipo === 'mencao_kanban_card') return 'Menção em card';
  if (tipo === 'mencao_sirene') return 'Menção no Sirene';
  if (tipo === 'mencao_card') return 'Menção em processo';
  if (tipo === 'kanban_atividade_criada') return 'Nova atividade';
  if (tipo === 'kanban_atividade_atualizada') return 'Chamado atualizado';
  if (tipo === 'kanban_atividade_redirecionada') return 'Atividade redirecionada';
  if (tipo === 'atribuicao_recusada') return 'Atividade recusada';
  if (tipo === 'sla_atividade_atrasado') return 'Atividade atrasada';
  if (tipo === 'sla_atividade_atencao') return 'Atividade em atenção';
  if (tipo === 'status_preenchimento_lembrete') return 'Lembrete de entrega';
  return tipo;
}

function corCategoria(cat: CategoriaAlerta) {
  if (cat === 'sirene') return { dot: 'bg-blue-500', badge: 'bg-blue-50 text-blue-700 border-blue-200', borda: 'border-l-blue-400' };
  if (cat === 'cards') return { dot: 'bg-green-500', badge: 'bg-green-50 text-green-700 border-green-200', borda: 'border-l-green-400' };
  if (cat === 'planejamento') return { dot: 'bg-purple-500', badge: 'bg-purple-50 text-purple-700 border-purple-200', borda: 'border-l-purple-400' };
  return { dot: 'bg-stone-400', badge: 'bg-stone-50 text-stone-600 border-stone-200', borda: 'border-l-stone-300' };
}

function labelCategoria(cat: CategoriaAlerta) {
  if (cat === 'sirene') return 'Sirene';
  if (cat === 'cards') return 'Cards';
  if (cat === 'planejamento') return 'Planejamento';
  return 'Gerais';
}

function corAtrasado(tipo: string) {
  if (tipo === 'sla_atividade_atrasado') return true;
  return false;
}

export default async function AlertasPage({
  searchParams,
}: {
  searchParams?: { categoria?: string; lidas?: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  guardLoginRequired(user);

  const { data: alertas } = await supabase
    .from('alertas')
    .select('id, tipo, mensagem, lido, created_at, referencia_card_id, referencia_path')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(100);

  const categoriaAtiva = (searchParams?.categoria ?? 'todos') as CategoriaAlerta | 'todos';
  const soNaoLidas = searchParams?.lidas !== 'todas';

  const categorias: { key: CategoriaAlerta | 'todos'; label: string }[] = [
    { key: 'todos', label: 'Todos' },
    { key: 'sirene', label: 'Sirene' },
    { key: 'cards', label: 'Cards' },
    { key: 'planejamento', label: 'Planejamento' },
    { key: 'gerais', label: 'Gerais' },
  ];

  const contadores: Record<CategoriaAlerta | 'todos', number> = {
    todos: 0, sirene: 0, cards: 0, planejamento: 0, gerais: 0,
  };
  for (const a of alertas ?? []) {
    const cat = categorizarAlerta(String(a.tipo ?? ''));
    if (!a.lido) {
      contadores[cat]++;
      contadores['todos']++;
    }
  }

  const alertasFiltrados = (alertas ?? []).filter((a) => {
    if (categoriaAtiva !== 'todos' && categorizarAlerta(String(a.tipo ?? '')) !== categoriaAtiva) return false;
    if (soNaoLidas && a.lido) return false;
    return true;
  });

  const naoLidasNaVisao = alertasFiltrados.filter(a => !a.lido).length;

  const hrefNaoLidas = categoriaAtiva !== 'todos'
    ? `/alertas?categoria=${categoriaAtiva}`
    : '/alertas';
  const hrefTodas = categoriaAtiva !== 'todos'
    ? `/alertas?categoria=${categoriaAtiva}&lidas=todas`
    : '/alertas?lidas=todas';

  return (
    <div className="min-h-screen bg-[var(--moni-surface-50)]">
      <header className="border-b border-[color:var(--moni-border-default)] bg-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-4 px-4">
          <Link href="/" className="text-sm text-[color:var(--moni-primary)] hover:underline">← Início</Link>
          <span className="text-stone-400">/</span>
          <span className="text-sm font-medium text-stone-700">Alertas</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-[color:var(--moni-dark)]">Alertas</h1>
          <p className="mt-1 text-sm text-stone-500">Atualizações dos seus chamados, cards e planejamento.</p>
        </div>

        {/* Abas de categoria — preservam estado do toggle via URL */}
        <div className="mb-4 flex flex-wrap gap-2">
          {categorias.map((cat) => {
            const isActive = categoriaAtiva === cat.key;
            const count = contadores[cat.key];
            const href = cat.key === 'todos'
              ? (soNaoLidas ? '/alertas' : '/alertas?lidas=todas')
              : (soNaoLidas ? `/alertas?categoria=${cat.key}` : `/alertas?categoria=${cat.key}&lidas=todas`);
            return (
              <Link
                key={cat.key}
                href={href}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-[color:var(--moni-border-strong)] bg-white text-[color:var(--moni-dark)] shadow-sm'
                    : 'border-[color:var(--moni-border-default)] bg-white text-stone-500 hover:text-stone-700'
                }`}
              >
                {cat.label}
                {count > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                    cat.key === 'todos' ? 'bg-red-100 text-red-700' : 'bg-[var(--moni-surface-100)] text-[color:var(--moni-text-secondary)]'
                  }`}>
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Toggle Não lidas / Todas + Marcar tudo como lido */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-50)] p-0.5 text-sm">
            <Link
              href={hrefNaoLidas}
              className={`rounded-md px-3 py-1 font-medium transition-colors ${
                soNaoLidas
                  ? 'bg-white text-[color:var(--moni-dark)] shadow-sm'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              Não lidas{contadores[categoriaAtiva] > 0 ? ` (${contadores[categoriaAtiva]})` : ''}
            </Link>
            <Link
              href={hrefTodas}
              className={`rounded-md px-3 py-1 font-medium transition-colors ${
                !soNaoLidas
                  ? 'bg-white text-[color:var(--moni-dark)] shadow-sm'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              Todas
            </Link>
          </div>
          {naoLidasNaVisao > 0 && (
            <MarcarTodosLidoButton categoriaAtiva={String(categoriaAtiva)} />
          )}
        </div>

        {/* Lista */}
        {!alertasFiltrados.length ? (
          <div className="rounded-xl border border-[color:var(--moni-border-default)] bg-white p-8 text-center text-sm text-stone-500">
            {soNaoLidas
              ? `Nenhum alerta não lido${categoriaAtiva !== 'todos' ? ` em "${labelCategoria(categoriaAtiva as CategoriaAlerta)}"` : ''}.`
              : `Nenhum alerta${categoriaAtiva !== 'todos' ? ` em "${labelCategoria(categoriaAtiva as CategoriaAlerta)}"` : ''} no momento.`
            }
          </div>
        ) : (
          <ul className="space-y-2">
            {alertasFiltrados.map((a) => {
              const tipo = String(a.tipo ?? '');
              const cat = categorizarAlerta(tipo);
              const cores = corCategoria(cat);
              const atrasado = corAtrasado(tipo);

              const cardId = (a as { referencia_card_id?: string | null }).referencia_card_id;
              const basePath = (a as { referencia_path?: string | null }).referencia_path;
              const hrefSirene = tipo === 'mencao_sirene' && basePath ? basePath : null;
              const hrefCard = cardId && basePath && tipo !== 'mencao_sirene'
                ? basePath.includes('interacao=') ? basePath : `${basePath}?card=${encodeURIComponent(cardId)}`
                : null;
              const hrefInteracao = !cardId && basePath?.includes('interacao=') ? basePath : null;
              const hrefSlaAtividade = tipo === 'sla_atividade_atrasado' || tipo === 'sla_atividade_atencao' ? basePath || null : null;
              const hrefAlerta = hrefSlaAtividade || hrefSirene || hrefCard || hrefInteracao;

              return (
                <li
                  key={a.id}
                  className={`rounded-xl border p-4 ${
                    !a.lido
                      ? atrasado
                        ? 'bg-amber-50 border-l-4 border-l-red-400 border-t-stone-100 border-r-stone-100 border-b-stone-100'
                        : `bg-amber-50 border-l-4 ${cores.borda} border-t-stone-100 border-r-stone-100 border-b-stone-100`
                      : 'bg-white border-stone-100'
                  }`}
                >
                  {/* Linha 1: categoria + tipo + tempo */}
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium ${cores.badge}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${cores.dot}`} />
                        {labelCategoria(cat)} · {rotuloTipo(tipo)}
                      </span>
                      {atrasado && (
                        <span className="rounded border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                          ⚠ Atrasado
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-stone-400">
                      {a.created_at ? new Date(a.created_at).toLocaleString('pt-BR') : ''}
                    </span>
                  </div>

                  {/* Linha 2: mensagem */}
                  {a.mensagem && (
                    <p className={`mb-3 text-sm ${!a.lido ? 'font-medium text-stone-800' : 'text-stone-700'}`}>
                      {a.mensagem}
                    </p>
                  )}

                  {/* Linha 3: ações */}
                  <div className="flex items-center justify-between gap-2">
                    {hrefAlerta ? (
                      <Link
                        href={hrefAlerta}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[color:var(--moni-primary)] hover:underline"
                      >
                        {tipo === 'mencao_sirene' || hrefInteracao || hrefSlaAtividade
                          ? 'Abrir chamado →'
                          : 'Abrir card →'}
                      </Link>
                    ) : <span />}
                    {!a.lido
                      ? <MarcarLidoButton alertaId={a.id} />
                      : <span className="rounded border border-stone-200 bg-stone-100 px-2 py-0.5 text-xs text-stone-400">Lido</span>
                    }
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
