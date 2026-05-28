/**
 * Extrai dados do franqueado (pessoa) de texto de COF/contrato/documento de nº de franquia.
 * Não preenche responsável comercial, regional, área de atuação nem sócios.
 */

import type { RedeFranqueadoDbKey } from '@/lib/rede-franqueados';

export const REDE_CAMPOS_DADOS_FRANQUEADO = [
  'nome_completo',
  'email_frank',
  'telefone_frank',
  'cpf_frank',
  'data_nasc_frank',
  'endereco_casa_frank',
  'endereco_casa_frank_numero',
  'endereco_casa_frank_complemento',
  'cep_casa_frank',
  'estado_casa_frank',
  'cidade_casa_frank',
  'data_ass_cof',
  'data_ass_contrato',
  'data_expiracao_franquia',
] as const satisfies readonly RedeFranqueadoDbKey[];

export type RedeCampoFranqueado = (typeof REDE_CAMPOS_DADOS_FRANQUEADO)[number];

export type RedeLinhaFranqueado = Partial<Record<RedeFranqueadoDbKey, string | null>> & {
  nome_completo?: string | null;
  modalidade?: string | null;
  n_franquia?: string | null;
};

function norm(s: string | null | undefined): string {
  return (s ?? '').toString().trim();
}

function onlyDigits(s: string): string {
  return s.replace(/\D/g, '');
}

function formatCpf(digits: string): string | null {
  const d = onlyDigits(digits);
  if (d.length !== 11) return null;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function formatCep(digits: string): string | null {
  const d = onlyDigits(digits);
  if (d.length !== 8) return null;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

function toISODateBr(val: string): string | null {
  const m = val.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!m) return null;
  const [, d, month, y] = m;
  return `${y}-${month!.padStart(2, '0')}-${d!.padStart(2, '0')}`;
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ç/g, 'c');
}

function tokensNome(s: string): Set<string> {
  return new Set(
    stripAccents(norm(s))
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
}

export function nomesFranqueadoCompativeis(existente: string, extraido: string): boolean {
  const a = tokensNome(existente);
  const b = tokensNome(extraido);
  if (!a.size || !b.size) return true;
  let inter = 0;
  for (const t of a) {
    if (b.has(t)) inter += 1;
  }
  return inter >= Math.min(2, Math.min(a.size, b.size));
}

/** Linha da rede que representa franqueado (não corporação / Casa Moní). */
export function isRedeLinhaFranqueado(row: RedeLinhaFranqueado): boolean {
  const mod = stripAccents(norm(row.modalidade)).toLowerCase();
  if (/corpora/.test(mod)) return false;
  const nome = stripAccents(norm(row.nome_completo)).toLowerCase();
  if (/casa moni/.test(nome)) return false;
  return true;
}

const EMAIL_CORPORATIVO = /@(?:moni\.casa|monitech|hubfly)\b/i;

function isEmailDoFranqueado(email: string): boolean {
  const e = email.trim().toLowerCase();
  if (!e || EMAIL_CORPORATIVO.test(e)) return false;
  if (/noreply|no-reply|suporte@|admin@|contato@moni/i.test(e)) return false;
  return true;
}

const UFS = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR',
  'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]);

function pickCpf(text: string, cpfExistente: string | null | undefined): string | null {
  const found: string[] = [];
  const re = /\b(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const f = formatCpf(m[1] ?? '');
    if (f) found.push(f);
  }
  if (!found.length) return null;
  const exist = onlyDigits(cpfExistente ?? '');
  if (exist.length === 11) {
    const match = found.find((c) => onlyDigits(c) === exist);
    return match ?? null;
  }
  return found[0] ?? null;
}

function pickEmail(text: string, emailExistente: string | null | undefined): string | null {
  const re = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi;
  const emails: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const e = (m[0] ?? '').trim();
    if (isEmailDoFranqueado(e)) emails.push(e);
  }
  if (!emails.length) return null;
  const ex = norm(emailExistente).toLowerCase();
  if (ex) {
    const hit = emails.find((e) => e.toLowerCase() === ex);
    if (hit) return hit;
  }
  return emails[0] ?? null;
}

function pickTelefone(text: string): string | null {
  const re = /(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}[-\s]?\d{4}/g;
  const nums: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const d = onlyDigits(m[0] ?? '');
    if (d.length >= 10 && d.length <= 13) nums.push(d);
  }
  if (!nums.length) return null;
  nums.sort((a, b) => b.length - a.length);
  return nums[0] ?? null;
}

function pickCep(text: string): string | null {
  const m = text.match(/\b(\d{5}-?\d{3})\b/);
  if (!m) return null;
  return formatCep(m[1] ?? '');
}

function pickUf(text: string): string | null {
  for (const uf of UFS) {
    const re = new RegExp(`\\b${uf}\\b`, 'i');
    if (re.test(text)) return uf;
  }
  return null;
}

function pickDateNear(text: string, keyword: RegExp): string | null {
  const idx = text.search(keyword);
  if (idx < 0) return null;
  const slice = text.slice(idx, idx + 120);
  const m = slice.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/);
  return m ? toISODateBr(m[1] ?? '') : null;
}

function pickNomeFranqueado(text: string, nomeExistente: string | null | undefined): string | null {
  const labels = [
    /franqueado\s*[:\-]\s*([A-Za-zÀ-ú][A-Za-zÀ-ú\s.'-]{4,80})/i,
    /nome\s+(?:do\s+)?franqueado\s*[:\-]\s*([A-Za-zÀ-ú][A-Za-zÀ-ú\s.'-]{4,80})/i,
    /qualifica[çc][ãa]o\s+do\s+franqueado\s*[:\-]?\s*([A-Za-zÀ-ú][A-Za-zÀ-ú\s.'-]{4,80})/i,
  ];
  for (const re of labels) {
    const m = text.match(re);
    const nome = norm(m?.[1]);
    if (nome && nome.length > 4) {
      if (!nomeExistente || nomesFranqueadoCompativeis(nomeExistente, nome)) return nome;
    }
  }
  return null;
}

function pickEndereco(text: string): Partial<Record<'endereco_casa_frank' | 'cep_casa_frank' | 'cidade_casa_frank' | 'estado_casa_frank', string>> {
  const out: Partial<Record<'endereco_casa_frank' | 'cep_casa_frank' | 'cidade_casa_frank' | 'estado_casa_frank', string>> = {};
  const cep = pickCep(text);
  if (cep) out.cep_casa_frank = cep;
  const uf = pickUf(text);
  if (uf) out.estado_casa_frank = uf;

  const endMatch = text.match(
    /(?:rua|av\.?|avenida|alameda|travessa|rodovia)\s+[^,;]{3,80}(?:,\s*(?:n[ºo°.]?\s*)?[\w\d]+)?/i,
  );
  if (endMatch) out.endereco_casa_frank = norm(endMatch[0]).slice(0, 200);

  const cidadeMatch = text.match(/(?:munic[ií]pio|cidade)\s*[:\-]?\s*([A-Za-zÀ-ú\s]{2,40})/i);
  if (cidadeMatch) out.cidade_casa_frank = norm(cidadeMatch[1]);

  return out;
}

/** Extrai apenas campos atribuíveis ao franqueado (não equipe Moni / corporação). */
export function extrairDadosFranqueadoDeTexto(
  text: string,
  contexto: RedeLinhaFranqueado,
): Partial<Record<RedeCampoFranqueado, string | null>> {
  if (!text.trim()) return {};

  const out: Partial<Record<RedeCampoFranqueado, string | null>> = {};

  const nome = pickNomeFranqueado(text, contexto.nome_completo);
  if (nome) out.nome_completo = nome;

  const cpf = pickCpf(text, contexto.cpf_frank);
  if (cpf) out.cpf_frank = cpf;

  const email = pickEmail(text, contexto.email_frank);
  if (email) out.email_frank = email;

  const tel = pickTelefone(text);
  if (tel) out.telefone_frank = tel;

  const nasc = pickDateNear(text, /nascimento|nasc\.|data de nasc/i);
  if (nasc) out.data_nasc_frank = nasc;

  const cof = pickDateNear(text, /\bcof\b|contrato de franquia/i);
  if (cof) out.data_ass_cof = cof;

  const contrato = pickDateNear(text, /assinatura\s+do\s+contrato|contrato de franquia|data de assinatura/i);
  if (contrato) out.data_ass_contrato = contrato;

  const exp = pickDateNear(text, /expira|vig[eê]ncia|prazo da franquia/i);
  if (exp) out.data_expiracao_franquia = exp;

  Object.assign(out, pickEndereco(text));

  return out;
}

/** Mescla extração apenas em colunas ainda vazias na linha. */
export function patchFranqueadoCamposVazios(
  row: RedeLinhaFranqueado,
  extraido: Partial<Record<RedeCampoFranqueado, string | null>>,
): Partial<Record<RedeCampoFranqueado, string>> {
  const patch: Partial<Record<RedeCampoFranqueado, string>> = {};

  for (const key of REDE_CAMPOS_DADOS_FRANQUEADO) {
    if (norm(row[key])) continue;
    const v = extraido[key];
    if (!norm(v)) continue;

    if (key === 'nome_completo' && row.nome_completo && !nomesFranqueadoCompativeis(row.nome_completo, v!)) {
      continue;
    }

    patch[key] = norm(v);
  }

  return patch;
}

/** Preenche só campos vazios do formulário com dados extraídos dos PDFs. */
export function mesclarExtracaoFormFranqueado<T extends Record<string, string>>(
  form: T,
  extraido: Partial<Record<RedeCampoFranqueado, string | null>>,
): T {
  const next = { ...form };
  for (const key of REDE_CAMPOS_DADOS_FRANQUEADO) {
    const atual = norm((next as Record<string, string>)[key]);
    if (atual) continue;
    const v = extraido[key];
    if (!norm(v)) continue;
    (next as Record<string, string>)[key] = norm(v);
  }
  return next;
}

export function normalizeRedeAnexoStoragePath(storagePath: string): string {
  let p = norm(storagePath);
  if (!p) return '';
  const fromUrl = p.match(/rede-attachments\/(.+)$/i);
  if (fromUrl) p = fromUrl[1]!;
  if (p.startsWith('rede-attachments/')) p = p.slice('rede-attachments/'.length);
  return p.replace(/^\/+/, '');
}
