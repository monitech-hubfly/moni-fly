import type { FormularioCampoTipo, FormularioOpcao } from '@/types/formularios';
import { FORMULARIO_CAMPO_TIPOS } from '@/types/formularios';

export function normalizarCondicional(valor: string | null | undefined): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toLowerCase();
}

export function opcoesDeCampo(raw: unknown): FormularioOpcao[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === 'string') {
        const valor = item.trim();
        return { valor, rotulo: valor };
      }
      if (item && typeof item === 'object') {
        const row = item as Record<string, unknown>;
        const valor = String(row.valor ?? row.value ?? row.id ?? '').trim();
        const rotulo = String(row.rotulo ?? row.label ?? valor).trim();
        if (!valor && rotulo) return { valor: rotulo, rotulo };
        return { valor, rotulo: rotulo || valor };
      }
      return { valor: '', rotulo: '' };
    })
    .filter((opcao) => opcao.valor.length > 0);
}

export function tipoCampo(raw: string): FormularioCampoTipo {
  const tipo = String(raw ?? '').trim() as FormularioCampoTipo;
  return FORMULARIO_CAMPO_TIPOS.includes(tipo) ? tipo : 'texto_curto';
}

export function mascaraTelefone(entrada: string): string {
  const digitos = entrada.replace(/\D/g, '').slice(0, 11);
  if (digitos.length === 0) return '';
  if (digitos.length < 3) return `(${digitos}`;
  if (digitos.length < 7) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  if (digitos.length <= 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}

export function mascaraMoeda(entrada: string): string {
  const digitos = entrada.replace(/\D/g, '');
  if (!digitos) return '';
  const numero = Number(digitos) / 100;
  return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function moedaParaNumero(texto: string): number | null {
  const digitos = texto.replace(/\D/g, '');
  if (!digitos) return null;
  return Number(digitos) / 100;
}

export function nomeArquivoSeguro(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/_+/g, '_').slice(0, 120);
  return base.length > 0 ? base : 'arquivo';
}
