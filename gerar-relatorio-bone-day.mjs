/**
 * gerar-relatorio-bone-day.mjs  (v2 — com semáforo e datas)
 *
 * USO:
 *   $env:SUPABASE_PROD_KEY = "eyJ..."
 *   node gerar-relatorio-bone-day.mjs              → setembro 2026
 *   node gerar-relatorio-bone-day.mjs 2026-10      → outro mês
 */

import https from 'https';
import { writeFileSync } from 'fs';

// ── Config ────────────────────────────────────────────────────────────────────
const PROD_URL    = 'https://aydryzoxqnwnbybvgiug.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_PROD_KEY;
const MES         = process.argv[2] || '2026-09';

if (!SERVICE_KEY) {
  console.error('\n❌  Defina SUPABASE_PROD_KEY antes de rodar.\n');
  process.exit(1);
}

// ── REST helper ───────────────────────────────────────────────────────────────
function rest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'aydryzoxqnwnbybvgiug.supabase.co',
      path: `/rest/v1/${path}`,
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Accept: 'application/json',
      },
    };
    https.get(options, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        else resolve(JSON.parse(body));
      });
    }).on('error', reject);
  });
}

// ── Semáforo helpers ──────────────────────────────────────────────────────────
const COMP = { gte: '≥', lte: '≤', gt: '>', lt: '<', eq: '=' };
const COR_LABEL = { ve: 'Verde Escuro (VE)', vc: 'Verde Claro (VC)', am: 'Amarelo (AM)', vm: 'Vermelho (VM)' };
const FAROL_POSICIONAL = ['ve', 'vc', 'am', 'vm'];

/**
 * Retorna { ve, vc, am, vm } com o texto da condição de cada faixa.
 * Ex: { ve: '≥36000', vc: '≥28000', am: '≥14500', vm: '>0' }
 */
function parseFaixas(semaforo_faixas, metaTipo) {
  const tipo = (metaTipo ?? '').toLowerCase();
  const isAtingivel = tipo === 'atingivel' || tipo === 'atingivel - projeto';

  // Indicadores de metas Atingível/Projeto são medidos por evolução esperada
  if (isAtingivel) {
    return {
      ve: '≥75% do esperado na semana',
      vc: '≥60% do esperado na semana',
      am: '≥30% do esperado na semana',
      vm: '<30% do esperado na semana',
      nota: 'Medição conforme evolução esperada (% realizado ÷ % esperado na semana)',
    };
  }

  // Semáforo com faixas fixas (tipo Recorrente ou sem tipo)
  const sf = semaforo_faixas;
  const faixas = Array.isArray(sf?.faixas) ? sf.faixas : [];
  const result = { ve: '—', vc: '—', am: '—', vm: '—', nota: '' };
  faixas.forEach((f, i) => {
    const corKey = (f.cor && COR_LABEL[f.cor]) ? f.cor : (FAROL_POSICIONAL[i] ?? 'vm');
    const comp   = COMP[f.comparacao] ?? f.comparacao ?? '';
    result[corKey] = `${comp}${f.limite}`;
  });
  return result;
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────
const rest2 = (path) => rest(path);

async function fetchAreas() {
  return rest2('areas?select=id,nome&order=nome');
}

async function fetchObjetivos(areaIds) {
  const ids = areaIds.map(id => `"${id}"`).join(',');
  return rest2(
    `objetivos?select=id,area_id,descricao,tipo,is_chave,status,meta_valor,meta_unidade,profile_id,ordem,mes` +
    `&mes=eq.${MES}&objetivo_pai_id=is.null&area_id=in.(${ids})` +
    `&order=area_id,is_chave.desc,ordem`
  );
}

async function fetchObjetivosNaoConclAntes(areaIds) {
  const ids = areaIds.map(id => `"${id}"`).join(',');
  return rest2(
    `objetivos?select=id,area_id,descricao,tipo,is_chave,status,meta_valor,meta_unidade,profile_id,ordem,mes` +
    `&mes=lt.${MES}&objetivo_pai_id=is.null` +
    `&status=neq.concluido&status=neq.arquivado&status=neq.relancada` +
    `&area_id=in.(${ids})&order=area_id,is_chave.desc,ordem`
  );
}

async function fetchIndicadores(areaIds) {
  const ids = areaIds.map(id => `"${id}"`).join(',');
  return rest2(
    `indicadores?select=id,area_id,objetivo_id,nome,indicador_chave,profile_id,meta_valor,meta_unidade,semaforo_faixas` +
    `&area_id=in.(${ids})&order=objetivo_id,indicador_chave.desc,nome`
  );
}

async function fetchProfiles(profileIds) {
  if (!profileIds.length) return [];
  const ids = profileIds.map(id => `"${id}"`).join(',');
  return rest2(`profiles?select=id,full_name&id=in.(${ids})`);
}

async function fetchObjetivoResponsaveis(objIds) {
  if (!objIds.length) return [];
  const ids = objIds.map(id => `"${id}"`).join(',');
  return rest2(
    `objetivo_responsaveis?select=objetivo_id,profile_id,concluido,data_inicio,data_fim,dias_uteis` +
    `&objetivo_id=in.(${ids})`
  );
}

// ── XLSX loader ───────────────────────────────────────────────────────────────
let XLSX;
try {
  const { createRequire } = await import('module');
  XLSX = createRequire(import.meta.url)('xlsx');
  if (!XLSX?.utils?.aoa_to_sheet) throw new Error('xlsx sem utils');
} catch {
  console.error('❌ Módulo xlsx não encontrado. Rode: npm install xlsx');
  process.exit(1);
}

// ── Status display ────────────────────────────────────────────────────────────
const STATUS_LABEL = {
  ativo:     '🔴 Não concluída',
  concluido: '✅ Concluída',
  arquivado: '📁 Arquivada',
  relancada: '🔁 Relançada',
};
const TIPO_LABEL = {
  'atingivel':           'Atingível',
  'atingivel - projeto': 'Atingível - Projeto',
  'recorrente':          'Recorrente',
};

// ── Main ──────────────────────────────────────────────────────────────────────
console.log(`\n🔍  Consultando PROD — mês: ${MES}…`);

const areas = await fetchAreas();
const areaMap = new Map(areas.map(a => [a.id, a.nome]));
const areaIds = areas.map(a => a.id);
console.log(`   ${areas.length} áreas`);

const [objMes, objAntes] = await Promise.all([
  fetchObjetivos(areaIds),
  fetchObjetivosNaoConclAntes(areaIds),
]);
const objMesIds = new Set(objMes.map(o => o.id));
const todosObjetivos = [...objMes, ...objAntes.filter(o => !objMesIds.has(o.id))];
console.log(`   ${objMes.length} metas em ${MES} + ${todosObjetivos.length - objMes.length} pendentes de meses anteriores`);

const indicadores = await fetchIndicadores(areaIds);
const indPorObjId = new Map();
for (const ind of indicadores) {
  if (!ind.objetivo_id) continue;
  if (!indPorObjId.has(ind.objetivo_id)) indPorObjId.set(ind.objetivo_id, []);
  indPorObjId.get(ind.objetivo_id).push(ind);
}

const allProfileIds = [...new Set([
  ...todosObjetivos.map(o => o.profile_id).filter(Boolean),
  ...indicadores.map(i => i.profile_id).filter(Boolean),
])];
const profiles = await fetchProfiles(allProfileIds);
const profileMap = new Map(profiles.map(p => [p.id, p.full_name ?? '—']));

// objetivo_responsaveis — com datas para Atingível
const objIds = todosObjetivos.map(o => o.id);
const objResps = await fetchObjetivoResponsaveis(objIds);

// Mapa: objetivo_id → lista de { profile_id, concluido, data_inicio, data_fim }
const objRespMap = new Map();
for (const r of objResps) {
  if (!objRespMap.has(r.objetivo_id)) objRespMap.set(r.objetivo_id, []);
  objRespMap.get(r.objetivo_id).push(r);
}

// ── Montar linhas ─────────────────────────────────────────────────────────────
const HEADER = [
  'Área',
  'Meta (Objetivo)',
  'Tipo',
  'Mês de Origem',
  'Status Meta',
  'Indicador',
  'Ind. Chave?',
  'Responsável Indicador',
  'Meta Valor',
  'Meta Unidade',
  'Verde Escuro (VE)',
  'Verde Claro (VC)',
  'Amarelo (AM)',
  'Vermelho (VM)',
  'Nota Semáforo',
  'Data Início (Resp.)',
  'Data Fim (Resp.)',
  'Dias Úteis',
  'Responsáveis da Meta',
];

const rows = [HEADER];

// Agrupado por área (mantém a ordem de areas)
const objPorArea = new Map(areas.map(a => [a.id, []]));
for (const obj of todosObjetivos) {
  objPorArea.get(obj.area_id)?.push(obj);
}

for (const area of areas) {
  const areaObjs = objPorArea.get(area.id) ?? [];
  if (!areaObjs.length) continue;

  for (const obj of areaObjs) {
    const inds = indPorObjId.get(obj.id) ?? [];
    const resps = objRespMap.get(obj.id) ?? [];

    // Responsáveis da meta (nomes dos que assumiram via objetivo_responsaveis)
    const respNomes = resps.length
      ? resps.map(r => profileMap.get(r.profile_id) ?? r.profile_id).join(', ')
      : (obj.profile_id ? (profileMap.get(obj.profile_id) ?? '—') : '—');

    // Datas de início/fim — pega a primeira entrada (ou a do responsável principal)
    const primeiroResp = resps[0] ?? null;
    const dataInicio  = primeiroResp?.data_inicio ?? '';
    const dataFim     = primeiroResp?.data_fim    ?? '';
    const diasUteis   = primeiroResp?.dias_uteis  ?? '';

    const tipoStr  = (obj.tipo ?? '').toLowerCase();
    const tipoLabel = TIPO_LABEL[tipoStr] ?? (obj.tipo ?? '—');
    const statusLabel = STATUS_LABEL[obj.status] ?? obj.status ?? '—';

    if (!inds.length) {
      const sf = parseFaixas(null, obj.tipo);
      rows.push([
        area.nome, obj.descricao, tipoLabel, obj.mes ?? MES, statusLabel,
        '(sem indicadores)', '', '',
        obj.meta_valor ?? '', obj.meta_unidade ?? '',
        sf.ve, sf.vc, sf.am, sf.vm, sf.nota,
        dataInicio, dataFim, diasUteis,
        respNomes,
      ]);
    } else {
      for (const ind of inds) {
        const sf = parseFaixas(ind.semaforo_faixas, obj.tipo);
        const respInd = ind.profile_id ? (profileMap.get(ind.profile_id) ?? '—') : '—';
        rows.push([
          area.nome, obj.descricao, tipoLabel, obj.mes ?? MES, statusLabel,
          ind.nome,
          ind.indicador_chave ? 'Sim' : 'Não',
          respInd,
          ind.meta_valor ?? obj.meta_valor ?? '',
          ind.meta_unidade ?? obj.meta_unidade ?? '',
          sf.ve, sf.vc, sf.am, sf.vm, sf.nota,
          dataInicio, dataFim, diasUteis,
          respNomes,
        ]);
      }
    }
  }
}

console.log(`   ${rows.length - 1} linhas geradas`);
console.log(`   DEBUG → colunas no header: ${rows[0].length} | colunas na 1ª linha de dados: ${rows[1]?.length ?? 'N/A'}`);

// ── Excel ─────────────────────────────────────────────────────────────────────
const wb   = XLSX.utils.book_new();
const ws   = XLSX.utils.aoa_to_sheet(rows);

ws['!cols'] = [
  { wch: 22 }, // Área
  { wch: 45 }, // Meta
  { wch: 20 }, // Tipo
  { wch: 13 }, // Mês origem
  { wch: 20 }, // Status
  { wch: 40 }, // Indicador
  { wch: 10 }, // Ind. Chave
  { wch: 25 }, // Resp. Indicador
  { wch: 12 }, // Meta Valor
  { wch: 13 }, // Meta Unidade
  { wch: 28 }, // 🟢🟢 Verde Escuro
  { wch: 25 }, // 🟢 Verde Claro
  { wch: 22 }, // 🟡 Amarelo
  { wch: 22 }, // 🔴 Vermelho
  { wch: 50 }, // Nota Semáforo
  { wch: 16 }, // Data Início
  { wch: 14 }, // Data Fim
  { wch: 12 }, // Dias Úteis
  { wch: 35 }, // Responsáveis
];

// Congela a linha de cabeçalho
ws['!freeze'] = { xSplit: 0, ySplit: 1 };

XLSX.utils.book_append_sheet(wb, ws, `Bone Day ${MES}`);

const nomeArq = `BoneDay_${MES.replace('-', '_')}.xlsx`;
XLSX.writeFile(wb, nomeArq);
console.log(`\n✅  Arquivo gerado: ${nomeArq}\n`);
