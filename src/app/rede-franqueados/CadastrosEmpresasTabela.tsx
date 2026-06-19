'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, ChevronLeft, ChevronRight, FileText, Loader2, Pencil, X } from 'lucide-react';
import {
  FRANQUEADO_EMPRESA_STATUS_LABEL,
  formatContaBancariaEmpresa,
  type FranqueadoEmpresaStatus,
} from '@/lib/franqueado-empresas';
import {
  speResumoColapsado,
  type CadastroEmpresasLinhaComSpe,
  type FranqueadoSpeRow,
} from '@/lib/franqueado-spe';
import { upsertFranqueadoEmpresa } from './franqueado-empresas-actions';
import { criarFranqueadoSpe, upsertFranqueadoSpe } from './franqueado-spe-actions';
import { redeAlertError, redeAlertSuccess, redeTh } from './rede-ui';
import { usePaginaTabela } from '@/lib/use-pagina-tabela';
import { MoniTabelaScrollSync } from '@/components/MoniTabelaScrollSync';

const PER_PAGE = 15;
const NOVA_SPE_DRAFT_KEY = '__nova__';
const inputCls = 'w-full min-w-0 rounded-md border border-stone-300 px-2 py-1 text-sm';

type EmpresaDraft = {
  razao_social: string;
  cnpj: string;
  inscricao_municipal: string;
  inscricao_estadual: string;
  status: FranqueadoEmpresaStatus;
  conta_banco: string;
  conta_agencia: string;
  conta_numero: string;
};

function emptyEmpresaDraft(): EmpresaDraft {
  return {
    razao_social: '',
    cnpj: '',
    inscricao_municipal: '',
    inscricao_estadual: '',
    status: 'ativa',
    conta_banco: '',
    conta_agencia: '',
    conta_numero: '',
  };
}

function empresaToDraft(
  emp: CadastroEmpresasLinhaComSpe['incorporadora'],
): EmpresaDraft {
  return {
    razao_social: emp?.razao_social ?? '',
    cnpj: emp?.cnpj ?? '',
    inscricao_municipal: emp?.inscricao_municipal ?? '',
    inscricao_estadual: emp?.inscricao_estadual ?? '',
    status: emp?.status ?? 'ativa',
    conta_banco: emp?.conta_banco ?? '',
    conta_agencia: emp?.conta_agencia ?? '',
    conta_numero: emp?.conta_numero ?? '',
  };
}

function speToDraft(spe: FranqueadoSpeRow): EmpresaDraft {
  return {
    razao_social: spe.razao_social ?? '',
    cnpj: spe.cnpj ?? '',
    inscricao_municipal: spe.inscricao_municipal ?? '',
    inscricao_estadual: spe.inscricao_estadual ?? '',
    status: spe.status ?? 'em_abertura',
    conta_banco: spe.conta_banco ?? '',
    conta_agencia: spe.conta_agencia ?? '',
    conta_numero: spe.conta_numero ?? '',
  };
}

function draftSpeTemDados(d: EmpresaDraft): boolean {
  return !!(
    d.razao_social.trim() ||
    d.cnpj.trim() ||
    d.inscricao_municipal.trim() ||
    d.inscricao_estadual.trim() ||
    d.conta_banco.trim() ||
    d.conta_agencia.trim() ||
    d.conta_numero.trim()
  );
}

function draftToUpsert(d: EmpresaDraft) {
  return {
    razao_social: d.razao_social.trim() || null,
    cnpj: d.cnpj.trim() || null,
    inscricao_municipal: d.inscricao_municipal.trim() || null,
    inscricao_estadual: d.inscricao_estadual.trim() || null,
    status: d.status,
    conta_banco: d.conta_banco.trim() || null,
    conta_agencia: d.conta_agencia.trim() || null,
    conta_numero: d.conta_numero.trim() || null,
  };
}

function StatusEmpresaBadge({ status }: { status: FranqueadoEmpresaStatus }) {
  const label = FRANQUEADO_EMPRESA_STATUS_LABEL[status];
  const cls =
    status === 'ativa'
      ? 'bg-green-100 text-green-800 border-green-200'
      : status === 'em_abertura'
        ? 'bg-amber-100 text-amber-900 border-amber-200'
        : 'bg-stone-100 text-stone-600 border-stone-200';
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

type Props = {
  linhas: CadastroEmpresasLinhaComSpe[];
  buscaAtiva?: boolean;
  totalSemBusca?: number;
  /** Altera quando o filtro de busca muda — reseta paginação para 1. */
  buscaResetKey?: string;
};

export function CadastrosEmpresasTabela({
  linhas,
  buscaAtiva = false,
  totalSemBusca,
  buscaResetKey = '',
}: Props) {
  const router = useRouter();
  const [speColunasExpandidas, setSpeColunasExpandidas] = useState(false);
  const { page: safePage, setPage, totalPages, start } = usePaginaTabela(
    linhas.length,
    PER_PAGE,
    buscaResetKey,
  );
  const [editingRedeId, setEditingRedeId] = useState<string | null>(null);
  const [draftIncorp, setDraftIncorp] = useState<EmpresaDraft>(emptyEmpresaDraft());
  const [draftGest, setDraftGest] = useState<EmpresaDraft>(emptyEmpresaDraft());
  const [draftSpes, setDraftSpes] = useState<Record<string, EmpresaDraft>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  const totalGeral = totalSemBusca ?? linhas.length;
  const pageRows = useMemo(() => linhas.slice(start, start + PER_PAGE), [linhas, start]);

  const cancelEdit = () => {
    setEditingRedeId(null);
    setDraftIncorp(emptyEmpresaDraft());
    setDraftGest(emptyEmpresaDraft());
    setDraftSpes({});
    setMsg(null);
  };

  const beginEdit = (linha: CadastroEmpresasLinhaComSpe) => {
    setMsg(null);
    setEditingRedeId(linha.redeId);
    setDraftIncorp(empresaToDraft(linha.incorporadora));
    setDraftGest(empresaToDraft(linha.gestora));
    const spesDraft: Record<string, EmpresaDraft> = {};
    for (const spe of linha.spes) {
      spesDraft[spe.id] = speToDraft(spe);
    }
    spesDraft[NOVA_SPE_DRAFT_KEY] = emptyEmpresaDraft();
    setDraftSpes(spesDraft);
    setSpeColunasExpandidas(true);
  };

  const patchSpeDraft = (speId: string, updater: React.SetStateAction<EmpresaDraft>) => {
    setDraftSpes((prev) => {
      const atual = prev[speId] ?? emptyEmpresaDraft();
      const next = typeof updater === 'function' ? updater(atual) : updater;
      return { ...prev, [speId]: next };
    });
  };

  const save = async (redeId: string) => {
    setSaving(true);
    setMsg(null);
    const r1 = await upsertFranqueadoEmpresa(redeId, 'incorporadora', draftToUpsert(draftIncorp));
    if (!r1.ok) {
      setSaving(false);
      setMsg({ tipo: 'erro', texto: r1.error });
      return;
    }
    const r2 = await upsertFranqueadoEmpresa(redeId, 'gestora', {
      razao_social: draftGest.razao_social.trim() || null,
      cnpj: draftGest.cnpj.trim() || null,
      inscricao_municipal: draftGest.inscricao_municipal.trim() || null,
      inscricao_estadual: draftGest.inscricao_estadual.trim() || null,
      status: draftGest.status,
    });
    if (!r2.ok) {
      setSaving(false);
      setMsg({ tipo: 'erro', texto: r2.error });
      return;
    }
    for (const [speId, draftSpe] of Object.entries(draftSpes)) {
      if (speId === NOVA_SPE_DRAFT_KEY) {
        if (!draftSpeTemDados(draftSpe)) continue;
        const criar = await criarFranqueadoSpe(redeId, draftSpe.razao_social.trim() || null);
        if (!criar.ok) {
          setSaving(false);
          setMsg({ tipo: 'erro', texto: criar.error });
          return;
        }
        const newSpeId = criar.speId;
        if (!newSpeId) {
          setSaving(false);
          setMsg({ tipo: 'erro', texto: 'Falha ao criar SPE.' });
          return;
        }
        const rSpe = await upsertFranqueadoSpe(newSpeId, draftToUpsert(draftSpe));
        if (!rSpe.ok) {
          setSaving(false);
          setMsg({ tipo: 'erro', texto: rSpe.error });
          return;
        }
        continue;
      }
      const rSpe = await upsertFranqueadoSpe(speId, draftToUpsert(draftSpe));
      if (!rSpe.ok) {
        setSaving(false);
        setMsg({ tipo: 'erro', texto: rSpe.error });
        return;
      }
    }
    setSaving(false);
    setMsg({ tipo: 'ok', texto: 'Cadastros de empresa salvos.' });
    cancelEdit();
    router.refresh();
  };

  const thGroup =
    'border-b border-stone-200 bg-stone-100/90 px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-stone-600';

  if (linhas.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-6 text-center text-sm text-stone-600">
        {buscaAtiva && totalGeral > 0
          ? 'Nenhum franqueado encontrado para esta pesquisa.'
          : 'Nenhum franqueado na rede.'}
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-full space-y-4">
      {msg ? (
        <div className={msg.tipo === 'ok' ? redeAlertSuccess : redeAlertError} role="status">
          {msg.texto}
        </div>
      ) : null}

      <MoniTabelaScrollSync className="rounded-xl border border-stone-200/90 bg-white shadow-sm">
        <table className="w-full min-w-[1680px] border-collapse text-left text-sm">
          <thead>
            <tr>
              <th colSpan={4} className={thGroup}>
                Franqueado
              </th>
              <th colSpan={6} className={`${thGroup} border-l border-stone-200`}>
                Incorporadora
              </th>
              <th colSpan={5} className={`${thGroup} border-l border-stone-200`}>
                Gestora
              </th>
              <th
                colSpan={speColunasExpandidas ? 6 : 1}
                className={`${thGroup} border-l border-stone-200`}
              >
                <button
                  type="button"
                  onClick={() => setSpeColunasExpandidas((v) => !v)}
                  className="inline-flex items-center gap-1 hover:text-stone-900"
                  title={speColunasExpandidas ? 'Minimizar colunas SPE' : 'Expandir colunas SPE'}
                >
                  {speColunasExpandidas ? (
                    <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                  )}
                  SPE
                </button>
              </th>
              <th
                rowSpan={2}
                className="sticky right-0 z-30 w-24 min-w-[6rem] border-l border-stone-200 bg-stone-50 align-bottom px-1 py-2"
              >
                <span className="sr-only">Ações</span>
              </th>
            </tr>
            <tr className="border-b border-stone-200 bg-stone-50/95">
              <th className={redeTh}>Nº Franquia</th>
              <th className={redeTh}>Modalidade</th>
              <th className={redeTh}>Nome completo</th>
              <th className={redeTh}>Status franquia</th>
              <th className={`${redeTh} border-l border-stone-200`}>Razão social</th>
              <th className={redeTh}>CNPJ</th>
              <th className={redeTh}>Insc. municipal</th>
              <th className={redeTh}>Insc. estadual</th>
              <th className={redeTh}>Status</th>
              <th className={redeTh}>Conta bancária</th>
              <th className={`${redeTh} border-l border-stone-200`}>Razão social</th>
              <th className={redeTh}>CNPJ</th>
              <th className={redeTh}>Insc. municipal</th>
              <th className={redeTh}>Insc. estadual</th>
              <th className={redeTh}>Status</th>
              {speColunasExpandidas ? (
                <>
                  <th className={`${redeTh} border-l border-stone-200`}>Razão social</th>
                  <th className={redeTh}>CNPJ</th>
                  <th className={redeTh}>Insc. municipal</th>
                  <th className={redeTh}>Insc. estadual</th>
                  <th className={redeTh}>Status</th>
                  <th className={redeTh}>Conta bancária</th>
                </>
              ) : (
                <th className={`${redeTh} border-l border-stone-200`}>Resumo</th>
              )}
            </tr>
          </thead>
          <tbody>
            {pageRows.flatMap((linha) => {
              const isEditing = editingRedeId === linha.redeId;
              const inc = linha.incorporadora;
              const ges = linha.gestora;

              if (isEditing) {
                const speEditRows: (FranqueadoSpeRow | null)[] = [...linha.spes, null];
                return speEditRows.map((spe, speIdx) => (
                  <tr
                    key={spe?.id ?? `${linha.redeId}-nova-spe`}
                    className="border-b border-stone-200 bg-stone-50/90 align-top"
                  >
                    {speIdx === 0 ? (
                      <>
                        <td className="px-3 py-2 font-medium text-stone-900">{linha.n_franquia ?? '—'}</td>
                        <td className="px-3 py-2 text-stone-700">{linha.modalidade?.trim() || '—'}</td>
                        <td className="px-3 py-2 text-stone-700">{linha.nome_completo?.trim() || '—'}</td>
                        <td className="px-3 py-2 text-stone-700">{linha.status_franquia?.trim() || '—'}</td>
                        <EmpresaEditCells
                          draft={draftIncorp}
                          setDraft={setDraftIncorp}
                          showConta
                          borderLeft
                        />
                        <EmpresaEditCells draft={draftGest} setDraft={setDraftGest} borderLeft />
                      </>
                    ) : (
                      <td
                        colSpan={15}
                        className="px-3 py-2 text-right text-[11px] font-medium text-stone-500"
                      >
                        {spe
                          ? spe.nome_projeto?.trim() || spe.razao_social?.trim() || `SPE ${speIdx + 1}`
                          : 'Nova SPE'}
                      </td>
                    )}
                    {speColunasExpandidas ? (
                      spe ? (
                        <SpeEditCells
                          draft={draftSpes[spe.id] ?? emptyEmpresaDraft()}
                          setDraft={(updater) => patchSpeDraft(spe.id, updater)}
                          borderLeft={speIdx === 0}
                        />
                      ) : (
                        <SpeEditCells
                          draft={draftSpes[NOVA_SPE_DRAFT_KEY] ?? emptyEmpresaDraft()}
                          setDraft={(updater) => patchSpeDraft(NOVA_SPE_DRAFT_KEY, updater)}
                          borderLeft={speIdx === 0}
                        />
                      )
                    ) : speIdx === 0 ? (
                      <td className="border-l border-stone-100 px-3 py-2.5 text-stone-600">
                        {speResumoColapsado(linha.spes)}
                      </td>
                    ) : null}
                    {speIdx === 0 ? (
                      <td className="sticky right-0 border-l border-stone-200 bg-stone-50 px-1 py-2 align-middle">
                        <div className="flex flex-col items-center gap-1">
                          <button
                            type="button"
                            title="Salvar"
                            disabled={saving}
                            onClick={() => void save(linha.redeId)}
                            className="rounded-md bg-moni-primary p-1.5 text-white hover:opacity-90 disabled:opacity-50"
                          >
                            {saving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            title="Cancelar"
                            disabled={saving}
                            onClick={cancelEdit}
                            className="rounded-md border border-stone-300 bg-white p-1.5 text-stone-700 hover:bg-stone-100"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    ) : (
                      <td className="sticky right-0 border-l border-stone-200 bg-stone-50" />
                    )}
                  </tr>
                ));
              }

              const speViewRows: (FranqueadoSpeRow | null)[] =
                linha.spes.length > 0 ? linha.spes : [null];

              return speViewRows.flatMap((spe, speIdx) => {
                const row = (
                  <tr
                    key={spe?.id ?? `${linha.redeId}-sem-spe`}
                    className="group border-b border-stone-100 align-top hover:bg-stone-50/70"
                  >
                    {speIdx === 0 ? (
                      <>
                        <td className="px-3 py-2.5 font-medium text-stone-900">{linha.n_franquia ?? '—'}</td>
                        <td className="px-3 py-2.5 text-stone-700">{linha.modalidade?.trim() || '—'}</td>
                        <td className="max-w-[12rem] px-3 py-2.5 text-stone-700">
                          {linha.nome_completo?.trim() || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-stone-700">{linha.status_franquia?.trim() || '—'}</td>
                        <td className="border-l border-stone-100 px-3 py-2.5 text-stone-700">
                          {inc?.razao_social?.trim() || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-stone-700">{inc?.cnpj?.trim() || '—'}</td>
                        <td className="px-3 py-2.5 text-stone-700">{inc?.inscricao_municipal?.trim() || '—'}</td>
                        <td className="px-3 py-2.5 text-stone-700">{inc?.inscricao_estadual?.trim() || '—'}</td>
                        <td className="px-3 py-2.5">
                          {inc ? <StatusEmpresaBadge status={inc.status} /> : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-stone-700">
                          {formatContaBancariaEmpresa(inc?.conta_banco, inc?.conta_agencia, inc?.conta_numero)}
                        </td>
                        <td className="border-l border-stone-100 px-3 py-2.5 text-stone-700">
                          {ges?.razao_social?.trim() || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-stone-700">{ges?.cnpj?.trim() || '—'}</td>
                        <td className="px-3 py-2.5 text-stone-700">{ges?.inscricao_municipal?.trim() || '—'}</td>
                        <td className="px-3 py-2.5 text-stone-700">{ges?.inscricao_estadual?.trim() || '—'}</td>
                        <td className="px-3 py-2.5">
                          {ges ? <StatusEmpresaBadge status={ges.status} /> : '—'}
                        </td>
                      </>
                    ) : (
                      <td
                        colSpan={15}
                        className="px-3 py-2.5 text-right text-[11px] font-medium text-stone-500"
                      >
                        {spe?.nome_projeto?.trim() || spe?.razao_social?.trim() || `SPE ${speIdx + 1}`}
                      </td>
                    )}
                    {speColunasExpandidas ? (
                      spe ? (
                        <>
                          <td className="border-l border-stone-100 px-3 py-2.5 text-stone-700">
                            {spe.razao_social?.trim() || spe.nome_projeto?.trim() || '—'}
                          </td>
                          <td className="px-3 py-2.5 text-stone-700">{spe.cnpj?.trim() || '—'}</td>
                          <td className="px-3 py-2.5 text-stone-700">{spe.inscricao_municipal?.trim() || '—'}</td>
                          <td className="px-3 py-2.5 text-stone-700">{spe.inscricao_estadual?.trim() || '—'}</td>
                          <td className="px-3 py-2.5">
                            <StatusEmpresaBadge status={spe.status} />
                          </td>
                          <td className="px-3 py-2.5 text-stone-700">
                            {formatContaBancariaEmpresa(spe.conta_banco, spe.conta_agencia, spe.conta_numero)}
                          </td>
                        </>
                      ) : (
                        <td colSpan={6} className="border-l border-stone-100 px-3 py-2.5 text-stone-500">
                          —
                        </td>
                      )
                    ) : speIdx === 0 ? (
                      <td className="border-l border-stone-100 px-3 py-2.5 text-stone-700">
                        {speResumoColapsado(linha.spes)}
                      </td>
                    ) : null}
                    {speIdx === 0 ? (
                      <td className="sticky right-0 border-l border-stone-200 bg-white px-1 py-2 align-middle group-hover:bg-stone-50/90">
                        <div className="flex flex-col items-center justify-center gap-1 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                          <Link
                            href={`/rede-franqueados/${linha.redeId}#empresas`}
                            title="Documentos das empresas"
                            className="rounded-md p-1.5 text-moni-primary hover:bg-moni-light/60"
                          >
                            <FileText className="h-4 w-4" />
                            <span className="sr-only">Documentos</span>
                          </Link>
                          <button
                            type="button"
                            title="Editar empresas"
                            disabled={editingRedeId !== null}
                            onClick={() => beginEdit(linha)}
                            className="rounded-md p-1.5 text-stone-600 hover:bg-stone-200/80 disabled:opacity-50"
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Editar</span>
                          </button>
                        </div>
                      </td>
                    ) : (
                      <td className="sticky right-0 border-l border-stone-200 bg-white group-hover:bg-stone-50/90" />
                    )}
                  </tr>
                );
                return [row];
              });
            })}
          </tbody>
        </table>
      </MoniTabelaScrollSync>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-3">
        <p className="text-sm text-stone-600">
          Mostrando {start + 1}–{Math.min(start + PER_PAGE, linhas.length)} de {linhas.length} franqueado
          {linhas.length === 1 ? '' : 's'}
          {buscaAtiva && totalGeral > linhas.length ? (
            <span className="text-stone-500"> (filtrado de {totalGeral})</span>
          ) : null}
        </p>
        {totalPages > 1 ? (
          <nav className="flex flex-wrap items-center gap-1" aria-label="Paginação cadastros de empresas">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
            >
              Anterior
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={`min-w-[2.25rem] rounded-lg border px-2 py-1.5 text-sm font-medium ${
                  p === safePage
                    ? 'border-moni-primary bg-moni-primary text-white'
                    : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
            >
              Próxima
            </button>
          </nav>
        ) : null}
      </div>
    </div>
  );
}

/** Colunas SPE expandidas: razão social, inscrições, status e conta (mesmos tipos da incorporadora). */
function SpeEditCells({
  draft,
  setDraft,
  borderLeft = false,
}: {
  draft: EmpresaDraft;
  setDraft: React.Dispatch<React.SetStateAction<EmpresaDraft>>;
  borderLeft?: boolean;
}) {
  const cell = borderLeft ? 'border-l border-stone-200 px-2 py-2' : 'px-2 py-2';
  return (
    <>
      <td className={cell}>
        <input
          type="text"
          value={draft.razao_social}
          onChange={(e) => setDraft((d) => ({ ...d, razao_social: e.target.value }))}
          className={inputCls}
          placeholder="Razão social"
        />
      </td>
      <td className={cell}>
        <input
          type="text"
          value={draft.cnpj}
          onChange={(e) => setDraft((d) => ({ ...d, cnpj: e.target.value }))}
          className={inputCls}
        />
      </td>
      <td className={cell}>
        <input
          type="text"
          value={draft.inscricao_municipal}
          onChange={(e) => setDraft((d) => ({ ...d, inscricao_municipal: e.target.value }))}
          className={inputCls}
        />
      </td>
      <td className={cell}>
        <input
          type="text"
          value={draft.inscricao_estadual}
          onChange={(e) => setDraft((d) => ({ ...d, inscricao_estadual: e.target.value }))}
          className={inputCls}
          placeholder="Opcional"
        />
      </td>
      <td className={cell}>
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
      </td>
      <td className={cell}>
        <div className="space-y-1">
          <input
            type="text"
            value={draft.conta_banco}
            onChange={(e) => setDraft((d) => ({ ...d, conta_banco: e.target.value }))}
            className={inputCls}
            placeholder="Banco"
          />
          <div className="flex gap-1">
            <input
              type="text"
              value={draft.conta_agencia}
              onChange={(e) => setDraft((d) => ({ ...d, conta_agencia: e.target.value }))}
              className={inputCls}
              placeholder="Agência"
            />
            <input
              type="text"
              value={draft.conta_numero}
              onChange={(e) => setDraft((d) => ({ ...d, conta_numero: e.target.value }))}
              className={inputCls}
              placeholder="Conta"
            />
          </div>
        </div>
      </td>
    </>
  );
}

function EmpresaEditCells({
  draft,
  setDraft,
  showConta = false,
  borderLeft = false,
}: {
  draft: EmpresaDraft;
  setDraft: React.Dispatch<React.SetStateAction<EmpresaDraft>>;
  showConta?: boolean;
  borderLeft?: boolean;
}) {
  const cell = borderLeft ? 'border-l border-stone-200 px-2 py-2' : 'px-2 py-2';
  return (
    <>
      <td className={cell}>
        <input
          type="text"
          value={draft.razao_social}
          onChange={(e) => setDraft((d) => ({ ...d, razao_social: e.target.value }))}
          className={inputCls}
          placeholder="Razão social"
        />
      </td>
      <td className={cell}>
        <input
          type="text"
          value={draft.cnpj}
          onChange={(e) => setDraft((d) => ({ ...d, cnpj: e.target.value }))}
          className={inputCls}
        />
      </td>
      <td className={cell}>
        <input
          type="text"
          value={draft.inscricao_municipal}
          onChange={(e) => setDraft((d) => ({ ...d, inscricao_municipal: e.target.value }))}
          className={inputCls}
        />
      </td>
      <td className={cell}>
        <input
          type="text"
          value={draft.inscricao_estadual}
          onChange={(e) => setDraft((d) => ({ ...d, inscricao_estadual: e.target.value }))}
          className={inputCls}
          placeholder="Opcional"
        />
      </td>
      <td className={cell}>
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
      </td>
      {showConta ? (
        <td className={cell}>
          <div className="space-y-1">
            <input
              type="text"
              value={draft.conta_banco}
              onChange={(e) => setDraft((d) => ({ ...d, conta_banco: e.target.value }))}
              className={inputCls}
              placeholder="Banco"
            />
            <div className="flex gap-1">
              <input
                type="text"
                value={draft.conta_agencia}
                onChange={(e) => setDraft((d) => ({ ...d, conta_agencia: e.target.value }))}
                className={inputCls}
                placeholder="Agência"
              />
              <input
                type="text"
                value={draft.conta_numero}
                onChange={(e) => setDraft((d) => ({ ...d, conta_numero: e.target.value }))}
                className={inputCls}
                placeholder="Conta"
              />
            </div>
          </div>
        </td>
      ) : null}
    </>
  );
}
