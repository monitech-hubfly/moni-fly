'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { formatIsoDateOnlyPtBr } from '@/lib/dias-uteis';
import type { PipelineCardDisplay } from '@/lib/kanban/pipeline-cards-types';
import type { KanbanCardModalDetalhes, RedeFranqueadoModalRow } from '@/lib/kanban/kanban-card-modal-detalhes';
import { displayOrDash, fmtMoedaKanban } from '@/lib/kanban/kanban-card-modal-detalhes';
import { KanbanCardModalCondominio } from '@/components/kanban-shared/KanbanCardModalCondominio';
import { KanbanCardModalEmpresas } from '@/components/kanban-shared/KanbanCardModalEmpresas';

type SecaoId = 'franqueado' | 'condominio' | 'negocio' | 'empresas';

type Props = {
  card: PipelineCardDisplay;
  detalhes: KanbanCardModalDetalhes | null;
  loading: boolean;
};

function fmtDataBr(iso: string | null | undefined): string {
  const s = String(iso ?? '').trim();
  if (!s) return '—';
  return formatIsoDateOnlyPtBr(s) ?? s;
}

function enderecoCasaLinha(rede: RedeFranqueadoModalRow | null): string {
  if (!rede) return '';
  return [
    rede.endereco_casa_frank,
    rede.endereco_casa_frank_numero,
    rede.endereco_casa_frank_complemento,
    rede.cep_casa_frank,
    rede.cidade_casa_frank,
    rede.estado_casa_frank,
  ]
    .map((x) => (x ?? '').trim())
    .filter(Boolean)
    .join(', ');
}

function CampoReadonly({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <dt className="text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
        {label}
      </dt>
      <dd className="mt-0.5 text-xs" style={{ color: 'var(--moni-text-primary)' }}>
        {valor}
      </dd>
    </div>
  );
}

function DrawerCollapsible({
  id,
  label,
  aberto,
  onToggle,
  children,
}: {
  id: SecaoId;
  label: string;
  aberto: boolean;
  onToggle: (id: SecaoId) => void;
  children: ReactNode;
}) {
  return (
    <div
      className="mb-2 overflow-hidden rounded-lg bg-white text-xs"
      style={{
        border: '0.5px solid var(--moni-border-default)',
        boxShadow: 'var(--moni-shadow-sm)',
      }}
    >
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="flex min-h-[44px] w-full items-center gap-2 p-2 text-left text-xs transition hover:bg-stone-50 sm:min-h-0"
      >
        {aberto ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--moni-text-tertiary)' }} aria-hidden />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--moni-text-tertiary)' }} aria-hidden />
        )}
        <span className="text-xs font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
          {label}
        </span>
      </button>
      {aberto ? (
        <div
          className="border-t px-2 pb-2 pt-1.5 text-xs"
          style={{ borderColor: 'var(--moni-border-subtle, var(--moni-border-default))', color: 'var(--moni-text-secondary)' }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

function SecaoFranqueado({ rede, loading }: { rede: RedeFranqueadoModalRow | null; loading: boolean }) {
  if (loading) {
    return (
      <p className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
        Carregando dados do franqueado…
      </p>
    );
  }
  if (!rede) {
    return (
      <p className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
        Sem dados de franqueado vinculados ao card.
      </p>
    );
  }

  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
      <CampoReadonly label="Nº Franquia" valor={displayOrDash(rede.n_franquia)} />
      <CampoReadonly label="Modalidade" valor={displayOrDash(rede.modalidade)} />
      <CampoReadonly label="Nome" valor={displayOrDash(rede.nome_completo)} />
      <CampoReadonly label="Status" valor={displayOrDash(rede.status_franquia)} />
      <CampoReadonly label="Classificação" valor={displayOrDash(rede.classificacao_franqueado)} />
      <CampoReadonly label="Regional" valor={displayOrDash(rede.regional)} />
      <CampoReadonly label="Área de atuação" valor={displayOrDash(rede.area_atuacao)} />
      <CampoReadonly label="E-mail" valor={displayOrDash(rede.email_frank)} />
      <CampoReadonly label="Telefone" valor={displayOrDash(rede.telefone_frank)} />
      <CampoReadonly label="Responsável comercial" valor={displayOrDash(rede.responsavel_comercial)} />
      <CampoReadonly label="Ass. COF" valor={fmtDataBr(rede.data_ass_cof)} />
      <CampoReadonly label="Ass. Contrato" valor={fmtDataBr(rede.data_ass_contrato)} />
      <div className="col-span-2">
        <CampoReadonly label="Endereço (casa)" valor={displayOrDash(enderecoCasaLinha(rede))} />
      </div>
      <div className="col-span-2">
        <CampoReadonly label="Sócios" valor={displayOrDash(rede.socios)} />
      </div>
    </dl>
  );
}

function SecaoNegocio({
  proc,
  loading,
}: {
  proc: KanbanCardModalDetalhes['processo'];
  loading: boolean;
}) {
  if (loading) {
    return (
      <p className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
        Carregando dados de negócio…
      </p>
    );
  }
  if (!proc) {
    return (
      <p className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
        Sem processo vinculado — dados de negócio indisponíveis.
      </p>
    );
  }

  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
      <CampoReadonly label="Tipo de negociação" valor={displayOrDash(proc.tipo_aquisicao_terreno)} />
      <CampoReadonly label="Valor do terreno" valor={fmtMoedaKanban(proc.valor_terreno)} />
      <CampoReadonly label="VGV pretendido" valor={fmtMoedaKanban(proc.vgv_pretendido)} />
      <CampoReadonly label="Produto / modelo" valor={displayOrDash(proc.produto_modelo_casa)} />
      <CampoReadonly label="Condomínio (texto)" valor={displayOrDash(proc.nome_condominio)} />
      <CampoReadonly label="Quadra / lote" valor={displayOrDash(proc.quadra_lote ?? [proc.quadra, proc.lote].filter(Boolean).join(' / '))} />
      <CampoReadonly label="Previsão aprov. condomínio" valor={fmtDataBr(proc.previsao_aprovacao_condominio)} />
      <CampoReadonly label="Previsão aprov. prefeitura" valor={fmtDataBr(proc.previsao_aprovacao_prefeitura)} />
      <CampoReadonly label="Previsão emissão alvará" valor={fmtDataBr(proc.previsao_emissao_alvara)} />
      <CampoReadonly label="Previsão início obra" valor={fmtDataBr(proc.previsao_inicio_obra)} />
    </dl>
  );
}

export function PipelineCardDrawerDadosSecoes({ card, detalhes, loading }: Props) {
  const [abertas, setAbertas] = useState<Partial<Record<SecaoId, boolean>>>({
    franqueado: true,
  });

  const toggle = (id: SecaoId) => {
    setAbertas((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const proc = detalhes?.processo ?? null;
  const empresas = detalhes?.empresas ?? null;
  const condominioId = proc?.condominio_id ?? null;

  return (
    <div className="mb-6">
      <h3
        className="mb-3 text-xs font-semibold uppercase tracking-wide"
        style={{ color: 'var(--moni-text-tertiary)' }}
      >
        Cadastro do projeto
      </h3>

      <DrawerCollapsible
        id="franqueado"
        label="Dados do Franqueado"
        aberto={Boolean(abertas.franqueado)}
        onToggle={toggle}
      >
        <SecaoFranqueado rede={detalhes?.rede ?? null} loading={loading} />
      </DrawerCollapsible>

      <DrawerCollapsible
        id="condominio"
        label="Dados do Condomínio"
        aberto={Boolean(abertas.condominio)}
        onToggle={toggle}
      >
        <KanbanCardModalCondominio
          cardId={card.id}
          origem={card.origem}
          basePath="/rede-franqueados"
          condominioIdInicial={condominioId}
          quadraInicial={card.quadra ?? proc?.quadra ?? null}
          loteInicial={card.lote ?? proc?.lote ?? null}
          nomeCondominioLegado={card.nome_condominio ?? proc?.nome_condominio ?? null}
          podeEditar={false}
          podeCadastrarNovo={false}
          somenteLeitura
          onSalvo={() => {}}
        />
      </DrawerCollapsible>

      <DrawerCollapsible
        id="negocio"
        label="Dados do Negócio"
        aberto={Boolean(abertas.negocio)}
        onToggle={toggle}
      >
        <SecaoNegocio proc={proc} loading={loading} />
      </DrawerCollapsible>

      <DrawerCollapsible
        id="empresas"
        label="Dados das Empresas"
        aberto={Boolean(abertas.empresas)}
        onToggle={toggle}
      >
        {loading ? (
          <p className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
            Carregando empresas…
          </p>
        ) : (
          <KanbanCardModalEmpresas
            cardId={card.id}
            redeFranqueadoId={card.rede_franqueado_id}
            incorporadora={empresas?.incorporadora ?? null}
            gestora={empresas?.gestora ?? null}
            spe={empresas?.spe ?? null}
            podeEditar={false}
          />
        )}
      </DrawerCollapsible>
    </div>
  );
}
