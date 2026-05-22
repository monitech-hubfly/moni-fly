import type { PastelariaCardRow } from '@/lib/pastelaria/types';
import { responsavelDisplayNome } from '@/lib/pastelaria/responsavel';

type AreaJoin = { nome: string | null } | { nome: string | null }[] | null;
type PessoaJoin = { id?: string; nome: string | null } | { id?: string; nome: string | null }[] | null;

export type PastelariaCardDbRow = PastelariaCardRow & {
  areas?: AreaJoin;
  area_pessoas?: PessoaJoin;
};

export function mapPastelariaCardWithArea(
  row: PastelariaCardDbRow,
): PastelariaCardRow & {
  area_nome: string | null;
  responsavel_pessoa_nome: string | null;
  responsavel_display_nome: string | null;
} {
  const areas = row.areas;
  const areaNome = Array.isArray(areas) ? areas[0]?.nome ?? null : areas?.nome ?? null;

  const pessoa = row.area_pessoas;
  const responsavelPessoaNome = Array.isArray(pessoa)
    ? pessoa[0]?.nome ?? null
    : pessoa?.nome ?? null;

  const { areas: _a, area_pessoas: _p, ...rest } = row;

  const mapped = {
    ...rest,
    area_nome: areaNome,
    responsavel_pessoa_nome: responsavelPessoaNome,
  };

  return {
    ...mapped,
    responsavel_display_nome: responsavelDisplayNome(mapped),
  };
}

export const PASTELARIA_CARD_SELECT =
  '*, areas(nome), area_pessoas!responsavel_id(id, nome)';
