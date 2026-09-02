export function HubFunisPageStyles() {
  return (
    <style>{`
        .hub-funis-page {
          min-height: 100vh;
          background: #f2ede8;
          display: flex;
          flex-direction: column;
        }

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

        .fcard-accent {
          height: 3px;
          background: var(--accent, #2f4a3a);
          flex-shrink: 0;
        }

        .fcard-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 9px 11px 8px;
        }

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
  );
}
