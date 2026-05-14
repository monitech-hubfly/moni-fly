'use client';

type Termo = { titulo: string; texto: string };

const TERMOS: Termo[] = [
  {
    titulo: 'Permuta total vs permuta parcial',
    texto:
      'Na permuta total, a contrapartida pelo terreno/lote tende a ser integralmente estruturada em permuta (produto/direitos), sem componente relevante em numerário na composição acordada. Na permuta parcial, há combinação de parcela em dinheiro e parcela em produto ou outros instrumentos — exige clareza de tranches, garantias e encaixe em crédito. Na prática de campo costuma-se iniciar a conversa com permuta 100% e negociar em direção à permuta parcial se o terrenista precisar de liquidez ou se o modelo de risco pedir.',
  },
  {
    titulo: 'Compra e venda (vs permuta)',
    texto:
      'Compra e venda clássica: aquisição do ativo mediante preço em dinheiro. Permuta: contrapartida ligada ao produto do empreendimento. Cada modelo altera fluxo de caixa, risco residual do terrenista e pacote jurídico.',
  },
  {
    titulo: 'Condições típicas (terrenista e franqueado)',
    texto:
      'Terrenista: expectativa de preço, forma de pagamento/permute, prazo, garantias, participação em decisões de projeto. Franqueado: aderência ao modelo Moní, capacidade de aportar taxas e custos de transação, cumprimento de checklists e comitê. Condições exatas são negócio a negócio e documentadas no pacote aprovado.',
  },
  {
    titulo: 'Pitch de venda (terreno)',
    texto:
      'Narrativa que conecta produto Moní, absorção da praça, governança da obra e contrapartida justa para o terrenista. Deve estar alinhada ao BCA, ao mapa de competidores e à hipótese — sem prometer resultado que não esteja no estudo.',
  },
  {
    titulo: 'Retornos',
    texto:
      'No glossário operacional, “retornos” costuma significar retorno econômico esperado para cada parte (terrenista em permuta, franqueado na margem do projeto, parceiros de crédito nos fluxos contratados). Formalizar premissas no BCA e no comitê.',
  },
  {
    titulo: 'Quem participa da negociação; participação Moní',
    texto:
      'Em regra participam terrenista, franqueado e interlocutores jurídicos/corretagem conforme o caso. A Moní pode ou não participar de rodadas — depende da governança da unidade e da complexidade; quando participa, costuma ser para alinhar modelo, risco e documentação. Detalhar no playbook da unidade sem afirmar regra única para todos os casos.',
  },
  {
    titulo: 'Liquidação',
    texto:
      'No jargão de operações com terreno e permutas, liquidação refere-se ao adimplemento das obrigações pactuadas (pagamentos, entregas de unidades, quitações e registros). No mercado financeiro o termo também existe — desambiguar em contrato.',
  },
  {
    titulo: 'Recompra programada',
    texto:
      'Mecanismo contratual em que há roteiro de recompra (ou recomposição de posição) de ativos ou unidades em datas ou condições definidas — usado em estruturas específicas de risco/alavancagem. Validar minuta e contabilidade com Jurídico.',
  },
  {
    titulo: 'Vender na planta',
    texto:
      'Comercialização de unidades antes da conclusão da obra, com regime de incorporação e contratos de adquirente aplicáveis; impacta caixa, cronograma e garantias. Seguir o pacote legal da incorporadora e registro.',
  },
  {
    titulo: 'Carta-proposta',
    texto:
      'Instrumento ou documento de proposta comercial e de negócio que antecede ou acompanha a formalização — condições econômicas, objeto, prazos e premissas. Não substitui contrato definitivo nem opção, salvo quando assim previsto no fluxo aprovado.',
  },
  {
    titulo: 'Seguro-garantia',
    texto:
      'Garantia contratual substitutiva ou complementar de cauções clássicas, com seguradora homologada. Exige análise de custo, elegibilidade e coerência com o pacote de crédito e com o contrato de incorporação.',
  },
  {
    titulo: 'BCA (Business Case / caso de negócio)',
    texto:
      'Documento de viabilidade que consolida premissas de produto, custo, receita, cronograma e sensibilidades. No fluxo Moní costuma estar ligado ao mapa de competidores e à batalha de casas. Versões prévias alimentam negociação; versão completa alimenta comitê.',
  },
  {
    titulo: 'Minutas de opção e contratos',
    texto:
      'Minutas são modelos jurídicos aprovados pela Moní e revisores externos quando aplicável. “Opção de compra” e demais contratos devem ser explicados pelo Jurídico no contexto do negócio — esta página não substitui leitura da minuta vigente.',
  },
  {
    titulo: 'Tipos de crédito; 30% e Moní Capital',
    texto:
      '“Tipos de crédito” cobrem linhas bancárias, securitização, parceiros e eventual veículo próprio de capital (ex.: Moní Capital quando existir no desenho). “30%” em documentos internos costuma referir-se a parâmetros de entrada ou garantia em linhas específicas — confirmar sempre com o time de Crédito e a calculadora homologada do caso.',
  },
  {
    titulo: 'Gestão de obra',
    texto:
      'Conjunto de processos de planejamento, compras, fiscalização, segurança, qualidade e reporting que levam o projeto da licença ao registro de entrega. Interface com incorporadora, SPE e fornecedores.',
  },
  {
    titulo: 'Taxa de plataforma',
    texto:
      'Remuneração associada ao uso da plataforma e ecossistema Moní, incidente sobre base contratual definida (ex.: referência interna de 7% sobre custo da casa em materiais de treinamento — validar percentual e base com o contrato vigente da unidade).',
  },
  {
    titulo: 'Giro',
    texto:
      'Velocidade de conversão de estoque (vendas/absorção) ou de capital de giro no ciclo do projeto. Útil para comparar condomínios e produtos no mapa de competidores.',
  },
  {
    titulo: 'Valor presente com desconto (ex.: menos 8% a.a.)',
    texto:
      'Traz fluxos futuros a valor presente usando taxa de desconto — ex.: 8% ao ano como premissa pedagógica em alguns modelos. A taxa correta depende do custo de capital do projeto e da política do comitê.',
  },
  {
    titulo: 'Para que serve cada material e ferramenta',
    texto:
      'Planilhas e checklists estruturam dados de cidade e condomínio; mapa de competidores e batalha qualificam produto e preço; BCA consolida viabilidade; Hub (Steps, Funil Step One, painéis) rastreia status, SLAs e documentos; configurador traduz produto em linguagem de venda e engenharia de valor.',
  },
  {
    titulo: 'Estrutura jurídica (incorporadora, gestora, SPE) e quando abrir',
    texto:
      'Ver página “Estrutura jurídica”. Em linhas gerais: SPE concentra o projeto; gestora administra; incorporadora responde perante adquirentes e órgãos. O momento de abrir cada veículo depende do marco do negócio (antes ou depois de opção, após comitê, na diligência) — seguir orientação Jurídico/Crédito.',
  },
  {
    titulo: 'Liquidez',
    texto:
      'Facilidade de vender o ativo ou unidade na praça, ao preço pretendido, em tempo razoável. O checklist de demanda cita análise de liquidez acima de R$ 12.000/m² para alinhar foco de alto padrão.',
  },
  {
    titulo: 'Opção de compra',
    texto:
      'Instrumento que reserva o negócio e fixa condições para avançar até comitê e diligência, reduzindo risco de “perder o terreno” enquanto se estuda. Cláusulas, prazos e multas são sensíveis — revisão jurídica obrigatória.',
  },
  {
    titulo: 'Comitê e diligência (papel no glossário)',
    texto:
      'Comitê: gate de aprovação com pareceres e eventual devolução para refação. Diligência: análise documental do terreno em escritório homologado, em paralelo a crédito e constituição societária quando aplicável.',
  },
];

export function OnboardingGlossarioCompleto() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-stone-50">
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-12">
        <header className="border-b border-stone-200 pb-6">
          <h1 className="text-2xl font-bold tracking-tight text-moni-primary md:text-3xl">
            Glossário comercial e jurídico
          </h1>
          <p className="mt-2 text-sm text-stone-600 md:text-base">
            Referência pedagógica alinhada ao material de onboarding enviado. Divergências entre esta página e
            contratos ou minutas vigentes prevalecem os <strong>documentos assinados</strong> e o parecer
            jurídico/crédito do caso.
          </p>
        </header>

        <dl className="mt-8 space-y-6">
          {TERMOS.map((t) => (
            <div key={t.titulo} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm md:p-5">
              <dt className="text-base font-bold text-stone-900 md:text-lg">{t.titulo}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-stone-700 md:text-base">{t.texto}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
