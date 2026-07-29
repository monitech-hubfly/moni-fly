import Link from 'next/link';
import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import { fetchHubFunisSla, type HubFunisSlaItem } from '@/lib/actions/hub-funis-sla';

// ─── Definição de funis por grupo ───────────────────────────────────────────

type FunilDef = {
  id: string;
  label: string;
  href: string;
};

type GrupoDef = {
  titulo: string;
  cor: string;      // cor do accent bar
  funis: FunilDef[];
};

const GRUPOS: GrupoDef[] = [
  {
    titulo: 'Novos Negócios',
    cor: '#2f4a3a',
    funis: [
      { id: KANBAN_IDS.STEP_ONE,    label: 'Step One',    href: '/funil-stepone' },
      { id: KANBAN_IDS.PORTFOLIO,   label: 'Portfólio',   href: '/portfolio' },
      { id: KANBAN_IDS.LOTEADORES,  label: 'Loteadores',  href: '/loteadores' },
      { id: KANBAN_IDS.ACOPLAMENTO, label: 'Acoplamento', href: '/funil-acoplamento' },
      { id: KANBAN_IDS.MOTOR01,     label: 'Motor 01',    href: '/funil-motor01' },
    ],
  },
  {
    titulo: 'Moní Capital',
    cor: '#7a5c1e',
    funis: [
      { id: KANBAN_IDS.MONI_CAPITAL, label: 'Divify',      href: '/funil-moni-capital' },
      { id: KANBAN_IDS.FUNDING,      label: 'Funding',      href: '/funil-funding' },
      { id: KANBAN_IDS.CREDITO_OBRA, label: 'Crédito Obra', href: '/funil-credito-obra' },
      { id: KANBAN_IDS.JURIDICO,     label: 'Jurídico',     href: '/funil-juridico' },
    ],
  },
  {
    titulo: 'Operações',
    cor: '#4a3929',
    funis: [
      { id: KANBAN_IDS.OPERACOES,       label: 'Pré Obra e Obra', href: '/operacoes' },
      { id: KANBAN_IDS.PROJETO_LEGAL,   label: 'Projeto Legal',   href: '/funil-projeto-legal' },
      { id: KANBAN_IDS.PROJETOS_LOCAIS, label: 'Projetos Locais', href: '/projetos-locais' },
    ],
  },
  {
    titulo: 'HDM',
    cor: '#0c2633',
    funis: [
      { id: KANBAN_IDS.HDM_PRODUTO,        label: 'Produto',        href: '/funil-produto' },
      { id: KANBAN_IDS.HDM_MODELO_VIRTUAL, label: 'Modelo Virtual', href: '/funil-modelo-virtual' },
      { id: KANBAN_IDS.HDM_HOMOLOGACOES,   label: 'Homologações',   href: '/funil-homologacoes' },
    ],
  },
  {
    titulo: 'ADM',
    cor: '#3d3d3d',
    funis: [
      { id: KANBAN_IDS.CONTRATACOES,  label: 'Contratações',  href: '/funil-contratacoes' },
      { id: KANBAN_IDS.CONTABILIDADE, label: 'Contabilidade', href: '/painel-contabilidade' },
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slaMap(items: HubFunisSlaItem[]): Record<string, HubFunisSlaItem> {
  return Object.fromEntries(items.map((i) => [i.kanbanId, i]));
}

// ─── Componentes ─────────────────────────────────────────────────────────────

function FunilCard({
  funil,
  sla,
  accentCor,
}: {
  funil: FunilDef;
  sla: HubFunisSlaItem | undefined;
  accentCor: string;
}) {
  const atrasados = sla?.atrasados ?? 0;
  const hoje = sla?.hoje ?? 0;
  const chamados = sla?.chamados ?? 0;

  return (
    <Link
      href={funil.href}
      className="fcard"
      style={{ '--accent': accentCor } as React.CSSProperties}
    >
      {/* barra de cor do grupo */}
      <div className="fcard-accent" />

      <div className="fcard-body">
        {/* topo: label + SLA */}
        <div className="fcard-top">
          <span className="fcard-label">{funil.label}</span>
          <div className="fcard-sla">
            {atrasados > 0 && (
              <span className="fcard-sla-at">
                <span className="fcard-num">{atrasados}</span>
                <span className="fcard-unit">atras.</span>
              </span>
            )}
            {hoje > 0 && (
              <span className="fcard-sla-hj">
                <span className="fcard-dot" />
                <span className="fcard-unit">{hoje} hoje</span>
              </span>
            )}
          </div>
        </div>

        {/* rodapé: chamados */}
        <div className="fcard-footer">
          {chamados > 0 ? (
            <span className="fcard-chamados-tag">
              {chamados} chamado{chamados !== 1 ? 's' : ''}
            </span>
          ) : (
            <span className="fcard-chamados-empty" />
          )}
        </div>
      </div>
    </Link>
  );
}

function GrupoRow({
  grupo,
  slaData,
}: {
  grupo: GrupoDef;
  slaData: Record<string, HubFunisSlaItem>;
}) {
  return (
    <div className="hub-grupo">
      <h2 className="hub-grupo-titulo">{grupo.titulo}</h2>
      <div className="hub-grupo-cards">
        {grupo.funis.map((f) => (
          <FunilCard key={f.id} funil={f} sla={slaData[f.id]} accentCor={grupo.cor} />
        ))}
      </div>
    </div>
  );
}

function GargaloItem({
  funil,
  sla,
}: {
  funil: FunilDef;
  sla: HubFunisSlaItem | undefined;
}) {
  if (!sla || (sla.atrasados === 0 && sla.hoje === 0)) return null;
  return (
    <div className="hub-gargalo-item">
      <span className="hub-gargalo-nome">{funil.label}</span>
      <div className="hub-gargalo-nums">
        {sla.atrasados > 0 && (
          <span className="hub-gargalo-num hub-gargalo-num-at">
            {sla.atrasados}
            <span className="hub-gargalo-label-sm">
              {' '}atrasado{sla.atrasados !== 1 ? 's' : ''}
            </span>
          </span>
        )}
        {sla.hoje > 0 && (
          <span className="hub-gargalo-num hub-gargalo-num-hj">
            {sla.hoje}
            <span className="hub-gargalo-label-sm"> hoje</span>
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function HubFunisPage() {
  const slaItems = await fetchHubFunisSla();
  const sla = slaMap(slaItems);

  const todosFunis = GRUPOS.flatMap((g) => g.funis);
  const totalAtrasados = slaItems.reduce((acc, i) => acc + i.atrasados, 0);
  const totalHoje = slaItems.reduce((acc, i) => acc + i.hoje, 0);

  return (
    <>
      <style>{`
        /* ── Layout ── */
        .hub-funis-page {
          min-height: 100vh;
          background: #f2ede8;
          display: flex;
          flex-direction: column;
        }

        /* ── Hero ── */
        .hub-hero {
          background: #0e1e13;
          padding: 36px 40px 32px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .hub-hero-title {
          font-size: 22px;
          font-weight: 700;
          color: #fff;
          letter-spacing: -0.3px;
          font-family: var(--moni-font-display, serif);
          margin: 0 0 4px;
        }
        .hub-hero-sub {
          font-size: 12px;
          color: rgba(255,255,255,0.5);
          font-family: var(--moni-font-sans, sans-serif);
          margin: 0;
        }

        /* ── Gargalos ── */
        .hub-gargalos-titulo {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: rgba(255,255,255,0.45);
          font-family: var(--moni-font-sans, sans-serif);
          margin-bottom: 8px;
        }
        .hub-gargalos-lista {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .hub-gargalo-item {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(255,255,255,0.07);
          border: 0.5px solid rgba(255,255,255,0.12);
          border-radius: 8px;
          padding: 6px 11px;
        }
        .hub-gargalo-nome {
          font-size: 11px;
          color: rgba(255,255,255,0.75);
          font-family: var(--moni-font-sans, sans-serif);
          font-weight: 500;
        }
        .hub-gargalo-nums {
          display: flex;
          align-items: baseline;
          gap: 8px;
        }
        .hub-gargalo-num {
          font-size: 12px;
          font-weight: 700;
          font-family: var(--moni-font-display, serif);
        }
        .hub-gargalo-num-at { color: #e87c6e; }
        .hub-gargalo-num-hj { color: #d4ad68; }
        .hub-gargalo-label-sm {
          font-size: 10px;
          font-weight: 400;
          opacity: 0.75;
          font-family: var(--moni-font-sans, sans-serif);
        }
        .hub-gargalos-empty {
          font-size: 11px;
          color: rgba(255,255,255,0.35);
          font-family: var(--moni-font-sans, sans-serif);
        }

        /* ── Grupos ── */
        .hub-grupos {
          display: flex;
          flex-direction: column;
          gap: 28px;
          padding: 32px 40px 52px;
        }
        .hub-grupo-titulo {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: #7a6555;
          font-family: var(--moni-font-sans, sans-serif);
          margin: 0 0 10px;
        }
        .hub-grupo-cards {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
        }

        /* ── Card de funil ── */
        .fcard {
          width: 148px;
          height: 90px;
          border-radius: 10px;
          overflow: hidden;
          text-decoration: none;
          cursor: pointer;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          background: #f5f2ee;
          border: 0.5px solid rgba(0,0,0,0.09);
          box-shadow: 0 1px 3px rgba(0,0,0,0.06);
          transition: transform 0.12s ease, box-shadow 0.12s ease;
        }
        .fcard:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 18px rgba(0,0,0,0.12);
        }

        /* barra de cor do grupo */
        .fcard-accent {
          height: 3px;
          background: var(--accent, #2f4a3a);
          flex-shrink: 0;
        }

        /* corpo do card */
        .fcard-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 9px 11px 8px;
        }

        /* topo */
        .fcard-top {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .fcard-label {
          font-size: 11.5px;
          font-weight: 700;
          color: #1a1a1a;
          line-height: 1.2;
          font-family: var(--moni-font-sans, sans-serif);
          letter-spacing: -0.1px;
        }
        .fcard-sla {
          display: flex;
          align-items: center;
          gap: 6px;
          min-height: 16px;
        }
        .fcard-sla-at {
          display: flex;
          align-items: baseline;
          gap: 3px;
        }
        .fcard-sla-hj {
          display: flex;
          align-items: center;
          gap: 3px;
        }
        .fcard-num {
          font-size: 13px;
          font-weight: 700;
          color: #c0392b;
          font-family: var(--moni-font-display, serif);
          line-height: 1;
        }
        .fcard-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #c09030;
          flex-shrink: 0;
        }
        .fcard-unit {
          font-size: 9.5px;
          font-weight: 500;
          color: #7a6555;
          font-family: var(--moni-font-sans, sans-serif);
        }

        /* rodapé: tag de chamados */
        .fcard-footer {
          display: flex;
          align-items: center;
          min-height: 18px;
        }
        .fcard-chamados-tag {
          display: inline-flex;
          align-items: center;
          padding: 1px 7px;
          border-radius: 4px;
          background: #dce9f5;
          color: #2563a8;
          font-size: 10px;
          font-weight: 600;
          font-family: var(--moni-font-sans, sans-serif);
          line-height: 1.5;
          letter-spacing: 0.1px;
          border: 0.5px solid #b8d4ee;
        }
        .fcard-chamados-empty {
          height: 18px;
        }

        @media (max-width: 640px) {
          .hub-hero { padding: 24px 20px 20px; }
          .hub-grupos { padding: 24px 20px 40px; }
          .fcard { width: 130px; height: 88px; }
        }
      `}</style>

      <div className="hub-funis-page">
        {/* Hero */}
        <div className="hub-hero">
          <div>
            <h1 className="hub-hero-title">Todos os Funis</h1>
            <p className="hub-hero-sub">
              {totalAtrasados > 0 || totalHoje > 0
                ? `${totalAtrasados} atrasado${totalAtrasados !== 1 ? 's' : ''} · ${totalHoje} vencem hoje`
                : 'SLA em dia em todos os funis'}
            </p>
          </div>

          {/* Gargalos */}
          <div>
            <div className="hub-gargalos-titulo">SLA — Gargalos</div>
            {totalAtrasados === 0 && totalHoje === 0 ? (
              <p className="hub-gargalos-empty">Nenhum SLA vencido ou vencendo hoje.</p>
            ) : (
              <div className="hub-gargalos-lista">
                {todosFunis.map((f) => (
                  <GargaloItem key={f.id} funil={f} sla={sla[f.id]} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Grupos */}
        <div className="hub-grupos">
          {GRUPOS.map((grupo) => (
            <GrupoRow key={grupo.titulo} grupo={grupo} slaData={sla} />
          ))}
        </div>
      </div>
    </>
  );
}
