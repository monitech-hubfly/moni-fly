import type {
  GargaloScoreFase,
  PainelCardDTO,
  PainelChamadoUnificadoDTO,
  PainelChamadosAnalise,
  PainelFaseDTO,
} from '@/lib/kanban/painel-performance-types';

function statusLabel(status: string): string {
  const st = status.trim().toLowerCase();
  const map: Record<string, string> = {
    nao_iniciado: 'Não iniciado',
    em_andamento: 'Em andamento',
    pendente: 'Pendente',
    concluida: 'Concluída',
    concluido: 'Concluído',
    aprovado: 'Aprovado',
    cancelada: 'Cancelada',
    cancelado: 'Cancelado',
    aguardando_aprovacao_criador: 'Aguardando aprovação',
  };
  return map[st] ?? (status.trim() || '—');
}

export function computePainelChamados(input: {
  chamados: PainelChamadoUnificadoDTO[];
  cards: PainelCardDTO[];
  fases: PainelFaseDTO[];
  profiles: Record<string, string>;
  gargaloRanking: GargaloScoreFase[];
}): PainelChamadosAnalise {
  const faseById = new Map(input.fases.map((f) => [f.id, f]));
  const cardById = new Map(input.cards.map((c) => [c.id, c]));
  const cardIdsFunil = new Set(input.cards.map((c) => c.id));

  const chamados = input.chamados.map((ch) => {
    let responsavelNome = ch.responsavelNome;
    if (!responsavelNome && ch.responsavelId) {
      responsavelNome = input.profiles[ch.responsavelId] ?? null;
    }
    if (!responsavelNome) {
      responsavelNome = cardById.get(ch.cardId)?.responsavel_fase_nome ?? null;
    }
    return { ...ch, responsavelNome };
  }).filter((ch) => cardIdsFunil.has(ch.cardId));

  const abertos = chamados.filter((c) => c.aberto);
  const concluidos = chamados.filter((c) => c.concluido);
  const vencidos = chamados.filter((c) => c.vencido);
  const comTrava = chamados.filter((c) => c.trava && c.aberto);
  const emPastelaria = chamados.filter((c) => c.emPastelaria);

  const cardsComAbertos = new Set(abertos.map((c) => c.cardId));
  const cardsComTrava = new Set(comTrava.map((c) => c.cardId));

  const totalCards = input.cards.length;
  const mediaPorCard = totalCards === 0 ? null : chamados.length / totalCards;

  const porFaseMap = new Map<
    string,
    { faseId: string; faseNome: string; total: number; abertos: number; comTrava: number; vencidos: number }
  >();
  for (const f of input.fases) {
    porFaseMap.set(f.id, { faseId: f.id, faseNome: f.nome, total: 0, abertos: 0, comTrava: 0, vencidos: 0 });
  }

  for (const ch of chamados) {
    const card = cardById.get(ch.cardId);
    const fid = card?.fase_id ?? '';
    const row = porFaseMap.get(fid);
    if (!row) continue;
    row.total += 1;
    if (ch.aberto) row.abertos += 1;
    if (ch.trava && ch.aberto) row.comTrava += 1;
    if (ch.vencido) row.vencidos += 1;
  }

  const porFase = [...porFaseMap.values()]
    .filter((r) => r.total > 0)
    .sort((a, b) => b.abertos - a.abertos || b.total - a.total);

  const respMap = new Map<
    string,
    { responsavelId: string | null; responsavelNome: string; total: number; abertos: number; comTrava: number }
  >();
  for (const ch of chamados) {
    const nome = ch.responsavelNome?.trim() || 'Sem responsável';
    const key = ch.responsavelId ?? `nome:${nome}`;
    const cur = respMap.get(key) ?? {
      responsavelId: ch.responsavelId,
      responsavelNome: nome,
      total: 0,
      abertos: 0,
      comTrava: 0,
    };
    cur.total += 1;
    if (ch.aberto) cur.abertos += 1;
    if (ch.trava && ch.aberto) cur.comTrava += 1;
    respMap.set(key, cur);
  }
  const porResponsavel = [...respMap.values()].sort((a, b) => b.abertos - a.abertos || b.total - a.total);

  const statusMap = new Map<string, number>();
  for (const ch of chamados) {
    const label = statusLabel(ch.status);
    statusMap.set(label, (statusMap.get(label) ?? 0) + 1);
  }
  const porStatus = [...statusMap.entries()]
    .map(([status, total]) => ({ status, total }))
    .sort((a, b) => b.total - a.total);

  const travaPorFase = porFase
    .filter((r) => r.comTrava > 0)
    .map((r) => ({ faseId: r.faseId, faseNome: r.faseNome, total: r.comTrava }))
    .sort((a, b) => b.total - a.total);

  const vencidosPorFase = porFase
    .filter((r) => r.vencidos > 0)
    .map((r) => ({ faseId: r.faseId, faseNome: r.faseNome, total: r.vencidos }))
    .sort((a, b) => b.total - a.total);

  const topGargaloIds = new Set(input.gargaloRanking.slice(0, 3).map((g) => g.faseId));
  const gargaloRelacao = input.gargaloRanking.slice(0, 5).map((g) => {
    const faseCh = porFaseMap.get(g.faseId);
    return {
      faseId: g.faseId,
      faseNome: g.faseNome,
      gargaloScore: g.score,
      gargaloClassificacao: g.classificacao,
      chamadosAbertos: faseCh?.abertos ?? 0,
      chamadosComTrava: faseCh?.comTrava ?? 0,
      chamadosVencidos: faseCh?.vencidos ?? 0,
      ehTopGargalo: topGargaloIds.has(g.faseId),
    };
  });

  const destaque = [...abertos]
    .sort((a, b) => {
      const score = (x: PainelChamadoUnificadoDTO) => {
        const card = cardById.get(x.cardId);
        const fid = card?.fase_id ?? '';
        return (
          (x.trava ? 10 : 0) +
          (x.vencido ? 5 : 0) +
          (topGargaloIds.has(fid) ? 3 : 0) +
          (x.emPastelaria ? 1 : 0)
        );
      };
      return score(b) - score(a);
    })
    .slice(0, 12)
    .map((ch) => {
      const card = cardById.get(ch.cardId);
      const fid = card?.fase_id ?? '';
      return {
        id: ch.kanbanAtividadeId ?? ch.dedupeKey,
        titulo: ch.titulo,
        numero: ch.numero,
        cardId: ch.cardId,
        cardTitulo: card?.titulo ?? '—',
        faseNome: faseById.get(fid)?.nome ?? '—',
        trava: ch.trava,
        atrasado: ch.vencido,
        status: ch.status,
        emPastelaria: ch.emPastelaria,
        editHref:
          ch.kanbanAtividadeId != null
            ? `/sirene/chamados?interacao=${encodeURIComponent(ch.kanbanAtividadeId)}`
            : ch.sireneChamadoId != null
              ? `/sirene/chamados?id=${encodeURIComponent(String(ch.sireneChamadoId))}`
              : null,
      };
    });

  return {
    abertos: abertos.length,
    concluidos: concluidos.length,
    vencidos: vencidos.length,
    comTrava: comTrava.length,
    emPastelaria: emPastelaria.length,
    mediaPorCard,
    cardsComChamadosAbertos: cardsComAbertos.size,
    cardsComChamadosTrava: cardsComTrava.size,
    totalChamados: chamados.length,
    porFase,
    porResponsavel,
    porStatus,
    travaPorFase,
    vencidosPorFase,
    gargaloRelacao,
    emGargalo: abertos.filter((ch) => {
      const card = cardById.get(ch.cardId);
      return card != null && topGargaloIds.has(card.fase_id);
    }).length,
    destaque,
  };
}
