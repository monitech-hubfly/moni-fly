'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, FileText, Lock, X } from 'lucide-react';
import {
  concluirChecklistCredito,
  getChecklistCreditoForCard,
  removeChecklistCreditoFile,
  saveChecklistCreditoDraft,
} from '@/app/steps-viabilidade/checklist-credito/actions';
import { getOrCreatePublicFormLink } from '@/app/steps-viabilidade/card-actions';

// Guardamos a regra de obrigatoriedade para reativar no futuro.
const ENFORCE_CHECKLIST_CREDITO_REQUIRED = false;

type Props = {
  processoId: string;
  className?: string;
  showInDados?: boolean;
};

type CategoriaProfissional =
  | 'Empresário'
  | 'Assalariado'
  | 'Funcionário Público ou Aposentado'
  | 'Profissional Liberal / Autônomo'
  | 'Renda de Aluguel'
  | 'Pessoa Jurídica'
  | '';

type ChecklistCreditoForm = {
  upload_iptu: string | null;
  upload_matricula: string | null;
  upload_orcamento_cronograma: string | null;
  upload_projeto_aprovado: string | null;
  uploads_documentos_pessoais: string[];
  categoria_profissional: CategoriaProfissional;
  upload_contrato_social: string | null;
  uploads_extratos_pf: string[];
  upload_irpf: string | null;
  operacao_acima_3m: boolean | null;
  uploads_extratos_pj: string[];
  upload_faturamento_12m: string | null;
  uploads_ctps: string[];
  uploads_holerite: string[];
  upload_comprovante_salario: string | null;
  descricao_atividade: string | null;
  presta_servico_empresas: boolean | null;
  upload_contrato_prestacao: string | null;
  upload_contrato_aluguel: string | null;
  uploads_extratos_aluguel: string[];
  valor_operacao_pj: 'Até R$ 1.000.000,00' | 'Acima de R$ 1.000.000,00' | '';
  upload_contrato_social_pj: string | null;
  upload_faturamento_pj: string | null;
  uploads_extratos_pj_cc: string[];
  upload_balanco_dre: string | null;
  endividamento_info: string | null;
};

type ChecklistCreditoRecord = ChecklistCreditoForm & {
  id: string;
  processo_id: string;
  franqueado_id: string | null;
  nome_franqueado: string | null;
  preenchido_por: string | null;
  completo: boolean;
  created_at: string;
  updated_at: string;
};

const EMPTY: ChecklistCreditoForm = {
  upload_iptu: null,
  upload_matricula: null,
  upload_orcamento_cronograma: null,
  upload_projeto_aprovado: null,
  uploads_documentos_pessoais: [],
  categoria_profissional: '',
  upload_contrato_social: null,
  uploads_extratos_pf: [],
  upload_irpf: null,
  operacao_acima_3m: null,
  uploads_extratos_pj: [],
  upload_faturamento_12m: null,
  uploads_ctps: [],
  uploads_holerite: [],
  upload_comprovante_salario: null,
  descricao_atividade: null,
  presta_servico_empresas: null,
  upload_contrato_prestacao: null,
  upload_contrato_aluguel: null,
  uploads_extratos_aluguel: [],
  valor_operacao_pj: '',
  upload_contrato_social_pj: null,
  upload_faturamento_pj: null,
  uploads_extratos_pj_cc: [],
  upload_balanco_dre: null,
  endividamento_info: null,
};

function basename(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx >= 0 ? path.slice(idx + 1) : path;
}

function has(v: string | null | undefined): boolean {
  return Boolean(v && String(v).trim());
}
function hasArr(v: unknown): boolean {
  return Array.isArray(v) && v.length > 0;
}

function isComplete(form: ChecklistCreditoForm): boolean {
  const base =
    has(form.upload_iptu) &&
    has(form.upload_matricula) &&
    has(form.upload_orcamento_cronograma) &&
    has(form.upload_projeto_aprovado) &&
    hasArr(form.uploads_documentos_pessoais) &&
    has(form.categoria_profissional);
  if (!base) return false;
  if (form.categoria_profissional === 'Empresário') {
    if (!has(form.upload_contrato_social) || !hasArr(form.uploads_extratos_pf) || !has(form.upload_irpf)) return false;
    if (form.operacao_acima_3m === true) return hasArr(form.uploads_extratos_pj) && has(form.upload_faturamento_12m);
    return form.operacao_acima_3m === false;
  }
  if (form.categoria_profissional === 'Assalariado') return hasArr(form.uploads_ctps) && hasArr(form.uploads_holerite) && has(form.upload_irpf);
  if (form.categoria_profissional === 'Funcionário Público ou Aposentado') return has(form.upload_comprovante_salario) && has(form.upload_irpf);
  if (form.categoria_profissional === 'Profissional Liberal / Autônomo') {
    if (!has(form.descricao_atividade) || !hasArr(form.uploads_extratos_pf) || !has(form.upload_irpf)) return false;
    if (form.presta_servico_empresas === true) return has(form.upload_contrato_prestacao);
    return form.presta_servico_empresas === false;
  }
  if (form.categoria_profissional === 'Renda de Aluguel') return has(form.upload_contrato_aluguel) && hasArr(form.uploads_extratos_aluguel) && has(form.upload_irpf);
  if (form.categoria_profissional === 'Pessoa Jurídica') {
    if (!has(form.valor_operacao_pj)) return false;
    if (form.valor_operacao_pj === 'Até R$ 1.000.000,00') return has(form.upload_contrato_social_pj) && has(form.upload_faturamento_pj) && hasArr(form.uploads_extratos_pj_cc);
    return has(form.upload_balanco_dre) && has(form.upload_contrato_social_pj) && has(form.upload_faturamento_pj) && hasArr(form.uploads_extratos_pj_cc) && has(form.endividamento_info);
  }
  return false;
}

function calcProgress(form: ChecklistCreditoForm): number {
  const req: Array<boolean> = [
    has(form.upload_iptu),
    has(form.upload_matricula),
    has(form.upload_orcamento_cronograma),
    has(form.upload_projeto_aprovado),
    hasArr(form.uploads_documentos_pessoais),
    has(form.categoria_profissional),
  ];
  if (form.categoria_profissional === 'Empresário') {
    req.push(has(form.upload_contrato_social), hasArr(form.uploads_extratos_pf), has(form.upload_irpf), form.operacao_acima_3m !== null);
    if (form.operacao_acima_3m) req.push(hasArr(form.uploads_extratos_pj), has(form.upload_faturamento_12m));
  } else if (form.categoria_profissional === 'Assalariado') {
    req.push(hasArr(form.uploads_ctps), hasArr(form.uploads_holerite), has(form.upload_irpf));
  } else if (form.categoria_profissional === 'Funcionário Público ou Aposentado') {
    req.push(has(form.upload_comprovante_salario), has(form.upload_irpf));
  } else if (form.categoria_profissional === 'Profissional Liberal / Autônomo') {
    req.push(has(form.descricao_atividade), hasArr(form.uploads_extratos_pf), has(form.upload_irpf), form.presta_servico_empresas !== null);
    if (form.presta_servico_empresas) req.push(has(form.upload_contrato_prestacao));
  } else if (form.categoria_profissional === 'Renda de Aluguel') {
    req.push(has(form.upload_contrato_aluguel), hasArr(form.uploads_extratos_aluguel), has(form.upload_irpf));
  } else if (form.categoria_profissional === 'Pessoa Jurídica') {
    req.push(has(form.valor_operacao_pj));
    if (form.valor_operacao_pj === 'Até R$ 1.000.000,00') {
      req.push(has(form.upload_contrato_social_pj), has(form.upload_faturamento_pj), hasArr(form.uploads_extratos_pj_cc));
    } else if (form.valor_operacao_pj === 'Acima de R$ 1.000.000,00') {
      req.push(has(form.upload_balanco_dre), has(form.upload_contrato_social_pj), has(form.upload_faturamento_pj), hasArr(form.uploads_extratos_pj_cc), has(form.endividamento_info));
    }
  }
  const done = req.filter(Boolean).length;
  return req.length ? Math.round((done / req.length) * 100) : 0;
}

export function ChecklistCreditoSection({ processoId, className, showInDados = false }: Props) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [record, setRecord] = useState<ChecklistCreditoRecord | null>(null);
  const [candidate, setCandidate] = useState<ChecklistCreditoRecord | null>(null);
  const [canView, setCanView] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [hasOwn, setHasOwn] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ChecklistCreditoForm>(EMPTY);
  const [showReuseBanner, setShowReuseBanner] = useState(false);
  const completo = useMemo(
    () => (ENFORCE_CHECKLIST_CREDITO_REQUIRED ? isComplete(form) : Boolean(record?.completo)),
    [form, record?.completo],
  );
  const progress = useMemo(() => calcProgress(form), [form]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const r = await getChecklistCreditoForCard(processoId);
      if (!r.ok) {
        setLoadError(r.error ?? 'Erro ao carregar Checklist Crédito.');
        return;
      }
      setRecord(r.record);
      setHasOwn(r.hasOwnRecord);
      setCanView(r.canView);
      setSignedUrls(r.signedUrls);
      setCandidate(r.candidate);
      if (r.record) setForm({ ...EMPTY, ...r.record });
      else setForm(EMPTY);
      setShowReuseBanner(Boolean(!r.record && r.candidate));
    } catch {
      setLoadError('Erro ao carregar Checklist Crédito.');
    } finally {
      setLoading(false);
    }
  }, [processoId]);

  useEffect(() => {
    void load();
  }, [load]);

  const maskClass = canView ? '' : 'blur-[6px] pointer-events-none select-none';
  const overlay = !canView && record;
  const copyShareLink = async () => {
    const linkRes = await getOrCreatePublicFormLink(processoId, 'credito');
    if (!linkRes.ok) {
      alert(linkRes.error);
      return;
    }
    const shareLink =
      typeof window === 'undefined'
        ? `/public/forms/credito?token=${encodeURIComponent(linkRes.token)}`
        : `${window.location.origin}/public/forms/credito?token=${encodeURIComponent(linkRes.token)}`;

    const fallbackCopy = (text: string) => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        ta.style.left = '-1000px';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ta.setSelectionRange(0, ta.value.length);
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
      } catch {
        return false;
      }
    };

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareLink);
        alert('Link de compartilhamento copiado.');
        return;
      }
      if (fallbackCopy(shareLink)) {
        alert('Link de compartilhamento copiado.');
        return;
      }
      const manual = window.prompt('Copie o link abaixo:', shareLink);
      if (manual !== null) alert('Link pronto para cópia manual.');
    } catch {
      if (fallbackCopy(shareLink)) {
        alert('Link de compartilhamento copiado.');
        return;
      }
      const manual = window.prompt('Copie o link abaixo:', shareLink);
      if (manual !== null) alert('Link pronto para cópia manual.');
    }
  };

  const upload = async (field: keyof ChecklistCreditoForm, files: FileList | null, multiple = false) => {
    if (!files || files.length === 0) return;
    const fd = new FormData();
    fd.append('processoId', processoId);
    fd.append('fieldKey', String(field));
    Array.from(files).forEach((f) => fd.append('files', f));
    const res = await fetch('/api/checklist-credito/upload', { method: 'POST', body: fd });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; paths?: string[] } | null;
    if (!res.ok || !json?.ok || !Array.isArray(json.paths)) {
      alert(json?.error ?? 'Erro no upload');
      return;
    }
    const uploadedPaths = json.paths;
    setForm((prev) => {
      const next = { ...prev };
      if (multiple) (next as any)[field] = uploadedPaths;
      else (next as any)[field] = uploadedPaths[0] ?? null;
      return next;
    });
  };

  const saveDraft = async () => {
    setSaving(true);
    const r = await saveChecklistCreditoDraft(processoId, form);
    setSaving(false);
    if (!r.ok) {
      alert(r.error);
      return false;
    }
    await load();
    return true;
  };

  const nextPage = async () => {
    const ok = await saveDraft();
    if (!ok) return;
    setPage((p) => Math.min(4, p + 1));
  };
  const prevPage = async () => {
    const ok = await saveDraft();
    if (!ok) return;
    setPage((p) => Math.max(0, p - 1));
  };

  const conclude = async () => {
    setSaving(true);
    const r = await concluirChecklistCredito(processoId, form);
    setSaving(false);
    if (!r.ok) {
      alert(r.error);
      return;
    }
    setDrawerOpen(false);
    await load();
  };

  const removeFile = async (field: keyof ChecklistCreditoForm, path: string) => {
    const r = await removeChecklistCreditoFile(processoId, field, path);
    if (!r.ok) {
      alert(r.error);
      return;
    }
    await load();
  };

  const RenderFile = ({ label, field, multiple = false }: { label: string; field: keyof ChecklistCreditoForm; multiple?: boolean }) => {
    const val = (form as any)[field] as string | string[] | null;
    const arr = Array.isArray(val) ? val : val ? [val] : [];
    return (
      <div className="space-y-1">
        <label className="block text-xs text-stone-500">{label}</label>
        {!showInDados ? (
          <input
            type="file"
            multiple={multiple}
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => upload(field, e.target.files, multiple)}
            className="w-full rounded border border-stone-300 px-2 py-1 text-xs"
          />
        ) : null}
        <div className={`space-y-1 ${maskClass}`}>
          {arr.length === 0 ? (
            <span className="text-sm text-stone-500">—</span>
          ) : (
            arr.map((p) => (
              <div key={p} className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-stone-400" />
                {canView && signedUrls[p] ? (
                  <a href={signedUrls[p]} target="_blank" rel="noreferrer" className="text-sm text-moni-accent hover:underline">
                    {basename(p)}
                  </a>
                ) : (
                  <span className="text-sm text-stone-700">{basename(p)}</span>
                )}
                {!showInDados && canView ? (
                  <button type="button" onClick={() => removeFile(field, p)} className="text-xs text-red-600 hover:underline">
                    remover
                  </button>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  if (loading) return <div className={`rounded-lg border border-stone-200 bg-white p-3 text-sm text-stone-500 ${className ?? ''}`}>Carregando Checklist Crédito...</div>;

  if (loadError) {
    return (
      <section className={`rounded-lg border border-red-200 bg-red-50 p-3 ${className ?? ''}`}>
        <h3 className="text-sm font-semibold text-red-800">{showInDados ? 'Dados para Crédito' : 'Checklist Crédito'}</h3>
        <p className="mt-2 text-sm text-red-700">{loadError}</p>
      </section>
    );
  }

  const blockText = 'Este processo não avança enquanto todas as informações do Checklist Crédito não forem preenchidas.';

  return (
    <section className={`rounded-lg border border-stone-200 bg-white p-3 ${className ?? ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-stone-800">{showInDados ? 'Dados para Crédito' : 'Checklist Crédito'}</h3>
          {completo ? (
            <span className="inline-flex items-center rounded border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-800">
              Checklist Crédito completo
            </span>
          ) : (
            <div className="space-y-2">
              <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{blockText}</div>
              <div className="h-2 w-full overflow-hidden rounded bg-stone-100">
                <div className="h-full bg-amber-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-stone-500">Progresso: {progress}%</p>
            </div>
          )}
        </div>
        {!showInDados ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copyShareLink}
              className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Copiar link para compartilhar
            </button>
            <button
              type="button"
              onClick={() => {
                setDrawerOpen(true);
                setPage(0);
              }}
              className="rounded-lg bg-moni-primary px-4 py-2 text-sm font-medium text-white hover:bg-moni-secondary"
            >
              {hasOwn ? 'Editar Checklist Crédito' : 'Preencher Checklist Crédito'}
            </button>
          </div>
        ) : null}
      </div>

      <div className="relative mt-4 space-y-3">
        {overlay ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/70 p-4 text-center">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <Lock className="mx-auto mb-1 h-4 w-4" />
              Conteúdo restrito. Acesso disponível apenas para responsáveis autorizados: Neil, Kim, Fernanda, Murillo, Ingrid e Danilo.
            </div>
          </div>
        ) : null}

        {!record ? (
          <div className="rounded border border-dashed border-stone-200 bg-stone-50 p-4 text-sm text-stone-500">Checklist Crédito ainda não preenchido.</div>
        ) : (
          <>
            <div className={maskClass}>
              <p className="text-xs text-stone-500">Categoria profissional</p>
              <p className="text-sm font-medium text-stone-800">{form.categoria_profissional || '—'}</p>
            </div>
            <RenderFile label="IPTU constando metragens do imóvel" field="upload_iptu" />
            <RenderFile label="Cópia da matrícula" field="upload_matricula" />
            <RenderFile label="Template orçamento e cronograma" field="upload_orcamento_cronograma" />
            <RenderFile label="Projeto aprovado + Alvará + ART" field="upload_projeto_aprovado" />
            <RenderFile label="Documentos pessoais" field="uploads_documentos_pessoais" multiple />
          </>
        )}
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-60 flex items-stretch justify-end bg-black/40 p-3">
          <div className="w-full min-w-[700px] max-w-4xl overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-stone-900">Checklist Crédito</p>
                <p className="text-xs text-stone-500">Página {page + 1} / 5</p>
              </div>
              <button type="button" onClick={() => setDrawerOpen(false)} className="rounded p-1 text-stone-500 hover:bg-stone-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-4 pt-3">
              <div className="h-2 w-full overflow-hidden rounded bg-stone-100">
                <div className="h-full bg-moni-accent transition-all" style={{ width: `${((page + 1) / 5) * 100}%` }} />
              </div>
            </div>

            <div className="max-h-[82vh] overflow-y-auto p-4">
              {showReuseBanner && candidate ? (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <p>
                    Encontramos um Checklist Crédito preenchido anteriormente para o franqueado{' '}
                    <span className="font-semibold">{candidate.nome_franqueado ?? '—'}</span>. Deseja carregar as respostas como ponto de partida?
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className="rounded border border-amber-300 bg-white px-2 py-1 text-xs"
                      onClick={() => {
                        setForm({ ...EMPTY, ...candidate });
                        setShowReuseBanner(false);
                      }}
                    >
                      Carregar respostas
                    </button>
                    <button type="button" className="rounded border border-stone-300 bg-white px-2 py-1 text-xs" onClick={() => setShowReuseBanner(false)}>
                      Preencher do zero
                    </button>
                  </div>
                </div>
              ) : null}

              <a href="https://parceiro.cashme.com.br/Login/Login/" target="_blank" rel="noreferrer" className="mb-4 inline-block text-sm text-moni-accent hover:underline">
                Cadastramento da proposta pelo Portal do Cashmember
              </a>

              {page === 0 ? (
                <div className="space-y-4">
                  <RenderFile label="1) IPTU constando as metragens do imóvel" field="upload_iptu" />
                  <RenderFile label="2) Cópia da matrícula" field="upload_matricula" />
                  <RenderFile label="3) Template de orçamento e cronograma da obra" field="upload_orcamento_cronograma" />
                  <RenderFile label="4) Projeto Aprovado pela Prefeitura + Alvará e ART" field="upload_projeto_aprovado" />
                  <RenderFile label="5) Documentos pessoais (proponentes, cônjuges e garantidores)" field="uploads_documentos_pessoais" multiple />
                </div>
              ) : null}

              {page === 1 ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700">6) Categoria profissional do proponente *</label>
                    <select
                      value={form.categoria_profissional}
                      onChange={(e) => setForm((p) => ({ ...p, categoria_profissional: e.target.value as ChecklistCreditoForm['categoria_profissional'] }))}
                      className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                    >
                      <option value="">Selecione</option>
                      <option>Empresário</option>
                      <option>Assalariado</option>
                      <option>Funcionário Público ou Aposentado</option>
                      <option>Profissional Liberal / Autônomo</option>
                      <option>Renda de Aluguel</option>
                      <option>Pessoa Jurídica</option>
                    </select>
                  </div>
                </div>
              ) : null}

              {page === 2 && form.categoria_profissional === 'Empresário' ? (
                <div className="space-y-4">
                  <RenderFile label="7a) Contrato Social e Última Alteração" field="upload_contrato_social" />
                  <RenderFile label="7b) 3 últimos meses de Extratos Bancários PF" field="uploads_extratos_pf" multiple />
                  <RenderFile label="7c) IRPF do último exercício com recibo" field="upload_irpf" />
                  <div>
                    <label className="block text-sm font-medium text-stone-700">7d) Operação acima de R$ 3.000.000,00? *</label>
                    <select
                      value={form.operacao_acima_3m === null ? '' : form.operacao_acima_3m ? 'sim' : 'nao'}
                      onChange={(e) => setForm((p) => ({ ...p, operacao_acima_3m: e.target.value === 'sim' ? true : e.target.value === 'nao' ? false : null }))}
                      className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                    >
                      <option value="">Selecione</option>
                      <option value="sim">Sim</option>
                      <option value="nao">Não</option>
                    </select>
                  </div>
                  {form.operacao_acima_3m ? (
                    <>
                      <RenderFile label="7d-i) 3 últimos meses de extratos PJ" field="uploads_extratos_pj" multiple />
                      <RenderFile label="7d-ii) Faturamentos dos últimos 12 meses" field="upload_faturamento_12m" />
                    </>
                  ) : null}
                </div>
              ) : null}

              {page === 2 && form.categoria_profissional === 'Assalariado' ? (
                <div className="space-y-4">
                  <RenderFile label="8a) CTPS (foto, qualificação civil e contrato de trabalho)" field="uploads_ctps" multiple />
                  <RenderFile label="8b) Holerites" field="uploads_holerite" multiple />
                  <RenderFile label="8c) IRPF do último exercício com recibo" field="upload_irpf" />
                </div>
              ) : null}

              {page === 2 && form.categoria_profissional === 'Funcionário Público ou Aposentado' ? (
                <div className="space-y-4">
                  <RenderFile label="9a) Comprovante de pagamento salário/benefício" field="upload_comprovante_salario" />
                  <RenderFile label="9b) IRPF do último exercício com recibo" field="upload_irpf" />
                </div>
              ) : null}

              {page === 2 && form.categoria_profissional === 'Profissional Liberal / Autônomo' ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700">10a) Informações sobre a atividade *</label>
                    <textarea
                      rows={4}
                      className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                      value={form.descricao_atividade ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, descricao_atividade: e.target.value }))}
                    />
                  </div>
                  <RenderFile label="10b) 3 últimos meses de Extratos Bancários PF" field="uploads_extratos_pf" multiple />
                  <RenderFile label="10c) IRPF do último exercício com recibo" field="upload_irpf" />
                  <div>
                    <label className="block text-sm font-medium text-stone-700">10d) Presta serviço para empresas? *</label>
                    <select
                      value={form.presta_servico_empresas === null ? '' : form.presta_servico_empresas ? 'sim' : 'nao'}
                      onChange={(e) => setForm((p) => ({ ...p, presta_servico_empresas: e.target.value === 'sim' ? true : e.target.value === 'nao' ? false : null }))}
                      className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                    >
                      <option value="">Selecione</option>
                      <option value="sim">Sim</option>
                      <option value="nao">Não</option>
                    </select>
                  </div>
                  {form.presta_servico_empresas ? <RenderFile label="10d-i) Contrato de prestação de serviço" field="upload_contrato_prestacao" /> : null}
                </div>
              ) : null}

              {page === 2 && form.categoria_profissional === 'Renda de Aluguel' ? (
                <div className="space-y-4">
                  <RenderFile label="11a) Contrato vigente de aluguel assinado" field="upload_contrato_aluguel" />
                  <RenderFile label="11b) Extratos PF com entradas de aluguel" field="uploads_extratos_aluguel" multiple />
                  <RenderFile label="11c) IRPF do último exercício com recibo" field="upload_irpf" />
                </div>
              ) : null}

              {page === 2 && form.categoria_profissional === 'Pessoa Jurídica' ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700">12a) Valor da operação *</label>
                    <select
                      value={form.valor_operacao_pj}
                      onChange={(e) => setForm((p) => ({ ...p, valor_operacao_pj: e.target.value as ChecklistCreditoForm['valor_operacao_pj'] }))}
                      className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                    >
                      <option value="">Selecione</option>
                      <option>Até R$ 1.000.000,00</option>
                      <option>Acima de R$ 1.000.000,00</option>
                    </select>
                  </div>

                  <RenderFile label="Contrato Social / Estatuto Social" field="upload_contrato_social_pj" />
                  <RenderFile label="Faturamento" field="upload_faturamento_pj" />
                  <RenderFile label="Extratos conta corrente PJ" field="uploads_extratos_pj_cc" multiple />
                  {form.valor_operacao_pj === 'Acima de R$ 1.000.000,00' ? (
                    <>
                      <RenderFile label="Balanço, DRE e balancete corrente" field="upload_balanco_dre" />
                      <div>
                        <label className="block text-sm font-medium text-stone-700">12i) Endividamento atualizado *</label>
                        <textarea
                          rows={4}
                          className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                          value={form.endividamento_info ?? ''}
                          onChange={(e) => setForm((p) => ({ ...p, endividamento_info: e.target.value }))}
                        />
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}

              {page === 3 ? (
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm">
                  <p className="font-medium text-stone-800">Revisão e Conclusão</p>
                  <p className="mt-1 text-stone-600">
                    {completo ? 'Checklist Crédito está completo.' : 'Ainda existem campos obrigatórios pendentes.'}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between border-t border-stone-200 px-4 py-3">
              <button type="button" onClick={prevPage} disabled={saving || page === 0} className="rounded border border-stone-300 bg-white px-3 py-2 text-sm disabled:opacity-50">
                Voltar
              </button>
              {page < 3 ? (
                <button type="button" onClick={nextPage} disabled={saving} className="rounded bg-moni-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                  Avançar
                </button>
              ) : (
                <button type="button" onClick={conclude} disabled={saving} className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                  {saving ? 'Concluindo…' : 'Concluir Checklist'}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

