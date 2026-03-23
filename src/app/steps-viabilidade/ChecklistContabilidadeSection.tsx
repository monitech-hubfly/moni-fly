'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileText, Plus, Trash2, X } from 'lucide-react';
import {
  concluirChecklistContabilidade,
  findChecklistContabilidadeByCnpj,
  getChecklistContabilidadeForCard,
  saveChecklistContabilidadeDraft,
} from '@/app/steps-viabilidade/checklist-contabilidade/actions';

type Entidade = 'incorporadora' | 'spe' | 'gestora';

type Props = {
  processoId: string;
  entidade: Entidade;
  showInDados?: boolean;
};

type Form = {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  data_abertura: string;
  situacao: 'Ativa' | 'Inativa' | '';
  cnaes: string[];
  endereco: string;
  inscricao_municipal_1: string;
  inscricao_municipal_2: string;
  upload_contrato_social: string;
  upload_cartao_cnpj: string;
  upload_comprovante_endereco: string;
};

const EMPTY: Form = {
  cnpj: '',
  razao_social: '',
  nome_fantasia: '',
  data_abertura: '',
  situacao: '',
  cnaes: [''],
  endereco: '',
  inscricao_municipal_1: '',
  inscricao_municipal_2: '',
  upload_contrato_social: '',
  upload_cartao_cnpj: '',
  upload_comprovante_endereco: '',
};

function label(entidade: Entidade) {
  if (entidade === 'incorporadora') return 'Incorporadora';
  if (entidade === 'spe') return 'SPE';
  return 'Gestora';
}

function tableHint(entidade: Entidade) {
  if (entidade === 'incorporadora') return 'cnpj_incorporadora';
  if (entidade === 'spe') return 'cnpj_spe';
  return 'cnpj_gestora';
}

function maskCnpj(v: string): string {
  const n = v.replace(/\D/g, '').slice(0, 14);
  return n
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function validarCNPJ(cnpj: string): boolean {
  const nums = cnpj.replace(/\D/g, '');
  if (nums.length !== 14) return false;
  if (/^(\d)\1+$/.test(nums)) return false;
  const calc = (n: string, len: number) => {
    let sum = 0;
    let pos = len - 7;
    for (let i = len; i >= 1; i--) {
      sum += parseInt(n[len - i]) * pos--;
      if (pos < 2) pos = 9;
    }
    return sum % 11 < 2 ? 0 : 11 - (sum % 11);
  };
  return calc(nums, 12) === parseInt(nums[12]) && calc(nums, 13) === parseInt(nums[13]);
}

function complete(f: Form): boolean {
  const cnaes = (f.cnaes ?? []).map((x) => x.trim()).filter(Boolean);
  return Boolean(
    f.cnpj.trim() &&
      f.razao_social.trim() &&
      f.nome_fantasia.trim() &&
      f.data_abertura &&
      f.situacao &&
      cnaes.length > 0 &&
      f.endereco.trim() &&
      f.upload_contrato_social &&
      f.upload_cartao_cnpj &&
      f.upload_comprovante_endereco,
  );
}

function progress(f: Form): { done: number; total: number; percent: number } {
  const checks = [
    Boolean(f.cnpj.trim()),
    Boolean(f.razao_social.trim()),
    Boolean(f.nome_fantasia.trim()),
    Boolean(f.data_abertura),
    Boolean(f.situacao),
    (f.cnaes ?? []).some((x) => x.trim()),
    Boolean(f.endereco.trim()),
    Boolean(f.inscricao_municipal_1.trim()) || Boolean(f.inscricao_municipal_2.trim()),
    Boolean(f.upload_contrato_social),
    Boolean(f.upload_cartao_cnpj),
    Boolean(f.upload_comprovante_endereco),
    complete(f),
  ];
  const done = checks.filter(Boolean).length;
  const total = checks.length;
  return { done, total, percent: Math.round((done / total) * 100) };
}

export function ChecklistContabilidadeSection({ processoId, entidade, showInDados = false }: Props) {
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Form>(EMPTY);
  const [record, setRecord] = useState<any>(null);
  const [hasOwn, setHasOwn] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cnpjError, setCnpjError] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<any>(null);
  const [showReuseBanner, setShowReuseBanner] = useState(false);
  const lastSerializedRef = useRef<string>('');

  const name = label(entidade);
  const aviso = `O processo não avança enquanto os dados da ${name} não forem preenchidos.`;
  const { done, total, percent } = useMemo(() => progress(form), [form]);
  const isComplete = useMemo(() => complete(form), [form]);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await getChecklistContabilidadeForCard(processoId, entidade);
    if (r.ok) {
      const base = r.record
        ? {
            ...EMPTY,
            ...r.record,
            cnaes: Array.isArray(r.record.cnaes) && r.record.cnaes.length > 0 ? r.record.cnaes : [''],
          }
        : EMPTY;
      setRecord(r.record);
      setHasOwn(r.hasOwnRecord);
      setForm(base);
      setCandidate(r.candidate ?? null);
      setShowReuseBanner(Boolean(!r.hasOwnRecord && r.candidate));
      lastSerializedRef.current = JSON.stringify(base);
    }
    setLoading(false);
  }, [processoId, entidade]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!drawerOpen) return;
    const timer = window.setTimeout(async () => {
      const serialized = JSON.stringify(form);
      if (serialized === lastSerializedRef.current) return;
      lastSerializedRef.current = serialized;
      await saveChecklistContabilidadeDraft(processoId, entidade, form);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [form, drawerOpen, processoId, entidade]);

  const onUpload = async (field: 'upload_contrato_social' | 'upload_cartao_cnpj' | 'upload_comprovante_endereco', file: File | null) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('processoId', processoId);
    fd.append('entidade', entidade);
    fd.append('fieldKey', field);
    fd.append('file', file);
    const res = await fetch('/api/checklist-contabilidade/upload', { method: 'POST', body: fd });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; url?: string } | null;
    if (!res.ok || !json?.ok || !json?.url) {
      alert(json?.error ?? 'Erro no upload.');
      return;
    }
    setForm((p) => ({ ...p, [field]: json.url as string }));
  };

  const onConcluir = async () => {
    if (!validarCNPJ(form.cnpj)) {
      setCnpjError('CNPJ inválido');
      return;
    }
    setSaving(true);
    try {
      const r = await concluirChecklistContabilidade(processoId, entidade, form);
      if (!r.ok) {
        alert(r.error);
        return;
      }
      setDrawerOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const badge = form.situacao === 'Ativa' ? 'border-green-200 bg-green-50 text-green-700' : 'border-stone-200 bg-stone-100 text-stone-600';

  if (loading) return <div className="rounded-lg border border-stone-200 bg-white p-3 text-sm text-stone-500">Carregando {name}...</div>;

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-stone-800">{showInDados ? `Dados da ${name}` : name}</h3>
        {!showInDados ? (
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="rounded bg-moni-primary px-3 py-2 text-sm font-medium text-white hover:bg-moni-secondary"
          >
            {hasOwn ? `Editar ${name}` : `Preencher ${name}`}
          </button>
        ) : null}
      </div>

      <div className="mt-3">
        {record?.completo ? (
          <span className="inline-flex items-center gap-1 rounded border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-800">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {name} completo
          </span>
        ) : (
          <div className="space-y-2">
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{aviso}</div>
            <div className="h-2 w-full overflow-hidden rounded bg-stone-100">
              <div className="h-full bg-amber-500 transition-all" style={{ width: `${percent}%` }} />
            </div>
            <p className="text-xs text-stone-500">{done} de {total} campos preenchidos</p>
          </div>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {!record ? (
          <div className="rounded border border-dashed border-stone-200 bg-stone-50 p-4 text-sm text-stone-500">
            Dados ainda não preenchidos.
          </div>
        ) : (
          <>
            <div className="rounded border border-stone-200 p-3">
              <p className="text-xs font-semibold text-stone-700">Dados Cadastrais</p>
              <div className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <div><span className="text-xs text-stone-500">CNPJ</span><div>{record.cnpj || '—'}</div></div>
                <div><span className="text-xs text-stone-500">Razão Social</span><div>{record.razao_social || '—'}</div></div>
                <div><span className="text-xs text-stone-500">Nome Fantasia</span><div>{record.nome_fantasia || '—'}</div></div>
                <div><span className="text-xs text-stone-500">Data de Abertura</span><div>{record.data_abertura || '—'}</div></div>
                <div>
                  <span className="text-xs text-stone-500">Situação</span>
                  <div><span className={`inline-flex rounded border px-1.5 py-0.5 text-xs ${record.situacao === 'Ativa' ? 'border-green-200 bg-green-50 text-green-700' : 'border-stone-200 bg-stone-100 text-stone-600'}`}>{record.situacao || '—'}</span></div>
                </div>
                <div><span className="text-xs text-stone-500">CNAEs</span><div>{Array.isArray(record.cnaes) && record.cnaes.length ? record.cnaes.join(', ') : '—'}</div></div>
                <div className="sm:col-span-2"><span className="text-xs text-stone-500">Endereço</span><div>{record.endereco || '—'}</div></div>
                <div><span className="text-xs text-stone-500">Inscrição Municipal (1)</span><div>{record.inscricao_municipal_1 || '—'}</div></div>
                <div><span className="text-xs text-stone-500">Inscrição Municipal (2)</span><div>{record.inscricao_municipal_2 || '—'}</div></div>
              </div>
            </div>
            <div className="rounded border border-stone-200 p-3">
              <p className="text-xs font-semibold text-stone-700">Documentos</p>
              <div className="mt-2 space-y-1 text-sm">
                {[['Contrato Social', record.upload_contrato_social], ['Cartão CNPJ', record.upload_cartao_cnpj], ['Comprovante de Endereço', record.upload_comprovante_endereco]].map(([k, v]) => (
                  <div key={String(k)} className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-stone-400" />
                    {v ? <a href={String(v)} target="_blank" rel="noreferrer" className="text-moni-accent hover:underline">{k}</a> : <span className="text-stone-500">{k}: —</span>}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-60 flex items-stretch justify-end bg-black/40 p-3">
          <div className="w-full min-w-[700px] max-w-4xl overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50 px-4 py-3">
              <p className="text-sm font-semibold text-stone-900">{name}</p>
              <button type="button" onClick={() => setDrawerOpen(false)} className="rounded p-1 text-stone-500 hover:bg-stone-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[84vh] overflow-y-auto p-4 space-y-4">
              {showReuseBanner ? (
                <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <p>
                    Encontramos dados da {name} com CNPJ {(candidate?.cnpj ?? '').trim() || `[${tableHint(entidade)}]`} preenchidos anteriormente. Deseja carregar como ponto de partida?
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className="rounded border border-amber-300 bg-white px-2 py-1 text-xs"
                      onClick={() => {
                        if (candidate) {
                          setForm({
                            ...EMPTY,
                            ...candidate,
                            cnaes: Array.isArray(candidate.cnaes) && candidate.cnaes.length ? candidate.cnaes : [''],
                          });
                        }
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

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-stone-700">Número do CNPJ *</label>
                  <input
                    type="text"
                    value={form.cnpj}
                    onChange={(e) => setForm((p) => ({ ...p, cnpj: maskCnpj(e.target.value) }))}
                    onBlur={async () => {
                      if (!form.cnpj.trim()) {
                        setCnpjError(null);
                        return;
                      }
                      const ok = validarCNPJ(form.cnpj);
                      setCnpjError(ok ? null : 'CNPJ inválido');
                      if (ok) {
                        const r = await findChecklistContabilidadeByCnpj(entidade, form.cnpj, processoId);
                        if (r.ok && r.candidate && !hasOwn) {
                          setCandidate(r.candidate);
                          setShowReuseBanner(true);
                        }
                      }
                    }}
                    className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                    placeholder="00.000.000/0000-00"
                  />
                  {cnpjError ? <p className="mt-1 text-xs text-red-600">{cnpjError}</p> : null}
                </div>
                <div><label className="block text-sm font-medium text-stone-700">Razão Social *</label><input type="text" value={form.razao_social} onChange={(e) => setForm((p) => ({ ...p, razao_social: e.target.value }))} className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm" /></div>
                <div><label className="block text-sm font-medium text-stone-700">Nome Fantasia *</label><input type="text" value={form.nome_fantasia} onChange={(e) => setForm((p) => ({ ...p, nome_fantasia: e.target.value }))} className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm" /></div>
                <div><label className="block text-sm font-medium text-stone-700">Data de Abertura *</label><input type="date" value={form.data_abertura} onChange={(e) => setForm((p) => ({ ...p, data_abertura: e.target.value }))} className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm" /></div>
                <div>
                  <label className="block text-sm font-medium text-stone-700">Situação *</label>
                  <select value={form.situacao} onChange={(e) => setForm((p) => ({ ...p, situacao: e.target.value as Form['situacao'] }))} className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm">
                    <option value="">Selecione</option>
                    <option value="Ativa">Ativa</option>
                    <option value="Inativa">Inativa</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-stone-700">CNAE(s) *</label>
                  <div className="mt-1 space-y-2">
                    {form.cnaes.map((c, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input type="text" value={c} onChange={(e) => setForm((p) => ({ ...p, cnaes: p.cnaes.map((x, idx) => (idx === i ? e.target.value : x)) }))} className="w-full rounded border border-stone-300 px-3 py-2 text-sm" />
                        <button type="button" disabled={form.cnaes.length === 1} onClick={() => setForm((p) => ({ ...p, cnaes: p.cnaes.filter((_, idx) => idx !== i) }))} className="rounded border border-stone-300 p-2 text-stone-600 disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    ))}
                    <button type="button" onClick={() => setForm((p) => ({ ...p, cnaes: [...p.cnaes, ''] }))} className="inline-flex items-center gap-1 rounded border border-stone-300 bg-white px-2 py-1 text-xs">
                      <Plus className="h-3.5 w-3.5" /> Adicionar CNAE
                    </button>
                  </div>
                </div>
                <div className="sm:col-span-2"><label className="block text-sm font-medium text-stone-700">Endereço *</label><input type="text" value={form.endereco} onChange={(e) => setForm((p) => ({ ...p, endereco: e.target.value }))} className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm" /></div>
                <div><label className="block text-sm font-medium text-stone-700">Inscrição Municipal (1)</label><input type="text" value={form.inscricao_municipal_1} onChange={(e) => setForm((p) => ({ ...p, inscricao_municipal_1: e.target.value.replace(/[^\d]/g, '') }))} className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm" /></div>
                <div><label className="block text-sm font-medium text-stone-700">Inscrição Municipal (2)</label><input type="text" value={form.inscricao_municipal_2} onChange={(e) => setForm((p) => ({ ...p, inscricao_municipal_2: e.target.value.replace(/[^\d]/g, '') }))} className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm" /></div>
              </div>

              <div className="rounded border border-stone-200 p-3">
                <p className="text-sm font-medium text-stone-700">Documentos</p>
                <div className="mt-2 space-y-3 text-sm">
                  {([
                    ['upload_contrato_social', 'Contrato Social'],
                    ['upload_cartao_cnpj', 'Cartão CNPJ'],
                    ['upload_comprovante_endereco', 'Comprovante de Endereço'],
                  ] as const).map(([field, labelField]) => (
                    <div key={field} className="space-y-1">
                      <label className="block text-xs text-stone-500">{labelField} *</label>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => onUpload(field, e.target.files?.[0] ?? null)} className="w-full rounded border border-stone-300 px-2 py-1 text-xs" />
                      {form[field] ? (
                        <div className="flex items-center gap-2">
                          <a href={form[field]} target="_blank" rel="noreferrer" className="text-xs text-moni-accent hover:underline">Abrir arquivo</a>
                          <button type="button" onClick={() => setForm((p) => ({ ...p, [field]: '' }))} className="text-xs text-red-600 hover:underline">remover</button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded border border-stone-200 p-2 text-xs text-stone-500">
                Situação: <span className={`inline-flex rounded border px-1.5 py-0.5 ${badge}`}>{form.situacao || '—'}</span>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-stone-200 px-4 py-3">
              <span className="text-xs text-stone-500">Rascunho salvo automaticamente.</span>
              <button type="button" onClick={onConcluir} disabled={saving} className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                {saving ? 'Concluindo…' : 'Concluir'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
