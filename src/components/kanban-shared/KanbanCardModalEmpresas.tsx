'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  FRANQUEADO_EMPRESA_STATUS_LABEL,
  formatContaBancariaEmpresa,
  type FranqueadoEmpresaRow,
} from '@/lib/franqueado-empresas';
import type { FranqueadoSpeRow, FranqueadoSpeStatus } from '@/lib/franqueado-spe';
import { displayOrDash } from '@/lib/kanban/kanban-card-modal-detalhes';
import { salvarSpeDoCard } from '@/app/rede-franqueados/franqueado-spe-actions';

type Props = {
  cardId: string;
  redeFranqueadoId: string | null;
  incorporadora: FranqueadoEmpresaRow | null;
  gestora: FranqueadoEmpresaRow | null;
  spe: FranqueadoSpeRow | null;
  podeEditar: boolean;
  onSalvo?: () => void;
};

type SpeDraft = {
  nome_projeto: string;
  razao_social: string;
  cnpj: string;
  inscricao_municipal: string;
  inscricao_estadual: string;
  status: FranqueadoSpeStatus;
  conta_banco: string;
  conta_agencia: string;
  conta_numero: string;
  conta_pix_tipo: string;
  conta_pix_chave: string;
};

function speToDraft(spe: FranqueadoSpeRow | null): SpeDraft {
  return {
    nome_projeto: spe?.nome_projeto ?? '',
    razao_social: spe?.razao_social ?? '',
    cnpj: spe?.cnpj ?? '',
    inscricao_municipal: spe?.inscricao_municipal ?? '',
    inscricao_estadual: spe?.inscricao_estadual ?? '',
    status: spe?.status ?? 'em_abertura',
    conta_banco: spe?.conta_banco ?? '',
    conta_agencia: spe?.conta_agencia ?? '',
    conta_numero: spe?.conta_numero ?? '',
    conta_pix_tipo: spe?.conta_pix_tipo ?? '',
    conta_pix_chave: spe?.conta_pix_chave ?? '',
  };
}

function EmpresaReadonlyBlock({
  titulo,
  emp,
}: {
  titulo: string;
  emp: FranqueadoEmpresaRow | null;
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white/80 p-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">{titulo}</p>
      {!emp ? (
        <p className="mt-1 text-xs text-stone-500">Não cadastrada na Rede.</p>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs">
          <div>
            <span className="text-stone-500">Razão social</span>
            <div className="text-stone-800">{displayOrDash(emp.razao_social)}</div>
          </div>
          <div>
            <span className="text-stone-500">CNPJ</span>
            <div className="text-stone-800">{displayOrDash(emp.cnpj)}</div>
          </div>
          <div>
            <span className="text-stone-500">Insc. municipal</span>
            <div className="text-stone-800">{displayOrDash(emp.inscricao_municipal)}</div>
          </div>
          <div>
            <span className="text-stone-500">Insc. estadual</span>
            <div className="text-stone-800">{displayOrDash(emp.inscricao_estadual)}</div>
          </div>
          <div>
            <span className="text-stone-500">Status</span>
            <div className="text-stone-800">{FRANQUEADO_EMPRESA_STATUS_LABEL[emp.status]}</div>
          </div>
          <div>
            <span className="text-stone-500">Conta bancária</span>
            <div className="text-stone-800">
              {formatContaBancariaEmpresa(
                emp.conta_banco,
                emp.conta_agencia,
                emp.conta_numero,
                emp.conta_pix_tipo,
                emp.conta_pix_chave,
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Painel Dados das Empresas — Incorporadora/Gestora da Rede + SPE do projeto (editável). */
export function KanbanCardModalEmpresas({
  cardId,
  redeFranqueadoId,
  incorporadora,
  gestora,
  spe,
  podeEditar,
  onSalvo,
}: Props) {
  const [editandoSpe, setEditandoSpe] = useState(false);
  const [draft, setDraft] = useState<SpeDraft>(() => speToDraft(spe));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setDraft(speToDraft(spe));
    setEditandoSpe(false);
  }, [spe]);

  if (!redeFranqueadoId) {
    return (
      <p className="text-xs text-stone-500">
        Vincule um franqueado ao card para exibir Incorporadora, Gestora e SPE.
      </p>
    );
  }

  async function salvarSpe() {
    setSalvando(true);
    setErro(null);
    setMsg(null);
    const res = await salvarSpeDoCard({
      cardId,
      redeFranqueadoId: redeFranqueadoId!,
      speId: spe?.id,
      dados: {
        nome_projeto: draft.nome_projeto.trim() || null,
        razao_social: draft.razao_social.trim() || null,
        cnpj: draft.cnpj.trim() || null,
        inscricao_municipal: draft.inscricao_municipal.trim() || null,
        inscricao_estadual: draft.inscricao_estadual.trim() || null,
        status: draft.status,
        conta_banco: draft.conta_banco.trim() || null,
        conta_agencia: draft.conta_agencia.trim() || null,
        conta_numero: draft.conta_numero.trim() || null,
        conta_pix_tipo: draft.conta_pix_tipo.trim() || null,
        conta_pix_chave: draft.conta_pix_chave.trim() || null,
      },
    });
    setSalvando(false);
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    setMsg(res.mensagem);
    setEditandoSpe(false);
    onSalvo?.();
  }

  const inputCls =
    'mt-0.5 w-full rounded border border-stone-200 bg-white px-2 py-1 text-xs text-stone-800';

  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-relaxed text-stone-500">
        Incorporadora e Gestora vêm do cadastro da Rede (Dados do Franqueado). A SPE é por projeto e
        sincroniza com Cadastros de Empresas ao salvar.
      </p>

      <EmpresaReadonlyBlock titulo="Incorporadora" emp={incorporadora} />
      <EmpresaReadonlyBlock titulo="Gestora" emp={gestora} />

      <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900">SPE (projeto)</p>
          {podeEditar && !editandoSpe ? (
            <button
              type="button"
              onClick={() => setEditandoSpe(true)}
              className="rounded border border-stone-200 bg-white px-2 py-0.5 text-[11px] text-stone-600 hover:bg-stone-50"
            >
              {spe ? 'Editar' : 'Preencher'}
            </button>
          ) : null}
        </div>

        {editandoSpe ? (
          <div className="mt-2 space-y-2">
            <label className="block text-xs">
              <span className="text-stone-500">Nome do projeto</span>
              <input
                className={inputCls}
                value={draft.nome_projeto}
                onChange={(e) => setDraft((d) => ({ ...d, nome_projeto: e.target.value }))}
              />
            </label>
            <div className="grid grid-cols-2 gap-x-2 gap-y-2">
              <label className="block text-xs">
                <span className="text-stone-500">Razão social</span>
                <input
                  className={inputCls}
                  value={draft.razao_social}
                  onChange={(e) => setDraft((d) => ({ ...d, razao_social: e.target.value }))}
                />
              </label>
              <label className="block text-xs">
                <span className="text-stone-500">CNPJ</span>
                <input
                  className={inputCls}
                  value={draft.cnpj}
                  onChange={(e) => setDraft((d) => ({ ...d, cnpj: e.target.value }))}
                />
              </label>
              <label className="block text-xs">
                <span className="text-stone-500">Insc. municipal</span>
                <input
                  className={inputCls}
                  value={draft.inscricao_municipal}
                  onChange={(e) => setDraft((d) => ({ ...d, inscricao_municipal: e.target.value }))}
                />
              </label>
              <label className="block text-xs">
                <span className="text-stone-500">Insc. estadual</span>
                <input
                  className={inputCls}
                  value={draft.inscricao_estadual}
                  onChange={(e) => setDraft((d) => ({ ...d, inscricao_estadual: e.target.value }))}
                />
              </label>
              <label className="block text-xs">
                <span className="text-stone-500">Status</span>
                <select
                  className={inputCls}
                  value={draft.status}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, status: e.target.value as FranqueadoSpeStatus }))
                  }
                >
                  <option value="em_abertura">Em abertura</option>
                  <option value="ativa">Ativa</option>
                  <option value="inativa">Inativa</option>
                </select>
              </label>
              <label className="block text-xs">
                <span className="text-stone-500">Banco</span>
                <input
                  className={inputCls}
                  value={draft.conta_banco}
                  onChange={(e) => setDraft((d) => ({ ...d, conta_banco: e.target.value }))}
                />
              </label>
              <label className="block text-xs">
                <span className="text-stone-500">Agência</span>
                <input
                  className={inputCls}
                  value={draft.conta_agencia}
                  onChange={(e) => setDraft((d) => ({ ...d, conta_agencia: e.target.value }))}
                />
              </label>
              <label className="block text-xs">
                <span className="text-stone-500">Conta</span>
                <input
                  className={inputCls}
                  value={draft.conta_numero}
                  onChange={(e) => setDraft((d) => ({ ...d, conta_numero: e.target.value }))}
                />
              </label>
              <label className="block text-xs">
                <span className="text-stone-500">Tipo de chave Pix</span>
                <input
                  className={inputCls}
                  value={draft.conta_pix_tipo}
                  onChange={(e) => setDraft((d) => ({ ...d, conta_pix_tipo: e.target.value }))}
                />
              </label>
              <label className="block text-xs">
                <span className="text-stone-500">Chave Pix</span>
                <input
                  className={inputCls}
                  value={draft.conta_pix_chave}
                  onChange={(e) => setDraft((d) => ({ ...d, conta_pix_chave: e.target.value }))}
                />
              </label>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={salvando}
                onClick={() => void salvarSpe()}
                className="inline-flex items-center gap-1 rounded bg-moni-primary px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
              >
                {salvando ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Salvar SPE
              </button>
              <button
                type="button"
                disabled={salvando}
                onClick={() => {
                  setEditandoSpe(false);
                  setDraft(speToDraft(spe));
                }}
                className="rounded border border-stone-200 px-3 py-1 text-xs text-stone-600"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : spe ? (
          <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs">
            <div className="col-span-2">
              <span className="text-stone-500">Projeto</span>
              <div className="text-stone-800">{displayOrDash(spe.nome_projeto)}</div>
            </div>
            <div>
              <span className="text-stone-500">Razão social</span>
              <div className="text-stone-800">{displayOrDash(spe.razao_social)}</div>
            </div>
            <div>
              <span className="text-stone-500">CNPJ</span>
              <div className="text-stone-800">{displayOrDash(spe.cnpj)}</div>
            </div>
            <div>
              <span className="text-stone-500">Insc. municipal</span>
              <div className="text-stone-800">{displayOrDash(spe.inscricao_municipal)}</div>
            </div>
            <div>
              <span className="text-stone-500">Insc. estadual</span>
              <div className="text-stone-800">{displayOrDash(spe.inscricao_estadual)}</div>
            </div>
            <div>
              <span className="text-stone-500">Status</span>
              <div className="text-stone-800">{FRANQUEADO_EMPRESA_STATUS_LABEL[spe.status]}</div>
            </div>
            <div>
              <span className="text-stone-500">Conta bancária</span>
              <div className="text-stone-800">
                {formatContaBancariaEmpresa(
                  spe.conta_banco,
                  spe.conta_agencia,
                  spe.conta_numero,
                  spe.conta_pix_tipo,
                  spe.conta_pix_chave,
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-1 text-xs text-stone-500">
            SPE ainda não vinculada a este card. Preencha nas fases do funil ou use Editar.
          </p>
        )}
      </div>

      {erro ? <p className="text-xs text-red-600">{erro}</p> : null}
      {msg ? <p className="text-xs text-green-700">{msg}</p> : null}
    </div>
  );
}
