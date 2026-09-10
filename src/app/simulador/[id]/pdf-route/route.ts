import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement, type ReactElement } from 'react';
import { PropostaPDF } from '../PropostaPDF';
import { carregarSimuladorPublico } from '@/lib/simulador/carregar-simulador-publico';
import { calcularOferta, type OfertaConfig } from '@/lib/simulador/calcular-oferta';
import { montarPropostaPdfPayload, type PropostaPdfPayload } from '@/lib/simulador/proposta-pdf-data';
import { refProposta } from '@/lib/simulador/fluxo-proposta';
import {
  mapSimulacaoRow,
  prazoFase1DePrazoSalvo,
} from '@/lib/loteamento-simulador-template';
import { createClient } from '@/lib/supabase/server';
import { tryCreateAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function lerLogoMoni(): Buffer | undefined {
  const file = join(process.cwd(), 'public', 'logo-moni-preto-crop.png');
  if (!existsSync(file)) return undefined;
  return readFileSync(file);
}

function n0(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function texto(v: unknown): string {
  return String(v ?? '').trim();
}

async function resolverParams(params: { id: string } | Promise<{ id: string }>): Promise<string> {
  const p = await params;
  return String(p.id ?? '').trim();
}

function pdfResponse(buffer: Buffer, simulacaoId: string) {
  const ref = refProposta(simulacaoId);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="proposta-moni-${ref}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}

async function renderPdf(payload: PropostaPdfPayload) {
  const buffer = await renderToBuffer(
    createElement(PropostaPDF, { payload, logoSrc: lerLogoMoni() }) as ReactElement,
  );
  return pdfResponse(buffer, payload.simulacaoId);
}

function payloadEhValido(raw: unknown): raw is PropostaPdfPayload {
  if (!raw || typeof raw !== 'object') return false;
  const o = raw as PropostaPdfPayload;
  return Array.isArray(o.fluxo) && typeof o.loteamento === 'string';
}

async function carregarSimulacao(simulacaoId: string): Promise<Record<string, unknown> | null> {
  const admin = tryCreateAdminClient();
  const db = admin ?? (await createClient());
  const { data, error } = await db
    .from('simulacoes_pagamento')
    .select('*')
    .eq('id', simulacaoId)
    .maybeSingle();
  if (error || !data) return null;
  return data as Record<string, unknown>;
}

export async function GET(
  request: Request,
  context: { params: { id: string } | Promise<{ id: string }> },
) {
  try {
    const token = await resolverParams(context.params);
    const simulacaoId = new URL(request.url).searchParams.get('simulacaoId')?.trim() ?? '';
    if (!token || !simulacaoId) {
      return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 });
    }

    const view = await carregarSimuladorPublico(token);
    if (!view) return NextResponse.json({ error: 'Template não encontrado.' }, { status: 404 });

    const raw = await carregarSimulacao(simulacaoId);
    if (!raw) {
      return NextResponse.json(
        { error: 'Oferta não encontrada. Salve novamente ou use o download após salvar.' },
        { status: 404 },
      );
    }
    if (String(raw.template_id ?? '') !== view.templateId) {
      return NextResponse.json({ error: 'Oferta não pertence a este simulador.' }, { status: 403 });
    }

    const oferta = mapSimulacaoRow(raw);
    const inp =
      raw.inputs && typeof raw.inputs === 'object' && !Array.isArray(raw.inputs)
        ? (raw.inputs as Record<string, unknown>)
        : {};
    const prazoTotal = oferta.prazo_meses ?? 12;
    const config = view.config;
    const ofertaCalc: OfertaConfig = {
      valor_lote: oferta.valor_lote ?? 0,
      valor_casa: oferta.valor_casa ?? 0,
      valor_customizacao: oferta.valor_customizacao ?? 0,
      valor_ja_pago: oferta.valor_ja_pago ?? 0,
      prazo_meses: prazoFase1DePrazoSalvo(prazoTotal, view.prazoObraMeses),
      parcela_mensal: oferta.parcela_mensal ?? 0,
      renda_cliente: oferta.renda_cliente ?? 0,
      prazo_financiamento_anos: oferta.prazo_financiamento_anos ?? 30,
      taxa_financiamento_anual: oferta.taxa_financiamento_anual ?? view.taxaFinanciamentoAnual,
      entrada_confirmada: oferta.entrada_confirmada ?? undefined,
      mensal_confirmada: oferta.parcela_mensal_confirmada ?? undefined,
      parcela_unica_confirmada: oferta.parcela_unica_confirmada ?? undefined,
    };
    const resultado = calcularOferta(config, ofertaCalc);
    const loteId = texto(inp.lote_id) || texto(raw.lote_id);
    const loteCodigo = view.lotes.find((l) => l.id === loteId)?.codigo ?? null;

    const payload = montarPropostaPdfPayload({
      simulacaoId,
      loteamento: view.nomeLoteamento,
      loteCodigo,
      clienteNome: texto(raw.cliente_nome) || texto(inp.cliente_nome) || texto(oferta.nome),
      clienteTelefone: texto(raw.cliente_telefone) || texto(inp.cliente_telefone),
      clienteEmail: texto(raw.cliente_email) || texto(inp.cliente_email),
      valorLote: oferta.valor_lote ?? 0,
      valorCasa: oferta.valor_casa ?? 0,
      valorCustomizacao: oferta.valor_customizacao ?? 0,
      resultado,
      entradaConfirmada: oferta.entrada_confirmada ?? resultado.entrada_sugerida,
      mensalConfirmada: oferta.parcela_mensal_confirmada ?? resultado.parcela_mensal_usada,
      parcelaUnicaConfirmada: oferta.parcela_unica_confirmada ?? resultado.parcela_unica_sugerida,
      qtdParcelasMensais: prazoTotal,
      prazoFinanciamentoAnos: oferta.prazo_financiamento_anos ?? 30,
      taxaJurosAnualPct: n0(oferta.taxa_financiamento_anual ?? view.taxaFinanciamentoAnual) * 100,
    });

    return await renderPdf(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao gerar o PDF.';
    console.error('[proposta pdf GET]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: { id: string } | Promise<{ id: string }> },
) {
  try {
    const token = await resolverParams(context.params);
    const view = await carregarSimuladorPublico(token);
    if (!view) return NextResponse.json({ error: 'Template não encontrado.' }, { status: 404 });

    const body = (await request.json()) as unknown;
    if (!payloadEhValido(body)) {
      return NextResponse.json({ error: 'Payload da proposta inválido.' }, { status: 400 });
    }
    const payload: PropostaPdfPayload = {
      ...body,
      loteamento: body.loteamento || view.nomeLoteamento,
    };
    return await renderPdf(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao gerar o PDF.';
    console.error('[proposta pdf POST]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
