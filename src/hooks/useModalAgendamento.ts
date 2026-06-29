'use client';

import { useCallback, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isoWeek } from '@/utils/periodos';
import { registrarLog } from '@/hooks/useAuditLog';
import type { DadosAgendamento } from '@/components/carometro/todo/ModalAgendamento';

type Modo = 'criar' | 'editar';

export type UseModalAgendamentoResult = {
  aberto: boolean;
  preenchido: Partial<DadosAgendamento>;
  modo: Modo;
  isSaving: boolean;
  abrirParaCriar: (preenchido?: Partial<DadosAgendamento>) => void;
  abrirParaEditar: (id: string) => void;
  fechar: () => void;
  salvar: (dados: DadosAgendamento) => Promise<void>;
};

export function useModalAgendamento(
  effectiveProfileId: string | null,
  areaId: string | null,
  onSalvo?: () => void,
): UseModalAgendamentoResult {
  const supabase = useMemo(() => createClient(), []);
  const [aberto,      setAberto]      = useState(false);
  const [preenchido,  setPreenchido]  = useState<Partial<DadosAgendamento>>({});
  const [modo,        setModo]        = useState<Modo>('criar');
  const [editandoId,  setEditandoId]  = useState<string | null>(null);
  const [isSaving,    setIsSaving]    = useState(false);

  const abrirParaCriar = useCallback((dados?: Partial<DadosAgendamento>) => {
    setPreenchido(dados ?? {});
    setModo('criar');
    setEditandoId(null);
    setAberto(true);
  }, []);

  const abrirParaEditar = useCallback(async (id: string) => {
    const { data } = await supabase
      .from('gantt_planejamento')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (data) {
      const r = data as Record<string, unknown>;
      setPreenchido({
        acao_id:              (r.acao_id as string | null)              ?? null,
        objetivo_id:          (r.objetivo_id as string | null)          ?? null,
        data:                 (r.data as string | null)                 ?? null,
        hora_inicio:          (r.hora_inicio as string | null)          ?? null,
        hora_fim:             (r.hora_fim as string | null)             ?? null,
        casa_id:              (r.casa_id as string | null)              ?? null,
        franqueado_id:        (r.franqueado_id as string | null)        ?? null,
        rede_loteador_id:     (r.rede_loteador_id as string | null)     ?? null,
        condominio_id:        (r.condominio_id as string | null)        ?? null,
        adm_cnpj_id:          (r.adm_cnpj_id as string | null)         ?? null,
        sirene_chamado_id:    (r.sirene_chamado_id as number | null)    ?? null,
        card_id:              (r.card_id as string | null)              ?? null,
        recorrente:           Boolean(r.recorrente),
        recorrencia_config:   (r.recorrencia_config as object | null)   ?? null,
        observacoes:          (r.comentario_conclusao as string | null) ?? null,
        tempo_estimado_horas: (r.tempo_estimado_horas as number | null) ?? null,
      });
    }
    setModo('editar');
    setEditandoId(id);
    setAberto(true);
  }, [supabase]);

  const fechar = useCallback(() => {
    setAberto(false);
    setPreenchido({});
    setEditandoId(null);
  }, []);

  const salvar = useCallback(async (dados: DadosAgendamento) => {
    if (!effectiveProfileId) return;
    setIsSaving(true);
    try {
      const semana = dados.data ? isoWeek(new Date(dados.data)) : null;
      const payload: Record<string, unknown> = {
        acao_id:              dados.acao_id,
        objetivo_id:          dados.objetivo_id,
        data:                 dados.data,
        hora_inicio:          dados.hora_inicio,
        hora_fim:             dados.hora_fim,
        casa_id:              dados.casa_id,
        franqueado_id:        dados.franqueado_id,
        rede_loteador_id:     dados.rede_loteador_id,
        condominio_id:        dados.condominio_id,
        adm_cnpj_id:          dados.adm_cnpj_id,
        sirene_chamado_id:    dados.sirene_chamado_id,
        card_id:              dados.card_id,
        recorrente:           dados.recorrente,
        recorrencia_config:   dados.recorrencia_config,
        comentario_conclusao: dados.observacoes,
        tempo_estimado_horas: dados.tempo_estimado_horas,
      };

      let entidadeId: string | null = null;

      if (modo === 'criar') {
        const { data: inserted, error } = await supabase
          .from('gantt_planejamento')
          .insert({
            ...payload,
            profile_id:        effectiveProfileId,
            origem:            'agenda',
            semana_ano_inicio: semana,
            semana_ano_fim:    semana,
          })
          .select('id')
          .single();
        if (error) throw error;
        entidadeId = String((inserted as { id: unknown }).id);

        void (registrarLog as unknown as (a: Record<string, unknown>) => Promise<void>)({
          modulo: 'Planejamento', area: areaId,
          entidade: 'gantt_planejamento', entidade_id: entidadeId,
          operacao: 'INSERT',
          descricao: `Nova atividade agendada para ${dados.data ?? ''}`,
        });
      } else if (editandoId) {
        const { error } = await supabase
          .from('gantt_planejamento')
          .update(payload)
          .eq('id', editandoId);
        if (error) throw error;
        entidadeId = editandoId;

        void (registrarLog as unknown as (a: Record<string, unknown>) => Promise<void>)({
          modulo: 'Planejamento', area: areaId,
          entidade: 'gantt_planejamento', entidade_id: entidadeId,
          operacao: 'UPDATE',
          descricao: `Atividade atualizada: ${dados.data ?? ''}`,
        });
      }

      fechar();
      onSalvo?.();
    } finally {
      setIsSaving(false);
    }
  }, [supabase, effectiveProfileId, areaId, modo, editandoId, fechar, onSalvo]);

  return { aberto, preenchido, modo, isSaving, abrirParaCriar, abrirParaEditar, fechar, salvar };
}
