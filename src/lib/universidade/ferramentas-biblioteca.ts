export type FerramentaBibliotecaIcon =
  | 'bca'
  | 'mapa'
  | 'batalha'
  | 'casa'
  | 'clipboard'
  | 'demanda'
  | 'capital';

export type FerramentaBiblioteca = {
  id: string;
  titulo: string;
  descricaoCurta: string;
  tags: string[];
  icon: FerramentaBibliotecaIcon;
  /** Fundo do quadrado do ícone (Tailwind) */
  iconBgClass: string;
  /** Cor do ícone (Tailwind) */
  iconColorClass: string;
  /** Texto explicativo em Markdown (modal) */
  conteudoExplicativoMd: string;
  /** Link principal opcional (CTA no modal) */
  linkPrincipal?: { label: string; href: string };
};

export const FERRAMENTAS_BIBLIOTECA: FerramentaBiblioteca[] = [
  {
    id: 'bca-analise-viabilidade',
    titulo: 'Treinamento BCA Moní — Manual do Franqueado',
    descricaoCurta:
      'Manual operacional interativo: aba Resumo campo a campo (C7 a C78), 4 cenários de venda, checklist com 36 itens, simulador de margem e roteiro de defesa no comitê.',
    tags: ['Planilha', 'Financeiro', 'Obrigatório'],
    icon: 'bca',
    iconBgClass: 'bg-violet-100',
    iconColorClass: 'text-violet-700',
    conteudoExplicativoMd: `## O que é

O **BCA (Business Case Analysis)** é a planilha-mãe da Moní para decidir se o negócio faz sentido econômico. Ela consolida receitas, custos, impostos, comissões, alavancagem e cenários diferentes de negociação.

## Os três cenários

1. **Planta** — visão no empreendimento ainda em construção.
2. **Target** — premissa comercial alvo que o time considera realista para venda.
3. **Liquidação** — estresse: velocidade de venda e preço defensivo.

## Como usar no dia a dia

- Preencha os campos editáveis.
- Compare os três cenários antes de levar qualquer proposta ao comitê.
- Veja se os percentuais de VGV, retorno ao terrenista, liquidação e espaço entre liquidação e target estão de acordo com as premissas.

## Boas práticas

- Uma vez compreendida a possibilidade de viabilizar o negócio, seguir para assinatura da opção, depois terá tempo para refinamento do negócio até o Comitê.
- **Template do BCA:** sempre faça uma cópia do arquivo oficial da biblioteca, pois pode ter sido atualizado.`,
    linkPrincipal: { label: 'Abrir treinamento interativo', href: '/treinamento-bca/introducao' },
  },
  {
    id: 'mapa-competidores',
    titulo: 'Mapa de competidores',
    descricaoCurta:
      'Levantamento estruturado de casas à venda acima de R$12k/m². Atualização mensal. Sem isso, qualquer hipótese de preço é chute.',
    tags: ['Planilha', 'Mensal', 'Step One'],
    icon: 'mapa',
    iconBgClass: 'bg-sky-100',
    iconColorClass: 'text-sky-700',
    conteudoExplicativoMd: `## Objetivo

O **mapa de competidores** registra, de forma padronizada, **ofertas reais** no condomínio e entorno — em especial unidades acima de **R$ 12k/m²** (referência operacional; ajuste se a política regional mudar).

## Por que é obrigatório na prática

Sem mapa atualizado, a hipótese de preço e a narrativa de produto viram **achismo**. O mapa transforma percepção em **dado comparável** para o BCA e para o comitê.

## Ritmo

- **Atualização mensal** (mínimo) ou sempre que houver mudança relevante de estoque ou preço.
- Cruze com o **configurador** e com a **batalha de casas** antes de congelar premissas.

## Onde guardar

Use a estrutura de abas da **Planilha Step One** (seção **Documentos**) ou o template de mapa que o time de operações mantiver como padrão.`,
  },
  {
    id: 'batalha-casas',
    titulo: 'Batalha de casas',
    descricaoCurta:
      'Pontuação em Atributos do Lote, Preço e Produto vs. cada concorrente. Meta: estar no Giro na faixa de valor escolhida.',
    tags: ['Score', 'Ranking', 'Step 2'],
    icon: 'batalha',
    iconBgClass: 'bg-violet-100',
    iconColorClass: 'text-violet-800',
    conteudoExplicativoMd: `## O que resolve

A **batalha de casas** compara o produto Moní contra cada concorrente relevante em três eixos: **Atributos do Lote**, **Preço** (D/E/I/P) e **Produto** (T+A+Q+B+V+D+I).

## Fluxo resumido

Mapa → Pré-Batalha (só Lote + Produto) → Configurador + BCA → Batalha completa → Tese de vendas.

## Meta operacional

Estar no **Giro** do condomínio na faixa de valor escolhida. Posição ≤ giro → vende; posição > giro → não vende no prazo esperado.

## Guia completo

Escala -3 a +2, pré-preenchimento de atributos (Lotes Disponíveis), custo do Configurador, ranking G/E/P e tese — no guia interativo (botão abaixo).

## Armadilhas comuns

- Score sem evidência (link/print do anúncio) — não passa em comitê.
- Batalhar fora da faixa de valor ou sem catálogo/configurador atualizado.`,
    linkPrincipal: {
      label: 'Abrir passo a passo',
      href: '/universidade/ferramentas/batalha-casas',
    },
  },
  {
    id: 'configurador-casas',
    titulo: 'Configurador de casas',
    descricaoCurta:
      'Web app (moni-configurador.vercel.app) com catálogo completo, opcionais em tempo real e geração de PDF. Traduz o lote em produto e custo.',
    tags: ['Web app', 'FKMONI', 'Produto'],
    icon: 'casa',
    iconBgClass: 'bg-orange-100',
    iconColorClass: 'text-orange-800',
    linkPrincipal: { label: 'Abrir configurador', href: 'https://moni-configurador.vercel.app' },
    conteudoExplicativoMd: `## Função

O **configurador** traduz o **lote** em **produto** (tipologia, opcionais, acabamentos) e em **custo / VGV** de forma visual, com catálogo completo e opcionais em tempo real, gerando **PDF** para anexo em comitê, crédito ou negociação.

## Quem usa

- Time de **produto** e **Step One** para montar a oferta alinhada ao posicionamento.
- **Crédito / parceiros** para bater metragem, opcionais e preço de tabela.

## Boas práticas

- Sempre exporte o **PDF** e arquive na pasta do empreendimento.
- Cruze o output com o **BCA** antes de comprometer permuta ou desconto.
- Se o link externo mudar, avise o time Moní para atualizar este card.

## Acesso

Use o botão **Abrir configurador** abaixo (ambiente web em \`moni-configurador.vercel.app\`).`,
  },
  {
    id: 'planilha-step-one',
    titulo: 'Planilha Step One',
    descricaoCurta:
      '6 abas sequenciais: competidores base, resultado, lotes, demanda, valor x giro e hipótese final. Repositório central de inteligência de mercado.',
    tags: ['6 abas', 'Mensal', 'Ranking'],
    icon: 'clipboard',
    iconBgClass: 'bg-orange-100',
    iconColorClass: 'text-orange-800',
    conteudoExplicativoMd: `## Estrutura (6 abas)

1. **Competidores base** — mapa e referências de anúncio.
2. **Resultado** — consolidação de leitura de mercado.
3. **Lotes** — parâmetros por unidade / tipologia.
4. **Demanda** — entrevistas com corretores (use o **Checklist de demanda**).
5. **Valor × giro** — ponte entre preço e velocidade.
6. **Hipótese final** — conclusão que alimenta o BCA e o comitê.

## Papel na operação

É o **repositório central de inteligência de mercado** do Step One: tudo que não estiver aqui tende a se perder em e-mails soltos.

## Ritual

- **Atualização mensal** do bloco de competidores e demanda quando o empreendimento estiver em captação ativa.
- Sempre que mudar a hipótese final, **versione** e registre data na capa da planilha.

## Onde baixar

O arquivo oficial fica na aba **Documentos** (categoria Step One / templates divulgados pelo time).`,
  },
  {
    id: 'checklist-demanda',
    titulo: 'Checklist de demanda',
    descricaoCurta:
      'Roteiro de entrevista com corretores ativos. Mínimo 3 por condomínio. Transforma percepção em dado verificável.',
    tags: ['Checklist', 'Corretores', 'Step One'],
    icon: 'demanda',
    iconBgClass: 'bg-emerald-100',
    iconColorClass: 'text-emerald-800',
    conteudoExplicativoMd: `## Objetivo

Transformar **percepção de corretor** em **dado verificável** sobre demanda, perfil de comprador, objeções e velocidade de venda no condomínio.

## Regra de ouro

- **Mínimo de 3 entrevistas** com corretores **ativos** no empreendimento (ou no raio acordado com o time).

## Roteiro

- Abra com contexto (produto, faixa de preço, permuta).
- Pergunte sobre **visitas**, **reservas**, **objeções de preço**, **comparáveis** que o cliente cita.
- Feche pedindo **evidência** (anúncio, print, nome de unidade) quando possível.

## Depois da entrevista

- Registre na aba **Demanda** da Planilha Step One.
- Cruzamento obrigatório com **mapa** e **batalha** antes de mexer no BCA.

## Material

Se existir PDF/checklist oficial, ele estará em **Documentos**; use este card como referência de **método**.`,
  },
  {
    id: 'moni-capital',
    titulo: 'Moní Capital',
    descricaoCurta:
      'Captação de recursos para o seu projeto sem tirar dinheiro do bolso. Plataforma de captação privada da rede Moní: contexto, regras, passo a passo e materiais.',
    tags: ['Captação', 'Funding', 'Pré-obra'],
    icon: 'capital',
    iconBgClass: 'bg-amber-100',
    iconColorClass: 'text-amber-800',
    conteudoExplicativoMd: `## O que é

A **Moní Capital** é a plataforma de captação privada da rede Moní para viabilizar recursos do empreendimento — por exemplo, parcelas da carta fiança ou necessidades de caixa na pré-obra — sem comprometer todo o capital próprio do franqueado.

## Quando usar

- Janela entre aprovação de projeto e necessidade de garantias ou desembolsos.
- Operações em que recurso próprio é limitado, mas o BCA fecha com captação estruturada.
- Após alinhamento com o time sobre elegibilidade e regras da oferta.

## O que você encontra no guia

1. Contexto e restrições da plataforma.
2. Regras inegociáveis da oferta.
3. Passo a passo com 7 etapas.
4. Lista de dados e materiais necessários.
5. Comparativo e próximos passos para publicar a oferta.

## Boas práticas

- Leia o guia completo antes de abrir SPE ou subir oferta.
- Atualize o BCA com o impacto da captação no VGV e no retorno.`,
    linkPrincipal: { label: 'Abrir guia Moní Capital', href: '/universidade/ferramentas/moni-capital' },
  },
];
