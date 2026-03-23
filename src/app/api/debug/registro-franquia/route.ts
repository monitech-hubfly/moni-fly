import { NextResponse } from 'next/server';
import { gerarRegistroFranquiaPdf } from '@/lib/registro-franquia-pdf';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const nome = url.searchParams.get('nome') ?? 'Ingrid Hora';
  const numero = url.searchParams.get('numero') ?? 'FK0000';
  const data = url.searchParams.get('data') ?? '2026-03-18';

  const pdfBytes = await gerarRegistroFranquiaPdf({
    nomeFranqueado: nome,
    numeroFranquia: numero,
    dataAssinaturaContrato: data,
  });

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename=\"registro-franquia-${numero}.pdf\"`,
    },
  });
}

