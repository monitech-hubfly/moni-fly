import { PDFDocument, PDFImage, StandardFonts, rgb } from 'pdf-lib';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

type Input = {
  nomeFranqueado: string;
  dataAssinaturaContrato: string;
  numeroFranquia: string;
};

function safeText(s: string | null | undefined): string {
  return String(s ?? '').trim();
}

export async function gerarRegistroFranquiaPdf(input: Input): Promise<Uint8Array> {
  const nome = safeText(input.nomeFranqueado) || '[Inserir Nome Inteiro do Franqueado]';
  const data = safeText(input.dataAssinaturaContrato) || '[Inserir Data]';
  const numero = safeText(input.numeroFranquia) || '[Inserir Número de Franquia Aqui]';

  const blue = rgb(0.1, 0.3, 0.65);

  // Preferir PDF como template de fundo (evita desalinhamento por escala).
  // O arquivo deve existir em: public/templates/numero-de-franquia.pdf
  const pdfTemplatePath = path.join(process.cwd(), 'public', 'templates', 'numero-de-franquia.pdf');
  try {
    const templateBytes = await readFile(pdfTemplatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);
    const page = pdfDoc.getPage(0);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Alguns PDFs já vêm com campos de formulário (AcroForm). Quando existe,
    // preencher os campos garante o posicionamento exato (sem depender de coordenadas).
    try {
      const form = (pdfDoc as any).getForm?.();
      const fields: any[] = form?.getFields?.() ?? [];
      if (fields.length > 0) {
        const nomeLower = String(nome).toLowerCase();
        const dataLower = String(data).toLowerCase();
        const numeroLower = String(numero).toLowerCase();

        for (const f of fields) {
          const fieldName = String(f?.getName?.() ?? '').toLowerCase();
          const canSetText = typeof f?.setText === 'function';
          if (!canSetText) continue;

          if (fieldName.includes('franque') || fieldName.includes('nome')) {
            f.setText(nomeLower ? nome : nome);
          } else if (fieldName.includes('data') || fieldName.includes('assin')) {
            f.setText(dataLower ? data : data);
          } else if (fieldName.includes('numero') || fieldName.includes('fk')) {
            f.setText(numeroLower ? numero : numero);
          }
        }

        // Atualiza aparência para refletir o texto novo (quando o template depende disso).
        if (typeof (form as any)?.updateFieldAppearances === 'function') {
          (form as any).updateFieldAppearances(fontBold);
        }
      }
    } catch {
      // Se não tiver AcroForm ou falhar ao preencher, seguimos com o carimbo por coordenadas.
    }

    // Coordenadas do template A4 (596x842) para as 3 caixas amarelas da seção:
    // Franqueado / Data da Assinatura / Número de Franquia.
    //
    // Se o texto ainda ficar "um pouco" deslocado no seu template,
    // ajuste aqui (passo pequeno: +/- 5 a 15 pontos).
    const labelSize = 12.5;
    const leftX = 170;
    const y1 = 350;
    const y2 = 295;
    const y3 = 245;

    // Desenha por coordenadas como “garantia” visual (mesmo quando o template usa AcroForm).
    // Isso elimina o caso em que o setText funciona mas a aparência não é atualizada corretamente.
    page.drawText(nome, { x: leftX, y: y1, size: labelSize, font: fontBold, color: blue });
    page.drawText(data, { x: leftX, y: y2, size: labelSize, font: fontBold, color: blue });
    page.drawText(numero, { x: leftX, y: y3, size: labelSize, font: fontBold, color: blue });

    return await pdfDoc.save();
  } catch {
    // fallback: template por imagem
  }

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4

  const fallbackFontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fallbackBlue = blue;

  // Template “limpo” (PNG/JPEG) como fundo — deixe um destes arquivos no projeto:
  // public/templates/registro-franquia-template.png
  // public/templates/registro-franquia-template.jpg
  try {
    const cwd = process.cwd();
    const templatesDir = path.join(cwd, 'public', 'templates');
    const candidates = [
      path.join(cwd, 'public', 'templates', 'registro-franquia-template.png'),
      path.join(cwd, 'public', 'templates', 'registro-franquia-template.jpg'),
      // fallback caso o cwd venha diferente em build/runtime
      path.join(cwd, '..', 'public', 'templates', 'registro-franquia-template.png'),
      path.join(cwd, '..', 'public', 'templates', 'registro-franquia-template.jpg'),
    ];

    // Se o template tiver o nome “original” (como no print), tentamos descobrir automaticamente
    // um PNG/JPG dentro de public/templates.
    try {
      const files = await readdir(templatesDir);
      const images = files.filter((f) => /\.(png|jpe?g)$/i.test(f));
      const prefer =
        images.find((f) => /n[uú]mero de franquia/i.test(f) && /casa mon[ií]/i.test(f)) ??
        images.find((f) => /registro/i.test(f) && /franquia/i.test(f)) ??
        images[0];
      if (prefer) candidates.unshift(path.join(templatesDir, prefer));
    } catch {
      // ignore
    }

    let img: PDFImage | null = null;
    let usedPath = '';
    let lastErr: unknown = null;
    for (const p of candidates) {
      try {
        const bytes = await readFile(p);
        usedPath = p;
        if (p.toLowerCase().endsWith('.png')) img = await pdfDoc.embedPng(bytes);
        else img = await pdfDoc.embedJpg(bytes);
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (!img) {
      const msg = lastErr instanceof Error ? lastErr.message : String(lastErr ?? 'unknown');
      throw new Error(`Não consegui ler template. Tentativas: ${candidates.join(' | ')}. Erro: ${msg}`);
    }

    // Desenha o JPEG ocupando a página inteira (cover).
    const pageW = page.getWidth();
    const pageH = page.getHeight();
    const imgW = img.width;
    const imgH = img.height;
    const scale = Math.max(pageW / imgW, pageH / imgH);
    const drawW = imgW * scale;
    const drawH = imgH * scale;
    const x = (pageW - drawW) / 2;
    const y = (pageH - drawH) / 2;
    page.drawImage(img, { x, y, width: drawW, height: drawH });

    // “Carimbo” dos 3 campos em azul (ajustáveis).
    // Coordenadas em PDF: origem no canto inferior esquerdo.
    const labelSize = 12.5;
    const leftX = 92;

    // posições aproximadas no A4 (baseadas no template fornecido)
    const y1 = 430;
    const y2 = 404;
    const y3 = 378;

    page.drawText(nome, { x: leftX + 86, y: y1, size: labelSize, font: fallbackFontBold, color: fallbackBlue });
    page.drawText(data, { x: leftX + 250, y: y2, size: labelSize, font: fallbackFontBold, color: fallbackBlue });
    page.drawText(numero, { x: leftX + 145, y: y3, size: labelSize, font: fallbackFontBold, color: fallbackBlue });

    return await pdfDoc.save();
  } catch (e) {
    console.error('gerarRegistroFranquiaPdf: template', e);
    // Fallback: se o template não estiver no disco, retorna um PDF simples (não idêntico)
    const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const fontBoldFallback = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    page.drawText('Registro de Franquia — Casa Moní', { x: 64, y: 780, size: 18, font: fontBoldFallback, color: rgb(0, 0, 0) });
    page.drawText(`Franqueado: ${nome}`, { x: 64, y: 720, size: 12.5, font: fontBoldFallback, color: blue });
    page.drawText(`Data da assinatura: ${data}`, { x: 64, y: 695, size: 12.5, font: fontBoldFallback, color: blue });
    page.drawText(`Número de franquia: ${numero}`, { x: 64, y: 670, size: 12.5, font: fontBoldFallback, color: blue });
    const errMsg = e instanceof Error ? e.message : String(e ?? '');
    page.drawText('Template não carregou (ver logs).', {
      x: 64,
      y: 100,
      size: 10,
      font,
      color: rgb(0.4, 0.2, 0.2),
    });
    if (errMsg) {
      page.drawText(errMsg.slice(0, 160), { x: 64, y: 86, size: 8, font, color: rgb(0.4, 0.2, 0.2) });
    }
    return await pdfDoc.save();
  }
}

