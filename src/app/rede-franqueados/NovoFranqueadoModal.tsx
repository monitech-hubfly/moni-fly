'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileUp, Loader2, UserPlus, X } from 'lucide-react';
import {
  criarLinhaRedeECard,
  extrairDadosFranqueadoDePdfUpload,
  getProximoNFranquia,
  salvarJustificativaRedeAnexo,
  uploadRedeFranqueadoAssinado,
} from './actions';
import type { RedeAnexoDocFranqueadoTipo } from '@/lib/rede-documentos-franqueado';
import {
  REDE_OPCOES_CLASSIFICACAO_FRANQUEADO,
  REDE_OPCOES_MODALIDADE,
  REDE_OPCOES_REGIONAL,
  REDE_OPCOES_STATUS_FRANQUIA,
} from '@/lib/rede-franqueado-form-options';
import { mesclarExtracaoFormFranqueado } from '@/lib/rede-extrair-dados-franqueado';
import { UFS_BRASIL } from '@/lib/uf';

type FormState = {
  n_franquia: string;
  modalidade: string;
  nome_completo: string;
  status_franquia: string;
  classificacao_franqueado: string;
  data_ass_cof: string;
  data_ass_contrato: string;
  data_expiracao_franquia: string;
  regional: string;
  area_atuacao: string;
  email_frank: string;
  telefone_frank: string;
  cpf_frank: string;
  data_nasc_frank: string;
  endereco_casa_frank: string;
  endereco_casa_frank_numero: string;
  endereco_casa_frank_complemento: string;
  cep_casa_frank: string;
  estado_casa_frank: string;
  cidade_casa_frank: string;
  socios: string;
};

const emptyForm = (): FormState => ({
  n_franquia: '',
  modalidade: 'Franquia',
  nome_completo: '',
  status_franquia: 'Em Operação',
  classificacao_franqueado: '',
  data_ass_cof: '',
  data_ass_contrato: '',
  data_expiracao_franquia: '',
  regional: '',
  area_atuacao: '',
  email_frank: '',
  telefone_frank: '',
  cpf_frank: '',
  data_nasc_frank: '',
  endereco_casa_frank: '',
  endereco_casa_frank_numero: '',
  endereco_casa_frank_complemento: '',
  cep_casa_frank: '',
  estado_casa_frank: '',
  cidade_casa_frank: '',
  socios: '',
});

async function enviarAnexo(
  redeId: string,
  tipo: 'cof' | 'contrato' | RedeAnexoDocFranqueadoTipo,
  file: File,
): Promise<string | null> {
  const fd = new FormData();
  fd.append('tipo', tipo);
  fd.append('redeId', redeId);
  fd.append('file', file);
  const r = await uploadRedeFranqueadoAssinado(fd);
  return r.ok ? null : r.error;
}

async function salvarJustificativaEstadoCivil(redeId: string, texto: string): Promise<string | null> {
  const fd = new FormData();
  fd.append('tipo', 'estado_civil');
  fd.append('redeId', redeId);
  fd.append('justificativa', texto);
  const r = await salvarJustificativaRedeAnexo(fd);
  return r.ok ? null : r.error;
}

export function NovoFranqueadoModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [cofFile, setCofFile] = useState<File | null>(null);
  const [contratoFile, setContratoFile] = useState<File | null>(null);
  const [cnhFile, setCnhFile] = useState<File | null>(null);
  const [comprovanteEnderecoFile, setComprovanteEnderecoFile] = useState<File | null>(null);
  const [estadoCivilFile, setEstadoCivilFile] = useState<File | null>(null);
  const [irpfFile, setIrpfFile] = useState<File | null>(null);
  const [estadoCivilJustificativa, setEstadoCivilJustificativa] = useState('');
  const [loadingFk, setLoadingFk] = useState(false);
  const [extraindo, setExtraindo] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [infoExtracao, setInfoExtracao] = useState<string | null>(null);
  const extracaoSeq = useRef(0);
  const formRef = useRef(form);
  formRef.current = form;
  const cofFileRef = useRef(cofFile);
  cofFileRef.current = cofFile;
  const contratoFileRef = useRef(contratoFile);
  contratoFileRef.current = contratoFile;

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

  const extrairDeAnexos = useCallback(
    async (cof: File | null, contrato: File | null, base: FormState) => {
      if (!cof && !contrato) return;
      const seq = ++extracaoSeq.current;
      setExtraindo(true);
      setInfoExtracao(null);
      setError(null);
      try {
        const fd = new FormData();
        if (cof) fd.append('cof', cof);
        if (contrato) fd.append('contrato', contrato);
        if (base.nome_completo.trim()) fd.append('nome_completo', base.nome_completo.trim());
        if (base.modalidade.trim()) fd.append('modalidade', base.modalidade.trim());
        const r = await extrairDadosFranqueadoDePdfUpload(fd);
        if (seq !== extracaoSeq.current) return;
        if (!r.ok) {
          setError(r.error);
          return;
        }
        const campos = Object.keys(r.dados).filter((k) => {
          const v = r.dados[k as keyof typeof r.dados];
          return v != null && String(v).trim() !== '';
        });
        setForm((f) => mesclarExtracaoFormFranqueado(f, r.dados));
        if (campos.length) {
          const labels = campos
            .map((k) => k.replace(/_/g, ' '))
            .join(', ');
          setInfoExtracao(
            r.aviso
              ? `${r.aviso} Campos preenchidos: ${labels}.`
              : `Dados preenchidos a partir do documento: ${labels}.`,
          );
        } else if (r.aviso) {
          setInfoExtracao(r.aviso);
        } else {
          setInfoExtracao(
            'Nenhum campo identificado. Verifique se o PDF tem texto selecionável ou renomeie o arquivo como "AAAA MM DD Franquia - Nome Completo.pdf".',
          );
        }
      } finally {
        if (seq === extracaoSeq.current) setExtraindo(false);
      }
    },
    [],
  );

  function close() {
    extracaoSeq.current += 1;
    setOpen(false);
    setForm(emptyForm());
    setCofFile(null);
    setContratoFile(null);
    setCnhFile(null);
    setComprovanteEnderecoFile(null);
    setEstadoCivilFile(null);
    setIrpfFile(null);
    setEstadoCivilJustificativa('');
    setError(null);
    setInfoExtracao(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    setError(null);
    const nome = form.nome_completo.trim();
    if (!nome) {
      setError('Nome completo é obrigatório.');
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const res = await criarLinhaRedeECard({
        n_franquia: form.n_franquia.trim() || undefined,
        modalidade: form.modalidade.trim() || undefined,
        nome_completo: nome,
        status_franquia: form.status_franquia.trim() || undefined,
        classificacao_franqueado: form.classificacao_franqueado.trim() || undefined,
        data_ass_cof: form.data_ass_cof.trim() || undefined,
        data_ass_contrato: form.data_ass_contrato.trim() || undefined,
        data_expiracao_franquia: form.data_expiracao_franquia.trim() || undefined,
        regional: form.regional.trim() || undefined,
        area_atuacao: form.area_atuacao.trim() || undefined,
        email_frank: form.email_frank.trim() || undefined,
        telefone_frank: form.telefone_frank.trim() || undefined,
        cpf_frank: form.cpf_frank.trim() || undefined,
        data_nasc_frank: form.data_nasc_frank.trim() || undefined,
        endereco_casa_frank: form.endereco_casa_frank.trim() || undefined,
        endereco_casa_frank_numero: form.endereco_casa_frank_numero.trim() || undefined,
        endereco_casa_frank_complemento: form.endereco_casa_frank_complemento.trim() || undefined,
        cep_casa_frank: form.cep_casa_frank.trim() || undefined,
        estado_casa_frank: form.estado_casa_frank.trim() || undefined,
        cidade_casa_frank: form.cidade_casa_frank.trim() || undefined,
        socios: form.socios.trim() || undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }

      const errosAnexo: string[] = [];
      if (cofFile) {
        const err = await enviarAnexo(res.redeId, 'cof', cofFile);
        if (err) errosAnexo.push(`COF: ${err}`);
      }
      if (contratoFile) {
        const err = await enviarAnexo(res.redeId, 'contrato', contratoFile);
        if (err) errosAnexo.push(`Contrato: ${err}`);
      }
      if (cnhFile) {
        const err = await enviarAnexo(res.redeId, 'cnh', cnhFile);
        if (err) errosAnexo.push(`CNH: ${err}`);
      }
      if (comprovanteEnderecoFile) {
        const err = await enviarAnexo(res.redeId, 'comprovante_endereco', comprovanteEnderecoFile);
        if (err) errosAnexo.push(`Comprovante de endereço: ${err}`);
      }
      if (estadoCivilFile) {
        const err = await enviarAnexo(res.redeId, 'estado_civil', estadoCivilFile);
        if (err) errosAnexo.push(`Comprovante de estado civil: ${err}`);
      } else if (estadoCivilJustificativa.trim()) {
        const err = await salvarJustificativaEstadoCivil(res.redeId, estadoCivilJustificativa.trim());
        if (err) errosAnexo.push(`Comprovante de estado civil (justificativa): ${err}`);
      }
      if (irpfFile) {
        const err = await enviarAnexo(res.redeId, 'irpf', irpfFile);
        if (err) errosAnexo.push(`Declaração de IRPF: ${err}`);
      }
      if (errosAnexo.length) {
        setError(`Franqueado criado, mas falha ao enviar anexo(s): ${errosAnexo.join(' · ')}`);
        router.refresh();
        return;
      }

      close();
      router.refresh();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const inputClass =
    'mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-moni-primary focus:ring-1 focus:ring-moni-primary/30';

  const selectClass = inputClass;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-stone-200 bg-transparent px-4 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-100/80"
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
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-stone-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
              <h2 id="novo-franqueado-titulo" className="text-lg font-semibold text-stone-900">
                Novo Franqueado
              </h2>
              <button
                type="button"
                onClick={close}
                disabled={submitting}
                className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-800 disabled:opacity-50"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 px-5 py-4">
              {error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
              ) : null}
              {infoExtracao ? (
                <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800" role="status">
                  {infoExtracao}
                </div>
              ) : null}

              <fieldset className="space-y-3 rounded-xl border border-stone-200 bg-stone-50/50 p-4">
                <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-stone-600">
                  Documentos da franquia
                </legend>
                <p className="text-xs text-stone-500">
                  Anexe COF e/ou contrato para preencher automaticamente os dados do franqueado (somente campos vazios).
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-medium text-stone-600">
                    COF (PDF)
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      disabled={extraindo || submitting}
                      className="mt-1 block w-full text-sm text-stone-700 file:mr-2 file:rounded-md file:border-0 file:bg-stone-200 file:px-3 file:py-1.5 file:text-xs file:font-medium"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        setCofFile(file);
                        void extrairDeAnexos(file, contratoFileRef.current, formRef.current);
                      }}
                    />
                  </label>
                  <label className="block text-xs font-medium text-stone-600">
                    Contrato (PDF)
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      disabled={extraindo || submitting}
                      className="mt-1 block w-full text-sm text-stone-700 file:mr-2 file:rounded-md file:border-0 file:bg-stone-200 file:px-3 file:py-1.5 file:text-xs file:font-medium"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        setContratoFile(file);
                        void extrairDeAnexos(cofFileRef.current, file, formRef.current);
                      }}
                    />
                  </label>
                </div>
                {extraindo ? (
                  <p className="inline-flex items-center gap-2 text-xs text-stone-600">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Lendo documento…
                  </p>
                ) : cofFile || contratoFile ? (
                  <p className="inline-flex items-center gap-1.5 text-xs text-stone-600">
                    <FileUp className="h-3.5 w-3.5" />
                    {[cofFile?.name, contratoFile?.name].filter(Boolean).join(' · ')}
                  </p>
                ) : null}
              </fieldset>

              <fieldset className="space-y-3 rounded-xl border border-stone-200 bg-stone-50/50 p-4">
                <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-stone-600">
                  Documentos do franqueado
                </legend>
                <p className="text-xs text-stone-500">Anexe os documentos pessoais do franqueado (até 10 MB cada).</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-medium text-stone-600">
                    CNH
                    <input
                      type="file"
                      disabled={extraindo || submitting}
                      className="mt-1 block w-full text-sm text-stone-700 file:mr-2 file:rounded-md file:border-0 file:bg-stone-200 file:px-3 file:py-1.5 file:text-xs file:font-medium"
                      onChange={(e) => setCnhFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  <label className="block text-xs font-medium text-stone-600">
                    Comprovante de endereço
                    <input
                      type="file"
                      disabled={extraindo || submitting}
                      className="mt-1 block w-full text-sm text-stone-700 file:mr-2 file:rounded-md file:border-0 file:bg-stone-200 file:px-3 file:py-1.5 file:text-xs file:font-medium"
                      onChange={(e) => setComprovanteEnderecoFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  <label className="block text-xs font-medium text-stone-600">
                    Comprovante de estado civil
                    <input
                      type="file"
                      disabled={extraindo || submitting}
                      className="mt-1 block w-full text-sm text-stone-700 file:mr-2 file:rounded-md file:border-0 file:bg-stone-200 file:px-3 file:py-1.5 file:text-xs file:font-medium"
                      onChange={(e) => setEstadoCivilFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  <label className="block text-xs font-medium text-stone-600">
                    Declaração de IRPF
                    <input
                      type="file"
                      disabled={extraindo || submitting}
                      className="mt-1 block w-full text-sm text-stone-700 file:mr-2 file:rounded-md file:border-0 file:bg-stone-200 file:px-3 file:py-1.5 file:text-xs file:font-medium"
                      onChange={(e) => setIrpfFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
                {!estadoCivilFile ? (
                  <label className="block text-xs font-medium text-stone-600">
                    Justificativa — comprovante de estado civil (sem anexo)
                    <textarea
                      rows={2}
                      value={estadoCivilJustificativa}
                      onChange={(e) => setEstadoCivilJustificativa(e.target.value)}
                      disabled={extraindo || submitting}
                      placeholder="Ex.: aguardando documento do franqueado…"
                      className={inputClass + ' resize-y'}
                    />
                  </label>
                ) : null}
              </fieldset>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-stone-600 sm:col-span-1">
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
                  Modalidade
                  <select
                    value={form.modalidade}
                    onChange={(e) => setForm((f) => ({ ...f, modalidade: e.target.value }))}
                    className={selectClass}
                  >
                    <option value="">—</option>
                    {REDE_OPCOES_MODALIDADE.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

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

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-stone-600">
                  Status da franquia
                  <select
                    value={form.status_franquia}
                    onChange={(e) => setForm((f) => ({ ...f, status_franquia: e.target.value }))}
                    className={selectClass}
                  >
                    {REDE_OPCOES_STATUS_FRANQUIA.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-medium text-stone-600">
                  Classificação do franqueado
                  <select
                    value={form.classificacao_franqueado}
                    onChange={(e) => setForm((f) => ({ ...f, classificacao_franqueado: e.target.value }))}
                    className={selectClass}
                  >
                    <option value="">—</option>
                    {REDE_OPCOES_CLASSIFICACAO_FRANQUEADO.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                <label className="block text-xs font-medium text-stone-600">
                  Data expiração franquia
                  <input
                    type="date"
                    value={form.data_expiracao_franquia}
                    onChange={(e) => setForm((f) => ({ ...f, data_expiracao_franquia: e.target.value }))}
                    className={inputClass}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-stone-600">
                  Regional
                  <select
                    value={form.regional}
                    onChange={(e) => setForm((f) => ({ ...f, regional: e.target.value }))}
                    className={selectClass}
                  >
                    <option value="">—</option>
                    {REDE_OPCOES_REGIONAL.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-medium text-stone-600">
                  Área de atuação
                  <input
                    type="text"
                    value={form.area_atuacao}
                    onChange={(e) => setForm((f) => ({ ...f, area_atuacao: e.target.value }))}
                    className={inputClass}
                    placeholder="UF - Cidade; UF - Cidade"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-stone-600">
                  E-mail do Frank
                  <input
                    type="email"
                    value={form.email_frank}
                    onChange={(e) => setForm((f) => ({ ...f, email_frank: e.target.value }))}
                    className={inputClass}
                  />
                </label>
                <label className="block text-xs font-medium text-stone-600">
                  Telefone do Frank
                  <input
                    type="tel"
                    value={form.telefone_frank}
                    onChange={(e) => setForm((f) => ({ ...f, telefone_frank: e.target.value }))}
                    className={inputClass}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-stone-600">
                  CPF do Frank
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.cpf_frank}
                    onChange={(e) => setForm((f) => ({ ...f, cpf_frank: e.target.value }))}
                    className={inputClass}
                    placeholder="000.000.000-00"
                  />
                </label>
                <label className="block text-xs font-medium text-stone-600">
                  Data de nascimento
                  <input
                    type="date"
                    value={form.data_nasc_frank}
                    onChange={(e) => setForm((f) => ({ ...f, data_nasc_frank: e.target.value }))}
                    className={inputClass}
                  />
                </label>
              </div>

              <label className="block text-xs font-medium text-stone-600">
                Endereço (rua)
                <input
                  type="text"
                  value={form.endereco_casa_frank}
                  onChange={(e) => setForm((f) => ({ ...f, endereco_casa_frank: e.target.value }))}
                  className={inputClass}
                />
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="block text-xs font-medium text-stone-600">
                  Número
                  <input
                    type="text"
                    value={form.endereco_casa_frank_numero}
                    onChange={(e) => setForm((f) => ({ ...f, endereco_casa_frank_numero: e.target.value }))}
                    className={inputClass}
                  />
                </label>
                <label className="block text-xs font-medium text-stone-600 sm:col-span-2">
                  Complemento
                  <input
                    type="text"
                    value={form.endereco_casa_frank_complemento}
                    onChange={(e) => setForm((f) => ({ ...f, endereco_casa_frank_complemento: e.target.value }))}
                    className={inputClass}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="block text-xs font-medium text-stone-600">
                  CEP
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.cep_casa_frank}
                    onChange={(e) => setForm((f) => ({ ...f, cep_casa_frank: e.target.value }))}
                    className={inputClass}
                    placeholder="00000-000"
                  />
                </label>
                <label className="block text-xs font-medium text-stone-600">
                  Estado
                  <select
                    value={form.estado_casa_frank}
                    onChange={(e) => setForm((f) => ({ ...f, estado_casa_frank: e.target.value }))}
                    className={selectClass}
                  >
                    <option value="">—</option>
                    {UFS_BRASIL.map((uf) => (
                      <option key={uf.sigla} value={uf.sigla}>
                        {uf.sigla}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-medium text-stone-600">
                  Cidade
                  <input
                    type="text"
                    value={form.cidade_casa_frank}
                    onChange={(e) => setForm((f) => ({ ...f, cidade_casa_frank: e.target.value }))}
                    className={inputClass}
                  />
                </label>
              </div>

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
                  disabled={submitting}
                  className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || extraindo}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#0c2633] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#163d4d] disabled:opacity-60"
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
