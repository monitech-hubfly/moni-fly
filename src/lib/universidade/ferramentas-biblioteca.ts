export type FerramentaBibliotecaIcon = 'bca' | 'mapa' | 'batalha' | 'casa' | 'clipboard' | 'demanda';

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
    titulo: 'BCA — Análise de viabilidade',
    descricaoCurta:
      'Simulador financeiro em 3 cenários: Planta, Target e Liquidação. Motor central de toda decisão de investimento. Meta: %VGV Target ≥ 10%.',
    tags: ['Planilha', 'Financeiro', 'Obrigatório'],
    icon: 'bca',
    iconBgClass: 'bg-violet-100',
    iconColorClass: 'text-violet-700',
    conteudoExplicativoMd: `## O que é

O **BCA (Business Case Analysis)** é a planilha-mãe da Moní para decidir se um lote ou permuta faz sentido econômico. Ela consolida receitas, custos, impostos, comissões, financiamento e permuta em **três cenários** de referência.

## Os três cenários

1. **Planta** — visão de construção / cronograma de obra (ex.: mês 6).
2. **Target** — premissa comercial alvo que o time considera realista para venda.
3. **Liquidação** — estresse: velocidade de venda e preço defensivo.

## Como usar no dia a dia

- Preencha **VGV**, comissões, terreno (fixo e variável), **% permuta**, custo de casa, taxas e juros conforme o modelo vigente (2025 ou 2026 na aba **Documentos**).
- Compare os três cenários antes de levar qualquer proposta ao comitê.
- **Meta institucional:** %VGV Target **≥ 10%** (ajuste interno quando a política mudar).

## Boas práticas

- Nunca apresente preço ou permuta ao mercado sem um BCA coerente com a documentação de concorrentes (mapa e batalha de casas).
- Versione a planilha: use sempre o arquivo oficial da biblioteca **Documentos** para não divergir de premissas.`,
    linkPrincipal: { label: 'Abrir treinamento interativo (manual)', href: '/treinamento-bca.html' },
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
      'Pontuação em Localização, Preço e Produto vs. cada concorrente. Meta: estar no TOP 2 do ranking do condomínio.',
    tags: ['Score', 'Ranking', 'Step 2'],
    icon: 'batalha',
    iconBgClass: 'bg-violet-100',
    iconColorClass: 'text-violet-800',
    conteudoExplicativoMd: `## O que resolve

A **batalha de casas** compara a sua unidade (ou tipologia) contra cada concorrente relevante em três eixos:

- **Localização** (vista, sol, andar, posição na quadra)
- **Preço** (R$/m² e condições)
- **Produto** (metragem, acabamento, diferenciais)

## Meta operacional

Estar no **TOP 2** do ranking do condomínio no conjunto **preço × produto × localização**. Se você não está no topo, o BCA precisa mostrar **como** o desconto ou o produto fecham a conta.

## Fluxo sugerido

1. Mapa de competidores atualizado.
2. Preencher scores por concorrente (template em **Documentos**).
3. Registrar no Step One e anexar evidências (fotos, links de anúncio).

## Armadilhas comuns

- Score “bonito” sem link de anúncio ou print — não passa em comitê.
- Misturar tipologias incomparáveis sem normalizar m² e VGV.`,
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
];
