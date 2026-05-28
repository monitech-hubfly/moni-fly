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

const MESES_PT: Record<string, string> = {
  janeiro: '01',
  fevereiro: '02',
  marco: '03',
  março: '03',
  abril: '04',
  maio: '05',
  junho: '06',
  julho: '07',
  agosto: '08',
  setembro: '09',
  outubro: '10',
  novembro: '11',
  dezembro: '12',
};

function toISODateBr(val: string): string | null {
  const m = val.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!m) return null;
  const [, d, month, y] = m;
  return `${y}-${month!.padStart(2, '0')}-${d!.padStart(2, '0')}`;
}

function parseDataFlexivel(raw: string): string | null {
  const val = norm(raw);
  if (!val) return null;
  const iso = val.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = toISODateBr(val);
  if (br) return br;
  const ext = val.match(/(\d{1,2})\s+de\s+([a-záàâãéêíóôõúç]+)\s+de\s+(\d{4})/i);
  if (ext) {
    const mes = MESES_PT[stripAccents(ext[2]!.toLowerCase())] ?? MESES_PT[ext[2]!.toLowerCase()];
    if (mes) {
      return `${ext[3]}-${mes}-${ext[1]!.padStart(2, '0')}`;
    }
  }
  return null;
}

const NOMES_BLOQUEADOS =
  /\b(moni|franqueador|franqueadora|hubfly|casa moni|sociedade|empresa|ltda|s\.?a\.?|eireli|me\b|cpf|cnpj)\b/i;

function isNomePlausivel(nome: string): boolean {
  const n = norm(nome);
  if (n.length < 5 || n.length > 80) return false;
  if (NOMES_BLOQUEADOS.test(n)) return false;
  if (!/[A-Za-zÀ-ú]/.test(n)) return false;
  const partes = n.split(/\s+/).filter(Boolean);
  if (partes.length < 2) return false;
  return true;
}

function titleCaseNome(nome: string): string {
  return nome
    .split(/\s+/)
    .map((p) => (p.length <= 2 ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()))
    .join(' ');
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

const RE_DATA_NUM = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s+de\s+[a-záàâãéêíóôõúç]+\s+de\s+\d{4})/gi;

function pickDateNear(text: string, keyword: RegExp): string | null {
  const idx = text.search(keyword);
  if (idx < 0) return null;
  const slice = text.slice(idx, idx + 220);
  const m = slice.match(RE_DATA_NUM);
  if (!m?.[0]) return null;
  return parseDataFlexivel(m[0]);
}

function pickDataAssinaturaContrato(text: string): string | null {
  const assinatura = pickDateNear(text, /assinatura|assinado\s+em|foro\s+de|nesta\s+data/i);
  if (assinatura) return assinatura;
  const cidadeData = text.match(
    /(?:São Paulo|Rio de Janeiro|Belo Horizonte|Curitiba|Bras[ií]lia)[,\s]+(\d{1,2}\s+de\s+[a-záàâãéêíóôõúç]+\s+de\s+\d{4})/i,
  );
  if (cidadeData?.[1]) return parseDataFlexivel(cidadeData[1]);
  const datas: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(RE_DATA_NUM.source, 'gi');
  while ((m = re.exec(text)) !== null) {
    const iso = parseDataFlexivel(m[1] ?? '');
    if (iso) datas.push(iso);
  }
  return datas.length ? datas[datas.length - 1]! : null;
}

function pickCpfFranqueado(text: string, cpfExistente: string | null | undefined): string | null {
  const idx = text.search(/franquead|qualifica[çc][ãa]o/i);
  const slice = idx >= 0 ? text.slice(Math.max(0, idx - 80), idx + 900) : text;
  const cpfLabel = slice.match(/cpf\s*(?:n[ºo°.]?)?\s*(?:sob\s+o\s+n[ºo°.]?\s*)?(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i);
  if (cpfLabel) {
    const f = formatCpf(cpfLabel[1] ?? '');
    if (f) return f;
  }
  return pickCpf(slice, cpfExistente) ?? pickCpf(text, cpfExistente);
}

function pickNomeFranqueado(text: string, nomeExistente: string | null | undefined): string | null {
  const candidatos: string[] = [];

  const labels = [
    /franquead[oa]\s*[:\-]\s*([A-Za-zÀ-ú0-9][A-Za-zÀ-ú0-9\s.'-]{4,80})/i,
    /nome\s+(?:do\s+)?franquead[oa]\s*[:\-]\s*([A-Za-zÀ-ú][A-Za-zÀ-ú\s.'-]{4,80})/i,
    /qualifica[çc][ãa]o\s+do\s+franquead[oa]\s*[:\-]?\s*([A-Za-zÀ-ú][A-Za-zÀ-ú\s.'-]{4,80})/i,
    /\b([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][A-ZÁÀÂÃÉÊÍÓÔÕÚÇ\s.'-]{4,70}),\s*brasileir[oa]/,
    /\b([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][A-ZÁÀÂÃÉÊÍÓÔÕÚÇ\s.'-]{4,70}),\s*(?:solteir|casad|divorciad|viúv)/i,
    /(?:denominad[oa]|qualificad[oa])\s+(?:abaixo\s+como\s+)?["']?FRANQUEAD[OA]["']?,?\s*([A-Za-zÀ-ú][A-Za-zÀ-ú\s.'-]{4,80})/i,
  ];
  for (const re of labels) {
    const m = text.match(re);
    const nome = norm(m?.[1]).replace(/\s{2,}/g, ' ');
    if (isNomePlausivel(nome)) candidatos.push(titleCaseNome(nome));
  }

  for (const c of candidatos) {
    if (!nomeExistente || nomesFranqueadoCompativeis(nomeExistente, c)) return c;
  }
  return candidatos[0] ?? null;
}

/** Fallback: "2025 05 29 Franquia - Thiago Tonaco.pdf" */
export function extrairDadosDoNomeArquivo(filename: string): Partial<Record<RedeCampoFranqueado, string | null>> {
  const out: Partial<Record<RedeCampoFranqueado, string | null>> = {};
  const base = norm(filename.replace(/\.pdf$/i, ''));

  const ymd = base.match(/\b(20\d{2})[\s._-](\d{1,2})[\s._-](\d{1,2})\b/);
  if (ymd) {
    out.data_ass_contrato = `${ymd[1]}-${ymd[2]!.padStart(2, '0')}-${ymd[3]!.padStart(2, '0')}`;
  }

  const depoisFranquia = base.match(/franquia\s*[-–—]\s*(.+)$/i);
  if (depoisFranquia?.[1]) {
    const nome = titleCaseNome(depoisFranquia[1].replace(/[-_]/g, ' ').trim());
    if (isNomePlausivel(nome)) out.nome_completo = nome;
  }

  return out;
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

function mesclarExtracao(
  base: Partial<Record<RedeCampoFranqueado, string | null>>,
  extra: Partial<Record<RedeCampoFranqueado, string | null>>,
): Partial<Record<RedeCampoFranqueado, string | null>> {
  const out = { ...base };
  for (const key of REDE_CAMPOS_DADOS_FRANQUEADO) {
    if (norm(out[key])) continue;
    const v = extra[key];
    if (norm(v)) out[key] = norm(v);
  }
  return out;
}

/** Extrai apenas campos atribuíveis ao franqueado (não equipe Moni / corporação). */
export function extrairDadosFranqueadoDeTexto(
  text: string,
  contexto: RedeLinhaFranqueado,
  opts?: { filename?: string },
): Partial<Record<RedeCampoFranqueado, string | null>> {
  let out: Partial<Record<RedeCampoFranqueado, string | null>> = {};

  if (opts?.filename) {
    out = mesclarExtracao(out, extrairDadosDoNomeArquivo(opts.filename));
  }

  if (!text.trim()) return out;

  const nome = pickNomeFranqueado(text, contexto.nome_completo ?? out.nome_completo);
  if (nome) out.nome_completo = nome;

  const cpf = pickCpfFranqueado(text, contexto.cpf_frank);
  if (cpf) out.cpf_frank = cpf;

  const email = pickEmail(text, contexto.email_frank);
  if (email) out.email_frank = email;

  const tel = pickTelefone(text);
  if (tel) out.telefone_frank = tel;

  const nasc = pickDateNear(text, /nascimento|nasc\.|data de nasc/i);
  if (nasc) out.data_nasc_frank = nasc;

  const cof = pickDateNear(text, /\bcof\b|carta de oferta/i);
  if (cof) out.data_ass_cof = cof;

  const contrato = pickDataAssinaturaContrato(text);
  if (contrato) out.data_ass_contrato = contrato;

  const exp = pickDateNear(text, /expira|vig[eê]ncia|prazo da franquia|t[eé]rmino/i);
  if (exp) out.data_expiracao_franquia = exp;

  out = mesclarExtracao(out, pickEndereco(text));

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
