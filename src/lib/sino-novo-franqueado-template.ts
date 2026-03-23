export const SINO_NOVO_FRANQUEADO_HTML = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sino Virtual</title>
    <style>
      :root {
        --bg: #0a1820;
        --card: rgba(255, 255, 255, 0.06);
        --border: rgba(255, 255, 255, 0.12);
        --text: rgba(255, 255, 255, 0.92);
        --muted: rgba(255, 255, 255, 0.74);
        --gold: #d7b35a;
        --green: #1fbf7a;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
        /* Evita "bordas laterais" azuis aparecendo fora do card quando o HTML é injetado via innerHTML. */
        background: transparent;
        color: var(--text);
        padding: 0;
      }
      .wrap {
        max-width: 860px;
        margin: 0 auto;
      }
      .card {
        position: relative;
        border-radius: 18px;
        background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03));
        border: 1px solid var(--border);
        overflow: hidden;
        padding: 22px 22px 18px;
      }
      .rings::before, .rings::after {
        content: "";
        position: absolute;
        inset: -40px;
        border-radius: 999px;
        border: 1px solid rgba(215, 179, 90, 0.22);
        transform: scale(0.78);
        opacity: 0.45;
        animation: pulse 2.6s ease-in-out infinite;
      }
      .rings::after {
        border-color: rgba(31, 191, 122, 0.20);
        transform: scale(0.92);
        animation-delay: 0.6s;
      }
      @keyframes pulse {
        0% { transform: scale(0.78); opacity: 0.22; }
        50% { transform: scale(1.02); opacity: 0.55; }
        100% { transform: scale(0.78); opacity: 0.22; }
      }
      .top {
        display: flex;
        gap: 14px;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        position: relative;
        z-index: 1;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border-radius: 999px;
        padding: 8px 12px;
        border: 1px solid rgba(215, 179, 90, 0.34);
        background: rgba(215, 179, 90, 0.10);
        font-weight: 700;
        letter-spacing: 0.2px;
        animation: badgeGlow 2.4s ease-in-out infinite;
      }
      @keyframes badgeGlow {
        0% { box-shadow: 0 0 0 rgba(215,179,90,0.0); }
        50% { box-shadow: 0 0 24px rgba(215,179,90,0.22); }
        100% { box-shadow: 0 0 0 rgba(215,179,90,0.0); }
      }
      .title {
        font-size: 20px;
        font-weight: 800;
        margin: 0;
      }
      .sub {
        margin: 6px 0 0;
        color: var(--muted);
        line-height: 1.45;
        font-size: 14px;
      }
      .grid {
        margin-top: 16px;
        display: grid;
        grid-template-columns: 1fr;
        gap: 12px;
        position: relative;
        z-index: 1;
      }
      @media (min-width: 720px) {
        .grid { grid-template-columns: 1.3fr 0.7fr; }
      }
      .box {
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,0.10);
        background: rgba(0,0,0,0.18);
        padding: 14px;
      }
      .kvs {
        display: grid;
        gap: 10px;
      }
      .kv .k {
        color: rgba(255,255,255,0.68);
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }
      .kv .v {
        margin-top: 4px;
        font-weight: 800;
        font-size: 16px;
      }
      .kv .v strong { color: var(--gold); }
      .bellWrap {
        display: grid;
        place-items: center;
        min-height: 180px;
      }
      .bell {
        width: 92px;
        height: 92px;
        border-radius: 999px;
        background: radial-gradient(circle at 30% 30%, rgba(215,179,90,0.26), rgba(215,179,90,0.06));
        border: 1px solid rgba(215,179,90,0.34);
        display: grid;
        place-items: center;
        position: relative;
        animation: bell 1.6s ease-in-out infinite;
      }
      @keyframes bell {
        0% { transform: rotate(-6deg) translateY(0); }
        50% { transform: rotate(6deg) translateY(-2px); }
        100% { transform: rotate(-6deg) translateY(0); }
      }
      .bell svg { width: 48px; height: 48px; }
      .dot {
        position: absolute;
        top: 10px;
        right: 10px;
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: var(--green);
        box-shadow: 0 0 16px rgba(31,191,122,0.55);
      }
      .footer {
        margin-top: 14px;
        color: rgba(255,255,255,0.62);
        font-size: 12px;
        position: relative;
        z-index: 1;
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card rings">
        <div class="top">
          <div class="badge">🔔 Sino Virtual • Novo Franqueado</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.65)">Casa Moní</div>
        </div>
        <h2 class="title">Grandes propósitos se constroem em rede.</h2>
        <p class="sub">
          Recebemos com entusiasmo nosso novo parceiro de negócios, <strong>[Nome do Franqueado]</strong>,
          que chega para contribuir na transformação do cenário da incorporação em <strong>[Cidade / Estado]</strong>.
          Bem-vindo à rede Casa Moní, <strong>[FK0000]</strong>.
        </p>
        <div class="grid">
          <div class="box">
            <div class="kvs">
              <div class="kv">
                <div class="k">Franqueado</div>
                <div class="v">[Nome do Franqueado]</div>
              </div>
              <div class="kv">
                <div class="k">Área de atuação</div>
                <div class="v">[Cidade / Estado]</div>
              </div>
              <div class="kv">
                <div class="k">Número de franquia</div>
                <div class="v"><strong>[FK0000]</strong></div>
              </div>
              <div class="kv">
                <div class="k">Data</div>
                <div class="v">[Data]</div>
              </div>
            </div>
          </div>
          <div class="box bellWrap">
            <div class="bell" aria-label="Sino">
              <span class="dot"></span>
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 22a2.2 2.2 0 0 0 2.2-2.2H9.8A2.2 2.2 0 0 0 12 22Z"
                  stroke="rgba(215,179,90,0.95)"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M18 16V11a6 6 0 1 0-12 0v5l-1.6 1.6c-.3.3-.1.8.3.8h15.9c.4 0 .6-.5.3-.8L18 16Z"
                  stroke="rgba(215,179,90,0.95)"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>
        <div class="footer">
          Interaja com um ❤️ e deixe seu “Bem-vindo”.
        </div>
      </div>
    </div>
  </body>
</html>`;

