import Link from 'next/link';
import type { HubFunisSlaItem } from '@/lib/actions/hub-funis-sla';
import type { FunilDef, GrupoDef } from './hub-funis-config';
import { HUB_FUNIS_GRUPOS, HUB_FUNIS_TODOS } from './hub-funis-config';

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
      prefetch
      className="fcard"
      style={{ '--accent': accentCor } as React.CSSProperties}
    >
      <div className="fcard-accent" />

      <div className="fcard-body">
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

function slaMap(items: HubFunisSlaItem[]): Record<string, HubFunisSlaItem> {
  return Object.fromEntries(items.map((i) => [i.kanbanId, i]));
}

/** Placeholder imediato: cards clicáveis enquanto SLA carrega. */
export function HubFunisPlaceholder() {
  return (
    <>
      <div className="hub-hero">
        <div>
          <h1 className="hub-hero-title">Todos os Funis</h1>
          <p className="hub-hero-sub">Carregando SLA…</p>
        </div>
        <div>
          <div className="hub-gargalos-titulo">SLA — Gargalos</div>
          <p className="hub-gargalos-empty">Carregando indicadores…</p>
        </div>
      </div>
      <div className="hub-grupos">
        {HUB_FUNIS_GRUPOS.map((grupo) => (
          <GrupoRow key={grupo.titulo} grupo={grupo} slaData={{}} />
        ))}
      </div>
    </>
  );
}

export async function HubFunisSlaContent() {
  const { fetchHubFunisSla } = await import('@/lib/actions/hub-funis-sla');
  const slaItems = await fetchHubFunisSla();
  const sla = slaMap(slaItems);

  const totalAtrasados = slaItems.reduce((acc, i) => acc + i.atrasados, 0);
  const totalHoje = slaItems.reduce((acc, i) => acc + i.hoje, 0);

  return (
    <>
      <div className="hub-hero">
        <div>
          <h1 className="hub-hero-title">Todos os Funis</h1>
          <p className="hub-hero-sub">
            {totalAtrasados > 0 || totalHoje > 0
              ? `${totalAtrasados} atrasado${totalAtrasados !== 1 ? 's' : ''} · ${totalHoje} vencem hoje`
              : 'SLA em dia em todos os funis'}
          </p>
        </div>

        <div>
          <div className="hub-gargalos-titulo">SLA — Gargalos</div>
          {totalAtrasados === 0 && totalHoje === 0 ? (
            <p className="hub-gargalos-empty">Nenhum SLA vencido ou vencendo hoje.</p>
          ) : (
            <div className="hub-gargalos-lista">
              {HUB_FUNIS_TODOS.map((f) => (
                <GargaloItem key={f.id} funil={f} sla={sla[f.id]} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="hub-grupos">
        {HUB_FUNIS_GRUPOS.map((grupo) => (
          <GrupoRow key={grupo.titulo} grupo={grupo} slaData={sla} />
        ))}
      </div>
    </>
  );
}
