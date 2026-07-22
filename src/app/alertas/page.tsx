import { guardLoginRequired } from '@/lib/auth-guard';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { MarcarLidoButton } from './MarcarLidoButton';
import { MarcarTodosLidoButton } from './MarcarTodosLidoButton';
import { CategoriaAlerta, categorizarAlerta, PrioridadeAlerta, priorizarAlerta, corPrioridade } from './categorizar';
import { KanbanAtividadeEnrich } from './KanbanAtividadeEnrich';

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

function parseQsParam(path: string | null | undefined, key: string): string | null {
  if (!path) return null;
  const idx = path.indexOf('?');
  if (idx === -1) return null;
  const qs = path.slice(idx + 1);
  for (const part of qs.split('&')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq) === key) return decodeURIComponent(part.slice(eq + 1));
  }
  return null;
}

const TIPOS_SIRENE = new Set([
  'kanban_atividade_criada',
  'kanban_atividade_atualizada',
  'kanban_atividade_redirecionada',
  'atribuicao_recusada',
  'sla_atividade_atrasado',
  'sla_atividade_atencao',
  'mencao_sirene',
]);

const TIPOS_KANBAN_ATIVIDADE = new Set([
  'kanban_atividade_criada',
  'kanban_atividade_atualizada',
  'kanban_atividade_redirecionada',
  'sla_atividade_atrasado',
  'sla_atividade_atencao',
  'atribuicao_recusada',
]);

export default async function AlertasPage({
  searchParams,
}: {
  searchParams?: { categoria?: string; lidas?: string; prioridade?: string };
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

  // Enrichment sirene: Q1 + Q3 em paralelo, depois Q2 dependente de Q1
  const interacaoIdsSet = new Set<string>();
  const topicoIdsSet = new Set<number>();
  const cardIdsSet = new Set<string>();
  for (const a of alertas ?? []) {
    const path = (a as { referencia_path?: string | null }).referencia_path;
    if (TIPOS_SIRENE.has(String(a.tipo ?? ''))) {
      const iid = parseQsParam(path, 'interacao');
      if (iid) interacaoIdsSet.add(iid);
    }
    const tid = parseQsParam(path, 'topico');
    if (tid) {
      const n = Number(tid);
      if (Number.isFinite(n) && n > 0) topicoIdsSet.add(n);
    }
    const cid = (a as { referencia_card_id?: string | null }).referencia_card_id;
    if (cid) cardIdsSet.add(cid);
  }
  const interacaoIds = [...interacaoIdsSet];
  const topicoIds = [...topicoIdsSet];
  const cardIds = [...cardIdsSet];

  const [atividadesRes, topicosRes, cardsRes] = await Promise.all([
    interacaoIds.length > 0
      ? supabase.from('kanban_atividades').select('id, sirene_chamado_id, descricao, data_vencimento').in('id', interacaoIds)
      : Promise.resolve({ data: [] as { id: string; sirene_chamado_id: number | null; descricao: string | null; data_vencimento: string | null }[] }),
    topicoIds.length > 0
      ? supabase.from('sirene_topicos').select('id, descricao_detalhe, descricao').in('id', topicoIds)
      : Promise.resolve({ data: [] as { id: number; descricao_detalhe: string | null; descricao: string | null }[] }),
    cardIds.length > 0
      ? supabase.from('kanban_cards').select('id, nome_condominio, quadra, lote, profiles(full_name)').in('id', cardIds)
      : Promise.resolve({ data: [] as { id: string; nome_condominio: string | null; quadra: string | null; lote: string | null; profiles: { full_name: string | null } | null }[] }),
  ]);

  const atividadeMap = new Map<string, number | null>();
  for (const a of (atividadesRes.data ?? []) as { id: string; sirene_chamado_id: number | null }[]) {
    atividadeMap.set(a.id, a.sirene_chamado_id);
  }

  type AtividadeEnrich = { id: string; descricao: string | null; data_vencimento: string | null };
  const atividadeEnrichMap = new Map<string, AtividadeEnrich>();
  for (const av of (atividadesRes.data ?? []) as { id: string; descricao: string | null; data_vencimento: string | null }[]) {
    atividadeEnrichMap.set(av.id, { id: av.id, descricao: av.descricao, data_vencimento: av.data_vencimento });
  }

  type TopicoEnrich = { descricao_detalhe: string | null; descricao: string | null };
  const topicoMap = new Map<number, TopicoEnrich>();
  for (const t of (topicosRes.data ?? []) as { id: number; descricao_detalhe: string | null; descricao: string | null }[]) {
    topicoMap.set(t.id, { descricao_detalhe: t.descricao_detalhe, descricao: t.descricao });
  }

  const chamadoIdsSet = new Set<number>();
  for (const cid of atividadeMap.values()) {
    if (cid != null) chamadoIdsSet.add(cid);
  }

  type ChamadoEnrich = { numero: number | null; aberto_por_nome: string | null; card_kanban_nome: string | null };
  const chamadoMap = new Map<number, ChamadoEnrich>();
  if (chamadoIdsSet.size > 0) {
    const { data: chamados } = await supabase
      .from('sirene_chamados')
      .select('id, numero, aberto_por_nome, card_kanban_nome')
      .in('id', [...chamadoIdsSet]);
    for (const c of (chamados ?? []) as { id: number; numero: number | null; aberto_por_nome: string | null; card_kanban_nome: string | null }[]) {
      chamadoMap.set(c.id, { numero: c.numero, aberto_por_nome: c.aberto_por_nome, card_kanban_nome: c.card_kanban_nome });
    }
  }

  type CardEnrich = { id: string; nome_condominio: string | null; quadra: string | null; lote: string | null; franqueado_nome: string | null };
  const cardMap = new Map<string, CardEnrich>();
  for (const c of (cardsRes.data ?? []) as { id: string; nome_condominio: string | null; quadra: string | null; lote: string | null; profiles: { full_name: string | null } | null }[]) {
    cardMap.set(c.id, {
      id: c.id,
      nome_condominio: c.nome_condominio,
      quadra: c.quadra,
      lote: c.lote,
      franqueado_nome: c.profiles?.full_name ?? null,
    });
  }

  const categoriaAtiva = (searchParams?.categoria ?? 'todos') as CategoriaAlerta | 'todos';
  const prioridadeAtiva = ((searchParams?.prioridade ?? 'todas') as PrioridadeAlerta | 'todas');
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

  const contadoresPrioridade: Record<PrioridadeAlerta | 'todas', number> = {
    todas: 0, critico: 0, importante: 0, informativo: 0,
  };
  for (const a of alertas ?? []) {
    if (!a.lido) {
      const pri = priorizarAlerta(String(a.tipo ?? ''));
      contadoresPrioridade[pri]++;
      contadoresPrioridade['todas']++;
    }
  }

  const naoLidasFiltradas = (alertas ?? []).filter(a => !a.lido && (prioridadeAtiva === 'todas' || priorizarAlerta(String(a.tipo ?? '')) === prioridadeAtiva) && (categoriaAtiva === 'todos' || categorizarAlerta(String(a.tipo ?? '')) === categoriaAtiva));
  const contagemNaoLidas = {
    critico: naoLidasFiltradas.filter(a => priorizarAlerta(String(a.tipo ?? '')) === 'critico').length,
    importante: naoLidasFiltradas.filter(a => priorizarAlerta(String(a.tipo ?? '')) === 'importante').length,
    informativo: naoLidasFiltradas.filter(a => priorizarAlerta(String(a.tipo ?? '')) === 'informativo').length,
    total: naoLidasFiltradas.length,
  };

  const alertasFiltrados = (alertas ?? []).filter((a) => {
    if (prioridadeAtiva !== 'todas' && priorizarAlerta(String(a.tipo ?? '')) !== prioridadeAtiva) return false;
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

        {/* Filtros de prioridade */}
        <div className="mb-3 flex flex-wrap gap-2">
          {([
            { key: 'todas' as const, label: 'Todas' },
            { key: 'critico' as const, label: '🔴 Crítico' },
            { key: 'importante' as const, label: '🟡 Importante' },
            { key: 'informativo' as const, label: '⚪ Informativo' },
          ]).map(({ key, label }) => {
            const count = contadoresPrioridade[key];
            const ativo = prioridadeAtiva === key;
            const params = new URLSearchParams();
            if (key !== 'todas') params.set('prioridade', key);
            if (categoriaAtiva !== 'todos') params.set('categoria', categoriaAtiva);
            if (soNaoLidas) params.set('lidas', 'nao');
            const href = `/alertas${params.toString() ? `?${params.toString()}` : ''}`;
            return (
              <Link
                key={key}
                href={href}
                className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                  ativo
                    ? 'border-[color:var(--moni-primary,#1C3A2B)] bg-[color:var(--moni-primary,#1C3A2B)] text-white'
                    : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                }`}
              >
                {label}
                {count > 0 && (
                  <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                    ativo ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'
                  }`}>
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
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
            <MarcarTodosLidoButton
                categoriaAtiva={String(categoriaAtiva)}
                prioridadeAtiva={String(prioridadeAtiva)}
                contagemNaoLidas={contagemNaoLidas}
              />
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

              const interacaoId = parseQsParam(basePath, 'interacao');
              const topicoIdStr = parseQsParam(basePath, 'topico');
              const topicoIdNum = topicoIdStr ? Number(topicoIdStr) : null;
              const sireneChamadoId = interacaoId ? (atividadeMap.get(interacaoId) ?? null) : null;
              const chamadoEnrich = sireneChamadoId != null ? (chamadoMap.get(sireneChamadoId) ?? null) : null;
              const topicoData = topicoIdNum && Number.isFinite(topicoIdNum) ? topicoMap.get(topicoIdNum) : undefined;
              const descricaoTexto = topicoData
                ? (topicoData.descricao_detalhe?.trim() || topicoData.descricao?.trim() || '')
                : null;

              const pri = priorizarAlerta(tipo);
              const coresPri = corPrioridade(pri);

              return (
                <li
                  key={a.id}
                  className={`rounded-xl border p-4 ${
                    !a.lido
                      ? `${coresPri.bg} border-l-4 ${coresPri.borda} border-t-stone-100 border-r-stone-100 border-b-stone-100`
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
                      {a.created_at ? new Date(a.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : ''}
                    </span>
                  </div>

                  {/* Linha 2: mensagem */}
                  {a.mensagem && (
                    <p className={`mb-2 text-sm ${!a.lido ? 'font-medium text-stone-800' : 'text-stone-700'}`}>
                      {a.mensagem}
                    </p>
                  )}

                  {/* Linha 2.5: enriquecimento sirene */}
                  {cat === 'sirene' && (chamadoEnrich || topicoData !== undefined) ? (
                    <div className="mb-3 space-y-1">
                      {chamadoEnrich ? (
                        <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                          {chamadoEnrich.card_kanban_nome ? (
                            <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-600">
                              {chamadoEnrich.card_kanban_nome}
                            </span>
                          ) : null}
                          {chamadoEnrich.numero != null ? (
                            <span className="tabular-nums">#{chamadoEnrich.numero}</span>
                          ) : null}
                          {chamadoEnrich.aberto_por_nome ? (
                            <span>Aberto por: <span className="font-medium text-stone-600">{chamadoEnrich.aberto_por_nome}</span></span>
                          ) : null}
                        </div>
                      ) : null}
                      {topicoData !== undefined ? (
                        <p className="text-xs">
                          {descricaoTexto
                            ? <span className="text-stone-600">{descricaoTexto.length > 80 ? `${descricaoTexto.slice(0, 80)}…` : descricaoTexto}</span>
                            : <span className="text-stone-400">sem descrição</span>
                          }
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {/* Linha 2.6: enriquecimento kanban — franqueado, condomínio, quadra/lote, descrição */}
                  {TIPOS_KANBAN_ATIVIDADE.has(tipo) && (() => {
                    const cardEnrich = cardId ? cardMap.get(cardId) : null;
                    const interacaoIdKanban = parseQsParam(basePath, 'interacao');
                    const atividadeEnrich = interacaoIdKanban ? atividadeEnrichMap.get(interacaoIdKanban) : null;

                    const linhaCard = [
                      cardEnrich?.franqueado_nome,
                      cardEnrich?.nome_condominio,
                      cardEnrich?.quadra ? `Q${cardEnrich.quadra}` : null,
                      cardEnrich?.lote ? `L${cardEnrich.lote}` : null,
                    ].filter(Boolean).join(' · ');

                    const prazoStr = atividadeEnrich?.data_vencimento
                      ? (() => {
                          const [y, m, d] = atividadeEnrich.data_vencimento.split('-');
                          return `Prazo: ${d}/${m}/${y}`;
                        })()
                      : null;

                    if (!linhaCard && !atividadeEnrich?.descricao && !prazoStr) return null;

                    return (
                      <KanbanAtividadeEnrich
                        linhaCard={linhaCard}
                        descricao={atividadeEnrich?.descricao ?? null}
                        prazoStr={prazoStr}
                      />
                    );
                  })()}

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
