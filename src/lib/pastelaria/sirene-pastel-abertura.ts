import type { SupabaseClient } from '@supabase/supabase-js';
import {
  normMoniNome,
  resolverEmailMoniPorNomeOuApelido,
  responsaveisDoTimeMoni,
} from '@/lib/times-responsaveis';
import { semanaAtualLabel } from '@/lib/pastelaria/week';
import { registrarPastelariaLog } from '@/lib/pastelaria/log';

type ProfileRow = {
  id: string;
  full_name: string | null;
  nome_completo: string | null;
  email: string | null;
  departamento: string | null;
};

function profileDisplayName(p: ProfileRow): string {
  return (p.full_name ?? p.nome_completo ?? '').trim();
}

function profilePertenceAoTime(p: ProfileRow, timeAbertura: string): boolean {
  const dept = (p.departamento ?? '').trim();
  if (!dept) return false;
  if (dept === timeAbertura) return true;
  const nd = normMoniNome(dept);
  const nt = normMoniNome(timeAbertura);
  return nd.includes(nt) || nt.includes(nd);
}

function scoreNomeProximidade(alvo: string, candidato: string): number {
  const a = normMoniNome(alvo);
  const c = normMoniNome(candidato);
  if (!a || !c) return 0;
  if (a === c) return 100;
  if (c.startsWith(a) || a.startsWith(c)) return 85;
  const aParts = a.split(/\s+/).filter(Boolean);
  const cParts = c.split(/\s+/).filter(Boolean);
  if (aParts[0] && aParts[0] === cParts[0]) return 70;
  if (c.includes(a) || a.includes(c)) return 55;
  const overlap = aParts.filter((part) => cParts.some((cp) => cp === part || cp.startsWith(part))).length;
  if (overlap >= 2) return 50;
  if (overlap === 1) return 35;
  return 0;
}

/** Resolve `profiles.id` pelo nome do responsável dentro do time de abertura. */
export async function resolverUserIdProfilePorTimeENome(
  admin: SupabaseClient,
  timeAbertura: string,
  responsavelNome: string,
): Promise<string | null> {
  const time = timeAbertura.trim();
  const alvo = responsavelNome.trim();
  if (!time || !alvo) return null;

  const { data: profilesRaw } = await admin
    .from('profiles')
    .select('id, full_name, nome_completo, email, departamento')
    .in('role', ['admin', 'team']);

  const profiles = (profilesRaw ?? []) as ProfileRow[];
  if (profiles.length === 0) return null;

  const emailCanon = resolverEmailMoniPorNomeOuApelido(alvo);
  if (emailCanon) {
    const porEmail = profiles.find(
      (p) => (p.email ?? '').trim().toLowerCase() === emailCanon && profilePertenceAoTime(p, time),
    );
    if (porEmail) return porEmail.id;

    const catalogoNorm = new Set(responsaveisDoTimeMoni(time).map((n) => normMoniNome(n)));
    const porEmailCatalogo = profiles.find((p) => {
      if ((p.email ?? '').trim().toLowerCase() !== emailCanon) return false;
      const dn = normMoniNome(profileDisplayName(p));
      return catalogoNorm.has(dn) || [...catalogoNorm].some((c) => dn.includes(c) || c.includes(dn));
    });
    if (porEmailCatalogo) return porEmailCatalogo.id;
  }

  let melhor: { id: string; score: number } | null = null;
  for (const p of profiles) {
    if (!profilePertenceAoTime(p, time)) continue;
    const score = scoreNomeProximidade(alvo, profileDisplayName(p));
    if (score > 0 && (!melhor || score > melhor.score)) {
      melhor = { id: p.id, score };
    }
  }

  if (melhor && melhor.score >= 35) return melhor.id;

  const catalogoNorm = new Set(responsaveisDoTimeMoni(time).map((n) => normMoniNome(n)));
  for (const p of profiles) {
    const dn = normMoniNome(profileDisplayName(p));
    const noCatalogo =
      catalogoNorm.has(dn) || [...catalogoNorm].some((c) => dn.includes(c) || c.includes(dn));
    if (!noCatalogo) continue;
    const score = scoreNomeProximidade(alvo, profileDisplayName(p));
    if (score > 0 && (!melhor || score > melhor.score)) {
      melhor = { id: p.id, score };
    }
  }

  return melhor && melhor.score >= 35 ? melhor.id : null;
}

export async function criarPastelariaInboxParaChamadoSirene(
  admin: SupabaseClient,
  input: {
    chamadoId: number;
    incendio: string;
    timeAbertura: string;
    aberturaResponsavelNome: string;
    criadoPorUserId: string;
  },
): Promise<{ ok: true; cardId: string } | { ok: false; skipped: true } | { ok: false; error: string }> {
  const userId = await resolverUserIdProfilePorTimeENome(
    admin,
    input.timeAbertura,
    input.aberturaResponsavelNome,
  );
  if (!userId) return { ok: false, skipped: true };

  const { data: vinculoPessoa } = await admin
    .from('area_pessoas_users')
    .select('area_pessoa_id')
    .eq('user_id', userId)
    .maybeSingle();

  const areaPessoaId = (vinculoPessoa as { area_pessoa_id?: string } | null)?.area_pessoa_id;
  if (!areaPessoaId) return { ok: false, skipped: true };

  const { data: pessoa } = await admin
    .from('area_pessoas')
    .select('id, nome, area_id, ativo')
    .eq('id', areaPessoaId)
    .maybeSingle();

  const pessoaRow = pessoa as { id: string; nome: string; area_id: string; ativo?: boolean } | null;
  if (!pessoaRow?.id || pessoaRow.ativo === false) return { ok: false, skipped: true };

  const { data: existente } = await admin
    .from('sirene_pastelaria_vinculos')
    .select('id')
    .eq('sirene_chamado_id', input.chamadoId)
    .maybeSingle();

  if (existente) return { ok: false, skipped: true };

  const semanaOrigem = semanaAtualLabel();

  const { data: card, error: cardErr } = await admin
    .from('pastelaria_cards')
    .insert({
      nome: input.incendio.trim(),
      area_id: pessoaRow.area_id,
      coluna: 'inbox',
      source: 'sirene',
      responsavel_id: pessoaRow.id,
      responsavel_nome: pessoaRow.nome,
      semana_origem: semanaOrigem,
      sirene_chamado_id: input.chamadoId,
      opened_by: input.aberturaResponsavelNome.trim(),
      created_by: input.criadoPorUserId,
    })
    .select('id')
    .single();

  if (cardErr) return { ok: false, error: cardErr.message };

  const cardId = (card as { id: string }).id;

  const { error: vincErr } = await admin.from('sirene_pastelaria_vinculos').insert({
    sirene_chamado_id: input.chamadoId,
    pastelaria_card_id: cardId,
  });

  if (vincErr) {
    await admin.from('pastelaria_cards').delete().eq('id', cardId);
    return { ok: false, error: vincErr.message };
  }

  await registrarPastelariaLog(admin, {
    card_id: cardId,
    user_id: input.criadoPorUserId,
    acao: 'criado',
    detalhes: { origem: 'sirene', sirene_chamado_id: input.chamadoId },
  });

  return { ok: true, cardId };
}
