'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Check, CheckCircle, Search, Unlock, X } from 'lucide-react';
import clsx from 'clsx';
import { createClient } from '@/lib/supabase/client';
import { SetupTaskItem, type SetupTaskItemStatus } from '@/components/casa0/SetupTaskItem';
import { ProgressTracker } from '@/components/casa1/ProgressTracker';
import { CASA1_ID, type Casa1ItemStatus, useCasa1Progresso } from '@/hooks/useCasa1Progresso';

const proseList = 'mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700';
const proseP = 'mt-3 text-sm leading-relaxed text-slate-700';
const sectionTitle = 'mt-8 text-xs font-semibold uppercase tracking-widest text-slate-500';

const CONFIRMACOES_MODULO1 = [
  'Confirmo que entendi a definição de incorporação e os elos: terreno, produto, estrutura financeira, aprovação, execução, venda e liquidação.',
  'Reconheço as diferenças das casas em condomínio (escala, ticket, liquidez, lote, implantação) e o contraste com o vertical em termos de risco.',
  'Assumo que uma operação “boa” é a mais líquida, previsível e segura — não necessariamente a mais extravagante.',
] as const;

const CONFIRMACOES_MODULO2 = [
  'Li e compreendi o papel de cada área do ecossistema Moní (Franqueado, Comitê, Jurídico, Crédito, Arquitetura e Operações).',
  'Entendi a ordem da jornada completa: Pesquisa → Hipótese → Validação → BCA → Comitê → Jurídico → Crédito → Contrato → Operação → Venda → Liquidação.',
  'Estou alinhado com o fluxo integrado entre as áreas ao longo da operação.',
] as const;

const CONFIRMACOES_MODULO3 = [
  'Entendi os três modelos de negócio (permuta total, permuta parcial e compra e venda) e suas vantagens e desafios.',
  'Reconheço em que contexto a permuta total faz sentido e quando não usar (liquidez fraca, operação fraca, mercado lento).',
  'Sei que a Moní escolhe o modelo com base em liquidez, risco, funding, perfil do terrenista, margem, velocidade e absorção.',
] as const;

const CONFIRMACOES_MODULO4 = [
  'Entendi que a Moní não decide com base em emoção, arquitetura isolada, gosto pessoal ou expectativa sem validação.',
  'Assumo que a prioridade é liquidez, previsibilidade, margem saudável, velocidade e segurança operacional.',
  'Reconheço que o que mais importa é localização + produto + preço + liquidez — e que a operação “mais bonita” nem sempre é a melhor.',
] as const;

const CONFIRMACOES_MODULO5 = [
  'Entendi o que aumenta liquidez (produto aderente, ticket, condomínio, estoque, implantação, frente) e o que a reduz.',
  'Reconheço os sinais de alerta: estoque alto, casas paradas, tempo de venda elevado, excesso de premium e preço acima do mercado.',
  'Assumo que a leitura de mercado precisa antecipar absorção e velocidade — não só “vender a ideia” da casa.',
] as const;

const CONFIRMACOES_MODULO6 = [
  'Entendi que toda operação articula receita, custo, funding, margem, prazo e risco.',
  'Reconheço o que pode “matar” uma operação: baixa liquidez, custo elevado, margem baixa, VGV emocional e funding insuficiente.',
  'Sei que produto experimental, excesso de ticket, mercado saturado e prazo elevado aumentam o risco financeiro.',
] as const;

const CONFIRMACOES_MODULO7 = [
  'Identifiquei os cinco tipos de risco (mercado, financeiro, operacional, jurídico e liquidez) e o que cada um implica na prática.',
  'Reconheço que risco de mercado e de liquidez estão ligados à absorção, ao produto e ao ticket.',
  'Assumo que mitigar risco exige validação com dados, governança e disciplina — não apenas otimismo.',
] as const;

const CONFIRMACOES_MODULO8 = [
  'Entendi o que a Moní não busca: volume sem qualidade, operação emocional e crescimento sem validação.',
  'Assumo os pilares desejados: previsibilidade, inteligência, padronização, liquidez e controle de risco.',
  'Comprometo-me com validar antes de avançar, comparar antes de decidir, estruturar antes de negociar e reduzir risco antes de escalar.',
] as const;

const CONFIRMACOES_MODULO9 = [
  'Li a jornada operacional completa do Step One até a Liquidação.',
  'Entendo o papel de cada etapa na sequência, incluindo Pré-obra entre Contrato e Operação.',
  'Reconheço que o avanço depende de conclusão e registro das fases anteriores no fluxo Moní.',
] as const;

function ChecklistTriploModulo({
  itemId,
  statusServidor,
  confirmacoes,
  userId,
  updateItem,
}: {
  itemId: 'modulo1' | 'modulo2' | 'modulo3' | 'modulo4' | 'modulo5' | 'modulo6' | 'modulo7' | 'modulo8' | 'modulo9';
  statusServidor: Casa1ItemStatus | undefined;
  confirmacoes: readonly [string, string, string];
  userId: string;
  updateItem: (itemId: string, status: Casa1ItemStatus) => Promise<void>;
}) {
  const [checks, setChecks] = useState(() => [false, false, false] as [boolean, boolean, boolean]);

  useEffect(() => {
    if (statusServidor === 'concluido') {
      setChecks([true, true, true]);
    }
  }, [statusServidor]);

  function aplicarProgresso(next: [boolean, boolean, boolean]) {
    if (!userId) return;
    const all = next.every(Boolean);
    const some = next.some(Boolean);
    const status: Casa1ItemStatus = all ? 'concluido' : some ? 'em_andamento' : 'pendente';
    void updateItem(itemId, status);
  }

  function toggle(idx: number) {
    if (!userId) return;
    const next: [boolean, boolean, boolean] = [
      idx === 0 ? !checks[0] : checks[0],
      idx === 1 ? !checks[1] : checks[1],
      idx === 2 ? !checks[2] : checks[2],
    ];
    setChecks(next);
    aplicarProgresso(next);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5">
      <h4 className="text-sm font-semibold tracking-tight text-slate-900">Checklist de conclusão</h4>
      <p className="mt-1 text-xs text-slate-600">Marque os três itens para registrar o módulo como concluído no Hub.</p>
      <ul className="mt-4 space-y-3" role="list">
        {confirmacoes.map((texto, i) => (
          <li key={i}>
            <label
              className={clsx(
                'flex cursor-pointer gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-colors',
                !userId && 'cursor-not-allowed opacity-60',
              )}
            >
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                checked={checks[i]}
                disabled={!userId}
                onChange={() => toggle(i)}
              />
              <span className="text-sm leading-snug text-slate-800">{texto}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Modulo1Incorporacao({
  userId,
  statusModulo,
  updateItem,
}: {
  userId: string;
  statusModulo: Casa1ItemStatus | undefined;
  updateItem: (itemId: string, status: Casa1ItemStatus) => Promise<void>;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold tracking-tight text-slate-900">Módulo 1 — O que é incorporação residencial</h3>

      <section>
        <h4 className={sectionTitle}>Definição</h4>
        <p className={proseP}>
          Incorporação é o processo de estruturar, desenvolver e comercializar um empreendimento imobiliário. Envolve:
        </p>
        <ul className={proseList}>
          <li>Terreno e viabilidade do lote</li>
          <li>Produto (tipologia, padrão, aderência de mercado)</li>
          <li>Estrutura financeira e funding</li>
          <li>Aprovações (condomínio, prefeitura, compliance)</li>
          <li>Execução da obra e cronograma</li>
          <li>Venda e absorção</li>
          <li>Liquidação e encerramento da operação</li>
        </ul>
      </section>

      <section>
        <h4 className={sectionTitle}>Onde a Moní atua</h4>
        <p className={proseP}>
          A Moní atua em <strong className="font-semibold text-slate-900">incorporação residencial unifamiliar de alto padrão</strong>
          — casas dentro de condomínios fechados, com foco em operação disciplinada e hipótese testável.
        </p>
      </section>

      <section>
        <h4 className={sectionTitle}>Por que “casa” é diferente</h4>
        <ul className={proseList}>
          <li>Menor escala que torres — cada unidade concentra mais risco unitário</li>
          <li>Ticket elevado — sensibilidade a financiamento, entrada e perfil do comprador</li>
          <li>Liquidez mais sensível — poucas unidades para “amortizar” desvios de mercado</li>
          <li>Forte impacto do lote, frente, topografia, implantação e vista na percepção de valor</li>
        </ul>
      </section>

      <section>
        <h4 className={sectionTitle}>Diferença para o vertical (torre)</h4>
        <p className={proseP}>
          No vertical, várias unidades pulverizam risco e permitem ajustes de mix e preço ao longo do cronograma. Na casa,{' '}
          <strong className="font-semibold text-slate-900">uma única unidade sustenta toda a operação</strong>, o que aumenta o
          risco e torna a liquidez e a clareza da hipótese ainda mais críticas.
        </p>
      </section>

      <section>
        <h4 className={sectionTitle}>O que mais impacta uma casa</h4>
        <p className={proseP}>Em ordem prática de leitura de negócio (não exaustiva):</p>
        <ul className={proseList}>
          <li>Lote, frente e topografia</li>
          <li>Implantação e aproveitamento</li>
          <li>Vista e privacidade</li>
          <li>Ticket e produto</li>
          <li>Condomínio e regra de convivência</li>
        </ul>
      </section>

      <section>
        <h4 className={sectionTitle}>O que define uma operação boa</h4>
        <p className={proseP}>
          Não é a mais extravagante — é a <strong className="font-semibold text-slate-900">mais líquida, previsível e segura</strong>,
          com hipótese coerente, margem defendável e caminho claro até a liquidação.
        </p>
      </section>

      <ChecklistTriploModulo
        itemId="modulo1"
        statusServidor={statusModulo}
        confirmacoes={CONFIRMACOES_MODULO1}
        userId={userId}
        updateItem={updateItem}
      />
    </div>
  );
}

function Modulo2Ecossistema({
  userId,
  statusModulo,
  updateItem,
}: {
  userId: string;
  statusModulo: Casa1ItemStatus | undefined;
  updateItem: (itemId: string, status: Casa1ItemStatus) => Promise<void>;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold tracking-tight text-slate-900">Módulo 2 — Como funciona o ecossistema Moní</h3>

      <section>
        <h4 className={sectionTitle}>Áreas integradas</h4>
        <p className={proseP}>O ecossistema é integrado e dividido em áreas com papéis complementares:</p>
        <ul className={proseList}>
          <li>
            <strong className="font-semibold text-slate-900">Franqueado</strong> — inteligência imobiliária, relacionamento local,
            leitura de mercado, mapeamento e construção de hipóteses
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Comitê</strong> — validação estratégica, risco, liquidez, produto,
            margem e aderência ao modelo
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Jurídico</strong> — contratos, diligência, análise documental e
            segurança jurídica
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Crédito</strong> — funding, estrutura financeira, enquadramento e
            análise de risco
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Arquitetura</strong> — implantação, aderência ao lote, compatibilização
            e produto
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Operações</strong> — gestão, cronograma, execução e acompanhamento
          </li>
        </ul>
      </section>

      <section>
        <h4 className={sectionTitle}>Jornada completa</h4>
        <p className={proseP}>
          Pesquisa → Hipótese → Validação → BCA → Comitê → Jurídico → Crédito → Contrato → Operação → Venda → Liquidação
        </p>
        <p className={proseP}>
          Cada etapa alimenta a próxima com evidências e decisões registráveis — o Hub Fly concentra o rastreio do avanço e das
          pendências entre áreas.
        </p>
      </section>

      <ChecklistTriploModulo
        itemId="modulo2"
        statusServidor={statusModulo}
        confirmacoes={CONFIRMACOES_MODULO2}
        userId={userId}
        updateItem={updateItem}
      />
    </div>
  );
}

function Modulo3ModelosNegocio({
  userId,
  statusModulo,
  updateItem,
}: {
  userId: string;
  statusModulo: Casa1ItemStatus | undefined;
  updateItem: (itemId: string, status: Casa1ItemStatus) => Promise<void>;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold tracking-tight text-slate-900">Módulo 3 — Modelos de negócio</h3>
      <p className="rounded-lg border border-sky-100 bg-sky-50/80 px-3 py-2 text-xs leading-relaxed text-sky-950">
        Este módulo traz um <strong className="font-semibold">resumo</strong> dos modelos. O detalhamento completo fica na aba{' '}
        <strong className="font-semibold">Modelos de negócio</strong>.
      </p>

      <section>
        <h4 className={sectionTitle}>Os três modelos</h4>
        <ul className={proseList}>
          <li>
            <strong className="font-semibold text-slate-900">Permuta total</strong>
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Permuta parcial</strong>
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Compra e venda</strong>
          </li>
        </ul>
      </section>

      <section>
        <h4 className={sectionTitle}>Permuta total</h4>
        <p className={proseP}>
          O terrenista cede o lote e recebe <strong className="font-semibold text-slate-900">participação financeira futura</strong>{' '}
          na operação.
        </p>
        <p className={proseP}>
          <strong className="font-semibold text-slate-900">Vantagens:</strong> menor desembolso inicial, menor pressão de caixa no
          curto prazo, maior alavancagem quando a hipótese de liquidez é sólida.
        </p>
        <p className={proseP}>
          <strong className="font-semibold text-slate-900">Desafios:</strong> negociação mais complexa, exige confiança e alinhamento
          de longo prazo, e <strong className="font-semibold text-slate-900">exige liquidez forte</strong> para cumprir a expectativa do
          terrenista.
        </p>
        <p className={proseP}>
          <strong className="font-semibold text-slate-900">Usar em:</strong> operações líquidas, condomínios fortes, proprietário com
          perfil de investidor e leitura de risco equilibrada.
        </p>
        <p className={proseP}>
          <strong className="font-semibold text-slate-900">Não usar quando:</strong> baixa liquidez, operação fraca, mercado lento ou
          hipótese ainda não validada com dados de praça.
        </p>
      </section>

      <section>
        <h4 className={sectionTitle}>Permuta parcial</h4>
        <p className={proseP}>
          Combina <strong className="font-semibold text-slate-900">parte financeira (caixa)</strong> com{' '}
          <strong className="font-semibold text-slate-900">parte em participação</strong> (alinhamento de upside com o terrenista).
        </p>
        <p className={proseP}>
          <strong className="font-semibold text-slate-900">Vantagens:</strong> reduz objeção do terrenista e flexibiliza a negociação
          quando há sensibilidade ao preço do lote.
        </p>
        <p className={proseP}>
          <strong className="font-semibold text-slate-900">Desafios:</strong> aumenta a necessidade de caixa e exige disciplina no
          fechamento do mix financeiro + participação.
        </p>
      </section>

      <section>
        <h4 className={sectionTitle}>Compra e venda</h4>
        <p className={proseP}>
          Aquisição <strong className="font-semibold text-slate-900">integral</strong> do terreno pela estrutura da operação.
        </p>
        <p className={proseP}>
          <strong className="font-semibold text-slate-900">Vantagens:</strong> simplicidade contratual, maior controle do lote e
          previsibilidade de encadeamento (menos variáveis de permuta).
        </p>
        <p className={proseP}>
          <strong className="font-semibold text-slate-900">Desafios:</strong> maior necessidade de funding e maior exposição ao risco
          de aquisição — o caixa entra mais cedo.
        </p>
        <p className={proseP}>
          <strong className="font-semibold text-slate-900">Atenção:</strong> compra e venda{' '}
          <strong className="font-semibold text-slate-900">não significa</strong> operação melhor por si só — o modelo precisa
          conversar com liquidez, margem e velocidade.
        </p>
      </section>

      <section>
        <h4 className={sectionTitle}>Como a Moní escolhe</h4>
        <p className={proseP}>A escolha do modelo considera, entre outros fatores:</p>
        <ul className={proseList}>
          <li>Liquidez e absorção da praça</li>
          <li>Risco da operação e da hipótese</li>
          <li>Funding disponível e custo do capital</li>
          <li>Perfil e expectativa do terrenista</li>
          <li>Margem e defesa no comitê</li>
          <li>Velocidade para aprovações e comercialização</li>
        </ul>
      </section>

      <ChecklistTriploModulo
        itemId="modulo3"
        statusServidor={statusModulo}
        confirmacoes={CONFIRMACOES_MODULO3}
        userId={userId}
        updateItem={updateItem}
      />
    </div>
  );
}

function Modulo4DecisaoMoni({
  userId,
  statusModulo,
  updateItem,
}: {
  userId: string;
  statusModulo: Casa1ItemStatus | undefined;
  updateItem: (itemId: string, status: Casa1ItemStatus) => Promise<void>;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold tracking-tight text-slate-900">Módulo 4 — Como a Moní toma decisão</h3>

      <section>
        <h4 className={sectionTitle}>O que a Moní não usa como base de decisão</h4>
        <ul className={proseList}>
          <li>Emoção ou “achismo” sem dado de mercado</li>
          <li>Arquitetura isolada, desconectada de absorção e ticket</li>
          <li>Gosto pessoal em detrimento de liquidez e margem</li>
          <li>Expectativa sem validação (BCA, praça, comitê, diligência)</li>
        </ul>
      </section>

      <section>
        <h4 className={sectionTitle}>O que a Moní prioriza</h4>
        <ul className={proseList}>
          <li>
            <strong className="font-semibold text-slate-900">Liquidez</strong> — caminho real até venda e liquidação
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Previsibilidade</strong> — premissas testáveis e cenários coerentes
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Margem saudável</strong> — defensável no comitê e no stress de mercado
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Velocidade</strong> — aprovações, obra e comercialização alinhadas ao
            risco
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Segurança operacional</strong> — execução, compliance e governança
          </li>
        </ul>
      </section>

      <section>
        <h4 className={sectionTitle}>Beleza vs. melhor operação</h4>
        <p className={proseP}>
          A operação <strong className="font-semibold text-slate-900">mais bonita não é sempre a melhor operação</strong>. O produto
          precisa ser desejável, mas a decisão ancora em retorno, risco e liquidez — não em estética isolada.
        </p>
      </section>

      <section>
        <h4 className={sectionTitle}>O que mais importa</h4>
        <p className={proseP}>
          Em síntese: <strong className="font-semibold text-slate-900">localização + produto + preço + liquidez</strong>. Quando esses
          quatro conversam, a hipótese fica mais clara para o comitê, para o crédito e para a operação.
        </p>
      </section>

      <ChecklistTriploModulo
        itemId="modulo4"
        statusServidor={statusModulo}
        confirmacoes={CONFIRMACOES_MODULO4}
        userId={userId}
        updateItem={updateItem}
      />
    </div>
  );
}

function Modulo5LiquidezMercado({
  userId,
  statusModulo,
  updateItem,
}: {
  userId: string;
  statusModulo: Casa1ItemStatus | undefined;
  updateItem: (itemId: string, status: Casa1ItemStatus) => Promise<void>;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold tracking-tight text-slate-900">Módulo 5 — Liquidez e leitura de mercado</h3>

      <section>
        <h4 className={sectionTitle}>O que aumenta liquidez</h4>
        <ul className={proseList}>
          <li>
            <strong className="font-semibold text-slate-900">Produto aderente</strong> — tipologia e padrão que a praça compra com
            previsibilidade
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Ticket correto</strong> — alinhado à renda, ao financiamento e à
            absorção do condomínio
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Condomínio saudável</strong> — demanda, reputação e regras compatíveis
            com o produto
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Estoque baixo</strong> — pouca oferta competindo com o mesmo perfil no
            mesmo recorte de preço
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Boa implantação</strong> — aproveitamento do lote sem “matar” a
            percepção de valor
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Frente valorizada</strong> — entrada, privacidade e leitura de fachada
            coerentes com o ticket
          </li>
        </ul>
      </section>

      <section>
        <h4 className={sectionTitle}>O que reduz liquidez</h4>
        <ul className={proseList}>
          <li>Excesso de área ou planta desalinhada da demanda</li>
          <li>Excesso de ticket para a praça e para o condomínio</li>
          <li>Produto incompatível com o perfil de comprador do empreendimento</li>
          <li>Lote ruim (topografia, frente, vista, restrições) sem compensação de preço</li>
          <li>Condomínio saturado — muita oferta competindo pelo mesmo comprador</li>
        </ul>
      </section>

      <section>
        <h4 className={sectionTitle}>Sinais de alerta</h4>
        <ul className={proseList}>
          <li>Estoque alto de unidades equivalentes</li>
          <li>Casas paradas ou giro abaixo do esperado para o recorte</li>
          <li>Tempo de venda elevado sem ajuste de hipótese</li>
          <li>Excesso de produto premium sem demanda comprovada</li>
          <li>Preço acima do mercado sem narrativa de valor defendível</li>
        </ul>
      </section>

      <ChecklistTriploModulo
        itemId="modulo5"
        statusServidor={statusModulo}
        confirmacoes={CONFIRMACOES_MODULO5}
        userId={userId}
        updateItem={updateItem}
      />
    </div>
  );
}

function Modulo6EstruturaFinanceira({
  userId,
  statusModulo,
  updateItem,
}: {
  userId: string;
  statusModulo: Casa1ItemStatus | undefined;
  updateItem: (itemId: string, status: Casa1ItemStatus) => Promise<void>;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold tracking-tight text-slate-900">Módulo 6 — Estrutura financeira da operação</h3>

      <section>
        <h4 className={sectionTitle}>Toda operação possui</h4>
        <ul className={proseList}>
          <li>
            <strong className="font-semibold text-slate-900">Receita</strong> — VGV, velocidade de vendas e mix de unidades
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Custo</strong> — obra, terreno, financeiro, marketing e contingências
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Funding</strong> — caixa, crédito, curva de desembolso e travas
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Margem</strong> — espaço para stress e imprevistos sem quebrar a tese
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Prazo</strong> — aprovações, obra, vendas e liquidação
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Risco</strong> — mercado, execução, jurídico e financeiro
          </li>
        </ul>
      </section>

      <section>
        <h4 className={sectionTitle}>O que mata uma operação</h4>
        <ul className={proseList}>
          <li>Baixa liquidez — vendas não sustentam o cronograma de caixa</li>
          <li>Custo elevado — desvio de obra, terreno caro ou estrutura financeira pesada</li>
          <li>Margem baixa — sem colchão para imprevisto ou stress de mercado</li>
          <li>
            <strong className="font-semibold text-slate-900">VGV emocional</strong> — número “bonito” sem lastro em comparáveis e
            absorção
          </li>
          <li>Funding insuficiente — curva de caixa quebra antes da operação amadurecer</li>
        </ul>
      </section>

      <section>
        <h4 className={sectionTitle}>O que aumenta o risco</h4>
        <ul className={proseList}>
          <li>Produto experimental sem evidência de absorção</li>
          <li>Excesso de ticket para o público-alvo do condomínio</li>
          <li>Mercado saturado no mesmo posicionamento</li>
          <li>Prazo elevado — mais tempo expõe mais variáveis (custo, concorrência, juros)</li>
        </ul>
      </section>

      <ChecklistTriploModulo
        itemId="modulo6"
        statusServidor={statusModulo}
        confirmacoes={CONFIRMACOES_MODULO6}
        userId={userId}
        updateItem={updateItem}
      />
    </div>
  );
}

const RISCOS_INCORPORACAO = [
  {
    id: 'mercado',
    titulo: 'Risco de mercado',
    descricao: 'O mercado pode não absorver o produto no mix, ticket e condomínio previstos — demanda insuficiente ou desalinhada.',
  },
  {
    id: 'financeiro',
    titulo: 'Risco financeiro',
    descricao: 'Funding insuficiente ou curva de caixa que não suporta desembolsos, juros e imprevistos até a liquidação.',
  },
  {
    id: 'operacional',
    titulo: 'Risco operacional',
    descricao: 'Erros de execução em obra, prazos, fornecedores ou gestão — impacto direto em custo e reputação.',
  },
  {
    id: 'juridico',
    titulo: 'Risco jurídico',
    descricao: 'Problemas documentais, restrições de lote, condomínio ou contratos que atrasam ou inviabilizam a operação.',
  },
  {
    id: 'liquidez',
    titulo: 'Risco de liquidez',
    descricao: 'O produto não vende no ritmo esperado — estoque parado, pressão de caixa e deterioração da hipótese.',
  },
] as const;

function RiscoIncorporacaoCard({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <article className="flex gap-3 rounded-xl border border-amber-200/90 bg-amber-50/50 p-4 shadow-sm">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800"
        aria-hidden
      >
        <AlertTriangle className="h-5 w-5" strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <h4 className="text-sm font-semibold tracking-tight text-amber-950">{titulo}</h4>
        <p className="mt-1 text-xs leading-relaxed text-amber-950/90 sm:text-sm">{descricao}</p>
      </div>
    </article>
  );
}

function Modulo7RiscosIncorporacao({
  userId,
  statusModulo,
  updateItem,
}: {
  userId: string;
  statusModulo: Casa1ItemStatus | undefined;
  updateItem: (itemId: string, status: Casa1ItemStatus) => Promise<void>;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold tracking-tight text-slate-900">Módulo 7 — Riscos da incorporação</h3>
      <p className="text-sm leading-relaxed text-slate-600">
        Cada risco abaixo representa uma família de ameaças à tese — o franqueado precisa reconhecê-las cedo e mitigar com dado,
        processo e governança.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {RISCOS_INCORPORACAO.map((r) => (
          <RiscoIncorporacaoCard key={r.id} titulo={r.titulo} descricao={r.descricao} />
        ))}
      </div>
      <ChecklistTriploModulo
        itemId="modulo7"
        statusServidor={statusModulo}
        confirmacoes={CONFIRMACOES_MODULO7}
        userId={userId}
        updateItem={updateItem}
      />
    </div>
  );
}

function Modulo8MentalidadeOperacional({
  userId,
  statusModulo,
  updateItem,
}: {
  userId: string;
  statusModulo: Casa1ItemStatus | undefined;
  updateItem: (itemId: string, status: Casa1ItemStatus) => Promise<void>;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold tracking-tight text-slate-900">Módulo 8 — Mentalidade operacional Moní</h3>

      <section>
        <h4 className={sectionTitle}>A Moní não busca</h4>
        <ul className={proseList}>
          <li>
            <strong className="font-semibold text-slate-900">Volume sem qualidade</strong> — crescimento de pipeline sem lastro em
            liquidez e margem
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Operação emocional</strong> — decisões por impressão ou apego sem
            validação no BCA e na praça
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Crescimento sem validação</strong> — escalar hipóteses antes de
            comprovar absorção e execução
          </li>
        </ul>
      </section>

      <section>
        <h4 className={sectionTitle}>A Moní busca</h4>
        <ul className={proseList}>
          <li>
            <strong className="font-semibold text-slate-900">Previsibilidade</strong> — premissas claras e cenários defendíveis
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Inteligência</strong> — dados de mercado, comparáveis e disciplina de
            registro
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Padronização</strong> — processos repetíveis, checklists e trilha no Hub
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Liquidez</strong> — foco em venda real, prazo e absorção
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Controle de risco</strong> — freios no comitê, crédito e jurídico antes
            de comprometer caixa
          </li>
        </ul>
      </section>

      <section>
        <h4 className={sectionTitle}>Mentalidade correta</h4>
        <ul className={proseList}>
          <li>
            <strong className="font-semibold text-slate-900">Validar antes de avançar</strong> — não pular etapas da hipótese e da
            diligência
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Comparar antes de decidir</strong> — concorrência, ticket e estoque no
            recorte certo
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Estruturar antes de negociar</strong> — pacote financeiro e jurídico
            coerentes com o risco
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Reduzir risco antes de escalar</strong> — margem e funding com colchão
            para imprevisto
          </li>
        </ul>
      </section>

      <ChecklistTriploModulo
        itemId="modulo8"
        statusServidor={statusModulo}
        confirmacoes={CONFIRMACOES_MODULO8}
        userId={userId}
        updateItem={updateItem}
      />
    </div>
  );
}

const JORNADA_OPERACIONAL_ETAPAS = [
  {
    nome: 'Step One',
    descricao: 'Mapeamento da região, lote e inteligência comercial para estruturar o negócio com evidência.',
  },
  {
    nome: 'Hipótese',
    descricao: 'Premissas testáveis de produto, ticket e liquidez alinhadas ao que a praça compra.',
  },
  { nome: 'BCA', descricao: 'Business case com planta, target e liquidação coerentes e defendíveis.' },
  { nome: 'Comitê', descricao: 'Validação estratégica de risco, margem, produto e aderência ao modelo Moní.' },
  { nome: 'Jurídico', descricao: 'Contratos, diligência documental e segurança jurídica do pacote.' },
  { nome: 'Crédito', descricao: 'Funding, enquadramento financeiro e análise de risco de crédito.' },
  { nome: 'Contrato', descricao: 'Fechamento negocial e formalização das obrigações entre as partes.' },
  { nome: 'Pré-obra', descricao: 'Compatibilização, aprovações e preparação antes do início efetivo da obra.' },
  { nome: 'Operação', descricao: 'Gestão de cronograma, custo, qualidade e fornecedores no canteiro.' },
  { nome: 'Venda', descricao: 'Comercialização, financiamento do comprador e giro até a baixa das unidades.' },
  { nome: 'Liquidação', descricao: 'Encerramento financeiro e operacional com entregas e contas quitadas.' },
] as const;

function JornadaOperacionalTimeline() {
  const total = JORNADA_OPERACIONAL_ETAPAS.length;
  return (
    <div className="relative mt-2" role="list" aria-label="Jornada operacional completa">
      {JORNADA_OPERACIONAL_ETAPAS.map((etapa, i) => {
        const isLast = i === total - 1;
        return (
          <div key={etapa.nome} className="relative flex gap-4" role="listitem">
            <div className="flex w-11 shrink-0 flex-col items-center">
              <div
                className="z-[1] flex h-9 w-9 items-center justify-center rounded-full border-2 border-amber-400 bg-white text-[11px] font-bold text-amber-950 shadow-sm"
                aria-hidden
              >
                {i + 1}
              </div>
              {!isLast ? (
                <div className="min-h-[1.25rem] w-0.5 flex-1 bg-gradient-to-b from-amber-300 to-amber-100" aria-hidden />
              ) : null}
            </div>
            <div className={clsx('min-w-0 flex-1 border-b border-slate-100 pb-6', isLast && 'border-b-0 pb-0')}>
              <p className="text-sm font-semibold text-slate-900">{etapa.nome}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 sm:text-sm">{etapa.descricao}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Modulo9JornadaOperacional({
  userId,
  statusModulo,
  updateItem,
}: {
  userId: string;
  statusModulo: Casa1ItemStatus | undefined;
  updateItem: (itemId: string, status: Casa1ItemStatus) => Promise<void>;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold tracking-tight text-slate-900">Módulo 9 — Jornada operacional completa</h3>
      <p className="text-sm leading-relaxed text-slate-600">
        Da captação à liquidação, cada etapa prepara a próxima — a timeline resume a ordem oficial da operação Moní.
      </p>
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
        <JornadaOperacionalTimeline />
      </div>
      <ChecklistTriploModulo
        itemId="modulo9"
        statusServidor={statusModulo}
        confirmacoes={CONFIRMACOES_MODULO9}
        userId={userId}
        updateItem={updateItem}
      />
    </div>
  );
}

const UI = {
  tabIntro: 'text-sm leading-relaxed text-slate-600',
  tabNav:
    'grid grid-cols-2 gap-x-0.5 gap-y-0 border-b border-slate-200 sm:grid-cols-3 lg:grid-cols-5',
  tabBtn:
    'w-full rounded-t-lg px-2 py-2 text-center text-xs font-medium transition-colors duration-200 min-[900px]:px-2.5 min-[900px]:text-sm',
  tabBtnActive: 'border-b-2 border-emerald-600 bg-emerald-50 text-emerald-900',
  tabBtnIdle: 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
  panel: 'min-h-[280px] rounded-b-xl rounded-tr-xl border border-t-0 border-slate-200 bg-white p-5 shadow-sm sm:p-6',
};

const TABS = [
  { id: 'modulos', label: 'Módulos' },
  { id: 'glossario', label: 'Glossário' },
  { id: 'modelos', label: 'Modelos de negócio' },
  { id: 'cenarios', label: 'Cenários' },
  { id: 'quiz', label: 'Quiz' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const MODULOS = Array.from({ length: 12 }, (_, i) => {
  const n = i + 1;
  return { id: `modulo${n}` as const, label: `Módulo ${n}` };
});

const GLOSSARIO_ITENS: readonly { termo: string; definicao: string }[] = [
  { termo: 'VGV', definicao: 'Valor Geral de Vendas — valor esperado de venda da operação.' },
  {
    termo: 'VGV Target',
    definicao:
      'Preço ideal de venda com velocidade saudável e margem sustentável. Meta mínima: %VGV ≥ 10%.',
  },
  { termo: 'VGV Planta', definicao: 'Venda realizada durante a obra.' },
  { termo: 'VGV Liquidação', definicao: 'Venda com desconto em cenário de saída acelerada.' },
  {
    termo: 'BCA',
    definicao: 'Business Case Analysis — simulador operacional que valida operação, margem, liquidez e risco.',
  },
  { termo: 'Liquidez', definicao: 'Capacidade real de venda em prazo saudável.' },
  { termo: 'Giro', definicao: 'Velocidade de absorção do produto. Alto giro = venda rápida.' },
  {
    termo: 'Absorção',
    definicao: 'Quantidade de produtos vendidos pelo mercado em determinado período.',
  },
  {
    termo: 'Funding',
    definicao: 'Capital necessário para terreno, aprovações, projetos, obra e operação.',
  },
  { termo: 'Permuta', definicao: 'Troca entre terreno e participação financeira.' },
  {
    termo: 'Permuta total',
    definicao:
      'Terrenista recebe % do VGV líquido. Desembolso inicial zero. Atenção: 30% do lote NÃO significa 30% do VGV — a equivalência depende do múltiplo, da margem e da estrutura.',
  },
  {
    termo: 'Permuta parcial',
    definicao: 'Parte financeira + parte em permuta.',
  },
  {
    termo: 'Compra e venda',
    definicao: 'Terreno adquirido integralmente. Maior necessidade de caixa e funding.',
  },
  {
    termo: 'SPE',
    definicao: 'Sociedade de Propósito Específico — empresa criada apenas para aquela operação para isolar risco.',
  },
  {
    termo: 'Due Diligence',
    definicao: 'Processo de investigação jurídica, documental, operacional e financeira.',
  },
  {
    termo: 'Acoplamento',
    definicao: 'Processo de adaptação do produto ao lote específico.',
  },
  {
    termo: 'Gadgets',
    definicao:
      'Itens tecnológicos e diferenciais — automação, segurança, climatização, tecnologia embarcada.',
  },
  {
    termo: 'Ticket médio',
    definicao: 'Faixa média de valor das casas daquela região.',
  },
  {
    termo: 'TIR',
    definicao: 'Taxa Interna de Retorno — retorno percentual da operação.',
  },
];

function GlossarioTabContent() {
  const [busca, setBusca] = useState('');
  const q = busca.trim().toLowerCase();
  const filtrados =
    q === ''
      ? GLOSSARIO_ITENS
      : GLOSSARIO_ITENS.filter(
          (item) =>
            item.termo.toLowerCase().includes(q) || item.definicao.toLowerCase().includes(q),
        );

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold tracking-tight text-slate-900">Glossário</h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          Termos frequentes na operação Moní. Use a busca para localizar siglas e conceitos.
        </p>
      </div>

      <div className="relative">
        <label htmlFor="casa1-glossario-busca" className="sr-only">
          Buscar no glossário
        </label>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          strokeWidth={2}
          aria-hidden
        />
        <input
          id="casa1-glossario-busca"
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por termo ou definição…"
          autoComplete="off"
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
      </div>

      {filtrados.length === 0 ? (
        <p className="rounded-lg border border-amber-100 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
          Nenhum termo encontrado para &quot;{busca.trim()}&quot;.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((item) => (
            <article
              key={item.termo}
              className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <h4 className="text-sm font-semibold tracking-tight text-emerald-900">{item.termo}</h4>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.definicao}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

const MODELOS_SUBTABS = [
  { id: 'permuta-total', label: 'Permuta total' },
  { id: 'permuta-parcial', label: 'Permuta parcial' },
  { id: 'compra-venda', label: 'Compra e venda' },
] as const;

type ModeloSubtabId = (typeof MODELOS_SUBTABS)[number]['id'];

function ModelosNegocioTabContent() {
  const [subTab, setSubTab] = useState<ModeloSubtabId>('permuta-total');

  function renderSubconteudo() {
    switch (subTab) {
      case 'permuta-total':
        return (
          <div className="space-y-6">
            <section>
              <h4 className={sectionTitle}>Como funciona</h4>
              <p className={proseP}>
                O terrenista cede o lote e recebe <strong className="font-semibold text-slate-900">participação financeira futura</strong>{' '}
                no <strong className="font-semibold text-slate-900">VGV líquido</strong>. Desembolso inicial zero.
              </p>
            </section>
            <div
              className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm leading-relaxed text-amber-950 shadow-sm"
              role="note"
            >
              <p className="font-semibold text-amber-950">Alerta</p>
              <p className="mt-1">
                30% do lote <strong className="font-semibold">NÃO</strong> significa 30% do VGV — a equivalência depende do{' '}
                <strong className="font-semibold text-slate-900">múltiplo</strong>, da <strong className="font-semibold text-slate-900">margem</strong> e da{' '}
                <strong className="font-semibold text-slate-900">estrutura</strong> da operação.
              </p>
            </div>
            <section>
              <h4 className={sectionTitle}>Vantagens</h4>
              <ul className={proseList}>
                <li>Menor desembolso inicial</li>
                <li>Menor pressão financeira no curto prazo</li>
                <li>Maior alavancagem quando a hipótese de liquidez é sólida</li>
              </ul>
            </section>
            <section>
              <h4 className={sectionTitle}>Desafios</h4>
              <ul className={proseList}>
                <li>Negociação complexa</li>
                <li>Exige confiança e alinhamento de longo prazo entre as partes</li>
                <li>Exige liquidez forte para cumprir expectativas do terrenista</li>
              </ul>
            </section>
            <section>
              <h4 className={sectionTitle}>Usar quando</h4>
              <ul className={proseList}>
                <li>Operações líquidas e com hipótese defendível</li>
                <li>Condomínios fortes e com demanda comprovada</li>
                <li>Proprietário com perfil de investidor e apetite a participação</li>
              </ul>
            </section>
            <section>
              <h4 className={sectionTitle}>Não usar quando</h4>
              <ul className={proseList}>
                <li>Baixa liquidez ou absorção incerta</li>
                <li>Operação fraca ou hipótese ainda não validada</li>
                <li>Mercado lento — risco de alongar prazos e tensionar a permuta</li>
              </ul>
            </section>
          </div>
        );
      case 'permuta-parcial':
        return (
          <div className="space-y-6">
            <section>
              <h4 className={sectionTitle}>Como funciona</h4>
              <p className={proseP}>
                Parte do acordo é paga <strong className="font-semibold text-slate-900">financeiramente</strong> (caixa) e parte em{' '}
                <strong className="font-semibold text-slate-900">participação</strong> no resultado da operação — equilíbrio entre
                entrada de terrenista e necessidade de capital.
              </p>
            </section>
            <section>
              <h4 className={sectionTitle}>Vantagens</h4>
              <ul className={proseList}>
                <li>Reduz objeção e insegurança do terrenista frente a uma permuta 100% futura</li>
                <li>Flexibiliza a negociação quando há sensibilidade ao “preço do lote” em caixa</li>
              </ul>
            </section>
            <section>
              <h4 className={sectionTitle}>Desafios</h4>
              <ul className={proseList}>
                <li>Aumenta a necessidade de caixa em relação à permuta total</li>
                <li>Maior pressão financeira no desenho da curva de desembolso</li>
              </ul>
            </section>
          </div>
        );
      case 'compra-venda':
        return (
          <div className="space-y-6">
            <section>
              <h4 className={sectionTitle}>Como funciona</h4>
              <p className={proseP}>
                Aquisição <strong className="font-semibold text-slate-900">integral</strong> do terreno pela estrutura da operação —
                o lote entra no balanço do projeto com preço e condições fechados em contrato.
              </p>
            </section>
            <section>
              <h4 className={sectionTitle}>Vantagens</h4>
              <ul className={proseList}>
                <li>Simplicidade negocial e menor variável de permuta</li>
                <li>Maior controle sobre o lote e encadeamento de etapas</li>
                <li>Previsibilidade jurídica quando bem diligenciada</li>
              </ul>
            </section>
            <section>
              <h4 className={sectionTitle}>Desafios</h4>
              <ul className={proseList}>
                <li>Maior necessidade de funding e de caixa no início</li>
                <li>Maior exposição financeira até a comercialização amortizar o investimento</li>
              </ul>
            </section>
            <div
              className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm leading-relaxed text-amber-950 shadow-sm"
              role="note"
            >
              <p className="font-semibold text-amber-950">Alerta</p>
              <p className="mt-1">
                Compra e venda <strong className="font-semibold">não significa</strong> operação melhor — o modelo precisa ser coerente
                com liquidez, margem, velocidade e risco.
              </p>
            </div>
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold tracking-tight text-slate-900">Modelos de negócio</h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          Três formas típicas de estruturar o terreno na operação Moní. O resumo também aparece no Módulo 3; aqui você aprofunda cada
          modelo.
        </p>
      </div>

      <nav
        className="flex flex-wrap gap-1 border-b border-slate-200 pb-0.5"
        role="tablist"
        aria-label="Modelos de negócio"
      >
        {MODELOS_SUBTABS.map((t) => {
          const active = t.id === subTab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`casa1-modelo-panel-${t.id}`}
              id={`casa1-modelo-tab-${t.id}`}
              onClick={() => setSubTab(t.id)}
              className={clsx(
                'rounded-t-lg px-3 py-2 text-xs font-medium transition-colors sm:text-sm',
                active
                  ? 'border-b-2 border-emerald-600 bg-emerald-50 text-emerald-900'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
              )}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      <div
        id={`casa1-modelo-panel-${subTab}`}
        role="tabpanel"
        aria-labelledby={`casa1-modelo-tab-${subTab}`}
        className="min-h-[12rem]"
      >
        {renderSubconteudo()}
      </div>

      <div
        className="rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-4 text-sm font-medium leading-snug text-emerald-950 shadow-sm"
        role="status"
      >
        A Moní escolhe o modelo com base em: liquidez, risco, funding, perfil do terrenista, margem, velocidade e absorção.
      </div>
    </div>
  );
}

function CenariosTabContent({
  userId,
  statusCenarios,
  updateItem,
}: {
  userId: string;
  statusCenarios: Casa1ItemStatus | undefined;
  updateItem: (itemId: string, status: Casa1ItemStatus) => Promise<void>;
}) {
  const [c1Escolha, setC1Escolha] = useState<'A' | 'B' | null>(null);
  const [c2Revelado, setC2Revelado] = useState(false);
  const [c3Revelado, setC3Revelado] = useState(false);
  const autoConcluiuRef = useRef(false);

  useEffect(() => {
    if (statusCenarios === 'concluido') {
      setC1Escolha('B');
      setC2Revelado(true);
      setC3Revelado(true);
    }
  }, [statusCenarios]);

  const c1Completo = c1Escolha !== null;
  const todosRevelados = c1Completo && c2Revelado && c3Revelado;

  useEffect(() => {
    if (!userId || statusCenarios === 'concluido') return;
    if (!todosRevelados || autoConcluiuRef.current) return;
    autoConcluiuRef.current = true;
    void updateItem('cenarios', 'concluido');
  }, [userId, statusCenarios, todosRevelados, updateItem]);

  const cardShell = 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm';

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold tracking-tight text-slate-900">Cenários</h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          Três situações guiadas. Escolha ou revele a resposta em cada uma; ao concluir as três, o progresso da Casa 1 é atualizado
          automaticamente.
        </p>
        {!userId ? (
          <p className="mt-2 text-xs font-medium text-amber-800">
            Faça login para registrar a conclusão dos cenários no Hub.
          </p>
        ) : null}
      </div>

      <section className={cardShell} aria-labelledby="cenario-1-titulo">
        <p id="cenario-1-titulo" className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Cenário 1
        </p>
        <p className="mt-2 text-sm font-medium text-slate-900">
          <span className="text-slate-500">Contexto:</span> Condomínio com estoque alto. Ticket de R$ 5M.
        </p>
        <p className="mt-3 text-sm font-medium text-slate-900">
          <span className="text-slate-500">Pergunta:</span> Qual estratégia possui menor risco?
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={!userId || c1Escolha !== null}
            onClick={() => userId && setC1Escolha('A')}
            className={clsx(
              'flex-1 rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors',
              c1Escolha === 'A'
                ? 'border-amber-300 bg-amber-50 text-amber-950'
                : 'border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-300',
              (!userId || c1Escolha !== null) && c1Escolha !== 'A' && 'opacity-50',
            )}
          >
            <span className="font-semibold text-emerald-800">A</span> — Casa 700m²
          </button>
          <button
            type="button"
            disabled={!userId || c1Escolha !== null}
            onClick={() => userId && setC1Escolha('B')}
            className={clsx(
              'flex-1 rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors',
              c1Escolha === 'B'
                ? 'border-emerald-400 bg-emerald-50 text-emerald-950'
                : 'border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-300',
              (!userId || c1Escolha !== null) && c1Escolha !== 'B' && 'opacity-50',
            )}
          >
            <span className="font-semibold text-emerald-800">B</span> — Casa líquida 450m²
          </button>
        </div>
        {c1Completo ? (
          <div
            className={clsx(
              'mt-4 rounded-lg border px-4 py-3 text-sm leading-relaxed',
              c1Escolha === 'B'
                ? 'border-emerald-200 bg-emerald-50/90 text-emerald-950'
                : 'border-amber-200 bg-amber-50/90 text-amber-950',
            )}
            role="region"
            aria-label="Explicação do cenário 1"
          >
            <p className="font-semibold">Explicação</p>
            <p className="mt-1">
              Em cenário de estoque alto e ticket elevado, o produto mais enxuto e líquido reduz o risco de não absorção pelo
              mercado.
            </p>
            {c1Escolha === 'A' ? (
              <p className="mt-2 text-xs font-medium">A opção correta era a B — maior área e ticket elevado agravam o risco de giro.</p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className={cardShell} aria-labelledby="cenario-2-titulo">
        <p id="cenario-2-titulo" className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Cenário 2
        </p>
        <p className="mt-2 text-sm font-medium text-slate-900">
          <span className="text-slate-500">Contexto:</span> Lote com frente estreita.
        </p>
        <p className="mt-3 text-sm font-medium text-slate-900">
          <span className="text-slate-500">Pergunta:</span> Qual cuidado operacional é necessário?
        </p>
        {!c2Revelado ? (
          <button
            type="button"
            disabled={!userId}
            onClick={() => userId && setC2Revelado(true)}
            className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Ver resposta
          </button>
        ) : (
          <div
            className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm leading-relaxed text-emerald-950"
            role="region"
            aria-label="Resposta do cenário 2"
          >
            <p className="font-semibold">Resposta</p>
            <p className="mt-1">
              Evitar implantação excessivamente horizontal — a frente estreita limita a fachada e pode comprometer a percepção de
              valor do produto.
            </p>
          </div>
        )}
      </section>

      <section className={cardShell} aria-labelledby="cenario-3-titulo">
        <p id="cenario-3-titulo" className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Cenário 3
        </p>
        <p className="mt-2 text-sm font-medium text-slate-900">
          <span className="text-slate-500">Contexto:</span> Mercado com baixa absorção.
        </p>
        <p className="mt-3 text-sm font-medium text-slate-900">
          <span className="text-slate-500">Pergunta:</span> Qual risco aumenta?
        </p>
        {!c3Revelado ? (
          <button
            type="button"
            disabled={!userId}
            onClick={() => userId && setC3Revelado(true)}
            className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Ver resposta
          </button>
        ) : (
          <div
            className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm leading-relaxed text-emerald-950"
            role="region"
            aria-label="Resposta do cenário 3"
          >
            <p className="font-semibold">Resposta</p>
            <p className="mt-1">
              Risco de liquidez — com mercado lento, o produto pode demorar para vender, aumentando custo financeiro e reduzindo
              previsibilidade da operação.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

type QuizLetra = 'A' | 'B' | 'C' | 'D';

type QuizPerguntaDef = {
  pergunta: string;
  opcoes: Record<QuizLetra, string>;
  correta: QuizLetra;
  feedback: string;
};

const QUIZ_CASA1_PERGUNTAS: readonly QuizPerguntaDef[] = [
  {
    pergunta: 'O que é liquidez?',
    opcoes: {
      A: 'O valor total de venda do empreendimento',
      B: 'Capacidade real de venda em prazo saudável',
      C: 'A velocidade de construção da obra',
      D: 'O saldo disponível no caixa da SPE',
    },
    correta: 'B',
    feedback:
      'Liquidez é a capacidade real de converter o produto em venda em prazo saudável — é o principal critério de avaliação de uma operação Moní.',
  },
  {
    pergunta: 'Qual o objetivo do BCA?',
    opcoes: {
      A: 'Gerar o contrato jurídico da operação',
      B: 'Registrar o imóvel em cartório',
      C: 'Simular e validar a operação — margem, liquidez e risco',
      D: 'Calcular apenas o custo da obra',
    },
    correta: 'C',
    feedback:
      'O BCA é o simulador operacional — valida VGV, margem, liquidez e risco antes de qualquer avanço.',
  },
  {
    pergunta: 'O que a Moní prioriza?',
    opcoes: {
      A: 'Volume de operações e crescimento rápido',
      B: 'Produto arquitetonicamente diferenciado',
      C: 'Liquidez, previsibilidade e segurança operacional',
      D: 'Ticket mais alto possível',
    },
    correta: 'C',
    feedback: 'A Moní prioriza operações previsíveis e líquidas — não as mais grandiosas.',
  },
  {
    pergunta: 'Qual o maior erro da incorporação?',
    opcoes: {
      A: 'Escolher condomínio com baixo estoque',
      B: 'Fazer permuta total em vez de compra e venda',
      C: 'Contratar arquitetura antes do BCA',
      D: 'Decisão emocional sem validação de mercado',
    },
    correta: 'D',
    feedback:
      'Decisão emocional sem validação é a principal causa de operações ruins — produto bonito não garante liquidez.',
  },
  {
    pergunta: 'Quando uma operação NÃO deve avançar?',
    opcoes: {
      A: 'Quando o terrenista preferir permuta parcial',
      B: 'Quando o ticket for abaixo de R$ 2M',
      C: 'Quando possuir baixa liquidez e hipótese fraca',
      D: 'Quando o lote tiver topografia irregular',
    },
    correta: 'C',
    feedback:
      'Operações com baixa liquidez e hipótese fraca devem ser descartadas — avançar nelas aumenta risco sem retorno proporcional.',
  },
];

function QuizCasa1PremioDesbloqueio() {
  return (
    <section
      className="rounded-xl border border-emerald-200 bg-emerald-50/90 px-5 py-5 shadow-sm"
      aria-labelledby="quiz-casa1-premio-heading"
    >
      <div className="flex flex-wrap items-center gap-3">
        <CheckCircle className="h-7 w-7 shrink-0 text-emerald-600" strokeWidth={2} aria-hidden />
        <h2 id="quiz-casa1-premio-heading" className="text-base font-semibold tracking-tight text-emerald-950">
          Fundamentos da Incorporação
        </h2>
        <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-800 ring-1 ring-violet-200/80">
          +500 XP
        </span>
      </div>
      <div className="mt-5 flex flex-col gap-3 rounded-lg border border-emerald-200 bg-white px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
          <div className="flex shrink-0 items-center justify-center rounded-lg bg-emerald-100 p-2 text-emerald-800">
            <Unlock className="h-5 w-5" strokeWidth={2} aria-hidden />
          </div>
          <p className="text-sm font-medium leading-snug text-emerald-950">
            Casa 2 desbloqueada — avance para a próxima etapa da jornada
          </p>
        </div>
        <Link
          href="/casa2"
          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
        >
          Ir para a Casa 2 →
        </Link>
      </div>
    </section>
  );
}

function QuizTabContent({
  userId,
  statusQuiz,
  quizScore,
  updateItem,
  updateQuizScore,
}: {
  userId: string;
  statusQuiz: Casa1ItemStatus | undefined;
  quizScore: number;
  updateItem: (itemId: string, status: Casa1ItemStatus) => Promise<void>;
  updateQuizScore: (score: number) => Promise<void>;
}) {
  const [respostas, setRespostas] = useState<(QuizLetra | null)[]>(() => Array.from({ length: 5 }, () => null));
  const [fase, setFase] = useState<'respondendo' | 'resultado'>('respondendo');
  const [ultimoScore, setUltimoScore] = useState<number | null>(null);
  const [ultimoAcertos, setUltimoAcertos] = useState<number | null>(null);
  const [origemResultado, setOrigemResultado] = useState<'local' | 'servidor' | null>(null);

  const todasRespondidas = respostas.every((r) => r !== null);

  useEffect(() => {
    if (fase !== 'respondendo') return;
    if (statusQuiz === 'concluido' && quizScore >= 80) {
      setFase('resultado');
      setUltimoScore(quizScore);
      setUltimoAcertos(Math.min(5, Math.round(quizScore / 20)));
      setOrigemResultado('servidor');
    }
  }, [statusQuiz, quizScore, fase]);

  async function finalizarQuiz() {
    if (!userId || !todasRespondidas) return;
    const acertos = respostas.reduce((n, r, i) => n + (r === QUIZ_CASA1_PERGUNTAS[i].correta ? 1 : 0), 0);
    const score = Math.round((acertos / 5) * 100);
    setUltimoAcertos(acertos);
    setUltimoScore(score);
    setOrigemResultado('local');
    setFase('resultado');
    await updateQuizScore(score);
    if (acertos >= 4) {
      await updateItem('quiz', 'concluido');
    } else {
      await updateItem('quiz', 'pendente');
    }
  }

  function tentarNovamente() {
    setRespostas(Array.from({ length: 5 }, () => null));
    setUltimoAcertos(null);
    setUltimoScore(null);
    setOrigemResultado(null);
    setFase('respondendo');
  }

  function opcaoClasses(letra: QuizLetra, selecionada: QuizLetra | null, correta: QuizLetra) {
    const base =
      'w-full rounded-xl border px-3 py-3 text-left text-sm shadow-sm transition-[border-color,background-color] duration-150';
    if (fase === 'resultado') {
      const ok = letra === correta;
      const escolheuErrado = selecionada === letra && letra !== correta;
      return clsx(
        base,
        ok && 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-200',
        escolheuErrado && 'border-red-300 bg-red-50 ring-1 ring-red-100',
        !ok && !escolheuErrado && 'border-slate-100 bg-slate-50/80 opacity-70',
      );
    }
    const ativa = selecionada === letra;
    return clsx(
      base,
      ativa ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300',
    );
  }

  const acertosExibicao = ultimoAcertos ?? 0;
  const scoreExibicao = ultimoScore ?? 0;
  const aprovadoExibicao = acertosExibicao >= 4;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold tracking-tight text-slate-900">Quiz</h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          Cinco questões com alternativas A a D. Aprovação: <strong className="font-semibold text-slate-800">80%</strong> (mínimo de{' '}
          <strong className="font-semibold text-slate-800">4 de 5</strong> acertos).
        </p>
        {!userId ? (
          <p className="mt-2 text-xs font-medium text-amber-800">Faça login para enviar o quiz e salvar a nota no Hub.</p>
        ) : null}
      </div>

      {fase === 'respondendo'
        ? QUIZ_CASA1_PERGUNTAS.map((q, idx) => (
            <section
              key={idx}
              className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 shadow-sm sm:p-5"
              aria-labelledby={`quiz-pergunta-${idx}`}
            >
              <p id={`quiz-pergunta-${idx}`} className="text-sm font-semibold text-slate-900">
                <span className="tabular-nums text-slate-500">{idx + 1}.</span> {q.pergunta}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(['A', 'B', 'C', 'D'] as const).map((letra) => (
                  <button
                    key={letra}
                    type="button"
                    disabled={!userId}
                    onClick={() => {
                      if (!userId) return;
                      setRespostas((prev) => {
                        const next = [...prev] as (QuizLetra | null)[];
                        next[idx] = letra;
                        return next;
                      });
                    }}
                    className={opcaoClasses(letra, respostas[idx], q.correta)}
                  >
                    <span className="font-semibold text-emerald-800">{letra}.</span>{' '}
                    <span className="text-slate-800">{q.opcoes[letra]}</span>
                  </button>
                ))}
              </div>
            </section>
          ))
        : null}

      {fase === 'respondendo' && userId ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!todasRespondidas}
            onClick={() => void finalizarQuiz()}
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Ver resultado
          </button>
          {!todasRespondidas ? (
            <p className="text-xs text-slate-500">Responda todas as questões para ver o resultado.</p>
          ) : null}
        </div>
      ) : null}

      {fase === 'resultado' ? (
        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Resultado</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {acertosExibicao} de 5 acertos ·{' '}
                <span className="tabular-nums text-emerald-800">{scoreExibicao}%</span>
              </p>
              <p className={clsx('mt-1 text-sm font-medium', aprovadoExibicao ? 'text-emerald-700' : 'text-amber-800')}>
                {aprovadoExibicao
                  ? 'Aprovado — mínimo de 4 de 5 acertos (80%). Nota salva e quiz marcado como concluído.'
                  : 'Reprovado — é necessário pelo menos 4 acertos (80%). Confira abaixo o que revisar.'}
              </p>
            </div>
            {!aprovadoExibicao ? (
              <button
                type="button"
                onClick={() => tentarNovamente()}
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 transition-colors hover:bg-emerald-100"
              >
                Tentar novamente
              </button>
            ) : null}
          </div>

          {aprovadoExibicao ? <QuizCasa1PremioDesbloqueio /> : null}

          {aprovadoExibicao ? (
            <ul className="space-y-4" role="list" aria-label="Revisão das questões">
              {QUIZ_CASA1_PERGUNTAS.map((q, idx) => {
                const acertou = origemResultado === 'servidor' ? true : respostas[idx] === q.correta;
                return (
                  <li
                    key={idx}
                    className="rounded-lg border border-slate-100 bg-slate-50/80 px-4 py-3"
                  >
                    <div className="flex items-start gap-2">
                      {acertou ? (
                        <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" strokeWidth={2.5} aria-hidden />
                      ) : (
                        <X className="mt-0.5 h-5 w-5 shrink-0 text-red-500" strokeWidth={2.5} aria-hidden />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">
                          {idx + 1}. {q.pergunta}
                        </p>
                        <p className="mt-2 text-xs leading-relaxed text-slate-600 sm:text-sm">{q.feedback}</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Perguntas incorretas</p>
              <ul className="space-y-4" role="list">
                {QUIZ_CASA1_PERGUNTAS.map((q, idx) => {
                  const marcou = respostas[idx];
                  const acertou = marcou === q.correta;
                  if (acertou || marcou == null) return null;
                  return (
                    <li
                      key={idx}
                      className="rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3 shadow-sm sm:px-5 sm:py-4"
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" strokeWidth={2} aria-hidden />
                        <div className="min-w-0 flex-1 space-y-2">
                          <p className="text-sm font-semibold text-slate-900">
                            {idx + 1}. {q.pergunta}
                          </p>
                          <p className="text-xs leading-relaxed text-slate-700 sm:text-sm">
                            <span className="font-medium text-slate-800">Sua resposta:</span> {marcou}.{' '}
                            {q.opcoes[marcou]}
                          </p>
                          <p className="text-xs leading-relaxed text-emerald-900 sm:text-sm">
                            <span className="font-medium">Correto:</span> {q.correta}. {q.opcoes[q.correta]}
                          </p>
                          <p className="border-t border-amber-200/80 pt-2 text-xs leading-relaxed text-slate-600 sm:text-sm">
                            {q.feedback}
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function TabPanelBody({ children }: { children: React.ReactNode }) {
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
      {children}
    </div>
  );
}

export default function Casa1Hub() {
  const [userId, setUserId] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('modulos');
  const [activeModuloIdx, setActiveModuloIdx] = useState(0);
  const conclusaoRegistradaRef = useRef(false);

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

  const {
    itens,
    loading,
    error,
    updateItem,
    updateQuizScore,
    progresso,
    tudoConcluido,
    quizScore,
  } = useCasa1Progresso(userId);

  const handleToggle = useCallback(
    (itemId: string, novoStatus: SetupTaskItemStatus) => {
      void updateItem(itemId, novoStatus);
    },
    [updateItem],
  );

  useEffect(() => {
    if (!userId || !tudoConcluido || conclusaoRegistradaRef.current) return;
    conclusaoRegistradaRef.current = true;
    const supabase = createClient();
    const now = new Date().toISOString();
    void supabase
      .from('franqueado_onboarding_missao')
      .upsert(
        {
          user_id: userId,
          casa_id: CASA1_ID,
          conteudo: 'Trilha Casa 1 — Ecossistema Moní concluída',
          status: 'aprovado',
          submitted_at: now,
        },
        { onConflict: 'user_id,casa_id' },
      )
      .then(({ error: upErr }) => {
        if (upErr) console.error(upErr);
      });
  }, [userId, tudoConcluido]);

  const currentTab = TABS.find((t) => t.id === activeTab) ?? TABS[0];
  const activeModulo = MODULOS[activeModuloIdx] ?? MODULOS[0];

  function renderTabContent() {
    switch (activeTab) {
      case 'modulos':
        return (
          <div className="flex flex-col gap-6 lg:flex-row">
            <nav
              className="flex shrink-0 flex-row gap-1 overflow-x-auto border-b border-slate-200 pb-2 lg:w-52 lg:flex-col lg:border-b-0 lg:border-r lg:pb-0 lg:pr-4"
              aria-label="Módulos de conteúdo"
            >
              {MODULOS.map((m, idx) => {
                const active = idx === activeModuloIdx;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setActiveModuloIdx(idx)}
                    className={clsx(
                      'whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors',
                      active
                        ? 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                    )}
                  >
                    {m.label}
                  </button>
                );
              })}
            </nav>
            <div className="min-w-0 flex-1 space-y-6">
              {activeModulo.id === 'modulo1' ? (
                <Modulo1Incorporacao
                  userId={userId}
                  statusModulo={itens.modulo1}
                  updateItem={updateItem}
                />
              ) : activeModulo.id === 'modulo2' ? (
                <Modulo2Ecossistema
                  userId={userId}
                  statusModulo={itens.modulo2}
                  updateItem={updateItem}
                />
              ) : activeModulo.id === 'modulo3' ? (
                <Modulo3ModelosNegocio
                  userId={userId}
                  statusModulo={itens.modulo3}
                  updateItem={updateItem}
                />
              ) : activeModulo.id === 'modulo4' ? (
                <Modulo4DecisaoMoni
                  userId={userId}
                  statusModulo={itens.modulo4}
                  updateItem={updateItem}
                />
              ) : activeModulo.id === 'modulo5' ? (
                <Modulo5LiquidezMercado
                  userId={userId}
                  statusModulo={itens.modulo5}
                  updateItem={updateItem}
                />
              ) : activeModulo.id === 'modulo6' ? (
                <Modulo6EstruturaFinanceira
                  userId={userId}
                  statusModulo={itens.modulo6}
                  updateItem={updateItem}
                />
              ) : activeModulo.id === 'modulo7' ? (
                <Modulo7RiscosIncorporacao
                  userId={userId}
                  statusModulo={itens.modulo7}
                  updateItem={updateItem}
                />
              ) : activeModulo.id === 'modulo8' ? (
                <Modulo8MentalidadeOperacional
                  userId={userId}
                  statusModulo={itens.modulo8}
                  updateItem={updateItem}
                />
              ) : activeModulo.id === 'modulo9' ? (
                <Modulo9JornadaOperacional
                  userId={userId}
                  statusModulo={itens.modulo9}
                  updateItem={updateItem}
                />
              ) : (
                <>
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight text-slate-900">{activeModulo.label}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">TODO</p>
                  </div>
                  {userId ? (
                    <SetupTaskItem
                      itemId={activeModulo.id}
                      titulo="Conclusão do módulo"
                      descricao="Marque quando tiver concluído a leitura e as atividades deste módulo."
                      orientacoes={[]}
                      status={itens[activeModulo.id] ?? 'pendente'}
                      onToggle={handleToggle}
                      obrigatorio
                    />
                  ) : null}
                </>
              )}
            </div>
          </div>
        );
      case 'glossario':
        return <GlossarioTabContent />;
      case 'modelos':
        return <ModelosNegocioTabContent />;
      case 'cenarios':
        return (
          <CenariosTabContent userId={userId} statusCenarios={itens.cenarios} updateItem={updateItem} />
        );
      case 'quiz':
        return (
          <QuizTabContent
            userId={userId}
            statusQuiz={itens.quiz}
            quizScore={quizScore}
            updateItem={updateItem}
            updateQuizScore={updateQuizScore}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className="w-full space-y-6 py-6">
      <header className="border-b border-slate-200 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-800 ring-1 ring-violet-200/80">
                Casa 1
              </span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Ecossistema Moní</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
              O que é incorporação, estrutura, glossário e modelos de negócio
            </p>
          </div>
        </div>
        <div className="mt-5 max-w-xl">
          <ProgressTracker progresso={progresso} tudoConcluido={tudoConcluido} missaoConcluida={false} />
        </div>
      </header>

      {!userId ? (
        <p className={UI.tabIntro}>Faça login para salvar o progresso da Casa 1.</p>
      ) : null}
      {loading ? <p className="text-sm text-slate-500">Carregando progresso…</p> : null}
      {error ? (
        <p className="text-sm font-medium text-red-600" role="alert">
          {error instanceof Error ? error.message : String(error)}
        </p>
      ) : null}

      <nav className={UI.tabNav} role="tablist" aria-label="Seções da Casa 1">
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`casa1-panel-${tab.id}`}
              id={`casa1-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(UI.tabBtn, isActive ? UI.tabBtnActive : UI.tabBtnIdle)}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      <section
        id={`casa1-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`casa1-tab-${activeTab}`}
        className={UI.panel}
      >
        <h2 className="sr-only">{currentTab.label}</h2>
        <TabPanelBody key={activeTab}>{renderTabContent()}</TabPanelBody>
      </section>

      {userId && tudoConcluido ? (
        <section
          className="rounded-xl border border-emerald-200 bg-emerald-50/90 px-5 py-5 shadow-sm"
          aria-labelledby="casa1-conquista-heading"
        >
          <div className="flex flex-wrap items-center gap-3">
            <CheckCircle className="h-7 w-7 shrink-0 text-emerald-600" strokeWidth={2} aria-hidden />
            <h2 id="casa1-conquista-heading" className="text-base font-semibold tracking-tight text-emerald-950">
              Fundamentos da Incorporação
            </h2>
            <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-800 ring-1 ring-violet-200/80">
              +500 XP
            </span>
          </div>
          <div className="mt-5 flex flex-col gap-3 rounded-lg border border-emerald-200 bg-white px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
              <div className="flex shrink-0 items-center justify-center rounded-lg bg-emerald-100 p-2 text-emerald-800">
                <Unlock className="h-5 w-5" strokeWidth={2} aria-hidden />
              </div>
              <p className="text-sm font-medium leading-snug text-emerald-950">
                Casa 2 desbloqueada — avance para a próxima etapa da jornada
              </p>
            </div>
            <Link
              href="/casa2"
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
            >
              Ir para a Casa 2 →
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
