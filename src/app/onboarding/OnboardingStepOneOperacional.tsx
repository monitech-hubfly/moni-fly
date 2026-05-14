'use client';

const CHECKLIST_DEMANDA = `Checklist de Demanda – Residencial Unifamiliar (Alto Padrão)

1. OBJETIVO
Este checklist tem como objetivo padronizar a análise de demanda residencial unifamiliar de alto padrão, servindo como base obrigatória para decisões de:
1) Escolha de condomínios
2) Definição de produto imobiliário
3) Validação de preço por m²
Análise de liquidez
O foco está em casas com valor de venda acima de R$ 12.000/m², garantindo que a atuação da franquia esteja alinhada a mercados com capacidade real de absorção.

2. METODOLOGIA DE PESQUISA
A análise deve ser realizada combinando três fontes principais:
1) Pesquisa Online
Portais imobiliários, sites de imobiliárias locais, redes sociais e anúncios ativos.
2) Entrevistas com Corretores
Inteligência de mercado baseada em experiência prática e histórico de vendas.
3) Análise Crítica do Franqueado (aba 6. Hipótese)
Síntese das informações coletadas com foco em viabilidade e oportunidade.

3. PREPARAÇÃO PARA O CONTATO COM CORRETORES
3.1 Seleção de Corretores
Priorizar corretores que atuem diretamente em condomínios de casas
Utilizar Instagram (dica de ouro), Google e indicações
3.2 Abordagem Padrão
Mensagem sugerida:
"Olá, meu nome é ________, sou da Casa Moní e estou mapeando oportunidades para incorporação residencial de alto padrão. Em quais condomínios você tem vendido mais casas com valor acima de R$ 12.000/m²?"
Dica de ouro: enviar a mesma mensagem para vários corretores aumenta a qualidade das respostas e ativa o algoritmo para novos contatos da mesma região.

FAZER UM PARA CADA CONDOMÍNIO PROSPECTADO

na sequência: em vermelho mais perguntas pertinentes para fazer ao corretor
na sequência: em azul podem ser pesquisadas online

SOBRE OS LOTES
Quais os recuos dos lotes
2 - Quantos lotes esse condomínio tem? Quantos estão disponíveis para venda?
3 - Qual o tamanho médio dos lotes?
4 - Qual o preço médio do m² de venda dos lotes?
5 - Qual a área onde os lotes são mais valorizados e tem maior demanda?

SOBRE AS CASAS E CONSTRUÇÕES
6 - Quantas casas estão prontas?
7 - Quantas casas estão sendo construídas? Dessas, quantas estão para venda e quantas são para cliente final?
8 - Quantas casas estão para venda?
9 - Qual o preço do m² de venda das casas?
10 - Quanto tempo leva, em média, para uma casa ser vendida depois de pronta?
11 - Quantas casas foram vendidas nos últimos 12 meses?
12 - O que fez as casas remanescentes demorarem tanto para serem vendidas? Quais das características dela impactaram negativamente na liquidez? Quais erros de projeto você identificou?
13 - E das casas vendidas ultimamente, quais eram as características que os clientes mais elogiaram e fizeram eles tomarem a decisão de compra da casa?
14 - Quais as caracterísiticas os clientes estão buscando, mas não encontraram nas casas disponíveis para venda e vendidas? (ex: depósito na garagem, despensa, suíte térrea, infraestrutura de automação, etc)?

Locação
15 - Qual valor das casas para locação? Dê alguns exemplos abaixo

quais outras perguntas possíveis`;

const ATRIBUTOS_LOTES = `ATRIBUTOS DOS LOTES:

Perto de lixeira
Vista mata?
Vista lago?
Aclive declive ou plano?
Vista frente, vista fundo
dimensões
área do lote
quais outros possíveis?
Garagem subterrânea ou em nível`;

const CONTEXTO_SPE = `No SPE ONE é feito Mapa de competidores para o ranking de condomínios e várias batalhas de casas, por condomínio por cada casa no configurador.

BCA por lote com a escolha da melhor casa que saiu do Mapa + Batalha.

Mapa de competidores:
Puxar todas as casas que estão a venda no condomínio e os dados do material de batalha`;

export function OnboardingStepOneOperacional() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-stone-50">
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-12">
        <header className="border-b border-stone-200 pb-6">
          <h1 className="text-2xl font-bold tracking-tight text-moni-primary md:text-3xl">
            Step One — demanda e campo
          </h1>
          <p className="mt-2 text-sm text-stone-600 md:text-base">
            Conteúdo operacional para mapeamento: checklist de demanda, contato com corretores, lotes e casas,
            atributos de lote e ligação com mapa de competidores / batalha / BCA. Complementar com{' '}
            <a className="font-medium text-moni-primary underline" href="/step-one">
              Step One no Hub
            </a>{' '}
            e com o{' '}
            <a className="font-medium text-moni-primary underline" href="/funil-stepone">
              Funil Step One
            </a>
            .
          </p>
          <p className="mt-4 rounded-lg border border-blue-200/90 bg-blue-50/60 px-4 py-3 text-sm text-blue-950/90">
            Para a <strong>ordem completa das 11 etapas técnicas</strong> do módulo de viabilidade (praça → PDF de
            hipóteses), abra{' '}
            <a className="font-semibold underline" href="/onboarding/step-one-viabilidade-hub">
              Step One — 11 etapas (viabilidade)
            </a>
            — alinhado a <code className="text-xs">docs/STEP_ONE_ESPEC.md</code>.
          </p>
        </header>

        <section className="mt-8 space-y-4">
          <h2 className="text-lg font-bold text-stone-900">Dados da cidade (visão de trabalho)</h2>
          <p className="text-sm text-stone-700 md:text-base">
            Dados da cidade, eixo de expansão, população, principais vias, lugares ruins na cidade, praças,
            parques, onde estão os condomínios que vendem acima de 5 milhões e os que não vendem, ranking de
            condomínios com base nos valores, contatos com corretores e condomínios (lista, telefones e e-mails),
            perguntas abaixo e listagem de lotes com base nos atributos dos lotes; definir condomínio e lotes
            alvo com base nos rankings e nas respostas.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-bold text-stone-900">Checklist de demanda (texto integral)</h2>
          <pre className="mt-3 max-h-[min(70vh,520px)] overflow-auto whitespace-pre-wrap rounded-xl border border-stone-200 bg-white p-4 text-xs leading-relaxed text-stone-800 shadow-inner md:text-sm">
            {CHECKLIST_DEMANDA}
          </pre>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-bold text-stone-900">Atributos dos lotes (lista de trabalho)</h2>
          <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-stone-200 bg-white p-4 text-xs leading-relaxed text-stone-800 md:text-sm">
            {ATRIBUTOS_LOTES}
          </pre>
        </section>

        <section className="mt-8 rounded-xl border border-stone-200 bg-amber-50/60 p-4 md:p-5">
          <h2 className="text-lg font-bold text-amber-950">Cores no material (corretor vs online)</h2>
          <p className="text-sm text-amber-950/90">
            No modelo de planilha: em <strong>vermelho</strong> — perguntas pertinentes para fazer ao corretor;
            em <strong>azul</strong> — o que pode ser pesquisado online. Replicar por condomínio prospectado.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-bold text-stone-900">Mapa, batalhas e BCA (no ciclo Step One)</h2>
          <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-stone-200 bg-white p-4 text-xs leading-relaxed text-stone-800 md:text-sm">
            {CONTEXTO_SPE}
          </pre>
        </section>
      </div>
    </div>
  );
}
