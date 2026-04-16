'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { ProcessoRelacionado, ProcessoResumoStep1 } from './actions';

export type DadosPreObraFormState = {
  previsao_aprovacao_condominio: string;
  previsao_aprovacao_prefeitura: string;
  previsao_emissao_alvara: string;
  data_aprovacao_condominio: string;
  data_aprovacao_prefeitura: string;
  data_emissao_alvara: string;
  data_aprovacao_credito: string;
  previsao_liberacao_credito_obra: string;
  previsao_inicio_obra: string;
};

function show(val: string | null | undefined) {
  return val && String(val).trim() ? String(val) : '—';
}

function formatDate(val: string | null | undefined) {
  if (!val) return '—';
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? String(val) : d.toLocaleDateString('pt-BR');
}

function linkPainelRelatedCard(processo: { id: string; etapa_painel?: string | null }) {
  const etapa = String(processo.etapa_painel ?? '');
  if (etapa === 'credito_terreno' || etapa === 'credito_obra') {
    return `/painel-credito?card=${encodeURIComponent(processo.id)}`;
  }
  if (
    etapa === 'contabilidade_incorporadora' ||
    etapa === 'contabilidade_spe' ||
    etapa === 'contabilidade_gestora'
  ) {
    return `/painel-contabilidade?card=${encodeURIComponent(processo.id)}`;
  }
  return `/painel-novos-negocios?card=${encodeURIComponent(processo.id)}`;
}

type Relacionados = {
  pai: ProcessoRelacionado | null;
  filhos: ProcessoRelacionado[];
  irmaos: ProcessoRelacionado[];
};

type Props = {
  resumo: ProcessoResumoStep1 | null;
  relacionados: Relacionados;
  dadosPreObraForm: DadosPreObraFormState;
  setDadosPreObraForm: Dispatch<SetStateAction<DadosPreObraFormState>>;
  onSalvarPreObra: () => void | Promise<void>;
  savingDadosPreObra: boolean;
  /** Se false, exibe campos Pré Obra como texto (somente leitura). */
  allowEditPreObra?: boolean;
};

/**
 * Quatro blocos obrigatórios do lado esquerdo do card (Franqueado, Novo Negócio, Pré Obra, Relacionamentos).
 * Campos vazios aparecem como "—".
 */
export function ProcessoQuatroSecoesDados({
  resumo,
  relacionados,
  dadosPreObraForm,
  setDadosPreObraForm,
  onSalvarPreObra,
  savingDadosPreObra,
  allowEditPreObra = true,
}: Props) {
  const r = resumo;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
        <p className="text-xs font-semibold text-stone-700">Dados do Franqueado</p>
        <div className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div>
            <span className="text-xs text-stone-500">Nº franquia</span>
            <div className="text-stone-800">{show(r?.numero_franquia)}</div>
          </div>
          <div>
            <span className="text-xs text-stone-500">Modalidade</span>
            <div className="text-stone-800">{show(r?.modalidade)}</div>
          </div>
          <div>
            <span className="text-xs text-stone-500">Nome</span>
            <div className="text-stone-800">{show(r?.nome_franqueado)}</div>
          </div>
          <div>
            <span className="text-xs text-stone-500">Status</span>
            <div className="text-stone-800">{show(r?.status_franquia)}</div>
          </div>
          <div>
            <span className="text-xs text-stone-500">Classificação</span>
            <div className="text-stone-800">{show(r?.classificacao_franqueado)}</div>
          </div>
          <div>
            <span className="text-xs text-stone-500">Área de atuação</span>
            <div className="text-stone-800">{show(r?.area_atuacao_franquia)}</div>
          </div>
          <div>
            <span className="text-xs text-stone-500">E-mail</span>
            <div className="text-stone-800">{show(r?.email_franqueado)}</div>
          </div>
          <div>
            <span className="text-xs text-stone-500">Telefone</span>
            <div className="text-stone-800">{show(r?.telefone_frank)}</div>
          </div>
          <div>
            <span className="text-xs text-stone-500">CPF</span>
            <div className="text-stone-800">
              <span className="blur-[7px] select-none text-stone-500" aria-hidden="true">
                {show(r?.cpf_frank)}
              </span>
              <span className="sr-only">{show(r?.cpf_frank)}</span>
            </div>
          </div>
          <div>
            <span className="text-xs text-stone-500">Nascimento</span>
            <div className="text-stone-800">
              <span className="blur-[7px] select-none text-stone-500" aria-hidden="true">
                {formatDate(r?.data_nasc_frank)}
              </span>
              <span className="sr-only">{formatDate(r?.data_nasc_frank)}</span>
            </div>
          </div>
          <div>
            <span className="text-xs text-stone-500">Responsável comercial</span>
            <div className="text-stone-800">{show(r?.responsavel_comercial)}</div>
          </div>
          <div>
            <span className="text-xs text-stone-500">Camiseta</span>
            <div className="text-stone-800">
              <span className="blur-[7px] select-none text-stone-500" aria-hidden="true">
                {show(r?.tamanho_camiseta_frank)}
              </span>
              <span className="sr-only">{show(r?.tamanho_camiseta_frank)}</span>
            </div>
          </div>
          <div>
            <span className="text-xs text-stone-500">Ass. COF</span>
            <div className="text-stone-800">{formatDate(r?.data_ass_cof)}</div>
          </div>
          <div>
            <span className="text-xs text-stone-500">Ass. Contrato</span>
            <div className="text-stone-800">{formatDate(r?.data_ass_contrato)}</div>
          </div>
          <div>
            <span className="text-xs text-stone-500">Expiração</span>
            <div className="text-stone-800">{formatDate(r?.data_expiracao_franquia)}</div>
          </div>
          <div className="sm:col-span-2">
            <span className="text-xs text-stone-500">Endereço (casa)</span>
            <div className="text-stone-800">
              {[
                show(r?.endereco_casa_frank),
                show(r?.endereco_casa_frank_numero),
                show(r?.endereco_casa_frank_complemento),
                show(r?.cidade_casa_frank),
                show(r?.estado_casa_frank),
                show(r?.cep_casa_frank),
              ]
                .filter((v) => v !== '—')
                .join(' · ') || '—'}
            </div>
          </div>
          <div className="sm:col-span-2">
            <span className="text-xs text-stone-500">Sócios</span>
            <div className="whitespace-pre-wrap text-stone-800">{show(r?.socios)}</div>
          </div>
          <div className="sm:col-span-2">
            <span className="text-xs text-stone-500">Observações</span>
            <div className="whitespace-pre-wrap text-stone-800">{show(r?.observacoes)}</div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
        <p className="text-xs font-semibold text-stone-700">Dados do Novo Negócio</p>
        <div className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div>
            <span className="text-xs text-stone-500">Nº franquia</span>
            <div className="text-stone-800">{show(r?.numero_franquia)}</div>
          </div>
          <div>
            <span className="text-xs text-stone-500">Nome do franqueado</span>
            <div className="text-stone-800">{show(r?.nome_franqueado)}</div>
          </div>
          <div>
            <span className="text-xs text-stone-500">E-mail</span>
            <div className="text-stone-800">{show(r?.email_franqueado)}</div>
          </div>
          <div>
            <span className="text-xs text-stone-500">Estado (UF)</span>
            <div className="text-stone-800">{show(r?.estado)}</div>
          </div>
          <div className="sm:col-span-2">
            <span className="text-xs text-stone-500">Cidade</span>
            <div className="text-stone-800">{show(r?.cidade)}</div>
          </div>
          <div>
            <span className="text-xs text-stone-500">Tipo de negociação</span>
            <div className="text-stone-800">{show(r?.tipo_aquisicao_terreno)}</div>
          </div>
          <div>
            <span className="text-xs text-stone-500">Valor do Terreno</span>
            <div className="text-stone-800">{show(r?.valor_terreno)}</div>
          </div>
          <div>
            <span className="text-xs text-stone-500">VGV pretendido</span>
            <div className="text-stone-800">{show(r?.vgv_pretendido)}</div>
          </div>
          <div>
            <span className="text-xs text-stone-500">Produto / Modelo</span>
            <div className="text-stone-800">{show(r?.produto_modelo_casa)}</div>
          </div>
          <div className="sm:col-span-2">
            <span className="text-xs text-stone-500">Link pasta no Drive</span>
            <div className="break-all text-stone-800">{show(r?.link_pasta_drive)}</div>
          </div>
          <div className="sm:col-span-2">
            <span className="text-xs text-stone-500">Nome do Condomínio</span>
            <div className="text-stone-800">{show(r?.nome_condominio)}</div>
          </div>
          <div className="sm:col-span-2">
            <span className="text-xs text-stone-500">Quadra / Lote</span>
            <div className="text-stone-800">{show(r?.quadra_lote)}</div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
        <p className="text-xs font-semibold text-stone-700">Dados Pré Obra</p>
        <div className="mt-2 space-y-3">
          <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs text-stone-500">Previsão de Aprovação no Condomínio</label>
              {allowEditPreObra ? (
                <input
                  type="text"
                  value={dadosPreObraForm.previsao_aprovacao_condominio}
                  onChange={(e) =>
                    setDadosPreObraForm((prev) => ({ ...prev, previsao_aprovacao_condominio: e.target.value }))
                  }
                  placeholder="Ex.: 20/04/2026"
                  className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                />
              ) : (
                <div className="mt-1 text-stone-800">{show(dadosPreObraForm.previsao_aprovacao_condominio)}</div>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-stone-500">Previsão de Aprovação na Prefeitura</label>
              {allowEditPreObra ? (
                <input
                  type="text"
                  value={dadosPreObraForm.previsao_aprovacao_prefeitura}
                  onChange={(e) =>
                    setDadosPreObraForm((prev) => ({ ...prev, previsao_aprovacao_prefeitura: e.target.value }))
                  }
                  placeholder="Ex.: 30/04/2026"
                  className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                />
              ) : (
                <div className="mt-1 text-stone-800">{show(dadosPreObraForm.previsao_aprovacao_prefeitura)}</div>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-stone-500">Previsão de Emissão do Alvará</label>
              {allowEditPreObra ? (
                <input
                  type="text"
                  value={dadosPreObraForm.previsao_emissao_alvara}
                  onChange={(e) =>
                    setDadosPreObraForm((prev) => ({ ...prev, previsao_emissao_alvara: e.target.value }))
                  }
                  placeholder="Ex.: 15/05/2026"
                  className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                />
              ) : (
                <div className="mt-1 text-stone-800">{show(dadosPreObraForm.previsao_emissao_alvara)}</div>
              )}
            </div>
            <div>
              <label className="block text-xs text-stone-500">Data de Aprovação no Condomínio</label>
              {allowEditPreObra ? (
                <input
                  type="date"
                  value={dadosPreObraForm.data_aprovacao_condominio}
                  onChange={(e) =>
                    setDadosPreObraForm((prev) => ({ ...prev, data_aprovacao_condominio: e.target.value }))
                  }
                  className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                />
              ) : (
                <div className="mt-1 text-stone-800">{show(dadosPreObraForm.data_aprovacao_condominio)}</div>
              )}
            </div>
            <div>
              <label className="block text-xs text-stone-500">Data de Aprovação na Prefeitura</label>
              {allowEditPreObra ? (
                <input
                  type="date"
                  value={dadosPreObraForm.data_aprovacao_prefeitura}
                  onChange={(e) =>
                    setDadosPreObraForm((prev) => ({ ...prev, data_aprovacao_prefeitura: e.target.value }))
                  }
                  className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                />
              ) : (
                <div className="mt-1 text-stone-800">{show(dadosPreObraForm.data_aprovacao_prefeitura)}</div>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-stone-500">Data de Emissão do Alvará</label>
              {allowEditPreObra ? (
                <input
                  type="date"
                  value={dadosPreObraForm.data_emissao_alvara}
                  onChange={(e) =>
                    setDadosPreObraForm((prev) => ({ ...prev, data_emissao_alvara: e.target.value }))
                  }
                  className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                />
              ) : (
                <div className="mt-1 text-stone-800">{show(dadosPreObraForm.data_emissao_alvara)}</div>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-stone-500">Data de aprovação do crédito</label>
              {allowEditPreObra ? (
                <input
                  type="date"
                  value={dadosPreObraForm.data_aprovacao_credito}
                  onChange={(e) =>
                    setDadosPreObraForm((prev) => ({ ...prev, data_aprovacao_credito: e.target.value }))
                  }
                  className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                />
              ) : (
                <div className="mt-1 text-stone-800">{show(dadosPreObraForm.data_aprovacao_credito)}</div>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-stone-500">Previsão de Liberação do Crédito para Obra</label>
              {allowEditPreObra ? (
                <input
                  type="text"
                  value={dadosPreObraForm.previsao_liberacao_credito_obra}
                  onChange={(e) =>
                    setDadosPreObraForm((prev) => ({ ...prev, previsao_liberacao_credito_obra: e.target.value }))
                  }
                  placeholder="Ex.: 25/05/2026"
                  className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                />
              ) : (
                <div className="mt-1 text-stone-800">{show(dadosPreObraForm.previsao_liberacao_credito_obra)}</div>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-stone-500">Previsão de Início de Obra</label>
              {allowEditPreObra ? (
                <input
                  type="text"
                  value={dadosPreObraForm.previsao_inicio_obra}
                  onChange={(e) =>
                    setDadosPreObraForm((prev) => ({ ...prev, previsao_inicio_obra: e.target.value }))
                  }
                  placeholder="Ex.: 10/06/2026"
                  className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                />
              ) : (
                <div className="mt-1 text-stone-800">{show(dadosPreObraForm.previsao_inicio_obra)}</div>
              )}
            </div>
          </div>
          {allowEditPreObra ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void onSalvarPreObra()}
                disabled={savingDadosPreObra}
                className="rounded bg-moni-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-moni-secondary disabled:opacity-60"
              >
                {savingDadosPreObra ? 'Salvando…' : 'Salvar Dados Pré Obra'}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
        <p className="text-xs font-semibold text-stone-700">Relacionamentos</p>
        <div className="mt-2 space-y-3 text-sm">
          {relacionados.pai ? (
            <div className="rounded border border-stone-200 bg-white p-2">
              <p className="text-xs font-semibold text-stone-600">Card pai</p>
              <a
                href={linkPainelRelatedCard(relacionados.pai)}
                className="mt-1 inline-flex items-center text-moni-accent hover:underline"
              >
                {(relacionados.pai.numero_franquia ?? '—') +
                  ' · ' +
                  (relacionados.pai.nome_condominio ?? relacionados.pai.cidade ?? 'Sem identificação')}
              </a>
            </div>
          ) : null}

          {relacionados.filhos.length > 0 ? (
            <div className="rounded border border-stone-200 bg-white p-2">
              <p className="text-xs font-semibold text-stone-600">Cards filhos</p>
              <div className="mt-1 flex flex-col gap-1">
                {relacionados.filhos.map((f) => (
                  <a key={f.id} href={linkPainelRelatedCard(f)} className="text-moni-accent hover:underline">
                    {(f.numero_franquia ?? '—') + ' · ' + (f.nome_condominio ?? f.cidade ?? 'Sem identificação')}
                  </a>
                ))}
              </div>
            </div>
          ) : null}

          {relacionados.irmaos.length > 0 ? (
            <div className="rounded border border-stone-200 bg-white p-2">
              <p className="text-xs font-semibold text-stone-600">Outros filhos relacionados</p>
              <div className="mt-1 flex flex-col gap-1">
                {relacionados.irmaos.map((f) => (
                  <a key={f.id} href={linkPainelRelatedCard(f)} className="text-moni-accent hover:underline">
                    {(f.numero_franquia ?? '—') + ' · ' + (f.nome_condominio ?? f.cidade ?? 'Sem identificação')}
                  </a>
                ))}
              </div>
            </div>
          ) : null}

          {!relacionados.pai && relacionados.filhos.length === 0 && relacionados.irmaos.length === 0 ? (
            <div className="rounded border border-dashed border-stone-200 bg-white p-3 text-xs text-stone-500">
              Nenhum card relacionado encontrado.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
