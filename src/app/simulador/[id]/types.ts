import type { TemplateConfig } from '@/lib/simulador/calcular-oferta';

export type LotePublico = {
  id: string;
  codigo: string;
  valor: number;
};

export type SimuladorPublicoView = {
  token: string;
  templateId: string;
  nomeLoteamento: string;
  prazoObraMeses: number;
  valorLotePadrao: number | null;
  taxaFinanciamentoAnual: number;
  kanbanCardId: string | null;
  redeLoteadorId: string | null;
  config: TemplateConfig;
  lotes: LotePublico[];
};
