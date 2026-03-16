/**
 * Rede de Franqueados: dados vêm da tabela rede_franqueados no Supabase.
 * A tabela é exibida dentro da ferramenta em /rede-franqueados (admin) e na COMUNIDADE (franqueados).
 */

import { createClient } from "@/lib/supabase/server";

export const COLUNAS_REDE_FRANQUEADOS = [
  "N de Franquia",
  "Nome Completo do Franqueado",
  "Status da Franquia",
  "Classificação do Franqueado",
  "Data de Ass. COF",
  "Data de Ass. Contrato",
  "Data de Expiração da Franquia",
  "Regional",
  "Área de Atuação da Franquia",
  "E-mail do Frank",
  "Telefone do Frank",
  "CPF do Frank",
  "Data de Nasc. Frank",
  "Endereço Casa do Frank (Rua + Nº + Complemento)",
  "CEP Casa Frank",
  "Estado Casa Frank",
  "Cidade Casa Frank",
  "Tamanho da Camiseta do Frank",
  "Sócios (Nome, Nascimento, Telefone, E-mail, CPF, Endereço Completo, Tamanho da camisa)",
  "Data de Recebimento do Kit de Boas Vindas",
] as const;

export type RedeFranqueadosData = {
  headers: string[];
  rows: string[][];
  totalCount: number;
  activeCount: number;
} | null;

const DB_KEYS = [
  "n_franquia",
  "nome_completo",
  "status_franquia",
  "classificacao_franqueado",
  "data_ass_cof",
  "data_ass_contrato",
  "data_expiracao_franquia",
  "regional",
  "area_atuacao",
  "email_frank",
  "telefone_frank",
  "cpf_frank",
  "data_nasc_frank",
  "endereco_casa_frank",
  "cep_casa_frank",
  "estado_casa_frank",
  "cidade_casa_frank",
  "tamanho_camisa_frank",
  "socios",
] as const;

type RowDb = Record<(typeof DB_KEYS)[number], string | null>;
type OldRow = { nome?: string | null; unidade?: string | null; cidade?: string | null; estado?: string | null; email?: string | null; telefone?: string | null; observacoes?: string | null };
type RowAny = RowDb & OldRow;

function formatDate(val: string | null | undefined): string {
  if (!val) return "";
  const d = new Date(val);
  return isNaN(d.getTime()) ? String(val) : d.toLocaleDateString("pt-BR");
}

function rowToArray(r: RowAny): string[] {
  return [
    r.n_franquia ?? r.unidade ?? "",
    r.nome_completo ?? r.nome ?? "",
    r.status_franquia ?? "",
    r.classificacao_franqueado ?? "",
    formatDate(r.data_ass_cof),
    formatDate(r.data_ass_contrato),
    formatDate(r.data_expiracao_franquia),
    r.regional ?? "",
    r.area_atuacao ?? "",
    r.email_frank ?? r.email ?? "",
    r.telefone_frank ?? r.telefone ?? "",
    r.cpf_frank ?? "",
    formatDate(r.data_nasc_frank),
    r.endereco_casa_frank ?? "",
    r.cep_casa_frank ?? "",
    r.estado_casa_frank ?? r.estado ?? "",
    r.cidade_casa_frank ?? r.cidade ?? "",
    r.tamanho_camisa_frank ?? "",
    r.socios ?? r.observacoes ?? "",
    formatDate(r.data_recebimento_kit_boas_vindas),
  ];
}

/**
 * Busca os dados da rede de franqueados na tabela do Supabase.
 */
export async function fetchRedeFranqueados(supabase: Awaited<ReturnType<typeof createClient>>): Promise<RedeFranqueadosData> {
  const { data, error } = await supabase
    .from("rede_franqueados")
    .select("*")
    .order("ordem", { ascending: true });

  if (error) return null;
  const list = data || [];
  const rows = list.map((r) => rowToArray(r as RowAny));
  const activeCount = list.filter(
    (r) => r?.status_franquia && /ativo/i.test(String(r.status_franquia))
  ).length;
  return {
    headers: [...COLUNAS_REDE_FRANQUEADOS],
    rows,
    totalCount: list.length,
    activeCount,
  };
}
