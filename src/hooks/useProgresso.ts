'use client';

import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';
import {
  calcularProgressoGeral,
  getCasasComProgresso,
  getCertificados,
  nivelMaximoCertificado,
} from '@/lib/universidade/queries';
import type { CasaComProgresso, UniCertificado } from '@/lib/universidade/types';

export function useProgresso(userId: string | undefined) {
  const key = userId ? ['uni-progresso', userId] : null;

  const { data, error, isLoading, mutate } = useSWR(
    key,
    async ([, uid]) => {
      const supabase = createClient();
      const [casas, certificados] = await Promise.all([
        getCasasComProgresso(supabase, uid as string),
        getCertificados(supabase, uid as string),
      ]);
      return { casas, certificados };
    },
    { revalidateOnFocus: true },
  );

  const casas: CasaComProgresso[] = data?.casas ?? [];
  const certificados: UniCertificado[] = data?.certificados ?? [];
  const progressoGeral = calcularProgressoGeral(casas);
  const nivelAtual = nivelMaximoCertificado(certificados);

  return {
    casas,
    certificados,
    progressoGeral,
    nivelAtual,
    isLoading: Boolean(userId) && isLoading,
    error,
    mutate,
  };
}
