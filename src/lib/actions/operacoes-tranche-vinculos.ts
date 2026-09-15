'use server';

/**
 * Server actions finas — a lógica vive em `@/lib/operacoes/tranche-vinculos-service`
 * para poder ser chamada também via Route Handler (JSON) sem flight/digest RSC.
 */
export {
  listarTrancheVinculosOperacoes,
  abrirTrancheVinculoOperacoes,
  TRANCHE_VINCULO_SLUGS_REF,
  type TrancheVinculoRow,
  type TrancheVinculoListItem,
} from '@/lib/operacoes/tranche-vinculos-service';
