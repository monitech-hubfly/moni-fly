'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SetupChecklist } from '@/components/casa0/SetupChecklist';
import {
  AlertTriangle,
  Brain,
  Calculator,
  Clock,
  Cog,
  Compass,
  FileSpreadsheet,
  Gauge,
  Home,
  Kanban,
  Landmark,
  Lightbulb,
  ListChecks,
  MapPin,
  Scale,
  Store,
  Swords,
  TrendingUp,
  Users,
  Waves,
} from 'lucide-react';

/** Classes compartilhadas — consistência visual entre abas */
const UI = {
  tabStack: 'space-y-8',
  tabIntro: 'text-sm leading-relaxed text-slate-600',
  sectionLabel: 'text-xs font-semibold uppercase tracking-widest text-slate-500',
  sectionLead: 'mt-1.5 text-sm leading-relaxed text-slate-600',
  sectionBody: 'mt-4',
  card: 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6',
  cardMuted: 'rounded-xl border border-slate-200 bg-slate-50/60 p-5 shadow-sm sm:p-6',
  cardTitle: 'text-sm font-semibold text-slate-900',
  cardText: 'text-sm leading-relaxed text-slate-600',
  cardTextSm: 'text-xs leading-relaxed text-slate-600',
  listItem: 'flex gap-2 text-sm leading-snug text-slate-700',
  listBullet: 'mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500',
  listBulletMuted: 'mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-400',
  iconBox: 'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
  /** 3 colunas a partir de ~900px de largura do painel (ex.: 1280px − sidebar). */
  grid3: 'grid grid-cols-1 gap-4 sm:grid-cols-2 min-[900px]:grid-cols-3',
  grid3Tight: 'grid grid-cols-1 gap-3 sm:grid-cols-2 min-[900px]:grid-cols-3',
  grid2: 'grid grid-cols-1 gap-4 md:grid-cols-2',
  gridHubFly: 'grid grid-cols-1 gap-4 min-[640px]:grid-cols-3',
  tabNav:
    'grid grid-cols-2 gap-x-0.5 gap-y-0 border-b border-slate-200 min-[640px]:grid-cols-3 min-[900px]:grid-cols-6',
  tabBtn:
    'w-full rounded-t-lg px-2 py-2 text-center text-xs font-medium transition-colors duration-200 min-[900px]:px-2.5 min-[900px]:text-sm',
  tabBtnActive: 'border-b-2 border-emerald-600 bg-emerald-50 text-emerald-900',
  tabBtnIdle: 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
  btnSecondary:
    'w-full rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-100',
};

const TABS = [
  { id: 'ecossistema', label: 'Ecossistema' },
  { id: 'principios', label: 'Princípios' },
  { id: 'jornada', label: 'Jornada' },
  { id: 'areas', label: 'Áreas' },
  { id: 'organizacao', label: 'Organização' },
  { id: 'conceitos-chave', label: 'Conceitos-chave' },
];

function TabIntro({ children }) {
  return <p className={UI.tabIntro}>{children}</p>;
}

function SectionBlock({ title, lead, children, className = '', icon: TitleIcon }) {
  return (
    <section className={className}>
      <h3 className={UI.sectionLabel}>
        {TitleIcon ? (
          <span className="inline-flex items-center gap-2">
            <TitleIcon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            <span>{title}</span>
          </span>
        ) : (
          title
        )}
      </h3>
      {lead ? <p className={UI.sectionLead}>{lead}</p> : null}
      <div className={UI.sectionBody}>{children}</div>
    </section>
  );
}

function IconBadge({ Icon, iconClass }) {
  return (
    <div className={`${UI.iconBox} ${iconClass}`} aria-hidden>
      <Icon className="h-5 w-5" strokeWidth={2} />
    </div>
  );
}

const AREAS_MONI = [
  {
    id: 'franqueado',
    titulo: 'Franqueado',
    descricao:
      'Atua na ponta comercial: captação de lotes, relacionamento com terrenistas e execução da operação no território.',
    Icon: Store,
    iconClass: 'bg-emerald-100 text-emerald-700',
  },
  {
    id: 'comite',
    titulo: 'Comitê',
    descricao:
      'Avalia viabilidade, risco e alinhamento estratégico antes de aprovar ou recusar uma operação.',
    Icon: Users,
    iconClass: 'bg-violet-100 text-violet-700',
  },
  {
    id: 'juridico',
    titulo: 'Jurídico',
    descricao:
      'Garante conformidade contratual, documentação do lote e segurança jurídica em permutas e financiamentos.',
    Icon: Scale,
    iconClass: 'bg-slate-100 text-slate-700',
  },
  {
    id: 'credito',
    titulo: 'Crédito',
    descricao:
      'Estrutura financiamento, CET, garantias e aderência às políticas financeiras da Moní e dos parceiros.',
    Icon: Landmark,
    iconClass: 'bg-sky-100 text-sky-700',
  },
  {
    id: 'arquitetura',
    titulo: 'Arquitetura',
    descricao:
      'Define produto, tipologia e padrão construtivo compatíveis com o lote, o condomínio e a absorção de mercado.',
    Icon: Compass,
    iconClass: 'bg-orange-100 text-orange-800',
  },
  {
    id: 'operacoes',
    titulo: 'Operações',
    descricao:
      'Orquestra prazos, fornecedores, obra e entrega — conectando planejamento, caixa e execução no dia a dia.',
    Icon: Cog,
    iconClass: 'bg-amber-100 text-amber-800',
  },
];

const HUBFLY_CARDS = [
  {
    id: 'kanban',
    titulo: 'Kanban',
    descricao:
      'Quadros por etapa do processo (Step One, crédito, jurídico, etc.) para acompanhar cada negócio em tempo real.',
    Icon: Kanban,
    iconClass: 'bg-emerald-100 text-emerald-700',
  },
  {
    id: 'avanco',
    titulo: 'Avanço',
    descricao:
      'Visão de progresso por fase e gargalos — o que já passou, o que está parado e o que falta para fechar.',
    Icon: TrendingUp,
    iconClass: 'bg-sky-100 text-sky-700',
  },
  {
    id: 'slas',
    titulo: 'SLAs',
    descricao:
      'Prazos acordados por tipo de tarefa e alertas quando o tempo de resposta ou conclusão está em risco.',
    Icon: Clock,
    iconClass: 'bg-rose-100 text-rose-700',
  },
];

function HubCard({ titulo, descricao, Icon, iconClass }) {
  return (
    <article className={`${UI.cardMuted} flex flex-col transition-shadow hover:shadow-md`}>
      <IconBadge Icon={Icon} iconClass={iconClass} />
      <h4 className={`${UI.cardTitle} mt-3`}>{titulo}</h4>
      <p className={`${UI.cardTextSm} mt-1.5 flex-1`}>{descricao}</p>
    </article>
  );
}

function EcossistemaTab() {
  const [userId, setUserId] = useState('');

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!cancelled) setUserId(user?.id ?? '');
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? '');
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div className={UI.tabStack}>
      <TabIntro>
        A Moní integra áreas especializadas que atuam em conjunto em cada operação. O HubFly é a camada digital que
        concentra fluxo, avanço e prazos.
      </TabIntro>

      <SectionBlock
        title="Setup Operacional"
        icon={Cog}
        lead="Conclua os itens abaixo para liberar a primeira missão. O progresso é salvo automaticamente."
      >
        {userId ? (
          <SetupChecklist userId={userId} omitHeading />
        ) : (
          <p className={UI.tabIntro}>
            Faça login para acompanhar e salvar o setup operacional (checklist e missão).
          </p>
        )}
      </SectionBlock>

      <SectionBlock title="Áreas da Moní" className="border-t border-slate-200 pt-10">
        <div className={UI.grid3}>
          {AREAS_MONI.map((area) => (
            <HubCard key={area.id} {...area} />
          ))}
        </div>
      </SectionBlock>

      <SectionBlock
        title="HubFly"
        lead="Ferramentas do hub para operar negócios com visibilidade e disciplina de prazo."
      >
        <div className={UI.gridHubFly}>
          {HUBFLY_CARDS.map((card) => (
            <HubCard key={card.id} {...card} />
          ))}
        </div>
      </SectionBlock>
    </div>
  );
}

const MONI_NAO_TRABALHA = [
  'VGV emocional sem evidência de vendas reais no condomínio',
  'Custo irreal ou reduzido só para a conta fechar',
  'Prazo de venda otimista sem histórico de absorção',
  'Decisão baseada em achismo, rumor ou “o vizinho disse”',
  'Produto desalinhado ao lote só para aprovar o terreno',
  'Premissas sem mapa de competidores, batalha ou checklist de demanda',
  'Ir ao mercado ou ao comitê sem stressar cenário de liquidação',
];

const MONI_TRABALHA = [
  'Evidência de mercado cruzada (mapa, batalha, casas vendidas)',
  'BCA preenchido com disciplina em Planta, Target e Liquidação',
  'Liquidez e ticket compatíveis com o condomínio e a região',
  'Auditoria jurídica e documental antes de comprometer a operação',
  'Transparência de premissas e riscos na defesa ao comitê',
  'Produto escolhido pela vendabilidade, não pelo tamanho máximo',
  'Fluxo rastreável no HubFly — kanban, avanço e SLAs respeitados',
];

const MENTALIDADE_ETAPAS = ['validar', 'comparar', 'estruturar', 'analisar'];

function PrincipiosLista({ titulo, itens, variant }) {
  const isNao = variant === 'nao';
  return (
    <div
      className={[
        'rounded-xl border p-5 sm:p-6',
        isNao ? 'border-red-200/80 bg-red-50' : 'border-emerald-200/80 bg-emerald-50',
      ].join(' ')}
    >
      <h3 className={`${UI.cardTitle} ${isNao ? 'text-red-900' : 'text-emerald-900'}`}>{titulo}</h3>
      <ul className="mt-4 space-y-2.5">
        {itens.map((item) => (
          <li
            key={item}
            className={[UI.listItem, isNao ? 'text-red-950/90' : 'text-emerald-950/90'].join(' ')}
          >
            <span
              className={`mt-0.5 shrink-0 font-bold ${isNao ? 'text-red-600' : 'text-emerald-600'}`}
              aria-hidden
            >
              {isNao ? '×' : '✓'}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PrincipiosTab() {
  return (
    <div className={UI.tabStack}>
      <TabIntro>
        Estes princípios orientam cada decisão imobiliária na Moní — do franqueado ao comitê. Não são slogans: são critérios
        para seguir ou não com a operação antes de comprometer terreno, produto ou caixa.
      </TabIntro>

      <div className={UI.grid2}>
        <PrincipiosLista titulo="A Moní NÃO trabalha com" itens={MONI_NAO_TRABALHA} variant="nao" />
        <PrincipiosLista titulo="A Moní trabalha com" itens={MONI_TRABALHA} variant="sim" />
      </div>

      <div className="rounded-xl border border-violet-200/80 bg-violet-50 p-5 sm:p-6">
        <h3 className={`${UI.cardTitle} text-violet-900`}>Mentalidade operacional</h3>
        <p className={`${UI.cardText} mt-3 text-violet-950/90`}>
          Toda hipótese passa pela mesma sequência antes de virar operação:
        </p>
        <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm font-semibold text-violet-900 sm:text-base">
          {MENTALIDADE_ETAPAS.map((etapa, index) => (
            <span key={etapa} className="inline-flex items-center gap-2">
              {index > 0 ? (
                <span className="font-normal text-violet-400" aria-hidden>
                  →
                </span>
              ) : null}
              <span className="rounded-md bg-violet-100/80 px-2.5 py-1 capitalize">{etapa}</span>
            </span>
          ))}
        </p>
        <p className={`${UI.cardText} mt-4 text-violet-800/90`}>
          Validar premissas com dado de mercado; comparar cenários e concorrentes; estruturar produto, caixa e financiamento
          no BCA; analisar risco, margem e liquidez antes de apresentar ao comitê.
        </p>
      </div>
    </div>
  );
}

const JORNADA_ETAPAS = [
  { id: 'step-one', label: 'Step One' },
  { id: 'hipotese-liquidez', label: 'Hipótese de Liquidez' },
  { id: 'negociacao', label: 'Negociação' },
  { id: 'check-legal', label: 'Check Legal' },
  { id: 'credito', label: 'Crédito' },
  { id: 'contrato-final', label: 'Contrato Final' },
];

const JORNADA_DETALHES_FRANQUEADO = [
  {
    etapa: 1,
    titulo: 'Step One',
    resumo: 'Inteligência de mercado e hipótese inicial do negócio.',
    acoes: [
      'Atualizar mapa de competidores, batalha de casas e checklist de demanda no condomínio.',
      'Preencher a Planilha Step One com dados verificáveis — não anúncios sem venda confirmada.',
      'Abrir o card no Funil Step One e manter documentação e evidências anexadas no HubFly.',
    ],
  },
  {
    etapa: 2,
    titulo: 'Hipótese de Liquidez',
    resumo: 'Testar se o produto e o preço vendem no prazo e no ticket defendidos.',
    acoes: [
      'Montar premissa de VGV, velocidade de venda e produto alinhados ao lote e ao estoque local.',
      'Cruzar hipótese com BCA preliminar (Planta, Target e Liquidação) antes de comprometer terreno.',
      'Registrar riscos de liquidez e ajustar ticket, metragem ou prazo se o mercado não absorver.',
    ],
  },
  {
    etapa: 3,
    titulo: 'Negociação',
    resumo: 'Estruturar a proposta com o terrenista com base em números, não em expectativa.',
    acoes: [
      'Apresentar condição de permuta, sinal ou compra coerente com o BCA e a política Moní.',
      'Alinhar expectativas do terrenista aos cenários Target e Liquidação — sem prometer VGV emocional.',
      'Formalizar acordo de princípio e encaminhar o pacote para Check Legal e Crédito no fluxo do hub.',
    ],
  },
];

function JornadaTab() {
  const [etapaAtiva, setEtapaAtiva] = useState(0);

  return (
    <div className={UI.tabStack}>
      <TabIntro>
        Do primeiro contato com o lote até o contrato assinado, cada negócio percorre seis etapas sequenciais no HubFly.
        O franqueado lidera a captação e a construção da hipótese nas fases iniciais.
      </TabIntro>

      <div className="w-full overflow-x-auto pb-1">
        <ol className="flex w-full min-w-0 items-start gap-0" aria-label="Etapas da jornada Moní">
          {JORNADA_ETAPAS.map((etapa, index) => {
            const isAtiva = index === etapaAtiva;
            const isConcluida = index < etapaAtiva;
            const isUltima = index === JORNADA_ETAPAS.length - 1;

            return (
              <li key={etapa.id} className="flex min-w-0 flex-1 items-start">
                <button
                  type="button"
                  onClick={() => setEtapaAtiva(index)}
                  className="group flex w-full flex-col items-center rounded-lg px-0.5 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                  aria-current={isAtiva ? 'step' : undefined}
                >
                  <span
                    className={[
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors duration-200',
                      isAtiva
                        ? 'bg-emerald-600 text-white shadow-md ring-4 ring-emerald-100'
                        : isConcluida
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200',
                    ].join(' ')}
                  >
                    {index + 1}
                  </span>
                  <span
                    className={[
                      'mt-2 line-clamp-2 text-xs font-semibold leading-tight',
                      isAtiva ? 'text-emerald-900' : 'text-slate-600 group-hover:text-slate-900',
                    ].join(' ')}
                  >
                    {etapa.label}
                  </span>
                </button>
                {!isUltima ? (
                  <span
                    className={[
                      'mx-0.5 mt-4 h-0.5 min-w-[8px] max-w-[32px] flex-1 shrink transition-colors duration-200',
                      index < etapaAtiva ? 'bg-emerald-400' : 'bg-slate-200',
                    ].join(' ')}
                    aria-hidden
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>

      <SectionBlock title="O que o franqueado faz — primeiras etapas">
        <div className="space-y-4">
          {JORNADA_DETALHES_FRANQUEADO.map((detalhe) => (
            <article
              key={detalhe.etapa}
              className="rounded-xl border border-emerald-200/60 bg-emerald-50/40 p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-emerald-600 px-2 text-xs font-bold text-white">
                  {detalhe.etapa}
                </span>
                <h4 className={UI.cardTitle}>{detalhe.titulo}</h4>
              </div>
              <p className={`${UI.cardText} mt-2`}>{detalhe.resumo}</p>
              <ul className="mt-4 space-y-2">
                {detalhe.acoes.map((acao) => (
                  <li key={acao} className={UI.listItem}>
                    <span className={UI.listBullet} aria-hidden />
                    <span>{acao}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </SectionBlock>
    </div>
  );
}

const COMPETENCIAS_DESENVOLVER = [
  {
    id: 'mercado',
    titulo: 'Leitura de mercado',
    Icon: MapPin,
    iconClass: 'bg-sky-100 text-sky-700',
    subitens: [
      'Mapa de competidores e anúncios acima da faixa do condomínio',
      'Batalha de casas com scores de localização, preço e produto',
      'Checklist de demanda com corretores ativos (mín. 3 entrevistas)',
      'Ticket médio, m² e tempo de estoque no empreendimento',
      'Cruzar portais, CRM e vendas fechadas — não só preço pedido',
    ],
  },
  {
    id: 'produto',
    titulo: 'Leitura de produto',
    Icon: Home,
    iconClass: 'bg-orange-100 text-orange-800',
    subitens: [
      'Tipologia e metragem compatíveis com frente, lote e condomínio',
      'Configurador Moní com PDF arquivado na pasta do negócio',
      'Padrão construtivo e opcionais alinhados ao posicionamento',
      'Evitar “maior casa possível” sem teste de absorção',
      'Acoplamento ao terreno (declive, recuos, vista)',
    ],
  },
  {
    id: 'liquidez',
    titulo: 'Leitura de liquidez',
    Icon: Gauge,
    iconClass: 'bg-teal-100 text-teal-800',
    subitens: [
      'Prazo de venda com base histórica no condomínio',
      'Pressão de estoque e concorrência direta no lote',
      'Cenário de liquidação distinto do Target (stress real)',
      'Fatores que aceleram ou travam a saída (ticket, frente, área)',
      'Resposta honesta às 7 perguntas de validação de hipótese',
    ],
  },
  {
    id: 'financeira',
    titulo: 'Leitura financeira',
    Icon: Calculator,
    iconClass: 'bg-violet-100 text-violet-700',
    subitens: [
      'BCA em Planta, Target e Liquidação sem alterar fórmulas',
      'Custos negativos e premissas de terreno, casa e financiamento',
      'Margem alavancada e não alavancada interpretadas com critério',
      'TIR terrenista vs CDI e estrutura de permuta coerente',
      'Simulador e outputs (L102–L134) lidos antes do comitê',
    ],
  },
  {
    id: 'critico',
    titulo: 'Pensamento crítico',
    Icon: Brain,
    iconClass: 'bg-amber-100 text-amber-900',
    subitens: [
      'Questionar VGV emocional e exceções de mercado',
      'Identificar o risco principal e como mitigá-lo na defesa',
      'Separar o que é premissa do que é fórmula automática',
      'Recusar “fechar conta” cortando custo sem evidência',
      'Ajustar só a variável crítica após feedback do comitê',
    ],
  },
  {
    id: 'organizacao',
    titulo: 'Organização',
    Icon: ListChecks,
    iconClass: 'bg-emerald-100 text-emerald-800',
    subitens: [
      'Card atualizado no Funil Step One e anexos completos',
      'Checklist final do BCA antes de solicitar comitê',
      'SLAs e avanço de fase respeitados no HubFly',
      'Versionar planilhas e usar modelos oficiais da biblioteca',
      'Comunicação clara com jurídico, crédito e operações',
    ],
  },
];

const CRITERIOS_AVALIACAO = [
  {
    id: 'evidencia',
    titulo: 'Evidência de mercado',
    descricao: 'Hipóteses sustentadas por mapa, batalha, demanda e vendas reais.',
  },
  {
    id: 'bca',
    titulo: 'Disciplina no BCA',
    descricao: 'Planilha completa, cenários cruzados e premissas documentadas.',
  },
  {
    id: 'produto',
    titulo: 'Adequação do produto',
    descricao: 'Casa vendável para o lote, não apenas a maior ou mais bonita.',
  },
  {
    id: 'fluxo',
    titulo: 'Uso do HubFly',
    descricao: 'Kanban, avanço e SLAs em dia; card sem gargalo oculto.',
  },
  {
    id: 'comite',
    titulo: 'Defesa no comitê',
    descricao: 'Roteiro claro, riscos explícitos e resposta a recusas com dado novo.',
  },
  {
    id: 'execucao',
    titulo: 'Execução pós-aprovação',
    descricao: 'Encaminhamentos legais e de crédito sem retrabalho por falta de pacote.',
  },
];

function CompetenciaCard({ titulo, subitens, Icon, iconClass }) {
  return (
    <article className={`${UI.card} flex flex-col`}>
      <div className="flex items-start gap-3">
        <IconBadge Icon={Icon} iconClass={iconClass} />
        <h4 className={`${UI.cardTitle} pt-1.5`}>{titulo}</h4>
      </div>
      <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4">
        {subitens.map((item) => (
          <li key={item} className={UI.listItem}>
            <span className={UI.listBulletMuted} aria-hidden />
            <span className="text-slate-600">{item}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function CriterioCard({ titulo, descricao }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3">
      <h4 className={UI.cardTitle}>{titulo}</h4>
      <p className={`${UI.cardTextSm} mt-1.5`}>{descricao}</p>
    </article>
  );
}

function AreasTab() {
  return (
    <div className={UI.tabStack}>
      <TabIntro>
        O franqueado Moní precisa dominar leituras complementares — mercado, produto, liquidez e finanças — com organização e
        pensamento crítico. Abaixo, as competências em desenvolvimento e os critérios usados na avaliação contínua.
      </TabIntro>

      <SectionBlock title="Competências a desenvolver">
        <div className={UI.grid3}>
          {COMPETENCIAS_DESENVOLVER.map((comp) => (
            <CompetenciaCard key={comp.id} {...comp} />
          ))}
        </div>
      </SectionBlock>

      <SectionBlock
        title="Critérios de avaliação do franqueado"
        lead="Referência para feedbacks, comitê e acompanhamento da rede — não substitui a política formal de desempenho."
      >
        <div className={UI.grid3Tight}>
          {CRITERIOS_AVALIACAO.map((criterio) => (
            <CriterioCard key={criterio.id} {...criterio} />
          ))}
        </div>
      </SectionBlock>
    </div>
  );
}

const PASTAS_PADRAO = [
  {
    codigo: '01_ONBOARDING',
    nome: 'Onboarding',
    descricao: 'Treinamentos, Casa 0, checklists de entrada e materiais de integração do franqueado.',
  },
  {
    codigo: '02_STEP_ONE',
    nome: 'Step One',
    descricao: 'Mapa de competidores, batalha de casas, demanda e planilha Step One do empreendimento.',
  },
  {
    codigo: '03_BCA',
    nome: 'BCA',
    descricao: 'Planilhas de viabilidade, cenários Planta, Target e Liquidação e versões enviadas ao comitê.',
  },
  {
    codigo: '04_COMITE',
    nome: 'Comitê',
    descricao: 'Apresentações, roteiro de defesa, atas, feedbacks e decisões de aprovação ou recusa.',
  },
  {
    codigo: '05_JURIDICO',
    nome: 'Jurídico',
    descricao: 'Auditoria documental, matrícula, contratos com terrenista e documentação para SPE.',
  },
  {
    codigo: '06_OPERACOES',
    nome: 'Operações',
    descricao: 'Cronograma de obra, fornecedores, configurador (PDF) e acompanhamento de entrega.',
  },
  {
    codigo: '07_CRÉDITO',
    nome: 'Crédito',
    descricao: 'Propostas de financiamento, CET, garantias, checklist de crédito e retornos do parceiro financeiro.',
  },
];

const NOMENCLATURA_EXEMPLO_CORRETO = '2026-05_Condominio-Horizonte_Lote-07_BCA-Target-v2.xlsx';
const NOMENCLATURA_EXEMPLO_INCORRETO = 'BCA final revisado MAIO (2).xlsx';

function PastaPadraoRow({ codigo, nome, descricao }) {
  return (
    <li className="flex flex-col gap-3 border-b border-slate-100 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <span className="shrink-0 rounded-md bg-violet-100 px-2 py-1 font-mono text-xs font-bold uppercase tracking-wide text-violet-800">
          {codigo}
        </span>
        <span className={UI.cardTitle}>{nome}</span>
      </div>
      <p className={`${UI.cardText} sm:max-w-md sm:text-right`}>{descricao}</p>
    </li>
  );
}

function OrganizacaoTab() {
  return (
    <div className={UI.tabStack}>
      <TabIntro>
        Cada operação deve seguir a mesma árvore de pastas no drive compartilhado. Isso permite que comitê, jurídico e
        crédito encontrem qualquer arquivo sem depender do franqueado no WhatsApp.
      </TabIntro>

      <SectionBlock title="Pastas padrão">
        <ul className={`${UI.card} divide-y divide-slate-100 !py-0 px-4 sm:px-5`}>
          {PASTAS_PADRAO.map((pasta) => (
            <PastaPadraoRow key={pasta.codigo} {...pasta} />
          ))}
        </ul>
      </SectionBlock>

      <SectionBlock
        title="Nomenclatura"
        lead={
          <>
            Padrão:{' '}
            <span className="font-mono text-xs text-slate-500">
              AAAA-MM_Empreendimento_Contexto_Documento-versão.ext
            </span>{' '}
            — sem espaços, sem “final” ou “cópia”, sempre com empreendimento e lote identificáveis.
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 sm:px-5 sm:py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Exemplo correto</p>
            <p className="mt-1.5 break-all font-mono text-sm font-medium text-emerald-900">
              {NOMENCLATURA_EXEMPLO_CORRETO}
            </p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 sm:px-5 sm:py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-800">Exemplo incorreto</p>
            <p className="mt-1.5 break-all font-mono text-sm text-red-700 line-through decoration-red-600">
              {NOMENCLATURA_EXEMPLO_INCORRETO}
            </p>
          </div>
        </div>
      </SectionBlock>
    </div>
  );
}

const CONCEITOS_CHAVE = [
  {
    id: 'liquidez',
    titulo: 'Liquidez',
    descricaoCurta:
      'Probabilidade e velocidade de venda do produto no condomínio, no ticket e no prazo que você definiu.',
    detalhes:
      'Produto líquido é o que o mercado quer comprar pelo preço que aceita pagar. Avalie estoque parado, concorrentes diretos, frente do lote e ticket médio da região. Se a liquidez é fraca, o BCA pode até fechar no Target — mas a operação trava na prática. Sempre stressar o cenário de Liquidação.',
    Icon: Waves,
    iconClass: 'bg-teal-100 text-teal-800',
  },
  {
    id: 'bca',
    titulo: 'BCA',
    descricaoCurta:
      'Análise de Viabilidade de Negócio: a planilha que organiza receita, custos, financiamento e margem em vários cenários.',
    detalhes:
      'Preencha só células de entrada (azuis na planilha). Nunca altere fórmulas automáticas — se o resultado está errado, a premissa anterior está errada. Trabalhe Planta, Target e Liquidação. Meta de referência: margem saudável no Target e operação que ainda se protege na Liquidação. O treinamento interativo na biblioteca detalha campo a campo.',
    Icon: FileSpreadsheet,
    iconClass: 'bg-violet-100 text-violet-700',
  },
  {
    id: 'batalha',
    titulo: 'Batalha de casas',
    descricaoCurta:
      'Comparativo estruturado da sua unidade contra cada concorrente em localização, preço e produto.',
    detalhes:
      'Cada critério recebe pontuação; a soma posiciona você no ranking do condomínio. Meta operacional: estar entre os 2 primeiros em preço × produto × localização. Sem batalha preenchida com evidência (link, captura de tela, venda real), a defesa de VGV no comitê fica frágil.',
    Icon: Swords,
    iconClass: 'bg-orange-100 text-orange-800',
  },
  {
    id: 'hipotese',
    titulo: 'Hipótese',
    descricaoCurta:
      'Conjunto de premissas testáveis — VGV, prazo, produto e terreno — antes de comprometer a operação.',
    detalhes:
      'Hipótese não é desejo nem promessa ao terrenista. Deve ser construída no Step One, validada com mapa e demanda, e refinada na etapa de Hipótese de Liquidez. Só depois vira negociação formal. Se uma premissa mudar, o BCA e a batalha precisam ser atualizados juntos.',
    Icon: Lightbulb,
    iconClass: 'bg-amber-100 text-amber-900',
  },
  {
    id: 'erros-comuns',
    titulo: 'Erros comuns',
    descricaoCurta:
      'Armadilhas que distorcem o resultado ou mascaram risco — VGV emocional, custo irreal, prazo otimista.',
    detalhes:
      'Outros erros frequentes: valor positivo em campo de custo; maior casa possível sem teste de absorção; liquidação idêntica ao Target; prometer ao terrenista sem cenário de stress. O manual do BCA lista erros e como corrigir pela premissa, nunca pela fórmula.',
    Icon: AlertTriangle,
    iconClass: 'bg-red-100 text-red-800',
  },
  {
    id: 'comite',
    titulo: 'Comitê',
    descricaoCurta:
      'Fórum que cruza números do BCA com política, risco, produto e execução antes de aprovar o negócio.',
    detalhes:
      'Prepare o roteiro de defesa: lote, condomínio, VGV com evidência, terreno, margens Target e Liquidação, principal risco e mitigação. Se houver recusa, identifique a variável crítica, corrija com dado de mercado e reapresente o pacote completo — não refaça tudo por impulso.',
    Icon: Users,
    iconClass: 'bg-emerald-100 text-emerald-800',
  },
];

function ConceitoCard({ id, titulo, descricaoCurta, detalhes, Icon, iconClass }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article
      className={[
        `${UI.card} flex flex-col transition-all duration-200`,
        expanded ? 'border-emerald-300 ring-1 ring-emerald-100' : '',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <IconBadge Icon={Icon} iconClass={iconClass} />
        <div className="min-w-0 flex-1">
          <h4 className={UI.cardTitle}>{titulo}</h4>
          <p className={`${UI.cardTextSm} mt-1.5`}>{descricaoCurta}</p>
        </div>
      </div>

      {expanded ? (
        <p
          id={`conceito-detalhe-${id}`}
          className={`${UI.cardText} mt-4 border-t border-slate-100 pt-4 text-slate-700`}
        >
          {detalhes}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className={`${UI.btnSecondary} mt-4`}
        aria-expanded={expanded}
        aria-controls={`conceito-detalhe-${id}`}
      >
        {expanded ? 'Fechar' : 'Saiba mais'}
      </button>
    </article>
  );
}

function ConceitosChaveTab() {
  return (
    <div className={UI.tabStack}>
      <TabIntro>
        Seis conceitos que aparecem em todo o fluxo Moní. Use os cards como referência rápida; expanda para aprofundar antes
        de ir ao comitê ou ao terrenista.
      </TabIntro>
      <div className={UI.grid3}>
        {CONCEITOS_CHAVE.map((conceito) => (
          <ConceitoCard key={conceito.id} {...conceito} />
        ))}
      </div>
    </div>
  );
}

function renderTabContent(activeTab) {
  switch (activeTab) {
    case 'ecossistema':
      return <EcossistemaTab />;
    case 'principios':
      return <PrincipiosTab />;
    case 'jornada':
      return <JornadaTab />;
    case 'areas':
      return <AreasTab />;
    case 'organizacao':
      return <OrganizacaoTab />;
    case 'conceitos-chave':
      return <ConceitosChaveTab />;
    default:
      return null;
  }
}

/** Conteúdo do painel: monta com opacity 0 e, no próximo tick, vai a 1 — sem animação de saída (evita “escurecer” ao cruzar abas). */
function TabPanelBody({ activeTab }) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setEntered(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div
      className={[
        'ease-out motion-reduce:!translate-y-0 motion-reduce:!opacity-100 motion-reduce:transition-none',
        'transition-[opacity,transform] duration-150',
        entered ? 'translate-y-0 opacity-100' : 'translate-y-[6px] opacity-0',
      ].join(' ')}
      aria-live="polite"
    >
      {renderTabContent(activeTab)}
    </div>
  );
}

function TabPanel({ activeTab, label }) {
  return (
    <section
      id={`casa0-panel-${activeTab}`}
      role="tabpanel"
      aria-labelledby={`casa0-tab-${activeTab}`}
      className="min-h-[280px] rounded-b-xl rounded-tr-xl border border-t-0 border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <h2 className="sr-only">{label}</h2>
      <TabPanelBody key={activeTab} activeTab={activeTab} />
    </section>
  );
}

export default function Casa0Hub() {
  const [activeTab, setActiveTab] = useState(TABS[0].id);

  const current = TABS.find((tab) => tab.id === activeTab) ?? TABS[0];

  return (
    <div className="w-full space-y-5 py-6">
      <p className={UI.tabIntro}>
        Navegue pelas seções para conhecer o ecossistema Moní, a jornada do negócio e os conceitos essenciais da
        operação.
      </p>

      <nav className={UI.tabNav} role="tablist" aria-label="Seções do onboarding">
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`casa0-panel-${tab.id}`}
              id={`casa0-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={[UI.tabBtn, isActive ? UI.tabBtnActive : UI.tabBtnIdle].join(' ')}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      <TabPanel activeTab={activeTab} label={current.label} />
    </div>
  );
}
