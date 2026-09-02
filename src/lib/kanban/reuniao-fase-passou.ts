import { dataIsoInputValida } from '@/lib/kanban/kanban-card-datas';

export function devePerguntarReinicioReuniao(input: {
  dataReuniao: string | null | undefined;
  origem: 'nativo' | 'legado';
  faseIdAtual?: string | null;
  dataReuniaoFaseId?: string | null;
  etapaSlugAtual?: string | null;
  dataReuniaoEtapaSlug?: string | null;
}): boolean {
  const dr = String(input.dataReuniao ?? '').trim().slice(0, 10);
  if (!dr || !dataIsoInputValida(dr)) return false;

  if (input.origem === 'legado') {
    const atual = String(input.etapaSlugAtual ?? '').trim();
    const registrada = String(input.dataReuniaoEtapaSlug ?? '').trim();
    if (!atual || !registrada) return false;
    return atual !== registrada;
  }

  const faseAtual = String(input.faseIdAtual ?? '').trim();
  const faseRegistrada = String(input.dataReuniaoFaseId ?? '').trim();
  if (!faseAtual || !faseRegistrada) return false;
  return faseAtual !== faseRegistrada;
}
