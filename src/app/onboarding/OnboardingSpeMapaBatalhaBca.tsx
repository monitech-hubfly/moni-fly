'use client';

const CATALOGO = `Catálogo de casas
Como escolher, como mexer, melhor implantação, padrão incorporador vs kit moní, escolha de gadgets deve partir da análise dos competidores, discurso de cada casa, como comparar cada casas com o mercado e atributos da casa (faixa de vgv que atende, tamanho de lote que atende, lotes com frente larga, lotes com frente curto, vista na frente do lote, vista no fundo do lote, utilização en implantação frente, fundo, laterais como fachada, lotes em aclive, declive ou plano, terreas vs sobrado, rooftop sim ou não, quantidade de quartos e banheiros, metragem das casas, dimensões das casas, garagem subterranea ou em nível, padrão assinatura de arquitetos famosos, para cruzar com os recuos do lote e ver se cabe? preciso compreender casa aspecto de cada cada para cruzar com os lotes e enender a partir desses aspectos como usar as casas`;

const MODELOS_PRODUTO = `Modelo Incoporadora:
Revestimento de piso e paredes em porcelanato nos banheiros e lavanderia
Paredes em MDF
Bancadas em pedra
Louças e metais simples
Portas Mimetizadas
Iluminação simples

Modelo Moní:
Todos os ambientes com piso (madeira ou porcelanato a depender do ambiente e escolha de cada empreendimento)
Paredes em MDF
Bancadas em pedra
Ilhas em pedra
Louças e metais padrão Moní
Portas Mimetizadas
Iluminação padrão Moní`;

const BATALHA_PREVIA = `Batalha de casas prévia (primeira etapa - para escolher qual a melhor casa e seguir com a negociação)

produto vs condo vs região
preços vs condo vs região
BCA prévio (preenchimento com a casa escolhida)
antes colher qual é o preço usao na região
o que é casa termo, como preencher, quais as variáveis, quais regras de preenchimento, como melhor preencher?

como colocar a condição de negociação
aporte inicial
custos (carta fiança, seguro garantia, taxas de aprovação, projetos, gestão e plataforma, custo da obra, custos fixos do terreno a partir do alvará como premissa, mas depende da negociação)
Pitch de vendas com o terrenistas`;

const PROCESSO = `como lidar com a necessidades de novos produtos? acionar o time e expor necessidade com exemplos práticos

deveríamos cruzar o catálogo com as informações do BCA e lotes para fazer a batalha e escolher as melhores casas automaticamente - por hora o frank não escolhe automaticamente

configurador sendo alterado para inc + kit moní

Fazer o estudo completo
Usar o mapa de competidores para fazer uma batalha completa, segue abaixo as regras que já tenho e usar para orientar no onboarding, passo a passo, material de ensino,...

Motor numérico consolidado (notas por eixo, pesos, desempate): ver \`src/app/step-one/[id]/etapa/REGRAS_BATALHA.ts\` e \`docs/STEP_ONE_ESPEC.md\` (e, para setup local, \`GUIA_COMPLETO_VIABILIDADE.md\` na raiz do repositório).`;

export function OnboardingSpeMapaBatalhaBca() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-stone-50">
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-12">
        <header className="border-b border-stone-200 pb-6">
          <h1 className="text-2xl font-bold tracking-tight text-moni-primary md:text-3xl">
            Mapa, batalha, BCA e SPE
          </h1>
          <p className="mt-2 text-sm text-stone-600 md:text-base">
            Texto de trabalho enviado para o onboarding — integra catálogo, comparativos de mercado, BCA e notas
            sobre automação futura. No módulo técnico, isto corresponde sobretudo às{' '}
            <strong>etapas 6 a 10</strong> (catálogo → lote → batalhas → ranking → BCA) — ver{' '}
            <a className="font-medium text-moni-primary underline" href="/onboarding/step-one-viabilidade-hub">
              Step One — 11 etapas
            </a>
            . Ferramentas:{' '}
            <a className="font-medium text-moni-primary underline" href="/onboarding/configurador">
              Configurador
            </a>
            ,{' '}
            <a className="font-medium text-moni-primary underline" href="/step-one">
              Step One
            </a>
            .
          </p>
        </header>

        <section className="mt-8">
          <h2 className="text-lg font-bold text-stone-900">Catálogo de casas (orientações)</h2>
          <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-stone-200 bg-white p-4 text-xs leading-relaxed text-stone-800 shadow-inner md:text-sm">
            {CATALOGO}
          </pre>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-bold text-stone-900">Modelo Incorporadora vs Modelo Moní</h2>
          <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-stone-200 bg-white p-4 text-xs leading-relaxed text-stone-800 md:text-sm">
            {MODELOS_PRODUTO}
          </pre>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-bold text-stone-900">Batalha prévia, BCA prévio, custos e pitch</h2>
          <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-stone-200 bg-white p-4 text-xs leading-relaxed text-stone-800 md:text-sm">
            {BATALHA_PREVIA}
          </pre>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-bold text-stone-900">Processo, automação e regras de batalha</h2>
          <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-stone-200 bg-white p-4 text-xs leading-relaxed text-stone-800 md:text-sm">
            {PROCESSO}
          </pre>
        </section>
      </div>
    </div>
  );
}
