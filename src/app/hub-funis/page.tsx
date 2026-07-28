import Link from 'next/link';
import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import { fetchHubFunisSla, type HubFunisSlaItem } from '@/lib/actions/hub-funis-sla';
import { createClient } from '@/lib/supabase/server';
import { normalizeAccessRole } from '@/lib/authz';

// ─── Definição de funis por grupo ───────────────────────────────────────────

type FunilDef = {
  id: string;
  label: string;
  href: string;
  cor: string; // cor dominante do card
};

const GRUPO_NOVOS_NEGOCIOS: FunilDef[] = [
  { id: KANBAN_IDS.STEP_ONE,    label: 'Step One',    href: '/funil-stepone',    cor: '#2f4a3a' },
  { id: KANBAN_IDS.PORTFOLIO,   label: 'Portfólio',   href: '/portfolio',         cor: '#2f4a3a' },
  { id: KANBAN_IDS.LOTEADORES,  label: 'Loteadores',  href: '/loteadores',        cor: '#2f4a3a' },
  { id: KANBAN_IDS.ACOPLAMENTO, label: 'Acoplamento', href: '/funil-acoplamento', cor: '#2f4a3a' },
  { id: KANBAN_IDS.MOTOR01,     label: 'Motor 01',    href: '/funil-motor01',     cor: '#2f4a3a' },
];

const GRUPO_MONI_CAPITAL: FunilDef[] = [
  { id: KANBAN_IDS.MONI_CAPITAL,  label: 'Divify',       href: '/funil-moni-capital', cor: '#7a5c1e' },
  { id: KANBAN_IDS.FUNDING,       label: 'Funding',       href: '/funil-funding',       cor: '#7a5c1e' },
  { id: KANBAN_IDS.CONTRATACOES,  label: 'Contratações',  href: '/funil-contratacoes',  cor: '#7a5c1e' },
  { id: KANBAN_IDS.CREDITO_OBRA,  label: 'Cash Me',       href: '/funil-credito-obra',  cor: '#7a5c1e' },
  { id: KANBAN_IDS.CONTABILIDADE, label: 'Contabilidade', href: '/painel-contabilidade', cor: '#7a5c1e' },
  { id: KANBAN_IDS.JURIDICO,      label: 'Jurídico',      href: '/funil-juridico',      cor: '#7a5c1e' },
];

const GRUPO_OPERACOES: FunilDef[] = [
  { id: KANBAN_IDS.OPERACOES,       label: 'Pré Obra e Obra',  href: '/operacoes',            cor: '#4a3929' },
  { id: KANBAN_IDS.PROJETO_LEGAL,   label: 'Projeto Legal',    href: '/funil-projeto-legal',  cor: '#4a3929' },
  { id: KANBAN_IDS.PROJETOS_LOCAIS, label: 'Projetos Locais',  href: '/projetos-locais',      cor: '#4a3929' },
];

const GRUPO_HDM: FunilDef[] = [
  { id: KANBAN_IDS.HDM_PRODUTO,        label: 'Produto',        href: '/funil-produto',        cor: '#0c2633' },
  { id: KANBAN_IDS.HDM_MODELO_VIRTUAL, label: 'Modelo Virtual', href: '/funil-modelo-virtual', cor: '#0c2633' },
  { id: KANBAN_IDS.HDM_HOMOLOGACOES,   label: 'Homologações',   href: '/funil-homologacoes',   cor: '#0c2633' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slaMap(items: HubFunisSlaItem[]): Record<string, HubFunisSlaItem> {
  return Object.fromEntries(items.map((i) => [i.kanbanId, i]));
}

// ─── Componentes ─────────────────────────────────────────────────────────────

function FunilCard({ funil, sla }: { funil: FunilDef; sla: HubFunisSlaItem | undefined }) {
  const atrasados = sla?.atrasados ?? 0;
  const hoje = sla?.hoje ?? 0;
  const temAlerta = atrasados > 0 || hoje > 0;

  return (
    <Link
      href={funil.href}
      className="hub-funil-card"
      style={{ '--card-cor': funil.cor } as React.CSSProperties}
    >
      <div className="hub-funil-card-bg" />
      <div className="hub-funil-card-content">
        <span className="hub-funil-card-label">{funil.label}</span>
        {temAlerta && (
          <div className="hub-funil-card-badges">
            {atrasados > 0 && (
              <span className="hub-funil-badge hub-funil-badge-atrasado">{atrasados}</span>
            )}
            {hoje > 0 && (
              <span className="hub-funil-badge hub-funil-badge-hoje">{hoje}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

function GrupoRow({
  titulo,
  funis,
  slaData,
}: {
  titulo: string;
  funis: FunilDef[];
  slaData: Record<string, HubFunisSlaItem>;
}) {
  return (
    <div className="hub-grupo">
      <h2 className="hub-grupo-titulo">{titulo}</h2>
      <div className="hub-grupo-cards">
        {funis.map((f) => (
          <FunilCard key={f.id} funil={f} sla={slaData[f.id]} />
        ))}
      </div>
    </div>
  );
}

function GargaloItem({ funil, sla }: { funil: FunilDef; sla: HubFunisSlaItem | undefined }) {
  if (!sla || (sla.atrasados === 0 && sla.hoje === 0)) return null;
  return (
    <div className="hub-gargalo-item">
      <span className="hub-gargalo-nome">{funil.label}</span>
      <div className="hub-gargalo-nums">
        {sla.atrasados > 0 && (
          <span className="hub-gargalo-num hub-gargalo-num-at">
            {sla.atrasados} <span className="hub-gargalo-label-sm">atrasado{sla.atrasados !== 1 ? 's' : ''}</span>
          </span>
        )}
        {sla.hoje > 0 && (
          <span className="hub-gargalo-num hub-gargalo-num-hj">
            {sla.hoje} <span className="hub-gargalo-label-sm">hoje</span>
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

  const todosFunis = [
    ...GRUPO_NOVOS_NEGOCIOS,
    ...GRUPO_MONI_CAPITAL,
    ...GRUPO_OPERACOES,
    ...GRUPO_HDM,
  ];

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
        .hub-hero-header {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .hub-hero-title {
          font-size: 22px;
          font-weight: 700;
          color: #fff;
          letter-spacing: -0.3px;
          font-family: var(--moni-font-display, serif);
        }
        .hub-hero-sub {
          font-size: 12px;
          color: rgba(255,255,255,0.5);
          font-family: var(--moni-font-sans, sans-serif);
        }

        /* ── Gargalos ── */
        .hub-gargalos-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .hub-gargalos-titulo {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: rgba(255,255,255,0.45);
          font-family: var(--moni-font-sans, sans-serif);
        }
        .hub-gargalos-lista {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .hub-gargalo-item {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          padding: 7px 12px;
        }
        .hub-gargalo-nome {
          font-size: 11px;
          color: rgba(255,255,255,0.8);
          font-family: var(--moni-font-sans, sans-serif);
          font-weight: 500;
        }
        .hub-gargalo-nums {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .hub-gargalo-num {
          display: flex;
          align-items: baseline;
          gap: 3px;
          font-size: 13px;
          font-weight: 700;
          font-family: var(--moni-font-display, serif);
        }
        .hub-gargalo-num-at { color: #e87c6e; }
        .hub-gargalo-num-hj { color: #d4ad68; }
        .hub-gargalo-label-sm {
          font-size: 10px;
          font-weight: 400;
          opacity: 0.8;
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
          padding: 32px 40px 48px;
        }
        .hub-grupo {}
        .hub-grupo-titulo {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.7px;
          color: #5c4a3a;
          font-family: var(--moni-font-sans, sans-serif);
          margin-bottom: 12px;
        }
        .hub-grupo-cards {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        /* ── Card de funil ── */
        .hub-funil-card {
          position: relative;
          width: 128px;
          height: 74px;
          border-radius: 10px;
          overflow: hidden;
          text-decoration: none;
          cursor: pointer;
          flex-shrink: 0;
          transition: transform 0.12s ease, box-shadow 0.12s ease;
        }
        .hub-funil-card:hover {
          transform: translateY(-2px) scale(1.02);
          box-shadow: 0 8px 24px rgba(0,0,0,0.18);
        }
        .hub-funil-card-bg {
          position: absolute;
          inset: 0;
          background: var(--card-cor, #2f4a3a);
          background-image: linear-gradient(
            135deg,
            rgba(255,255,255,0.06) 0%,
            rgba(0,0,0,0.25) 100%
          );
        }
        .hub-funil-card-content {
          position: relative;
          z-index: 1;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 10px 10px 8px;
        }
        .hub-funil-card-label {
          font-size: 11px;
          font-weight: 700;
          color: #fff;
          line-height: 1.3;
          font-family: var(--moni-font-sans, sans-serif);
          letter-spacing: 0.1px;
        }
        .hub-funil-card-badges {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }
        .hub-funil-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 20px;
          height: 16px;
          padding: 0 5px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
          font-family: var(--moni-font-sans, sans-serif);
          line-height: 1;
        }
        .hub-funil-badge-atrasado {
          background: rgba(200,60,40,0.85);
          color: #fff;
        }
        .hub-funil-badge-hoje {
          background: rgba(180,140,60,0.85);
          color: #fff;
        }

        @media (max-width: 640px) {
          .hub-hero { padding: 24px 20px 20px; }
          .hub-grupos { padding: 24px 20px 40px; }
          .hub-funil-card { width: 110px; height: 66px; }
        }
      `}</style>

      <div className="hub-funis-page">
        {/* Hero */}
        <div className="hub-hero">
          <div className="hub-hero-header">
            <h1 className="hub-hero-title">Todos os Funis</h1>
            <p className="hub-hero-sub">
              {totalAtrasados > 0 || totalHoje > 0
                ? `${totalAtrasados} atrasado${totalAtrasados !== 1 ? 's' : ''} · ${totalHoje} vencem hoje`
                : 'SLA em dia em todos os funis'}
            </p>
          </div>

          {/* Gargalos */}
          <div className="hub-gargalos-section">
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
          <GrupoRow titulo="Novos Negócios" funis={GRUPO_NOVOS_NEGOCIOS} slaData={sla} />
          <GrupoRow titulo="Moní Capital" funis={GRUPO_MONI_CAPITAL} slaData={sla} />
          <GrupoRow titulo="Operações" funis={GRUPO_OPERACOES} slaData={sla} />
          <GrupoRow titulo="HDM" funis={GRUPO_HDM} slaData={sla} />
        </div>
      </div>
    </>
  );
}
