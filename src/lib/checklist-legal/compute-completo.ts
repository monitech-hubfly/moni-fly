import type { ChecklistLegalArquivos, ChecklistLegalRespostas } from '@/lib/checklist-legal/types';
import { CHECKLIST_LEGAL_SECTIONS } from '@/lib/checklist-legal/form-definition';

function strTrim(v: unknown): string {
  return String(v ?? '').trim();
}

function arrayLen(v: unknown): number {
  return Array.isArray(v) ? v.length : 0;
}

function checkboxOk(respostas: ChecklistLegalRespostas, key: string, outroKey?: string): boolean {
  const selected = respostas[key];
  if (!Array.isArray(selected) || selected.length === 0) return false;
  if (outroKey && selected.includes('Outro') && !strTrim(respostas[outroKey])) return false;
  return true;
}

export function computeChecklistLegalCompleto(
  respostas_json: ChecklistLegalRespostas,
  arquivos_json: ChecklistLegalArquivos,
): boolean {
  const manualOk = arrayLen(arquivos_json.manual_condominio_pdf) > 0;
  const codigoOk = arrayLen(arquivos_json.codigo_obras_pdf) > 0;
  if (!manualOk || !codigoOk) return false;

  for (const section of CHECKLIST_LEGAL_SECTIONS) {
    for (const field of section.fields) {
      if (!field.required) continue;

      if (field.type === 'file') {
        const ak = field.arquivoKey ?? field.key;
        if (arrayLen(arquivos_json[ak as keyof ChecklistLegalArquivos]) === 0) return false;
        continue;
      }

      if (field.type === 'checkbox_group') {
        const outroKey =
          field.key === 'q9_aprov_doc_solicitados_selecionados'
            ? 'q9_aprov_doc_solicitados_outro_text'
            : field.key === 'q_obras_docs_selecionados'
              ? 'q_obras_docs_outro_text'
              : undefined;
        if (!checkboxOk(respostas_json, field.key, outroKey)) return false;
        continue;
      }

      if (!strTrim(respostas_json[field.key])) return false;
    }
  }

  return true;
}

export function computeChecklistLegalProgresso(
  respostas_json: ChecklistLegalRespostas,
  arquivos_json: ChecklistLegalArquivos,
): { preenchidos: number; total: number } {
  let preenchidos = 0;
  let total = 0;

  for (const section of CHECKLIST_LEGAL_SECTIONS) {
    for (const field of section.fields) {
      if (!field.required) continue;
      total += 1;

      if (field.type === 'file') {
        const ak = field.arquivoKey ?? field.key;
        if (arrayLen(arquivos_json[ak as keyof ChecklistLegalArquivos]) > 0) preenchidos += 1;
        continue;
      }

      if (field.type === 'checkbox_group') {
        const outroKey =
          field.key === 'q9_aprov_doc_solicitados_selecionados'
            ? 'q9_aprov_doc_solicitados_outro_text'
            : field.key === 'q_obras_docs_selecionados'
              ? 'q_obras_docs_outro_text'
              : undefined;
        if (checkboxOk(respostas_json, field.key, outroKey)) preenchidos += 1;
        continue;
      }

      if (strTrim(respostas_json[field.key])) preenchidos += 1;
    }
  }

  return { preenchidos, total };
}
