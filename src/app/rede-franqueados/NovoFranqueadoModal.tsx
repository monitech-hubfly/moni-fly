'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, UserPlus, X } from 'lucide-react';
import { criarLinhaRedeECard, getProximoNFranquia } from './actions';

const STATUS_OPTIONS = [
  { value: 'Ativo', label: 'Ativo' },
  { value: 'Inativo', label: 'Inativo' },
  { value: 'Em processo', label: 'Em processo' },
] as const;

type FormState = {
  n_franquia: string;
  nome_completo: string;
  status_franquia: string;
  classificacao_franqueado: string;
  data_ass_cof: string;
  data_ass_contrato: string;
  regional: string;
  area_atuacao: string;
  email_frank: string;
  responsavel_comercial: string;
  telefone_frank: string;
  cpf_frank: string;
  modalidade: string;
  socios: string;
};

const emptyForm = (): FormState => ({
  n_franquia: '',
  nome_completo: '',
  status_franquia: 'Em processo',
  classificacao_franqueado: '',
  data_ass_cof: '',
  data_ass_contrato: '',
  regional: '',
  area_atuacao: '',
  email_frank: '',
  responsavel_comercial: '',
  telefone_frank: '',
  cpf_frank: '',
  modalidade: '',
  socios: '',
});

export function NovoFranqueadoModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loadingFk, setLoadingFk] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProximoFk = useCallback(async () => {
    setLoadingFk(true);
    setError(null);
    try {
      const r = await getProximoNFranquia();
      if (r.ok) {
        setForm((f) => ({ ...f, n_franquia: r.valor }));
      }
    } finally {
      setLoadingFk(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadProximoFk();
  }, [open, loadProximoFk]);

  function close() {
    setOpen(false);
    setForm(emptyForm());
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const nome = form.nome_completo.trim();
    if (!nome) {
      setError('Nome completo é obrigatório.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await criarLinhaRedeECard({
        n_franquia: form.n_franquia.trim() || undefined,
        nome_completo: nome,
        status_franquia: form.status_franquia.trim() || undefined,
        classificacao_franqueado: form.classificacao_franqueado.trim() || undefined,
        data_ass_cof: form.data_ass_cof.trim() || undefined,
        data_ass_contrato: form.data_ass_contrato.trim() || undefined,
        regional: form.regional.trim() || undefined,
        area_atuacao: form.area_atuacao.trim() || undefined,
        email_frank: form.email_frank.trim() || undefined,
        responsavel_comercial: form.responsavel_comercial.trim() || undefined,
        telefone_frank: form.telefone_frank.trim() || undefined,
        cpf_frank: form.cpf_frank.trim() || undefined,
        modalidade: form.modalidade.trim() || undefined,
        socios: form.socios.trim() || undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      close();
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    'mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-moni-primary focus:ring-1 focus:ring-moni-primary/30';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-moni-primary shadow-sm hover:bg-stone-50"
      >
        <UserPlus className="h-4 w-4" />
        Novo Franqueado
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="novo-franqueado-titulo"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-stone-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
              <h2 id="novo-franqueado-titulo" className="text-lg font-semibold text-stone-900">
                Novo Franqueado
              </h2>
              <button
                type="button"
                onClick={close}
                className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3 px-5 py-4">
              {error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
              ) : null}

              <label className="block text-xs font-medium text-stone-600">
                N de Franquia
                <input
                  type="text"
                  value={form.n_franquia}
                  onChange={(e) => setForm((f) => ({ ...f, n_franquia: e.target.value }))}
                  disabled={loadingFk}
                  className={inputClass}
                  placeholder={loadingFk ? 'Carregando…' : 'FK0000'}
                />
              </label>

              <label className="block text-xs font-medium text-stone-600">
                Nome completo <span className="text-red-500">*</span>
                <input
                  type="text"
                  required
                  value={form.nome_completo}
                  onChange={(e) => setForm((f) => ({ ...f, nome_completo: e.target.value }))}
                  className={inputClass}
                />
              </label>

              <label className="block text-xs font-medium text-stone-600">
                Status da franquia
                <select
                  value={form.status_franquia}
                  onChange={(e) => setForm((f) => ({ ...f, status_franquia: e.target.value }))}
                  className={inputClass}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-medium text-stone-600">
                Classificação do franqueado
                <input
                  type="text"
                  value={form.classificacao_franqueado}
                  onChange={(e) => setForm((f) => ({ ...f, classificacao_franqueado: e.target.value }))}
                  className={inputClass}
                />
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-stone-600">
                  Data assinatura COF
                  <input
                    type="date"
                    value={form.data_ass_cof}
                    onChange={(e) => setForm((f) => ({ ...f, data_ass_cof: e.target.value }))}
                    className={inputClass}
                  />
                </label>
                <label className="block text-xs font-medium text-stone-600">
                  Data assinatura contrato
                  <input
                    type="date"
                    value={form.data_ass_contrato}
                    onChange={(e) => setForm((f) => ({ ...f, data_ass_contrato: e.target.value }))}
                    className={inputClass}
                  />
                </label>
              </div>

              <label className="block text-xs font-medium text-stone-600">
                Regional
                <input
                  type="text"
                  value={form.regional}
                  onChange={(e) => setForm((f) => ({ ...f, regional: e.target.value }))}
                  className={inputClass}
                />
              </label>

              <label className="block text-xs font-medium text-stone-600">
                Área de atuação
                <input
                  type="text"
                  value={form.area_atuacao}
                  onChange={(e) => setForm((f) => ({ ...f, area_atuacao: e.target.value }))}
                  className={inputClass}
                />
              </label>

              <label className="block text-xs font-medium text-stone-600">
                E-mail
                <input
                  type="email"
                  value={form.email_frank}
                  onChange={(e) => setForm((f) => ({ ...f, email_frank: e.target.value }))}
                  className={inputClass}
                />
              </label>

              <label className="block text-xs font-medium text-stone-600">
                Responsável comercial
                <input
                  type="text"
                  value={form.responsavel_comercial}
                  onChange={(e) => setForm((f) => ({ ...f, responsavel_comercial: e.target.value }))}
                  className={inputClass}
                />
              </label>

              <label className="block text-xs font-medium text-stone-600">
                Telefone
                <input
                  type="tel"
                  value={form.telefone_frank}
                  onChange={(e) => setForm((f) => ({ ...f, telefone_frank: e.target.value }))}
                  className={inputClass}
                />
              </label>

              <label className="block text-xs font-medium text-stone-600">
                CPF
                <input
                  type="text"
                  value={form.cpf_frank}
                  onChange={(e) => setForm((f) => ({ ...f, cpf_frank: e.target.value }))}
                  className={inputClass}
                />
              </label>

              <label className="block text-xs font-medium text-stone-600">
                Modalidade
                <input
                  type="text"
                  value={form.modalidade}
                  onChange={(e) => setForm((f) => ({ ...f, modalidade: e.target.value }))}
                  className={inputClass}
                />
              </label>

              <label className="block text-xs font-medium text-stone-600">
                Sócios
                <textarea
                  rows={3}
                  value={form.socios}
                  onChange={(e) => setForm((f) => ({ ...f, socios: e.target.value }))}
                  className={inputClass + ' resize-y'}
                />
              </label>

              <div className="flex justify-end gap-2 border-t border-stone-100 pt-4">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-moni-primary px-4 py-2 text-sm font-semibold text-white hover:bg-moni-secondary disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Criar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
