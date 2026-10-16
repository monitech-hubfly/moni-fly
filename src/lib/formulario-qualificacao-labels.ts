/** Rótulos das respostas do Formulário de Qualificação (Plano Permuteiro). */

export const ROTULOS_RESPOSTA_QUALIFICACAO: Record<string, Record<string, string>> = {
  capital_faixa: {
    nao_tenho: 'Não tenho capital para aporte inicial',
    abaixo_260k: 'Abaixo de R$ 260.000',
    '260_400k': 'R$ 260.000 a R$ 400.000',
    '400_600k': 'R$ 400.000 a R$ 600.000',
    acima_600k: 'Acima de R$ 600.000',
  },
  conhecimento_mercado: {
    alto: 'Alto: conheço corretores, loteadoras e preços praticados',
    medio: 'Médio: conheço a cidade, mas não tenho rede no mercado',
    baixo: 'Baixo: sou novo no mercado',
  },
  conhecimento_imob: {
    sim_inc: 'Sim: já participei de incorporação ou desenvolvimento',
    sim_compra: 'Sim: já comprei/vendi imóveis ou acompanhei obras',
    nao: 'Não: meu background é em outra área',
  },
  conhecimento_moni: {
    fluente: 'Fluente: uso as ferramentas regularmente',
    basico: 'Básico: tenho os links, mas não opero sozinho',
    pouco: 'Pouco: ainda não abri os links na Área do Franqueado',
  },
  tempo_horas: {
    '10+': '10h ou mais por semana',
    '5-10': '5 a 10h por semana',
    '2-5': '2 a 5h por semana',
    '<2': 'Menos de 2h por semana',
  },
  tempo_resposta: {
    mesmo_dia: 'No mesmo dia, sempre',
    '24h': 'Em até 24h na maioria das vezes',
    '2-3d': 'Em 2 a 3 dias',
    semana: 'Depende: às vezes demoro mais de 3 dias',
  },
  tempo_agenda: {
    sim_tudo: 'Sim: agenda disponível para reuniões e visitas de campo',
    sim_online: 'Reuniões sim, visita ao terreno com aviso prévio de 3+ dias',
    parcial: 'Agenda apertada: 1 semana de antecedência',
  },
  workshops: {
    sim_ja: 'Sim: já participei de workshops',
    sim_pode: 'Ainda não, mas tenho como participar',
    nao: 'Não tenho como participar no momento',
  },
  resultado_tipo: {
    qualificado: 'Qualificado',
    parcial: 'Parcial',
    nao_qualificado: 'Não qualificado',
  },
};

export function rotuloRespostaQualificacao(
  campo: string,
  valor: string | null | undefined,
): string {
  const v = String(valor ?? '').trim();
  if (!v) return '';
  return ROTULOS_RESPOSTA_QUALIFICACAO[campo]?.[v] ?? v;
}

export function formatarDataQualificacao(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}
