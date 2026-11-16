import type { OrigemCardFormulario } from '@/types/formularios';

export type CardPortfolioFormulario = {
  id: string;
  rotulo: string;
  franqueado: string;
  condominio: string;
  cidade_uf: string;
  quadra_lote: string;
  casa: string;
  area_lote: string;
  rede_franqueado_id: string | null;
  numero_franquia: string | null;
};

export function termoBuscaPortfolio(bruto: string): string {
  return bruto
    .replace(/[^\p{L}\p{N}\s/-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

export function textoDaOrigem(card: CardPortfolioFormulario, origem: OrigemCardFormulario): string {
  switch (origem) {
    case 'franqueado':
      return card.franqueado;
    case 'condominio':
      return card.condominio;
    case 'cidade_uf':
      return card.cidade_uf;
    case 'quadra_lote':
      return card.quadra_lote;
    case 'casa':
      return card.casa;
    case 'area_lote':
      return card.area_lote;
    default:
      return '';
  }
}

export function montarRotuloCard(partes: {
  condominio: string;
  franqueado: string;
  quadra_lote: string;
  cidade_uf: string;
}): string {
  const condominio = partes.condominio.trim() || 'Card do Portfólio';
  return [condominio, partes.franqueado, partes.quadra_lote, partes.cidade_uf].map((item) => item.trim()).filter(Boolean).join(' · ');
}
