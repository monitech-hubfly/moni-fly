'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatDataHoraHistorico } from '@/components/kanban-shared/kanban-card-modal-helpers';
import { KanbanCardModalAtasReuniao } from '@/components/kanban-shared/KanbanCardModalAtasReuniao';
import { KanbanCardModalCondominio } from '@/components/kanban-shared/KanbanCardModalCondominio';
import { KanbanCardModalCreditoSessao } from '@/components/kanban-shared/KanbanCardModalCreditoSessao';
import { KanbanCardModalDadosPreObraOperacoes } from '@/components/kanban-shared/KanbanCardModalDadosPreObraOperacoes';
import { KanbanCardModalEmpresas } from '@/components/kanban-shared/KanbanCardModalEmpresas';
import { KanbanCardModalNegociacaoLinhasField } from '@/components/kanban-shared/KanbanCardModalNegociacaoLinhasField';
import { KanbanCardModalRelacionamentos } from '@/components/kanban-shared/KanbanCardModalRelacionamentos';
import { KanbanCardModalSimulacoesImob } from '@/components/kanban-shared/KanbanCardModalSimulacoesImob';
import { FaseChecklistSidebarResumo } from '@/components/kanban-shared/FaseChecklistSidebarResumo';
import { RespostasFormularioLista } from '@/components/formularios/RespostasFormularioLista';
import type { KanbanFase } from '@/components/kanban-shared/types';
import { listarRespostasDoCard } from '@/lib/actions/formulario-actions';
import { formatIsoDateOnlyPtBr } from '@/lib/dias-uteis';
import {
  faseLabelFromOpcoes,
  formatNegocioPrazoDisplay,
  negocioPrazoValoresFromProcessoModal,
  type FaseNegocioPrazoOpcao,
} from '@/lib/kanban/dados-negocio-prazo';
import { creditoLateralVazio, type CreditoLateral } from '@/lib/kanban/credito-lateral';
import type { LinhaCronologiaFase } from '@/lib/kanban/kanban-card-timeline';
import {
  displayOrDash,
  fmtMoedaKanban,
  type KanbanCardModalDetalhes,
  type RedeFranqueadoModalRow,
} from '@/lib/kanban/kanban-card-modal-detalhes';
import type { PipelineCardDisplay } from '@/lib/kanban/pipeline-cards-types';
import {
  operacoesPreObraDraftFromCard,
  type OperacoesPreObraDraft,
} from '@/lib/kanban/previsibilidade-operacoes';
import {
  isTipoDividaTerreno,
  isTipoPermutaParcial,
  isTipoPermutaVGV,
} from '@/lib/kanban/tipo-negociacao-terreno';
import type { FormularioRespostaListaItem } from '@/types/formularios';

type SecaoId =
  | 'cronologia'
  | 'franqueado'
  | 'condominio'
  | 'negocio'
  | 'modeloImob'
  | 'empresas'
  | 'preObra'
  | 'credito'
  | 'atas'
  | 'vinculos'
  | 'formularios'
  | 'checklist';

const SECOES_ABERTAS: Record<SecaoId, boolean> = {
  cronologia: true,
  franqueado: true,
  condominio: true,
  negocio: true,
  modeloImob: true,
  empresas: true,
  preObra: true,
  credito: true,
  atas: true,
  vinculos: true,
  formularios: true,
  checklist: true,
};

type Props = {
  card: PipelineCardDisplay;
  detalhes: KanbanCardModalDetalhes | null;
  loading: boolean;
  preObra: OperacoesPreObraDraft | null;
  credito: CreditoLateral | null;
  fases: KanbanFase[];
  fasesPrazo: FaseNegocioPrazoOpcao[];
  linhasCronologia: LinhaCronologiaFase[];
};

function fmtDataBr(iso: string | null | undefined): string {
  const s = String(iso ?? '').trim();
  if (!s) return '—';
  return formatIsoDateOnlyPtBr(s) ?? s;
}

function fmtDataHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  return formatDataHoraHistorico(iso) || fmtDataBr(iso);
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

function linkHref(raw: string | null | undefined): string | null {
  const t = String(raw ?? '').trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function CampoReadonly({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-xs" style={{ color: 'var(--moni-text-primary)' }}>
        {valor}
      </dd>
    </div>
  );
}

function CampoLink({ label, raw }: { label: string; raw: string | null | undefined }) {
  const href = linkHref(raw);
  return (
    <div className="min-w-0">
      <dt className="text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
        {label}
      </dt>
      <dd className="mt-0.5 text-xs">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all underline"
            style={{ color: 'var(--moni-navy-800)' }}
          >
            {String(raw ?? '').trim()}
          </a>
        ) : (
          <span style={{ color: 'var(--moni-text-primary)' }}>—</span>
        )}
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
        className="flex min-h-[44px] w-full items-center gap-2 p-2 text-left text-xs transition hover:bg-[var(--moni-surface-50)] sm:min-h-0"
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

function TextoCarregando({ texto }: { texto: string }) {
  return (
    <p className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
      {texto}
    </p>
  );
}

function SecaoFranqueado({ rede, loading }: { rede: RedeFranqueadoModalRow | null; loading: boolean }) {
  async function abrirContrato(download: boolean) {
    const path = rede?.contrato_franquia_path?.trim();
    if (!path) return;
    const supabase = createClient();
    const { data, error } = await supabase.storage.from('contratos-franquia').createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) return;
    if (!download) {
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    const a = document.createElement('a');
    a.href = data.signedUrl;
    a.download = path.split('/').filter(Boolean).pop() ?? 'contrato-franquia';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  if (loading) return <TextoCarregando texto="Carregando dados do franqueado…" />;
  if (!rede) return <TextoCarregando texto="Sem dados de franqueado vinculados ao card." />;

  return (
    <div className="space-y-2">
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
        <CampoReadonly label="CPF" valor={displayOrDash(rede.cpf_frank)} />
        <CampoReadonly label="Nascimento" valor={fmtDataBr(rede.data_nasc_frank)} />
        <CampoReadonly label="Responsável comercial" valor={displayOrDash(rede.responsavel_comercial)} />
        <CampoReadonly label="Camiseta" valor={displayOrDash(rede.tamanho_camisa_frank)} />
        <CampoReadonly label="Ass. COF" valor={fmtDataBr(rede.data_ass_cof)} />
        <CampoReadonly label="Ass. Contrato" valor={fmtDataBr(rede.data_ass_contrato)} />
        <CampoReadonly label="Expiração" valor={fmtDataBr(rede.data_expiracao_franquia)} />
      </dl>
      <CampoReadonly label="Endereço (casa)" valor={displayOrDash(enderecoCasaLinha(rede))} />
      <CampoReadonly label="Sócios" valor={displayOrDash(rede.socios)} />
      <div className="border-t pt-2" style={{ borderColor: 'var(--moni-border-subtle, var(--moni-border-default))' }}>
        <p className="text-[11px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
          Anexo: Contrato de Franquia
        </p>
        {rede.contrato_franquia_path?.trim() ? (
          <div className="mt-1.5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void abrirContrato(false)}
              className="min-h-[44px] rounded-[var(--moni-radius-md)] px-3 text-[11px] font-medium sm:min-h-0"
              style={{ border: '0.5px solid var(--moni-border-default)', color: 'var(--moni-text-primary)' }}
            >
              Visualizar
            </button>
            <button
              type="button"
              onClick={() => void abrirContrato(true)}
              className="min-h-[44px] rounded-[var(--moni-radius-md)] px-3 text-[11px] font-medium sm:min-h-0"
              style={{ border: '0.5px solid var(--moni-border-default)', color: 'var(--moni-text-primary)' }}
            >
              Baixar
            </button>
          </div>
        ) : (
          <p className="mt-1 text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
            Nenhum contrato anexado no cadastro do franqueado.
          </p>
        )}
      </div>
    </div>
  );
}

function SecaoNegocio({
  proc,
  loading,
  fasesPrazo,
}: {
  proc: KanbanCardModalDetalhes['processo'];
  loading: boolean;
  fasesPrazo: FaseNegocioPrazoOpcao[];
}) {
  if (loading) return <TextoCarregando texto="Carregando dados de negócio…" />;
  if (!proc) return <TextoCarregando texto="Sem processo vinculado — dados de negócio indisponíveis." />;

  const prazos = negocioPrazoValoresFromProcessoModal(proc, fasesPrazo);
  const tipo = proc.tipo_aquisicao_terreno;

  return (
    <div className="space-y-2">
      <CampoReadonly label="Tipo de negócio" valor={displayOrDash(tipo)} />
      <CampoLink label="Pasta do Drive" raw={proc.link_pasta_drive} />
      <CampoReadonly label="Valor do Terreno" valor={fmtMoedaKanban(proc.valor_terreno)} />
      {isTipoPermutaParcial(tipo) ? (
        <CampoReadonly
          label="% Compra Parcial Terreno"
          valor={proc.pct_compra_parcial_terreno != null ? `${proc.pct_compra_parcial_terreno}%` : '—'}
        />
      ) : null}
      {isTipoPermutaVGV(tipo) ? (
        <CampoReadonly
          label="% VGV Terrenista"
          valor={proc.pct_vgv_terrenista != null ? `${proc.pct_vgv_terrenista}%` : '—'}
        />
      ) : null}
      {isTipoDividaTerreno(tipo) ? (
        <CampoReadonly label="Dívida Terreno" valor={fmtMoedaKanban(proc.divida_terreno)} />
      ) : null}
      <CampoReadonly label="M² Terreno" valor={proc.m2_terreno != null ? `${proc.m2_terreno} m²` : '—'} />
      <CampoLink label="Contratos" raw={proc.link_opcao_permuta} />
      <fieldset className="rounded-lg p-2" style={{ border: '0.5px solid var(--moni-border-subtle, var(--moni-border-default))' }}>
        <legend className="px-1 text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
          Prazo Opção
        </legend>
        <p className="text-xs" style={{ color: 'var(--moni-text-primary)' }}>
          {formatNegocioPrazoDisplay(prazos.prazo_opcao, faseLabelFromOpcoes(prazos.prazo_opcao.faseId, fasesPrazo))}
        </p>
        <div className="mt-2">
          <CampoReadonly label="Obs. Opção" valor={displayOrDash(proc.obs_opcao)} />
        </div>
      </fieldset>
      <CampoReadonly label="Data Ass. Opção Terreno" valor={fmtDataBr(proc.data_ass_opcao_terreno)} />
      <CampoReadonly label="Produto / Modelo" valor={displayOrDash(proc.produto_modelo_casa)} />
      <CampoLink label="Extrato Modelo Configurado" raw={proc.extrato_modelo_configurado} />
      <CampoReadonly label="M² Casa" valor={proc.m2_casa != null ? `${proc.m2_casa} m²` : '—'} />
      <CampoReadonly label="Custo da Obra" valor={fmtMoedaKanban(proc.custo_obra)} />
      <CampoLink label="BCA" raw={proc.link_bca} />
      <CampoLink label="Mapa de Competidores" raw={proc.link_mapa_competidores} />
      <CampoReadonly label="VGV pretendido" valor={fmtMoedaKanban(proc.vgv_pretendido)} />
      <CampoReadonly label="Valor Recompra" valor={fmtMoedaKanban(proc.valor_recompra)} />
      <CampoLink label="Acoplamento" raw={proc.link_acoplamento} />
      <CampoLink label="GBOX" raw={proc.link_gbox} />
      <CampoLink label="GBOX Ozempic" raw={proc.link_gbox_ozempic} />
      <CampoLink label="Apresentação Comitê" raw={proc.link_apresentacao_comite} />
      <CampoReadonly label="Data Aprovação Comitê" valor={fmtDataBr(proc.data_aprovacao_comite)} />
      <fieldset className="rounded-lg p-2" style={{ border: '0.5px solid var(--moni-border-subtle, var(--moni-border-default))' }}>
        <legend className="px-1 text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
          Prazo Instrumento Garantidor
        </legend>
        <p className="text-xs" style={{ color: 'var(--moni-text-primary)' }}>
          {formatNegocioPrazoDisplay(
            prazos.prazo_instrumento_garantidor,
            faseLabelFromOpcoes(prazos.prazo_instrumento_garantidor.faseId, fasesPrazo),
          )}
        </p>
        <div className="mt-2">
          <CampoReadonly label="Obs. Instrumento Garantidor" valor={displayOrDash(proc.obs_instrumento_garantidor)} />
        </div>
      </fieldset>
      <CampoReadonly label="Data Ass. Contrato Terreno" valor={fmtDataBr(proc.data_ass_contrato_terreno)} />
      <KanbanCardModalNegociacaoLinhasField
        modoLeitura
        linhas={[]}
        onChange={() => {}}
        linhasLeitura={proc.negociacao_linhas ?? []}
      />
    </div>
  );
}

function SecaoFormularios({ cardId }: { cardId: string }) {
  const [respostas, setRespostas] = useState<FormularioRespostaListaItem[] | null>(null);

  useEffect(() => {
    let ativo = true;
    void listarRespostasDoCard(cardId).then((res) => {
      if (ativo) setRespostas(res);
    });
    return () => {
      ativo = false;
    };
  }, [cardId]);

  if (!respostas) return <TextoCarregando texto="Carregando formulários…" />;
  return <RespostasFormularioLista respostas={respostas} compacto vazio="Nenhum formulário neste card." />;
}

export function PipelineCardDrawerDadosSecoes({
  card,
  detalhes,
  loading,
  preObra,
  credito,
  fases,
  fasesPrazo,
  linhasCronologia,
}: Props) {
  const [abertas, setAbertas] = useState<Record<SecaoId, boolean>>(SECOES_ABERTAS);

  const toggle = (id: SecaoId) => {
    setAbertas((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const proc = detalhes?.processo ?? null;
  const empresas = detalhes?.empresas ?? null;
  const preObraDraft = preObra ?? operacoesPreObraDraftFromCard(null);
  const creditoDraft = credito ?? creditoLateralVazio();

  return (
    <div className="mb-6">
      <h3
        className="mb-3 text-xs font-semibold uppercase tracking-wide"
        style={{ color: 'var(--moni-text-tertiary)' }}
      >
        Lateral do card
      </h3>

      <DrawerCollapsible id="cronologia" label="ID e datas do funil" aberto={abertas.cronologia} onToggle={toggle}>
        <div className="space-y-2">
          <CampoReadonly label="ID do card" valor={card.id} />
          <CampoReadonly label="Data de entrada no funil" valor={fmtDataHora(card.created_at)} />
          <div className="border-t pt-2" style={{ borderColor: 'var(--moni-border-subtle, var(--moni-border-default))' }}>
            <p className="mb-1 text-[11px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
              Por fase
            </p>
            {linhasCronologia.length === 0 ? (
              <TextoCarregando texto={loading ? 'Carregando datas…' : 'Nenhuma fase registrada.'} />
            ) : (
              <div className="max-h-56 space-y-1.5 overflow-y-auto">
                {linhasCronologia.map((row) => (
                  <div
                    key={row.faseId}
                    className="rounded-[var(--moni-radius-md)] px-2 py-1.5"
                    style={{ border: '0.5px solid var(--moni-border-default)', background: 'var(--moni-surface-50)' }}
                  >
                    <div className="text-[11px] font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                      {row.faseNome}
                    </div>
                    <div className="mt-0.5 grid grid-cols-2 gap-1 text-[10px]">
                      <span>Entrada: {row.entrouEm ? fmtDataHora(row.entrouEm) : '—'}</span>
                      <span>Saída: {row.saiuEm ? fmtDataHora(row.saiuEm) : '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DrawerCollapsible>

      <DrawerCollapsible id="franqueado" label="Dados do Franqueado" aberto={abertas.franqueado} onToggle={toggle}>
        <SecaoFranqueado rede={detalhes?.rede ?? null} loading={loading} />
      </DrawerCollapsible>

      <DrawerCollapsible id="condominio" label="Dados do Condomínio" aberto={abertas.condominio} onToggle={toggle}>
        <KanbanCardModalCondominio
          cardId={card.id}
          origem={card.origem}
          basePath="/rede-franqueados"
          condominioIdInicial={proc?.condominio_id ?? null}
          quadraInicial={card.quadra ?? proc?.quadra ?? null}
          loteInicial={card.lote ?? proc?.lote ?? null}
          nomeCondominioLegado={card.nome_condominio ?? proc?.nome_condominio ?? null}
          podeEditar={false}
          podeCadastrarNovo={false}
          somenteLeitura
          onSalvo={() => {}}
        />
      </DrawerCollapsible>

      <DrawerCollapsible id="negocio" label="Dados do Negócio" aberto={abertas.negocio} onToggle={toggle}>
        <SecaoNegocio proc={proc} loading={loading} fasesPrazo={fasesPrazo} />
      </DrawerCollapsible>

      <DrawerCollapsible
        id="modeloImob"
        label="Modelo e Simulações IMOB"
        aberto={abertas.modeloImob}
        onToggle={toggle}
      >
        <KanbanCardModalSimulacoesImob
          cardId={card.id}
          podeEditar={false}
          legadoProdutoModeloCasa={proc?.produto_modelo_casa ?? ''}
        />
      </DrawerCollapsible>

      <DrawerCollapsible id="empresas" label="Dados das Empresas" aberto={abertas.empresas} onToggle={toggle}>
        {loading ? (
          <TextoCarregando texto="Carregando empresas…" />
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

      <DrawerCollapsible id="preObra" label="Dados Pré Obra" aberto={abertas.preObra} onToggle={toggle}>
        {loading ? (
          <TextoCarregando texto="Carregando dados pré-obra…" />
        ) : (
          <KanbanCardModalDadosPreObraOperacoes
            draft={preObraDraft}
            onChange={() => {}}
            onSalvar={() => {}}
            salvando={false}
            podeEditar={false}
          />
        )}
      </DrawerCollapsible>

      <DrawerCollapsible id="credito" label="Crédito" aberto={abertas.credito} onToggle={toggle}>
        {loading ? (
          <TextoCarregando texto="Carregando crédito…" />
        ) : (
          <KanbanCardModalCreditoSessao
            draft={creditoDraft}
            onChange={() => {}}
            valorTerreno={proc?.valor_terreno ?? ''}
            valorObra={proc?.custo_obra ?? ''}
            tipoNegocio={proc?.tipo_aquisicao_terreno ?? ''}
            bookEmpreendimento={proc?.book_empreendimento ?? ''}
            checkAnaliseCredito={proc?.check_analise_credito ?? ''}
            onBookChange={() => {}}
            onCheckChange={() => {}}
            onSalvar={() => {}}
            salvando={false}
            podeEditar={false}
            blocosIniciaisAbertos
          />
        )}
      </DrawerCollapsible>

      <DrawerCollapsible id="atas" label="Atas de reunião" aberto={abertas.atas} onToggle={toggle}>
        <KanbanCardModalAtasReuniao cardId={card.id} origem={card.origem} />
      </DrawerCollapsible>

      <DrawerCollapsible id="vinculos" label="Vínculos" aberto={abertas.vinculos} onToggle={toggle}>
        <KanbanCardModalRelacionamentos
          cardId={card.id}
          cardTitulo={card.titulo}
          kanbanId={card.kanban_id}
          kanbanNome={card.kanban_nome}
          basePath="/rede-franqueados"
          podeGerenciar={false}
          projetoId={card.projeto_id}
          cardDesabilitado
        />
      </DrawerCollapsible>

      <DrawerCollapsible id="formularios" label="Formulários" aberto={abertas.formularios} onToggle={toggle}>
        <SecaoFormularios cardId={card.id} />
      </DrawerCollapsible>

      <DrawerCollapsible id="checklist" label="Checklist das fases" aberto={abertas.checklist} onToggle={toggle}>
        <FaseChecklistSidebarResumo
          cardId={card.id}
          fases={fases}
          linhasCronologia={linhasCronologia}
          faseAtualId={card.fase_id}
          areaAtuacao={detalhes?.rede?.area_atuacao}
        />
      </DrawerCollapsible>
    </div>
  );
}
