// @ts-nocheck
'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { registrarLog } from '@/hooks/useAuditLog'
import { useAdmin } from '@/context/AdminContext'
import { listarAreas } from '@/utils/areasOrder'
import PeriodoSelect from '@/components/PeriodoSelect'
import {
  isoWeek,
  semanasIsoNoIntervalo,
  semanasIsoAnoCalendario,
  expandGanttSemanasParaGradeIso,
  normalizarSemanasSelecionadasGantt,
  anoIsoParaSemanaNoIntervalo
} from '@/utils/periodos'
import DefinirMetaDrawer from '@/components/DefinirMetaDrawer'
import ComentarioModal from '@/components/ComentarioModal'
import WorkloadFormDrawer from '@/components/WorkloadFormDrawer'
import ResponsaveisAreaMultiSelect from '@/components/ResponsaveisAreaMultiSelect'
import {
  statusSemaforoPorValor,
  normalizarSemaforo,
  opToLabel,
  opcoesLancamentoGanttOrdenadas,
  valorParaSelectIndicador,
  indicadorEntradaLancamentoNumerica,
  indicadorInputModeLancamento
} from '@/utils/semaforoFaixas'
import { concluirIndicadorAtingivel } from '@/utils/indicadorConquista'
import { classificarErroSupabase } from '@/utils/supabaseErroPostgres'
import { usePastelariaGanttBloco } from '@/components/carometro/PastelariaGanttBloco'

/** Label do período (schema DEV: tipo, ano, numero — sem coluna `nome`). */
function labelPeriodo(p) {
  if (!p) return ''
  if (p.tipo === 'mes') {
    return `Mês ${String(p.numero).padStart(2, '0')}/${p.ano}`
  }
  if (p.tipo === 'bimestre') return `Bimestre ${p.numero}/${p.ano}`
  if (p.tipo === 'trimestre') return `Trimestre ${p.numero}/${p.ano}`
  if (p.tipo === 'semestre') return `Semestre ${p.numero}/${p.ano}`
  if (p.tipo === 'ano') return `Ano ${p.ano}`
  return `${p.tipo} ${p.numero ?? ''}/${p.ano}`
}

/**
 * Verifica se um registro de `gantt_planejamento` cruza a semana ISO informada.
 * Usa `semanas_selecionadas` e/ou intervalo `semana_inicio`–`semana_fim` (não existe coluna `semana`).
 */
function planejamentoCaiNaSemanaIso(gp, semanaISO, semanasGrid) {
  const sn = Number(semanaISO)
  if (!gp || !Number.isFinite(sn)) return false
  const gridSet = new Set((semanasGrid || []).map(Number).filter(Number.isFinite))
  if (gridSet.size > 0 && !gridSet.has(sn)) return false
  const ss = normalizarSemanasSelecionadasGantt(gp.semanas_selecionadas)
  if (ss.some(w => Number(w) === sn)) return true
  if (gp.semana_inicio != null && gp.semana_fim != null) {
    const si = Number(gp.semana_inicio)
    const sf = Number(gp.semana_fim)
    if (Number.isFinite(si) && Number.isFinite(sf) && si <= sf) {
      return sn >= si && sn <= sf
    }
  }
  return false
}

/** Datas curtas segunda–domingo para o cabeçalho da grade (alinha ao período quando possível). */
function getDatasSemanaCurtaFallbackSimples(semanaISO, ano) {
  const y = Number.isFinite(ano) ? ano : new Date().getFullYear()
  const simples = new Date(Date.UTC(y, 0, 1 + (semanaISO - 1) * 7))
  const diaSemana = simples.getUTCDay() || 7
  const segunda = new Date(simples)
  segunda.setUTCDate(simples.getUTCDate() - diaSemana + 1)
  const domingo = new Date(segunda)
  domingo.setUTCDate(segunda.getUTCDate() + 6)
  const fmt = d => `${d.getUTCDate()}/${d.getUTCMonth() + 1}`
  if (segunda.getUTCMonth() !== domingo.getUTCMonth()) {
    return `${fmt(segunda)}–${fmt(domingo)}`
  }
  return `${segunda.getUTCDate()}–${fmt(domingo)}`
}

function getDatasSemanaCurta(semanaISO, periodoRow) {
  const sn = Number(semanaISO)
  if (!Number.isFinite(sn) || sn < 1 || sn > 53) return ''
  if (periodoRow?.data_inicio && periodoRow?.data_fim) {
    const ini = new Date(`${periodoRow.data_inicio}T12:00:00`)
    const fim = new Date(`${periodoRow.data_fim}T12:00:00`)
    if (!Number.isNaN(ini.getTime()) && !Number.isNaN(fim.getTime()) && ini <= fim) {
      let sample = null
      for (let t = ini.getTime(); t <= fim.getTime(); t += 86400000) {
        const cur = new Date(t)
        if (isoWeek(cur) === sn) {
          sample = cur
          break
        }
      }
      if (sample) {
        const d0 = new Date(sample.getFullYear(), sample.getMonth(), sample.getDate())
        const dow = d0.getDay()
        const monday = new Date(d0)
        monday.setDate(d0.getDate() - (dow === 0 ? 6 : dow - 1))
        const domingo = new Date(monday)
        domingo.setDate(monday.getDate() + 6)
        const fmt = dt => `${dt.getDate()}/${dt.getMonth() + 1}`
        if (monday.getMonth() !== domingo.getMonth()) {
          return `${fmt(monday)}–${fmt(domingo)}`
        }
        return `${monday.getDate()}–${fmt(domingo)}`
      }
    }
  }
  const ano = periodoRow?.ano != null ? Number(periodoRow.ano) : new Date().getFullYear()
  return getDatasSemanaCurtaFallbackSimples(sn, ano)
}

/** Script de `supabase-area-pessoas.sql` — executar no Supabase (SQL Editor) se a tabela não existir. */
const SQL_AREA_PESSOAS = `CREATE TABLE IF NOT EXISTS area_pessoas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ordem int DEFAULT 0,
  ativo boolean DEFAULT true,
  criado_em timestamptz DEFAULT now(),
  CONSTRAINT area_pessoas_area_nome_unique UNIQUE (area_id, nome)
);

CREATE INDEX IF NOT EXISTS idx_area_pessoas_area_id ON area_pessoas(area_id);

COMMENT ON TABLE area_pessoas IS 'Pessoas da equipe por área; nomes incluídos no Planejamento (Gantt) via "+ Novo responsável…" na própria tela.';

ALTER TABLE area_pessoas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "area_pessoas_select" ON area_pessoas;
DROP POLICY IF EXISTS "area_pessoas_insert" ON area_pessoas;
DROP POLICY IF EXISTS "area_pessoas_update" ON area_pessoas;
DROP POLICY IF EXISTS "area_pessoas_delete" ON area_pessoas;

CREATE POLICY "area_pessoas_select" ON area_pessoas FOR SELECT USING (true);
CREATE POLICY "area_pessoas_insert" ON area_pessoas FOR INSERT WITH CHECK (true);
CREATE POLICY "area_pessoas_update" ON area_pessoas FOR UPDATE USING (true);
CREATE POLICY "area_pessoas_delete" ON area_pessoas FOR DELETE USING (true);
`

/** Manter alinhado a `supabase-gantt-planejamento-colunas-completas.sql` (copiar/colar no Supabase). */
const SQL_GANTT_PLANEJAMENTO_COLUNAS_COMPLETAS = `CREATE TABLE IF NOT EXISTS casas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  area_id uuid REFERENCES areas(id),
  criado_em timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS adm_cnpjs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj text NOT NULL,
  descritivo text NOT NULL,
  criado_em timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_casas_area_id ON casas(area_id);

ALTER TABLE casas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "casas_select" ON casas;
DROP POLICY IF EXISTS "casas_insert" ON casas;
DROP POLICY IF EXISTS "casas_update" ON casas;
DROP POLICY IF EXISTS "casas_delete" ON casas;
CREATE POLICY "casas_select" ON casas FOR SELECT USING (true);
CREATE POLICY "casas_insert" ON casas FOR INSERT WITH CHECK (true);
CREATE POLICY "casas_update" ON casas FOR UPDATE USING (true);
CREATE POLICY "casas_delete" ON casas FOR DELETE USING (true);

ALTER TABLE gantt_planejamento
  ADD COLUMN IF NOT EXISTS semanas_selecionadas int[] DEFAULT '{}';

ALTER TABLE gantt_planejamento
  ADD COLUMN IF NOT EXISTS franqueado_nome text;

ALTER TABLE gantt_planejamento
  ADD COLUMN IF NOT EXISTS casa_id uuid REFERENCES casas(id);

ALTER TABLE gantt_planejamento
  ADD COLUMN IF NOT EXISTS adm_cnpj_id uuid REFERENCES adm_cnpjs(id);

CREATE TABLE IF NOT EXISTS controladoria_cnpjs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj text NOT NULL,
  descritivo text NOT NULL,
  criado_em timestamptz DEFAULT now()
);

ALTER TABLE gantt_planejamento
  ADD COLUMN IF NOT EXISTS controladoria_cnpj_id uuid REFERENCES controladoria_cnpjs(id);

CREATE TABLE IF NOT EXISTS juridico_identificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('franqueado', 'candidato', 'inc_nuvem', 'interno')),
  oculto boolean NOT NULL DEFAULT false,
  criado_em timestamptz DEFAULT now()
);

ALTER TABLE gantt_planejamento
  ADD COLUMN IF NOT EXISTS juridico_identificacao_id uuid REFERENCES juridico_identificacoes(id),
  ADD COLUMN IF NOT EXISTS juridico_tipo text CHECK (
    juridico_tipo IS NULL OR
    juridico_tipo IN ('franqueado', 'candidato', 'inc_nuvem', 'interno')
  );

ALTER TABLE gantt_planejamento DROP CONSTRAINT IF EXISTS gantt_planejamento_trimestre_id_acao_id_key;
`

const SQL_PGRST_RELOAD_SCHEMA = `NOTIFY pgrst, 'reload schema';`

const SQL_GRANT_INDICADOR_CONQUISTAS = `GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE indicador_conquistas
  TO anon, authenticated;
NOTIFY pgrst, 'reload schema';`

const TOAST_ERRO_PERMISSAO_INDICADOR_CONQUISTAS =
  'Erro de permissão na tabela indicador_conquistas. Execute no Supabase: GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE indicador_conquistas TO anon, authenticated;'

/** Erro de GRANT/RLS em `indicador_conquistas` (não confundir com schema cache / coluna ausente). */
function erroIndicaPermissaoIndicadorConquistas(msg) {
  return classificarErroSupabase(msg) === 'permission'
}

/** Tabela `indicador_conquistas` realmente inexistente no banco. */
function erroIndicaTabelaIndicadorConquistasAusente(msg) {
  const m = String(msg ?? '').toLowerCase()
  if (erroIndicaPermissaoIndicadorConquistas(m)) return false
  return (
    m.includes('does not exist') ||
    (m.includes('relation') && m.includes('not found')) ||
    m.includes('could not find the table')
  )
}

/** Banner vermelho do topo: não exibir mensagem genérica de tabela ausente quando for permissão. */
function deveExibirBannerErroGantt(msg) {
  const e = String(msg ?? '')
  if (!e) return false
  if (erroIndicaPermissaoIndicadorConquistas(e)) return false
  if (erroIndicaTabelaAdmCnpjsAusente(e)) return false
  if (e.includes('Tabela indicador_conquistas ausente')) {
    return erroIndicaTabelaIndicadorConquistasAusente(e)
  }
  return true
}

function logSqlGrantIndicadorConquistas() {
  console.log('[Gantt] Execute no Supabase → SQL Editor:\n\n' + SQL_GRANT_INDICADOR_CONQUISTAS)
}

/** Distingue GRANT ausente de tabela inexistente (mensagem do util pode ser genérica). */
async function diagnosticarAcessoIndicadorConquistas(supabaseClient) {
  const { error } = await supabaseClient.from('indicador_conquistas').select('id').limit(0)
  if (!error) return 'ok'
  const kind = classificarErroSupabase(error)
  if (kind === 'missing_table') return 'missing'
  if (kind === 'permission') return 'permission'
  return 'other'
}

/** Em dev: log do valor bruto vindo do PostgREST (antes de qualquer processamento na UI). */
function logRawFranqueadoNomePlanejamento(planejamentoData) {
  if (process.env.NODE_ENV !== 'development' || !Array.isArray(planejamentoData) || planejamentoData.length === 0) return
  const comFn = planejamentoData.filter(g => g.franqueado_nome != null && g.franqueado_nome !== '')
  if (comFn.length === 0) return
  try {
    const payload = comFn.map(g => ({
      id: g.id,
      raw: g.franqueado_nome,
      type: typeof g.franqueado_nome,
      isArray: Array.isArray(g.franqueado_nome),
      json: JSON.stringify(g.franqueado_nome)
    }))
    console.log('[RAW franqueado_nome]', JSON.stringify(payload))
  } catch (err) {
    console.warn('[RAW franqueado_nome] falha ao serializar', err, comFn)
  }
}

function erroIndicaTabelaAreaPessoasAusente(err) {
  const m = String(err?.message ?? err ?? '')
  return /area_pessoas/i.test(m) && (/schema cache|does not exist|Could not find|PGRST205/i.test(m))
}

function erroIndicaTabelaAdmCnpjsAusente(err) {
  const m = String(err?.message ?? err ?? '')
  return /adm_cnpjs/i.test(m) && (/schema cache|does not exist|Could not find|PGRST205/i.test(m))
}

const SQL_ADM_CNPJS = `CREATE TABLE IF NOT EXISTS adm_cnpjs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj text NOT NULL,
  descritivo text NOT NULL,
  criado_em timestamptz DEFAULT now()
);

ALTER TABLE gantt_planejamento
  ADD COLUMN IF NOT EXISTS adm_cnpj_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gantt_planejamento_adm_cnpj_id_fkey'
  ) THEN
    ALTER TABLE gantt_planejamento
      ADD CONSTRAINT gantt_planejamento_adm_cnpj_id_fkey
      FOREIGN KEY (adm_cnpj_id) REFERENCES adm_cnpjs(id) ON DELETE SET NULL;
  END IF;
END $$;

GRANT ALL ON TABLE adm_cnpjs TO anon, authenticated;
ALTER TABLE adm_cnpjs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_adm_cnpjs" ON adm_cnpjs;
CREATE POLICY "allow_all_adm_cnpjs" ON adm_cnpjs FOR ALL USING (true) WITH CHECK (true);
NOTIFY pgrst, 'reload schema';`

/** `indicador_lancamentos.periodo_id` ausente no PostgREST (schema cache / Could not find column). */
function erroIndicaColunaPeriodoIdLancamentos(err) {
  const m = String(err?.message ?? err ?? '').toLowerCase()
  if (!m.includes('periodo_id')) return false
  return (
    m.includes('indicador_lancamentos') ||
    m.includes('column') ||
    m.includes('schema cache') ||
    m.includes('could not find')
  )
}

/** `indicador_lancamentos.semana`: posição relativa ao período de gravação (`periodo_id`), 1 = 1ª semana a partir de `periodos.data_inicio`. */
function erroIndicaColunaSemanaAnoLancamentos(err) {
  const m = String(err?.message ?? err ?? '').toLowerCase()
  if (!m.includes('semana_ano')) return false
  return (
    m.includes('indicador_lancamentos') ||
    m.includes('column') ||
    m.includes('does not exist') ||
    m.includes('schema cache') ||
    m.includes('could not find')
  )
}

function erroEhChaveDuplicadaIndicador(err) {
  const m = String(err?.message ?? err ?? '').toLowerCase()
  return err?.code === '23505' || m.includes('duplicate key') || m.includes('unique constraint')
}

function erroIndicaColunaObjetivosComentarioConclusao(err) {
  const m = String(err?.message ?? err ?? '')
  return (
    /comentario_conclusao/i.test(m) &&
    (/objetivos/i.test(m) ||
      /schema cache|PGRST204|could not find|does not exist|column/i.test(m))
  )
}

function erroIndicaColunaObjetivosConcluidoEm(err) {
  const m = String(err?.message ?? err ?? '')
  return (
    /concluido_em/i.test(m) &&
    (/objetivos/i.test(m) ||
      /schema cache|PGRST204|could not find|does not exist|column/i.test(m))
  )
}

function erroIndicaColunaObjetivosStatus(err) {
  const m = String(err?.message ?? err ?? '')
  return (
    /\bstatus\b/i.test(m) &&
    (/objetivos/i.test(m) ||
      /schema cache|PGRST204|could not find|does not exist|column/i.test(m))
  )
}

/** Mantemos a grade por semana ISO (1–53). */

const FAROL_BG = { ve: '#1a6b3a', vc: '#4caf50', am: '#f9a825', vm: '#c0392b' }
const FAROL_LABEL = { ve: 'Verde escuro', vc: 'Verde claro', am: 'Amarelo', vm: 'Vermelho' }
const FAROL_DOT = ['#1a6b3a', '#4caf50', '#f9a825', '#c0392b']
/** Legenda fixa na linha do Gantt (escala ≥75% … <30%). Tooltip ainda usa `FAROL_DOT` / faixas do JSON. */
const INDICADOR_LEGENDA_DOT = ['#0F7A4A', '#5A9A1A', '#C07800', '#B01A1A']

const GANTT_ACAO_BTN_EDITAR = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 24,
  height: 24,
  border: '1px solid #B4B2A9',
  borderRadius: 5,
  background: 'var(--color-background-primary)',
  color: '#5F5E5A',
  fontSize: 14,
  cursor: 'pointer',
  lineHeight: 1,
  padding: 0
}
/** Bordas da coluna da semana atual (grade unificada). */
const GANTT_BORDA_SEMANA_ATUAL_CEL = {
  borderLeft: '2px dashed #2F4A3A',
  borderRight: '2px dashed #2F4A3A'
}
const GANTT_BORDA_SEMANA_ATUAL_HDR = {
  borderLeft: '2px dashed rgba(255,255,255,0.4)',
  borderRight: '2px dashed rgba(255,255,255,0.4)',
  borderTop: '2px dashed rgba(255,255,255,0.4)'
}

const GANTT_ACAO_BTN_EXCLUIR = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 24,
  height: 24,
  border: '1px solid #B4B2A9',
  borderRadius: 5,
  background: 'var(--color-background-primary)',
  color: '#5F5E5A',
  fontSize: 16,
  fontWeight: 400,
  cursor: 'pointer',
  lineHeight: 1,
  padding: 0
}

/** Paleta por índice na lista ordenada de casas da área (Produto / Projetos - Modelo Virtual). */
const PALETA_CASAS = [
  { bg: '#E6F1FB', text: '#0C447C' },
  { bg: '#F3EEFE', text: '#3C3489' },
  { bg: '#FEF3E6', text: '#7A3A00' },
  { bg: '#E6FBF3', text: '#0A5C38' },
  { bg: '#FEE6E6', text: '#7A0000' },
  { bg: '#F3F3FE', text: '#3A3A89' },
  { bg: '#FEFCE6', text: '#7A6A00' },
  { bg: '#F1EFE8', text: '#5F5E5A' }
]

function getCorCasa(index) {
  return PALETA_CASAS[index % PALETA_CASAS.length]
}

const GANTT_PLANEJAMENTO_SELECT_COLS =
  'id, acao_id, periodo_id, objetivo_id, responsavel, semanas_selecionadas, semana_inicio, semana_fim, casa_id, franqueado_nome, adm_cnpj_id, controladoria_cnpj_id, juridico_identificacao_id, juridico_tipo, comercial_candidato_id, portfolio_franqueado_id'

/** JOIN com `casas` só nas áreas Produto / Projetos - Modelo Virtual — evita erro global se a migration não existir. */
function selectGanttPlanejamentoRows(comJoinCasas) {
  return GANTT_PLANEJAMENTO_SELECT_COLS
}

/** Nome de área estável (trim + Unicode NFC) — evita mismatch invisível com o banco. */
function nomeAreaNorm(nome) {
  return String(nome ?? '').trim().normalize('NFC')
}

/**
 * Áreas com campo Casa no planejamento (lista filtrada por `area_id`, células empilhadas, legenda).
 * Cobre Produto e Projetos - Modelo Virtual; `Projetos` sozinho é alias (seed legado em `Areas.jsx`).
 */
function isNomeAreaComCasas(nome) {
  const n = nomeAreaNorm(nome).toLowerCase()
  return ['produto', 'projetos - modelo virtual', 'projetos'].some(ref => n === nomeAreaNorm(ref).toLowerCase())
}

/** Área Jurídico no planejamento Gantt (tipo de demanda + identificação). */
function isNomeAreaJuridico(nome) {
  return nomeAreaNorm(nome).toLowerCase() === 'jurídico'
}

const JURIDICO_AREA_ID = '62cefce4-ad87-46cf-b96a-2ac7e76ace08'

const JURIDICO_TIPO_OPCOES = [
  { value: 'franqueado', label: 'Franqueado' },
  { value: 'candidato', label: 'Candidato' },
  { value: 'inc_nuvem', label: 'INC Nuvem' },
  { value: 'interno', label: 'Interno' }
]

const JURIDICO_TIPO_LABEL = {
  franqueado: 'Franqueado',
  candidato: 'Candidato',
  inc_nuvem: 'INC Nuvem',
  interno: 'Interno'
}

function labelJuridicoTipo(tipo) {
  return JURIDICO_TIPO_LABEL[String(tipo || '').trim()] || ''
}

/** Chave estável para agrupar linhas da mesma ação com o mesmo planejamento de semanas (multi-casa). */
function chaveAcaoSemanasPlanejamento(reg) {
  const aid = String(reg?.acao_id ?? '')
  const ss = normalizarSemanasSelecionadasGantt(reg?.semanas_selecionadas)
    .slice()
    .sort((a, b) => a - b)
    .join(',')
  return `${aid}|${ss}`
}

/**
 * Planos da mesma atividade que cruzam a coluna ISO `sn` (expand + fallback direto em semanas_selecionadas).
 * Depois inclui **todas** as linhas com mesma ação + mesmo `semanas_selecionadas` que alguma linha já
 * incluída (evita “só a primeira casa” na célula quando o expand diverge entre linhas).
 */
function registrosPlanejamentoNaSemanaIso(rowsPlano, sn, semanasGrid) {
  if (!rowsPlano?.length) return []
  const snn = Number(sn)
  const semanasGridNorm = (semanasGrid || []).map(Number).filter(Number.isFinite)
  const matched = rowsPlano.filter(reg => planejamentoCaiNaSemanaIso(reg, snn, semanasGridNorm))
  if (matched.length === 0) return []
  const byId = new Map()
  const semId = []
  for (const r of matched) {
    if (r?.id != null && r.id !== '') byId.set(String(r.id), r)
    else semId.push(r)
  }
  return [...Array.from(byId.values()), ...semId]
}

function idxToFarolKey(i) {
  if (i === 0) return 've'
  if (i === 1) return 'vc'
  if (i === 2) return 'am'
  return 'vm'
}

/** Compara ids de meta/objetivo (uuid) de forma estável entre tarefas e objetivos. */
function idObjetivoIgual(a, b) {
  if (a == null || b == null) return false
  return String(a).replace(/-/g, '').toLowerCase() === String(b).replace(/-/g, '').toLowerCase()
}

/** Alinha `objetivo_id` vindo de tarefa/indicador ao `id` retornado em `objetivos` (chaves de `indicadoresPorObjetivo`). */
function metaIdCanonica(metas, oid) {
  if (oid == null || oid === '_sem') return oid
  const found = (metas || []).find(m => idObjetivoIgual(m.id, oid))
  return found?.id ?? oid
}

const metaConcluida = (obj) =>
  String(obj?.status || '').toLowerCase() === 'concluido' ||
  String(obj?.status || '').toLowerCase() === 'fechado' ||
  obj?.concluido === true

const semanaConclusaoLabel = (obj) => {
  const raw = obj?.concluido_em
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return null
  return `S${n}`
}

const metaDeveAparecerNoPeriodo = (obj, minSemanaVisivel) => {
  if (!metaConcluida(obj)) return true
  if (!Number.isFinite(minSemanaVisivel)) return true
  const semConc = Number(obj?.concluido_em)
  if (!Number.isFinite(semConc) || semConc <= 0) return true
  // Aparece apenas se foi concluída durante ou após este período (comparado pelo início do período).
  return semConc >= minSemanaVisivel
}

function franqueadoNomeParaExibicao(valor) {
  if (valor === null || valor === undefined) return ''
  if (typeof valor === 'string') return valor.trim()
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor)
  if (Array.isArray(valor)) {
    return valor
      .map(item => (item === null || item === undefined ? '' : String(item)))
      .filter(Boolean)
      .join(', ')
      .trim()
  }
  if (typeof valor === 'object') {
    const keys = Object.keys(valor)
    const todasNumericas = keys.length > 0 && keys.every(k => /^\d+$/.test(k))
    if (todasNumericas) {
      return keys
        .sort((a, b) => Number(a) - Number(b))
        .map(k => valor[k])
        .join('')
        .trim()
    }
    if (valor.nome != null && valor.nome !== '') return String(valor.nome).trim()
    return ''
  }
  return ''
}

/** Texto opcional do franqueado (Acoplamento); vazio → null para comparação no banco. */
function normalizeFranqueadoNome(v) {
  const exib = franqueadoNomeParaExibicao(v)
  return exib === '' ? null : exib
}

/** Nome do candidato para exibição no Gantt (Comercial). */
function nomeCandidatoComercialReg(reg, comercialCandidatosLista) {
  const idRef = reg?.comercial_candidato_id
  const porId =
    idRef != null && String(idRef).trim() !== ''
      ? (comercialCandidatosLista || []).find(c => String(c.id) === String(idRef))?.nome
      : null
  const raw = porId ?? reg?.comercial_candidato_nome
  if (raw == null || raw === '') return ''
  return String(raw).trim()
}

/** Nome do franqueado para exibição no Gantt (Acoplamento): id na lista → texto salvo em franqueado_nome (legado). */
function nomeFranqueadoAcoplamentoReg(reg, acoplamentoFranqueadosLista) {
  const idRef = reg?.acoplamento_franqueado_id
  const porId =
    idRef != null && String(idRef).trim() !== ''
      ? (acoplamentoFranqueadosLista || []).find(f => String(f.id) === String(idRef))?.nome
      : null
  const raw = porId ?? reg?.franqueado_nome
  if (raw == null || raw === '') return ''
  return typeof raw === 'string' ? raw.trim() : franqueadoNomeParaExibicao(raw)
}

/** Tag discreta abaixo do quadradinho (Acoplamento). Largura segue a coluna (densidade); trunca com ellipsis. */
const TAG_FRANQUEADO_STYLE = {
  fontSize: 9,
  fontStyle: 'italic',
  fontWeight: 500,
  whiteSpace: 'nowrap',
  maxWidth: 100,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  textAlign: 'center',
  padding: '1px 4px',
  borderRadius: 3,
  background: '#F1EFE8',
  color: '#5F5E5A',
  display: 'block',
  marginTop: 2,
  boxSizing: 'border-box'
}

/** Converte o texto salvo em `gantt_planejamento.responsavel` em ids de `area_pessoas`. */
function responsavelStrParaIds(str, pessoas) {
  const t = String(str ?? '').trim()
  if (!t || t === '—') return []
  const nomes = t.split(',').map(s => s.trim()).filter(Boolean)
  const ids = []
  for (const n of nomes) {
    const p = (pessoas || []).find(x => String(x.nome ?? '').trim().toLowerCase() === n.toLowerCase())
    if (p?.id) ids.push(p.id)
  }
  return ids
}

/** Sem faixas válidas e sem limiares legado → só cor base (sem cálculo de semáforo). */
function indicadorSemRegrasDeCor(ind) {
  const norm = normalizarSemaforo(ind)
  if (norm.faixas && norm.faixas.length >= 4) return false
  const hasLegacy =
    ind?.regra_verde_escuro != null ||
    ind?.regra_verde_claro != null ||
    ind?.regra_amarelo != null
  return !hasLegacy
}

/** PostgREST: FK `periodos` vem como objeto ou array de um elemento. */
function periodoEmbutidoDeLancamentoIndicador(row) {
  const p = row?.periodos
  if (Array.isArray(p)) return p[0] || null
  return p && typeof p === 'object' ? p : null
}

/**
 * Posição relativa (1 = ancorada em `data_inicio` do período gravado) → semana ISO da data resultante.
 * Alinhado a `isoWeek` em `periodos.js` (mesma convenção do restante do Gantt).
 */
function posicaoRelativaParaSemanaIso(semanaRelativa, dataInicioPeriodo) {
  const rel = Number(semanaRelativa)
  if (!Number.isFinite(rel) || rel < 1) return null
  const raw = String(dataInicioPeriodo ?? '').trim().slice(0, 10)
  if (!raw) return null
  const d = new Date(`${raw}T12:00:00`)
  if (Number.isNaN(d.getTime())) return null
  d.setDate(d.getDate() + (rel - 1) * 7)
  const w = isoWeek(d)
  return Number.isFinite(w) ? w : null
}

/** Semana ISO de uma coluna → posição 1-based dentro do período de gravação (lista ISO do intervalo). */
function semanaIsoParaPosicaoNoPeriodoGravacao(semanaIso, dataInicio, dataFim) {
  const sn = Number(semanaIso)
  if (!Number.isFinite(sn) || !dataInicio || !dataFim) return null
  const weeks = semanasIsoNoIntervalo(dataInicio, dataFim)
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
  const idx = weeks.indexOf(sn)
  return idx >= 0 ? idx + 1 : null
}

/**
 * Converte uma linha de `indicador_lancamentos` para a semana ISO **somente se** essa ISO estiver nas colunas
 * do período **visualizado** (`semanasSet`). Usa `(periodo_id + data_inicio do período gravado, semana relativa)`;
 * não mapeia posição pela ordem das colunas do mês/visão.
 */
function semanaDbParaIsoNaGrade(row, semanasOrderedAsc, semanasSet) {
  const ordered = semanasOrderedAsc || []
  if (!ordered.length) return null
  if (row.semana_ano != null && row.semana_ano !== '') {
    const raw = String(row.semana_ano).trim().replace(',', '.')
    const w = Number(raw)
    if (Number.isFinite(w) && semanasSet.has(w)) return w
    return null
  }
  // Fallback direto: se semana_ano é null mas semana existe e está no grid, usar semana como ISO
  if ((row.semana_ano == null || row.semana_ano === '') && row.semana != null) {
    const s = Number(row.semana)
    if (Number.isFinite(s) && semanasSet.has(s)) return s
  }
  const emb = periodoEmbutidoDeLancamentoIndicador(row)
  const dataIni = emb?.data_inicio ?? row?._periodo_inicio
  if (dataIni) {
    const isoReal = posicaoRelativaParaSemanaIso(row.semana, dataIni)
    if (isoReal != null && Number.isFinite(isoReal) && semanasSet.has(isoReal)) return isoReal
    return null
  }
  const s = Number(row.semana)
  if (!Number.isFinite(s)) return null
  if (semanasSet.has(s)) return s
  return null
}

function getStatusCelula(mapaStatus, baseKey, semana) {
  // Apenas chave exata — sem fallback entre planejamentos
  return mapaStatus[baseKey]?.[semana]
}

function cronogramaStatusEhConcluido(st) {
  return String(st ?? '').trim().toLowerCase() === 'concluido'
}

/** Chave alinhada ao mapaStatus/mapaHoras (`a_{acaoId}__p_{planejamentoId}`). */
function rowKeyMapaCronogramaReg(reg, l, acaoIdFallback) {
  const aid = reg?.acao_id ?? l?.acaoId ?? acaoIdFallback
  if (aid == null || aid === '') return null
  const base = `a_${aid}`
  const pid = reg?.id ?? reg?.planejamento_id
  return pid != null && String(pid).trim() !== '' ? `${base}__p_${String(pid)}` : base
}

/**
 * Monta o mapa indicador → { semanaIso: { id, valor } } para lookup nas colunas da grade (semanas ISO).
 */
function buildLancamentosPorIndicadorFromRows(rows, indIds, semanasOrderedAsc) {
  const ordered = [...(semanasOrderedAsc || [])].map(Number).filter(Number.isFinite).sort((a, b) => a - b)
  const semanasSet = new Set(ordered)
  const porInd = {}
  indIds.forEach(id => { porInd[id] = {} })
  if (!rows?.length) return porInd
  rows.forEach(row => {
    const w = semanaDbParaIsoNaGrade(row, ordered, semanasSet)
    if (w == null || !Number.isFinite(w) || !semanasSet.has(w)) return
    const iid = row.indicador_id
    if (!porInd[iid]) porInd[iid] = {}
    porInd[iid][w] = { id: row.id, valor: row.valor }
  })
  return porInd
}

/** Une linhas de `indicador_lancamentos` por `id` (evita duplicata ao mesclar periodo_id preenchido + null). */
function mergeLancamentoRowsById(base, extra) {
  const byId = new Map((base || []).filter(Boolean).map(r => [r.id, r]))
  ;(extra || []).forEach(r => {
    if (r?.id && !byId.has(r.id)) byId.set(r.id, r)
  })
  return Array.from(byId.values())
}

/**
 * Ordem para `buildLancamentosPorIndicadorFromRows`: a última linha que mapeia à mesma célula vence.
 * Preferência: periodo_id === período atual > periodo_id nulo (legado) > outro periodo_id; empate por criado_em (mais recente por último).
 */
function ordenarLancamentosIndicadorParaGrade(rows, periodoIdAtual, schemaTemPeriodoId) {
  if (!rows?.length) return rows
  const arr = [...rows]
  const score = r => {
    if (!schemaTemPeriodoId || r?.periodo_id === undefined) return 0
    if (r.periodo_id === periodoIdAtual) return 2
    if (r.periodo_id == null || r.periodo_id === '') return 1
    return 0
  }
  arr.sort((a, b) => {
    const d = score(a) - score(b)
    if (d !== 0) return d
    const ta = new Date(a?.criado_em || 0).getTime()
    const tb = new Date(b?.criado_em || 0).getTime()
    return ta - tb
  })
  return arr
}

/** Bolinhas da escala (legenda) + nome + tooltip com faixas (portal no body). */
function SemaforoIndicadorIcone({ indicador, concluido }) {
  const wrapRef = useRef(null)
  const [tip, setTip] = useState(null)
  const norm = normalizarSemaforo(indicador)
  const faixas = Array.isArray(norm.faixas) ? norm.faixas : []
  const nomeTxt = String(indicador?.nome || '—').trim() || '—'

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 11,
          color: '#0A2D5C',
          minWidth: 0,
          width: '100%'
        }}
      >
        <div
          ref={wrapRef}
          style={{ display: 'flex', gap: 2, flexShrink: 0 }}
          onMouseEnter={() => {
            const el = wrapRef.current
            if (!el) return
            const r = el.getBoundingClientRect()
            setTip({ left: r.left + r.width / 2, top: r.top })
          }}
          onMouseLeave={() => setTip(null)}
          aria-hidden
        >
          {INDICADOR_LEGENDA_DOT.map((c, i) => (
            <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: c, flexShrink: 0 }} />
          ))}
        </div>
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
            ...(concluido ? {
              textDecoration: 'line-through',
              color: '#888780',
              opacity: 0.8
            } : {})
          }}
          title={nomeTxt !== '—' ? nomeTxt : undefined}
        >
          {nomeTxt}
        </span>
      </div>
      {tip && createPortal(
        <div
          style={{
            position: 'fixed',
            left: tip.left,
            top: tip.top - 8,
            transform: 'translate(-50%, -100%)',
            zIndex: 100000,
            background: '#1a2535',
            borderRadius: 8,
            padding: '10px 12px',
            width: 200,
            boxSizing: 'border-box',
            fontSize: 11,
            color: '#e8eef5',
            pointerEvents: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)'
          }}
        >
          {faixas.length >= 4 ? (
            faixas.slice(0, 4).map((f, i) => {
              const fk = idxToFarolKey(i)
              const dot = f?.cor || FAROL_DOT[i]
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: i < 3 ? 8 : 0 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0, marginTop: 3 }} />
                  <span style={{ lineHeight: 1.35 }}>
                    <strong style={{ color: '#fff' }}>{FAROL_LABEL[fk]}</strong>
                    {' · '}
                    {opToLabel(f?.comparacao)} {f?.limite != null && f.limite !== '' ? String(f.limite) : '—'}
                  </span>
                </div>
              )
            })
          ) : (
            <span style={{ color: '#a8b8c8' }}>Regras numéricas legadas (sem faixas no JSON).</span>
          )}
        </div>,
        document.body
      )}
    </>
  )
}

/**
 * Próximo/anterior elemento focável na ordem do documento (tabindex ≥ 0, visível).
 * Usado no input de indicador para await onCommit antes de mudar o foco (Tab sem corrida com blur assíncrono).
 */
function focusAdjacentTabbable(fromEl, backwards) {
  if (!fromEl || typeof document === 'undefined') return
  const sel =
    'a[href]:not([tabindex="-1"]), button:not([tabindex="-1"]), input:not([tabindex="-1"]), select:not([tabindex="-1"]), textarea:not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])'
  const nodes = []
  document.querySelectorAll(sel).forEach(el => {
    if (!(el instanceof HTMLElement)) return
    if (el.tabIndex < 0) return
    if ('disabled' in el && el.disabled) return
    if (el.getAttribute('aria-hidden') === 'true') return
    if (el.closest('[inert]')) return
    const cs = window.getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden') return
    nodes.push(el)
  })
  const i = nodes.indexOf(fromEl)
  if (i < 0) return
  const next = nodes[backwards ? i - 1 : i + 1]
  next?.focus()
}

/** Tooltip Moní ao hover nas células de semana com comentário (apenas apresentação). */
function GanttCelulaComentarioWrap({ semana, textoComentario, children, variant = 'cell' }) {
  const tip = textoComentario != null ? String(textoComentario).trim() : ''
  if (!tip) return children
  const snLabel = semana != null && String(semana) !== '' ? String(semana) : '?'
  const isPill = variant === 'pill'
  return (
    <div
      className={isPill ? 'gantt-dots-tooltip-wrap gantt-dots-tooltip-wrap--pill' : 'gantt-dots-tooltip-wrap gantt-dots-tooltip-wrap--cell'}
      style={
        isPill
          ? { position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }
          : { position: 'relative', display: 'inline-block', width: '100%', height: '100%' }
      }
    >
      {children}
      <span className="gantt-comentario-dots" aria-hidden>
        ···
      </span>
      <div className="gantt-dots-tooltip" role="tooltip">
        <div className="gantt-dots-tooltip-header">S{snLabel}</div>
        <div className="gantt-dots-tooltip-body">{tip}</div>
      </div>
    </div>
  )
}

/** Envolve pill de atividade com indicador + tooltip (somente apresentação). */
function envolverPillComentarioAcao(pillEl, semanaNum, textoComentario) {
  const tip = textoComentario != null ? String(textoComentario).trim() : ''
  if (!tip) return pillEl
  return (
    <GanttCelulaComentarioWrap semana={semanaNum} textoComentario={tip} variant="pill">
      {pillEl}
    </GanttCelulaComentarioWrap>
  )
}

function IndicadorSemanaInput({ indicador, semana, semanaAtual, valueEntry, onCommit, comentarioTooltip }) {
  const inputRef = useRef(null)
  const draftRef = useRef('')
  const skipBlurCommitRef = useRef(false)
  /** Evita segundo commit quando Enter já persistiu e disparamos blur() programaticamente */
  const ignoreNextBlurRef = useRef(false)
  const onCommitRef = useRef(onCommit)
  /** Abrir edição pelo "—": focar o input após o input existir no DOM (evita corrida com commit do React). */
  const focusPillFromDashRef = useRef(false)
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState('')

  const hasStored = valueEntry?.valor != null && String(valueEntry.valor).trim() !== ''
  const storedStr = hasStored ? String(valueEntry.valor) : ''

  const opcoesDiscrete = opcoesLancamentoGanttOrdenadas(indicador)
  const usarSelect = opcoesDiscrete.length > 0
  const selectVal = usarSelect ? valorParaSelectIndicador(indicador, storedStr, opcoesDiscrete) : ''
  const entradaNumerica = indicadorEntradaLancamentoNumerica(indicador)
  const inputModeLancamento = indicadorInputModeLancamento(indicador)

  useEffect(() => {
    onCommitRef.current = onCommit
  }, [onCommit])

  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  useEffect(() => {
    if (!focused && !usarSelect) {
      setDraft(storedStr)
      draftRef.current = storedStr
    }
  }, [storedStr, valueEntry?.id, valueEntry?.valor, focused, usarSelect])

  useEffect(() => {
    if (!focusPillFromDashRef.current || usarSelect || !focused) return
    focusPillFromDashRef.current = false
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(id)
  }, [focused, usarSelect])

  const isAtual = semanaAtual != null && semana === semanaAtual
  const showDash = !focused && !hasStored
  const vazioVisual = usarSelect ? !selectVal : showDash
  const comentTip = comentarioTooltip != null ? String(comentarioTooltip).trim() : ''
  const semCor = indicadorSemRegrasDeCor(indicador)
  const valParaFarol = usarSelect ? selectVal : (focused ? draft : storedStr)
  const farol =
    (semCor || !String(valParaFarol ?? '').trim())
      ? null
      : statusSemaforoPorValor(indicador, valParaFarol)

  /** Dourado / “semana atual planejada” vazio — pontos escuros (paridade Gantt atividade planejada). */
  const comentDotsPlan = !!comentTip && vazioVisual && isAtual

  const basePreenchida = { background: '#ddeeff', border: '1.5px solid #3a6fa8', color: '#1a3a5f' }

  let boxStyle = {}
  if (vazioVisual) {
    boxStyle = isAtual
      ? { background: '#fff8e6', border: '1.5px solid #d4a843', color: '#7a5800' }
      : { background: '#ddeeff', border: '1.5px solid #3a6fa8', color: '#1a3a5f' }
  } else if (semCor) {
    boxStyle = basePreenchida
  } else if (farol) {
    boxStyle = { background: FAROL_BG[farol], color: '#fff', border: '1.5px solid rgba(255,255,255,0.35)' }
  } else {
    boxStyle = { background: '#e8eaf0', color: '#333', border: '1.5px solid #9aa3b2' }
  }

  const tamanhoCaixa = {
    maxWidth: '100%',
    height: 20,
    boxSizing: 'border-box'
  }

  const tamanhoSelect = {
    width: '100%',
    minWidth: 0,
    maxWidth: '100%',
    height: 20,
    boxSizing: 'border-box'
  }

  const runCommit = useCallback(async () => {
    const v = String(draftRef.current ?? '').trim()
    const ok = await onCommitRef.current(v)
    if (ok === false) {
      setFocused(true)
      setDraft(v)
      draftRef.current = v
      queueMicrotask(() => inputRef.current?.focus({ preventScroll: true }))
      return false
    }
    setFocused(false)
    return true
  }, [])

  const onBlurHandler = async () => {
    if (ignoreNextBlurRef.current) {
      ignoreNextBlurRef.current = false
      return
    }
    if (skipBlurCommitRef.current) {
      skipBlurCommitRef.current = false
      return
    }
    await runCommit()
  }

  const onKeyDown = e => {
    if (e.key === 'Tab') {
      e.preventDefault()
      void (async () => {
        const ok = await runCommit()
        if (ok === false) return
        ignoreNextBlurRef.current = true
        focusAdjacentTabbable(inputRef.current, e.shiftKey)
      })()
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      void (async () => {
        const ok = await runCommit()
        if (ok !== false) {
          ignoreNextBlurRef.current = true
          inputRef.current?.blur()
        }
      })()
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      skipBlurCommitRef.current = true
      const revert = hasStored ? storedStr : ''
      setDraft(revert)
      draftRef.current = revert
      setFocused(false)
      inputRef.current?.blur()
    }
  }

  const labelSelectAtual = selectVal
    ? (opcoesDiscrete.find(o => o.value === selectVal)?.label ?? selectVal)
    : undefined

  const ariaLabel = `Indicador ${indicador?.nome ? String(indicador.nome) : ''}, semana ${semana}${entradaNumerica ? ', valor numérico' : ''}`

  if (usarSelect) {
    const selEl = (
      <select
        aria-label={ariaLabel}
        value={selectVal}
        onChange={async e => {
          const v = e.target.value
          await onCommit(v)
        }}
        title={labelSelectAtual}
        className="gantt-indicador-select"
        style={{
          ...tamanhoSelect,
          borderRadius: 3,
          ...boxStyle,
          fontSize: 9,
          textAlign: 'center',
          padding: '0 2px',
          outline: 'none',
          fontFamily: 'inherit',
          cursor: 'pointer',
          lineHeight: 1.1
        }}
      >
        <option value="">—</option>
        {opcoesDiscrete.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    )
    const wrapSel = (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: 32 }}>
        <GanttCelulaComentarioWrap semana={semana} textoComentario={comentTip}>
          <span style={{ position: 'relative', display: 'inline-block', width: '100%' }}>{selEl}</span>
        </GanttCelulaComentarioWrap>
      </div>
    )
    return wrapSel
  }

  const dashOrInput = showDash ? (
    <button
      type="button"
      tabIndex={0}
      className="gantt-indicador-dash-btn"
      aria-label={ariaLabel}
      onClick={() => {
        focusPillFromDashRef.current = true
        setFocused(true)
        setDraft('')
        draftRef.current = ''
      }}
      style={{
        ...tamanhoCaixa,
        borderRadius: 3,
        ...boxStyle,
        cursor: 'text',
        fontSize: 11,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        fontFamily: 'inherit',
        lineHeight: 1
      }}
    >
      —
    </button>
  ) : (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <input
        ref={inputRef}
        type="text"
        inputMode={inputModeLancamento}
        enterKeyHint="done"
        aria-label={ariaLabel}
        value={focused ? draft : storedStr}
        onChange={e => {
          const next = e.target.value
          setDraft(next)
          draftRef.current = next
        }}
        onFocus={() => {
          setFocused(true)
          const next = hasStored ? storedStr : ''
          setDraft(next)
          draftRef.current = next
        }}
        onBlur={onBlurHandler}
        onKeyDown={onKeyDown}
        title={!focused && hasStored ? storedStr : undefined}
        autoComplete="off"
        className="gantt-indicador-pill-input"
        style={{
          ...tamanhoCaixa,
          borderRadius: 3,
          ...boxStyle,
          fontSize: 9,
          textAlign: 'center',
          padding: '0 2px',
          fontFamily: 'inherit',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
      />
    </span>
  )

  const coreCell = (
    <div
      className={entradaNumerica ? 'gantt-indicador-cell gantt-indicador-cell--numeric' : 'gantt-indicador-cell'}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: 32 }}
    >
      <GanttCelulaComentarioWrap semana={semana} textoComentario={comentTip}>
        {dashOrInput}
      </GanttCelulaComentarioWrap>
    </div>
  )

  return coreCell
}

const HORAS_MAX_SEMANA = 40

function hojeDentroDoPeriodo(dataInicio, dataFim) {
  if (!dataInicio || !dataFim) return false
  const inicio = new Date(dataInicio)
  const fim = new Date(dataFim)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  inicio.setHours(0, 0, 0, 0)
  fim.setHours(0, 0, 0, 0)
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) return false
  return hoje >= inicio && hoje <= fim
}

/** Remove comportamentos (e seções projeto vazias) sem nenhuma linha `acao` filha antes do próximo comportamento. */
function pruneComportamentosSemAcaoNoBloco(block) {
  if (!block?.length) return []
  const out = []
  let i = 0
  while (i < block.length) {
    const r = block[i]
    if (r?.tipo === 'comportamento') {
      const start = i
      i++
      while (i < block.length && block[i]?.tipo !== 'comportamento') i++
      const slice = block.slice(start, i)
      if (slice.some(x => x?.tipo === 'acao')) out.push(...slice)
    } else if (r?.tipo === 'secao_tipo_atividade' || r?.tipo === 'secao_spacer') {
      const start = i
      i++
      while (
        i < block.length &&
        block[i]?.tipo !== 'comportamento' &&
        block[i]?.tipo !== 'secao_tipo_atividade'
      ) {
        i++
      }
      const slice = block.slice(start, i)
      if (slice.some(x => x?.tipo === 'acao')) out.push(...slice)
    } else {
      out.push(r)
      i++
    }
  }
  return out
}

/**
 * Grade (tabela): manter apenas blocos que têm pelo menos uma linha `acao`
 * (`gantt_planejamento`/`cronograma` com semanas do período). Remove meta sem atividade na grade e “comportamentos” órfãos.
 */
function filtrarLinhasGradeSohComPlanoNoPeriodo(rows) {
  if (!rows?.length) return []
  const res = []
  let i = 0
  while (i < rows.length) {
    const r = rows[i]
    if (r?.tipo === 'objetivo') {
      const header = r
      i++
      const block = []
      while (i < rows.length && rows[i]?.tipo !== 'objetivo') {
        block.push(rows[i])
        i++
      }
      const pruned = pruneComportamentosSemAcaoNoBloco(block)
      if (pruned.some(x => x?.tipo === 'acao')) {
        res.push(header)
        res.push(...pruned)
      }
    } else {
      const block = []
      while (i < rows.length && rows[i]?.tipo !== 'objetivo') {
        block.push(rows[i])
        i++
      }
      const pruned = pruneComportamentosSemAcaoNoBloco(block)
      if (pruned.some(x => x?.tipo === 'acao')) res.push(...pruned)
    }
  }
  return res
}

function formatoPrazoMeta(meta) {
  const raw = String(meta?.meta_unidade || '').trim()
  if (!raw) return 'Prazo: —'
  const m = raw.match(/^S\s*(\d+)/i)
  if (m) return `Prazo: S${m[1]}`
  return `Prazo: ${raw}`
}

function extrairSemanaPrazoMeta(meta) {
  const raw = String(meta?.meta_unidade || '').trim()
  const mx = raw.match(/^S\s*(\d+)/i)
  if (mx?.[1]) return Number(mx[1])
  return null
}

/** Valor do chip «Prazo» no modal de conclusão (preferência Sxx a partir de meta_unidade). */
function labelPrazoChipConclusaoMeta(meta) {
  const sn = extrairSemanaPrazoMeta(meta)
  if (sn != null) return `S${sn}`
  const raw = String(meta?.meta_unidade || '').trim()
  if (raw) return raw.length > 28 ? `${raw.slice(0, 28)}…` : raw
  return '—'
}

/** Rótulo da semana ISO atual + se está dentro do prazo (meta atingível com S na meta_unidade). */
function semanaAtualChipConclusaoMeta(meta, semanaAtualIso) {
  const snAtual = Number(semanaAtualIso)
  const atualLabel =
    Number.isFinite(snAtual) && snAtual >= 1 && snAtual <= 53 ? `S${snAtual}` : '—'
  const isAtingivel = String(meta?.tipo || '').toLowerCase() === 'atingivel'
  const prazoSn = extrairSemanaPrazoMeta(meta)
  const noPrazo =
    !isAtingivel || prazoSn == null || !Number.isFinite(snAtual)
      ? true
      : snAtual <= prazoSn
  return { atualLabel, noPrazo }
}

/** Valor, hora, semana ou conclusão em registro de cronograma. */
function registroCronogramaTemHistorico(c) {
  if (c.valor != null && String(c.valor).trim() !== '') return true
  const h = Number(c.horas_previstas)
  if (Number.isFinite(h) && h > 0) return true
  if (String(c.status || '').toLowerCase() === 'concluido') return true
  const sem = c.semana ?? c.semana_ano
  if (sem != null && String(sem).trim() !== '' && Number.isFinite(Number(sem)) && Number(sem) > 0) {
    return true
  }
  return false
}

/**
 * True se há registro em `cronograma` com horas ou conclusão, para os planejamentos da linha
 * (ou legado sem `planejamento_id` para a mesma ação).
 */
function linhaTemPreenchimentoCronograma(l, cronogramaRows) {
  return linhaTemHistoricoPreenchido(l, cronogramaRows)
}

/** Histórico preenchido: valor, hora, semana ou status concluído no cronograma da linha. */
function linhaTemHistoricoPreenchido(l, cronogramaRows) {
  const acaoId = l?.acaoId
  if (!acaoId) return false
  const idsPlano = (l.planejamentoIds?.length ? l.planejamentoIds : [l.planejamentoId])
    .filter(Boolean)
    .map(x => String(x))
  if (idsPlano.length === 0) return false
  const rows = Array.isArray(cronogramaRows) ? cronogramaRows : []
  return rows.some(c => {
    if (String(c.acao_id ?? '') !== String(acaoId)) return false
    if (!registroCronogramaTemHistorico(c)) return false
    const pidRaw = c.planejamento_id ?? c.gantt_planejamento_id
    const pid = pidRaw != null && String(pidRaw).trim() !== '' ? String(pidRaw) : ''
    if (pid) return idsPlano.includes(pid)
    return true
  })
}

function podeExibirExcluirComHistorico(isAdmin, temHistorico) {
  return isAdmin || !temHistorico
}

/** Meta marcada como realizada no cronograma (status concluído) — usuário comum não pode excluir. */
function linhaTemRealizadoCronograma(l, cronogramaRows) {
  const acaoId = l?.acaoId
  if (!acaoId) return false
  const idsPlano = (l.planejamentoIds?.length ? l.planejamentoIds : [l.planejamentoId])
    .filter(Boolean)
    .map(x => String(x))
  if (idsPlano.length === 0) return false
  const rows = Array.isArray(cronogramaRows) ? cronogramaRows : []
  return rows.some(c => {
    if (String(c.acao_id ?? '') !== String(acaoId)) return false
    if (String(c.status || '') !== 'concluido') return false
    const pidRaw = c.planejamento_id ?? c.gantt_planejamento_id
    const pid = pidRaw != null && String(pidRaw).trim() !== '' ? String(pidRaw) : ''
    if (pid) return idsPlano.includes(pid)
    return true
  })
}

export default function Page() {
  const { isAdmin } = useAdmin()
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [areas, setAreas] = useState([])
  const [areaId, setAreaId] = useState('')
  const [periodoId, setPeriodoId] = useState('')
  const [periodo, setPeriodo] = useState(null)
  const [tarefas, setTarefas] = useState([])
  const [cronograma, setCronograma] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [planejamento, setPlanejamento] = useState([])
  const [showAddAtividade, setShowAddAtividade] = useState(false)
  /** Aberto pelo lápis na grade (editar planejamento) em vez de “+ Adicionar…”. */
  const [addDrawerEditando, setAddDrawerEditando] = useState(false)
  const [addObjetivoId, setAddObjetivoId] = useState('')
  /** Ações (atividades) selecionadas para incluir no plano de uma vez. */
  const [addAcaoIds, setAddAcaoIds] = useState([])
  /** Comportamento (tarefa) selecionado no drawer; filtra atividades disponíveis. */
  const [addTarefaId, setAddTarefaId] = useState('')
  /** Ids em `area_pessoas` da área atual; o texto salvo em `gantt_planejamento.responsavel` é a junção dos nomes. */
  const [addResponsavelPessoaIds, setAddResponsavelPessoaIds] = useState([])
  const [areaPessoasLista, setAreaPessoasLista] = useState([])
  const [allProfiles, setAllProfiles] = useState([])
  const [filtroResponsavelId, setFiltroResponsavelId] = useState('')
  /** Tabela `area_pessoas` ausente no PostgREST — lista/cadastro de responsáveis não funciona até rodar o SQL. */
  const [areaPessoasTabelaAusente, setAreaPessoasTabelaAusente] = useState(false)
  const [salvandoPessoaGantt, setSalvandoPessoaGantt] = useState(false)
  const [addSemanasSelecionadas, setAddSemanasSelecionadas] = useState([])
  /** Edição de uma linha específica de `gantt_planejamento` (Acoplamento: várias por atividade). */
  const [addPlanejamentoEdicaoId, setAddPlanejamentoEdicaoId] = useState(null)
  const [acoplamentoFranqueados, setAcoplamentoFranqueados] = useState([])
  const [executivosLocaisFranqueados, setExecutivosLocaisFranqueados] = useState([])
  const [wayzerNathFranqueados, setWayzerNathFranqueados] = useState([])
  const [wayzerRafaFranqueados, setWayzerRafaFranqueados] = useState([])
  const [acoplamentoFranqueadoId, setAcoplamentoFranqueadoId] = useState(null)
  const [acoplamentoDropdownAberto, setAcoplamentoDropdownAberto] = useState(true)
  const [acoplamentoOcultosAbertos, setAcoplamentoOcultosAbertos] = useState(false)
  const [novoFranqueadoNome, setNovoFranqueadoNome] = useState('')
  const [portfolioFranqueados, setPortfolioFranqueados] = useState([])
  const [portfolioFranqueadoId, setPortfolioFranqueadoId] = useState(null)
  const [portfolioDropdownAberto, setPortfolioDropdownAberto] = useState(true)
  const [portfolioOcultosAbertos, setPortfolioOcultosAbertos] = useState(false)
  const [novoPortfolioFranqueado, setNovoPortfolioFranqueado] = useState('')
  const [comercialCandidatos, setComercialCandidatos] = useState([])
  const [comercialCandidatoId, setComercialCandidatoId] = useState(null)
  const [comercialDropdownAberto, setComercialDropdownAberto] = useState(true)
  const [comercialOcultosAbertos, setComercialOcultosAbertos] = useState(false)
  const [novoCandidatoNome, setNovoCandidatoNome] = useState('')
  const [casaSelecionada, setCasaSelecionada] = useState(null)
  const [casasSelecionadas, setCasasSelecionadas] = useState([])
  const [casas, setCasas] = useState([])
  const [admCnpjs, setAdmCnpjs] = useState([])
  /** Tabela `adm_cnpjs` ausente no PostgREST — cadastro de CNPJ no drawer ADM não funciona até rodar o SQL. */
  const [admCnpjsTabelaAusente, setAdmCnpjsTabelaAusente] = useState(false)
  const [admCnpjSelecionado, setAdmCnpjSelecionado] = useState(null)
  const [novoCnpj, setNovoCnpj] = useState('')
  const [novoDescritivo, setNovoDescritivo] = useState('')
  const [cnpjDropdownAberto, setCnpjDropdownAberto] = useState(true)
  const [criandoCnpj, setCriandoCnpj] = useState(false)
  const [controladoriaCnpjs, setControladoriaCnpjs] = useState([])
  const [controladoriaCnpjSelecionado, setControladoriaCnpjSelecionado] = useState(null)
  const [controladoriaCnpjDropdownAberto, setControladoriaCnpjDropdownAberto] = useState(true)
  const [controladoriaCriandoCnpj, setControladoriaCriandoCnpj] = useState(false)
  const [controladoriaNovoCnpj, setControladoriaNovoCnpj] = useState('')
  const [controladoriaNovoDescritivo, setControladoriaNovoDescritivo] = useState('')
  const [juridicoIdentificacoes, setJuridicoIdentificacoes] = useState([])
  const [juridicoTipo, setJuridicoTipo] = useState('franqueado')
  const [juridicoIdentificacaoId, setJuridicoIdentificacaoId] = useState(null)
  const [novaIdentificacaoNome, setNovaIdentificacaoNome] = useState('')
  const [listaAberta, setListaAberta] = useState(false)
  const [idDropdownAberto, setIdDropdownAberto] = useState(true)
  const [ocultosAbertos, setOcultosAbertos] = useState(false)
  const [dropdownCasaAberto, setDropdownCasaAberto] = useState(false)
  const [novaCasaNome, setNovaCasaNome] = useState('')
  const [criandoCasa, setCriandoCasa] = useState(false)
  const [editandoCasa, setEditandoCasa] = useState(null)
  const [nomeCasaEdit, setNomeCasaEdit] = useState('')
  const [erroCasa, setErroCasa] = useState('')
  const [salvandoAdd, setSalvandoAdd] = useState(false)
  const [removendoId, setRemovendoId] = useState(null)
  const [tempoModalAberto, setTempoModalAberto] = useState(false)
  const [tempoModalSemana, setTempoModalSemana] = useState(null)
  const [tempoModalAcaoId, setTempoModalAcaoId] = useState(null)
  /** Quando há várias linhas de `gantt_planejamento` para a mesma ação (Casas / Acoplamento), o cronograma precisa apontar para o registro correto. */
  const [tempoModalPlanejamentoId, setTempoModalPlanejamentoId] = useState(null)
  const [tempoModalEstimado, setTempoModalEstimado] = useState(null)
  const [tempoModalValor, setTempoModalValor] = useState('')
  const [tempoModalUnidade, setTempoModalUnidade] = useState('horas')
  const [tempoModalValorErro, setTempoModalValorErro] = useState('')

  const fecharTempoModal = useCallback(() => {
    setTempoModalAberto(false)
    setTempoModalPlanejamentoId(null)
    setTempoModalValorErro('')
  }, [])

  /** Gaveta de meta (mesmo fluxo em toda a aplicação) */
  const [metaModalAberto, setMetaModalAberto] = useState(false)
  const [metaParaEditar, setMetaParaEditar] = useState(null)
  const [metaExcluindoId, setMetaExcluindoId] = useState(null)
  /** Modal de exclusão de planejamento (substitui window.confirm / alert nativos). */
  const [modalExclusao, setModalExclusao] = useState(null)
  const [excluirMetaDrawerAberto, setExcluirMetaDrawerAberto] = useState(false)
  const [metaParaExcluir, setMetaParaExcluir] = useState(null)
  const [concluirMetaModalAberto, setConcluirMetaModalAberto] = useState(false)
  const [metaParaConcluir, setMetaParaConcluir] = useState(null)
  /** Conclusão de indicador atingível — mesmo modal/comentário que metas. */
  const [indicadorParaConcluir, setIndicadorParaConcluir] = useState(null)
  const [comentarioConclusaoMeta, setComentarioConclusaoMeta] = useState('')
  const [concluindoMetaId, setConcluindoMetaId] = useState(null)
  /** Modal em duas etapas para reverter conclusão de meta (admin). */
  const [modalReverter, setModalReverter] = useState(null)
  /** Modal de seleção de registro quando uma linha tem múltiplos registros em gantt_planejamento. */
  const [modalSelecionarRegistro, setModalSelecionarRegistro] = useState(null)
  const concluirMetaComentarioRef = useRef(null)

  useEffect(() => {
    if (!concluirMetaModalAberto) return
    const onKey = (e) => {
      if (e.key === 'Escape') fecharModalConclusaoMeta()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [concluirMetaModalAberto])

  useEffect(() => {
    if (!concluirMetaModalAberto || (!metaParaConcluir && !indicadorParaConcluir)) return
    const id = requestAnimationFrame(() => concluirMetaComentarioRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [concluirMetaModalAberto, metaParaConcluir, indicadorParaConcluir])

  useEffect(() => {
    if (!isAdmin && metaModalAberto) {
      setMetaModalAberto(false)
      setMetaParaEditar(null)
    }
  }, [isAdmin, metaModalAberto])

  const [metasObjetivos, setMetasObjetivos] = useState([])
  const [metasObjetivosLoading, setMetasObjetivosLoading] = useState(false)
  const [metasExpandidas, setMetasExpandidas] = useState(() => {
    try { return localStorage.getItem('gantt_metas_expandidas') !== 'false' } catch { return true }
  })

  /** Parte 2: usar na UI. { [objetivo_id]: indicador[] } */
  const [indicadoresPorObjetivo, setIndicadoresPorObjetivo] = useState({})
  /** Parte 2: usar na UI. { [indicador_id]: { [semanaIso]: { id, valor } } } — chaves = ISO da coluna (conversão na carga a partir de relativo no banco). */
  const [lancamentosPorIndicador, setLancamentosPorIndicador] = useState({})
  /** Feedback de erro ao salvar lançamento de indicador (toast leve; não bloqueia o restante da UI). */
  const [indicadorFeedback, setIndicadorFeedback] = useState(null)
  /** Cache do último fetch bruto de `indicador_lancamentos` por lista de indicadores (`ilanc-v2|…`); filtro por colunas ISO no `build`. */
  const lancamentosRawCacheRef = useRef({ key: '', rows: [] })
  /** Último fetch bem-sucedido incluiu `periodo_id` no SELECT (para ordenar cache hit). */
  const schemaPeriodoIdLancamentosRef = useRef(true)

  const [comentariosAtividadeRows, setComentariosAtividadeRows] = useState([])
  const [comentariosIndicadorRows, setComentariosIndicadorRows] = useState([])
  const [comentarioModal, setComentarioModal] = useState(null)

  const indicadorIdsKey = useMemo(() => {
    const ids = Object.values(indicadoresPorObjetivo).flat().map(i => i?.id).filter(Boolean)
    return [...new Set(ids)].sort().join('|')
  }, [indicadoresPorObjetivo])

  const semanas = useMemo(() => {
    if (!periodo) return []
    const result = semanasIsoNoIntervalo(periodo.data_inicio, periodo.data_fim)
    return (result || []).map(Number).filter(Number.isFinite)
  }, [periodo])

  const minSemanaVisivel = useMemo(() => {
    const nums = (semanas || []).map(Number).filter(Number.isFinite)
    return nums.length ? Math.min(...nums) : null
  }, [semanas])

  /** Estabiliza o disparo do fetch de indicadores quando só muda a referência do array de metas. */
  const metasIdsKey = useMemo(
    () => (metasObjetivos || []).filter(m => metaDeveAparecerNoPeriodo(m, minSemanaVisivel)).map(m => m.id).filter(Boolean).sort().join(','),
    [metasObjetivos, minSemanaVisivel]
  )

  async function carregarAreas() {
    const { data } = await listarAreas(supabase, 'id, nome')
    setAreas(data || [])
  }

  async function carregarPeriodo() {
    if (!periodoId) {
      setPeriodo(null)
      return
    }
    const { data, error: e } = await supabase
      .from('periodos')
      .select('id, tipo, ano, numero, data_inicio, data_fim, ativo')
      .eq('id', periodoId)
      .single()
    if (e) setPeriodo(null)
    else {
      setPeriodo(data)
    }
  }

  async function carregarTarefas() {
    if (!areaId) return
    const { data } = await supabase.from('tarefas').select('*, acoes(*)').eq('area_id', areaId).order('ordem')
    setTarefas(data || [])
  }

  async function carregarAreaPessoas() {
    if (!areaId) {
      setAreaPessoasLista([])
      setAreaPessoasTabelaAusente(false)
      return
    }
    const { data, error } = await supabase
      .from('area_pessoas')
      .select('id, nome, profile_id, profiles(full_name)')
      .eq('area_id', areaId)
      .eq('ativo', true)
      .order('ordem')
      .order('nome')
    if (error) {
      setAreaPessoasLista([])
      setAreaPessoasTabelaAusente(erroIndicaTabelaAreaPessoasAusente(error))
      return
    }
    setAreaPessoasTabelaAusente(false)
    // Deduplica: se dois registros têm o mesmo profile_id, mantém só o primeiro
    const deduplicados = []
    const profileIdsVistos = new Set()
    const nomesVistos = new Set()
    for (const p of (data || [])) {
      const pf = (p.profiles as { full_name?: string } | null)?.full_name || null
      const profileFullName = pf || null
      if (p.profile_id) {
        if (profileIdsVistos.has(p.profile_id)) continue
        profileIdsVistos.add(p.profile_id)
      } else {
        const nomeNorm = String(p.nome || '').trim().toLowerCase()
        if (nomesVistos.has(nomeNorm)) continue
        nomesVistos.add(nomeNorm)
      }
      deduplicados.push({ ...p, profile_full_name: profileFullName })
    }
    setAreaPessoasLista(deduplicados)
  }

  async function carregarProfiles() {
    const { data } = await supabase.from('profiles').select('id, full_name, email').order('full_name')
    setAllProfiles(data || [])
  }

  async function ocultarPessoaGantt(pessoaId) {
    await supabase.from('area_pessoas').update({ ativo: false }).eq('id', pessoaId)
    await carregarAreaPessoas()
  }

  async function adicionarProfileNaArea(profileId) {
    if (!areaId) return
    const profile = allProfiles.find(p => p.id === profileId)
    if (!profile) return
    const ordem = areaPessoasLista.length
    const { error } = await supabase
      .from('area_pessoas')
      .insert({ area_id: areaId, nome: profile.full_name || profile.email, profile_id: profileId, ordem, ativo: true })
      .select('id')
      .single()
    if (!error) await carregarAreaPessoas()
  }

  /** Cadastro inline na lista de responsáveis (tabela `area_pessoas` por área). */
  async function adicionarPessoaPlanejamento(nome) {
    const n = String(nome || '').trim()
    if (!n || !areaId) return null
    setSalvandoPessoaGantt(true)
    setError(null)
    const ordem = areaPessoasLista.length
    const { data, error } = await supabase
      .from('area_pessoas')
      .insert({ area_id: areaId, nome: n, ordem, ativo: true })
      .select('id')
      .single()
    setSalvandoPessoaGantt(false)
    if (error) {
      if (erroIndicaTabelaAreaPessoasAusente(error)) setAreaPessoasTabelaAusente(true)
      setError(
        erroIndicaTabelaAreaPessoasAusente(error)
          ? 'A tabela area_pessoas não existe no banco. Copie o SQL do aviso acima, execute no Supabase (SQL Editor) e recarregue a página.'
          : error.message
      )
      return null
    }
    void registrarLog({
      modulo: 'Planejamento',
      area: areas.find((a) => a.id === areaId)?.nome ?? null,
      entidade: 'area_pessoas',
      entidade_id: data?.id ?? null,
      operacao: 'INSERT',
      valor_novo: { area_id: areaId, nome: n, ordem, ativo: true },
      descricao: `Adicionou responsável "${n}" no planejamento`
    })
    setAreaPessoasTabelaAusente(false)
    await carregarAreaPessoas()
    return data?.id ?? null
  }

  /** Metas dos cards do planejamento: só `objetivos` com `status = ativo` (colunas em supabase-meta-ciclo-vida.sql). */
  async function carregarMetasObjetivos() {
    if (!areaId) {
      setMetasObjetivos([])
      return
    }
    setMetasObjetivosLoading(true)
    try {
      // Importante: metas concluídas devem continuar visíveis no Gantt (apenas com indicação visual).
      // Buscamos sem filtrar por status e mantemos fallback para schemas mínimos.
      const SEL_SPECS = [
        'id, descricao, ordem, meta_unidade, status, concluido_em',
        'id, descricao, ordem, meta_unidade, status',
        'id, descricao, ordem, meta_unidade'
      ]
      let data = null
      let err = null
      for (const sel of SEL_SPECS) {
        const r = await supabase
          .from('objetivos')
          .select(sel)
          .eq('area_id', areaId)
          .order('ordem', { ascending: true })
        data = r.data
        err = r.error
        if (!err) break
        if (!erroColunaOuSchemaSupabase(err) && !String(err.message || '').toLowerCase().includes('status')) break
      }
      if (err) throw err
      const list = (data || []).filter(Boolean)
      // Só arquivados somem (se existir esse status).
      const visiveis = list.filter(o => String(o?.status || '').toLowerCase() !== 'arquivado')
      setMetasObjetivos(visiveis)
    } catch {
      setMetasObjetivos([])
    } finally {
      setMetasObjetivosLoading(false)
    }
  }

  async function carregarCronograma() {
    if (!areaId) return setCronograma([])
    const semanasFiltro = (semanas || []).map(Number).filter(Number.isFinite)
    if (semanasFiltro.length === 0) return setCronograma([])
    const acaoIds = []
    ;(tarefas || []).forEach(t => (t.acoes || []).forEach(a => { if (a?.id) acaoIds.push(a.id) }))
    if (acaoIds.length === 0) return setCronograma([])
    const acaoIdsSet = [...new Set(acaoIds)]
    const { data, error: e } = await supabase
      .from('cronograma')
      .select('id, acao_id, tarefa_id, semana, semana_ano, status, horas_previstas, planejamento_id')
      .in('acao_id', acaoIdsSet)
      .in('semana', semanasFiltro)
    if (e) setCronograma([])
    else setCronograma(data || [])
  }

  async function carregarPlanejamento() {
    if (!periodoId || !areaId) return
    setLoading(true)
    const comJoinCasas = ['0710d19c-c081-4c12-842c-d16bb2fb26cd', '2470e274-4ba5-4d5d-b17f-eb0adf8f67a9'].includes(areaId)
    const selPlanejamento = selectGanttPlanejamentoRows(comJoinCasas)
    // periodo_id é metadado de gravação; a grade usa semanas ISO do período visualizado.
    // Não filtrar por periodo_id — planejamento salvo em outro mês/trimestre some da grade.
    const acaoIdsList = (tarefas || []).flatMap(t => (t.acoes || []).map(a => a.id)).filter(Boolean)
    let data = []
    let e = null
    if (acaoIdsList.length > 0) {
      const res1 = await supabase
        .from('gantt_planejamento')
        .select(selPlanejamento)
        .in('acao_id', acaoIdsList)
      if (!res1.error) {
        data = res1.data || []
      } else if (comJoinCasas) {
        const res2 = await supabase
          .from('gantt_planejamento')
          .select(selPlanejamento)
          .in('acao_id', acaoIdsList)
        data = res2.data || []
        e = res2.error
      } else {
        e = res1.error
      }
    }

    // Cronograma: busca por acao_id + semana — periodo_id é só visualização
    // Calcular semanas diretamente do periodo (não depende do useMemo semanas que pode estar desatualizado)
    const semanasFiltro = periodo?.data_inicio && periodo?.data_fim
      ? semanasIsoNoIntervalo(periodo.data_inicio, periodo.data_fim).map(Number).filter(Number.isFinite)
      : (semanas || []).map(Number).filter(Number.isFinite)
    let crono = []
    let e2 = null
    if (semanasFiltro.length > 0 && acaoIdsList.length > 0) {
      const acaoIdsForCrono = [...new Set(acaoIdsList)]
      const { data: cronoData, error: cronoErr } = await supabase
        .from('cronograma')
        .select('id, acao_id, tarefa_id, semana, semana_ano, status, horas_previstas, planejamento_id')
        // periodo_id é só visualização; dados legados podem estar em outro período (ou null)
        .in('acao_id', acaoIdsForCrono)
        .in('semana', semanasFiltro)
      crono = cronoData || []
      e2 = cronoErr
    }



    const planejamentoFinal = (!e ? data : []) || []
    logRawFranqueadoNomePlanejamento(planejamentoFinal)
    // Buscar nomes das casas diretamente do banco para não depender do timing de casas[]
    let casasMap = {}
    if (planejamentoFinal.some(row => row.casa_id && !(row.casa && row.casa.nome))) {
      const casaIds = [...new Set(planejamentoFinal.map(r => r.casa_id).filter(Boolean))]
      if (casaIds.length > 0) {
        const { data: casasData } = await supabase
          .from('casas')
          .select('id, nome')
          .in('id', casaIds)
        ;(casasData || []).forEach(c => { casasMap[c.id] = c.nome })
      }
    }

    const dataEnriquecida = planejamentoFinal.map(row => {
      if (!row.casa_id) return row
      // Se o join já trouxe (FK existe), manter
      if (row.casa && row.casa.nome) return row
      const nomeCasaBanco = casasMap[row.casa_id]
      if (nomeCasaBanco) return { ...row, casa: { id: row.casa_id, nome: nomeCasaBanco } }
      const casaObj = casas.find(c => String(c.id) === String(row.casa_id))
      return casaObj ? { ...row, casa: { id: casaObj.id, nome: casaObj.nome } } : row
    })
    setPlanejamento(dataEnriquecida)
    setCronograma((!e2 ? crono : []) || [])
    setLoading(false)
  }

  async function carregarIndicadoresLista() {
    if (!areaId) {
      setIndicadoresPorObjetivo({})
      lancamentosRawCacheRef.current = { key: '', rows: [] }
      return
    }
    const objetivoIds = (metasObjetivos || []).filter(m => metaDeveAparecerNoPeriodo(m, minSemanaVisivel)).map(m => m.id).filter(Boolean)
    if (objetivoIds.length === 0) {
      setIndicadoresPorObjetivo({})
      return
    }

    /** Sempre por área: concluídos devem permanecer visíveis no planejamento. */
    let { data: indRows, error: indErr } = await supabase
      .from('indicadores')
      .select('*')
      .eq('area_id', areaId)
    if (indErr && String(indErr.message || '').toLowerCase().includes('status')) {
      const r2 = await supabase.from('indicadores').select('*').eq('area_id', areaId)
      indRows = r2.data
      indErr = r2.error
    }

    if (indErr) {
      setIndicadoresPorObjetivo({})
      return
    }

    const list = indRows || []
    const porObj = {}
    objetivoIds.forEach(id => { porObj[id] = [] })
    const fallbackId = objetivoIds[0]
    list.forEach(ind => {
      let target = metaIdCanonica(metasObjetivos, ind.objetivo_id)
      if (target == null || !objetivoIds.some(id => idObjetivoIgual(id, target))) {
        if (!fallbackId) return
        target = fallbackId
      }
      if (!porObj[target]) porObj[target] = []
      porObj[target].push(ind)
    })
    setIndicadoresPorObjetivo(porObj)
  }

  async function carregarLancamentosIndicadores() {
    if (!areaId || !periodoId) {
      setLancamentosPorIndicador({})
      return
    }
    /** Período ainda carregando — não limpar mapa (evita flash e perda ao remontar a rota). */
    if (periodo == null) return
    if (!periodo.data_inicio || !periodo.data_fim) {
      setLancamentosPorIndicador({})
      return
    }

    const listaInds = Object.values(indicadoresPorObjetivo).flat()
    const indIds = [...new Set(listaInds.map(i => i.id).filter(Boolean))]
    if (indIds.length === 0) {
      const temMetas = (metasObjetivos || []).length > 0
      const mapaInicializado = Object.keys(indicadoresPorObjetivo || {}).length > 0
      /** Metas já listadas mas `carregarIndicadoresLista` ainda não populou o mapa — não apagar lançamentos. */
      if (temMetas && !mapaInicializado) return
      setLancamentosPorIndicador({})
      return
    }

    const semanasRange = semanasIsoNoIntervalo(periodo.data_inicio, periodo.data_fim)
    const semanasArray = [...(semanasRange || [])].map(Number).filter(Number.isFinite).sort((a, b) => a - b)

    /** Cache por indicadores: linhas brutas iguais para qualquer período visualizado; o filtro ISO é no `build`. */
    const cacheKey = `ilanc-v2|${indIds.slice().sort().join(',')}`
    const cached = lancamentosRawCacheRef.current
    if (cached.key === cacheKey && Array.isArray(cached.rows)) {
      const rowsOrd = ordenarLancamentosIndicadorParaGrade([...cached.rows], periodoId, true)
      setLancamentosPorIndicador(buildLancamentosPorIndicadorFromRows(rowsOrd, indIds, semanasArray))
      return
    }

    const selLanc =
      'id, indicador_id, semana, semana_ano, valor, periodo_id, criado_em, periodos ( data_inicio, data_fim )'

    // Sem filtro em `periodo_id`: posição relativa só faz sentido com `data_inicio` do período gravado (join).
    const { data: lancData, error: lErr } = await supabase
      .from('indicador_lancamentos')
      .select(selLanc)
      .in('indicador_id', indIds)

    if (lErr) {
      setIndicadorFeedback({
        type: 'error',
        message: String(lErr.message || lErr) || 'Não foi possível carregar os lançamentos dos indicadores.'
      })
      return
    }

    schemaPeriodoIdLancamentosRef.current = true
    const lancOrdenados = ordenarLancamentosIndicadorParaGrade(lancData || [], periodoId, true)
    lancamentosRawCacheRef.current = { key: cacheKey, rows: lancOrdenados || [] }
    setLancamentosPorIndicador(buildLancamentosPorIndicadorFromRows(lancOrdenados, indIds, semanasArray))
  }

  useEffect(() => { carregarAreas() }, [])
  useEffect(() => {
    if (!areas.length) return
    const ids = new Set(areas.map((a) => String(a?.id ?? '')).filter(Boolean))
    const fromUrl = searchParams.get('area')
    const fromUrlValid = fromUrl && ids.has(String(fromUrl)) ? String(fromUrl) : null
    const current = areaId && ids.has(String(areaId)) ? String(areaId) : null
    const fromStorage = localStorage.getItem('carometro_ultima_area')
    const next = fromUrlValid || current
      || (fromStorage && ids.has(fromStorage) ? fromStorage : null)
      || String(areas[0].id)
    if (next !== areaId) setAreaId(next)
    localStorage.setItem('carometro_ultima_area', next)
  }, [areas, searchParams])
  useEffect(() => { carregarPeriodo() }, [periodoId])
  useEffect(() => {
    setTarefas([])
    setPlanejamento([])
    setCronograma([])
    carregarTarefas()
  }, [areaId])
  useEffect(() => { carregarMetasObjetivos() }, [areaId])
  useEffect(() => { carregarAreaPessoas(); void carregarProfiles() }, [areaId])
  useEffect(() => { setFiltroResponsavelId('') }, [areaId])
  useEffect(() => { setAddResponsavelPessoaIds([]) }, [areaId])

  /** Abre a gaveta de meta com ?openMeta=1 (remove o parâmetro da URL). */
  useEffect(() => {
    if (!searchParams.get('openMeta') || !areaId) return
    setMetaParaEditar(null)
    setMetaModalAberto(true)
    const next = new URLSearchParams(searchParams.toString())
    next.delete('openMeta')
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }, [areaId, searchParams, router, pathname])

  useEffect(() => {
    if (!showAddAtividade || addObjetivoId) return
    const first = metasObjetivos[0]?.id
    if (first) setAddObjetivoId(first)
  }, [showAddAtividade, addObjetivoId, metasObjetivos])

  useEffect(() => {
    carregarIndicadoresLista()
  }, [areaId, metasIdsKey])

  useEffect(() => {
    carregarLancamentosIndicadores()
  }, [periodoId, areaId, periodo?.data_inicio, periodo?.data_fim, indicadorIdsKey])

  useEffect(() => {
    if (!indicadorFeedback) return
    const t = setTimeout(() => setIndicadorFeedback(null), 4500)
    return () => clearTimeout(t)
  }, [indicadorFeedback])

  // Dispara quando periodo E tarefas estiverem prontos
  useEffect(() => {
    if (!periodoId || !periodo || semanas.length === 0 || tarefas.length === 0) return
    carregarPlanejamento()
  }, [periodoId, areaId, periodo, semanas, tarefas])

  const anoIsoPorSemanaColuna = useMemo(() => {
    const m = {}
    if (!periodo?.data_inicio || !periodo?.data_fim) return m
    for (const s of semanas) {
      const sn = Number(s)
      if (Number.isFinite(sn)) m[sn] = anoIsoParaSemanaNoIntervalo(sn, periodo.data_inicio, periodo.data_fim)
    }
    console.log('[pill] anoIsoPorSemanaColuna:', m, 'periodo:', periodo?.data_inicio, '→', periodo?.data_fim)
    return m
  }, [semanas, periodo?.data_inicio, periodo?.data_fim])

  const carregarComentariosGrade = useCallback(async () => {
    if (!periodo?.data_inicio || !periodo?.data_fim || semanas.length === 0) {
      setComentariosAtividadeRows([])
      setComentariosIndicadorRows([])
      return
    }
    const anosFilt = [
      ...new Set(
        semanas
          .map(s => anoIsoPorSemanaColuna[Number(s)])
          .filter(y => Number.isFinite(Number(y)))
      )
    ]
    if (anosFilt.length === 0) {
      setComentariosAtividadeRows([])
      setComentariosIndicadorRows([])
      return
    }
    const acaoIdsCom = [
      ...new Set((planejamento || []).map(p => p?.acao_id).filter(Boolean))
    ]
    const indIdsCom = [...new Set(Object.values(indicadoresPorObjetivo || {}).flat().map(i => i?.id).filter(Boolean))]
    const isoList = semanas.map(s => Number(s)).filter(n => Number.isFinite(n))
    const [ra, ri] = await Promise.all([
      acaoIdsCom.length
        ? supabase
            .from('comentarios_atividade')
            .select('id, acao_id, semana_iso, semana_ano, texto, created_at')
            .in('acao_id', acaoIdsCom)
            .in('semana_iso', isoList)
            .in('semana_ano', anosFilt)
            .order('semana_iso', { ascending: true })
            .order('created_at', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      indIdsCom.length
        ? supabase
            .from('comentarios_indicador')
            .select('id, indicador_id, semana_iso, semana_ano, texto, created_at')
            .in('indicador_id', indIdsCom)
            .in('semana_iso', isoList)
            .in('semana_ano', anosFilt)
            .order('semana_iso', { ascending: true })
            .order('created_at', { ascending: true })
        : Promise.resolve({ data: [], error: null })
    ])
    console.log('[comentarios] acaoIdsCom:', acaoIdsCom?.length,
      'isoList:', isoList, 'anosFilt:', anosFilt,
      'resultado atividades:', ra.data?.length, ra.error)
    if (!ra.error) setComentariosAtividadeRows(ra.data || [])
    else setComentariosAtividadeRows([])
    if (!ri.error) setComentariosIndicadorRows(ri.data || [])
    else setComentariosIndicadorRows([])
  }, [periodo, semanas, anoIsoPorSemanaColuna, planejamento, indicadoresPorObjetivo])

  useEffect(() => {
    void carregarComentariosGrade()
  }, [carregarComentariosGrade])

  /** Modal “Adicionar atividade”: sempre todas as semanas ISO do ano civil do período (ex.: Ano 2026 → S1…S52). */
  const semanasModalAdicionar = useMemo(() => {
    if (!periodo) return []
    const ano =
      periodo.ano != null
        ? Number(periodo.ano)
        : (periodo.data_inicio ? new Date(`${periodo.data_inicio}T12:00:00`).getFullYear() : new Date().getFullYear())
    if (!Number.isFinite(ano)) return []
    return semanasIsoAnoCalendario(ano)
  }, [periodo])

  const areaAtual = useMemo(() => (areas || []).find(a => a.id === areaId) || null, [areas, areaId])
  const areaSelecionadaNome = String(areaAtual?.nome ?? '').trim()
  /** Produto, Projetos - Modelo Virtual ou alias Projetos: campo Casa e legenda no Gantt. */
  const isAreaCasa = useMemo(
    () => ['0710d19c-c081-4c12-842c-d16bb2fb26cd', '2470e274-4ba5-4d5d-b17f-eb0adf8f67a9'].includes(areaId),
    [areaId]
  )
  const isAreaAdm = useMemo(() => areaId === '7601b490-ba64-4d07-92d5-e9d1dc2cd35b', [areaId])
  const isAreaControladoria = useMemo(() => areaId === 'f05cf716-0028-493b-aede-69a7d437b9cd', [areaId])
  const isAreaComercial = useMemo(() => areaId === '35ae737d-fba2-44bf-906d-b3c9f56da7a0', [areaId])
  const isAreaJuridico = useMemo(() => areaId === JURIDICO_AREA_ID, [areaId])
  const juridicoIdentMap = useMemo(
    () => new Map((juridicoIdentificacoes || []).map(j => [String(j.id), j])),
    [juridicoIdentificacoes]
  )
  const nomeAreaLower = useMemo(
    () => nomeAreaNorm(areaSelecionadaNome).toLowerCase(),
    [areaSelecionadaNome]
  )
  const isAreaAcoplamento = useMemo(() => areaId === 'b24c8ac0-9a86-40bb-8aad-be79531e95ea', [areaId])
  const isAreaExecutivosLocais = useMemo(() => areaId === '787b6790-4f7f-4d7e-a9b3-806cc13acbc4', [areaId])
  const isAreaWayzerNath = useMemo(() => areaId === '8ff5a1e1-4cb4-4d82-86ef-ef1b31e9fe46', [areaId])
  const isAreaWayzerRafa = useMemo(() => areaId === 'a213bee1-4cfb-4f47-8013-8f4d2b319f32', [areaId])
  const isAreaFranqueado =
    isAreaAcoplamento || isAreaExecutivosLocais || isAreaWayzerNath || isAreaWayzerRafa
  const isAreaPortfolio = useMemo(() => areaId === '45de8e00-368c-4436-94b2-ba9094eeaf9a', [areaId])

  const franqueadosAtivos = useMemo(
    () =>
      isAreaAcoplamento
        ? acoplamentoFranqueados
        : isAreaExecutivosLocais
          ? executivosLocaisFranqueados
          : isAreaWayzerNath
            ? wayzerNathFranqueados
            : isAreaWayzerRafa
              ? wayzerRafaFranqueados
              : [],
    [
      isAreaAcoplamento,
      isAreaExecutivosLocais,
      isAreaWayzerNath,
      isAreaWayzerRafa,
      acoplamentoFranqueados,
      executivosLocaisFranqueados,
      wayzerNathFranqueados,
      wayzerRafaFranqueados
    ]
  )

  const tabelaFranqueadosAtiva = useMemo(
    () =>
      isAreaAcoplamento
        ? 'acoplamento_franqueados'
        : isAreaExecutivosLocais
          ? 'executivos_locais_franqueados'
          : isAreaWayzerNath
            ? 'wayzer_nath_franqueados'
            : isAreaWayzerRafa
              ? 'wayzer_rafa_franqueados'
              : null,
    [isAreaAcoplamento, isAreaExecutivosLocais, isAreaWayzerNath, isAreaWayzerRafa]
  )

  const setFranqueadosAtivos = useCallback(
    valueOrFn => {
      if (isAreaAcoplamento) setAcoplamentoFranqueados(valueOrFn)
      else if (isAreaExecutivosLocais) setExecutivosLocaisFranqueados(valueOrFn)
      else if (isAreaWayzerNath) setWayzerNathFranqueados(valueOrFn)
      else if (isAreaWayzerRafa) setWayzerRafaFranqueados(valueOrFn)
    },
    [isAreaAcoplamento, isAreaExecutivosLocais, isAreaWayzerNath, isAreaWayzerRafa]
  )

  /** `areas.nome` exato — agrupamento Modelagem/Documentação no Gantt e no drawer. */
  const isAreaTipoAtividadeProjeto = useMemo(
    () => ['787b6790-4f7f-4d7e-a9b3-806cc13acbc4', '2470e274-4ba5-4d5d-b17f-eb0adf8f67a9'].includes(areaId),
    [areaId]
  )

  useEffect(() => {
    const nomeArea = String((areas || []).find(a => a.id === areaId)?.nome ?? '').trim()
    if (!['0710d19c-c081-4c12-842c-d16bb2fb26cd', '2470e274-4ba5-4d5d-b17f-eb0adf8f67a9'].includes(areaId) || !areaId) {
      setCasas([])
      return
    }
    console.log('[casas] areaId:', areaId, 'nomeArea:', nomeArea, 'isAreaComCasas:', isNomeAreaComCasas(nomeArea))
    let cancel = false
    supabase
      .from('casas')
      .select('id, nome')
      .eq('area_id', areaId)
      .order('nome')
      .then(({ data, error }) => {
        console.log('[casas] resultado:', data, error)
        if (cancel || error) return
        const ordenadas = (data || []).slice().sort((a, b) =>
          String(a?.nome || '').localeCompare(String(b?.nome || ''), 'pt-BR', { sensitivity: 'base' })
        )
        setCasas(ordenadas)
      })
    return () => { cancel = true }
  }, [areaId, areas])

  useEffect(() => {
    if (!isAreaAdm) {
      setAdmCnpjs([])
      setAdmCnpjsTabelaAusente(false)
      return
    }
    supabase
      .from('adm_cnpjs')
      .select('id, cnpj, descritivo')
      .order('criado_em', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          setAdmCnpjs([])
          if (erroIndicaTabelaAdmCnpjsAusente(error)) setAdmCnpjsTabelaAusente(true)
          return
        }
        setAdmCnpjsTabelaAusente(false)
        setAdmCnpjs(data || [])
      })
  }, [isAreaAdm])

  useEffect(() => {
    if (!isAreaControladoria) {
      setControladoriaCnpjs([])
      return
    }
    supabase
      .from('controladoria_cnpjs')
      .select('id, cnpj, descritivo')
      .order('criado_em', { ascending: true })
      .then(({ data }) => setControladoriaCnpjs(data || []))
  }, [isAreaControladoria])

  const carregarJuridicoIdentificacoes = useCallback(async () => {
    const { data } = await supabase
      .from('juridico_identificacoes')
      .select('*')
      .order('nome', { ascending: true })
    setJuridicoIdentificacoes(data ?? [])
  }, [])

  useEffect(() => {
    if (!isAreaJuridico) {
      setJuridicoIdentificacoes([])
      return
    }
    let cancel = false
    carregarJuridicoIdentificacoes().then(() => {
      if (cancel) return
    })
    return () => { cancel = true }
  }, [isAreaJuridico, carregarJuridicoIdentificacoes])

  const carregarFranqueadosAtivos = useCallback(async () => {
    const tabela =
      isAreaAcoplamento
        ? 'acoplamento_franqueados'
        : isAreaExecutivosLocais
          ? 'executivos_locais_franqueados'
          : isAreaWayzerNath
            ? 'wayzer_nath_franqueados'
            : isAreaWayzerRafa
              ? 'wayzer_rafa_franqueados'
              : null
    if (!tabela) return
    const { data } = await supabase.from(tabela).select('*').order('nome', { ascending: true })
    if (isAreaAcoplamento) setAcoplamentoFranqueados(data ?? [])
    if (isAreaExecutivosLocais) setExecutivosLocaisFranqueados(data ?? [])
    if (isAreaWayzerNath) setWayzerNathFranqueados(data ?? [])
    if (isAreaWayzerRafa) setWayzerRafaFranqueados(data ?? [])
  }, [isAreaAcoplamento, isAreaExecutivosLocais, isAreaWayzerNath, isAreaWayzerRafa])

  useEffect(() => {
    if (!isAreaFranqueado) {
      setAcoplamentoFranqueados([])
      setExecutivosLocaisFranqueados([])
      setWayzerNathFranqueados([])
      setWayzerRafaFranqueados([])
      return
    }
    setAcoplamentoFranqueadoId(null)
    setAcoplamentoDropdownAberto(true)
    let cancel = false
    carregarFranqueadosAtivos().then(() => {
      if (cancel) return
    })
    return () => { cancel = true }
  }, [isAreaFranqueado, tabelaFranqueadosAtiva, carregarFranqueadosAtivos])

  useEffect(() => {
    if (!isAreaPortfolio) {
      setPortfolioFranqueados([])
      return
    }
    setPortfolioFranqueadoId(null)
    setPortfolioDropdownAberto(true)
    let cancel = false
    supabase
      .from('portfolio_franqueados')
      .select('*')
      .order('nome', { ascending: true })
      .then(({ data }) => {
        if (cancel) return
        setPortfolioFranqueados(data ?? [])
      })
    return () => { cancel = true }
  }, [isAreaPortfolio])

  useEffect(() => {
    if (!isAreaComercial) {
      setComercialCandidatos([])
      return
    }
    let cancel = false
    supabase
      .from('comercial_candidatos')
      .select('*')
      .order('nome', { ascending: true })
      .then(({ data }) => {
        if (cancel) return
        setComercialCandidatos(data ?? [])
      })
    return () => { cancel = true }
  }, [isAreaComercial])

  const resetAcoplamentoModalAux = useCallback(() => {
    setAcoplamentoFranqueadoId(null)
    setAcoplamentoDropdownAberto(true)
    setAcoplamentoOcultosAbertos(false)
    setNovoFranqueadoNome('')
  }, [])

  const resetPortfolioModalAux = useCallback(() => {
    setPortfolioFranqueadoId(null)
    setPortfolioDropdownAberto(true)
    setPortfolioOcultosAbertos(false)
    setNovoPortfolioFranqueado('')
  }, [])

  const resetComercialModalAux = useCallback(() => {
    setComercialCandidatoId(null)
    setComercialDropdownAberto(true)
    setComercialOcultosAbertos(false)
    setNovoCandidatoNome('')
  }, [])

  const resetJuridicoModalAux = useCallback(() => {
    setJuridicoTipo('franqueado')
    setJuridicoIdentificacaoId(null)
    setNovaIdentificacaoNome('')
    setListaAberta(false)
    setIdDropdownAberto(true)
    setOcultosAbertos(false)
  }, [])

  useEffect(() => {
    if (!dropdownCasaAberto) return
    const handler = (e) => {
      if (!e?.target?.closest?.('[data-dropdown-casa]')) {
        setDropdownCasaAberto(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropdownCasaAberto])

  const semanaAtual = useMemo(() => {
    if (!periodo) return null
    if (!hojeDentroDoPeriodo(periodo.data_inicio, periodo.data_fim)) return null
    return isoWeek(new Date())
  }, [periodo])

  const semanaCorteAtrasado = useMemo(() => {
    if (!periodo) return null
    if (hojeDentroDoPeriodo(periodo.data_inicio, periodo.data_fim)) return isoWeek(new Date())
    const fim = new Date(`${periodo.data_fim}T12:00:00`)
    if (!isNaN(fim.getTime()) && fim < new Date()) return isoWeek(fim) + 1
    return null
  }, [periodo])

  const ganttCronogramaDensityClass = useMemo(() => {
    const n = semanas.length
    if (n <= 4) return 'gantt-cronograma-density--4'
    if (n <= 8) return 'gantt-cronograma-density--8'
    if (n <= 15) return 'gantt-cronograma-density--14'
    return 'gantt-cronograma-density--52'
  }, [semanas.length])

  const mapaCronograma = useMemo(() => {
    const m = {}
    ;(cronograma || []).forEach(c => {
      if (!c.planejamento_id) {
        const k = `a_${c.acao_id}_${Number(c.semana)}`
        m[k] = c
      }
    })
    return m
  }, [cronograma])

  const mapaCronogramaPorPlanejamento = useMemo(() => {
    const m = new Map()
    ;(cronograma || []).forEach(c => {
      const pid = c.planejamento_id ?? c.gantt_planejamento_id
      if (pid) m.set(`${pid}|${Number(c.semana)}`, c)
    })
    return m
  }, [cronograma])

  async function salvarCelula(acaoId, semanaAno, horas, concluido, opts = {}) {
    if (!periodoId) return
    setSalvando(true)
    setError(null)
    const semana = Number(semanaAno)
    const key = `a_${acaoId}_${semana}`
    const planejamentoId = opts?.planejamentoId != null && String(opts.planejamentoId).trim() !== ''
      ? String(opts.planejamentoId).trim() : null
    const existente = planejamentoId
      ? mapaCronogramaPorPlanejamento.get(`${planejamentoId}|${semana}`)
      : mapaCronograma[key]
    const payload = {
      periodo_id: periodoId,
      acao_id: acaoId,
      tarefa_id: null,
      semana_ano: semana,
      horas_previstas: horas != null && horas !== '' ? Number(horas) : null,
      status: concluido ? 'concluido' : 'pendente',
      ...(planejamentoId ? { planejamento_id: planejamentoId } : {})
    }
    const { data: { user } } = await supabase.auth.getUser()
    const usuarioEmail = user?.email ?? null
    if (existente?.id) {
      const { error: err } = await supabase.from('cronograma').update({
        horas_previstas: payload.horas_previstas,
        status: payload.status,
        semana,
        periodo_id: periodoId,
        usuario: usuarioEmail,
        ...(planejamentoId ? { planejamento_id: planejamentoId } : {})
      }).eq('id', existente.id)
      if (err) { setError(err.message); setSalvando(false); return }
    } else {
      const { error: err } = await supabase.from('cronograma').insert({
        periodo_id: periodoId,
        acao_id: acaoId,
        tarefa_id: null,
        semana,
        horas_previstas: payload.horas_previstas,
        status: payload.status,
        usuario: usuarioEmail,
        ...(planejamentoId ? { planejamento_id: planejamentoId } : {})
      })
      if (err) { setError(err.message); setSalvando(false); return }
    }
    setSalvando(false)
    void registrarLog({
      modulo: 'Planejamento',
      area: areas.find((a) => a.id === areaId)?.nome ?? null,
      entidade: 'cronograma',
      entidade_id: acaoId,
      operacao: concluido ? 'UPDATE' : 'INSERT',
      valor_novo: {
        acao_id: acaoId,
        semana: semanaAno,
        horas: horas,
        concluido: concluido
      },
      descricao: concluido
        ? `Registrou conclusão da atividade na semana ${semanaAno}`
        : `Registrou ${horas}h na atividade semana ${semanaAno}`
    })
    await carregarCronograma()
  }

  const { mapaHoras, mapaStatus, totalPorSemana, overflowSemanas } = useMemo(() => {
    const horas = {}
    const status = {}
    const total = {}
    const crRows = Array.isArray(cronograma) ? cronograma : []
    crRows.forEach(c => {
      const pid = c.planejamento_id ?? c.gantt_planejamento_id
      const baseKey = c.tarefa_id ? `t_${c.tarefa_id}` : `a_${c.acao_id}`
      const key = pid ? `${baseKey}__p_${pid}` : baseKey
      const col = Number(c.semana)
      if (!horas[key]) horas[key] = {}
      if (!status[key]) status[key] = {}
      if (col != null && Number.isFinite(col)) {
        horas[key][col] = (horas[key][col] || 0) + Number(c.horas_previstas || 0)
        status[key][col] = c.status || 'pendente'
        total[col] = (total[col] || 0) + Number(c.horas_previstas || 0)
      }
    })
    const overflow = new Set(Object.entries(total).filter(([, v]) => v > HORAS_MAX_SEMANA).map(([s]) => Number(s)))
    return { mapaHoras: horas, mapaStatus: status, totalPorSemana: total, overflowSemanas: overflow }
  }, [cronograma])

  const acaoIdsNaArea = useMemo(() => {
    const ids = new Set()
    tarefas.forEach(t => (t.acoes || []).forEach(a => ids.add(a.id)))
    return ids
  }, [tarefas])

  const planejamentoNaArea = useMemo(() => {
    return planejamento.filter(p => acaoIdsNaArea.has(p.acao_id))
  }, [planejamento, acaoIdsNaArea])

  const acaoPorId = useMemo(() => {
    const m = {}
    tarefas.forEach(t => (t.acoes || []).forEach(a => { m[a.id] = { ...a, tarefa: t } }))
    return m
  }, [tarefas])

  const linhas = useMemo(() => {
    const out = []
    const grupos = new Map()
    const cronogramaList = Array.isArray(cronograma) ? cronograma : []
    const semanasSetPeriodo = new Set((semanas || []).map(Number).filter(Number.isFinite))
    // Calculado uma vez no escopo do useMemo para estar disponível em todo o bloco
    const acaoIdsNoCronograma = new Set(
      cronogramaList
        .filter(c => semanasSetPeriodo.size > 0 && semanasSetPeriodo.has(Number(c?.semana)))
        .map(c => String(c.acao_id ?? ''))
        .filter(Boolean)
    )

    const semanasDoPeriodo = semanas
    const temPlanejamentoAcaoNoPeriodo = (acaoId) => {
      const k = String(acaoId ?? '')
      if (!k) return false
      if (acaoIdsNoCronograma.has(k)) return true
      if (!semanasDoPeriodo?.length) return false
      return planejamentoNaArea.some(p => {
        if (String(p.acao_id ?? '') !== k) return false
        return expandGanttSemanasParaGradeIso(p, semanasDoPeriodo).length > 0
      })
    }
    const temPlanejamentoComportamentoNoPeriodo = (tarefa) => {
      const ids = new Set((tarefa.acoes || []).map(a => String(a?.id ?? '')).filter(Boolean))
      if (ids.size === 0) return false
      return [...ids].some(id => temPlanejamentoAcaoNoPeriodo(id))
    }

    tarefas.forEach(t => {
      /** Evita perder/partir casas por depender de `acaoPorId[p.acao_id]?.tarefa?.id` (join/legado pode divergir). */
      const acaoIdsDaTarefa = new Set((t.acoes || []).map(a => String(a?.id ?? '')).filter(Boolean))
      const acoesNoPlano = planejamentoNaArea.filter(p => {
        if (!acaoIdsDaTarefa.has(String(p.acao_id ?? ''))) return false
        // Só considerar planejamento com ao menos 1 semana no período visualizado
        if (!semanasDoPeriodo?.length) return false
        const wk = expandGanttSemanasParaGradeIso(p, semanasDoPeriodo)
        return wk.length > 0
      })
      if (!temPlanejamentoComportamentoNoPeriodo(t)) return
      // Agrupar pelas metas do plano e/ou meta vinculada ao comportamento (tarefas.objetivo_id).
      // t.objetivo_id só é incluído se a tarefa não tiver registros em metas diferentes — evita
      // aparecer em seções de metas onde não há planejamento real.
      const objetivosDoRegistros = acoesNoPlano
        .map(p => p.objetivo_id)
        .filter(Boolean)
        .map(oid => metaIdCanonica(metasObjetivos, oid))
        .filter(Boolean)

      const temRegistrosEmOutrasMetas = objetivosDoRegistros
        .some(oid => !idObjetivoIgual(oid, t.objetivo_id))

      const objetivosDoPlano = [...new Set([
        ...objetivosDoRegistros,
        ...(!temRegistrosEmOutrasMetas && t.objetivo_id
          ? [metaIdCanonica(metasObjetivos, t.objetivo_id)]
          : [])
      ])]

      if (objetivosDoPlano.length > 0) {
        objetivosDoPlano.forEach(oid => {
          const filtrado = acoesNoPlano.filter(p => {
            if (idObjetivoIgual(p.objetivo_id, oid)) return true
            const semMeta = p.objetivo_id == null || String(p.objetivo_id).trim() === ''
            return semMeta && idObjetivoIgual(t.objetivo_id, oid)
          })
          const acaoIdsParaEsteObjetivo = new Set(
            filtrado.map(p => String(p.acao_id || '')).filter(Boolean)
          )
          if (idObjetivoIgual(t.objetivo_id, oid)) {
            acaoIdsDaTarefa.forEach(id => acaoIdsParaEsteObjetivo.add(id))
          }
          const temNoCronograma = [...acaoIdsParaEsteObjetivo].some(
            id => acaoIdsNoCronograma.has(id)
          )
          if (filtrado.length === 0 && !temNoCronograma) return
          if (!grupos.has(oid)) grupos.set(oid, [])
          grupos.get(oid).push({ t, acoesNoPlano: filtrado })
        })
      } else {
        // Legado (cronograma) ou sem objetivo: usar objetivo_id da tarefa
        const oid = t.objetivo_id || '_sem'
        if (!grupos.has(oid)) grupos.set(oid, [])
        grupos.get(oid).push({ t, acoesNoPlano })
      }
    })

    const orderedKeys = []
    metasObjetivos.forEach(m => {
      if (grupos.has(m.id)) orderedKeys.push(m.id)
    })
    grupos.forEach((_, k) => {
      if (k !== '_sem' && !orderedKeys.includes(k)) orderedKeys.push(k)
    })
    if (grupos.has('_sem')) orderedKeys.push('_sem')

    // Ordenar metas: prazo mais próximo primeiro, empate = alfabético
    orderedKeys.sort((oidA, oidB) => {
      if (oidA === '_sem') return 1
      if (oidB === '_sem') return -1
      const metaA = metasObjetivos.find(m => m.id === oidA)
      const metaB = metasObjetivos.find(m => m.id === oidB)
      const prazoA = metaA ? (extrairSemanaPrazoMeta(metaA) ?? Infinity) : Infinity
      const prazoB = metaB ? (extrairSemanaPrazoMeta(metaB) ?? Infinity) : Infinity
      if (prazoA !== prazoB) return prazoA - prazoB
      const nomeA = String(metaA?.descricao || '').toLowerCase()
      const nomeB = String(metaB?.descricao || '').toLowerCase()
      return nomeA.localeCompare(nomeB, 'pt-BR')
    })

    for (const oid of orderedKeys) {
      const items = grupos.get(oid) ?? []
      const chunkObjetivo = []
      if (oid !== '_sem') {
        const meta = metasObjetivos.find(m => m.id === oid)
        chunkObjetivo.push({
          id: `o_${oid}`,
          tipo: 'objetivo',
          objetivoId: oid,
          nome: meta?.descricao || 'Meta',
          meta: meta || null
        })
      }
      // Ordenar comportamentos: menor semana planejada no período atual primeiro
      const itemsOrdenados = [...items].sort((ia, ib) => {
        const minSemana = (acoesDoItem) => {
          if (!acoesDoItem?.length) return Infinity
          const wks = acoesDoItem.flatMap(p =>
            expandGanttSemanasParaGradeIso(p, semanas)
          ).map(Number).filter(Number.isFinite)
          return wks.length ? Math.min(...wks) : Infinity
        }
        return minSemana(ia.acoesNoPlano) - minSemana(ib.acoesNoPlano)
      })
      for (const { t, acoesNoPlano } of itemsOrdenados) {
        const chunkTarefa = []
        const pushLinhaAcao = (a, rowsMesmaAcao, tipoAtividadeBar, rowOpts = {}) => {
          if (process.env.NODE_ENV === 'development' && isAreaTipoAtividadeProjeto) {
            console.log('[pushLinhaAcao] acao:', a.nome, 'tipo:', tipoAtividadeBar, 'rows:', rowsMesmaAcao.length, 'casas:', rowsMesmaAcao.map(r => r.casa_id))
          }
          const horasEst = a.tempo_estimado_minutos != null ? Math.round((a.tempo_estimado_minutos / 60) * 10) / 10 : null
          const tipoBar = tipoAtividadeBar === 'modelagem' || tipoAtividadeBar === 'documentacao' ? tipoAtividadeBar : null
          const origemLegado = Boolean(rowOpts.origemCronogramaLegado)

          if (rowsMesmaAcao.length <= 1) {
            // Caso simples: comportamento original preservado
            const mergedSet = new Set()
            rowsMesmaAcao.forEach(r => {
              expandGanttSemanasParaGradeIso(r, semanas).forEach(w => mergedSet.add(w))
            })
            const semSel = Array.from(mergedSet).sort((x, y) => x - y)
            const responsaveis = [...new Set(
              (rowsMesmaAcao || [])
                .map(r => r?.responsavel)
                .filter(r => r && r !== '—' && String(r).trim() !== '')
                .map(r => String(r).trim())
            )]
            const resp = responsaveis.length > 0 ? responsaveis.join(', ') : '—'
            chunkTarefa.push({
              id: `a_${a.id}_${oid}`,
              tipo: 'acao',
              nome: a.nome,
              responsavel: resp,
              semanasSelecionadas: semSel,
              tempoHoras: horasEst,
              comportamentoId: t.id,
              acaoId: a.id,
              planejamentoId: rowsMesmaAcao[0]?.id,
              planejamentoIds: rowsMesmaAcao.map(r => r.id).filter(Boolean),
              planejamentoRows: rowsMesmaAcao,
              objetivoId: oid,
              tipoAtividadeBar: tipoBar,
              /** Linha montada só a partir de `cronograma` (sem `gantt_planejamento`): os ids são de cronograma, não de planejamento. */
              origemCronogramaLegado: origemLegado
            })
          } else {
            // Múltiplos registros: uma sublinha por registro — rowspan real nas colunas fixas
            const regsComSemanas = rowsMesmaAcao.filter(reg =>
              expandGanttSemanasParaGradeIso(reg, semanas).length > 0
            )
            const total = regsComSemanas.length
            const todasSemanas = regsComSemanas.flatMap(r => expandGanttSemanasParaGradeIso(r, semanas))
            regsComSemanas.forEach((reg, idx) => {
              const semanasDoReg = expandGanttSemanasParaGradeIso(reg, semanas)
              const respReg = String(reg.responsavel || '').trim() || '—'
              chunkTarefa.push({
                id: idx === 0 ? `a_${a.id}_${oid}` : `a_${a.id}_${oid}_sub${idx}`,
                tipo: 'acao',
                nome: idx === 0 ? a.nome : '',
                responsavel: idx === 0 ? respReg : '',
                semanasSelecionadas: semanasDoReg,
                tempoHoras: horasEst,
                comportamentoId: t.id,
                acaoId: a.id,
                planejamentoId: reg.id,
                planejamentoIds: [reg.id].filter(Boolean),
                planejamentoRows: [reg],
                objetivoId: oid,
                tipoAtividadeBar: tipoBar,
                origemCronogramaLegado: origemLegado,
                esconderAcoes: idx > 0,
                temSublinhas: idx === 0 && total > 1,
                grupoTotal: total,
                grupoSemanas: idx === 0 ? todasSemanas : undefined,
                grupoRows: idx === 0 ? regsComSemanas : undefined
              })
            })
          }
        }

        // Ordenar ações: concluídas primeiro, depois por semana planejada mais próxima
        const minSemPorAcaoOrd = new Map()
        acoesNoPlano.forEach(p => {
          const k = String(p.acao_id || '')
          if (!k) return
          const wks = expandGanttSemanasParaGradeIso(p, semanas).map(Number).filter(Number.isFinite)
          if (wks.length > 0) {
            const m = Math.min(...wks)
            if (m < (minSemPorAcaoOrd.get(k) ?? Infinity)) minSemPorAcaoOrd.set(k, m)
          }
        })
        const concluidasPorAcaoOrd = new Set(
          Object.entries(mapaStatus)
            .filter(([, semanaMap]) =>
              semanaMap != null &&
              Object.values(semanaMap).some(st => cronogramaStatusEhConcluido(st))
            )
            .map(([chave]) => {
              // chave: a_{acaoId}__p_{planejamentoId} ou a_{acaoId}
              const match = chave.match(/^a_([^_].*?)(?:__p_|$)/)
              return match ? match[1] : null
            })
            .filter(Boolean)
        )
        const semanaConclPorAcao = new Map()
        Object.entries(mapaStatus).forEach(([chave, semanaMap]) => {
          if (!semanaMap) return
          const match = chave.match(/^a_([^_].*?)(?:__p_|$)/)
          if (!match) return
          const acaoId = match[1]
          Object.entries(semanaMap).forEach(([sem, st]) => {
            if (cronogramaStatusEhConcluido(st)) {
              const s = Number(sem)
              if (!semanaConclPorAcao.has(acaoId) || s < semanaConclPorAcao.get(acaoId)) {
                semanaConclPorAcao.set(acaoId, s)
              }
            }
          })
        })
        const acoesNoPlanoPorSemana = [...acoesNoPlano].sort((pa, pb) => {
          const aidA = String(pa.acao_id || '')
          const aidB = String(pb.acao_id || '')
          const conclA = concluidasPorAcaoOrd.has(aidA)
          const conclB = concluidasPorAcaoOrd.has(aidB)
          if (conclA && conclB) {
            const sA = semanaConclPorAcao.get(aidA) ?? Infinity
            const sB = semanaConclPorAcao.get(aidB) ?? Infinity
            return sA - sB
          }
          if (conclA && !conclB) return -1
          if (!conclA && conclB) return 1
          return (minSemPorAcaoOrd.get(aidA) ?? Infinity) - (minSemPorAcaoOrd.get(aidB) ?? Infinity)
        })

        if (!isAreaTipoAtividadeProjeto) {
          const acoesJaListadasLegacy = new Set()
          if (acoesNoPlano.length > 0) {
            // Novo: gantt_planejamento
            acoesNoPlanoPorSemana.forEach(p => {
              const a = acaoPorId[p.acao_id]
              const k = String(p.acao_id || '')
              if (!a || !k || acoesJaListadasLegacy.has(k)) return
              if (!temPlanejamentoAcaoNoPeriodo(k)) return
              acoesJaListadasLegacy.add(k)
              const rowsMesmaAcao = acoesNoPlano
                .filter(x => String(x.acao_id || '') === k)
                .sort((a, b) => {
                  const planejIdA = String(a.id || '')
                  const planejIdB = String(b.id || '')
                  const acaoId = String(a.acao_id || '')
                  const semMapA = mapaStatus[`a_${acaoId}__p_${planejIdA}`]
                  const semMapB = mapaStatus[`a_${acaoId}__p_${planejIdB}`]
                  const conclA = semMapA ? Object.values(semMapA).some(st => cronogramaStatusEhConcluido(st)) : false
                  const conclB = semMapB ? Object.values(semMapB).some(st => cronogramaStatusEhConcluido(st)) : false
                  if (conclA && !conclB) return -1
                  if (!conclA && conclB) return 1
                  const chaveA = String(
                    a.franqueado_nome ||
                    a.adm_cnpj_id ||
                    a.controladoria_cnpj_id ||
                    a.portfolio_franqueado_id ||
                    a.comercial_candidato_id ||
                    a.juridico_identificacao_id ||
                    a.casa_id || ''
                  ).toLowerCase()
                  const chaveB = String(
                    b.franqueado_nome ||
                    b.adm_cnpj_id ||
                    b.controladoria_cnpj_id ||
                    b.portfolio_franqueado_id ||
                    b.comercial_candidato_id ||
                    b.juridico_identificacao_id ||
                    b.casa_id || ''
                  ).toLowerCase()
                  return chaveA.localeCompare(chaveB, 'pt-BR')
                })
              pushLinhaAcao(a, rowsMesmaAcao, null)
            })
          } else {
            // Legado: cronograma — listar ações da tarefa que têm registro no cronograma
            ;(t.acoes || []).forEach(a => {
              const k = String(a.id || '')
              if (!a || !k || acoesJaListadasLegacy.has(k)) return
              if (!temPlanejamentoAcaoNoPeriodo(k)) return
              acoesJaListadasLegacy.add(k)
              // Converter registros do cronograma para formato gantt_planejamento
              const rowsCrono = cronogramaList
                .filter(
                  c =>
                    String(c.acao_id ?? '') === k &&
                    semanasSetPeriodo.size > 0 &&
                    semanasSetPeriodo.has(Number(c?.semana))
                )
                .map(c => ({
                  ...c,
                  semanas_selecionadas: c.semana != null ? [Number(c.semana)] : [],
                  objetivo_id: t.objetivo_id || null
                }))
              pushLinhaAcao(a, rowsCrono, null, { origemCronogramaLegado: true })
            })
          }
          if (chunkTarefa.some(l => l.tipo === 'acao')) {
            chunkTarefa.unshift({
              id: `t_${t.id}_${oid}`,
              tipo: 'comportamento',
              nome: t.nome,
              comportamentoId: t.id,
              objetivoId: oid
            })
            chunkObjetivo.push(...chunkTarefa)
          }
          continue
        }

        if (process.env.NODE_ENV === 'development') {
          console.log('[isAreaTipoAtividadeProjeto] tarefa:', t.nome, 'acoesNoPlano:', acoesNoPlano.length)
          acoesNoPlano.forEach(p => {
            const ax = acaoPorId[p.acao_id]
            console.log('  acao_id:', p.acao_id, 'nome:', ax?.nome, 'tipo:', ax?.tipo_atividade, 'casa_id:', p.casa_id)
          })
        }

        const acoesJaListadas = new Set()
        const ordemDescoberta = []
        acoesNoPlanoPorSemana.forEach(p => {
          const a = acaoPorId[p.acao_id]
          const k = String(p.acao_id || '')
          if (!a || !k || acoesJaListadas.has(k)) return
          if (!temPlanejamentoAcaoNoPeriodo(k)) return
          acoesJaListadas.add(k)
          const rowsMesmaAcao = acoesNoPlano
            .filter(x => String(x.acao_id || '') === k)
            .sort((a, b) => {
              const planejIdA = String(a.id || '')
              const planejIdB = String(b.id || '')
              const acaoId = String(a.acao_id || '')
              const semMapA = mapaStatus[`a_${acaoId}__p_${planejIdA}`]
              const semMapB = mapaStatus[`a_${acaoId}__p_${planejIdB}`]
              const conclA = semMapA ? Object.values(semMapA).some(st => cronogramaStatusEhConcluido(st)) : false
              const conclB = semMapB ? Object.values(semMapB).some(st => cronogramaStatusEhConcluido(st)) : false
              if (conclA && !conclB) return -1
              if (!conclA && conclB) return 1
              const chaveA = String(
                a.franqueado_nome ||
                a.adm_cnpj_id ||
                a.controladoria_cnpj_id ||
                a.portfolio_franqueado_id ||
                a.comercial_candidato_id ||
                a.juridico_identificacao_id ||
                a.casa_id || ''
              ).toLowerCase()
              const chaveB = String(
                b.franqueado_nome ||
                b.adm_cnpj_id ||
                b.controladoria_cnpj_id ||
                b.portfolio_franqueado_id ||
                b.comercial_candidato_id ||
                b.juridico_identificacao_id ||
                b.casa_id || ''
              ).toLowerCase()
              return chaveA.localeCompare(chaveB, 'pt-BR')
            })
          const tipoDb = a.tipo_atividade
          const tipo = tipoDb === 'modelagem' || tipoDb === 'documentacao' ? tipoDb : null
          ordemDescoberta.push({ a, rowsMesmaAcao, tipo })
        })
        const nullLinhas = ordemDescoberta.filter(x => x.tipo == null)
        const modLinhas = ordemDescoberta.filter(x => x.tipo === 'modelagem')
        const docLinhas = ordemDescoberta.filter(x => x.tipo === 'documentacao')
        const temAlgumTipado = modLinhas.length > 0 || docLinhas.length > 0

        if (nullLinhas.length > 0) {
          chunkTarefa.push({
            id: `t_${t.id}_${oid}`,
            tipo: 'comportamento',
            nome: t.nome,
            comportamentoId: t.id,
            objetivoId: oid
          })
          nullLinhas.forEach(({ a, rowsMesmaAcao }) => pushLinhaAcao(a, rowsMesmaAcao, null))
        }

        if (temAlgumTipado) {
          if (modLinhas.length > 0) {
            chunkTarefa.push({
              id: `sec_m_${t.id}_${oid}`,
              tipo: 'secao_tipo_atividade',
              secaoTipo: 'modelagem',
              nome: 'Modelagem',
              objetivoId: oid
            })
            chunkTarefa.push({
              id: `t_${t.id}__m_${oid}`,
              tipo: 'comportamento',
              nome: t.nome,
              comportamentoId: t.id,
              objetivoId: oid,
              estiloGrupoProjeto: true,
              excluirDaContagemMeta: true
            })
            modLinhas.forEach(({ a, rowsMesmaAcao }) => pushLinhaAcao(a, rowsMesmaAcao, 'modelagem'))
          }
          if (modLinhas.length > 0 && docLinhas.length > 0) {
            chunkTarefa.push({ id: `sp_${t.id}_${oid}`, tipo: 'secao_spacer', objetivoId: oid })
          }
          if (docLinhas.length > 0) {
            chunkTarefa.push({
              id: `sec_d_${t.id}_${oid}`,
              tipo: 'secao_tipo_atividade',
              secaoTipo: 'documentacao',
              nome: 'Documentação',
              objetivoId: oid
            })
            chunkTarefa.push({
              id: `t_${t.id}__d_${oid}`,
              tipo: 'comportamento',
              nome: t.nome,
              comportamentoId: t.id,
              objetivoId: oid,
              estiloGrupoProjeto: true,
              excluirDaContagemMeta: true
            })
            docLinhas.forEach(({ a, rowsMesmaAcao }) => pushLinhaAcao(a, rowsMesmaAcao, 'documentacao'))
          }
        }
        if (chunkTarefa.some(l => l.tipo === 'acao')) chunkObjetivo.push(...chunkTarefa)
      }
      if (chunkObjetivo.some(l => l.tipo === 'acao')) out.push(...chunkObjetivo)
    }
    return filtrarLinhasGradeSohComPlanoNoPeriodo(out)
  }, [tarefas, planejamentoNaArea, cronograma, acaoPorId, metasObjetivos, semanas, indicadoresPorObjetivo, periodo, isAreaTipoAtividadeProjeto, mapaStatus])

  const linhasFiltradas = useMemo(() => {
    if (!filtroResponsavelId) return linhas

    // Passo 1: quais acao_id têm ao menos um registro com o responsável selecionado.
    // Para sublinhas (esconderAcoes), o responsável real está em planejamentoRows[0].
    const acaoIdsDoResponsavel = new Set(
      linhas
        .filter(l => l.tipo === 'acao')
        .filter(l => {
          const respStr = l.esconderAcoes
            ? String(l.planejamentoRows?.[0]?.responsavel ?? '')
            : String(l.responsavel ?? '')
          return responsavelStrParaIds(respStr, areaPessoasLista).includes(filtroResponsavelId)
        })
        .map(l => l.acaoId)
        .filter(Boolean)
    )

    // Passo 2: coletar objetivos e comportamentos que têm ao menos uma ação do responsável.
    const objetivosComResponsavel = new Set()
    const comportamentosComResponsavel = new Set()
    linhas.forEach(l => {
      if (l.tipo === 'acao' && acaoIdsDoResponsavel.has(l.acaoId)) {
        if (l.objetivoId) objetivosComResponsavel.add(l.objetivoId)
        if (l.comportamentoId) comportamentosComResponsavel.add(l.comportamentoId)
      }
    })

    // Passo 3: filtrar — ações pelo acaoId, comportamentos e objetivos pelos seus sets,
    // seções e outros tipos sempre passam (sem responsável próprio).
    return linhas.filter(l => {
      if (l.tipo === 'acao') return acaoIdsDoResponsavel.has(l.acaoId)
      if (l.tipo === 'comportamento') {
        return comportamentosComResponsavel.has(l.comportamentoId) &&
          objetivosComResponsavel.has(l.objetivoId)
      }
      if (l.tipo === 'objetivo') return objetivosComResponsavel.has(l.objetivoId)
      return true // secao_tipo_atividade, secao_spacer, etc.
    })
  }, [linhas, filtroResponsavelId, areaPessoasLista])

  /** Metas com pelo menos uma linha de comportamento ou ação no plano (para rótulo «Atividades»). */
  const metaTemAtividadesNoPlano = useMemo(() => {
    const m = {}
    linhas.forEach(l => {
      if (l.excluirDaContagemMeta) return
      if (l.tipo === 'comportamento' || l.tipo === 'acao') {
        const o = metaIdCanonica(metasObjetivos, l.objetivoId)
        if (o && o !== '_sem') m[o] = true
      }
    })
    return m
  }, [linhas, metasObjetivos])

  /** Todas as ações da área (não ocultar as já planejadas): a mesma atividade pode ser reutilizada para outra meta — ao salvar, alinhamos a tarefa e atualizamos o registro do período se já existir. */
  const atividadesDisponiveis = useMemo(() => {
    const list = []
    tarefas.forEach(t => (t.acoes || []).forEach(a => {
      list.push({ ...a, tarefaId: t.id, tarefaNome: t.nome, objetivoId: t.objetivo_id ?? null })
    }))
    return list
  }, [tarefas])

  /** Ações da área para a meta escolhida no drawer; lista completa como acima. */
  const atividadesDisponiveisNaMeta = useMemo(() => {
    if (!addObjetivoId) return []
    return atividadesDisponiveis
  }, [atividadesDisponiveis, addObjetivoId])

  const comportamentosDisponiveis = useMemo(() => {
    const m = new Map()
    ;(atividadesDisponiveisNaMeta || []).forEach(a => {
      if (!a?.tarefaId) return
      if (!m.has(a.tarefaId)) {
        m.set(a.tarefaId, { tarefaId: a.tarefaId, tarefaNome: a.tarefaNome || '—', count: 0 })
      }
      m.get(a.tarefaId).count += 1
    })
    const out = Array.from(m.values())
    out.sort((a, b) => String(a.tarefaNome).localeCompare(String(b.tarefaNome), 'pt-BR', { sensitivity: 'base' }))
    return out
  }, [atividadesDisponiveisNaMeta])

  const atividadesDisponiveisDoComportamento = useMemo(() => {
    if (!addTarefaId) return atividadesDisponiveisNaMeta || []
    return (atividadesDisponiveisNaMeta || []).filter(a => String(a.tarefaId) === String(addTarefaId))
  }, [atividadesDisponiveisNaMeta, addTarefaId])

  /**
   * Agrupa atividades no drawer (áreas Projetos - Modelo Virtual / Executivos Locais):
   * - só esteira (modelagem e/ou documentação, sem comuns) → cenário 1
   * - esteira + comuns → cenário 3 (Modelagem, Documentação, Comum)
   * - só comuns → null → lista simples (cenário 2)
   */
  const atividadesDrawerPorTipo = useMemo(() => {
    const base = atividadesDisponiveisDoComportamento || []
    if (!isAreaTipoAtividadeProjeto || base.length === 0) return null
    const modelagem = base.filter(a => a.tipo_atividade === 'modelagem')
    const documentacao = base.filter(a => a.tipo_atividade === 'documentacao')
    const comum = base.filter(a => a.tipo_atividade !== 'modelagem' && a.tipo_atividade !== 'documentacao')
    const temEsteira = modelagem.length > 0 || documentacao.length > 0
    if (!temEsteira) return null
    return {
      scenario: comum.length > 0 ? 'misto' : 'esteira',
      modelagem,
      documentacao,
      comum
    }
  }, [atividadesDisponiveisDoComportamento, isAreaTipoAtividadeProjeto])

  /** Minutos estimados da linha `acoes` (compatível com `tempo_estimado_minutos`; ignora `tempo` se não existir). */
  function minutosAcaoDrawer(acao) {
    if (acao == null) return null
    const m = acao.tempo_estimado_minutos
    if (m != null && Number.isFinite(Number(m))) return Number(m)
    const t = acao.tempo
    if (t != null && t !== '' && Number.isFinite(Number(t))) return Number(t)
    return null
  }

  const textoCargaEstimadaDrawer = min => {
    if (min == null) return '—'
    if (min >= 60) return (min / 60) % 1 === 0 ? `${min / 60} h` : `${Math.round((min / 60) * 100) / 100} h`
    return `${min} min`
  }

  /** Deve ficar após `atividadesDisponiveis` — senão ReferenceError (TDZ) e tela branca no Gantt. */
  useEffect(() => {
    if (!showAddAtividade) return
    if (addTarefaId) return
    const first = (atividadesDisponiveis || []).find(a => a?.tarefaId)?.tarefaId
    if (first) setAddTarefaId(first)
  }, [showAddAtividade, addTarefaId, atividadesDisponiveis])

  useEffect(() => {
    if (!showAddAtividade || !addObjetivoId) return
    if (comportamentosDisponiveis.length === 0) return
    const ok = comportamentosDisponiveis.some(c => String(c.tarefaId) === String(addTarefaId))
    if (!ok) setAddTarefaId(comportamentosDisponiveis[0].tarefaId)
  }, [showAddAtividade, addObjetivoId, addTarefaId, comportamentosDisponiveis])

  async function adicionarAtividade() {
    if (!periodoId || addAcaoIds.length === 0) return
    if (!addObjetivoId) {
      setError('Selecione uma meta na lista.')
      return
    }
    const idsValidos = addAcaoIds.filter(id => atividadesDisponiveisNaMeta.some(a => a.id === id))
    if (idsValidos.length === 0) {
      setError('Selecione ao menos uma atividade disponível para esta meta.')
      return
    }
    const semanas = addSemanasSelecionadas.slice().sort((a, b) => a - b)
    if (semanas.length === 0) { setError('Selecione ao menos uma semana.'); return }
    const nomesResp = addResponsavelPessoaIds
      .map(pid => {
        const p = areaPessoasLista.find(p => p.id === pid)
        return p ? (p.profile_full_name || p.nome) : null
      })
      .filter(Boolean)
    const responsavelStr = nomesResp.length ? nomesResp[0] : null
    const fnAlvo = isAreaFranqueado
      ? normalizeFranqueadoNome(
          franqueadosAtivos.find(f => String(f.id) === String(acoplamentoFranqueadoId || ''))?.nome
        )
      : null
    const casaIdParaSalvar =
      isAreaCasa && casaSelecionada && String(casaSelecionada).trim()
        ? String(casaSelecionada).trim()
        : null
    const casasAlvo =
      isAreaCasa
        ? (casasSelecionadas || []).map(x => String(x)).filter(Boolean)
        : []
    if (isAreaCasa && casasAlvo.length === 0) {
      setError('Selecione ao menos uma casa.')
      return
    }
    if (isAreaJuridico && !juridicoIdentificacaoId) {
      setError('Selecione uma identificação.')
      return
    }
    if (isAreaAdm && !admCnpjSelecionado) {
      if (admCnpjsTabelaAusente) {
        setError('A tabela adm_cnpjs não existe no banco. Execute o SQL do aviso amarelo acima e recarregue a página (F5).')
        return
      }
      if (criandoCnpj && novoCnpj.trim() && novoDescritivo.trim()) {
        setError('Salve o CNPJ / empresa (botão Salvar no campo abaixo) antes de adicionar ao plano.')
        return
      }
      setError('Selecione um CNPJ / empresa.')
      return
    }

    const payloadJuridico = isAreaJuridico
      ? { juridico_identificacao_id: juridicoIdentificacaoId, juridico_tipo: juridicoTipo }
      : {}
    const comercialCandidatoIdSalvar = isAreaComercial ? (comercialCandidatoId ?? null) : null

    if (addDrawerEditando && addPlanejamentoEdicaoId) {
      if (idsValidos.length !== 1) {
        setError('Edição permite apenas uma atividade por vez.')
        return
      }
      const addAcaoId = idsValidos[0]
      setSalvandoAdd(true)
      setError(null)

      const linhaPlanejamentoBatePeriodo = (p) => {
        if (!p) return false
        return String(p.periodo_id || '') === String(periodoId || '')
      }

      const salvarPlanejamentoPorCasa = async (casaId) => {
        const existente = planejamento.find(p =>
          p.acao_id === addAcaoId &&
          String(p.casa_id || '') === String(casaId) &&
          String(p.objetivo_id || '') === String(addObjetivoId || '')
        )

        if (existente?.id) {
          const resUp = await supabase
            .from('gantt_planejamento')
            .update({
              responsavel: responsavelStr,
              semanas_selecionadas: semanas,
              semana_inicio: null,
              semana_fim: null,
              casa_id: casaId,
              periodo_id: periodoId,
              adm_cnpj_id: isAreaAdm ? admCnpjSelecionado : null,
              controladoria_cnpj_id: isAreaControladoria ? (controladoriaCnpjSelecionado ?? null) : null
            })
            .eq('id', existente.id)
          return resUp.error || null
        }

        const payloadInsert = {
          acao_id: addAcaoId,
          responsavel: responsavelStr,
          semanas_selecionadas: semanas,
          semana_inicio: null,
          semana_fim: null,
          casa_id: casaId,
          periodo_id: periodoId,
          adm_cnpj_id: isAreaAdm ? admCnpjSelecionado : null,
          controladoria_cnpj_id: isAreaControladoria ? (controladoriaCnpjSelecionado ?? null) : null
        }
        const ins = await supabase.from('gantt_planejamento').insert(payloadInsert)
        if (!ins.error) return null

        const msg = String(ins.error.message || '').toLowerCase()
        const needsSemanasFallback = msg.includes('semanas_selecionadas') || msg.includes('column')
        if (!needsSemanasFallback) return ins.error

        const semanaInicio = semanas[0]
        const semanaFim = semanas[semanas.length - 1]
        const insLegado = await supabase.from('gantt_planejamento').insert({
          acao_id: addAcaoId,
          responsavel: responsavelStr,
          semana_inicio: semanaInicio,
          semana_fim: semanaFim,
          casa_id: casaId,
          periodo_id: periodoId,
          adm_cnpj_id: isAreaAdm ? admCnpjSelecionado : null,
          controladoria_cnpj_id: isAreaControladoria ? (controladoriaCnpjSelecionado ?? null) : null
        })
        return insLegado.error || null
      }

      if (isAreaCasa) {
        for (const casaId of casasAlvo) {
          const errCasa = await salvarPlanejamentoPorCasa(casaId)
          if (errCasa) {
            console.error('[gantt] erro ao salvar casa (edição):', errCasa)
            // Não exibir banner para schema legacy de colunas ausentes.
            if (!String(errCasa.message || '').toLowerCase().includes('periodo_id')) {
              setError(errCasa.message)
            }
            setSalvandoAdd(false)
            return
          }
        }

        const casasParaRemover = planejamento.filter(p =>
          p.acao_id === addAcaoId &&
          linhaPlanejamentoBatePeriodo(p) &&
          p.casa_id &&
          !casasAlvo.includes(String(p.casa_id))
        )
        for (const p of casasParaRemover) {
          const { error: errDel } = await supabase.from('gantt_planejamento').delete().eq('id', p.id)
          if (errDel) {
            setError(errDel.message)
            setSalvandoAdd(false)
            return
          }
        }
      } else {
        const { error: errEd } = await supabase
          .from('gantt_planejamento')
          .update({
            responsavel: responsavelStr,
            semanas_selecionadas: semanas,
            semana_inicio: null,
            semana_fim: null,
            franqueado_nome: isAreaFranqueado ? fnAlvo : null,
            adm_cnpj_id: isAreaAdm ? admCnpjSelecionado : null,
            controladoria_cnpj_id: isAreaControladoria ? (controladoriaCnpjSelecionado ?? null) : null,
            comercial_candidato_id: comercialCandidatoIdSalvar,
            portfolio_franqueado_id: isAreaPortfolio ? (portfolioFranqueadoId ?? null) : null,
            ...(isAreaCasa ? { casa_id: casaIdParaSalvar } : {}),
            ...payloadJuridico
          })
          .eq('id', addPlanejamentoEdicaoId)
        if (errEd) {
          setError(errEd.message)
          setSalvandoAdd(false)
          return
        }
        void registrarLog({
          modulo: 'Planejamento',
          area: areas.find((a) => a.id === areaId)?.nome ?? null,
          entidade: 'gantt_planejamento',
          entidade_id: addPlanejamentoEdicaoId,
          operacao: 'UPDATE',
          valor_novo: {
            responsavel: responsavelStr,
            semanas_selecionadas: semanas,
            franqueado_nome: isAreaFranqueado ? fnAlvo : null,
            adm_cnpj_id: isAreaAdm ? admCnpjSelecionado : null,
            controladoria_cnpj_id: isAreaControladoria ? (controladoriaCnpjSelecionado ?? null) : null,
            comercial_candidato_id: comercialCandidatoIdSalvar,
            portfolio_franqueado_id: isAreaPortfolio ? (portfolioFranqueadoId ?? null) : null,
            casa_id: isAreaCasa ? casaIdParaSalvar : null,
            ...payloadJuridico
          },
          descricao: 'Atualizou planejamento no Gantt'
        })
      }
      const tarefaDaAcaoEd = acaoPorId[addAcaoId]?.tarefa
      if (tarefaDaAcaoEd?.id && addObjetivoId) {
        const atual = tarefaDaAcaoEd.objetivo_id
        const semMeta = atual == null || String(atual).trim() === ''
        // Só alinha meta na tarefa se ela ainda não tem nenhuma — nunca sobrescreve
        const precisaAlinharMeta = semMeta
        if (precisaAlinharMeta) {
          const { error: errTar } = await supabase
            .from('tarefas')
            .update({ objetivo_id: addObjetivoId })
            .eq('id', tarefaDaAcaoEd.id)
          if (errTar && !errTar.message?.includes('objetivo_id') && !errTar.message?.includes('schema cache')) {
            setError(errTar.message)
            setSalvandoAdd(false)
            await Promise.all([carregarPlanejamento(), carregarCronograma()])
            return
          }
          if (!errTar) {
            void registrarLog({
              modulo: 'Planejamento',
              area: areas.find((a) => a.id === areaId)?.nome ?? null,
              entidade: 'tarefa',
              entidade_id: tarefaDaAcaoEd.id,
              operacao: 'UPDATE',
              valor_anterior: { objetivo_id: atual },
              valor_novo: { objetivo_id: addObjetivoId },
              descricao: 'Alinhou meta da tarefa ao salvar planejamento (edição)'
            })
          }
        }
      }
      setAddAcaoIds([])
      setAddObjetivoId('')
      setAddResponsavelPessoaIds([])
      setAddSemanasSelecionadas([])
      setShowAddAtividade(false)
      setAddDrawerEditando(false)
      setAddPlanejamentoEdicaoId(null)
      resetAcoplamentoModalAux()
      resetPortfolioModalAux()
      resetComercialModalAux()
      resetAdmCnpjModalAux()
      resetControladoriaCnpjModalAux()
      setCasaSelecionada(null)
      setCasasSelecionadas([])
      resetModalCasaAux()
      resetJuridicoModalAux()
      setSalvandoAdd(false)
      await carregarTarefas()
      await Promise.all([carregarPlanejamento(), carregarCronograma()])
      return
    }

    setSalvandoAdd(true)
    setError(null)

    for (const addAcaoId of idsValidos) {
      let existenteNoPeriodo
      if (isAreaFranqueado) {
        existenteNoPeriodo = planejamentoNaArea.find(
          p => p.acao_id === addAcaoId && normalizeFranqueadoNome(p.franqueado_nome) === fnAlvo &&
            String(p.objetivo_id || '') === String(addObjetivoId || '')
        )
      } else if (isAreaComercial) {
        existenteNoPeriodo = planejamentoNaArea.find(
          p =>
            p.acao_id === addAcaoId &&
            String(p.comercial_candidato_id ?? '') === String(comercialCandidatoId ?? '') &&
            String(p.objetivo_id || '') === String(addObjetivoId || '')
        )
      } else if (isAreaJuridico) {
        existenteNoPeriodo = planejamentoNaArea.find(
          p =>
            p.acao_id === addAcaoId &&
            String(p.juridico_identificacao_id || '') === String(juridicoIdentificacaoId || '') &&
            String(p.objetivo_id || '') === String(addObjetivoId || '')
        )
      } else if (isAreaAdm) {
        /** Mesma ação + CNPJ = um registro; CNPJ diferente → insert (empilhamento na grade). */
        existenteNoPeriodo = planejamentoNaArea.find(
          p =>
            p.acao_id === addAcaoId &&
            String(p.adm_cnpj_id || '') === String(admCnpjSelecionado || '') &&
            String(p.objetivo_id || '') === String(addObjetivoId || '')
        )
      } else if (isAreaControladoria) {
        existenteNoPeriodo = planejamentoNaArea.find(
          p =>
            p.acao_id === addAcaoId &&
            String(p.controladoria_cnpj_id ?? '') === String(controladoriaCnpjSelecionado ?? '')
        )
      } else if (isAreaPortfolio) {
        existenteNoPeriodo = planejamentoNaArea.find(
          p =>
            p.acao_id === addAcaoId &&
            String(p.portfolio_franqueado_id ?? '') === String(portfolioFranqueadoId ?? '')
        )
      } else {
        existenteNoPeriodo = planejamentoNaArea.find(p =>
          p.acao_id === addAcaoId &&
          String(p.objetivo_id || '') === String(addObjetivoId || '')
        )
      }

      let err = null
      if (isAreaCasa) {
        for (const casaId of casasAlvo) {
          const existente = planejamentoNaArea.find(p => {
            if (p.acao_id !== addAcaoId) return false
            if (String(p.casa_id || '') !== String(casaId)) return false
            if (String(p.objetivo_id || '') !== String(addObjetivoId || '')) return false
            return true
          })
          if (existente?.id) {
            const resUp = await supabase
              .from('gantt_planejamento')
              .update({
                responsavel: responsavelStr,
                semanas_selecionadas: semanas,
                semana_inicio: null,
                semana_fim: null,
                casa_id: casaId,
                objetivo_id: addObjetivoId,
                periodo_id: periodoId,
                adm_cnpj_id: isAreaAdm ? admCnpjSelecionado : null,
                controladoria_cnpj_id: isAreaControladoria ? (controladoriaCnpjSelecionado ?? null) : null
              })
              .eq('id', existente.id)
            err = resUp.error
          } else {
            const payload = {
              acao_id: addAcaoId,
              responsavel: responsavelStr,
              semanas_selecionadas: semanas,
              semana_inicio: null,
              semana_fim: null,
              casa_id: casaId,
              objetivo_id: addObjetivoId,
              periodo_id: periodoId,
              adm_cnpj_id: isAreaAdm ? admCnpjSelecionado : null,
              controladoria_cnpj_id: isAreaControladoria ? (controladoriaCnpjSelecionado ?? null) : null
            }
            const ins = await supabase.from('gantt_planejamento').insert(payload)
            err = ins.error
            if (err) {
              const msg = String(err.message || '').toLowerCase()
              const needsSemanasFallback = msg.includes('semanas_selecionadas') || msg.includes('column')
              if (needsSemanasFallback) {
                const semanaInicio = semanas[0]
                const semanaFim = semanas[semanas.length - 1]
                const insLegado = await supabase.from('gantt_planejamento').insert({
                  acao_id: addAcaoId,
                  responsavel: responsavelStr,
                  semana_inicio: semanaInicio,
                  semana_fim: semanaFim,
                  casa_id: casaId,
                  periodo_id: periodoId,
                  adm_cnpj_id: isAreaAdm ? admCnpjSelecionado : null,
                  controladoria_cnpj_id: isAreaControladoria ? (controladoriaCnpjSelecionado ?? null) : null
                })
                err = insLegado.error || null
              }
            }
          }
          if (err) break
        }
      } else if (isAreaPortfolio) {
        /** Mesma ação + mesmo franqueado (ou ambos sem id) → update; id diferente → insert (empilhamento na grade). */
        const existentePort = planejamentoNaArea.find(
          p =>
            p.acao_id === addAcaoId &&
            String(p.portfolio_franqueado_id ?? '') === String(portfolioFranqueadoId ?? '') &&
            String(p.objetivo_id || '') === String(addObjetivoId || '')
        )
        const payloadPort = {
          acao_id: addAcaoId,
          responsavel: responsavelStr,
          semanas_selecionadas: semanas,
          semana_inicio: null,
          semana_fim: null,
          franqueado_nome: null,
          adm_cnpj_id: null,
          controladoria_cnpj_id: null,
          comercial_candidato_id: null,
          portfolio_franqueado_id: portfolioFranqueadoId ?? null,
          objetivo_id: addObjetivoId,
          casa_id: null,
          periodo_id: periodoId
        }
        if (existentePort?.id) {
          const resUp = await supabase
            .from('gantt_planejamento')
            .update(payloadPort)
            .eq('id', existentePort.id)
          err = resUp.error
        } else {
          const ins = await supabase.from('gantt_planejamento').insert(payloadPort)
          err = ins.error
          if (err) {
            const msgIns = String(err.message || '').toLowerCase()
            const needsSemanasFallback = msgIns.includes('semanas_selecionadas') || msgIns.includes('column')
            if (needsSemanasFallback) {
              const semanaInicio = semanas[0]
              const semanaFim = semanas[semanas.length - 1]
              const insLegado = await supabase.from('gantt_planejamento').insert({
                acao_id: addAcaoId,
                responsavel: responsavelStr,
                semana_inicio: semanaInicio,
                semana_fim: semanaFim,
                portfolio_franqueado_id: portfolioFranqueadoId ?? null,
                objetivo_id: addObjetivoId,
                periodo_id: periodoId
              })
              err = insLegado.error || null
            }
          }
        }
      } else if (isAreaControladoria) {
        /** Mesma ação + mesmo CNPJ (ou ambos sem CNPJ) → update; CNPJ diferente → insert (empilhamento na grade). */
        const existenteCtrl = planejamentoNaArea.find(
          p =>
            p.acao_id === addAcaoId &&
            String(p.controladoria_cnpj_id ?? '') === String(controladoriaCnpjSelecionado ?? '') &&
            String(p.objetivo_id || '') === String(addObjetivoId || '')
        )
        const payloadCtrl = {
          acao_id: addAcaoId,
          responsavel: responsavelStr,
          semanas_selecionadas: semanas,
          semana_inicio: null,
          semana_fim: null,
          franqueado_nome: null,
          adm_cnpj_id: null,
          controladoria_cnpj_id: controladoriaCnpjSelecionado ?? null,
          objetivo_id: addObjetivoId,
          casa_id: null,
          periodo_id: periodoId
        }
        if (existenteCtrl?.id) {
          const resUp = await supabase
            .from('gantt_planejamento')
            .update(payloadCtrl)
            .eq('id', existenteCtrl.id)
          err = resUp.error
        } else {
          const ins = await supabase.from('gantt_planejamento').insert(payloadCtrl)
          err = ins.error
          if (err) {
            const msgIns = String(err.message || '').toLowerCase()
            const needsSemanasFallback = msgIns.includes('semanas_selecionadas') || msgIns.includes('column')
            if (needsSemanasFallback) {
              const semanaInicio = semanas[0]
              const semanaFim = semanas[semanas.length - 1]
              const insLegado = await supabase.from('gantt_planejamento').insert({
                acao_id: addAcaoId,
                responsavel: responsavelStr,
                semana_inicio: semanaInicio,
                semana_fim: semanaFim,
                controladoria_cnpj_id: controladoriaCnpjSelecionado ?? null,
                objetivo_id: addObjetivoId,
                periodo_id: periodoId
              })
              err = insLegado.error || null
            }
          }
        }
      } else if (existenteNoPeriodo?.id) {
        const resUp = await supabase
          .from('gantt_planejamento')
          .update({
            responsavel: responsavelStr,
            semanas_selecionadas: semanas,
            semana_inicio: null,
            semana_fim: null,
            franqueado_nome: isAreaFranqueado ? fnAlvo : null,
            adm_cnpj_id: isAreaAdm ? admCnpjSelecionado : null,
            controladoria_cnpj_id: null,
            comercial_candidato_id: comercialCandidatoIdSalvar,
            portfolio_franqueado_id: isAreaPortfolio ? (portfolioFranqueadoId ?? null) : null,
            objetivo_id: addObjetivoId,
            ...(isAreaCasa ? { casa_id: casaIdParaSalvar } : {}),
            ...payloadJuridico
          })
          .eq('id', existenteNoPeriodo.id)
        err = resUp.error
      } else {
        const payload = {
          acao_id: addAcaoId,
          responsavel: responsavelStr,
          semanas_selecionadas: semanas,
          semana_inicio: null,
          semana_fim: null,
          franqueado_nome: isAreaFranqueado ? fnAlvo : null,
          adm_cnpj_id: isAreaAdm ? admCnpjSelecionado : null,
          controladoria_cnpj_id: null,
          comercial_candidato_id: comercialCandidatoIdSalvar,
          portfolio_franqueado_id: isAreaPortfolio ? (portfolioFranqueadoId ?? null) : null,
          objetivo_id: addObjetivoId,
          casa_id: isAreaCasa ? casaIdParaSalvar : null,
          periodo_id: periodoId,
          ...payloadJuridico
        }
        const ins = await supabase.from('gantt_planejamento').insert(payload)
        err = ins.error
      }

      const msg = (err?.message || '').toLowerCase()
      const needsSemanasFallback = msg.includes('semanas_selecionadas')
      const tinhaExistente =
        existenteNoPeriodo?.id ||
        (isAreaControladoria &&
          planejamentoNaArea.some(
            p =>
              p.acao_id === addAcaoId &&
              String(p.controladoria_cnpj_id ?? '') === String(controladoriaCnpjSelecionado ?? '')
          )) ||
        (isAreaPortfolio &&
          planejamentoNaArea.some(
            p =>
              p.acao_id === addAcaoId &&
              String(p.portfolio_franqueado_id ?? '') === String(portfolioFranqueadoId ?? '')
          ))
      if (err && needsSemanasFallback && !tinhaExistente) {
        setError('Seu banco está sem a coluna `semanas_selecionadas` em gantt_planejamento. Execute o SQL de migração exibido no erro e recarregue.')
        setSalvandoAdd(false)
        return
      }

      if (err) {
        console.error('[gantt] erro ao salvar planejamento:', err)
        // Não mostrar banner para erro de schema legacy (periodo_id ausente).
        if (!String(err.message || '').toLowerCase().includes('periodo_id')) {
          setError(err.message)
        }
        setSalvandoAdd(false)
        return
      }

      void registrarLog({
        modulo: 'Planejamento',
        area: areas.find((a) => a.id === areaId)?.nome ?? null,
        entidade: 'gantt_planejamento',
        entidade_id: existenteNoPeriodo?.id ?? null,
        operacao: existenteNoPeriodo?.id ? 'UPDATE' : 'INSERT',
        valor_novo: {
          acao_id: addAcaoId,
          responsavel: responsavelStr,
          semanas_selecionadas: semanas,
          franqueado_nome: isAreaFranqueado ? fnAlvo : null,
          comercial_candidato_id: comercialCandidatoIdSalvar,
          casa_id: isAreaCasa ? casaIdParaSalvar : null,
          adm_cnpj_id: isAreaAdm ? admCnpjSelecionado : null,
          controladoria_cnpj_id: isAreaControladoria ? (controladoriaCnpjSelecionado ?? null) : null,
          portfolio_franqueado_id: isAreaPortfolio ? (portfolioFranqueadoId ?? null) : null
        },
        descricao: `Salvou planejamento Gantt (ação ${addAcaoId})`
      })

      const tarefaDaAcao = acaoPorId[addAcaoId]?.tarefa
      if (tarefaDaAcao?.id && addObjetivoId) {
        const atual = tarefaDaAcao.objetivo_id
        const semMeta =
          atual == null || String(atual).trim() === ''
        // Só alinha meta na tarefa se ela ainda não tem nenhuma — nunca sobrescreve
        const precisaAlinharMeta = semMeta
        if (precisaAlinharMeta) {
          const { error: errTar } = await supabase
            .from('tarefas')
            .update({ objetivo_id: addObjetivoId })
            .eq('id', tarefaDaAcao.id)
          if (errTar && !errTar.message?.includes('objetivo_id') && !errTar.message?.includes('schema cache')) {
            setError(errTar.message)
            setSalvandoAdd(false)
            await Promise.all([carregarPlanejamento(), carregarCronograma()])
            return
          }
          if (!errTar) {
            void registrarLog({
              modulo: 'Planejamento',
              area: areas.find((a) => a.id === areaId)?.nome ?? null,
              entidade: 'tarefa',
              entidade_id: tarefaDaAcao.id,
              operacao: 'UPDATE',
              valor_anterior: { objetivo_id: atual },
              valor_novo: { objetivo_id: addObjetivoId },
              descricao: 'Alinhou meta da tarefa ao salvar planejamento'
            })
          }
        }
      }
    }

    setAddAcaoIds([])
    setAddObjetivoId('')
    setAddResponsavelPessoaIds([])
    setAddSemanasSelecionadas([])
    setShowAddAtividade(false)
    setAddDrawerEditando(false)
    setAddPlanejamentoEdicaoId(null)
    resetAcoplamentoModalAux()
    resetPortfolioModalAux()
    resetComercialModalAux()
    setCasaSelecionada(null)
    resetModalCasaAux()
    resetJuridicoModalAux()
    resetAdmCnpjModalAux()
    resetControladoriaCnpjModalAux()
    setSalvandoAdd(false)
    await carregarTarefas()
    await Promise.all([carregarPlanejamento(), carregarCronograma()])
  }

  function toggleSemanaAdd(s) {
    setAddSemanasSelecionadas(prev => prev.includes(s) ? prev.filter(n => n !== s) : [...prev, s].sort((a, b) => a - b))
  }

  function toggleAcaoAdd(id) {
    setAddAcaoIds(prev =>
      (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    )
  }

  function resetModalCasaAux() {
    setCriandoCasa(false)
    setNovaCasaNome('')
    setEditandoCasa(null)
    setNomeCasaEdit('')
    setErroCasa('')
    setDropdownCasaAberto(false)
  }

  const btnIcon = {
    border: '0.5px solid #e0d9ce',
    borderRadius: 4,
    background: '#fff',
    color: '#5f5e5a',
    fontSize: 12,
    width: 22,
    height: 22,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
  }
  const btnSalvar = {
    ...btnIcon,
    background: '#e8f0e4',
    borderColor: '#b8d4b0',
    color: '#2d4a28'
  }
  const btnCancelar = {
    ...btnIcon,
    fontSize: 14
  }

  async function criarNovaCasaInline() {
    const nome = String(novaCasaNome || '').trim()
    if (!nome || !areaId) return
    setErroCasa('')
    const { data, error } = await supabase
      .from('casas')
      .insert({ nome, area_id: areaId })
      .select('id, nome')
      .single()
    if (error) { console.error(error); return }
    setCasas(prev => [...prev, data])
    setNovaCasaNome('')
    setCriandoCasa(false)
  }

  function iniciarEdicaoCasaInline(casa) {
    if (!casa) return
    setErroCasa('')
    setEditandoCasa(casa)
    setNomeCasaEdit(casa.nome || '')
  }

  async function removerCasaGlobalInline(casa) {
    if (!casa?.id) return
    setErroCasa('')

    const registrosPlano = (planejamento || []).filter(p => String(p?.casa_id ?? '') === String(casa.id))
    const idsPlano = registrosPlano.map(p => p?.id).filter(Boolean)

    if (idsPlano.length > 0) {
      const { data: cronogramaVinculado, error: errCron } = await supabase
        .from('cronograma')
        .select('id')
        .in('planejamento_id', idsPlano)
        .eq('status', 'concluido')
        .limit(1)
      if (!errCron && cronogramaVinculado?.length > 0) {
        alert(`A casa "${casa.nome}" possui atividades realizadas e não pode ser removida. Inative-a ou renomeie-a.`)
        return
      }
    }

    if (!window.confirm(`Remover a casa "${casa.nome}"? Essa ação não pode ser desfeita.`)) return

    const { error } = await supabase
      .from('casas')
      .delete()
      .eq('id', casa.id)
    if (error) { console.error(error); return }

    setCasas(prev => prev.filter(c => String(c.id) !== String(casa.id)))
    setCasasSelecionadas(prev => prev.filter(id => String(id) !== String(casa.id)))
    if (String(casaSelecionada || '') === String(casa.id)) setCasaSelecionada(null)
    if (editandoCasa?.id && String(editandoCasa.id) === String(casa.id)) {
      setEditandoCasa(null)
      setNomeCasaEdit('')
    }
  }

  async function handleSalvarEdicaoCasa() {
    if (!nomeCasaEdit.trim() || !editandoCasa) return
    setErroCasa('')
    const { error } = await supabase
      .from('casas')
      .update({ nome: nomeCasaEdit.trim() })
      .eq('id', editandoCasa.id)
    if (!error) {
      void registrarLog({
        modulo: 'Planejamento',
        area: areas.find((a) => a.id === areaId)?.nome ?? null,
        entidade: 'casas',
        entidade_id: editandoCasa.id,
        operacao: 'UPDATE',
        valor_anterior: { nome: editandoCasa.nome },
        valor_novo: { nome: nomeCasaEdit.trim() },
        descricao: `Alterou casa "${nomeCasaEdit.trim()}"`
      })
      setCasas(prev =>
        prev.map(c => (c.id === editandoCasa.id ? { ...c, nome: nomeCasaEdit.trim() } : c))
      )
      setEditandoCasa(null)
      setNomeCasaEdit('')
      setErroCasa('')
    }
  }

  async function handleRemoverCasa(casaId) {
    setErroCasa('')
    const prevCasa = casas.find((c) => c.id === casaId)
    if (prevCasa) {
      await removerCasaGlobalInline(prevCasa)
      return
    }
    const { error } = await supabase.from('casas').delete().eq('id', casaId)
    if (!error) {
      void registrarLog({
        modulo: 'Planejamento',
        area: areas.find((a) => a.id === areaId)?.nome ?? null,
        entidade: 'casas',
        entidade_id: casaId,
        operacao: 'DELETE',
        valor_anterior: prevCasa || null,
        descricao: prevCasa ? `Excluiu casa "${prevCasa.nome}"` : `Excluiu casa ${casaId}`
      })
      setCasas(prev => prev.filter(c => c.id !== casaId))
      if (String(casaSelecionada || '') === String(casaId)) setCasaSelecionada(null)
      setErroCasa('')
      setEditandoCasa(null)
      setNomeCasaEdit('')
    }
  }

  async function handleAdicionarIdentificacao() {
    const nome = novaIdentificacaoNome.trim()
    if (!nome) return
    const { data, error } = await supabase
      .from('juridico_identificacoes')
      .insert({ nome, tipo: juridicoTipo, oculto: false })
      .select()
      .single()
    if (error) {
      setError(error.message)
      return
    }
    if (data) {
      setJuridicoIdentificacoes(prev =>
        [...prev, data].sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
      )
      setNovaIdentificacaoNome('')
    }
  }

  async function handleOcultarIdentificacao(id) {
    const { error } = await supabase.from('juridico_identificacoes').update({ oculto: true }).eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    setJuridicoIdentificacoes(prev => prev.map(i => (String(i.id) === String(id) ? { ...i, oculto: true } : i)))
    if (String(juridicoIdentificacaoId) === String(id)) {
      setJuridicoIdentificacaoId(null)
      setIdDropdownAberto(true)
    }
  }

  async function handleMostrarIdentificacao(id) {
    const { error } = await supabase.from('juridico_identificacoes').update({ oculto: false }).eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    setJuridicoIdentificacoes(prev => prev.map(i => (String(i.id) === String(id) ? { ...i, oculto: false } : i)))
  }

  async function handleAdicionarFranqueado() {
    const nome = String(novoFranqueadoNome || '').trim()
    if (!nome || !tabelaFranqueadosAtiva) return
    const jaExiste = franqueadosAtivos.some(
      f => String(f.nome || '').trim().toLowerCase() === nome.toLowerCase()
    )
    if (jaExiste) return
    const { data, error } = await supabase
      .from(tabelaFranqueadosAtiva)
      .insert({ nome, oculto: false })
      .select()
      .single()
    if (error) {
      setError(error.message)
      return
    }
    if (data) {
      setFranqueadosAtivos(prev =>
        [...prev, data].sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
      )
      setNovoFranqueadoNome('')
    }
  }

  async function handleOcultarFranqueado(id) {
    if (!tabelaFranqueadosAtiva) return
    const { error } = await supabase.from(tabelaFranqueadosAtiva).update({ oculto: true }).eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    setFranqueadosAtivos(prev => prev.map(f => (String(f.id) === String(id) ? { ...f, oculto: true } : f)))
    if (String(acoplamentoFranqueadoId) === String(id)) {
      setAcoplamentoFranqueadoId(null)
      setAcoplamentoDropdownAberto(true)
    }
  }

  async function handleMostrarFranqueado(id) {
    if (!tabelaFranqueadosAtiva) return
    const { error } = await supabase.from(tabelaFranqueadosAtiva).update({ oculto: false }).eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    setFranqueadosAtivos(prev => prev.map(f => (String(f.id) === String(id) ? { ...f, oculto: false } : f)))
  }

  async function handleAdicionarPortfolioFranqueado() {
    const nome = String(novoPortfolioFranqueado || '').trim()
    if (!nome) return
    const jaExiste = portfolioFranqueados.some(
      f => String(f.nome || '').trim().toLowerCase() === nome.toLowerCase()
    )
    if (jaExiste) return
    const { data, error } = await supabase
      .from('portfolio_franqueados')
      .insert({ nome, oculto: false })
      .select()
      .single()
    if (error) {
      setError(error.message)
      return
    }
    if (data) {
      setPortfolioFranqueados(prev =>
        [...prev, data].sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
      )
      setNovoPortfolioFranqueado('')
    }
  }

  async function handleOcultarPortfolioFranqueado(id) {
    const { error } = await supabase.from('portfolio_franqueados').update({ oculto: true }).eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    setPortfolioFranqueados(prev => prev.map(f => (String(f.id) === String(id) ? { ...f, oculto: true } : f)))
    if (String(portfolioFranqueadoId) === String(id)) {
      setPortfolioFranqueadoId(null)
      setPortfolioDropdownAberto(true)
    }
  }

  async function handleMostrarPortfolioFranqueado(id) {
    const { error } = await supabase.from('portfolio_franqueados').update({ oculto: false }).eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    setPortfolioFranqueados(prev => prev.map(f => (String(f.id) === String(id) ? { ...f, oculto: false } : f)))
  }

  async function handleAdicionarCandidato() {
    const nome = novoCandidatoNome.trim()
    if (!nome) return
    const jaExiste = comercialCandidatos.some(
      c => String(c.nome || '').trim().toLowerCase() === nome.toLowerCase()
    )
    if (jaExiste) return
    const { data, error } = await supabase
      .from('comercial_candidatos')
      .insert({ nome, oculto: false })
      .select()
      .single()
    if (error) {
      setError(error.message)
      return
    }
    if (data) {
      setComercialCandidatos(prev =>
        [...prev, data].sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
      )
      setNovoCandidatoNome('')
    }
  }

  async function handleOcultarCandidato(id) {
    const { error } = await supabase.from('comercial_candidatos').update({ oculto: true }).eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    setComercialCandidatos(prev => prev.map(c => (String(c.id) === String(id) ? { ...c, oculto: true } : c)))
    if (String(comercialCandidatoId) === String(id)) {
      setComercialCandidatoId(null)
      setComercialDropdownAberto(true)
    }
  }

  async function handleMostrarCandidato(id) {
    const { error } = await supabase.from('comercial_candidatos').update({ oculto: false }).eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    setComercialCandidatos(prev => prev.map(c => (String(c.id) === String(id) ? { ...c, oculto: false } : c)))
  }

  const resetAdmCnpjModalAux = useCallback(() => {
    setAdmCnpjSelecionado(null)
    setCnpjDropdownAberto(true)
    setCriandoCnpj(false)
    setNovoCnpj('')
    setNovoDescritivo('')
  }, [])

  const resetControladoriaCnpjModalAux = useCallback(() => {
    setControladoriaCnpjSelecionado(null)
    setControladoriaCnpjDropdownAberto(true)
    setControladoriaCriandoCnpj(false)
    setControladoriaNovoCnpj('')
    setControladoriaNovoDescritivo('')
  }, [])

  async function handleSalvarCnpj() {
    if (!novoCnpj.trim() || !novoDescritivo.trim()) return
    if (admCnpjsTabelaAusente) {
      setError('A tabela adm_cnpjs não existe no banco. Execute o SQL do aviso amarelo acima e recarregue a página (F5).')
      return
    }
    const { data, error } = await supabase
      .from('adm_cnpjs')
      .insert({ cnpj: novoCnpj.trim(), descritivo: novoDescritivo.trim() })
      .select('id, cnpj, descritivo')
      .single()
    if (error) {
      if (erroIndicaTabelaAdmCnpjsAusente(error)) {
        setAdmCnpjsTabelaAusente(true)
        setError('A tabela adm_cnpjs não existe no banco. Copie o SQL do aviso amarelo acima, execute no Supabase (SQL Editor) e recarregue a página (F5).')
      } else {
        setError(error.message)
      }
      return
    }
    if (data) {
      setAdmCnpjs(prev => [...prev, data])
      setAdmCnpjSelecionado(data.id)
      setCnpjDropdownAberto(false)
      setCriandoCnpj(false)
      setNovoCnpj('')
      setNovoDescritivo('')
    }
  }

  async function handleSalvarControladoriaCnpj() {
    if (!controladoriaNovoCnpj.trim() || !controladoriaNovoDescritivo.trim()) return
    const { data, error } = await supabase
      .from('controladoria_cnpjs')
      .insert({ cnpj: controladoriaNovoCnpj.trim(), descritivo: controladoriaNovoDescritivo.trim() })
      .select('id, cnpj, descritivo')
      .single()
    if (error) {
      setError(error.message)
      return
    }
    if (data) {
      setControladoriaCnpjs(prev => [...prev, data])
      setControladoriaCnpjSelecionado(data.id)
      setControladoriaCnpjDropdownAberto(false)
      setControladoriaCriandoCnpj(false)
      setControladoriaNovoCnpj('')
      setControladoriaNovoDescritivo('')
    }
  }

  function abrirAddDrawer() {
    setAddDrawerEditando(false)
    setShowAddAtividade(true)
    setError(null)
    setAddPlanejamentoEdicaoId(null)
    resetAcoplamentoModalAux()
    resetComercialModalAux()
    resetAdmCnpjModalAux()
    resetControladoriaCnpjModalAux()
    const firstMeta = metasObjetivos[0]?.id || ''
    if (!addObjetivoId && firstMeta) setAddObjetivoId(firstMeta)
    setAddAcaoIds([])
    setAddResponsavelPessoaIds([])
    // Seleciona o primeiro comportamento com ações disponíveis
    const firstTarefa = (atividadesDisponiveis || []).find(a => a?.tarefaId)?.tarefaId || ''
    setAddTarefaId(firstTarefa)
    setAddSemanasSelecionadas([])
    setCasaSelecionada(null)
    setCasasSelecionadas([])
    resetModalCasaAux()
    resetJuridicoModalAux()
  }

  /** Abre o mesmo drawer de planejamento com meta, comportamento, semanas e responsáveis da linha. */
  const abrirDrawerEditarPlanejamento = useCallback((l, registroEspecifico = null) => {
    if (!l || l.tipo !== 'acao' || !l.acaoId) return
    setAddDrawerEditando(true)
    setShowAddAtividade(true)
    setError(null)
    const oid = l.objetivoId && l.objetivoId !== '_sem'
      ? metaIdCanonica(metasObjetivos, l.objetivoId)
      : (metasObjetivos[0]?.id || '')
    setAddObjetivoId(oid || '')
    setAddTarefaId(l.comportamentoId ? String(l.comportamentoId) : '')
    setAddAcaoIds([l.acaoId])
    const rows = l.planejamentoRows || []
    const regAlvo = registroEspecifico || rows[0]
    if (regAlvo?.id) setAddPlanejamentoEdicaoId(regAlvo.id)
    else setAddPlanejamentoEdicaoId(l.planejamentoId || null)
    const semExpandido = regAlvo
      ? expandGanttSemanasParaGradeIso(regAlvo, semanasModalAdicionar)
      : []
    const sem =
      semExpandido.length > 0
        ? [...semExpandido].sort((a, b) => a - b)
        : (Array.isArray(l.semanasSelecionadas) ? [...l.semanasSelecionadas] : []).sort((a, b) => a - b)
    setAddSemanasSelecionadas(sem)
    const respStr = regAlvo?.responsavel != null && String(regAlvo.responsavel).trim() !== ''
      ? regAlvo.responsavel
      : l.responsavel
    setAddResponsavelPessoaIds(responsavelStrParaIds(respStr, areaPessoasLista))
    if (isAreaFranqueado) {
      const nomeSalvo = normalizeFranqueadoNome(regAlvo?.franqueado_nome)
      const found = (franqueadosAtivos || []).find(
        f => normalizeFranqueadoNome(f.nome) === nomeSalvo
      )
      const idSel = found?.id != null ? String(found.id) : null
      setAcoplamentoFranqueadoId(idSel)
      setAcoplamentoDropdownAberto(!idSel)
      setAcoplamentoOcultosAbertos(false)
      setNovoFranqueadoNome('')
    } else {
      resetAcoplamentoModalAux()
    }
    if (isAreaPortfolio) {
      const idSel =
        regAlvo?.portfolio_franqueado_id != null && regAlvo?.portfolio_franqueado_id !== ''
          ? String(regAlvo.portfolio_franqueado_id)
          : null
      setPortfolioFranqueadoId(idSel)
      setPortfolioDropdownAberto(!idSel)
      setPortfolioOcultosAbertos(false)
      setNovoPortfolioFranqueado('')
    } else {
      resetPortfolioModalAux()
    }
    if (isAreaComercial) {
      const idSel =
        regAlvo?.comercial_candidato_id != null && regAlvo?.comercial_candidato_id !== ''
          ? String(regAlvo.comercial_candidato_id)
          : null
      setComercialCandidatoId(idSel)
      setComercialDropdownAberto(!idSel)
      setComercialOcultosAbertos(false)
      setNovoCandidatoNome('')
    } else {
      resetComercialModalAux()
    }
    const admIdSel =
      regAlvo?.adm_cnpj_id != null && regAlvo?.adm_cnpj_id !== '' ? String(regAlvo.adm_cnpj_id) : null
    setAdmCnpjSelecionado(admIdSel)
    setCnpjDropdownAberto(!admIdSel)
    setCriandoCnpj(false)
    setNovoCnpj('')
    setNovoDescritivo('')
    const controladoriaIdSel =
      regAlvo?.controladoria_cnpj_id != null && regAlvo?.controladoria_cnpj_id !== ''
        ? String(regAlvo.controladoria_cnpj_id)
        : null
    setControladoriaCnpjSelecionado(controladoriaIdSel)
    setControladoriaCnpjDropdownAberto(!controladoriaIdSel)
    setControladoriaCriandoCnpj(false)
    setControladoriaNovoCnpj('')
    setControladoriaNovoDescritivo('')
    setCasaSelecionada(regAlvo?.casa_id != null && regAlvo?.casa_id !== '' ? String(regAlvo.casa_id) : null)
    if (isAreaCasa && periodoId && l?.acaoId) {
      const acaoId = l.acaoId
      const casasJaNoPlano = planejamento
          .filter(p => p.acao_id === acaoId)
        .map(p => p.casa_id)
        .filter(Boolean)
        .map(x => String(x))
        setCasasSelecionadas([...new Set(casasJaNoPlano)])
    } else {
      setCasasSelecionadas([])
    }
    if (isAreaJuridico && regAlvo) {
      setJuridicoTipo(regAlvo.juridico_tipo || 'franqueado')
      const idSel =
        regAlvo.juridico_identificacao_id != null && regAlvo.juridico_identificacao_id !== ''
          ? String(regAlvo.juridico_identificacao_id)
          : null
      setJuridicoIdentificacaoId(idSel)
      setIdDropdownAberto(!idSel)
    } else {
      resetJuridicoModalAux()
    }
    resetModalCasaAux()
  }, [
    metasObjetivos,
    areaPessoasLista,
    semanasModalAdicionar,
    periodo,
    isAreaFranqueado,
    franqueadosAtivos,
    isAreaPortfolio,
    portfolioFranqueados,
    isAreaComercial,
    isAreaCasa,
    isAreaJuridico,
    planejamento,
    periodoId,
    resetJuridicoModalAux,
    resetAcoplamentoModalAux,
    resetPortfolioModalAux,
    resetComercialModalAux
  ])

  function fecharAddDrawer() {
    if (salvandoAdd) return
    setShowAddAtividade(false)
    setAddDrawerEditando(false)
    setAddObjetivoId('')
    setAddAcaoIds([])
    setAddResponsavelPessoaIds([])
    setAddTarefaId('')
    setAddSemanasSelecionadas([])
    setAddPlanejamentoEdicaoId(null)
    resetAcoplamentoModalAux()
    resetPortfolioModalAux()
    resetComercialModalAux()
    resetAdmCnpjModalAux()
    resetControladoriaCnpjModalAux()
    setCasaSelecionada(null)
    setCasasSelecionadas([])
    setDropdownCasaAberto(false)
    resetModalCasaAux()
    resetJuridicoModalAux()
  }

  function adicionarCasa(id) {
    const sid = String(id || '').trim()
    if (!sid) return
    setCasasSelecionadas(prev => (prev.includes(sid) ? prev : [...prev, sid]))
  }

  function removerCasa(id) {
    const sid = String(id || '').trim()
    if (!sid) return
    setCasasSelecionadas(prev => prev.filter(c => c !== sid))
  }

  async function removerAtividade(ids, opts = {}) {
    const list = (Array.isArray(ids) ? ids : [ids]).filter(Boolean).map(x => String(x))
    if (list.length === 0) return
    setRemovendoId(list[0])
    setError(null)
    try {
      if (opts.origemCronogramaLegado) {
        const { error: err } = await supabase.from('cronograma').delete().in('id', list)
        if (err) {
          setError(err.message)
          setRemovendoId(null)
          return
        }
        void registrarLog({
          modulo: 'Planejamento',
          area: areas.find((a) => a.id === areaId)?.nome ?? null,
          entidade: 'cronograma',
          entidade_id: list.join(','),
          operacao: 'DELETE',
          valor_anterior: { ids: list, legado: true },
          descricao: `Removeu ${list.length} lançamento(s) de cronograma (legado, sem gantt_planejamento)`
        })
        setRemovendoId(null)
        await carregarCronograma()
        await carregarPlanejamento()
        return
      }

      const { error: errCron } = await supabase.from('cronograma').delete().in('planejamento_id', list)
      if (errCron && process.env.NODE_ENV === 'development') {
        console.warn('[removerAtividade] delete cronograma por planejamento_id:', errCron.message)
      }

      const { error: err } = await supabase.from('gantt_planejamento').delete().in('id', list)
      if (err) {
        setError(err.message)
        setRemovendoId(null)
        return
      }
      void registrarLog({
        modulo: 'Planejamento',
        area: areas.find((a) => a.id === areaId)?.nome ?? null,
        entidade: 'gantt_planejamento',
        entidade_id: list.join(','),
        operacao: 'DELETE',
        valor_anterior: { ids: list },
        descricao: `Removeu ${list.length} registro(s) de planejamento do Gantt`
      })
      setRemovendoId(null)
      await carregarPlanejamento()
      await carregarCronograma()
    } catch (e) {
      setError(String(e?.message ?? e))
      setRemovendoId(null)
    }
  }

  const solicitarRemocaoAtividade = useCallback(
    l => {
      const ids = l.planejamentoIds?.length ? l.planejamentoIds : [l.planejamentoId]
      const lista = (Array.isArray(ids) ? ids : [ids]).filter(Boolean).map(x => String(x))
      if (lista.length === 0) return
      const nome = String(l.nome || '').trim() || 'esta atividade'
      const temHistorico = linhaTemHistoricoPreenchido(l, cronograma)
      const temPreenchimentoCronograma = temHistorico

      if (!isAdmin && temHistorico) {
        setModalExclusao({
          tipo: 'bloqueado',
          mensagem:
            'Não é possível excluir esta atividade porque há histórico registrado (valores, horas ou semanas). Entre em contato com um administrador.'
        })
        return
      }

      if (isAdmin) {
        const temDadosNoBanco =
          Boolean(l.origemCronogramaLegado) || temPreenchimentoCronograma
        const blocoDados = temDadosNoBanco
          ? 'Há dados gravados no banco (lançamentos no cronograma: horas e/ou status). Essas informações serão perdidas.'
          : 'Não há lançamentos no cronograma para esta linha; será removido apenas o registro de planejamento (semanas / vínculo ao período).'
        const mensagemAdmin =
          `${blocoDados}\n\n` +
          `Ao confirmar, a atividade "${nome}" deixa de constar neste planejamento e as alterações são irreversíveis.\n\n` +
          'Deseja continuar?'
        setModalExclusao({
          tipo: 'confirmar',
          planejamentoIds: lista,
          nomeAtividade: nome,
          origemCronogramaLegado: Boolean(l.origemCronogramaLegado),
          mensagemAdmin
        })
        return
      }

      setModalExclusao({
        tipo: 'confirmar',
        planejamentoIds: lista,
        nomeAtividade: nome,
        origemCronogramaLegado: Boolean(l.origemCronogramaLegado)
      })
      return
    },
    [cronograma, isAdmin, removerAtividade],
  )

  async function salvarLancamento(indicadorId, semanaIso, valorRaw) {
    if (!periodoId) return false
    if (!periodo?.data_inicio || !periodo?.data_fim) return false
    const trimmed = String(valorRaw ?? '').trim()
    const semanaIsoNum = Number(String(semanaIso).trim().replace(',', '.'))
    if (!Number.isFinite(semanaIsoNum)) return false
    /** Posição relativa ao período de gravação (`periodo_id`), não à lista de colunas “curta” se divergir. */
    const posicaoRelativa = semanaIsoParaPosicaoNoPeriodoGravacao(
      semanaIsoNum,
      periodo.data_inicio,
      periodo.data_fim
    )
    if (posicaoRelativa == null || posicaoRelativa <= 0) return false
    const semanaKey = semanaIsoNum
    const bucketPrev = lancamentosPorIndicador[indicadorId] || {}
    const prev = bucketPrev[semanaKey] ?? bucketPrev[semanaIso]

    const patchLocal = (id, val) => {
      setLancamentosPorIndicador(st => {
        const next = { ...st }
        const inner = { ...(next[indicadorId] || {}) }
        if (!trimmed) {
          delete inner[semanaKey]
          if (semanaKey !== semanaIso) delete inner[semanaIso]
        } else {
          inner[semanaKey] = { id: id ?? prev?.id, valor: val }
        }
        next[indicadorId] = inner
        return next
      })
    }

    const falha = (msg) => {
      setIndicadorFeedback({ type: 'error', message: msg })
      return false
    }

    const aposSalvarSucesso = async () => {
      lancamentosRawCacheRef.current = { key: '', rows: [] }
      await carregarLancamentosIndicadores()
    }

    if (!trimmed) {
      if (prev?.id) {
        const { error } = await supabase.from('indicador_lancamentos').delete().eq('id', prev.id)
        if (error) return falha(error.message)
        void registrarLog({
          modulo: 'Indicadores',
          area: areas.find((a) => a.id === areaId)?.nome ?? null,
          entidade: 'resultados_indicadores',
          entidade_id: prev.id,
          operacao: 'DELETE',
          valor_anterior: prev,
          descricao: `Removeu lançamento de indicador (semana ${semanaIso})`
        })
      }
      patchLocal(null, '')
      await aposSalvarSucesso()
      return true
    }

    if (prev?.id) {
      const { error } = await supabase
        .from('indicador_lancamentos')
        .update({ valor: trimmed, periodo_id: periodoId, semana: posicaoRelativa, semana_ano: semanaIsoNum })
        .eq('id', prev.id)
      if (!error) {
        void registrarLog({
          modulo: 'Indicadores',
          area: areas.find((a) => a.id === areaId)?.nome ?? null,
          entidade: 'resultados_indicadores',
          entidade_id: prev.id,
          operacao: 'UPDATE',
          valor_anterior: { valor: prev.valor },
          valor_novo: { valor: trimmed },
          descricao: `Atualizou lançamento de indicador (semana ${semanaIso})`
        })
        patchLocal(prev.id, trimmed)
        await aposSalvarSucesso()
        return true
      }
      return falha(error.message)
    }

    let ins = await supabase
      .from('indicador_lancamentos')
      .insert({ indicador_id: indicadorId, valor: trimmed, periodo_id: periodoId, semana: posicaoRelativa, semana_ano: semanaIsoNum })
      .select('id')
      .single()
    if (!ins.error && ins.data?.id) {
      void registrarLog({
        modulo: 'Indicadores',
        area: areas.find((a) => a.id === areaId)?.nome ?? null,
        entidade: 'resultados_indicadores',
        entidade_id: ins.data.id,
        operacao: 'INSERT',
        valor_novo: { indicador_id: indicadorId, valor: trimmed, periodo_id: periodoId, semana: posicaoRelativa },
        descricao: `Inseriu lançamento de indicador (semana ${semanaIso})`
      })
      patchLocal(ins.data.id, trimmed)
      await aposSalvarSucesso()
      return true
    }

    if (ins.error && erroEhChaveDuplicadaIndicador(ins.error)) {
      const { data: existente } = await supabase
        .from('indicador_lancamentos')
        .select('id')
        .eq('indicador_id', indicadorId)
        .eq('periodo_id', periodoId)
        .eq('semana', posicaoRelativa)
        .maybeSingle()
      if (existente?.id) {
        let { error: errUp } = await supabase
          .from('indicador_lancamentos')
          .update({ valor: trimmed, periodo_id: periodoId, semana: posicaoRelativa, semana_ano: semanaIsoNum })
          .eq('id', existente.id)
        if (!errUp) {
          void registrarLog({
            modulo: 'Indicadores',
            area: areas.find((a) => a.id === areaId)?.nome ?? null,
            entidade: 'resultados_indicadores',
            entidade_id: existente.id,
            operacao: 'UPDATE',
            valor_novo: { valor: trimmed },
            descricao: `Atualizou lançamento duplicado de indicador (semana ${semanaIso})`
          })
          patchLocal(existente.id, trimmed)
          await aposSalvarSucesso()
          return true
        }
        return falha(errUp.message)
      }
    }

    if (ins.error) return falha(ins.error.message)
    return false
  }

  function fecharMetaDrawer() {
    setMetaModalAberto(false)
    setMetaParaEditar(null)
  }

  function abrirExcluirMetaDrawer(meta) {
    if (!meta?.id) return
    if (!isAdmin && metaTemAtividadesNoPlano[meta.id]) return
    setMetaModalAberto(false)
    setMetaParaEditar(null)
    setMetaParaExcluir(meta)
    setExcluirMetaDrawerAberto(true)
  }

  function fecharExcluirMetaDrawer() {
    if (metaExcluindoId) return
    setExcluirMetaDrawerAberto(false)
    setMetaParaExcluir(null)
  }

  function abrirMetaModalGantt() {
    if (!isAdmin) return
    if (!areaId) {
      setError('Selecione uma área antes de definir metas.')
      return
    }
    setError(null)
    setMetaParaEditar(null)
    setMetaModalAberto(true)
  }

  function abrirMetaModalEditar(meta) {
    if (!isAdmin || !meta?.id) return
    setMetaParaEditar(meta)
    setMetaModalAberto(true)
  }

  function abrirModalConclusao(meta) {
    if (!meta?.id) return
    setIndicadorParaConcluir(null)
    setMetaParaConcluir(meta)
    setComentarioConclusaoMeta('')
    setConcluirMetaModalAberto(true)
  }

  const abrirModalConclusaoIndicador = useCallback((ind) => {
    if (!ind?.id) return
    if (String(ind.meta_ciclo_tipo || '').toLowerCase() !== 'atingivel') return
    setMetaParaConcluir(null)
    setIndicadorParaConcluir(ind)
    setComentarioConclusaoMeta('')
    setConcluirMetaModalAberto(true)
  }, [])

  function fecharModalConclusaoMeta() {
    if (concluindoMetaId) return
    setConcluirMetaModalAberto(false)
    setMetaParaConcluir(null)
    setIndicadorParaConcluir(null)
    setComentarioConclusaoMeta('')
  }

  async function confirmarConclusaoMeta() {
    const comentario = String(comentarioConclusaoMeta ?? '').trim()

    if (indicadorParaConcluir?.id) {
      const indicadorId = indicadorParaConcluir.id
      setConcluindoMetaId(indicadorId)
      setError(null)
      const resInd = await concluirIndicadorAtingivel(supabase, indicadorParaConcluir, areaId, {
        comentario
      })
      if (!resInd.ok) {
        setConcluindoMetaId(null)
        const msgInd = String(resInd.message || '')
        const kind = resInd.errorKind || classificarErroSupabase(resInd.raw || msgInd)

        if (kind === 'permission') {
          const diag = await diagnosticarAcessoIndicadorConquistas(supabase)
          if (diag === 'permission') {
            logSqlGrantIndicadorConquistas()
            setIndicadorFeedback({ type: 'error', message: TOAST_ERRO_PERMISSAO_INDICADOR_CONQUISTAS })
          } else {
            setIndicadorFeedback({ type: 'error', message: msgInd })
          }
          return
        }

        setError(msgInd)
        return
      }
      void registrarLog({
        modulo: 'Planejamento',
        area: areas.find((a) => a.id === areaId)?.nome ?? null,
        entidade: 'indicador_conquistas',
        entidade_id: indicadorId,
        operacao: 'INSERT',
        valor_novo: { indicador_id: indicadorId },
        descricao: `Concluiu indicador atingível "${indicadorParaConcluir.nome || indicadorId}"`
      })
      lancamentosRawCacheRef.current = { key: '', rows: [] }
      setConcluindoMetaId(null)
      setIndicadoresPorObjetivo(prev => {
        const next = { ...(prev || {}) }
        for (const k of Object.keys(next)) {
          next[k] = (next[k] || []).map(ind => {
            if (String(ind?.id) !== String(indicadorId)) return ind
            return { ...ind, status: 'concluido', concluido: true }
          })
        }
        return next
      })
      setConcluirMetaModalAberto(false)
      setIndicadorParaConcluir(null)
      setComentarioConclusaoMeta('')
      setIndicadorFeedback({
        type: 'success',
        message: 'Indicador concluído. Registro disponível em Conquistas.'
      })
      await carregarIndicadoresLista()
      await carregarLancamentosIndicadores()
      return
    }

    if (!metaParaConcluir?.id) return
    const objetivoId = metaParaConcluir.id
    setConcluindoMetaId(objetivoId)
    setError(null)

    /** Coluna `status` obrigatória; `comentario_conclusao` e `concluido_em` após ciclo de vida em `objetivos`. */
    const { error } = await supabase
      .from('objetivos')
      .update({
        status: 'concluido',
        concluido_em: semanaAtual ?? null,
        comentario_conclusao: comentario
      })
      .eq('id', objetivoId)

    if (error) {
      console.error('[Gantt confirmarConclusaoMeta]', error)
      setConcluindoMetaId(null)
      if (erroIndicaColunaObjetivosStatus(error)) {
        setError(
          'Não foi possível concluir a meta: verifique objetivos.status no Supabase. Rode supabase-objetivos-ciclo-vida-minimo.sql se precisar.'
        )
      } else {
        setError(String(error.message || error))
      }
      return
    }

    void registrarLog({
      modulo: 'Planejamento',
      area: areas.find((a) => a.id === areaId)?.nome ?? null,
      entidade: 'objetivos',
      entidade_id: objetivoId,
      operacao: 'UPDATE',
      valor_novo: {
        status: 'concluido',
        concluido_em: semanaAtual ?? null,
        comentario_conclusao: comentario
      },
      descricao: `Concluiu meta "${metaParaConcluir?.descricao || objetivoId}"`
    })
    setConcluindoMetaId(null)
    setMetasObjetivos(prev => (prev || []).map(m => {
      if (String(m?.id) !== String(objetivoId)) return m
      return { ...m, status: 'concluido', concluido: true }
    }))
    setConcluirMetaModalAberto(false)
    setMetaParaConcluir(null)
    setComentarioConclusaoMeta('')
    setIndicadorFeedback({ type: 'success', message: 'Meta concluída e movida para Conquistas' })
  }

  function handleReverterConclusao(meta) {
    setModalReverter({ meta, etapa: 1 })
  }

  async function confirmarReverter() {
    if (!modalReverter) return
    if (modalReverter.etapa === 1) {
      setModalReverter({ ...modalReverter, etapa: 2 })
      return
    }
    const meta = modalReverter.meta
    setModalReverter(null)
    setConcluindoMetaId(meta.id)
    setError(null)
    try {
      const { error: errStatus } = await supabase
        .from('objetivos')
        .update({ status: 'aberto' })
        .eq('id', meta.id)

      if (errStatus) throw errStatus

      await supabase
        .from('objetivos')
        .update({ concluido: false, concluido_em: null, comentario_conclusao: null })
        .eq('id', meta.id)
        .then(() => {})

      await supabase.from('conquistas').delete().eq('objetivo_id', meta.id)
      await supabase.from('indicador_conquistas').delete().eq('objetivo_id', meta.id)

      await carregarMetasObjetivos()
    } catch (err) {
      console.error('Erro ao reverter:', err)
      alert('Erro ao reverter: ' + (err?.message || err))
    } finally {
      setConcluindoMetaId(null)
    }
  }

  async function executarExclusaoMetaConfirmada(objetivoId) {
    if (!objetivoId) return
    setError(null)
    setMetaExcluindoId(objetivoId)
    const metaSnap = metaParaExcluir
    try {
      const rDisc = await supabase.from('tarefas').update({ objetivo_id: null }).eq('objetivo_id', objetivoId)
      if (!rDisc?.error) {
        void registrarLog({
          modulo: 'Planejamento',
          area: areas.find((a) => a.id === areaId)?.nome ?? null,
          entidade: 'tarefa',
          entidade_id: null,
          operacao: 'UPDATE',
          valor_novo: { objetivo_id: null, escopo: `desvinculadas_de_meta_${objetivoId}` },
          descricao: 'Desvinculou tarefas antes de excluir meta no Gantt'
        })
      }
    } catch {
      /* coluna opcional */
    }
    const { error: errDel } = await supabase.from('objetivos').delete().eq('id', objetivoId)
    setMetaExcluindoId(null)
    if (errDel) {
      setError(errDel.message)
      return
    }
    void registrarLog({
      modulo: 'Planejamento',
      area: areas.find((a) => a.id === areaId)?.nome ?? null,
      entidade: 'objetivo',
      entidade_id: objetivoId,
      operacao: 'DELETE',
      valor_anterior: metaSnap || null,
      descricao: `Excluiu meta "${metaSnap?.descricao || objetivoId}" (Gantt)`
    })
    if (addObjetivoId === objetivoId) setAddObjetivoId('')
    setExcluirMetaDrawerAberto(false)
    setMetaParaExcluir(null)
    await carregarMetasObjetivos()
    await carregarTarefas()
    await carregarPlanejamento()
  }

  const textoComentarioAcaoCell = useMemo(() => {
    const merged = new Map()
    for (const r of comentariosAtividadeRows || []) {
      if (!r?.acao_id) continue
      const k = `${r.acao_id}|${r.semana_iso}|${r.semana_ano}`
      const t = String(r.texto || '').trim()
      if (!t) continue
      merged.set(k, merged.has(k) ? `${merged.get(k)} — ${t}` : t)
    }
    if (merged.size > 0) {
      console.log('[pill] chaves merged (acao_id|semana_iso|semana_ano):', [...merged.keys()])
    }
    return (acaoId, sn) => {
      const ano = anoIsoPorSemanaColuna[sn]
      if (ano == null || !acaoId) return null
      const lookupKey = `${acaoId}|${sn}|${ano}`
      const result = merged.get(lookupKey) || null
      if (result) console.log('[pill] encontrou comentário:', acaoId, sn, result)
      return result
    }
  }, [comentariosAtividadeRows, anoIsoPorSemanaColuna])

  const textoComentarioIndicadorCell = useMemo(() => {
    const merged = new Map()
    for (const r of comentariosIndicadorRows || []) {
      if (!r?.indicador_id) continue
      const k = `${r.indicador_id}|${r.semana_iso}|${r.semana_ano}`
      const t = String(r.texto || '').trim()
      if (!t) continue
      merged.set(k, merged.has(k) ? `${merged.get(k)} — ${t}` : t)
    }
    return (indicadorId, sn) => {
      const ano = anoIsoPorSemanaColuna[sn]
      if (ano == null || !indicadorId) return null
      return merged.get(`${indicadorId}|${sn}|${ano}`) || null
    }
  }, [comentariosIndicadorRows, anoIsoPorSemanaColuna])

  const acaoIdsComComentario = useMemo(() => {
    const s = new Set()
    for (const r of comentariosAtividadeRows || []) {
      if (r?.acao_id) s.add(r.acao_id)
    }
    return s
  }, [comentariosAtividadeRows])

  const indicadorIdsComComentario = useMemo(() => {
    const s = new Set()
    for (const r of comentariosIndicadorRows || []) {
      if (r?.indicador_id) s.add(r.indicador_id)
    }
    return s
  }, [comentariosIndicadorRows])

  const temAlgumIndicadorNaGrade = useMemo(
    () =>
      Object.values(indicadoresPorObjetivo || {}).some(
        arr => Array.isArray(arr) && arr.length > 0
      ),
    [indicadoresPorObjetivo]
  )

  const pastelariaGantt = usePastelariaGanttBloco(areaId, semanas, semanaAtual)

  const ganttPlanejamentoTable = useMemo(() => {
    // Não usar `loading` aqui: ao trocar período (ex.: semestre) `carregarPlanejamento` dispara
    // e `setLoading(true)` esvaziava a grade inteira,
    // “piscando” barras/modais e disparando mouseleave em tooltips.
    if (!areaId) {
      return { tableRows: null }
    }
    if (linhasFiltradas.length === 0 && !temAlgumIndicadorNaGrade) {
      return { tableRows: null }
    }
    const tableRows = [...pastelariaGantt.rows]
    const nColunas = 2 + semanas.length + 1
    const pushLinhaIndicador = ind => {
      const indConcluido = String(ind?.status || '').toLowerCase() === 'concluido' || ind?.concluido === true
      const rowBg = { background: '#E8F2FB', borderBottom: '0.5px solid #9EC5E8', minHeight: 36, height: 36 }
      tableRows.push(
        <tr
          key={`ind-${ind.id}`}
          className="gantt-tr gantt-tr--indicador"
          style={{ ...rowBg, ...(indConcluido ? { opacity: 0.85 } : null) }}
        >
          <td
            className="gantt-shell-cell gantt-shell-cell--atividade gantt-td-ind"
            style={{
              background: '#E8F2FB',
              borderBottom: '0.5px solid #9EC5E8',
              height: 36,
              padding: '5px 8px',
              verticalAlign: 'middle'
            }}
          >
            <SemaforoIndicadorIcone indicador={ind} concluido={indConcluido} />
          </td>
          <td
            className="gantt-shell-cell gantt-shell-cell--responsavel gantt-td-ind"
            style={{
              background: '#E8F2FB',
              borderBottom: '0.5px solid #9EC5E8',
              fontSize: 11,
              color: '#5a7090',
              height: 36,
              verticalAlign: 'middle',
              textAlign: 'center'
            }}
          >
            {ind.unidade || '—'}
          </td>
          {semanas.map(s => {
            const isColSemanaAtual = semanaAtual != null && Number(s) === Number(semanaAtual)
            return (
            <td
              key={`${ind.id}-${s}`}
              className={`gantt-td-week gantt-bar-week-slot gantt-td-ind-week ${ganttCronogramaDensityClass}${isColSemanaAtual ? ' gantt-col-semana-atual' : ''}`}
              style={{
                verticalAlign: 'middle',
                textAlign: 'center',
                background: '#E8F2FB',
                borderBottom: '0.5px solid #9EC5E8',
                ...(isColSemanaAtual ? GANTT_BORDA_SEMANA_ATUAL_CEL : null)
              }}
            >
              <IndicadorSemanaInput
                key={`gantt-ind-inp-${ind.id}-w-${s}`}
                indicador={ind}
                semana={s}
                semanaAtual={semanaAtual}
                valueEntry={lancamentosPorIndicador[ind.id]?.[s]}
                onCommit={v => salvarLancamento(ind.id, s, v)}
                comentarioTooltip={textoComentarioIndicadorCell(ind.id, Number(s))}
              />
            </td>
            )
          })}
          <td
            className="gantt-td-acoes"
            style={{
              background: '#E8F2FB',
              padding: '5px 6px',
              verticalAlign: 'middle',
              borderBottom: '0.5px solid #9EC5E8',
              textAlign: 'center'
            }}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {indConcluido ? (
                <span
                  style={{
                    background: '#2e7d32',
                    color: '#fff',
                    borderRadius: 10,
                    padding: '1px 8px',
                    fontSize: 10,
                    fontWeight: 500,
                    whiteSpace: 'nowrap'
                  }}
                  title="Indicador concluído"
                >
                  ✓ Concluído
                </span>
              ) : null}
              {String(ind.meta_ciclo_tipo || '').toLowerCase() === 'atingivel' &&
              String(ind.status || '').toLowerCase() !== 'concluido' ? (
                <button
                  type="button"
                  onClick={() => abrirModalConclusaoIndicador(ind)}
                  title="Concluir indicador"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'inherit',
                    fontSize: '14px',
                    padding: '0 2px',
                    opacity: 0.85
                  }}
                  disabled={Boolean(concluindoMetaId)}
                >
                  ✓
                </button>
              ) : null}
              <button
                type="button"
                className={`gantt-btn-dots${indicadorIdsComComentario.has(ind.id) ? ' gantt-btn-dots--ativo' : ''}`}
                onClick={() =>
                  setComentarioModal({ tipo: 'indicador', referenciaId: ind.id, nome: ind.nome || '—' })
                }
              >
                ···
              </button>
            </div>
          </td>
        </tr>
      )
    }

    /** Um único bloco visual: faixa azul + cabeçalho de colunas + todas as linhas (várias metas), sem repetir por meta. */
    const montarBlocoIndicadoresUnificado = () => {
      // Agrupa indicadores por meta, mantendo a ordem das metas
      const gruposPorMeta = [] // [{ meta, indicadores: [] }]
      const metaJaVista = new Set()
      const indicadorIdJaIncluso = new Set()

      const pushGrupo = (keyObj) => {
        if (!keyObj || keyObj === '_sem' || metaJaVista.has(keyObj)) return
        const lista = (indicadoresPorObjetivo[keyObj] || []).filter(ind => {
          if (!ind?.id || indicadorIdJaIncluso.has(ind.id)) return false
          indicadorIdJaIncluso.add(ind.id)
          return true
        })
        if (!lista.length) return
        metaJaVista.add(keyObj)
        const meta = metaById.get(String(keyObj))
        gruposPorMeta.push({ meta, indicadores: lista })
      }

      linhas.forEach(l => {
        if (l.tipo !== 'objetivo' || !l.objetivoId || l.objetivoId === '_sem') return
        const oc = metaIdCanonica(metasObjetivos, l.objetivoId)
        pushGrupo(oc || l.objetivoId)
      })
      ;(metasObjetivos || []).forEach(m => {
        if (m?.id) pushGrupo(m.id)
      })

      if (gruposPorMeta.length === 0) return

      // Cabeçalho principal INDICADORES
      tableRows.push(
        <tr key="ind-bloco-caption" className="gantt-tr gantt-tr--ind-caption" role="row">
          <td colSpan={nColunas} className="gantt-td-ind-caption">
            Indicadores
          </td>
        </tr>
      )

      // Subheader de colunas
      tableRows.push(
        <tr key="ind-bloco-subh" className="gantt-tr gantt-tr--ind-subhdr" role="row">
          <td className="gantt-th gantt-th--atividade gantt-th--indicadores-col gantt-td-subhdr">Indicador</td>
          <td className="gantt-th gantt-th--responsavel gantt-td-subhdr">Responsável</td>
          {semanas.map(s => (
            <td
              key={s}
              className={`gantt-th gantt-th-week gantt-td-subhdr${semanaAtual != null && Number(s) === Number(semanaAtual) ? ' gantt-th-week--atual gantt-col-semana-atual' : ''}`}
              title={`Semana ${s}`}
              style={semanaAtual != null && Number(s) === Number(semanaAtual) ? GANTT_BORDA_SEMANA_ATUAL_HDR : undefined}
            >
              {s}
            </td>
          ))}
          <td className="gantt-th gantt-th--acoes gantt-td-subhdr">Ações</td>
        </tr>
      )

      // Para cada grupo: linha com nome da meta + linhas de indicadores
      gruposPorMeta.forEach(({ meta, indicadores }, gi) => {
        const nomeMetaDisplay = meta?.nome?.trim() || meta?.descricao?.trim() || 'Meta'
        tableRows.push(
          <tr key={`ind-meta-hdr-${meta?.id || gi}`} role="row">
            <td
              colSpan={nColunas}
              style={{
                background: '#0e3a4e',
                color: 'rgba(245,242,238,0.85)',
                fontSize: 11,
                fontWeight: 600,
                padding: '5px 14px',
                borderBottom: '0.5px solid #3e7490',
                letterSpacing: '0.04em',
              }}
            >
              {nomeMetaDisplay}
            </td>
          </tr>
        )
        indicadores.forEach(ind => pushLinhaIndicador(ind))
      })
    }
    const metaById = new Map((metasObjetivos || []).filter(m => m?.id).map(m => [String(m.id), m]))
    let acaoBefore = 0
    linhasFiltradas.forEach(l => {
      if (l.tipo === 'objetivo') {
        const concluida = metaConcluida(l.meta)
        const semanaConc = semanaConclusaoLabel(l.meta)
        tableRows.push(
          <tr
            key={l.id}
            className="gantt-tr gantt-tr--meta gantt-shell-row--meta"
            role="row"
            style={
              concluida
                ? {
                    background: '#e8ecef',
                    color: '#1f2937',
                    borderBottom: '0.5px solid #d1d5db'
                  }
                : undefined
            }
          >
            <td className="gantt-shell-cell gantt-shell-cell--atividade" style={concluida ? { background: '#e8ecef' } : undefined}>
              <span
                className="gantt-meta-nome"
                title={l.nome?.trim() || undefined}
                style={concluida ? { textDecoration: 'line-through', color: '#888780' } : undefined}
              >
                {concluida && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3,
                      background: 'rgba(0,0,0,0.08)',
                      borderRadius: 8,
                      padding: '1px 8px',
                      fontSize: 10,
                      marginRight: 6,
                      whiteSpace: 'nowrap',
                      textDecoration: 'none',
                    }}
                    title="Meta concluída"
                  >
                    ✓ Concluído{semanaConc ? ` · ${semanaConc}` : ''}
                  </span>
                )}
                <span>{l.nome}</span>
              </span>
            </td>
            <td className="gantt-shell-cell gantt-shell-cell--responsavel" style={concluida ? { background: '#e8ecef' } : undefined}>
              <span className="gantt-meta-prazo" style={concluida ? { color: '#6b7280' } : undefined}>
                {l.meta ? formatoPrazoMeta(l.meta) : 'Prazo: —'}
              </span>
            </td>
            <td colSpan={semanas.length} className="gantt-td gantt-td--meta-spacer" aria-hidden />
            <td className="gantt-td gantt-td--meta-spacer gantt-td--acoes" aria-hidden />
          </tr>
        )
        return
      }
      if (l.tipo === 'secao_tipo_atividade') {
        const nColunasSec = 2 + semanas.length + 1
        tableRows.push(
          <tr
            key={l.id}
            className={`gantt-tr gantt-tr--secao-tipo-atividade gantt-tr--secao-tipo-${l.secaoTipo}`}
            role="row"
          >
            <td colSpan={nColunasSec} className={`gantt-td-secao-tipo-atividade gantt-td-secao-tipo-${l.secaoTipo}`}>
              {l.nome}
            </td>
          </tr>
        )
        return
      }
      if (l.tipo === 'secao_spacer') {
        const nColunasSp = 2 + semanas.length + 1
        tableRows.push(
          <tr key={l.id} className="gantt-tr gantt-tr--secao-spacer" role="row">
            <td
              colSpan={nColunasSp}
              className="gantt-td-secao-spacer"
              style={{
                height: 10,
                minHeight: 10,
                maxHeight: 10,
                padding: 0,
                lineHeight: 0,
                fontSize: 0,
                border: 'none',
                background: 'var(--color-background-tertiary)'
              }}
              aria-hidden
            />
          </tr>
        )
        return
      }
      const isAcaoAlt = l.tipo === 'acao' && acaoBefore % 2 === 1
      if (l.tipo === 'acao') acaoBefore++
      // `l.id` pode ser `a_<acao_id>_<objetivo_id>` — não usar no Supabase como acao_id (uuid).
      const acaoId = l.tipo === 'acao' ? l.acaoId : null
      const tipoBarSuf =
        l.tipo === 'acao' && l.tipoAtividadeBar === 'modelagem'
          ? ' gantt-shell-row--acao-tipo-mod'
          : l.tipo === 'acao' && l.tipoAtividadeBar === 'documentacao'
            ? ' gantt-shell-row--acao-tipo-doc'
            : ''
      const cronTipoBarSuf =
        l.tipo === 'acao' && l.tipoAtividadeBar === 'modelagem'
          ? ' gantt-shell-row--cron-tipo-mod'
          : l.tipo === 'acao' && l.tipoAtividadeBar === 'documentacao'
            ? ' gantt-shell-row--cron-tipo-doc'
            : ''
      const acoesTipoBarSuf =
        l.tipo === 'acao' && l.tipoAtividadeBar === 'modelagem'
          ? ' gantt-shell-row--acoes-tipo-mod'
          : l.tipo === 'acao' && l.tipoAtividadeBar === 'documentacao'
            ? ' gantt-shell-row--acoes-tipo-doc'
            : ''
      const rowClass =
        l.tipo === 'comportamento'
          ? `gantt-shell-row gantt-shell-row--grupo${l.estiloGrupoProjeto ? ' gantt-shell-row--grupo-projeto-f5' : ''}`
          : `gantt-shell-row gantt-shell-row--acao${isAcaoAlt ? ' gantt-shell-row--acao-alt' : ''}${tipoBarSuf}`
      const cronClass =
        l.tipo === 'comportamento'
          ? `gantt-shell-row gantt-shell-row--cronograma gantt-shell-row--cronograma-grupo${l.estiloGrupoProjeto ? ' gantt-shell-row--cronograma-grupo-projeto' : ''}`
          : `gantt-shell-row gantt-shell-row--cronograma${isAcaoAlt ? ' gantt-shell-row--acao-alt' : ''}${isAreaFranqueado || isAreaPortfolio ? ' gantt-shell-row--acoplamento' : ''}${isAreaJuridico ? ' gantt-shell-row--juridico' : ''}${cronTipoBarSuf}`
      const isAcaoAltR = isAcaoAlt
      const acoesClass =
        l.tipo === 'comportamento'
          ? `gantt-shell-row gantt-shell-row--acoes gantt-shell-row--acoes-grupo${l.estiloGrupoProjeto ? ' gantt-shell-row--acoes-grupo-projeto' : ''}`
          : `gantt-shell-row gantt-shell-row--acoes${isAcaoAltR ? ' gantt-shell-row--acao-alt' : ''}${acoesTipoBarSuf}`
      const metaLinhaId = l?.objetivoId != null && l.objetivoId !== '_sem' ? String(l.objetivoId) : null
      const metaLinha = metaLinhaId ? (metaById.get(metaLinhaId) || metaById.get(String(metaIdCanonica(metasObjetivos, metaLinhaId)))) : null
      const metaFechada = metaConcluida(metaLinha)

      if (l.tipo === 'comportamento') {
        tableRows.push(
          <tr
            key={l.id}
            className={`gantt-tr ${rowClass}`}
            role="row"
            style={
              metaFechada
                ? { background: '#f3f4f6', color: '#374151', borderBottom: '0.5px solid #e5e7eb' }
                : undefined
            }
          >
            <td className="gantt-shell-cell gantt-shell-cell--atividade">
              <span
                className="gantt-nome-comportamento"
                style={metaFechada ? { color: '#888780', textDecoration: 'line-through', opacity: 0.85 } : undefined}
              >
                {l.nome}
              </span>
            </td>
            <td className="gantt-shell-cell gantt-shell-cell--responsavel">—</td>
            <td colSpan={semanas.length} className={`gantt-td gantt-td--grupo-weeks ${cronClass}`}>
              <div className="gantt-bar-placeholder gantt-bar-placeholder--grupo" />
            </td>
            <td className={`gantt-td gantt-td-acoes ${acoesClass}`} aria-hidden />
          </tr>
        )
        return
      }

      tableRows.push(
        <tr
          key={l.id}
          className={`gantt-tr ${rowClass} ${cronClass}`}
          role="row"
          style={
            metaFechada || l.esconderAcoes
              ? {
                  ...(metaFechada ? { background: '#f9fafb', color: '#374151', opacity: 0.8 } : {}),
                  ...(l.esconderAcoes ? { borderTop: '0.5px solid rgba(0,0,0,0.06)' } : {})
                }
              : undefined
          }
        >
          {l.esconderAcoes ? null : (
            <td
              className="gantt-shell-cell gantt-shell-cell--atividade"
              rowSpan={l.temSublinhas ? l.grupoTotal : undefined}
              style={l.temSublinhas ? { verticalAlign: 'middle' } : undefined}
            >
              <span
                className="gantt-nome-acao"
                style={metaFechada ? { color: '#888780', textDecoration: 'line-through', opacity: 0.85 } : undefined}
              >
                ↳ {l.nome}
              </span>
            </td>
          )}
          {l.esconderAcoes ? null : (
            <td
              className="gantt-shell-cell gantt-shell-cell--responsavel"
              rowSpan={l.temSublinhas ? l.grupoTotal : undefined}
              style={l.temSublinhas ? { verticalAlign: 'middle' } : undefined}
            >{l.responsavel}</td>
          )}
          {semanas.map(s => {
                  const sn = Number(s)
                  const rowsPlano = l.planejamentoRows || []
                  /** Mesma coluna de semana: todos os planos que cruzam esta ISO (expand + fallback). */
                  const registrosDaCelula = registrosPlanejamentoNaSemanaIso(rowsPlano, sn, semanas)
                  const rowKeyBase = l.acaoId
                    ? `a_${l.acaoId}`
                    : l.comportamentoId
                      ? `t_${l.comportamentoId}`
                      : l.id
                  const pidUnico =
                    (isAreaCasa || isAreaFranqueado || isAreaPortfolio || isAreaComercial || isAreaAdm || isAreaControladoria || isAreaJuridico) &&
                    registrosDaCelula?.length === 1 &&
                    registrosDaCelula[0]?.id
                      ? String(registrosDaCelula[0].id)
                      : null
                  const rowKey = pidUnico ? `${rowKeyBase}__p_${pidUnico}` : rowKeyBase
                  const h = mapaHoras[rowKey]?.[sn] ?? mapaHoras[rowKey]?.[s] ?? mapaHoras[rowKeyBase]?.[sn] ?? mapaHoras[rowKeyBase]?.[s]
                  const num = h != null && Number(h) > 0 ? Number(h) : 0
                  const st = getStatusCelula(mapaStatus, rowKey, sn) ?? getStatusCelula(mapaStatus, rowKey, s) ?? getStatusCelula(mapaStatus, rowKeyBase, sn) ?? getStatusCelula(mapaStatus, rowKeyBase, s)
                  const concluido = cronogramaStatusEhConcluido(st)
                  const isAtual = semanaAtual != null && Number(semanaAtual) === sn
                  const noIntervaloPrevisto =
                    Array.isArray(l.semanasSelecionadas) &&
                    l.semanasSelecionadas.some(w => Number(w) === sn)
                  const clicavel = noIntervaloPrevisto || num > 0 || concluido
                  let statusClass = 'gantt-bar-vazio'
                  if (concluido) {
                    statusClass = 'gantt-bar-realizado'
                  } else if (num > 0 || noIntervaloPrevisto) {
                    if (semanaCorteAtrasado != null && sn < Number(semanaCorteAtrasado)) statusClass = 'gantt-bar-atrasado'
                    else statusClass = 'gantt-bar-planejado'
                  }
                  const atualPlanejado = isAtual && statusClass === 'gantt-bar-planejado'
                  /** Acoplamento: um ou mais planos na mesma semana — pill + tag do franqueado (legado: franqueado_nome). */
                  const layoutAcoplamentoMultilinha = isAreaFranqueado && registrosDaCelula.length >= 1
                  /** Comercial: um ou mais planos na mesma semana — pill + tag do candidato. */
                  const layoutComercialMultilinha = isAreaComercial && registrosDaCelula.length >= 1
                  /** Uma ou mais casas na mesma semana: sempre layout empilhado (pill + tag), não só quando length > 1. */
                  const layoutCasaMultilinha = isAreaCasa && registrosDaCelula.length >= 1
                  const layoutAdmMultilinha = isAreaAdm && registrosDaCelula.length >= 1
                  let registrosDaCelulaCtrl = []
                  if (isAreaControladoria) {
                    const snnCtrl = Number(sn)
                    const semanasGridNormCtrl = (semanas || []).map(Number).filter(Number.isFinite)
                    const gridSetCtrl = new Set(semanasGridNormCtrl)
                    const matchedCtrl = (rowsPlano || []).filter(reg => {
                      if (planejamentoCaiNaSemanaIso(reg, snnCtrl, semanasGridNormCtrl)) return true
                      const wk = expandGanttSemanasParaGradeIso(reg, semanasGridNormCtrl)
                      if (wk.some(w => Number(w) === snnCtrl)) return true
                      const ss = normalizarSemanasSelecionadasGantt(reg?.semanas_selecionadas)
                      return ss.some(w => Number(w) === snnCtrl && gridSetCtrl.has(snnCtrl))
                    })
                    const byIdCtrl = new Map()
                    const semIdCtrl = []
                    for (const r of matchedCtrl) {
                      if (r?.id != null && r.id !== '') byIdCtrl.set(String(r.id), r)
                      else semIdCtrl.push(r)
                    }
                    registrosDaCelulaCtrl = [...Array.from(byIdCtrl.values()), ...semIdCtrl]
                  }
                  const layoutControladoriaMultilinha = isAreaControladoria && registrosDaCelulaCtrl.length >= 1
                  const layoutJuridicoMultilinha = isAreaJuridico && registrosDaCelula.length >= 1
                  const registroUnico = registrosDaCelula[0]
                  const tipAcaoSemana = acaoId ? textoComentarioAcaoCell(acaoId, sn) : null
                  const dotsPlanAcao = statusClass === 'gantt-bar-planejado' || atualPlanejado

                  if (layoutAcoplamentoMultilinha) {
                    const registrosDaCelulaOrdenados = [...registrosDaCelula].sort((a, b) => {
                      const nomeA = nomeFranqueadoAcoplamentoReg(a, franqueadosAtivos).toLowerCase()
                      const nomeB = nomeFranqueadoAcoplamentoReg(b, franqueadosAtivos).toLowerCase()
                      return nomeA.localeCompare(nomeB, 'pt-BR')
                    })
                    const clicavelCel = registrosDaCelula.some(reg => {
                      const rk = rowKeyMapaCronogramaReg(reg, l, acaoId)
                      const hh = rk ? (mapaHoras[rk]?.[sn] ?? mapaHoras[rk]?.[s] ?? null) : null
                      const ss = rk ? (getStatusCelula(mapaStatus, rk, sn) ?? getStatusCelula(mapaStatus, rk, s) ?? null) : null
                      const concl = cronogramaStatusEhConcluido(ss)
                      const noPlano =
                        planejamentoCaiNaSemanaIso(reg, sn, semanas)
                      return noPlano || (hh != null && Number(hh) > 0) || concl
                    })
                    return (
                      <td
                        key={s}
                        className={`gantt-td-week gantt-bar-week-slot ${ganttCronogramaDensityClass}${isAtual ? ' gantt-col-semana-atual' : ''} ${!clicavelCel ? 'gantt-bar-no-click' : ''}`}
                        title={`Semana ${s}`}
                        style={{
                          minHeight: 44,
                          height: 'auto',
                          overflow: 'visible',
                          padding: '4px',
                          boxSizing: 'border-box',
                          verticalAlign: 'middle',
                          textAlign: 'center',
                          ...(isAtual ? GANTT_BORDA_SEMANA_ATUAL_CEL : { borderRight: '0.5px solid rgba(0,0,0,0.06)' })
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 4,
                            width: '100%',
                            minWidth: 0
                          }}
                        >
                          {registrosDaCelulaOrdenados.map((reg, idx) => {
                            const rowKeyReg = rowKeyMapaCronogramaReg(reg, l, acaoId)
                            const hReg = rowKeyReg ? (mapaHoras[rowKeyReg]?.[sn] ?? mapaHoras[rowKeyReg]?.[s] ?? null) : null
                            const numReg = hReg != null && Number(hReg) > 0 ? Number(hReg) : 0
                            const stReg = rowKeyReg ? (getStatusCelula(mapaStatus, rowKeyReg, sn) ?? getStatusCelula(mapaStatus, rowKeyReg, s) ?? null) : null
                            const statusReg = stReg || 'pendente'
                            const concluidoReg = cronogramaStatusEhConcluido(statusReg)
                            const noIntervaloPrevistoReg =
                              planejamentoCaiNaSemanaIso(reg, sn, semanas)
                            const clicavelReg = noIntervaloPrevistoReg || numReg > 0 || concluidoReg
                            let statusClassReg = 'gantt-bar-vazio'
                            if (concluidoReg) {
                              statusClassReg = 'gantt-bar-realizado'
                            } else if (numReg > 0 || noIntervaloPrevistoReg) {
                              if (semanaCorteAtrasado != null && sn < Number(semanaCorteAtrasado)) statusClassReg = 'gantt-bar-atrasado'
                              else statusClassReg = 'gantt-bar-planejado'
                            }
                            const atualPlanejadoReg = isAtual && statusClassReg === 'gantt-bar-planejado'
                            return (
                              <div
                                key={reg.id ?? `reg-${idx}`}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: 1,
                                  cursor: clicavelReg ? 'pointer' : 'default',
                                  width: '100%'
                                }}
                                onClick={clicavelReg ? e => {
                                  e.stopPropagation()
                                  const novoConcluido = !concluidoReg
                                  if (novoConcluido) {
                                    setTempoModalAberto(true)
                                    setTempoModalSemana(sn)
                                    setTempoModalAcaoId(reg.acao_id || acaoId)
                                    setTempoModalPlanejamentoId(reg.id || null)
                                    setTempoModalEstimado(l.tempoHoras ?? null)
                                    setTempoModalValor('')
                                    setTempoModalUnidade('horas')
                                  } else {
                                    salvarCelula(reg.acao_id || acaoId, sn, 0, false, { planejamentoId: reg.id })
                                  }
                                } : undefined}
                              >
                              {idx > 0 && (
                                <div
                                  style={{
                                    width: 38,
                                    height: '0.5px',
                                    background: 'var(--color-border-tertiary)',
                                    margin: '2px 0'
                                  }}
                                />
                              )}
                              {(() => {
                                const pillEl = (
                                  <div
                                    className={`gantt-bar-pill ${statusClassReg}${atualPlanejadoReg ? ' gantt-bar-pill--semana-atual-planejada' : ''}${tipAcaoSemana ? ' gantt-bar-pill--com-comentario' : ''}`}
                                    style={{
                                      width: 38,
                                      height: 20,
                                      borderRadius: 3,
                                      cursor: clicavelReg ? 'pointer' : 'default',
                                      pointerEvents: 'none',
                                      ...(tipAcaoSemana ? { position: 'relative', overflow: 'visible' } : null)
                                    }}
                                  >
                                    {concluidoReg ? <span className="gantt-bar-check">✓</span> : null}
                                  </div>
                                )
                                return envolverPillComentarioAcao(pillEl, sn, tipAcaoSemana)
                              })()}
                              {(() => {
                                const txt = nomeFranqueadoAcoplamentoReg(reg, franqueadosAtivos)
                                if (!txt) return null
                                return (
                                  <span title={txt} style={TAG_FRANQUEADO_STYLE}>
                                    {txt}
                                  </span>
                                )
                              })()}
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    )
                  }

                  const layoutPortfolioMultilinha = isAreaPortfolio && registrosDaCelula.length >= 1
                  if (layoutPortfolioMultilinha) {
                    const registrosDaCelulaOrdenados = [...registrosDaCelula].sort((a, b) => {
                      const nomeA = String(
                        portfolioFranqueados.find(f => String(f.id) === String(a?.portfolio_franqueado_id || ''))?.nome
                          ?? a?.portfolio_franqueado_nome
                          ?? ''
                      ).toLowerCase()
                      const nomeB = String(
                        portfolioFranqueados.find(f => String(f.id) === String(b?.portfolio_franqueado_id || ''))?.nome
                          ?? b?.portfolio_franqueado_nome
                          ?? ''
                      ).toLowerCase()
                      return nomeA.localeCompare(nomeB, 'pt-BR')
                    })
                    const clicavelCel = registrosDaCelula.some(reg => {
                      const rk = rowKeyMapaCronogramaReg(reg, l, acaoId)
                      const hh = rk ? (mapaHoras[rk]?.[sn] ?? mapaHoras[rk]?.[s] ?? null) : null
                      const ss = rk ? (getStatusCelula(mapaStatus, rk, sn) ?? getStatusCelula(mapaStatus, rk, s) ?? null) : null
                      const concl = cronogramaStatusEhConcluido(ss)
                      const noPlano =
                        planejamentoCaiNaSemanaIso(reg, sn, semanas)
                      return noPlano || (hh != null && Number(hh) > 0) || concl
                    })
                    return (
                      <td
                        key={s}
                        className={`gantt-td-week gantt-bar-week-slot ${ganttCronogramaDensityClass}${isAtual ? ' gantt-col-semana-atual' : ''} ${!clicavelCel ? 'gantt-bar-no-click' : ''}`}
                        title={`Semana ${s}`}
                        style={{
                          minHeight: 44,
                          height: 'auto',
                          overflow: 'visible',
                          padding: '4px',
                          boxSizing: 'border-box',
                          verticalAlign: 'middle',
                          textAlign: 'center',
                          ...(isAtual ? GANTT_BORDA_SEMANA_ATUAL_CEL : { borderRight: '0.5px solid rgba(0,0,0,0.06)' })
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 4,
                            width: '100%',
                            minWidth: 0
                          }}
                        >
                          {registrosDaCelulaOrdenados.map((reg, idx) => {
                            const rowKeyReg = rowKeyMapaCronogramaReg(reg, l, acaoId)
                            const hReg = rowKeyReg ? (mapaHoras[rowKeyReg]?.[sn] ?? mapaHoras[rowKeyReg]?.[s] ?? null) : null
                            const numReg = hReg != null && Number(hReg) > 0 ? Number(hReg) : 0
                            const stReg = rowKeyReg ? (getStatusCelula(mapaStatus, rowKeyReg, sn) ?? getStatusCelula(mapaStatus, rowKeyReg, s) ?? null) : null
                            const statusReg = stReg || 'pendente'
                            const concluidoReg = cronogramaStatusEhConcluido(statusReg)
                            const noIntervaloPrevistoReg =
                              planejamentoCaiNaSemanaIso(reg, sn, semanas)
                            const clicavelReg = noIntervaloPrevistoReg || numReg > 0 || concluidoReg
                            let statusClassReg = 'gantt-bar-vazio'
                            if (concluidoReg) {
                              statusClassReg = 'gantt-bar-realizado'
                            } else if (numReg > 0 || noIntervaloPrevistoReg) {
                              if (semanaCorteAtrasado != null && sn < Number(semanaCorteAtrasado)) statusClassReg = 'gantt-bar-atrasado'
                              else statusClassReg = 'gantt-bar-planejado'
                            }
                            const atualPlanejadoReg = isAtual && statusClassReg === 'gantt-bar-planejado'
                            return (
                              <div
                                key={reg.id ?? `reg-${idx}`}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: 1,
                                  cursor: clicavelReg ? 'pointer' : 'default',
                                  width: '100%'
                                }}
                                onClick={clicavelReg ? e => {
                                  e.stopPropagation()
                                  const novoConcluido = !concluidoReg
                                  if (novoConcluido) {
                                    setTempoModalAberto(true)
                                    setTempoModalSemana(sn)
                                    setTempoModalAcaoId(reg.acao_id || acaoId)
                                    setTempoModalPlanejamentoId(reg.id || null)
                                    setTempoModalEstimado(l.tempoHoras ?? null)
                                    setTempoModalValor('')
                                    setTempoModalUnidade('horas')
                                  } else {
                                    salvarCelula(reg.acao_id || acaoId, sn, 0, false, { planejamentoId: reg.id })
                                  }
                                } : undefined}
                              >
                              {idx > 0 && (
                                <div
                                  style={{
                                    width: 38,
                                    height: '0.5px',
                                    background: 'var(--color-border-tertiary)',
                                    margin: '2px 0'
                                  }}
                                />
                              )}
                              {(() => {
                                const pillEl = (
                                  <div
                                    className={`gantt-bar-pill ${statusClassReg}${atualPlanejadoReg ? ' gantt-bar-pill--semana-atual-planejada' : ''}${tipAcaoSemana ? ' gantt-bar-pill--com-comentario' : ''}`}
                                    style={{
                                      width: 38,
                                      height: 20,
                                      borderRadius: 3,
                                      cursor: clicavelReg ? 'pointer' : 'default',
                                      pointerEvents: 'none',
                                      ...(tipAcaoSemana ? { position: 'relative', overflow: 'visible' } : null)
                                    }}
                                  >
                                    {concluidoReg ? <span className="gantt-bar-check">✓</span> : null}
                                  </div>
                                )
                                return envolverPillComentarioAcao(pillEl, sn, tipAcaoSemana)
                              })()}
                              {(() => {
                                const txt =
                                  portfolioFranqueados.find(f => String(f.id) === String(reg?.portfolio_franqueado_id || ''))?.nome
                                  ?? reg?.portfolio_franqueado_nome
                                  ?? null
                                if (!txt) return null
                                return (
                                  <span title={txt} style={TAG_FRANQUEADO_STYLE}>
                                    {txt}
                                  </span>
                                )
                              })()}
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    )
                  }

                  if (layoutComercialMultilinha) {
                    const registrosDaCelulaOrdenados = [...registrosDaCelula].sort((a, b) => {
                      const nomeA = nomeCandidatoComercialReg(a, comercialCandidatos).toLowerCase()
                      const nomeB = nomeCandidatoComercialReg(b, comercialCandidatos).toLowerCase()
                      return nomeA.localeCompare(nomeB, 'pt-BR')
                    })
                    const clicavelCel = registrosDaCelula.some(reg => {
                      const rk = rowKeyMapaCronogramaReg(reg, l, acaoId)
                      const hh = rk ? (mapaHoras[rk]?.[sn] ?? mapaHoras[rk]?.[s] ?? null) : null
                      const ss = rk ? (getStatusCelula(mapaStatus, rk, sn) ?? getStatusCelula(mapaStatus, rk, s) ?? null) : null
                      const concl = cronogramaStatusEhConcluido(ss)
                      const noPlano =
                        planejamentoCaiNaSemanaIso(reg, sn, semanas)
                      return noPlano || (hh != null && Number(hh) > 0) || concl
                    })
                    return (
                      <td
                        key={s}
                        className={`gantt-td-week gantt-bar-week-slot ${ganttCronogramaDensityClass}${isAtual ? ' gantt-col-semana-atual' : ''} ${!clicavelCel ? 'gantt-bar-no-click' : ''}`}
                        title={`Semana ${s}`}
                        style={{
                          minHeight: 44,
                          height: 'auto',
                          overflow: 'visible',
                          padding: '4px',
                          boxSizing: 'border-box',
                          verticalAlign: 'middle',
                          textAlign: 'center',
                          ...(isAtual ? GANTT_BORDA_SEMANA_ATUAL_CEL : { borderRight: '0.5px solid rgba(0,0,0,0.06)' })
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 4,
                            width: '100%',
                            minWidth: 0
                          }}
                        >
                          {registrosDaCelulaOrdenados.map((reg, idx) => {
                            const rowKeyReg = rowKeyMapaCronogramaReg(reg, l, acaoId)
                            const hReg = rowKeyReg ? (mapaHoras[rowKeyReg]?.[sn] ?? mapaHoras[rowKeyReg]?.[s] ?? null) : null
                            const numReg = hReg != null && Number(hReg) > 0 ? Number(hReg) : 0
                            const stReg = rowKeyReg ? (getStatusCelula(mapaStatus, rowKeyReg, sn) ?? getStatusCelula(mapaStatus, rowKeyReg, s) ?? null) : null
                            const statusReg = stReg || 'pendente'
                            const concluidoReg = cronogramaStatusEhConcluido(statusReg)
                            const noIntervaloPrevistoReg =
                              planejamentoCaiNaSemanaIso(reg, sn, semanas)
                            const clicavelReg = noIntervaloPrevistoReg || numReg > 0 || concluidoReg
                            let statusClassReg = 'gantt-bar-vazio'
                            if (concluidoReg) {
                              statusClassReg = 'gantt-bar-realizado'
                            } else if (numReg > 0 || noIntervaloPrevistoReg) {
                              if (semanaCorteAtrasado != null && sn < Number(semanaCorteAtrasado)) statusClassReg = 'gantt-bar-atrasado'
                              else statusClassReg = 'gantt-bar-planejado'
                            }
                            const atualPlanejadoReg = isAtual && statusClassReg === 'gantt-bar-planejado'
                            return (
                              <div
                                key={reg.id ?? `reg-${idx}`}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: 1,
                                  cursor: clicavelReg ? 'pointer' : 'default',
                                  width: '100%'
                                }}
                                onClick={clicavelReg ? e => {
                                  e.stopPropagation()
                                  const novoConcluido = !concluidoReg
                                  if (novoConcluido) {
                                    setTempoModalAberto(true)
                                    setTempoModalSemana(sn)
                                    setTempoModalAcaoId(reg.acao_id || acaoId)
                                    setTempoModalPlanejamentoId(reg.id || null)
                                    setTempoModalEstimado(l.tempoHoras ?? null)
                                    setTempoModalValor('')
                                    setTempoModalUnidade('horas')
                                  } else {
                                    salvarCelula(reg.acao_id || acaoId, sn, 0, false, { planejamentoId: reg.id })
                                  }
                                } : undefined}
                              >
                              {idx > 0 && (
                                <div
                                  style={{
                                    width: 38,
                                    height: '0.5px',
                                    background: 'var(--color-border-tertiary)',
                                    margin: '2px 0'
                                  }}
                                />
                              )}
                              {(() => {
                                const pillEl = (
                                  <div
                                    className={`gantt-bar-pill ${statusClassReg}${atualPlanejadoReg ? ' gantt-bar-pill--semana-atual-planejada' : ''}${tipAcaoSemana ? ' gantt-bar-pill--com-comentario' : ''}`}
                                    style={{
                                      width: 38,
                                      height: 20,
                                      borderRadius: 3,
                                      cursor: clicavelReg ? 'pointer' : 'default',
                                      pointerEvents: 'none',
                                      ...(tipAcaoSemana ? { position: 'relative', overflow: 'visible' } : null)
                                    }}
                                  >
                                    {concluidoReg ? <span className="gantt-bar-check">✓</span> : null}
                                  </div>
                                )
                                return envolverPillComentarioAcao(pillEl, sn, tipAcaoSemana)
                              })()}
                              {(() => {
                                const txt = nomeCandidatoComercialReg(reg, comercialCandidatos)
                                if (!txt) return null
                                return (
                                  <span title={txt} style={TAG_FRANQUEADO_STYLE}>
                                    {txt}
                                  </span>
                                )
                              })()}
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    )
                  }

                  if (layoutCasaMultilinha) {
                    const registrosDaCelulaOrdenados = [...registrosDaCelula].sort((a, b) => {
                      const nomeA = String(
                        (a?.casas?.nome || casas.find(c => String(c.id) === String(a.casa_id))?.nome || '')
                      ).toLowerCase()
                      const nomeB = String(
                        (b?.casas?.nome || casas.find(c => String(c.id) === String(b.casa_id))?.nome || '')
                      ).toLowerCase()
                      return nomeA.localeCompare(nomeB, 'pt-BR')
                    })
                    const clicavelCel = registrosDaCelula.some(reg => {
                      const rk = rowKeyMapaCronogramaReg(reg, l, acaoId)
                      const hh = rk ? (mapaHoras[rk]?.[sn] ?? mapaHoras[rk]?.[s] ?? null) : null
                      const ss = rk ? (getStatusCelula(mapaStatus, rk, sn) ?? getStatusCelula(mapaStatus, rk, s) ?? null) : null
                      const concl = cronogramaStatusEhConcluido(ss)
                      const noPlano =
                        planejamentoCaiNaSemanaIso(reg, sn, semanas)
                      return noPlano || (hh != null && Number(hh) > 0) || concl
                    })
                    return (
                      <td
                        key={s}
                        className={`gantt-td-week gantt-bar-week-slot ${ganttCronogramaDensityClass}${isAtual ? ' gantt-col-semana-atual' : ''} ${!clicavelCel ? 'gantt-bar-no-click' : ''}`}
                        title={`Semana ${s}`}
                        style={{
                          minHeight: 44,
                          height: 'auto',
                          overflow: 'visible',
                          padding: '4px 2px',
                          boxSizing: 'border-box',
                          verticalAlign: 'middle',
                          textAlign: 'center',
                          ...(isAtual ? GANTT_BORDA_SEMANA_ATUAL_CEL : { borderRight: '0.5px solid rgba(0,0,0,0.06)' })
                        }}
                      >
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                          {registrosDaCelulaOrdenados.map((reg, idx) => {
                            const nomeCasa =
                              (reg?.casa?.nome && String(reg.casa.nome).trim()) ||
                              (reg?.casas?.nome && String(reg.casas.nome).trim()) ||
                              (reg?.casa_id ? casas.find(c => String(c.id) === String(reg.casa_id))?.nome : '') ||
                              ''

                            // Se não achou nome, mostrar abreviação do casa_id (não '?')
                            const nomeCasaFinal = nomeCasa || (reg?.casa_id ? String(reg.casa_id).slice(0, 6) + '…' : '?')
                            const casaIndex = reg?.casa_id ? casas.findIndex(c => String(c.id) === String(reg.casa_id)) : -1
                            const cor = getCorCasa(casaIndex >= 0 ? casaIndex : idx)
                            const rowKeyReg = rowKeyMapaCronogramaReg(reg, l, acaoId)
                            const hReg = rowKeyReg ? (mapaHoras[rowKeyReg]?.[sn] ?? mapaHoras[rowKeyReg]?.[s] ?? null) : null
                            const numReg = hReg != null && Number(hReg) > 0 ? Number(hReg) : 0
                            const stReg = rowKeyReg ? (getStatusCelula(mapaStatus, rowKeyReg, sn) ?? getStatusCelula(mapaStatus, rowKeyReg, s) ?? null) : null
                            const statusReg = stReg || 'pendente'
                            const concluidoReg = cronogramaStatusEhConcluido(statusReg)
                            const noIntervaloPrevistoReg =
                              planejamentoCaiNaSemanaIso(reg, sn, semanas)
                            const clicavelReg = noIntervaloPrevistoReg || numReg > 0 || concluidoReg
                            let statusClassReg = 'gantt-bar-vazio'
                            if (concluidoReg) {
                              statusClassReg = 'gantt-bar-realizado'
                            } else if (numReg > 0 || noIntervaloPrevistoReg) {
                              if (semanaCorteAtrasado != null && sn < Number(semanaCorteAtrasado)) statusClassReg = 'gantt-bar-atrasado'
                              else statusClassReg = 'gantt-bar-planejado'
                            }
                            const atualPlanejadoReg = isAtual && statusClassReg === 'gantt-bar-planejado'
                            return (
                              <div
                                key={reg.id || idx}
                                style={{ cursor: clicavelReg ? 'pointer' : 'default', width: '100%' }}
                                onClick={clicavelReg ? e => {
                                  e.stopPropagation()
                                  const novoConcluido = !concluidoReg
                                  if (novoConcluido) {
                                    setTempoModalAberto(true)
                                    setTempoModalSemana(sn)
                                    setTempoModalAcaoId(reg.acao_id || acaoId)
                                    setTempoModalPlanejamentoId(reg.id || null)
                                    setTempoModalEstimado(l.tempoHoras ?? null)
                                    setTempoModalValor('')
                                    setTempoModalUnidade('horas')
                                  } else {
                                    salvarCelula(reg.acao_id || acaoId, sn, 0, false, { planejamentoId: reg.id })
                                  }
                                } : undefined}
                              >
                                {idx > 0 && (
                                  <div
                                    style={{
                                      width: 38,
                                      height: '0.5px',
                                      background: 'var(--color-border-tertiary)',
                                      margin: '1px 0'
                                    }}
                                  />
                                )}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                  {(() => {
                                    const pillEl = (
                                      <div
                                        className={`gantt-bar-pill ${statusClassReg}${atualPlanejadoReg ? ' gantt-bar-pill--semana-atual-planejada' : ''}`}
                                        style={{
                                          width: 38,
                                          height: 20,
                                          borderRadius: 3,
                                          cursor: clicavelReg ? 'pointer' : 'default',
                                          pointerEvents: 'none'
                                        }}
                                      >
                                        {concluidoReg ? <span className="gantt-bar-check">✓</span> : null}
                                      </div>
                                    )
                                    return envolverPillComentarioAcao(pillEl, sn, tipAcaoSemana)
                                  })()}
                                  {nomeCasaFinal && (
                                    <span
                                      style={{
                                        fontSize: 8,
                                        fontStyle: 'italic',
                                        fontWeight: 500,
                                        whiteSpace: 'nowrap',
                                        maxWidth: 80,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        textAlign: 'center',
                                        padding: '1px 5px',
                                        borderRadius: 3,
                                        background: cor.bg,
                                        color: cor.text
                                      }}
                                    >
                                      {nomeCasaFinal}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    )
                  }

                  if (layoutAdmMultilinha) {
                    const registrosDaCelulaOrdenados = [...registrosDaCelula].sort((a, b) => {
                      const metaA = admCnpjs.find(c => String(c.id) === String(a?.adm_cnpj_id || ''))
                      const metaB = admCnpjs.find(c => String(c.id) === String(b?.adm_cnpj_id || ''))
                      const da = String(metaA?.descritivo || metaA?.cnpj || '').toLowerCase()
                      const db = String(metaB?.descritivo || metaB?.cnpj || '').toLowerCase()
                      return da.localeCompare(db, 'pt-BR')
                    })

                    const clicavelCel = registrosDaCelulaOrdenados.some(reg => {
                      const rk = rowKeyMapaCronogramaReg(reg, l, acaoId)
                      const hh = rk ? (mapaHoras[rk]?.[sn] ?? mapaHoras[rk]?.[s] ?? null) : null
                      const ss = rk ? (getStatusCelula(mapaStatus, rk, sn) ?? getStatusCelula(mapaStatus, rk, s) ?? null) : null
                      const concl = cronogramaStatusEhConcluido(ss)
                      const noPlano = planejamentoCaiNaSemanaIso(reg, sn, semanas)
                      return noPlano || (hh != null && Number(hh) > 0) || concl
                    })

                    return (
                      <td
                        key={s}
                        className={`gantt-td-week gantt-bar-week-slot ${ganttCronogramaDensityClass}${isAtual ? ' gantt-col-semana-atual' : ''} ${!clicavelCel ? 'gantt-bar-no-click' : ''}`}
                        title={`Semana ${s}`}
                        style={{
                          minHeight: 44,
                          height: 'auto',
                          overflow: 'visible',
                          padding: '4px 2px',
                          boxSizing: 'border-box',
                          verticalAlign: 'middle',
                          textAlign: 'center',
                          ...(isAtual ? GANTT_BORDA_SEMANA_ATUAL_CEL : { borderRight: '0.5px solid rgba(0,0,0,0.06)' })
                        }}
                      >
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                          {registrosDaCelulaOrdenados.map((reg, idx) => {
                            const meta = admCnpjs.find(c => String(c.id) === String(reg?.adm_cnpj_id || ''))
                            const rowKeyReg = rowKeyMapaCronogramaReg(reg, l, acaoId)
                            const hReg = rowKeyReg ? (mapaHoras[rowKeyReg]?.[sn] ?? mapaHoras[rowKeyReg]?.[s] ?? null) : null
                            const numReg = hReg != null && Number(hReg) > 0 ? Number(hReg) : 0
                            const stReg = rowKeyReg ? (getStatusCelula(mapaStatus, rowKeyReg, sn) ?? getStatusCelula(mapaStatus, rowKeyReg, s) ?? null) : null
                            const statusReg = stReg || 'pendente'
                            const concluidoReg = cronogramaStatusEhConcluido(statusReg)
                            const noIntervaloPrevistoReg = planejamentoCaiNaSemanaIso(reg, sn, semanas)
                            const clicavelReg = noIntervaloPrevistoReg || numReg > 0 || concluidoReg
                            let statusClassReg = 'gantt-bar-vazio'
                            if (concluidoReg) {
                              statusClassReg = 'gantt-bar-realizado'
                            } else if (numReg > 0 || noIntervaloPrevistoReg) {
                              if (semanaCorteAtrasado != null && sn < Number(semanaCorteAtrasado)) statusClassReg = 'gantt-bar-atrasado'
                              else statusClassReg = 'gantt-bar-planejado'
                            }
                            const atualPlanejadoReg = isAtual && statusClassReg === 'gantt-bar-planejado'
                            const cnpjRaw = meta?.cnpj ? String(meta.cnpj).trim() : ''
                            const cnpjAbrev =
                              cnpjRaw.length > 3 ? `${cnpjRaw.slice(0, 3)}…` : cnpjRaw || '?'
                            const descTxt = meta?.descritivo ? String(meta.descritivo).trim() : ''
                            const titleCnpj = cnpjRaw && descTxt ? `${cnpjRaw} — ${descTxt}` : cnpjRaw || descTxt || '—'
                            return (
                              <div
                                key={reg.id ?? `adm-${idx}`}
                                style={{ cursor: clicavelReg ? 'pointer' : 'default', width: '100%' }}
                                onClick={clicavelReg ? e => {
                                  e.stopPropagation()
                                  const novoConcluido = !concluidoReg
                                  if (novoConcluido) {
                                    setTempoModalAberto(true)
                                    setTempoModalSemana(sn)
                                    setTempoModalAcaoId(reg.acao_id || acaoId)
                                    setTempoModalPlanejamentoId(reg.id || null)
                                    setTempoModalEstimado(l.tempoHoras ?? null)
                                    setTempoModalValor('')
                                    setTempoModalUnidade('horas')
                                  } else {
                                    salvarCelula(reg.acao_id || acaoId, sn, 0, false, { planejamentoId: reg.id })
                                  }
                                } : undefined}
                              >
                                {idx > 0 && (
                                  <div
                                    style={{
                                      width: 38,
                                      height: '0.5px',
                                      background: 'var(--color-border-tertiary)',
                                      margin: '1px 0'
                                    }}
                                  />
                                )}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                                  {envolverPillComentarioAcao(
                                    <div
                                      className={`gantt-bar-pill ${statusClassReg}${atualPlanejadoReg ? ' gantt-bar-pill--semana-atual-planejada' : ''}${tipAcaoSemana ? ' gantt-bar-pill--com-comentario' : ''}`}
                                      style={{
                                        width: 38,
                                        height: 20,
                                        borderRadius: 3,
                                        cursor: clicavelReg ? 'pointer' : 'default',
                                        pointerEvents: 'none',
                                        ...(tipAcaoSemana ? { position: 'relative', overflow: 'visible' } : null)
                                      }}
                                    >
                                      {concluidoReg ? <span className="gantt-bar-check">✓</span> : null}
                                    </div>,
                                    sn,
                                    tipAcaoSemana
                                  )}
                                  {cnpjAbrev ? (
                                    <span
                                      title={titleCnpj}
                                      style={{
                                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                        fontSize: 8,
                                        fontWeight: 600,
                                        lineHeight: 1.1,
                                        color: '#374151',
                                        maxWidth: 90,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        textAlign: 'center'
                                      }}
                                    >
                                      {cnpjAbrev}
                                    </span>
                                  ) : null}
                                  {descTxt ? (
                                    <span
                                      title={titleCnpj}
                                      style={{
                                        fontSize: 7,
                                        fontWeight: 500,
                                        fontStyle: 'italic',
                                        color: '#5F5E5A',
                                        lineHeight: 1.1,
                                        maxWidth: 90,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        textAlign: 'center'
                                      }}
                                    >
                                      {descTxt}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </td>
                    )
                  }

                  if (layoutControladoriaMultilinha) {
                    const registrosDaCelulaOrdenados = [...registrosDaCelulaCtrl].sort((a, b) => {
                      const metaA = controladoriaCnpjs.find(c => String(c.id) === String(a?.controladoria_cnpj_id || ''))
                      const metaB = controladoriaCnpjs.find(c => String(c.id) === String(b?.controladoria_cnpj_id || ''))
                      const da = String(metaA?.descritivo || metaA?.cnpj || '').toLowerCase()
                      const db = String(metaB?.descritivo || metaB?.cnpj || '').toLowerCase()
                      return da.localeCompare(db, 'pt-BR')
                    })

                    const clicavelCel = registrosDaCelulaOrdenados.some(reg => {
                      const rk = rowKeyMapaCronogramaReg(reg, l, acaoId)
                      const hh = rk ? (mapaHoras[rk]?.[sn] ?? mapaHoras[rk]?.[s] ?? null) : null
                      const ss = rk ? (getStatusCelula(mapaStatus, rk, sn) ?? getStatusCelula(mapaStatus, rk, s) ?? null) : null
                      const concl = cronogramaStatusEhConcluido(ss)
                      const noPlano = planejamentoCaiNaSemanaIso(reg, sn, semanas)
                      return noPlano || (hh != null && Number(hh) > 0) || concl
                    })

                    return (
                      <td
                        key={s}
                        className={`gantt-td-week gantt-bar-week-slot ${ganttCronogramaDensityClass}${isAtual ? ' gantt-col-semana-atual' : ''} ${!clicavelCel ? 'gantt-bar-no-click' : ''}`}
                        title={`Semana ${s}`}
                        style={{
                          minHeight: 44,
                          height: 'auto',
                          overflow: 'visible',
                          padding: '4px 2px',
                          boxSizing: 'border-box',
                          verticalAlign: 'middle',
                          textAlign: 'center',
                          ...(isAtual ? GANTT_BORDA_SEMANA_ATUAL_CEL : { borderRight: '0.5px solid rgba(0,0,0,0.06)' })
                        }}
                      >
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                          {registrosDaCelulaOrdenados.map((reg, idx) => {
                            const meta = controladoriaCnpjs.find(c => String(c.id) === String(reg?.controladoria_cnpj_id || ''))
                            const rowKeyReg = rowKeyMapaCronogramaReg(reg, l, acaoId)
                            const hReg = rowKeyReg ? (mapaHoras[rowKeyReg]?.[sn] ?? mapaHoras[rowKeyReg]?.[s] ?? null) : null
                            const numReg = hReg != null && Number(hReg) > 0 ? Number(hReg) : 0
                            const stReg = rowKeyReg ? (getStatusCelula(mapaStatus, rowKeyReg, sn) ?? getStatusCelula(mapaStatus, rowKeyReg, s) ?? null) : null
                            const statusReg = stReg || 'pendente'
                            const concluidoReg = cronogramaStatusEhConcluido(statusReg)
                            const noIntervaloPrevistoReg = planejamentoCaiNaSemanaIso(reg, sn, semanas)
                            const clicavelReg = noIntervaloPrevistoReg || numReg > 0 || concluidoReg
                            let statusClassReg = 'gantt-bar-vazio'
                            if (concluidoReg) {
                              statusClassReg = 'gantt-bar-realizado'
                            } else if (numReg > 0 || noIntervaloPrevistoReg) {
                              if (semanaCorteAtrasado != null && sn < Number(semanaCorteAtrasado)) statusClassReg = 'gantt-bar-atrasado'
                              else statusClassReg = 'gantt-bar-planejado'
                            }
                            const atualPlanejadoReg = isAtual && statusClassReg === 'gantt-bar-planejado'
                            const cnpjRaw = meta?.cnpj ? String(meta.cnpj).trim() : ''
                            const cnpjAbrev = cnpjRaw.length > 3 ? `${cnpjRaw.slice(0, 3)}…` : cnpjRaw
                            const descTxt = meta?.descritivo ? String(meta.descritivo).trim() : ''
                            const titleCnpj = cnpjRaw && descTxt ? `${cnpjRaw} — ${descTxt}` : cnpjRaw || descTxt || ''
                            return (
                              <div
                                key={reg.id ?? `ctrl-${idx}`}
                                style={{ cursor: clicavelReg ? 'pointer' : 'default', width: '100%' }}
                                onClick={clicavelReg ? e => {
                                  e.stopPropagation()
                                  const novoConcluido = !concluidoReg
                                  if (novoConcluido) {
                                    setTempoModalAberto(true)
                                    setTempoModalSemana(sn)
                                    setTempoModalAcaoId(reg.acao_id || acaoId)
                                    setTempoModalPlanejamentoId(reg.id || null)
                                    setTempoModalEstimado(l.tempoHoras ?? null)
                                    setTempoModalValor('')
                                    setTempoModalUnidade('horas')
                                  } else {
                                    salvarCelula(reg.acao_id || acaoId, sn, 0, false, { planejamentoId: reg.id })
                                  }
                                } : undefined}
                              >
                                {idx > 0 && (
                                  <div
                                    style={{
                                      width: 38,
                                      height: '0.5px',
                                      background: 'var(--color-border-tertiary)',
                                      margin: '1px 0'
                                    }}
                                  />
                                )}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                                  {envolverPillComentarioAcao(
                                    <div
                                      className={`gantt-bar-pill ${statusClassReg}${atualPlanejadoReg ? ' gantt-bar-pill--semana-atual-planejada' : ''}${tipAcaoSemana ? ' gantt-bar-pill--com-comentario' : ''}`}
                                      style={{
                                        width: 38,
                                        height: 20,
                                        borderRadius: 3,
                                        cursor: clicavelReg ? 'pointer' : 'default',
                                        pointerEvents: 'none',
                                        ...(tipAcaoSemana ? { position: 'relative', overflow: 'visible' } : null)
                                      }}
                                    >
                                      {concluidoReg ? <span className="gantt-bar-check">✓</span> : null}
                                    </div>,
                                    sn,
                                    tipAcaoSemana
                                  )}
                                  {cnpjAbrev ? (
                                    <span
                                      title={titleCnpj}
                                      style={{
                                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                        fontSize: 8,
                                        fontWeight: 600,
                                        lineHeight: 1.1,
                                        color: '#374151',
                                        maxWidth: 90,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        textAlign: 'center'
                                      }}
                                    >
                                      {cnpjAbrev}
                                    </span>
                                  ) : null}
                                  {descTxt ? (
                                    <span
                                      title={titleCnpj}
                                      style={{
                                        fontSize: 7,
                                        fontWeight: 500,
                                        fontStyle: 'italic',
                                        color: '#5F5E5A',
                                        lineHeight: 1.1,
                                        maxWidth: 90,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        textAlign: 'center'
                                      }}
                                    >
                                      {descTxt}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </td>
                    )
                  }

                  if (layoutJuridicoMultilinha) {
                    const registrosDaCelulaOrdenados = [...registrosDaCelula].sort((a, b) => {
                      const nomeA = String(
                        juridicoIdentMap.get(String(a?.juridico_identificacao_id || ''))?.nome || ''
                      ).toLowerCase()
                      const nomeB = String(
                        juridicoIdentMap.get(String(b?.juridico_identificacao_id || ''))?.nome || ''
                      ).toLowerCase()
                      return nomeA.localeCompare(nomeB, 'pt-BR')
                    })
                    const clicavelCel = registrosDaCelula.some(reg => {
                      const rk = rowKeyMapaCronogramaReg(reg, l, acaoId)
                      const hh = rk ? (mapaHoras[rk]?.[sn] ?? mapaHoras[rk]?.[s] ?? null) : null
                      const ss = rk ? (getStatusCelula(mapaStatus, rk, sn) ?? getStatusCelula(mapaStatus, rk, s) ?? null) : null
                      const concl = cronogramaStatusEhConcluido(ss)
                      const noPlano = planejamentoCaiNaSemanaIso(reg, sn, semanas)
                      return noPlano || (hh != null && Number(hh) > 0) || concl
                    })
                    return (
                      <td
                        key={s}
                        className={`gantt-td-week gantt-bar-week-slot ${ganttCronogramaDensityClass}${isAtual ? ' gantt-col-semana-atual' : ''} ${!clicavelCel ? 'gantt-bar-no-click' : ''}`}
                        title={`Semana ${s}`}
                        style={{
                          minHeight: 44,
                          height: 'auto',
                          overflow: 'visible',
                          padding: '4px 2px',
                          boxSizing: 'border-box',
                          verticalAlign: 'middle',
                          textAlign: 'center',
                          ...(isAtual ? GANTT_BORDA_SEMANA_ATUAL_CEL : { borderRight: '0.5px solid rgba(0,0,0,0.06)' })
                        }}
                      >
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                          {registrosDaCelulaOrdenados.map((reg, idx) => {
                            const ident = juridicoIdentMap.get(String(reg?.juridico_identificacao_id || ''))
                            const nomeIdent = ident?.nome ? String(ident.nome).trim() : ''
                            const tipoTxt = labelJuridicoTipo(reg?.juridico_tipo || ident?.tipo)
                            const rowKeyReg = rowKeyMapaCronogramaReg(reg, l, acaoId)
                            const hReg = rowKeyReg ? (mapaHoras[rowKeyReg]?.[sn] ?? mapaHoras[rowKeyReg]?.[s] ?? null) : null
                            const numReg = hReg != null && Number(hReg) > 0 ? Number(hReg) : 0
                            const stReg = rowKeyReg ? (getStatusCelula(mapaStatus, rowKeyReg, sn) ?? getStatusCelula(mapaStatus, rowKeyReg, s) ?? null) : null
                            const statusReg = stReg || 'pendente'
                            const concluidoReg = cronogramaStatusEhConcluido(statusReg)
                            const noIntervaloPrevistoReg = planejamentoCaiNaSemanaIso(reg, sn, semanas)
                            const clicavelReg = noIntervaloPrevistoReg || numReg > 0 || concluidoReg
                            let statusClassReg = 'gantt-bar-vazio'
                            if (concluidoReg) {
                              statusClassReg = 'gantt-bar-realizado'
                            } else if (numReg > 0 || noIntervaloPrevistoReg) {
                              if (semanaCorteAtrasado != null && sn < Number(semanaCorteAtrasado)) statusClassReg = 'gantt-bar-atrasado'
                              else statusClassReg = 'gantt-bar-planejado'
                            }
                            const atualPlanejadoReg = isAtual && statusClassReg === 'gantt-bar-planejado'
                            return (
                              <div
                                key={reg.id ?? `jur-${idx}`}
                                style={{ cursor: clicavelReg ? 'pointer' : 'default', width: '100%' }}
                                onClick={clicavelReg ? e => {
                                  e.stopPropagation()
                                  const novoConcluido = !concluidoReg
                                  if (novoConcluido) {
                                    setTempoModalAberto(true)
                                    setTempoModalSemana(sn)
                                    setTempoModalAcaoId(reg.acao_id || acaoId)
                                    setTempoModalPlanejamentoId(reg.id || null)
                                    setTempoModalEstimado(l.tempoHoras ?? null)
                                    setTempoModalValor('')
                                    setTempoModalUnidade('horas')
                                  } else {
                                    salvarCelula(reg.acao_id || acaoId, sn, 0, false, { planejamentoId: reg.id })
                                  }
                                } : undefined}
                              >
                                {idx > 0 && (
                                  <div
                                    style={{
                                      width: 38,
                                      height: '0.5px',
                                      background: 'var(--color-border-tertiary)',
                                      margin: '1px 0'
                                    }}
                                  />
                                )}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                                  {envolverPillComentarioAcao(
                                    <div
                                      className={`gantt-bar-pill ${statusClassReg}${atualPlanejadoReg ? ' gantt-bar-pill--semana-atual-planejada' : ''}${tipAcaoSemana ? ' gantt-bar-pill--com-comentario' : ''}`}
                                      style={{
                                        width: 38,
                                        height: 20,
                                        borderRadius: 3,
                                        cursor: clicavelReg ? 'pointer' : 'default',
                                        pointerEvents: 'none',
                                        ...(tipAcaoSemana ? { position: 'relative', overflow: 'visible' } : null)
                                      }}
                                    >
                                      {concluidoReg ? <span className="gantt-bar-check">✓</span> : null}
                                    </div>,
                                    sn,
                                    tipAcaoSemana
                                  )}
                                  {nomeIdent ? (
                                    <span title={nomeIdent} style={TAG_FRANQUEADO_STYLE}>
                                      {nomeIdent}
                                    </span>
                                  ) : null}
                                  {tipoTxt ? (
                                    <span
                                      style={{
                                        fontSize: 7,
                                        fontWeight: 500,
                                        color: '#5F5E5A',
                                        lineHeight: 1.1,
                                        textAlign: 'center',
                                        maxWidth: 80,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                      }}
                                    >
                                      {tipoTxt}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </td>
                    )
                  }

                  return (
                    <td
                      key={s}
                      className={`gantt-td-week gantt-bar-week-slot ${ganttCronogramaDensityClass}${isAtual ? ' gantt-col-semana-atual' : ''} ${!clicavel ? 'gantt-bar-no-click' : ''}`}
                      title={clicavel ? (concluido ? `Realizado (clique para desmarcar)` : `Clique para marcar como realizado`) : `Semana ${s}`}
                      style={
                        isAreaFranqueado || isAreaPortfolio
                          ? {
                              minHeight: 44,
                              height: 'auto',
                              overflow: 'visible',
                              padding: '6px 4px',
                              boxSizing: 'border-box',
                              verticalAlign: 'middle',
                              textAlign: 'center',
                              ...(isAtual ? GANTT_BORDA_SEMANA_ATUAL_CEL : { borderRight: '0.5px solid rgba(0,0,0,0.06)' }),
                              cursor: clicavel ? 'pointer' : undefined
                            }
                          : {
                              verticalAlign: 'middle',
                              textAlign: 'center',
                              ...(isAtual ? GANTT_BORDA_SEMANA_ATUAL_CEL : { borderRight: '0.5px solid rgba(0,0,0,0.06)' }),
                              cursor: clicavel ? 'pointer' : undefined,
                              ...(tipAcaoSemana ? { overflow: 'visible' } : null)
                            }
                      }
                      onClick={clicavel ? () => {
                        const novoConcluido = !concluido
                        if (novoConcluido) {
                          setTempoModalAberto(true)
                          setTempoModalSemana(sn)
                          setTempoModalAcaoId(acaoId)
                          setTempoModalPlanejamentoId(pidUnico)
                          setTempoModalEstimado(l.tempoHoras ?? null)
                          setTempoModalValor('')
                          setTempoModalUnidade('horas')
                        } else {
                          salvarCelula(acaoId, sn, 0, false, pidUnico ? { planejamentoId: pidUnico } : {})
                        }
                      } : undefined}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        {(() => {
                          const pillEl = (
                            <div
                              className={`gantt-bar-pill ${statusClass}${atualPlanejado ? ' gantt-bar-pill--semana-atual-planejada' : ''}${tipAcaoSemana ? ' gantt-bar-pill--com-comentario' : ''}`}
                              style={tipAcaoSemana ? { position: 'relative', overflow: 'visible' } : undefined}
                            >
                              {concluido ? <span className="gantt-bar-check">✓</span> : null}
                            </div>
                          )
                          return envolverPillComentarioAcao(pillEl, sn, tipAcaoSemana)
                        })()}
                        {isAreaCasa &&
                          (() => {
                            const nomeCasaUnico =
                              (registroUnico?.casas?.nome && String(registroUnico.casas.nome).trim()) ||
                              (registroUnico?.casa_id
                                ? casas.find(c => String(c.id) === String(registroUnico.casa_id))?.nome
                                : '') ||
                              ''
                            if (!nomeCasaUnico) return null
                            const idx = casas.findIndex(c => String(c.id) === String(registroUnico.casa_id))
                            const cor = getCorCasa(idx >= 0 ? idx : 0)
                            return (
                              <span
                                style={{
                                  fontSize: 8,
                                  fontStyle: 'italic',
                                  fontWeight: 500,
                                  whiteSpace: 'nowrap',
                                  maxWidth: 80,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  textAlign: 'center',
                                  padding: '1px 5px',
                                  borderRadius: 3,
                                  background: cor.bg,
                                  color: cor.text
                                }}
                              >
                                {nomeCasaUnico}
                              </span>
                            )
                          })()}
                        {isAreaJuridico &&
                          (() => {
                            const ident = juridicoIdentMap.get(String(registroUnico?.juridico_identificacao_id || ''))
                            const nomeIdent = ident?.nome ? String(ident.nome).trim() : ''
                            const tipoTxt = labelJuridicoTipo(registroUnico?.juridico_tipo || ident?.tipo)
                            if (!nomeIdent && !tipoTxt) return null
                            return (
                              <>
                                {nomeIdent ? (
                                  <span title={nomeIdent} style={TAG_FRANQUEADO_STYLE}>
                                    {nomeIdent}
                                  </span>
                                ) : null}
                                {tipoTxt ? (
                                  <span
                                    style={{
                                      fontSize: 7,
                                      fontWeight: 500,
                                      color: '#5F5E5A',
                                      lineHeight: 1.1,
                                      textAlign: 'center',
                                      maxWidth: 80,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    {tipoTxt}
                                  </span>
                                ) : null}
                              </>
                            )
                          })()}
                      </div>
                    </td>
                  )
                })}
          {l.esconderAcoes ? null : (
          <td
            className="gantt-td-acoes"
            rowSpan={l.temSublinhas ? l.grupoTotal : undefined}
            style={{
              background: isAcaoAltR ? '#fafafa' : 'var(--color-background-primary, #ffffff)',
              padding: '5px 6px',
              verticalAlign: 'middle',
              textAlign: 'center'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {acaoId ? (
                <button
                  type="button"
                  className={`gantt-btn-dots${acaoIdsComComentario.has(acaoId) ? ' gantt-btn-dots--ativo' : ''}`}
                  onClick={() =>
                    setComentarioModal({ tipo: 'atividade', referenciaId: acaoId, nome: l.nome || '—' })
                  }
                >
                  ···
                </button>
              ) : null}
              {l.planejamentoId && !metaFechada ? (
                <>
                  {(() => {
                    const semanaLimite = semanaAtual != null ? semanaAtual - 2 : null
                    const todasSemanas = l.grupoSemanas || l.semanasSelecionadas || []
                    const todasAntigas = semanaLimite != null &&
                      todasSemanas.length > 0 &&
                      todasSemanas.every(s => Number(s) < semanaLimite)
                    const bloqueado = !isAdmin && todasAntigas
                    const removendo = (l.planejamentoIds || [l.planejamentoId]).some(id => id === removendoId)
                    const titleBloqueado = 'Edição não permitida para semanas anteriores. Solicite ao admin.'
                    return (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            if (bloqueado) return
                            const rows = l.grupoRows || l.planejamentoRows || []
                            if (rows.length > 1) {
                              setModalSelecionarRegistro({ linha: l, rows })
                            } else {
                              abrirDrawerEditarPlanejamento(l)
                            }
                          }}
                          title={bloqueado ? titleBloqueado : 'Editar'}
                          style={{
                            ...GANTT_ACAO_BTN_EDITAR,
                            ...(bloqueado ? { opacity: 0.3, cursor: 'not-allowed', pointerEvents: 'none' } : {})
                          }}
                        >
                          ✎
                        </button>
                        {podeExibirExcluirComHistorico(isAdmin, linhaTemHistoricoPreenchido(l, cronograma)) ? (
                        <button
                          type="button"
                          disabled={removendo || bloqueado}
                          onClick={() => { if (!bloqueado) solicitarRemocaoAtividade(l) }}
                          title={bloqueado ? titleBloqueado : 'Excluir'}
                          style={{
                            ...GANTT_ACAO_BTN_EXCLUIR,
                            opacity: bloqueado ? 0.3 : removendo ? 0.55 : 1,
                            cursor: removendo || bloqueado ? 'not-allowed' : 'pointer',
                            ...(bloqueado ? { pointerEvents: 'none' } : {})
                          }}
                        >
                          {removendo ? '…' : '×'}
                        </button>
                        ) : null}
                      </>
                    )
                  })()}
                </>
              ) : null}
            </div>
          </td>
          )}
        </tr>
      )
    })
    /** Indicadores: um bloco único (faixa + colunas) após todas as atividades. */
    montarBlocoIndicadoresUnificado()
    return { tableRows }
  }, [
    areaId,
    pastelariaGantt.rows,
    linhasFiltradas,
    filtroResponsavelId,
    areaPessoasLista,
    temAlgumIndicadorNaGrade,
    indicadoresPorObjetivo,
    lancamentosPorIndicador,
    semanas,
    semanaAtual,
    ganttCronogramaDensityClass,
    mapaHoras,
    mapaStatus,
    removendoId,
    metasObjetivos,
    metaTemAtividadesNoPlano,
    salvarLancamento,
    salvarCelula,
    removerAtividade,
    abrirDrawerEditarPlanejamento,
    solicitarRemocaoAtividade,
    isAdmin,
    cronograma,
    isAreaFranqueado,
    franqueadosAtivos,
    isAreaPortfolio,
    portfolioFranqueados,
    isAreaComercial,
    comercialCandidatos,
    isAreaCasa,
    isAreaAdm,
    admCnpjs,
    isAreaControladoria,
    controladoriaCnpjs,
    isAreaJuridico,
    juridicoIdentMap,
    casas,
    periodo,
    textoComentarioAcaoCell,
    textoComentarioIndicadorCell,
    acaoIdsComComentario,
    indicadorIdsComComentario,
    setComentarioModal,
    abrirModalConclusaoIndicador,
    concluindoMetaId
  ])

  return (
    <div className="gantt-page-moni">
      <style suppressHydrationWarning>{`
        .gantt-page-moni {
          box-sizing: border-box;
        }
        .gantt-page-moni .gantt-page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 18px;
        }
        .gantt-page-moni .gantt-page-header__left {
          min-width: 0;
          flex: 1 1 240px;
        }
        .gantt-page-moni .gantt-page-header__right {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
          flex-shrink: 0;
        }
        .gantt-page-moni .gantt-page-header__area-wrap {
          display: flex;
          align-items: center;
          gap: 6px;
          padding-left: 10px;
          border-left: 1px solid #e0d9ce;
        }
        .gantt-page-moni .gantt-page-header .workload-add-comp-btn {
          background: #2F4A3A;
          color: #D4EDAA;
          font-size: 13px;
          font-weight: 500;
          padding: 8px 16px;
          border-radius: 6px;
          border: none;
          height: auto;
          min-height: 0;
          white-space: nowrap;
        }
        .gantt-page-moni .gantt-page-header .workload-add-comp-btn:hover {
          background: #1D2F25;
          color: #D4EDAA;
        }
        .gantt-page-moni .gantt-page-header__area-label {
          font-size: 13px;
          font-weight: 400;
          color: #888780;
          margin: 0;
          white-space: nowrap;
        }
        .gantt-page-moni .gantt-page-header__area-select {
          font-size: 13px;
          border: 0.5px solid #e0d9ce;
          border-radius: 6px;
          padding: 6px 10px;
          height: auto;
          min-height: 0;
          min-width: 160px;
          box-sizing: border-box;
          background: #ffffff;
          color: #1D2F25;
        }
        .gantt-page-moni .gantt-metas-grid {
          gap: 10px;
        }
        .gantt-page-moni .gantt-meta-card:not(.gantt-meta-card--concluida) {
          padding: 12px 14px;
          background: #2F4A3A;
        }
        .gantt-page-moni .gantt-meta-card-nome {
          font-size: 13px;
          font-weight: 600;
        }
        .gantt-page-moni .gantt-meta-card-prazo {
          font-size: 11px;
        }
        .gantt-page-moni .gantt-toolbar.gantt-controls-row,
        .gantt-page-moni .gantt-toolbar-left.gantt-controls-row-left,
        .gantt-page-moni .gantt-toolbar-right.gantt-controls-row-right {
          align-items: center;
          gap: 12px;
        }
        .gantt-page-moni .gantt-toolbar-periodos {
          display: flex;
          gap: 12px;
          align-items: flex-end;
          flex-wrap: wrap;
        }
        .gantt-page-moni .gantt-toolbar-periodos .periodo-select-root {
          display: flex;
          gap: 12px;
          align-items: flex-end;
          flex-wrap: wrap;
        }
        .gantt-page-moni .gantt-toolbar-periodos .periodo-select-root .form-group {
          display: flex;
          flex-direction: column;
          margin: 0;
          min-width: 0;
        }
        .gantt-page-moni .gantt-toolbar-periodos .periodo-select-root .form-group label {
          font-size: 12px;
          color: #888780;
          margin-bottom: 4px;
        }
        .gantt-page-moni .gantt-toolbar-periodos .periodo-select-root select {
          font-size: 13px;
          border: 0.5px solid #e0d9ce;
          border-radius: 6px;
          padding: 6px 10px;
          height: auto;
          min-height: 0;
          box-sizing: border-box;
          background: #ffffff;
        }
        .gantt-page-moni .gantt-toolbar-periodos > .form-group {
          display: flex;
          flex-direction: column;
          margin: 0;
          min-width: 0;
        }
        .gantt-page-moni .gantt-toolbar-periodos > .form-group label {
          font-size: 12px;
          color: #888780;
          margin-bottom: 4px;
        }
        .gantt-page-moni .gantt-toolbar-periodos > .form-group select {
          font-size: 13px;
          border: 0.5px solid #e0d9ce;
          border-radius: 6px;
          padding: 6px 10px;
          height: auto;
          min-height: 0;
          box-sizing: border-box;
          background: #ffffff;
        }
        .gantt-page-moni .gantt-legend.gantt-legend--toolbar {
          font-size: 11px;
          gap: 10px;
        }
        .gantt-page-moni .gantt-toolbar-add-btn {
          background: #2F4A3A;
          color: #D4EDAA;
          font-size: 13px;
          font-weight: 500;
          padding: 8px 16px;
          border-radius: 6px;
          border: none;
          height: auto;
          min-height: 0;
        }
        .gantt-page-moni .gantt-toolbar-add-btn:hover:not(:disabled) {
          background: #1D2F25;
        }
        .gantt-page-moni .gantt-planejamento-table thead tr:first-child th {
          font-size: 11px !important;
          font-weight: 600 !important;
          padding: 7px 8px !important;
        }
        .gantt-page-moni .gantt-planejamento-table thead tr:first-child th:first-child,
        .gantt-page-moni .gantt-planejamento-table thead tr:first-child th:nth-child(2),
        .gantt-page-moni .gantt-planejamento-table thead tr:first-child th:last-child {
          font-size: 10px !important;
        }
        .gantt-page-moni .gantt-planejamento-table thead th span {
          font-size: 9px !important;
          font-weight: 400 !important;
        }
        .gantt-page-moni .gantt-shell-row--acao .gantt-shell-cell--atividade,
        .gantt-page-moni .gantt-shell-row--acao .gantt-shell-cell--atividade .gantt-nome-acao {
          font-size: 13px;
        }
        .gantt-page-moni .gantt-shell-row--acao .gantt-shell-cell--responsavel {
          font-size: 12px;
          color: #888780;
        }
        .gantt-page-moni .gantt-tr--meta .gantt-shell-cell--atividade,
        .gantt-page-moni .gantt-tr--meta .gantt-shell-cell--responsavel {
          padding: 7px 10px;
        }
        .gantt-page-moni .gantt-tr--meta .gantt-meta-nome,
        .gantt-page-moni .gantt-tr--meta .gantt-meta-prazo {
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.02em;
        }
        .gantt-page-moni .gantt-tr--ind-caption td,
        .gantt-page-moni .gantt-td-ind-caption {
          background: #0C2633;
          color: #F5F2EE;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 7px 12px;
          border-bottom: 1.5px solid #3e7490;
        }
        .gantt-page-moni .gantt-tr--ind-subhdr td,
        .gantt-page-moni .gantt-td-subhdr {
          background: #0e3a4e;
          color: rgba(245,242,238,0.75);
          font-size: 11px;
          font-weight: 600;
          padding: 6px 8px;
          border-bottom: 1px solid #3e7490;
        }
        .gantt-page-moni .gantt-shell-row--grupo .gantt-nome-comportamento {
          font-size: 13px;
          color: #1D2F25;
        }
        .gantt-page-moni .gantt-shell-row--acao .gantt-nome-acao {
          font-size: 12px;
          color: #5f5e5a;
        }
      `}</style>
      {indicadorFeedback?.type === 'error' && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            top: 16,
            right: 16,
            zIndex: 100001,
            maxWidth: 320,
            padding: '12px 14px',
            background: '#3d1f1f',
            color: '#fde8e8',
            borderRadius: 8,
            fontSize: 13,
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }}
        >
          <div>{indicadorFeedback.message}</div>
          {(erroIndicaColunaPeriodoIdLancamentos({ message: indicadorFeedback.message }) ||
            erroIndicaColunaSemanaAnoLancamentos({ message: indicadorFeedback.message })) && (
            <p style={{ margin: '10px 0 0', fontSize: 12, lineHeight: 1.4, opacity: 0.95 }}>
              Opcional: no Supabase → SQL Editor, rode{' '}
              <code style={{ fontSize: 11 }}>ALTER TABLE indicador_lancamentos ADD COLUMN IF NOT EXISTS periodo_id uuid REFERENCES periodos(id) ON DELETE SET NULL;</code>
              {' '}e/ou{' '}
              <code style={{ fontSize: 11 }}>semana_ano int</code>, depois recarregue. Sem essas colunas, o app grava com{' '}
              <code style={{ fontSize: 11 }}>semana</code> (ISO).
            </p>
          )}
        </div>
      )}
      {indicadorFeedback?.type === 'success' && (
        <div
          role="status"
          style={{
            position: 'fixed',
            top: 16,
            right: 16,
            zIndex: 100001,
            maxWidth: 320,
            padding: '12px 14px',
            background: '#1a3d2a',
            color: '#d8f5e4',
            borderRadius: 8,
            fontSize: 13,
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }}
        >
          {indicadorFeedback.message}
        </div>
      )}
      <header className="gantt-page-header">
        <div className="gantt-page-header__left">
          <h1 className="carometro-page-title">Planejamento (Gantt)</h1>
          <p className="carometro-page-subtitle">
            De acordo com as metas estabelecidas faça monte o seu plano tático, preencha o andamento e os indicadores.
          </p>
        </div>
        <div className="gantt-page-header__right">
          {isAdmin && (
          <button
            type="button"
            className="workload-add-comp-btn"
            onClick={abrirMetaModalGantt}
          >
            Definir metas
          </button>
          )}
          <div className="gantt-page-header__area-wrap">
            <label className="gantt-page-header__area-label" htmlFor="gantt-headline-area-select">Área</label>
            <select
              id="gantt-headline-area-select"
              className="gantt-page-header__area-select"
              value={areaId}
              onChange={e => { setError(null); setAreaId(e.target.value); localStorage.setItem('carometro_ultima_area', e.target.value) }}
              aria-label="Área"
            >
              <option value="">Selecione</option>
              {areas.map(a => (
                <option key={a.id} value={a.id}>{a.nome}</option>
              ))}
            </select>
          </div>
        </div>
      </header>
      {isAreaAdm && admCnpjsTabelaAusente && (
        <div className="alert alert-warning gantt-adm-cnpjs-sql-banner" role="status" style={{ margin: '0 0 1rem' }}>
          <p style={{ margin: '0 0 0.75rem' }}>
            <strong>Tabela <code>adm_cnpjs</code> não encontrada no Supabase.</strong>{' '}
            Sem ela, não é possível cadastrar CNPJ/empresa no planejamento ADM. No painel do projeto:{' '}
            <strong>SQL Editor</strong> → cole o script abaixo (ou o arquivo{' '}
            <code>supabase/migrations/221_adm_cnpjs.sql</code>) → <strong>Run</strong> → recarregue esta página (F5).
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                navigator.clipboard.writeText(SQL_ADM_CNPJS).then(() => {
                  window.alert('SQL copiado. Cole no Supabase → SQL Editor, execute (Run) e recarregue a página (F5).')
                }).catch(() => {
                  window.alert('Não foi possível copiar. Abra supabase/migrations/221_adm_cnpjs.sql e cole manualmente no SQL Editor.')
                })
              }}
            >
              Copiar SQL (adm_cnpjs + FK)
            </button>
          </div>
        </div>
      )}
      {areaPessoasTabelaAusente && (
        <div className="alert alert-warning gantt-area-pessoas-sql-banner" role="status" style={{ margin: '0 0 1rem' }}>
          <p style={{ margin: '0 0 0.75rem' }}>
            <strong>Tabela <code>area_pessoas</code> não encontrada no Supabase.</strong>{' '}
            Sem ela, a lista de responsáveis fica vazia e novos nomes não são gravados. No painel do projeto:{' '}
            <strong>SQL Editor</strong> → cole o script abaixo (ou o arquivo <code>supabase-area-pessoas.sql</code>) → <strong>Run</strong> → recarregue esta página.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                navigator.clipboard.writeText(SQL_AREA_PESSOAS).then(() => {
                  window.alert('SQL copiado. Cole no Supabase → SQL Editor, execute (Run) e recarregue a página.')
                }).catch(() => {
                  window.alert('Não foi possível copiar. Abra o arquivo supabase-area-pessoas.sql no projeto e cole manualmente no SQL Editor.')
                })
              }}
            >
              Copiar SQL (criar tabela + políticas)
            </button>
          </div>
        </div>
      )}
      <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={() => {
            const next = !metasExpandidas
            setMetasExpandidas(next)
            try { localStorage.setItem('gantt_metas_expandidas', String(next)) } catch {}
          }}
          style={{
            background: 'transparent',
            border: '0.5px solid var(--color-border-secondary)',
            borderRadius: 6,
            fontSize: 11,
            color: 'var(--color-text-secondary)',
            padding: '3px 10px',
            cursor: 'pointer',
            marginBottom: 6,
            alignSelf: 'flex-end'
          }}
        >
          {metasExpandidas ? '⌄ Ocultar metas' : '› Exibir metas'}
        </button>
      </div>
      {!metasExpandidas && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          {(() => {
            const metasFiltradas = (metasObjetivos || []).filter(m => metaDeveAparecerNoPeriodo(m, minSemanaVisivel))
            const visiveis = metasFiltradas.slice(0, 5)
            const resto = metasFiltradas.length - 5
            return (
              <>
                {visiveis.map(m => (
                  <span key={m.id} style={{ background: '#1C3A2B', color: '#9FE1CB', fontSize: 11, padding: '2px 10px', borderRadius: 20 }}>
                    {(() => {
                      const nome = String(m.descricao || '—').trim()
                      const curto = nome.length > 22 ? nome.slice(0, 22) + '…' : nome
                      const prazo = formatoPrazoMeta(m).replace('Prazo: ', '')
                      return prazo && prazo !== '—' ? curto + ' · ' + prazo : curto
                    })()}
                  </span>
                ))}
                {resto > 0 && (
                  <span style={{ background: '#1C3A2B', color: '#9FE1CB', fontSize: 11, padding: '2px 10px', borderRadius: 20, opacity: 0.7 }}>
                    +{resto} mais
                  </span>
                )}
              </>
            )
          })()}
        </div>
      )}
      <section className="gantt-metas-panel" aria-label="Metas da área selecionada" style={!metasExpandidas ? { display: 'none' } : undefined}>
        {metasObjetivosLoading ? (
          <p className="gantt-metas-empty">Carregando…</p>
        ) : metasObjetivos.length === 0 ? (
          <p className="gantt-metas-empty">Sem metas definidas</p>
        ) : (
          <div className="gantt-metas-grid">
            {metasObjetivos
              .filter(m => metaDeveAparecerNoPeriodo(m, minSemanaVisivel))
              .slice()
              .sort((a, b) => {
                const wa = extrairSemanaPrazoMeta(a)
                const wb = extrairSemanaPrazoMeta(b)
                if (wa != null && wb != null) return wa - wb
                if (wa != null) return -1
                if (wb != null) return 1
                return String(a?.descricao || '').localeCompare(String(b?.descricao || ''), 'pt-BR', { sensitivity: 'base' })
              })
              .map((m) => (
              (() => {
                const concluida = metaConcluida(m)
                const semanaConc = semanaConclusaoLabel(m)
                return (
              <div
                key={m.id}
                className={`gantt-meta-card${concluida ? ' gantt-meta-card--concluida' : ''}`}
                style={{
                  ...(concluida
                    ? {
                        background: '#e8ecef',
                        color: '#1f2937',
                        border: '0.5px solid #d1d5db',
                        opacity: 0.88
                      }
                    : null)
                }}
              >
                <span
                  className="gantt-meta-card-nome"
                  title={(m.descricao || '—').trim() || undefined}
                  style={concluida ? { color: '#888780', textDecoration: 'line-through' } : undefined}
                >
                  {m.descricao || '—'}
                </span>
                <div className="gantt-meta-card-right" style={concluida ? { color: '#1f2937' } : undefined}>
                  {concluida && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        background: 'rgba(0,0,0,0.08)',
                        color: '#374151',
                        borderRadius: 8,
                        padding: '1px 8px',
                        fontSize: 10,
                        marginBottom: 4,
                        whiteSpace: 'nowrap'
                      }}
                      title="Meta concluída"
                    >
                      ✓ Concluído{semanaConc ? ` · ${semanaConc}` : ''}
                    </span>
                  )}
                  <span className="gantt-meta-card-prazo" style={concluida ? { color: '#6b7280' } : undefined}>
                    {formatoPrazoMeta(m)}
                  </span>
                  <div className="gantt-meta-card-actions">
                    {isAdmin && metaConcluida(m) && (
                      <button
                        type="button"
                        onClick={() => void handleReverterConclusao(m)}
                        title="Reverter conclusão (admin)"
                        disabled={concluindoMetaId === m.id}
                        style={{
                          background: 'transparent',
                          border: '0.5px solid #F09595',
                          borderRadius: 4,
                          color: '#A32D2D',
                          fontSize: 11,
                          padding: '2px 8px',
                          cursor: 'pointer',
                          marginLeft: 8
                        }}
                      >
                        Reverter
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => abrirModalConclusao(m)}
                      title="Concluir meta"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 24,
                        height: 24,
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#C8E6A0',
                        fontSize: '14px',
                        padding: 0,
                        lineHeight: 1
                      }}
                      disabled={metaExcluindoId === m.id || concluindoMetaId === m.id}
                    >
                      ✓
                    </button>
                    {!concluida && (
                      <>
                        {isAdmin && (
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => abrirMetaModalEditar(m)}
                          disabled={metaExcluindoId === m.id}
                          title="Editar meta"
                        >
                          ✎
                        </button>
                        )}
                        {isAdmin && podeExibirExcluirComHistorico(isAdmin, Boolean(metaTemAtividadesNoPlano[m.id])) ? (
                        <button
                          type="button"
                          className="btn-icon btn-danger"
                          onClick={() => abrirExcluirMetaDrawer(m)}
                          disabled={metaExcluindoId === m.id}
                          title="Excluir meta"
                        >
                          {metaExcluindoId === m.id ? '…' : '✕'}
                        </button>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              </div>
                )
              })()
            ))}
          </div>
        )}
      </section>
      </div>
      {error && deveExibirBannerErroGantt(error) && (
        <div className="alert alert-error">
          {error}
          {(String(error).toLowerCase().includes('planejamento_id') && String(error).includes('cronograma')) && (
            <div style={{ marginTop: '0.75rem', fontSize: '0.95rem' }}>
              <p>
                <strong>Como corrigir:</strong> falta a coluna <code>planejamento_id</code> em <code>cronograma</code> (ou o PostgREST ainda não recarregou o schema após você criar a coluna).
              </p>
              <ol style={{ marginBottom: '0.5rem', paddingLeft: '1.25rem' }}>
                <li>No Supabase → <strong>SQL Editor</strong>, rode o arquivo <code>supabase-cronograma-colunas.sql</code> (atualizado com <code>planejamento_id</code>) ou clique em <strong>Copiar SQL</strong> abaixo.</li>
                <li>Na mesma query, rode também <code>NOTIFY pgrst, &apos;reload schema&apos;;</code> para limpar o <em>schema cache</em> (botão copiar ao lado).</li>
                <li>Depois rode <code>supabase-fix-cronograma-unique.sql</code> se ainda não rodou (índices únicos por casa).</li>
                <li>Recarregue esta página (F5).</li>
              </ol>
              <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--color-text-secondary, #555)' }}>
                <button type="button" className="btn btn-sm" style={{ verticalAlign: 'baseline', padding: '0.15rem 0.45rem' }} onClick={() => navigator.clipboard.writeText(SQL_PGRST_RELOAD_SCHEMA).then(() => alert('Copiado. Cole no Supabase → SQL Editor → Run.'))}>Copiar NOTIFY</button>
              </p>
              <div style={{ position: 'relative', marginTop: '0.5rem' }}>
                <pre style={{ background: '#1e1e1e', color: '#d4d4d4', padding: '1rem', borderRadius: 6, fontSize: '0.8rem' }}>{`ALTER TABLE cronograma
  ADD COLUMN IF NOT EXISTS planejamento_id uuid REFERENCES gantt_planejamento(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cronograma_planejamento_id ON cronograma(planejamento_id);

NOTIFY pgrst, 'reload schema';`}</pre>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ position: 'absolute', top: 8, right: 8, fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
                  onClick={() =>
                    navigator.clipboard
                      .writeText(`ALTER TABLE cronograma
  ADD COLUMN IF NOT EXISTS planejamento_id uuid REFERENCES gantt_planejamento(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cronograma_planejamento_id ON cronograma(planejamento_id);

NOTIFY pgrst, 'reload schema';`)
                      .then(() => alert('SQL copiado! Cole no Supabase → SQL Editor → Run. Depois F5.'))
                  }
                >
                  Copiar SQL
                </button>
              </div>
            </div>
          )}
          {((error.includes('horas_previstas') || error.includes("'cronograma'")) && !String(error).toLowerCase().includes('planejamento_id')) && (
            <div style={{ marginTop: '0.75rem', fontSize: '0.95rem' }}>
              <p><strong>Como corrigir:</strong> falta a coluna <code>horas_previstas</code> na tabela <code>cronograma</code>. No Supabase → SQL Editor, rode o script do arquivo <code>supabase-cronograma-colunas.sql</code> ou clique em <strong>Copiar SQL</strong> abaixo.</p>
              <div style={{ position: 'relative', marginTop: '0.5rem' }}>
                <pre style={{ background: '#1e1e1e', color: '#d4d4d4', padding: '1rem', borderRadius: 6, fontSize: '0.8rem' }}>{`ALTER TABLE cronograma
  ADD COLUMN IF NOT EXISTS periodo_id uuid REFERENCES periodos(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS semana int,
  ADD COLUMN IF NOT EXISTS horas_previstas numeric;`}</pre>
                <button type="button" className="btn btn-primary" style={{ position: 'absolute', top: 8, right: 8, fontSize: '0.8rem', padding: '0.35rem 0.6rem' }} onClick={() => navigator.clipboard.writeText("ALTER TABLE cronograma\n  ADD COLUMN IF NOT EXISTS periodo_id uuid REFERENCES periodos(id) ON DELETE CASCADE,\n  ADD COLUMN IF NOT EXISTS semana int,\n  ADD COLUMN IF NOT EXISTS horas_previstas numeric;").then(() => alert('SQL copiado! Cole no Supabase → SQL Editor e execute (Run).'))}>Copiar SQL</button>
              </div>
            </div>
          )}
          {(error.includes('semanas_selecionadas') || (error.includes('gantt_planejamento') && error.includes('column') && !String(error).includes('casa_id'))) && (
            <div style={{ marginTop: '0.75rem', fontSize: '0.95rem' }}>
              <p><strong>Falta a coluna &quot;semanas_selecionadas&quot; (ou outra coluna em <code>gantt_planejamento</code>).</strong> No Supabase → SQL Editor, rode <code>supabase-gantt-planejamento-colunas-completas.sql</code> ou o SQL abaixo.</p>
              <div style={{ position: 'relative', marginTop: '0.5rem' }}>
                <pre style={{ background: '#1e1e1e', color: '#d4d4d4', padding: '1rem', borderRadius: 6, fontSize: '0.8rem' }}>{`ALTER TABLE gantt_planejamento
  ADD COLUMN IF NOT EXISTS semanas_selecionadas int[] DEFAULT '{}';`}</pre>
                <button type="button" className="btn btn-primary" style={{ position: 'absolute', top: 8, right: 8, fontSize: '0.8rem', padding: '0.35rem 0.6rem' }} onClick={() => navigator.clipboard.writeText("ALTER TABLE gantt_planejamento\n  ADD COLUMN IF NOT EXISTS semanas_selecionadas int[] DEFAULT '{}';").then(() => alert('SQL copiado! Cole no Supabase → SQL Editor e execute (Run). Depois recarregue a página (F5).'))}>Copiar SQL</button>
              </div>
            </div>
          )}
          {error.includes('casa_id') && (
            <div style={{ marginTop: '0.75rem', fontSize: '0.95rem' }}>
              <p>
                <strong>Falta a coluna <code>casa_id</code> ou a tabela <code>casas</code>.</strong>{' '}
                No Supabase → SQL Editor, rode o arquivo <code>supabase-gantt-planejamento-colunas-completas.sql</code> (cria <code>casas</code>, colunas e políticas) ou use <strong>Copiar SQL</strong> abaixo. Depois recarregue a página (F5).
              </p>
              <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--color-text-secondary, #555)' }}>
                Se o erro <em>schema cache</em> / <em>Could not find the &apos;casa_id&apos; column</em> continuar após o Run, execute no SQL Editor:{' '}
                <code style={{ fontSize: '0.85rem' }}>NOTIFY pgrst, &apos;reload schema&apos;;</code>{' '}
                (<button type="button" className="btn btn-sm" style={{ verticalAlign: 'baseline', padding: '0.15rem 0.45rem' }} onClick={() => navigator.clipboard.writeText(SQL_PGRST_RELOAD_SCHEMA).then(() => alert('Copiado. Cole no Supabase → SQL Editor → Run.'))}>copiar</button>) e recarregue o app (ou reinicie o <code>npm run dev</code>).
              </p>
              <div style={{ position: 'relative', marginTop: '0.5rem' }}>
                <pre style={{ background: '#1e1e1e', color: '#d4d4d4', padding: '1rem', borderRadius: 6, fontSize: '0.75rem', overflow: 'auto', maxHeight: 260 }}>{SQL_GANTT_PLANEJAMENTO_COLUNAS_COMPLETAS}</pre>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ position: 'absolute', top: 8, right: 8, fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
                  onClick={() =>
                    navigator.clipboard.writeText(SQL_GANTT_PLANEJAMENTO_COLUNAS_COMPLETAS).then(() =>
                      alert('SQL copiado! Cole no Supabase → SQL Editor → Run. Depois F5 nesta página.')
                    )
                  }
                >
                  Copiar SQL
                </button>
              </div>
            </div>
          )}
          {error.includes('franqueado_nome') && (
            <div style={{ marginTop: '0.75rem', fontSize: '0.95rem' }}>
              <p><strong>Falta a coluna <code>franqueado_nome</code> (e possivelmente a remoção do UNIQUE legado).</strong> No Supabase → SQL Editor, rode <code>supabase-gantt-planejamento-colunas-completas.sql</code> ou o arquivo <code>supabase-gantt-planejamento-franqueado-nome.sql</code>, ou copie o SQL abaixo.</p>
              <div style={{ position: 'relative', marginTop: '0.5rem' }}>
                <pre style={{ background: '#1e1e1e', color: '#d4d4d4', padding: '1rem', borderRadius: 6, fontSize: '0.8rem' }}>{`ALTER TABLE gantt_planejamento
  ADD COLUMN IF NOT EXISTS franqueado_nome text;

ALTER TABLE gantt_planejamento DROP CONSTRAINT IF EXISTS gantt_planejamento_trimestre_id_acao_id_key;`}</pre>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ position: 'absolute', top: 8, right: 8, fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
                  onClick={() =>
                    navigator.clipboard
                      .writeText(`ALTER TABLE gantt_planejamento
  ADD COLUMN IF NOT EXISTS franqueado_nome text;

ALTER TABLE gantt_planejamento DROP CONSTRAINT IF EXISTS gantt_planejamento_trimestre_id_acao_id_key;`)
                      .then(() => alert('SQL copiado! Cole no Supabase → SQL Editor e execute (Run). Depois recarregue a página (F5).'))
                  }
                >
                  Copiar SQL
                </button>
              </div>
            </div>
          )}
          {error.includes('indicador_lancamentos') && (
            <div style={{ marginTop: '0.75rem', fontSize: '0.95rem' }}>
              <p><strong>Falta a tabela de lançamentos de indicadores.</strong> No Supabase → SQL Editor, rode o script do arquivo <code>supabase-indicador-lancamentos.sql</code> ou copie o SQL abaixo e execute (Run). Depois recarregue a página (F5).</p>
              <div style={{ position: 'relative', marginTop: '0.5rem' }}>
                <pre style={{ background: '#1e1e1e', color: '#d4d4d4', padding: '1rem', borderRadius: 6, fontSize: '0.8rem', overflow: 'auto', maxHeight: 220 }}>{`CREATE TABLE IF NOT EXISTS indicador_lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicador_id uuid NOT NULL REFERENCES indicadores(id) ON DELETE CASCADE,
  periodo_id uuid NOT NULL REFERENCES periodos(id) ON DELETE CASCADE,
  semana int NOT NULL CHECK (semana >= 1 AND semana <= 53),
  valor text,
  comentario text,
  criado_em timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now(),
  UNIQUE(indicador_id, periodo_id, semana)
);

CREATE INDEX IF NOT EXISTS idx_indicador_lancamentos_indicador_periodo ON indicador_lancamentos(indicador_id, periodo_id);

ALTER TABLE indicador_lancamentos
  ADD COLUMN IF NOT EXISTS comentario text;`}</pre>
                <button type="button" className="btn btn-primary" style={{ position: 'absolute', top: 8, right: 8, fontSize: '0.8rem', padding: '0.35rem 0.6rem' }} onClick={() => navigator.clipboard.writeText(`CREATE TABLE IF NOT EXISTS indicador_lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicador_id uuid NOT NULL REFERENCES indicadores(id) ON DELETE CASCADE,
  periodo_id uuid NOT NULL REFERENCES periodos(id) ON DELETE CASCADE,
  semana int NOT NULL CHECK (semana >= 1 AND semana <= 53),
  valor text,
  comentario text,
  criado_em timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now(),
  UNIQUE(indicador_id, periodo_id, semana)
);

CREATE INDEX IF NOT EXISTS idx_indicador_lancamentos_indicador_periodo ON indicador_lancamentos(indicador_id, periodo_id);

ALTER TABLE indicador_lancamentos
  ADD COLUMN IF NOT EXISTS comentario text;`).then(() => alert('SQL copiado! Cole no Supabase → SQL Editor e execute (Run). Depois recarregue a página (F5).'))}>Copiar SQL</button>
              </div>
            </div>
          )}
          {(error.toLowerCase().includes('row-level security') || error.toLowerCase().includes('violates row-level security')) && error.includes('gantt_planejamento') && (
            <div style={{ marginTop: '0.75rem', fontSize: '0.95rem' }}>
              <p>
                <strong>Como corrigir:</strong> o Supabase está com <strong>RLS</strong> ativo na tabela <code>gantt_planejamento</code> e não há policy permitindo salvar alterações.
              </p>
              <ol style={{ marginBottom: '0.5rem', paddingLeft: '1.25rem' }}>
                <li>Acesse <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer">Supabase Dashboard</a> e abra o <strong>mesmo projeto</strong> que esta aplicação usa.</li>
                <li>No menu lateral, clique em <strong>SQL Editor</strong>.</li>
                <li>Rode o arquivo <code>supabase-gantt-planejamento-rls.sql</code> (na raiz do projeto) no SQL Editor e clique em <strong>Run</strong>.</li>
                <li>Depois recarregue a página (F5).</li>
              </ol>
              <div style={{ position: 'relative' }}>
                <pre style={{ background: '#1e1e1e', color: '#d4d4d4', padding: '1rem', borderRadius: 6, overflow: 'auto', fontSize: '0.8rem', maxHeight: 220 }}>{`ALTER TABLE IF EXISTS gantt_planejamento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gantt_planejamento_select" ON gantt_planejamento;
DROP POLICY IF EXISTS "gantt_planejamento_insert" ON gantt_planejamento;
DROP POLICY IF EXISTS "gantt_planejamento_update" ON gantt_planejamento;
DROP POLICY IF EXISTS "gantt_planejamento_delete" ON gantt_planejamento;

CREATE POLICY "gantt_planejamento_select" ON gantt_planejamento FOR SELECT USING (true);
CREATE POLICY "gantt_planejamento_insert" ON gantt_planejamento FOR INSERT WITH CHECK (true);
CREATE POLICY "gantt_planejamento_update" ON gantt_planejamento FOR UPDATE USING (true);
CREATE POLICY "gantt_planejamento_delete" ON gantt_planejamento FOR DELETE USING (true);`}</pre>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ position: 'absolute', top: 8, right: 8, fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
                  onClick={() => navigator.clipboard.writeText(`ALTER TABLE IF EXISTS gantt_planejamento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gantt_planejamento_select" ON gantt_planejamento;
DROP POLICY IF EXISTS "gantt_planejamento_insert" ON gantt_planejamento;
DROP POLICY IF EXISTS "gantt_planejamento_update" ON gantt_planejamento;
DROP POLICY IF EXISTS "gantt_planejamento_delete" ON gantt_planejamento;

CREATE POLICY "gantt_planejamento_select" ON gantt_planejamento FOR SELECT USING (true);
CREATE POLICY "gantt_planejamento_insert" ON gantt_planejamento FOR INSERT WITH CHECK (true);
CREATE POLICY "gantt_planejamento_update" ON gantt_planejamento FOR UPDATE USING (true);
CREATE POLICY "gantt_planejamento_delete" ON gantt_planejamento FOR DELETE USING (true);`).then(() => alert('SQL copiado! Cole no Supabase → SQL Editor e execute (Run). Depois recarregue a página (F5).'))}
                >
                  Copiar SQL (políticas RLS)
                </button>
              </div>
            </div>
          )}

          {error.includes('gantt_planejamento') && !(error.toLowerCase().includes('row-level security') || error.toLowerCase().includes('violates row-level security')) && !error.includes('horas_previstas') && !error.includes('semanas_selecionadas') && !error.includes('column') && (
            <div style={{ marginTop: '0.75rem', fontSize: '0.95rem' }}>
              <p><strong>Como corrigir:</strong></p>
              <ol style={{ marginBottom: '0.5rem', paddingLeft: '1.25rem' }}>
                <li>Acesse <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer">Supabase Dashboard</a> e abra o <strong>mesmo projeto</strong> que esta aplicação usa.</li>
                <li>No menu lateral, clique em <strong>SQL Editor</strong>.</li>
                <li>Clique em <strong>New query</strong>, copie o SQL abaixo (botão &quot;Copiar SQL&quot;) e cole no editor. Depois clique em <strong>Run</strong> (ou Ctrl+Enter).</li>
                <li>Se aparecer &quot;Success&quot;, volte aqui e <strong>recarregue a página</strong> (F5).</li>
              </ol>
              <div style={{ position: 'relative' }}>
                <pre style={{ background: '#1e1e1e', color: '#d4d4d4', padding: '1rem', borderRadius: 6, overflow: 'auto', fontSize: '0.8rem', maxHeight: 220 }}>{`CREATE TABLE IF NOT EXISTS gantt_planejamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_id uuid NOT NULL REFERENCES periodos(id) ON DELETE CASCADE,
  acao_id uuid NOT NULL REFERENCES acoes(id) ON DELETE CASCADE,
  responsavel text,
  recorrencia text CHECK (recorrencia IS NULL OR recorrencia IN ('diario', 'semanal', 'mensal')),
  repeticao int CHECK (repeticao IS NULL OR repeticao >= 1),
  semana_inicio int CHECK (semana_inicio IS NULL OR (semana_inicio >= 1 AND semana_inicio <= 53)),
  semana_fim int CHECK (semana_fim IS NULL OR (semana_fim >= 1 AND semana_fim <= 53)),
  criado_em timestamptz DEFAULT now(),
  UNIQUE(periodo_id, acao_id)
);`}</pre>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ position: 'absolute', top: 8, right: 8, fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
                  onClick={() => {
                    const sql = `CREATE TABLE IF NOT EXISTS gantt_planejamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_id uuid NOT NULL REFERENCES periodos(id) ON DELETE CASCADE,
  acao_id uuid NOT NULL REFERENCES acoes(id) ON DELETE CASCADE,
  responsavel text,
  recorrencia text CHECK (recorrencia IS NULL OR recorrencia IN ('diario', 'semanal', 'mensal')),
  repeticao int CHECK (repeticao IS NULL OR repeticao >= 1),
  semana_inicio int CHECK (semana_inicio IS NULL OR (semana_inicio >= 1 AND semana_inicio <= 53)),
  semana_fim int CHECK (semana_fim IS NULL OR (semana_fim >= 1 AND semana_fim <= 53)),
  criado_em timestamptz DEFAULT now(),
  UNIQUE(periodo_id, acao_id)
);`
                    navigator.clipboard.writeText(sql).then(() => alert('SQL copiado! Cole no Supabase → SQL Editor e execute (Run).'))
                  }}
                >
                  Copiar SQL
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="gantt-toolbar gantt-controls-row">
        <div className="gantt-toolbar-left gantt-controls-row-left">
          {areaId && periodoId && (
            <div className="gantt-add-atividade gantt-add-atividade--toolbar card" style={{ marginBottom: 0 }}>
              <button
                type="button"
                className="gantt-toolbar-add-btn"
                onClick={abrirAddDrawer}
              >
                + Adicionar comportamento à meta
              </button>
              {atividadesDisponiveis.length === 0 && tarefas.length > 0 && (
                <p className="text-muted" style={{ marginTop: '0.5rem', marginBottom: 0 }}>Inclua atividades (ações) nos comportamentos na Workload para poder adicioná-las ao plano.</p>
              )}
            </div>
          )}
          <div className="gantt-toolbar-periodos">
            <PeriodoSelect
              className="periodo-select-gantt"
              value={periodoId || null}
              defaultTipo="mes"
              onChange={async (id) => {
                setError(null)
                const next = id || ''
                setPeriodoId(next)
              }}
            />
            <div className="form-group">
              <label>Responsável</label>
              <select
                value={filtroResponsavelId}
                onChange={e => setFiltroResponsavelId(e.target.value)}
              >
                <option value="">Todos</option>
                {areaPessoasLista.map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="gantt-toolbar-right gantt-controls-row-right">
          <div className="gantt-legend gantt-legend--toolbar" aria-label="Legenda do cronograma">
            <span className="gantt-legend-item gantt-legend-planejado">Planejado</span>
            <span className="gantt-legend-item gantt-legend-realizado">Realizado</span>
            <span className="gantt-legend-item gantt-legend-atrasado">Atrasado</span>
            <span className="gantt-legend-item gantt-legend-semana-atual">Semana atual</span>
            <span className="gantt-legend-item gantt-legend-indicador" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, background: '#ddeeff', border: '1.5px solid #3a6fa8', borderRadius: 2, flexShrink: 0 }} aria-hidden />
              <span style={{ fontSize: 11 }}>Indicador</span>
            </span>
            {isAreaCasa && casas.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginLeft: 8 }}>
                {casas.map((c, i) => {
                  const cor = getCorCasa(i)
                  return (
                    <span key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-text-secondary)' }}>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 2,
                          background: cor.bg,
                          border: `1px solid ${cor.text}33`,
                          display: 'inline-block'
                        }}
                      />
                      {c.nome}
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      {comentarioModal && (
        <ComentarioModal
          tipo={comentarioModal.tipo}
          referenciaId={comentarioModal.referenciaId}
          nome={comentarioModal.nome}
          semanas={semanas}
          periodoRow={periodo}
          semanaAno={periodo?.ano != null ? Number(periodo.ano) : undefined}
          onClose={() => setComentarioModal(null)}
          onSaved={() => void carregarComentariosGrade()}
        />
      )}
      {tempoModalAberto && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) fecharTempoModal()
          }}
          style={{
            background: 'rgba(29, 47, 37, 0.45)',
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="tempo-modal-title"
            className="gantt-tempo-modal"
            onClick={e => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: 10,
              border: '0.5px solid #D3D1C7',
              boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
              width: 'min(420px, calc(100% - 32px))',
              overflow: 'hidden'
            }}
          >
            <header className="gantt-tempo-modal-header">
              <div>
                <h2 id="tempo-modal-title">Registrar tempo da atividade</h2>
                <p className="gantt-tempo-modal-subtitle">
                  Semana {tempoModalSemana}: informe quanto tempo foi gasto para concluir a atividade.
                </p>
              </div>
              <button
                type="button"
                className="gantt-tempo-modal-close"
                onClick={() => fecharTempoModal()}
                aria-label="Fechar"
              >
                ×
              </button>
            </header>
            <div className="gantt-tempo-modal-body">
              <div className="gantt-tempo-modal-field-row">
                <div className="gantt-tempo-modal-field">
                  <label htmlFor="tempo-modal-valor">Quanto tempo levou?</label>
                  <input
                    id="tempo-modal-valor"
                    type="number"
                    min="1"
                    step="1"
                    value={tempoModalValor}
                    onChange={e => {
                      setTempoModalValor(e.target.value)
                      if (tempoModalValorErro) setTempoModalValorErro('')
                    }}
                    placeholder="Ex.: 1"
                  />
                  {tempoModalValorErro ? (
                    <p style={{ fontSize: 12, color: '#A32D2D', marginTop: 4, marginBottom: 0 }}>
                      {tempoModalValorErro}
                    </p>
                  ) : null}
                </div>
                <div className="gantt-tempo-modal-field gantt-tempo-modal-field--unidade">
                  <label htmlFor="tempo-modal-unidade">Unidade</label>
                  <select
                    id="tempo-modal-unidade"
                    value={tempoModalUnidade}
                    onChange={e => setTempoModalUnidade(e.target.value)}
                  >
                    <option value="horas">horas</option>
                    <option value="minutos">minutos</option>
                  </select>
                </div>
              </div>
            </div>
            <footer className="gantt-tempo-modal-footer">
              <button
                type="button"
                className="gantt-tempo-modal-btn-cancel"
                onClick={() => fecharTempoModal()}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="gantt-tempo-modal-btn-register"
                onClick={() => {
                  if (!tempoModalAcaoId || tempoModalSemana == null) {
                    fecharTempoModal()
                    return
                  }
                  const raw = (tempoModalValor || '').trim().replace(',', '.')
                  const valor = Number(raw)
                  if (!Number.isFinite(valor) || valor <= 0 || !Number.isInteger(valor)) {
                    setTempoModalValorErro('Informe um número inteiro maior que zero.')
                    return
                  }
                  setTempoModalValorErro('')
                  const horas = tempoModalUnidade === 'minutos' ? valor / 60 : valor
                  salvarCelula(
                    tempoModalAcaoId,
                    tempoModalSemana,
                    horas,
                    true,
                    tempoModalPlanejamentoId ? { planejamentoId: tempoModalPlanejamentoId } : {}
                  )
                  fecharTempoModal()
                }}
              >
                Registrar
              </button>
            </footer>
          </div>
        </div>
      )}

      {isAdmin ? (
      <DefinirMetaDrawer
        open={metaModalAberto}
        onClose={fecharMetaDrawer}
        areaId={areaId}
        periodo={periodo}
        metaParaEditar={metaParaEditar}
        onSucesso={carregarMetasObjetivos}
      />
      ) : null}

      <WorkloadFormDrawer
        open={showAddAtividade}
        title={addDrawerEditando ? 'Editar no plano' : 'Adicionar ao plano'}
        titleId="gantt-add-drawer-title"
        rootClassName="definir-meta-drawer-z"
        panelClassName="definir-meta-drawer-panel"
        closeDisabled={salvandoAdd}
        onClose={fecharAddDrawer}
        footer={(
          <>
            <button
              type="button"
              className="workload-form-drawer-footer-btn workload-form-drawer-footer-btn--cancel"
              onClick={fecharAddDrawer}
              disabled={salvandoAdd}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="workload-form-drawer-footer-btn workload-form-drawer-footer-btn--save"
              disabled={
                addAcaoIds.length === 0 ||
                salvandoAdd ||
                addSemanasSelecionadas.length === 0 ||
                !addObjetivoId ||
                (isAreaJuridico && !juridicoIdentificacaoId)
              }
              onClick={adicionarAtividade}
              title={addAcaoIds.length === 0 ? 'Selecione ao menos uma atividade' : (addSemanasSelecionadas.length === 0 ? 'Selecione ao menos uma semana' : undefined)}
            >
              {salvandoAdd
                ? (addDrawerEditando ? 'Salvando…' : 'Adicionando…')
                : (addDrawerEditando ? 'Salvar alterações' : 'Adicionar')}
            </button>
          </>
        )}
      >
        {metasObjetivos.length === 0 ? (
          <div className="alert alert-warning" role="status" style={{ margin: 0 }}>
            Cadastre metas em “Definir metas”.
          </div>
        ) : (
          <>
            <div className="gantt-add-drawer-stack" role="group" aria-label="Meta, comportamento e atividades">
              <div className="gantt-add-drawer-field">
                <label className="gantt-add-drawer-select-label" htmlFor="gantt-add-meta">Meta</label>
                <select
                  id="gantt-add-meta"
                  className="gantt-add-drawer-select"
                  value={addObjetivoId || ''}
                  onChange={e => {
                    const v = e.target.value
                    setAddObjetivoId(v)
                    setAddAcaoIds([])
                    if (!v) setAddTarefaId('')
                  }}
                  disabled={salvandoAdd}
                >
                  <option value="">Selecione uma meta…</option>
                  {metasObjetivos.map(m => {
                    const prazo = formatoPrazoMeta(m).replace(/^Prazo:\s*/i, '')
                    const label = `${(m.descricao || '—').trim()}${prazo ? ` · ${prazo}` : ''}`
                    return (
                      <option key={m.id} value={m.id} title={(m.descricao || '').trim() || undefined}>
                        {label}
                      </option>
                    )
                  })}
                </select>
              </div>

              <div className="gantt-add-drawer-field">
                <label className="gantt-add-drawer-select-label" htmlFor="gantt-add-comportamento">Comportamento</label>
                <select
                  id="gantt-add-comportamento"
                  className="gantt-add-drawer-select"
                  value={addTarefaId || ''}
                  onChange={e => {
                    setAddTarefaId(e.target.value)
                    setAddAcaoIds([])
                  }}
                  disabled={salvandoAdd || comportamentosDisponiveis.length === 0}
                >
                  <option value="">{comportamentosDisponiveis.length === 0 ? 'Nenhum com atividades' : 'Selecione um comportamento…'}</option>
                  {comportamentosDisponiveis.map(c => (
                    <option key={c.tarefaId} value={c.tarefaId}>
                      {c.tarefaNome} ({c.count})
                    </option>
                  ))}
                </select>
              </div>

              {isAreaComercial && (() => {
                const visiveis = comercialCandidatos.filter(c => !c.oculto)
                const ocultos = comercialCandidatos.filter(c => c.oculto)
                return (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: 'var(--color-text-secondary)',
                        display: 'block',
                        marginBottom: 6
                      }}
                    >
                      Candidato
                    </label>

                    <div
                      style={{
                        border: '0.5px solid var(--color-border-tertiary)',
                        borderRadius: 'var(--border-radius-md)',
                        overflow: 'hidden'
                      }}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setComercialDropdownAberto(prev => !prev)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setComercialDropdownAberto(prev => !prev)
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '9px 12px',
                          cursor: 'pointer',
                          borderLeft: comercialCandidatoId ? '3px solid #1a2e1a' : '3px solid transparent',
                          background: comercialCandidatoId ? '#f0f6f0' : 'var(--color-background-primary)',
                          transition: 'background .15s'
                        }}
                      >
                        <div
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            flexShrink: 0,
                            border: `1.5px solid ${comercialCandidatoId ? '#1a2e1a' : 'var(--color-border-secondary)'}`,
                            background: comercialCandidatoId ? '#1a2e1a' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          {comercialCandidatoId ? (
                            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff' }} />
                          ) : null}
                        </div>
                        <span
                          style={{
                            flex: 1,
                            fontSize: 13,
                            color: comercialCandidatoId ? '#1a2e1a' : 'var(--color-text-tertiary)',
                            fontWeight: comercialCandidatoId ? 500 : 400
                          }}
                        >
                          {comercialCandidatoId
                            ? comercialCandidatos.find(c => String(c.id) === String(comercialCandidatoId))?.nome ?? '...'
                            : 'Selecione ou cadastre...'}
                        </span>
                        <span
                          aria-hidden="true"
                          style={{
                            fontSize: 13,
                            color: 'var(--color-text-tertiary)',
                            transition: 'transform .2s',
                            transform: comercialDropdownAberto ? 'rotate(180deg)' : 'rotate(0deg)',
                            lineHeight: 1
                          }}
                        >
                          ▾
                        </span>
                      </div>

                      {comercialDropdownAberto ? (
                        <div style={{ borderTop: '0.5px solid var(--color-border-tertiary)' }}>
                          <div style={{ display: 'flex', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                            <input
                              type="text"
                              value={novoCandidatoNome}
                              onChange={e => setNovoCandidatoNome(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  void handleAdicionarCandidato()
                                }
                              }}
                              placeholder="Ex: João Silva"
                              disabled={salvandoAdd}
                              style={{
                                flex: 1,
                                padding: '8px 10px',
                                border: 'none',
                                fontSize: 13,
                                background: 'var(--color-background-secondary)',
                                outline: 'none',
                                color: 'var(--color-text-primary)'
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => void handleAdicionarCandidato()}
                              disabled={salvandoAdd}
                              style={{
                                padding: '8px 13px',
                                background: '#1a2e1a',
                                color: '#fff',
                                border: 'none',
                                fontSize: 15,
                                cursor: 'pointer',
                                fontWeight: 500
                              }}
                            >
                              +
                            </button>
                          </div>

                          {visiveis.map(item => {
                            const selecionado = String(comercialCandidatoId) === String(item.id)
                            const selecionar = () => {
                              setComercialCandidatoId(item.id)
                              setComercialDropdownAberto(false)
                            }
                            return (
                              <div
                                key={item.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  borderBottom: '0.5px solid var(--color-border-tertiary)',
                                  cursor: 'pointer',
                                  borderLeft: selecionado ? '3px solid #1a2e1a' : '3px solid transparent',
                                  background: selecionado ? '#f0f6f0' : 'var(--color-background-primary)',
                                  transition: 'background .1s'
                                }}
                              >
                                <div
                                  style={{
                                    width: 36,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                  }}
                                  onClick={selecionar}
                                >
                                  <div
                                    style={{
                                      width: 14,
                                      height: 14,
                                      borderRadius: '50%',
                                      border: `1.5px solid ${selecionado ? '#1a2e1a' : 'var(--color-border-secondary)'}`,
                                      background: selecionado ? '#1a2e1a' : 'transparent',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center'
                                    }}
                                  >
                                    {selecionado ? (
                                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff' }} />
                                    ) : null}
                                  </div>
                                </div>
                                <span
                                  onClick={selecionar}
                                  style={{
                                    flex: 1,
                                    padding: '9px 0',
                                    fontSize: 13,
                                    color: selecionado ? '#1a2e1a' : 'var(--color-text-primary)',
                                    fontWeight: selecionado ? 500 : 400
                                  }}
                                >
                                  {item.nome}
                                </span>
                                <span
                                  role="button"
                                  tabIndex={0}
                                  onClick={e => {
                                    e.stopPropagation()
                                    void handleOcultarCandidato(item.id)
                                  }}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      void handleOcultarCandidato(item.id)
                                    }
                                  }}
                                  style={{
                                    padding: '9px 12px',
                                    fontSize: 11,
                                    color: 'var(--color-text-tertiary)',
                                    borderLeft: '0.5px solid var(--color-border-tertiary)',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Ocultar
                                </span>
                              </div>
                            )
                          })}

                          {visiveis.length === 0 ? (
                            <div
                              style={{
                                padding: 12,
                                fontSize: 13,
                                color: 'var(--color-text-tertiary)',
                                textAlign: 'center'
                              }}
                            >
                              Nenhum candidato cadastrado.
                            </div>
                          ) : null}

                          {ocultos.length > 0 ? (
                            <>
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={() => setComercialOcultosAbertos(prev => !prev)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    setComercialOcultosAbertos(prev => !prev)
                                  }
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  padding: '7px 12px',
                                  background: 'var(--color-background-secondary)',
                                  cursor: 'pointer',
                                  borderTop: '0.5px solid var(--color-border-tertiary)'
                                }}
                              >
                                <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>Ocultos</span>
                                <span style={{ flex: 1 }} />
                                <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{ocultos.length}</span>
                                <span
                                  aria-hidden="true"
                                  style={{
                                    fontSize: 12,
                                    color: 'var(--color-text-tertiary)',
                                    transition: 'transform .2s',
                                    transform: comercialOcultosAbertos ? 'rotate(180deg)' : 'rotate(0deg)',
                                    lineHeight: 1
                                  }}
                                >
                                  ▾
                                </span>
                              </div>
                              {comercialOcultosAbertos
                                ? ocultos.map(item => (
                                    <div
                                      key={item.id}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '7px 12px',
                                        borderTop: '0.5px solid var(--color-border-tertiary)',
                                        opacity: 0.55,
                                        background: 'var(--color-background-secondary)'
                                      }}
                                    >
                                      <span
                                        style={{
                                          flex: 1,
                                          fontSize: 12,
                                          color: 'var(--color-text-secondary)',
                                          paddingLeft: 36
                                        }}
                                      >
                                        {item.nome}
                                      </span>
                                      <span
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => void handleMostrarCandidato(item.id)}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault()
                                            void handleMostrarCandidato(item.id)
                                          }
                                        }}
                                        style={{
                                          fontSize: 11,
                                          color: '#2e7d32',
                                          padding: '2px 8px',
                                          border: '0.5px solid #b8c8b8',
                                          borderRadius: 4,
                                          background: '#f4f8f4',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        Mostrar
                                      </span>
                                    </div>
                                  ))
                                : null}
                            </>
                          ) : null}
                        </div>
                      ) : null}

                      {!comercialDropdownAberto && comercialCandidatoId ? (
                        <div
                          style={{
                            padding: '5px 12px',
                            fontSize: 11,
                            color: 'var(--color-text-tertiary)',
                            borderTop: '0.5px solid var(--color-border-tertiary)',
                            background: 'var(--color-background-secondary)'
                          }}
                        >
                          Clique para trocar o candidato
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              })()}



              {isAreaJuridico && (() => {
                const doTipo = (juridicoIdentificacoes || []).filter(j => j.tipo === juridicoTipo)
                const visiveis = doTipo
                  .filter(j => !j.oculto)
                  .slice()
                  .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
                const ocultos = doTipo
                  .filter(j => j.oculto)
                  .slice()
                  .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
                return (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 13,
                        fontWeight: 500,
                        color: 'var(--color-text-primary)',
                        marginBottom: 6
                      }}
                    >
                      Tipo de demanda
                    </label>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                      {JURIDICO_TIPO_OPCOES.map(opt => (
                        <label
                          key={opt.value}
                          style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '7px 10px',
                            border: `0.5px solid ${juridicoTipo === opt.value ? '#1a2e1a' : 'var(--moni-borda, #d1d5db)'}`,
                            borderRadius: 'var(--border-radius-md)',
                            cursor: 'pointer',
                            justifyContent: 'center',
                            background: juridicoTipo === opt.value ? '#f4f8f4' : 'var(--color-background-primary)'
                          }}
                        >
                          <div
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: '50%',
                              flexShrink: 0,
                              border: `2px solid ${juridicoTipo === opt.value ? '#1a2e1a' : 'var(--color-border-secondary)'}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            {juridicoTipo === opt.value ? (
                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1a2e1a' }} />
                            ) : null}
                          </div>
                          <input
                            type="radio"
                            value={opt.value}
                            checked={juridicoTipo === opt.value}
                            onChange={() => {
                              setJuridicoTipo(opt.value)
                              setJuridicoIdentificacaoId(null)
                              setIdDropdownAberto(true)
                            }}
                            style={{ display: 'none' }}
                          />
                          <span style={{ fontSize: 11, fontWeight: juridicoTipo === opt.value ? 500 : 400 }}>
                            {opt.label}
                          </span>
                        </label>
                      ))}
                    </div>

                    <label
                      style={{
                        display: 'block',
                        fontSize: 13,
                        fontWeight: 500,
                        color: 'var(--color-text-primary)',
                        marginBottom: 6,
                        marginTop: 10
                      }}
                    >
                      Identificação
                    </label>
                    <div
                      style={{
                        border: '0.5px solid var(--color-border-tertiary)',
                        borderRadius: 'var(--border-radius-md)',
                        overflow: 'hidden'
                      }}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setIdDropdownAberto(prev => !prev)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setIdDropdownAberto(prev => !prev)
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '9px 12px',
                          cursor: 'pointer',
                          borderLeft: juridicoIdentificacaoId ? '3px solid #1a2e1a' : '3px solid transparent',
                          background: juridicoIdentificacaoId ? '#f0f6f0' : 'var(--color-background-primary)',
                          transition: 'background .15s'
                        }}
                      >
                        <div
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            border: `1.5px solid ${juridicoIdentificacaoId ? '#1a2e1a' : 'var(--color-border-secondary)'}`,
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: juridicoIdentificacaoId ? '#1a2e1a' : 'transparent'
                          }}
                        >
                          {juridicoIdentificacaoId ? (
                            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff' }} />
                          ) : null}
                        </div>
                        <span
                          style={{
                            flex: 1,
                            fontSize: 13,
                            color: juridicoIdentificacaoId ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                            fontWeight: juridicoIdentificacaoId ? 500 : 400
                          }}
                        >
                          {juridicoIdentificacaoId
                            ? juridicoIdentificacoes.find(i => String(i.id) === String(juridicoIdentificacaoId))?.nome ?? '...'
                            : 'Selecione uma identificação...'}
                        </span>
                        {juridicoIdentificacaoId ? (
                          <span
                            style={{
                              fontSize: 11,
                              background: '#f0f6f0',
                              color: '#1a2e1a',
                              border: '0.5px solid #c8dfc8',
                              borderRadius: 4,
                              padding: '2px 8px',
                              fontWeight: 500,
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {JURIDICO_TIPO_LABEL[juridicoTipo] || juridicoTipo}
                          </span>
                        ) : null}
                        <span
                          aria-hidden="true"
                          style={{
                            fontSize: 13,
                            color: 'var(--color-text-tertiary)',
                            transition: 'transform .2s',
                            transform: idDropdownAberto ? 'rotate(180deg)' : 'rotate(0deg)',
                            lineHeight: 1
                          }}
                        >
                          ▾
                        </span>
                      </div>

                      {idDropdownAberto ? (
                        <div style={{ borderTop: '0.5px solid var(--color-border-tertiary)' }}>
                          <div style={{ display: 'flex', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                            <input
                              type="text"
                              value={novaIdentificacaoNome}
                              onChange={e => setNovaIdentificacaoNome(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  void handleAdicionarIdentificacao()
                                }
                              }}
                              placeholder="Nova identificação..."
                              disabled={salvandoAdd}
                              style={{
                                flex: 1,
                                padding: '8px 10px',
                                border: 'none',
                                fontSize: 13,
                                background: 'var(--color-background-secondary)',
                                outline: 'none',
                                color: 'var(--color-text-primary)'
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => void handleAdicionarIdentificacao()}
                              disabled={salvandoAdd || !novaIdentificacaoNome.trim()}
                              style={{
                                padding: '8px 13px',
                                background: '#1a2e1a',
                                color: '#fff',
                                border: 'none',
                                fontSize: 15,
                                cursor: 'pointer',
                                fontWeight: 500
                              }}
                            >
                              +
                            </button>
                          </div>

                          {visiveis.map(item => {
                            const selecionado = String(juridicoIdentificacaoId) === String(item.id)
                            const selecionar = () => {
                              setJuridicoIdentificacaoId(String(item.id))
                              setIdDropdownAberto(false)
                            }
                            return (
                              <div
                                key={item.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  borderBottom: '0.5px solid var(--color-border-tertiary)',
                                  cursor: 'pointer',
                                  borderLeft: selecionado ? '3px solid #1a2e1a' : '3px solid transparent',
                                  background: selecionado ? '#f0f6f0' : 'var(--color-background-primary)',
                                  transition: 'background .1s'
                                }}
                              >
                                <div
                                  style={{
                                    width: 36,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                  }}
                                  onClick={selecionar}
                                >
                                  <div
                                    style={{
                                      width: 14,
                                      height: 14,
                                      borderRadius: '50%',
                                      border: `1.5px solid ${selecionado ? '#1a2e1a' : 'var(--color-border-secondary)'}`,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      background: selecionado ? '#1a2e1a' : 'transparent'
                                    }}
                                  >
                                    {selecionado ? (
                                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff' }} />
                                    ) : null}
                                  </div>
                                </div>
                                <span
                                  onClick={selecionar}
                                  style={{
                                    flex: 1,
                                    padding: '9px 0',
                                    fontSize: 13,
                                    color: selecionado ? '#1a2e1a' : 'var(--color-text-primary)',
                                    fontWeight: selecionado ? 500 : 400
                                  }}
                                >
                                  {item.nome}
                                </span>
                                <span
                                  role="button"
                                  tabIndex={0}
                                  onClick={e => {
                                    e.stopPropagation()
                                    void handleOcultarIdentificacao(item.id)
                                  }}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      void handleOcultarIdentificacao(item.id)
                                    }
                                  }}
                                  style={{
                                    padding: '9px 12px',
                                    fontSize: 11,
                                    color: 'var(--color-text-tertiary)',
                                    borderLeft: '0.5px solid var(--color-border-tertiary)',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Ocultar
                                </span>
                              </div>
                            )
                          })}

                          {visiveis.length === 0 ? (
                            <div
                              style={{
                                padding: '12px',
                                fontSize: 13,
                                color: 'var(--color-text-tertiary)',
                                textAlign: 'center'
                              }}
                            >
                              Nenhuma identificação para este tipo.
                            </div>
                          ) : null}

                          {ocultos.length > 0 ? (
                            <>
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={() => setOcultosAbertos(prev => !prev)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    setOcultosAbertos(prev => !prev)
                                  }
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  padding: '7px 12px',
                                  background: 'var(--color-background-secondary)',
                                  cursor: 'pointer',
                                  borderTop: '0.5px solid var(--color-border-tertiary)'
                                }}
                              >
                                <span style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }} aria-hidden="true">
                                  ⊘
                                </span>
                                <span style={{ flex: 1, fontSize: 12, color: 'var(--color-text-tertiary)' }}>Ocultos</span>
                                <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{ocultos.length}</span>
                                <span
                                  aria-hidden="true"
                                  style={{
                                    fontSize: 12,
                                    color: 'var(--color-text-tertiary)',
                                    transition: 'transform .2s',
                                    transform: ocultosAbertos ? 'rotate(180deg)' : 'rotate(0deg)'
                                  }}
                                >
                                  ▾
                                </span>
                              </div>
                              {ocultosAbertos
                                ? ocultos.map(item => (
                                    <div
                                      key={item.id}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '7px 12px',
                                        borderTop: '0.5px solid var(--color-border-tertiary)',
                                        opacity: 0.55,
                                        background: 'var(--color-background-secondary)'
                                      }}
                                    >
                                      <span
                                        style={{
                                          flex: 1,
                                          fontSize: 12,
                                          color: 'var(--color-text-secondary)',
                                          paddingLeft: 36
                                        }}
                                      >
                                        {item.nome}
                                      </span>
                                      <span
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => void handleMostrarIdentificacao(item.id)}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault()
                                            void handleMostrarIdentificacao(item.id)
                                          }
                                        }}
                                        style={{
                                          fontSize: 11,
                                          color: '#2e7d32',
                                          padding: '2px 8px',
                                          border: '0.5px solid #b8c8b8',
                                          borderRadius: 4,
                                          background: '#f4f8f4',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        Mostrar
                                      </span>
                                    </div>
                                  ))
                                : null}
                            </>
                          ) : null}
                        </div>
                      ) : null}

                      {!idDropdownAberto && juridicoIdentificacaoId ? (
                        <div
                          style={{
                            padding: '5px 12px',
                            fontSize: 11,
                            color: 'var(--color-text-tertiary)',
                            borderTop: '0.5px solid var(--color-border-tertiary)',
                            background: 'var(--color-background-secondary)'
                          }}
                        >
                          Clique para trocar a identificação
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              })()}

              {isAreaAdm && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <label
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: 'var(--color-text-secondary)',
                      display: 'block',
                      marginBottom: 6
                    }}
                  >
                    CNPJ / Empresa
                  </label>

                  <div
                    style={{
                      border: '0.5px solid var(--color-border-tertiary)',
                      borderRadius: 'var(--border-radius-md)',
                      overflow: 'hidden'
                    }}
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setCnpjDropdownAberto(prev => !prev)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setCnpjDropdownAberto(prev => !prev)
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '9px 12px',
                        cursor: 'pointer',
                        borderLeft: admCnpjSelecionado ? '3px solid #1a2e1a' : '3px solid transparent',
                        background: admCnpjSelecionado ? '#f0f6f0' : 'var(--color-background-primary)',
                        transition: 'background .15s'
                      }}
                    >
                      <div
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          flexShrink: 0,
                          border: `1.5px solid ${admCnpjSelecionado ? '#1a2e1a' : 'var(--color-border-secondary)'}`,
                          background: admCnpjSelecionado ? '#1a2e1a' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        {admCnpjSelecionado ? (
                          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff' }} />
                        ) : null}
                      </div>
                      {admCnpjSelecionado ? (() => {
                        const item = admCnpjs.find(c => String(c.id) === String(admCnpjSelecionado))
                        return (
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                              {item?.cnpj}
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 500, color: '#1a2e1a' }}>{item?.descritivo}</span>
                          </div>
                        )
                      })() : (
                        <span style={{ flex: 1, fontSize: 13, color: 'var(--color-text-tertiary)' }}>
                          Selecione uma empresa...
                        </span>
                      )}
                      <span
                        aria-hidden="true"
                        style={{
                          fontSize: 13,
                          color: 'var(--color-text-tertiary)',
                          transition: 'transform .2s',
                          transform: cnpjDropdownAberto ? 'rotate(180deg)' : 'rotate(0deg)',
                          lineHeight: 1
                        }}
                      >
                        ▾
                      </span>
                    </div>

                    {cnpjDropdownAberto ? (
                      <div style={{ borderTop: '0.5px solid var(--color-border-tertiary)' }}>
                        {admCnpjs.map(item => {
                          const selecionado = String(admCnpjSelecionado) === String(item.id)
                          const selecionar = () => {
                            setAdmCnpjSelecionado(item.id)
                            setCnpjDropdownAberto(false)
                            setCriandoCnpj(false)
                          }
                          return (
                            <div
                              key={item.id}
                              role="button"
                              tabIndex={0}
                              onClick={selecionar}
                              onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  selecionar()
                                }
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                borderBottom: '0.5px solid var(--color-border-tertiary)',
                                cursor: 'pointer',
                                borderLeft: selecionado ? '3px solid #1a2e1a' : '3px solid transparent',
                                background: selecionado ? '#f0f6f0' : 'var(--color-background-primary)',
                                transition: 'background .1s'
                              }}
                            >
                              <div
                                style={{
                                  width: 36,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}
                              >
                                <div
                                  style={{
                                    width: 14,
                                    height: 14,
                                    borderRadius: '50%',
                                    border: `1.5px solid ${selecionado ? '#1a2e1a' : 'var(--color-border-secondary)'}`,
                                    background: selecionado ? '#1a2e1a' : 'transparent',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                >
                                  {selecionado ? (
                                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff' }} />
                                  ) : null}
                                </div>
                              </div>
                              <div style={{ flex: 1, padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                                  {item.cnpj}
                                </span>
                                <span
                                  style={{
                                    fontSize: 13,
                                    color: selecionado ? '#1a2e1a' : 'var(--color-text-primary)',
                                    fontWeight: selecionado ? 500 : 400
                                  }}
                                >
                                  {item.descritivo}
                                </span>
                              </div>
                            </div>
                          )
                        })}

                        {admCnpjs.length === 0 && !criandoCnpj ? (
                          <div
                            style={{
                              padding: 12,
                              fontSize: 13,
                              color: 'var(--color-text-tertiary)',
                              textAlign: 'center'
                            }}
                          >
                            {admCnpjsTabelaAusente
                              ? 'Configure a tabela adm_cnpjs no Supabase (aviso amarelo acima).'
                              : 'Nenhuma empresa cadastrada.'}
                          </div>
                        ) : null}

                        {criandoCnpj ? (
                          <div
                            style={{
                              padding: '10px 12px',
                              background: 'var(--color-background-secondary)',
                              borderTop: '0.5px solid var(--color-border-tertiary)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 6
                            }}
                          >
                            <input
                              type="text"
                              value={novoCnpj}
                              onChange={e => setNovoCnpj(e.target.value)}
                              placeholder="00.000.000/0001-00"
                              disabled={salvandoAdd}
                              style={{
                                padding: '7px 10px',
                                border: '0.5px solid var(--color-border-tertiary)',
                                borderRadius: 'var(--border-radius-md)',
                                fontSize: 12,
                                fontFamily: 'monospace',
                                background: 'var(--color-background-primary)',
                                color: 'var(--color-text-primary)',
                                width: '100%',
                                outline: 'none'
                              }}
                            />
                            <div style={{ display: 'flex', gap: 6 }}>
                              <input
                                type="text"
                                value={novoDescritivo}
                                onChange={e => setNovoDescritivo(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault()
                                    void handleSalvarCnpj()
                                  }
                                }}
                                placeholder="Nome / descritivo da empresa..."
                                disabled={salvandoAdd}
                                style={{
                                  flex: 1,
                                  padding: '7px 10px',
                                  border: '0.5px solid var(--color-border-tertiary)',
                                  borderRadius: 'var(--border-radius-md)',
                                  fontSize: 13,
                                  background: 'var(--color-background-primary)',
                                  color: 'var(--color-text-primary)',
                                  outline: 'none'
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setCriandoCnpj(false)
                                  setNovoCnpj('')
                                  setNovoDescritivo('')
                                }}
                                disabled={salvandoAdd}
                                style={{
                                  padding: '6px 12px',
                                  border: '0.5px solid var(--color-border-secondary)',
                                  borderRadius: 'var(--border-radius-md)',
                                  background: 'var(--color-background-primary)',
                                  fontSize: 12,
                                  cursor: 'pointer',
                                  color: 'var(--color-text-secondary)'
                                }}
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleSalvarCnpj()}
                                disabled={salvandoAdd}
                                style={{
                                  padding: '6px 14px',
                                  background: '#1a2e1a',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: 'var(--border-radius-md)',
                                  fontSize: 12,
                                  cursor: 'pointer',
                                  fontWeight: 500
                                }}
                              >
                                Salvar
                              </button>
                            </div>
                          </div>
                        ) : !admCnpjsTabelaAusente ? (
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setCriandoCnpj(true)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                setCriandoCnpj(true)
                              }
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '8px 12px',
                              fontSize: 12,
                              color: 'var(--color-text-secondary)',
                              cursor: 'pointer',
                              background: 'var(--color-background-secondary)',
                              borderTop: '0.5px solid var(--color-border-tertiary)'
                            }}
                          >
                            <span aria-hidden="true" style={{ fontSize: 13 }}>+</span>
                            Adicionar novo CNPJ
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {!cnpjDropdownAberto && admCnpjSelecionado ? (
                      <div
                        style={{
                          padding: '5px 12px',
                          fontSize: 11,
                          color: 'var(--color-text-tertiary)',
                          borderTop: '0.5px solid var(--color-border-tertiary)',
                          background: 'var(--color-background-secondary)'
                        }}
                      >
                        Clique para trocar a empresa
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {isAreaControladoria && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <label
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: 'var(--color-text-secondary)',
                      display: 'block',
                      marginBottom: 6
                    }}
                  >
                    CNPJ / Empresa (opcional)
                  </label>

                  <div
                    style={{
                      border: '0.5px solid var(--color-border-tertiary)',
                      borderRadius: 'var(--border-radius-md)',
                      overflow: 'hidden'
                    }}
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setControladoriaCnpjDropdownAberto(prev => !prev)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setControladoriaCnpjDropdownAberto(prev => !prev)
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '9px 12px',
                        cursor: 'pointer',
                        borderLeft: controladoriaCnpjSelecionado ? '3px solid #1a2e1a' : '3px solid transparent',
                        background: controladoriaCnpjSelecionado ? '#f0f6f0' : 'var(--color-background-primary)',
                        transition: 'background .15s'
                      }}
                    >
                      <div
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          flexShrink: 0,
                          border: `1.5px solid ${controladoriaCnpjSelecionado ? '#1a2e1a' : 'var(--color-border-secondary)'}`,
                          background: controladoriaCnpjSelecionado ? '#1a2e1a' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        {controladoriaCnpjSelecionado ? (
                          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff' }} />
                        ) : null}
                      </div>
                      {controladoriaCnpjSelecionado ? (() => {
                        const item = controladoriaCnpjs.find(c => String(c.id) === String(controladoriaCnpjSelecionado))
                        return (
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                              {item?.cnpj}
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 500, color: '#1a2e1a' }}>{item?.descritivo}</span>
                          </div>
                        )
                      })() : (
                        <span style={{ flex: 1, fontSize: 13, color: 'var(--color-text-tertiary)' }}>
                          Selecione uma empresa (opcional)...
                        </span>
                      )}
                      <span
                        aria-hidden="true"
                        style={{
                          fontSize: 13,
                          color: 'var(--color-text-tertiary)',
                          transition: 'transform .2s',
                          transform: controladoriaCnpjDropdownAberto ? 'rotate(180deg)' : 'rotate(0deg)',
                          lineHeight: 1
                        }}
                      >
                        ▾
                      </span>
                    </div>

                    {controladoriaCnpjDropdownAberto ? (
                      <div style={{ borderTop: '0.5px solid var(--color-border-tertiary)' }}>
                        {controladoriaCnpjs.map(item => {
                          const selecionado = String(controladoriaCnpjSelecionado) === String(item.id)
                          const selecionar = () => {
                            setControladoriaCnpjSelecionado(item.id)
                            setControladoriaCnpjDropdownAberto(false)
                            setControladoriaCriandoCnpj(false)
                          }
                          return (
                            <div
                              key={item.id}
                              role="button"
                              tabIndex={0}
                              onClick={selecionar}
                              onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  selecionar()
                                }
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                borderBottom: '0.5px solid var(--color-border-tertiary)',
                                cursor: 'pointer',
                                borderLeft: selecionado ? '3px solid #1a2e1a' : '3px solid transparent',
                                background: selecionado ? '#f0f6f0' : 'var(--color-background-primary)',
                                transition: 'background .1s'
                              }}
                            >
                              <div
                                style={{
                                  width: 36,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}
                              >
                                <div
                                  style={{
                                    width: 14,
                                    height: 14,
                                    borderRadius: '50%',
                                    border: `1.5px solid ${selecionado ? '#1a2e1a' : 'var(--color-border-secondary)'}`,
                                    background: selecionado ? '#1a2e1a' : 'transparent',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                >
                                  {selecionado ? (
                                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff' }} />
                                  ) : null}
                                </div>
                              </div>
                              <div style={{ flex: 1, padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                                  {item.cnpj}
                                </span>
                                <span
                                  style={{
                                    fontSize: 13,
                                    color: selecionado ? '#1a2e1a' : 'var(--color-text-primary)',
                                    fontWeight: selecionado ? 500 : 400
                                  }}
                                >
                                  {item.descritivo}
                                </span>
                              </div>
                            </div>
                          )
                        })}

                        {controladoriaCnpjs.length === 0 && !controladoriaCriandoCnpj ? (
                          <div
                            style={{
                              padding: 12,
                              fontSize: 13,
                              color: 'var(--color-text-tertiary)',
                              textAlign: 'center'
                            }}
                          >
                            Nenhuma empresa cadastrada.
                          </div>
                        ) : null}

                        {controladoriaCriandoCnpj ? (
                          <div
                            style={{
                              padding: '10px 12px',
                              background: 'var(--color-background-secondary)',
                              borderTop: '0.5px solid var(--color-border-tertiary)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 6
                            }}
                          >
                            <input
                              type="text"
                              value={controladoriaNovoCnpj}
                              onChange={e => setControladoriaNovoCnpj(e.target.value)}
                              placeholder="00.000.000/0001-00"
                              disabled={salvandoAdd}
                              style={{
                                padding: '7px 10px',
                                border: '0.5px solid var(--color-border-tertiary)',
                                borderRadius: 'var(--border-radius-md)',
                                fontSize: 12,
                                fontFamily: 'monospace',
                                background: 'var(--color-background-primary)',
                                color: 'var(--color-text-primary)',
                                width: '100%',
                                outline: 'none'
                              }}
                            />
                            <div style={{ display: 'flex', gap: 6 }}>
                              <input
                                type="text"
                                value={controladoriaNovoDescritivo}
                                onChange={e => setControladoriaNovoDescritivo(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault()
                                    void handleSalvarControladoriaCnpj()
                                  }
                                }}
                                placeholder="Nome / descritivo da empresa..."
                                disabled={salvandoAdd}
                                style={{
                                  flex: 1,
                                  padding: '7px 10px',
                                  border: '0.5px solid var(--color-border-tertiary)',
                                  borderRadius: 'var(--border-radius-md)',
                                  fontSize: 13,
                                  background: 'var(--color-background-primary)',
                                  color: 'var(--color-text-primary)',
                                  outline: 'none'
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setControladoriaCriandoCnpj(false)
                                  setControladoriaNovoCnpj('')
                                  setControladoriaNovoDescritivo('')
                                }}
                                disabled={salvandoAdd}
                                style={{
                                  padding: '6px 12px',
                                  border: '0.5px solid var(--color-border-secondary)',
                                  borderRadius: 'var(--border-radius-md)',
                                  background: 'var(--color-background-primary)',
                                  fontSize: 12,
                                  cursor: 'pointer',
                                  color: 'var(--color-text-secondary)'
                                }}
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleSalvarControladoriaCnpj()}
                                disabled={salvandoAdd}
                                style={{
                                  padding: '6px 14px',
                                  background: '#1a2e1a',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: 'var(--border-radius-md)',
                                  fontSize: 12,
                                  cursor: 'pointer',
                                  fontWeight: 500
                                }}
                              >
                                Salvar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setControladoriaCriandoCnpj(true)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                setControladoriaCriandoCnpj(true)
                              }
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '8px 12px',
                              fontSize: 12,
                              color: 'var(--color-text-secondary)',
                              cursor: 'pointer',
                              background: 'var(--color-background-secondary)',
                              borderTop: '0.5px solid var(--color-border-tertiary)'
                            }}
                          >
                            <span aria-hidden="true" style={{ fontSize: 13 }}>+</span>
                            Adicionar novo CNPJ
                          </div>
                        )}
                      </div>
                    ) : null}

                    {!controladoriaCnpjDropdownAberto && controladoriaCnpjSelecionado ? (
                      <div
                        style={{
                          padding: '5px 12px',
                          fontSize: 11,
                          color: 'var(--color-text-tertiary)',
                          borderTop: '0.5px solid var(--color-border-tertiary)',
                          background: 'var(--color-background-secondary)'
                        }}
                      >
                        Clique para trocar a empresa
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {isAreaCasa && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 13,
                      fontWeight: 500,
                      color: 'var(--color-text-primary)',
                      marginBottom: 6
                    }}
                  >
                    Casa
                  </label>

                  <div style={{
                    border: '0.5px solid #e0d9ce',
                    borderRadius: 8,
                    padding: '5px 8px',
                    background: '#fff',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6
                  }}>
                    {casasSelecionadas.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                        {casasSelecionadas.map(casaId => {
                          const nomeCasa = casas.find(c => String(c.id) === String(casaId))?.nome || casaId
                          return (
                            <span key={casaId} style={{
                              display: 'inline-flex', alignItems: 'center', gap: 3,
                              padding: '1px 6px 1px 8px',
                              background: '#e8f0e4',
                              border: '0.5px solid #b8d4b0',
                              borderRadius: 999,
                              fontSize: 11,
                              fontWeight: 500,
                              color: '#2d4a28'
                            }}>
                              {nomeCasa}
                              <button
                                type="button"
                                onClick={() => removerCasa(casaId)}
                                disabled={salvandoAdd}
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  color: '#5c8a5c',
                                  fontSize: 13,
                                  lineHeight: 1,
                                  padding: '0 1px'
                                }}
                              >
                                ×
                              </button>
                            </span>
                          )
                        })}
                      </div>
                    )}

                    <div data-dropdown-casa style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onMouseDown={e => e.stopPropagation()}
                        onClick={() => setDropdownCasaAberto(v => !v)}
                        disabled={salvandoAdd}
                        style={{
                          width: '100%',
                          height: 32,
                          padding: '0 10px',
                          border: 'none',
                          borderRadius: 7,
                          background: 'transparent',
                          fontSize: 13,
                          textAlign: 'left',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          color: '#5c5c5c'
                        }}
                      >
                        <span>+ Selecionar casa...</span>
                        <span style={{ fontSize: 10 }}>{dropdownCasaAberto ? '▲' : '▼'}</span>
                      </button>

                      {dropdownCasaAberto && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            zIndex: 50,
                            background: '#fff',
                            border: '0.5px solid #e0d9ce',
                            borderRadius: 8,
                            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                            marginTop: 2,
                            maxHeight: 260,
                            overflowY: 'auto'
                          }}
                        >
                          {(casas || []).length === 0 && !isAdmin && (
                            <div style={{ padding: '8px 10px', fontSize: 12, color: '#5c5c5c' }}>
                              Nenhuma casa cadastrada.
                            </div>
                          )}
                          {(casas || []).map(casa => {
                            const selecionada = casasSelecionadas.includes(String(casa.id))
                            return (
                              <div
                                key={casa.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '6px 10px',
                                  borderBottom: '0.5px solid #f0ebe1',
                                  fontSize: 13
                                }}
                              >
                                {editandoCasa?.id === casa.id ? (
                                  <>
                                    <input
                                      value={nomeCasaEdit}
                                      onChange={e => setNomeCasaEdit(e.target.value)}
                                      style={{
                                        flex: 1,
                                        height: 24,
                                        padding: '0 6px',
                                        border: '0.5px solid #e0d9ce',
                                        borderRadius: 5,
                                        fontSize: 12
                                      }}
                                      autoFocus
                                      onKeyDown={e => { if (e.key === 'Enter') handleSalvarEdicaoCasa() }}
                                    />
                                    <button type="button" onClick={handleSalvarEdicaoCasa} style={btnSalvar}>✓</button>
                                    <button type="button" onClick={() => setEditandoCasa(null)} style={btnCancelar}>×</button>
                                  </>
                                ) : (
                                  <>
                                    <span
                                      onClick={() => { if (!selecionada) adicionarCasa(casa.id) }}
                                      style={{
                                        flex: 1,
                                        cursor: selecionada ? 'default' : 'pointer',
                                        color: '#2d2d2d',
                                        textDecoration: selecionada ? 'line-through' : 'none',
                                        opacity: selecionada ? 0.4 : 1
                                      }}
                                    >
                                      {casa.nome}
                                    </span>
                                    {isAdmin && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={e => { e.stopPropagation(); iniciarEdicaoCasaInline(casa) }}
                                          title="Editar"
                                          style={{ ...GANTT_ACAO_BTN_EDITAR, flexShrink: 0 }}
                                        >
                                          ✎
                                        </button>
                                        <button
                                          type="button"
                                          onClick={e => { e.stopPropagation(); removerCasaGlobalInline(casa) }}
                                          title="Remover"
                                          style={{ ...GANTT_ACAO_BTN_EXCLUIR, flexShrink: 0 }}
                                        >
                                          ×
                                        </button>
                                      </>
                                    )}
                                  </>
                                )}
                              </div>
                            )
                          })}

                          {isAdmin && (
                            <div style={{ padding: '6px 10px', borderTop: '0.5px solid #e0d9ce' }}>
                              {criandoCasa ? (
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <input
                                    value={novaCasaNome}
                                    onChange={e => setNovaCasaNome(e.target.value)}
                                    placeholder="Nome da casa..."
                                    style={{
                                      flex: 1,
                                      height: 26,
                                      padding: '0 6px',
                                      border: '0.5px solid #e0d9ce',
                                      borderRadius: 6,
                                      fontSize: 12
                                    }}
                                    autoFocus
                                    onKeyDown={e => { if (e.key === 'Enter') criarNovaCasaInline() }}
                                  />
                                  <button type="button" onClick={criarNovaCasaInline} style={btnSalvar}>✓</button>
                                  <button type="button" onClick={() => setCriandoCasa(false)} style={btnCancelar}>×</button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setCriandoCasa(true)}
                                  style={{
                                    fontSize: 12,
                                    color: '#2d4a28',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: 0,
                                    fontWeight: 500
                                  }}
                                >
                                  + Nova casa
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {erroCasa && (
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 12,
                        color: '#8B1A1A',
                        background: '#FFB8B8',
                        padding: '6px 10px',
                        borderRadius: 'var(--border-radius-md)'
                      }}
                    >
                      {erroCasa}
                    </div>
                  )}
                </div>
              )}

              {isAreaFranqueado && (() => {
                const visiveis = franqueadosAtivos.filter(f => !f.oculto)
                const ocultos = franqueadosAtivos.filter(f => f.oculto)
                return (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: 'var(--color-text-secondary)',
                        display: 'block',
                        marginBottom: 6
                      }}
                    >
                      Franqueado — Condomínio e Lote
                    </label>

                    <div
                      style={{
                        border: '0.5px solid var(--color-border-tertiary)',
                        borderRadius: 'var(--border-radius-md)',
                        overflow: 'hidden'
                      }}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setAcoplamentoDropdownAberto(prev => !prev)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setAcoplamentoDropdownAberto(prev => !prev)
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '9px 12px',
                          cursor: 'pointer',
                          borderLeft: acoplamentoFranqueadoId ? '3px solid #1a2e1a' : '3px solid transparent',
                          background: acoplamentoFranqueadoId ? '#f0f6f0' : 'var(--color-background-primary)',
                          transition: 'background .15s'
                        }}
                      >
                        <div
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            flexShrink: 0,
                            border: `1.5px solid ${acoplamentoFranqueadoId ? '#1a2e1a' : 'var(--color-border-secondary)'}`,
                            background: acoplamentoFranqueadoId ? '#1a2e1a' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          {acoplamentoFranqueadoId ? (
                            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff' }} />
                          ) : null}
                        </div>
                        <span
                          style={{
                            flex: 1,
                            fontSize: 13,
                            color: acoplamentoFranqueadoId ? '#1a2e1a' : 'var(--color-text-tertiary)',
                            fontWeight: acoplamentoFranqueadoId ? 500 : 400
                          }}
                        >
                          {acoplamentoFranqueadoId
                            ? franqueadosAtivos.find(f => String(f.id) === String(acoplamentoFranqueadoId))?.nome ?? '...'
                            : 'Selecione ou cadastre...'}
                        </span>
                        <span
                          aria-hidden="true"
                          style={{
                            fontSize: 13,
                            color: 'var(--color-text-tertiary)',
                            transition: 'transform .2s',
                            transform: acoplamentoDropdownAberto ? 'rotate(180deg)' : 'rotate(0deg)',
                            lineHeight: 1
                          }}
                        >
                          ▾
                        </span>
                      </div>

                      {acoplamentoDropdownAberto ? (
                        <div style={{ borderTop: '0.5px solid var(--color-border-tertiary)' }}>
                          <div style={{ display: 'flex', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                            <input
                              type="text"
                              value={novoFranqueadoNome}
                              onChange={e => setNovoFranqueadoNome(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  void handleAdicionarFranqueado()
                                }
                              }}
                              placeholder="Ex: João Silva — Cond. Horizonte"
                              disabled={salvandoAdd}
                              style={{
                                flex: 1,
                                padding: '8px 10px',
                                border: 'none',
                                fontSize: 13,
                                background: 'var(--color-background-secondary)',
                                outline: 'none',
                                color: 'var(--color-text-primary)'
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => void handleAdicionarFranqueado()}
                              disabled={salvandoAdd}
                              style={{
                                padding: '8px 13px',
                                background: '#1a2e1a',
                                color: '#fff',
                                border: 'none',
                                fontSize: 15,
                                cursor: 'pointer',
                                fontWeight: 500
                              }}
                            >
                              +
                            </button>
                          </div>

                          {visiveis.map(item => {
                            const selecionado = String(acoplamentoFranqueadoId) === String(item.id)
                            const selecionar = () => {
                              setAcoplamentoFranqueadoId(item.id)
                              setAcoplamentoDropdownAberto(false)
                            }
                            return (
                              <div
                                key={item.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  borderBottom: '0.5px solid var(--color-border-tertiary)',
                                  cursor: 'pointer',
                                  borderLeft: selecionado ? '3px solid #1a2e1a' : '3px solid transparent',
                                  background: selecionado ? '#f0f6f0' : 'var(--color-background-primary)',
                                  transition: 'background .1s'
                                }}
                              >
                                <div
                                  style={{
                                    width: 36,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                  }}
                                  onClick={selecionar}
                                >
                                  <div
                                    style={{
                                      width: 14,
                                      height: 14,
                                      borderRadius: '50%',
                                      border: `1.5px solid ${selecionado ? '#1a2e1a' : 'var(--color-border-secondary)'}`,
                                      background: selecionado ? '#1a2e1a' : 'transparent',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center'
                                    }}
                                  >
                                    {selecionado ? (
                                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff' }} />
                                    ) : null}
                                  </div>
                                </div>
                                <span
                                  onClick={selecionar}
                                  style={{
                                    flex: 1,
                                    padding: '9px 0',
                                    fontSize: 13,
                                    color: selecionado ? '#1a2e1a' : 'var(--color-text-primary)',
                                    fontWeight: selecionado ? 500 : 400
                                  }}
                                >
                                  {item.nome}
                                </span>
                                <span
                                  role="button"
                                  tabIndex={0}
                                  onClick={e => {
                                    e.stopPropagation()
                                    void handleOcultarFranqueado(item.id)
                                  }}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      void handleOcultarFranqueado(item.id)
                                    }
                                  }}
                                  style={{
                                    padding: '9px 12px',
                                    fontSize: 11,
                                    color: 'var(--color-text-tertiary)',
                                    borderLeft: '0.5px solid var(--color-border-tertiary)',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Ocultar
                                </span>
                              </div>
                            )
                          })}

                          {visiveis.length === 0 ? (
                            <div
                              style={{
                                padding: 12,
                                fontSize: 13,
                                color: 'var(--color-text-tertiary)',
                                textAlign: 'center'
                              }}
                            >
                              Nenhum franqueado cadastrado.
                            </div>
                          ) : null}

                          {ocultos.length > 0 ? (
                            <>
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={() => setAcoplamentoOcultosAbertos(prev => !prev)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    setAcoplamentoOcultosAbertos(prev => !prev)
                                  }
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  padding: '7px 12px',
                                  background: 'var(--color-background-secondary)',
                                  cursor: 'pointer',
                                  borderTop: '0.5px solid var(--color-border-tertiary)'
                                }}
                              >
                                <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>Ocultos</span>
                                <span style={{ flex: 1 }} />
                                <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{ocultos.length}</span>
                                <span
                                  aria-hidden="true"
                                  style={{
                                    fontSize: 12,
                                    color: 'var(--color-text-tertiary)',
                                    transition: 'transform .2s',
                                    transform: acoplamentoOcultosAbertos ? 'rotate(180deg)' : 'rotate(0deg)',
                                    lineHeight: 1
                                  }}
                                >
                                  ▾
                                </span>
                              </div>
                              {acoplamentoOcultosAbertos
                                ? ocultos.map(item => (
                                    <div
                                      key={item.id}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '7px 12px',
                                        borderTop: '0.5px solid var(--color-border-tertiary)',
                                        opacity: 0.55,
                                        background: 'var(--color-background-secondary)'
                                      }}
                                    >
                                      <span
                                        style={{
                                          flex: 1,
                                          fontSize: 12,
                                          color: 'var(--color-text-secondary)',
                                          paddingLeft: 36
                                        }}
                                      >
                                        {item.nome}
                                      </span>
                                      <span
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => void handleMostrarFranqueado(item.id)}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault()
                                            void handleMostrarFranqueado(item.id)
                                          }
                                        }}
                                        style={{
                                          fontSize: 11,
                                          color: '#2e7d32',
                                          padding: '2px 8px',
                                          border: '0.5px solid #b8c8b8',
                                          borderRadius: 4,
                                          background: '#f4f8f4',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        Mostrar
                                      </span>
                                    </div>
                                  ))
                                : null}
                            </>
                          ) : null}
                        </div>
                      ) : null}

                      {!acoplamentoDropdownAberto && acoplamentoFranqueadoId ? (
                        <div
                          style={{
                            padding: '5px 12px',
                            fontSize: 11,
                            color: 'var(--color-text-tertiary)',
                            borderTop: '0.5px solid var(--color-border-tertiary)',
                            background: 'var(--color-background-secondary)'
                          }}
                        >
                          Clique para trocar o franqueado
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              })()}

{isAreaPortfolio && (() => {
                const visiveis = portfolioFranqueados.filter(f => !f.oculto)
                const ocultos = portfolioFranqueados.filter(f => f.oculto)
                return (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: 'var(--color-text-secondary)',
                        display: 'block',
                        marginBottom: 6
                      }}
                    >
                      Franqueado — Condomínio e Lote
                    </label>

                    <div
                      style={{
                        border: '0.5px solid var(--color-border-tertiary)',
                        borderRadius: 'var(--border-radius-md)',
                        overflow: 'hidden'
                      }}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setPortfolioDropdownAberto(prev => !prev)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setPortfolioDropdownAberto(prev => !prev)
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '9px 12px',
                          cursor: 'pointer',
                          borderLeft: portfolioFranqueadoId ? '3px solid #1a2e1a' : '3px solid transparent',
                          background: portfolioFranqueadoId ? '#f0f6f0' : 'var(--color-background-primary)',
                          transition: 'background .15s'
                        }}
                      >
                        <div
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            flexShrink: 0,
                            border: `1.5px solid ${portfolioFranqueadoId ? '#1a2e1a' : 'var(--color-border-secondary)'}`,
                            background: portfolioFranqueadoId ? '#1a2e1a' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          {portfolioFranqueadoId ? (
                            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff' }} />
                          ) : null}
                        </div>
                        <span
                          style={{
                            flex: 1,
                            fontSize: 13,
                            color: portfolioFranqueadoId ? '#1a2e1a' : 'var(--color-text-tertiary)',
                            fontWeight: portfolioFranqueadoId ? 500 : 400
                          }}
                        >
                          {portfolioFranqueadoId
                            ? portfolioFranqueados.find(f => String(f.id) === String(portfolioFranqueadoId))?.nome ?? '...'
                            : 'Selecione ou cadastre...'}
                        </span>
                        <span
                          aria-hidden="true"
                          style={{
                            fontSize: 13,
                            color: 'var(--color-text-tertiary)',
                            transition: 'transform .2s',
                            transform: portfolioDropdownAberto ? 'rotate(180deg)' : 'rotate(0deg)',
                            lineHeight: 1
                          }}
                        >
                          ▾
                        </span>
                      </div>

                      {portfolioDropdownAberto ? (
                        <div style={{ borderTop: '0.5px solid var(--color-border-tertiary)' }}>
                          <div style={{ display: 'flex', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                            <input
                              type="text"
                              value={novoPortfolioFranqueado}
                              onChange={e => setNovoPortfolioFranqueado(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  void handleAdicionarPortfolioFranqueado()
                                }
                              }}
                              placeholder="Ex: João Silva — Cond. Horizonte"
                              disabled={salvandoAdd}
                              style={{
                                flex: 1,
                                padding: '8px 10px',
                                border: 'none',
                                fontSize: 13,
                                background: 'var(--color-background-secondary)',
                                outline: 'none',
                                color: 'var(--color-text-primary)'
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => void handleAdicionarPortfolioFranqueado()}
                              disabled={salvandoAdd}
                              style={{
                                padding: '8px 13px',
                                background: '#1a2e1a',
                                color: '#fff',
                                border: 'none',
                                fontSize: 15,
                                cursor: 'pointer',
                                fontWeight: 500
                              }}
                            >
                              +
                            </button>
                          </div>

                          {visiveis.map(item => {
                            const selecionado = String(portfolioFranqueadoId) === String(item.id)
                            const selecionar = () => {
                              setPortfolioFranqueadoId(item.id)
                              setPortfolioDropdownAberto(false)
                            }
                            return (
                              <div
                                key={item.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  borderBottom: '0.5px solid var(--color-border-tertiary)',
                                  cursor: 'pointer',
                                  borderLeft: selecionado ? '3px solid #1a2e1a' : '3px solid transparent',
                                  background: selecionado ? '#f0f6f0' : 'var(--color-background-primary)',
                                  transition: 'background .1s'
                                }}
                              >
                                <div
                                  style={{
                                    width: 36,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                  }}
                                  onClick={selecionar}
                                >
                                  <div
                                    style={{
                                      width: 14,
                                      height: 14,
                                      borderRadius: '50%',
                                      border: `1.5px solid ${selecionado ? '#1a2e1a' : 'var(--color-border-secondary)'}`,
                                      background: selecionado ? '#1a2e1a' : 'transparent',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center'
                                    }}
                                  >
                                    {selecionado ? (
                                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff' }} />
                                    ) : null}
                                  </div>
                                </div>
                                <span
                                  onClick={selecionar}
                                  style={{
                                    flex: 1,
                                    padding: '9px 0',
                                    fontSize: 13,
                                    color: selecionado ? '#1a2e1a' : 'var(--color-text-primary)',
                                    fontWeight: selecionado ? 500 : 400
                                  }}
                                >
                                  {item.nome}
                                </span>
                                <span
                                  role="button"
                                  tabIndex={0}
                                  onClick={e => {
                                    e.stopPropagation()
                                    void handleOcultarPortfolioFranqueado(item.id)
                                  }}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      void handleOcultarPortfolioFranqueado(item.id)
                                    }
                                  }}
                                  style={{
                                    padding: '9px 12px',
                                    fontSize: 11,
                                    color: 'var(--color-text-tertiary)',
                                    borderLeft: '0.5px solid var(--color-border-tertiary)',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Ocultar
                                </span>
                              </div>
                            )
                          })}

                          {visiveis.length === 0 ? (
                            <div
                              style={{
                                padding: 12,
                                fontSize: 13,
                                color: 'var(--color-text-tertiary)',
                                textAlign: 'center'
                              }}
                            >
                              Nenhum franqueado cadastrado.
                            </div>
                          ) : null}

                          {ocultos.length > 0 ? (
                            <>
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={() => setPortfolioOcultosAbertos(prev => !prev)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    setPortfolioOcultosAbertos(prev => !prev)
                                  }
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  padding: '7px 12px',
                                  background: 'var(--color-background-secondary)',
                                  cursor: 'pointer',
                                  borderTop: '0.5px solid var(--color-border-tertiary)'
                                }}
                              >
                                <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>Ocultos</span>
                                <span style={{ flex: 1 }} />
                                <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{ocultos.length}</span>
                                <span
                                  aria-hidden="true"
                                  style={{
                                    fontSize: 12,
                                    color: 'var(--color-text-tertiary)',
                                    transition: 'transform .2s',
                                    transform: portfolioOcultosAbertos ? 'rotate(180deg)' : 'rotate(0deg)',
                                    lineHeight: 1
                                  }}
                                >
                                  ▾
                                </span>
                              </div>
                              {portfolioOcultosAbertos
                                ? ocultos.map(item => (
                                    <div
                                      key={item.id}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '7px 12px',
                                        borderTop: '0.5px solid var(--color-border-tertiary)',
                                        opacity: 0.55,
                                        background: 'var(--color-background-secondary)'
                                      }}
                                    >
                                      <span
                                        style={{
                                          flex: 1,
                                          fontSize: 12,
                                          color: 'var(--color-text-secondary)',
                                          paddingLeft: 36
                                        }}
                                      >
                                        {item.nome}
                                      </span>
                                      <span
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => void handleMostrarPortfolioFranqueado(item.id)}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault()
                                            void handleMostrarPortfolioFranqueado(item.id)
                                          }
                                        }}
                                        style={{
                                          fontSize: 11,
                                          color: '#2e7d32',
                                          padding: '2px 8px',
                                          border: '0.5px solid #b8c8b8',
                                          borderRadius: 4,
                                          background: '#f4f8f4',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        Mostrar
                                      </span>
                                    </div>
                                  ))
                                : null}
                            </>
                          ) : null}
                        </div>
                      ) : null}

                      {!portfolioDropdownAberto && portfolioFranqueadoId ? (
                        <div
                          style={{
                            padding: '5px 12px',
                            fontSize: 11,
                            color: 'var(--color-text-tertiary)',
                            borderTop: '0.5px solid var(--color-border-tertiary)',
                            background: 'var(--color-background-secondary)'
                          }}
                        >
                          Clique para trocar o franqueado
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              })()}

              <div className="gantt-add-drawer-atividades-block">
                <div className="gantt-add-drawer-col-title gantt-add-drawer-col-title--row">
                  <span>Atividades</span>
                  <span className="gantt-add-drawer-badge">{addAcaoIds.length}</span>
                </div>
                <div className="gantt-add-acao-checkboxes" role="group" aria-label="Atividades">
                  {atividadesDisponiveisDoComportamento.length === 0 ? (
                    <div className="gantt-add-drawer-empty">
                      {addTarefaId ? 'Nenhuma atividade neste comportamento.' : 'Selecione um comportamento para listar as atividades.'}
                    </div>
                  ) : atividadesDrawerPorTipo ? (
                    <>
                      {atividadesDrawerPorTipo.modelagem.length > 0 && (
                        <>
                          <div className="gantt-add-drawer-grupo-tipo gantt-add-drawer-grupo-tipo--modelagem">Modelagem</div>
                          {atividadesDrawerPorTipo.modelagem.map(a => (
                            <label key={a.id} className="gantt-add-acao-check-row">
                              <input
                                type="checkbox"
                                checked={addAcaoIds.includes(a.id)}
                                onChange={() => toggleAcaoAdd(a.id)}
                              />
                              <span className="gantt-add-acao-check-label">
                                <span className="gantt-add-acao-check-nome">{a.nome}</span>
                                <span className="gantt-add-acao-check-horas gantt-add-acao-check-horas--mod">
                                  {textoCargaEstimadaDrawer(minutosAcaoDrawer(a))}
                                </span>
                              </span>
                            </label>
                          ))}
                        </>
                      )}
                      {atividadesDrawerPorTipo.documentacao.length > 0 && (
                        <>
                          <div className="gantt-add-drawer-grupo-tipo gantt-add-drawer-grupo-tipo--documentacao">Documentação</div>
                          {atividadesDrawerPorTipo.documentacao.map(a => (
                            <label key={a.id} className="gantt-add-acao-check-row">
                              <input
                                type="checkbox"
                                checked={addAcaoIds.includes(a.id)}
                                onChange={() => toggleAcaoAdd(a.id)}
                              />
                              <span className="gantt-add-acao-check-label">
                                <span className="gantt-add-acao-check-nome">{a.nome}</span>
                                <span className="gantt-add-acao-check-horas gantt-add-acao-check-horas--doc">
                                  {textoCargaEstimadaDrawer(minutosAcaoDrawer(a))}
                                </span>
                              </span>
                            </label>
                          ))}
                        </>
                      )}
                      {atividadesDrawerPorTipo.scenario === 'misto' && atividadesDrawerPorTipo.comum.length > 0 && (
                        <>
                          <div className="gantt-add-drawer-grupo-tipo gantt-add-drawer-grupo-tipo--comum">Comum</div>
                          {atividadesDrawerPorTipo.comum.map(a => (
                            <label key={a.id} className="gantt-add-acao-check-row">
                              <input
                                type="checkbox"
                                checked={addAcaoIds.includes(a.id)}
                                onChange={() => toggleAcaoAdd(a.id)}
                              />
                              <span className="gantt-add-acao-check-label">
                                <span className="gantt-add-acao-check-nome">{a.nome}</span>
                                <span className="gantt-add-acao-check-horas gantt-add-acao-check-horas--neutro">
                                  {textoCargaEstimadaDrawer(minutosAcaoDrawer(a))}
                                </span>
                              </span>
                            </label>
                          ))}
                        </>
                      )}
                    </>
                  ) : (
                    atividadesDisponiveisDoComportamento.map(a => (
                      <label key={a.id} className="gantt-add-acao-check-row">
                        <input
                          type="checkbox"
                          checked={addAcaoIds.includes(a.id)}
                          onChange={() => toggleAcaoAdd(a.id)}
                        />
                        {isAreaTipoAtividadeProjeto ? (
                          <span className="gantt-add-acao-check-label">
                            <span className="gantt-add-acao-check-nome">{a.nome}</span>
                            <span className="gantt-add-acao-check-horas gantt-add-acao-check-horas--neutro">
                              {textoCargaEstimadaDrawer(minutosAcaoDrawer(a))}
                            </span>
                          </span>
                        ) : (
                          <span>{a.nome}</span>
                        )}
                      </label>
                    ))
                  )}
                </div>
                <div className="gantt-add-acao-check-actions gantt-add-acao-check-actions--below">
                  <button
                    type="button"
                    className="btn btn-sm gantt-add-semanas-btn"
                    onClick={() => setAddAcaoIds(atividadesDisponiveisDoComportamento.map(a => a.id))}
                    disabled={atividadesDisponiveisDoComportamento.length === 0}
                  >
                    Todas
                  </button>
                  <button type="button" className="btn btn-sm gantt-add-semanas-btn" onClick={() => setAddAcaoIds([])}>
                    Limpar
                  </button>
                </div>
              </div>
            </div>

            <div className="workload-drawer-form-inner gantt-add-drawer-bottom">
              <style suppressHydrationWarning>{`
                .gantt-add-drawer-bottom .responsaveis-multi-trigger,
                .gantt-add-drawer-bottom .responsaveis-multi-panel {
                  background: var(--color-background-primary, #ffffff) !important;
                }
                .gantt-add-drawer-bottom .responsaveis-multi-novo-row .btn {
                  padding: 7px 16px !important;
                  border: 0.5px solid var(--color-border-secondary) !important;
                  border-radius: var(--border-radius-md) !important;
                  background: var(--color-background-primary) !important;
                  color: var(--color-text-primary) !important;
                  font-size: 13px !important;
                  cursor: pointer !important;
                  box-shadow: none !important;
                }
              `}</style>
              <div className="form-group gantt-add-drawer-field">
                <label id="gantt-add-resp-label" htmlFor="gantt-add-resp">Responsável</label>
                <ResponsaveisAreaMultiSelect
                  id="gantt-add-resp"
                  labelId="gantt-add-resp-label"
                  pessoas={areaPessoasLista}
                  valueIds={addResponsavelPessoaIds}
                  onChange={setAddResponsavelPessoaIds}
                  disabled={salvandoAdd}
                  emptyHint={areaPessoasTabelaAusente ? 'Configure area_pessoas no Supabase (aviso acima).' : ''}
                  profiles={allProfiles}
                  onAdicionarProfile={adicionarProfileNaArea}
                  onOcultarPessoa={ocultarPessoaGantt}
                  salvandoNovaPessoa={salvandoPessoaGantt}
                />
              </div>

              <div className="form-group gantt-add-drawer-field gantt-add-semanas-block">
                <div className="gantt-add-semanas-label">Semanas</div>
                <div className="gantt-semanas-grid-drawer" role="group" aria-label="Semanas">
                  {(semanasModalAdicionar || []).map(s => {
                    const on = addSemanasSelecionadas.includes(s)
                    return (
                      <label key={s} className={`gantt-semana-pill ${on ? 'gantt-semana-pill--on' : ''}`}>
                        <input type="checkbox" checked={on} onChange={() => toggleSemanaAdd(s)} />
                        <span className="gantt-semana-pill-num">{s}</span>
                      </label>
                    )
                  })}
                </div>
                <div className="gantt-add-semanas-quick gantt-add-semanas-quick--below">
                  <button type="button" className="btn btn-sm gantt-add-semanas-btn" onClick={() => setAddSemanasSelecionadas((semanasModalAdicionar || []).slice())}>
                    Todas
                  </button>
                  <button type="button" className="btn btn-sm gantt-add-semanas-btn" onClick={() => setAddSemanasSelecionadas([])}>
                    Nenhuma
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </WorkloadFormDrawer>

      <WorkloadFormDrawer
        open={excluirMetaDrawerAberto}
        title="Excluir meta"
        titleId="excluir-meta-drawer-title"
        rootClassName="definir-meta-drawer-z"
        panelClassName="definir-meta-drawer-panel"
        closeDisabled={Boolean(metaExcluindoId)}
        onClose={fecharExcluirMetaDrawer}
        ariaDescribedBy="excluir-meta-drawer-desc"
        footer={(
          <>
            <button
              type="button"
              className="workload-form-drawer-footer-btn workload-form-drawer-footer-btn--cancel"
              onClick={fecharExcluirMetaDrawer}
              disabled={Boolean(metaExcluindoId)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="workload-form-drawer-footer-btn workload-form-drawer-footer-btn--danger"
              disabled={Boolean(metaExcluindoId) || !metaParaExcluir?.id}
              onClick={() => executarExclusaoMetaConfirmada(metaParaExcluir?.id)}
            >
              {metaExcluindoId ? 'Excluindo…' : 'Excluir meta'}
            </button>
          </>
        )}
      >
        <p id="excluir-meta-drawer-desc" style={{ margin: 0, lineHeight: 1.5, color: 'var(--moni-texto)' }}>
          Tem certeza que deseja excluir esta meta?
        </p>
        {metaParaExcluir?.descricao && (
          <p style={{ margin: '12px 0 0', padding: '10px 12px', background: 'var(--moni-creme-card)', border: '1px solid var(--moni-borda)', borderRadius: 8, fontWeight: 500 }}>
            {String(metaParaExcluir.descricao).trim() || '—'}
          </p>
        )}
        <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--moni-texto-suave)', lineHeight: 1.45 }}>
          Comportamentos vinculados a ela na Workload ficarão sem meta. As atividades já planejadas no Gantt permanecem até você removê-las.
        </p>
      </WorkloadFormDrawer>

      {concluirMetaModalAberto && (metaParaConcluir || indicadorParaConcluir) && (() => {
        const alvoInd = indicadorParaConcluir
        const alvoMeta = metaParaConcluir
        const chipAtual = alvoInd
          ? semanaAtualChipConclusaoMeta(
              { tipo: 'atingivel', meta_unidade: alvoInd.meta_unidade },
              semanaAtual
            )
          : semanaAtualChipConclusaoMeta(alvoMeta, semanaAtual)
        const prazoChip = alvoInd
          ? labelPrazoChipConclusaoMeta({ meta_unidade: alvoInd.meta_unidade })
          : labelPrazoChipConclusaoMeta(alvoMeta)
        const tituloModal = alvoInd ? 'Concluir indicador' : 'Concluir meta'
        const nomeAlvo = alvoInd
          ? String(alvoInd.nome || '—').trim() || '—'
          : String(alvoMeta?.descricao || '—').trim() || '—'
        const textoInfoMov = alvoInd
          ? 'Este indicador deixará de aparecer na grade de planejamento.'
          : 'Esta meta será movida para a aba Conquistas e não aparecerá mais no planejamento.'
        return (
          <div
            role="presentation"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1000,
              background: 'rgba(0, 0, 0, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16
            }}
            onClick={e => {
              if (e.target === e.currentTarget) fecharModalConclusaoMeta()
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="concluir-meta-title"
              onClick={e => e.stopPropagation()}
              style={{
                width: 'min(480px, calc(100% - 32px))',
                maxWidth: 560,
                borderRadius: 12,
                overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                background: 'var(--color-background-primary, #ffffff)'
              }}
            >
              <header
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '14px 16px',
                  background: '#1a2e1a',
                  borderBottom: '1px solid rgba(200,230,160,0.12)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <div
                    aria-hidden
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      border: '1px solid rgba(200,230,160,0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M20 6L9 17l-5-5"
                        stroke="#C8E6A0"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <h2
                    id="concluir-meta-title"
                    style={{
                      margin: 0,
                      fontSize: 15,
                      fontWeight: 500,
                      color: '#C8E6A0',
                      lineHeight: 1.25
                    }}
                  >
                    {tituloModal}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => fecharModalConclusaoMeta()}
                  aria-label="Fechar"
                  disabled={Boolean(concluindoMetaId)}
                  style={{
                    width: 32,
                    height: 32,
                    flexShrink: 0,
                    border: 'none',
                    borderRadius: 8,
                    background: 'transparent',
                    color: 'rgba(200,230,160,0.6)',
                    fontSize: 22,
                    lineHeight: 1,
                    cursor: concluindoMetaId ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0
                  }}
                >
                  ×
                </button>
              </header>
              <div style={{ padding: 20, background: 'var(--color-background-primary, #ffffff)' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px 14px',
                    marginBottom: 18,
                    background: 'var(--color-background-secondary)',
                    border: '0.5px solid var(--color-border-tertiary, #e5e7eb)',
                    borderRadius: 'var(--border-radius-md, 8px)'
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: '#639922',
                      flexShrink: 0
                    }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary, #111)' }}>
                    {nomeAlvo}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 16,
                    marginBottom: 18
                  }}
                >
                  <div
                    style={{
                      flex: '1 1 140px',
                      padding: '10px 12px',
                      background: 'var(--color-background-secondary)',
                      border: '0.5px solid var(--color-border-tertiary, #e5e7eb)',
                      borderRadius: 'var(--border-radius-md, 8px)'
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--color-text-tertiary, #6b7280)',
                        marginBottom: 4
                      }}
                    >
                      Prazo
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary, #111)' }}>
                      {prazoChip}
                    </div>
                  </div>
                  <div
                    style={{
                      flex: '1 1 140px',
                      padding: '10px 12px',
                      background: 'var(--color-background-secondary)',
                      border: '0.5px solid var(--color-border-tertiary, #e5e7eb)',
                      borderRadius: 'var(--border-radius-md, 8px)'
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--color-text-tertiary, #6b7280)',
                        marginBottom: 4
                      }}
                    >
                      Semana atual
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: chipAtual.noPrazo ? '#0F6E56' : '#BA7517'
                      }}
                    >
                      {chipAtual.atualLabel} · {chipAtual.noPrazo ? 'no prazo' : 'fora do prazo'}
                    </div>
                  </div>
                </div>
                <div style={{ marginBottom: 18 }}>
                  <label
                    htmlFor="concluir-meta-comentario"
                    style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary, #111)' }}
                  >
                    Comentário{' '}
                    <span style={{ fontWeight: 400, color: 'var(--color-text-tertiary, #6b7280)' }}>(opcional)</span>
                  </label>
                  <textarea
                    ref={concluirMetaComentarioRef}
                    id="concluir-meta-comentario"
                    value={comentarioConclusaoMeta}
                    onChange={e => setComentarioConclusaoMeta(e.target.value)}
                    placeholder="Adicionar observação sobre a conclusão…"
                    rows={3}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      resize: 'none',
                      padding: '10px 12px',
                      fontSize: 13,
                      lineHeight: 1.45,
                      background: 'var(--color-background-secondary)',
                      border: '0.5px solid var(--color-border-secondary, #d1d5db)',
                      borderRadius: 'var(--border-radius-md, 8px)',
                      color: 'var(--color-text-primary, #111)'
                    }}
                  />
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '10px 12px',
                    marginBottom: 18,
                    background: '#EAF3DE',
                    borderRadius: 'var(--border-radius-md, 8px)'
                  }}
                >
                  <div
                    aria-hidden
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: '#3B6D11',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: 1
                    }}
                  >
                    i
                  </div>
                  <p style={{ margin: 0, fontSize: 12, lineHeight: 1.45, color: '#27500A' }}>
                    {textoInfoMov}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={fecharModalConclusaoMeta}
                    disabled={Boolean(concluindoMetaId)}
                    style={{
                      flex: 1,
                      padding: '9px 12px',
                      fontSize: 13,
                      borderRadius: 'var(--border-radius-md, 8px)',
                      border: '0.5px solid var(--color-border-secondary, #d1d5db)',
                      background: 'transparent',
                      color: 'var(--color-text-secondary, #4b5563)',
                      cursor: concluindoMetaId ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={confirmarConclusaoMeta}
                    disabled={Boolean(concluindoMetaId)}
                    style={{
                      flex: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      padding: '9px 12px',
                      fontSize: 13,
                      fontWeight: 500,
                      borderRadius: 'var(--border-radius-md, 8px)',
                      border: 'none',
                      background: '#1a2e1a',
                      color: '#C8E6A0',
                      cursor: concluindoMetaId ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M20 6L9 17l-5-5"
                        stroke="#C8E6A0"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {concluindoMetaId ? 'Concluindo…' : 'Confirmar conclusão'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      <div className="card gantt-card">
        {!periodoId ? (
          <p className="empty-state">Selecione um período para carregar o planejamento.</p>
        ) : (
          <>
            <div className="gantt-table-shell">
              {ganttPlanejamentoTable.tableRows != null ? (
                <div className={`gantt-planejamento-scroll-wrap ${ganttCronogramaDensityClass}`}>
                  <table
                    className={`gantt-planejamento-table ${ganttCronogramaDensityClass}`}
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      tableLayout: 'fixed',
                      minWidth: Math.max(520, 200 + 100 + semanas.length * 28 + 96)
                    }}
                  >
                    <colgroup>
                      <col style={{ width: 200 }} />
                      <col style={{ width: 100 }} />
                      {semanas.map(s => (
                        <col key={s} className="gantt-col-week" />
                      ))}
                      <col style={{ width: 96 }} />
                    </colgroup>
                    <thead
                      style={{
                        position: 'sticky',
                        top: 0,
                        zIndex: 10,
                        backgroundColor: 'var(--color-background-primary)'
                      }}
                    >
                      <tr>
                        <th
                          scope="col"
                          style={{
                            textAlign: 'left',
                            padding: '7px 6px',
                            color: 'var(--hdr-text)',
                            fontSize: 10,
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            background: 'var(--comp-mid)',
                            borderRight: '0.5px solid rgba(255,255,255,0.08)'
                          }}
                        >
                          Atividade
                        </th>
                        <th
                          scope="col"
                          style={{
                            textAlign: 'center',
                            padding: '7px 6px',
                            color: 'var(--hdr-text)',
                            fontSize: 10,
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            background: 'var(--comp-mid)',
                            borderRight: '0.5px solid rgba(255,255,255,0.08)'
                          }}
                        >
                          Responsável
                        </th>
                        {semanas.map(s => {
                          const atual = semanaAtual != null && Number(s) === Number(semanaAtual)
                          return (
                            <th
                              key={s}
                              scope="col"
                              className={atual ? 'gantt-col-semana-atual' : undefined}
                              title={`Semana ${s}`}
                              style={{
                                textAlign: 'center',
                                padding: '5px 6px',
                                color: atual ? '#ffffff' : 'var(--hdr-text)',
                                fontSize: 10,
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                background: atual ? '#3A5528' : 'var(--comp-mid)',
                                ...(atual ? GANTT_BORDA_SEMANA_ATUAL_HDR : { borderRight: '0.5px solid rgba(255,255,255,0.08)' })
                              }}
                            >
                              {s}
                              {atual ? ' ★' : ''}
                              <span
                                style={{
                                  fontSize: 9,
                                  fontWeight: 600,
                                  color: atual ? '#ffffff' : 'var(--hdr-sub)',
                                  display: 'block',
                                  marginTop: 1,
                                  textTransform: 'none',
                                  letterSpacing: 0
                                }}
                              >
                                {getDatasSemanaCurta(s, periodo)}
                              </span>
                            </th>
                          )
                        })}
                        <th
                          scope="col"
                          style={{
                            textAlign: 'center',
                            padding: '7px 6px',
                            color: 'var(--hdr-text)',
                            fontSize: 10,
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            background: 'var(--comp-mid)',
                            borderRight: 'none'
                          }}
                        >
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody>{ganttPlanejamentoTable.tableRows}</tbody>
                  </table>
                </div>
              ) : null}
              {!(areaId && (linhasFiltradas.length > 0 || temAlgumIndicadorNaGrade)) && (
                <div className="gantt-table-message-banner" role="status">
                  {!areaId ? (
                    <p className="gantt-table-message-text">
                      Selecione uma área para carregar a lista de atividades da Workload e definir a semana de entrega de cada uma.
                    </p>
                  ) : loading ? (
                    <p className="gantt-table-message-text">Carregando atividades…</p>
                  ) : (
                    <p className="gantt-table-message-text">
                      Nenhuma atividade no plano para este trimestre. Use &quot;Adicionar Comportamento e atividades à meta&quot; para escolher atividades da Workload.
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {modalSelecionarRegistro && (
        <div
          className="workload-remove-modal-overlay"
          onMouseDown={e => {
            if (e.target === e.currentTarget) setModalSelecionarRegistro(null)
          }}
        >
          <div className="workload-remove-modal-card" role="dialog" aria-modal="true">
            <div className="workload-remove-modal-header">
              <h2 className="workload-remove-modal-title">Selecionar registro para editar</h2>
              <button
                type="button"
                className="workload-remove-modal-close"
                onClick={() => setModalSelecionarRegistro(null)}
                aria-label="Fechar"
              >×</button>
            </div>
            <div className="workload-remove-modal-body">
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
                Esta atividade tem múltiplos registros. Qual deseja editar?
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {modalSelecionarRegistro.rows.map((reg, idx) => {
                  const franqueado = reg.franqueado_nome ||
                    reg.casa_id || reg.adm_cnpj_id ||
                    reg.portfolio_franqueado_id ||
                    reg.comercial_candidato_id ||
                    reg.juridico_identificacao_id || '—'
                  const semanas = (reg.semanas_selecionadas || [])
                    .map(s => `S${s}`).join(', ') || '—'
                  return (
                    <button
                      key={reg.id || idx}
                      type="button"
                      onClick={() => {
                        setModalSelecionarRegistro(null)
                        abrirDrawerEditarPlanejamento(modalSelecionarRegistro.linha, reg)
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        border: '0.5px solid var(--color-border-secondary)',
                        borderRadius: 8,
                        background: 'var(--color-background-primary)',
                        cursor: 'pointer',
                        fontSize: 13,
                        textAlign: 'left',
                        width: '100%'
                      }}
                    >
                      <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>
                        {franqueado}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                        {semanas}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {modalExclusao && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(29,47,37,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50
          }}
          onMouseDown={e => {
            if (e.target === e.currentTarget) setModalExclusao(null)
          }}
        >
          <div
            style={{
              background: 'var(--color-background-primary)',
              borderRadius: 'var(--border-radius-lg)',
              border: '0.5px solid var(--color-border-tertiary)',
              width: 400,
              maxWidth: '90vw',
              overflow: 'hidden'
            }}
            onMouseDown={e => e.stopPropagation()}
          >
            <div style={{ padding: '14px 20px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                {modalExclusao.tipo === 'confirmar' ? 'Excluir planejamento' : 'Ação não permitida'}
              </span>
            </div>

            <div
              style={{
                padding: '16px 20px',
                fontSize: 13,
                color: 'var(--color-text-secondary)',
                lineHeight: 1.5
              }}
            >
              {modalExclusao.tipo === 'confirmar' ? (
                modalExclusao.mensagemAdmin ? (
                  <span style={{ whiteSpace: 'pre-line' }}>{modalExclusao.mensagemAdmin}</span>
                ) : (
                  <>
                    Deseja excluir o planejamento de{' '}
                    <strong style={{ color: 'var(--color-text-primary)' }}>{modalExclusao.nomeAtividade}</strong>
                    ? Esta ação não pode ser desfeita.
                  </>
                )
              ) : (
                modalExclusao.mensagem
              )}
            </div>

            <div
              style={{
                padding: '14px 20px',
                borderTop: '0.5px solid var(--color-border-tertiary)',
                background: 'var(--color-background-secondary)',
                display: 'flex',
                gap: 8,
                justifyContent: 'flex-end'
              }}
            >
              <button
                type="button"
                onClick={() => setModalExclusao(null)}
                style={{
                  padding: '7px 16px',
                  border: '0.5px solid var(--color-border-secondary)',
                  borderRadius: 'var(--border-radius-md)',
                  background: 'var(--color-background-primary)',
                  fontSize: 13,
                  cursor: 'pointer',
                  color: 'var(--color-text-secondary)'
                }}
              >
                {modalExclusao.tipo === 'confirmar' ? 'Cancelar' : 'Fechar'}
              </button>
              {modalExclusao.tipo === 'confirmar' && (
                <button
                  type="button"
                  onClick={() => {
                    const { planejamentoIds, origemCronogramaLegado } = modalExclusao
                    setModalExclusao(null)
                    void removerAtividade(planejamentoIds, { origemCronogramaLegado })
                  }}
                  style={{
                    padding: '7px 16px',
                    border: 'none',
                    borderRadius: 'var(--border-radius-md)',
                    background: '#A32D2D',
                    color: '#fff',
                    fontSize: 13,
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  Excluir
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {modalReverter && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--color-background-primary)',
            borderRadius: 12,
            border: '0.5px solid var(--color-border-tertiary)',
            padding: '28px 32px',
            maxWidth: 420,
            width: '90%',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              marginBottom: 16
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'var(--color-background-danger)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0
              }}>
                <span style={{ color: 'var(--color-text-danger)', fontSize: 18 }}>!</span>
              </div>
              <p style={{
                fontSize: 15, fontWeight: 500,
                color: 'var(--color-text-primary)', margin: 0
              }}>
                {modalReverter.etapa === 1
                  ? 'Reverter conclusão da meta?'
                  : 'Confirmação final'}
              </p>
            </div>

            <p style={{
              fontSize: 13, color: 'var(--color-text-secondary)',
              marginBottom: 8, lineHeight: 1.6
            }}>
              {modalReverter.etapa === 1 ? (
                <>
                  A meta <strong style={{ color: 'var(--color-text-primary)' }}>
                    &quot;{modalReverter.meta.descricao}&quot;
                  </strong> será reaberta e o registro em Conquistas será excluído.
                </>
              ) : (
                <>
                  Tem certeza? <strong style={{ color: 'var(--color-text-danger)' }}>
                    Essa operação não pode ser desfeita.
                  </strong>
                </>
              )}
            </p>

            <div style={{
              display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24
            }}>
              <button
                type="button"
                onClick={() => setModalReverter(null)}
                style={{
                  background: 'transparent',
                  border: '0.5px solid var(--color-border-secondary)',
                  borderRadius: 6, padding: '7px 16px',
                  fontSize: 13, cursor: 'pointer',
                  color: 'var(--color-text-secondary)'
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmarReverter()}
                style={{
                  background: 'var(--color-background-danger)',
                  border: '0.5px solid var(--color-border-danger)',
                  borderRadius: 6, padding: '7px 16px',
                  fontSize: 13, cursor: 'pointer',
                  color: 'var(--color-text-danger)',
                  fontWeight: 500
                }}
              >
                {modalReverter.etapa === 1 ? 'Continuar' : 'Sim, reverter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
