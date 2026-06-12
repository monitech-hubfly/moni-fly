'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, Plus } from 'lucide-react';
import type { FranqueadoEmpresaExtraRow } from '@/lib/franqueado-empresa-extra';
import {
  FRANQUEADO_EMPRESA_STATUS_LABEL,
  formatContaBancariaEmpresa,
  type FranqueadoEmpresaStatus,
} from '@/lib/franqueado-empresas';
import { criarFranqueadoEmpresaExtra, upsertFranqueadoEmpresaExtra } from '../franqueado-empresas-actions';
import { RedeDocsSubsecaoColapsavel } from './rede-docs-secao-colapsavel';

type Props = {
  redeId: string;
  empresas: FranqueadoEmpresaExtraRow[];
  permiteCriar: boolean;
};

const inputCls = 'mt-0.5 w-full rounded border border-stone-200 px-2 py-1.5 text-xs text-stone-800';

type EmpresaDraft = {
  nome: string;
  razao_social: string;
  cnpj: string;
  inscricao_municipal: string;
  inscricao_estadual: string;
  status: FranqueadoEmpresaStatus;
  conta_banco: string;
  conta_agencia: string;
  conta_numero: string;
};

function empresaToDraft(emp: FranqueadoEmpresaExtraRow): EmpresaDraft {
  return {
    nome: emp.nome ?? '',
    razao_social: emp.razao_social ?? '',
    cnpj: emp.cnpj ?? '',
    inscricao_municipal: emp.inscricao_municipal ?? '',
    inscricao_estadual: emp.inscricao_estadual ?? '',
    status: emp.status ?? 'em_abertura',
    conta_banco: emp.conta_banco ?? '',
    conta_agencia: emp.conta_agencia ?? '',
    conta_numero: emp.conta_numero ?? '',
  };
}

function EmpresaExtraCadastroCard({
  empresa,
  onRefresh,
}: {
  empresa: FranqueadoEmpresaExtraRow;
  onRefresh: () => void;
}) {
  const [draft, setDraft] = useState(() => empresaToDraft(empresa));
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setDraft(empresaToDraft(empresa));
  }, [empresa]);

  async function salvar() {
    setSalvando(true);
    setMsg(null);
    const res = await upsertFranqueadoEmpresaExtra(empresa.id, {
      nome: draft.nome.trim() || null,
      razao_social: draft.razao_social.trim() || null,
      cnpj: draft.cnpj.trim() || null,
      inscricao_municipal: draft.inscricao_municipal.trim() || null,
      inscricao_estadual: draft.inscricao_estadual.trim() || null,
      status: draft.status,
      conta_banco: draft.conta_banco.trim() || null,
      conta_agencia: draft.conta_agencia.trim() || null,
      conta_numero: draft.conta_numero.trim() || null,
    });
    setSalvando(false);
    setMsg(res.ok ? 'Cadastro salvo.' : res.error);
    if (res.ok) onRefresh();
  }

  return (
    <div className="space-y-4 rounded-lg border border-stone-200 bg-stone-50/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-600">Cadastro da empresa</p>
        <button
          type="button"
          disabled={salvando}
          onClick={() => void salvar()}
          className="inline-flex items-center gap-1 rounded bg-moni-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Salvar cadastro
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block">
          <span className="text-[11px] font-medium text-stone-500">Nome / identificador</span>
          <input
            value={draft.nome}
            onChange={(e) => setDraft((d) => ({ ...d, nome: e.target.value }))}
            className={inputCls}
            placeholder="Ex.: Empresa X"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[11px] font-medium text-stone-500">Razão social</span>
          <input
            value={draft.razao_social}
            onChange={(e) => setDraft((d) => ({ ...d, razao_social: e.target.value }))}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-medium text-stone-500">CNPJ</span>
          <input
            value={draft.cnpj}
            onChange={(e) => setDraft((d) => ({ ...d, cnpj: e.target.value }))}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-medium text-stone-500">Insc. municipal</span>
          <input
            value={draft.inscricao_municipal}
            onChange={(e) => setDraft((d) => ({ ...d, inscricao_municipal: e.target.value }))}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-medium text-stone-500">Insc. estadual</span>
          <input
            value={draft.inscricao_estadual}
            onChange={(e) => setDraft((d) => ({ ...d, inscricao_estadual: e.target.value }))}
            className={inputCls}
            placeholder="Opcional"
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-medium text-stone-500">Status</span>
          <select
            value={draft.status}
            onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as FranqueadoEmpresaStatus }))}
            className={inputCls}
          >
            {(Object.keys(FRANQUEADO_EMPRESA_STATUS_LABEL) as FranqueadoEmpresaStatus[]).map((s) => (
              <option key={s} value={s}>
                {FRANQUEADO_EMPRESA_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2 lg:col-span-3">
          <span className="text-[11px] font-medium text-stone-500">Conta bancária</span>
          <div className="mt-0.5 grid gap-2 sm:grid-cols-3">
            <input
              value={draft.conta_banco}
              onChange={(e) => setDraft((d) => ({ ...d, conta_banco: e.target.value }))}
              className={inputCls.replace('mt-0.5 ', '')}
              placeholder="Banco"
            />
            <input
              value={draft.conta_agencia}
              onChange={(e) => setDraft((d) => ({ ...d, conta_agencia: e.target.value }))}
              className={inputCls.replace('mt-0.5 ', '')}
              placeholder="Agência"
            />
            <input
              value={draft.conta_numero}
              onChange={(e) => setDraft((d) => ({ ...d, conta_numero: e.target.value }))}
              className={inputCls.replace('mt-0.5 ', '')}
              placeholder="Conta"
            />
          </div>
          {formatContaBancariaEmpresa(draft.conta_banco, draft.conta_agencia, draft.conta_numero) !== '—' ? (
            <p className="mt-1 text-[10px] text-stone-500">
              Resumo: {formatContaBancariaEmpresa(draft.conta_banco, draft.conta_agencia, draft.conta_numero)}
            </p>
          ) : null}
        </label>
      </div>

      {msg ? <p className="text-[11px] text-stone-600">{msg}</p> : null}
    </div>
  );
}

export function RedeFranqueadoEmpresasExtrasSection({ redeId, empresas, permiteCriar }: Props) {
  const router = useRouter();
  const [criando, setCriando] = useState(false);

  if (!permiteCriar && empresas.length === 0) return null;

  const refresh = () => router.refresh();

  async function criarEmpresa() {
    setCriando(true);
    const res = await criarFranqueadoEmpresaExtra(redeId);
    setCriando(false);
    if (res.ok) refresh();
  }

  return (
    <div className="space-y-3 border-t border-stone-200 pt-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-stone-800">Empresas adicionais</p>
        {permiteCriar ? (
          <button
            type="button"
            disabled={criando}
            onClick={() => void criarEmpresa()}
            className="inline-flex items-center gap-1 rounded border border-stone-300 bg-white px-2 py-1 text-xs text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            {criando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            Nova Empresa
          </button>
        ) : null}
      </div>

      {empresas.length === 0 ? (
        <p className="text-sm text-stone-500">Nenhuma empresa adicional cadastrada.</p>
      ) : (
        empresas.map((empresa, idx) => {
          const titulo =
            empresa.nome?.trim() ||
            empresa.razao_social?.trim() ||
            `Empresa ${idx + 1}`;
          return (
            <RedeDocsSubsecaoColapsavel key={empresa.id} titulo={titulo} sectionId={`empresa-extra-${empresa.id}`}>
              <EmpresaExtraCadastroCard empresa={empresa} onRefresh={refresh} />
            </RedeDocsSubsecaoColapsavel>
          );
        })
      )}
    </div>
  );
}
