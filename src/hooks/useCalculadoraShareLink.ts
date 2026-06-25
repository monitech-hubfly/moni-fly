'use client';

import { useCallback, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function useCalculadoraShareLink(cardId: string) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const gerarECopiar = useCallback(async () => {
    const cid = String(cardId ?? '').trim();
    if (!cid) return;

    setLoading(true);
    setErro(null);

    try {
      const supabase = createClient();
      const { data: token, error } = await supabase.rpc('upsert_calculadora_share_token', {
        p_card_id: cid,
      });

      if (error || !token) {
        setErro(error?.message ?? 'Não foi possível gerar o link.');
        return;
      }

      const url = `${window.location.origin}/calculadora/${String(token).trim()}/leitura`;
      await navigator.clipboard.writeText(url).catch(() => {});
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } finally {
      setLoading(false);
    }
  }, [cardId]);

  return { loading, copied, erro, gerarECopiar };
}
