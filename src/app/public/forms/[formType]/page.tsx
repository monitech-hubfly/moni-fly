'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type FormType = 'legal' | 'credito';

export default function PublicChecklistFormPage({ params }: { params: { formType: string } }) {
  const searchParams = useSearchParams();
  const token = String(searchParams.get('token') ?? '').trim();
  const formType = (params.formType === 'legal' || params.formType === 'credito' ? params.formType : 'legal') as FormType;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [legal, setLegal] = useState<Record<string, string>>({
    q1_aprov_tel_setor: '',
    q2_aprov_tel_subprefeitura: '',
    q3_aprov_pre_fabricadas: '',
    q6_aprov_taxas: '',
    q7_aprov_laud_sondagem: '',
    q10_aprov_prazo_condominio: '',
    q11_aprov_prazo_prefeitura: '',
    q40_outras_observacoes: '',
  });
  const [credito, setCredito] = useState<Record<string, string>>({
    categoria_profissional: '',
    descricao_atividade: '',
    endividamento_info: '',
  });

  const title = useMemo(
    () => (formType === 'legal' ? 'Checklist Legal (Link Público)' : 'Checklist Crédito (Link Público)'),
    [formType],
  );

  useEffect(() => {
    (async () => {
      if (!token) {
        setError('Link inválido: token ausente.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/public/forms/${formType}?token=${encodeURIComponent(token)}`, { method: 'GET' });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok || !json?.ok) {
        setError(json?.error ?? 'Não foi possível carregar o formulário.');
        setLoading(false);
        return;
      }
      if (formType === 'legal' && json.payload?.respostas_json) {
        const r = json.payload.respostas_json as Record<string, unknown>;
        setLegal((prev) => ({
          ...prev,
          q1_aprov_tel_setor: String(r.q1_aprov_tel_setor ?? ''),
          q2_aprov_tel_subprefeitura: String(r.q2_aprov_tel_subprefeitura ?? ''),
          q3_aprov_pre_fabricadas: String(r.q3_aprov_pre_fabricadas ?? ''),
          q6_aprov_taxas: String(r.q6_aprov_taxas ?? ''),
          q7_aprov_laud_sondagem: String(r.q7_aprov_laud_sondagem ?? ''),
          q10_aprov_prazo_condominio: String(r.q10_aprov_prazo_condominio ?? ''),
          q11_aprov_prazo_prefeitura: String(r.q11_aprov_prazo_prefeitura ?? ''),
          q40_outras_observacoes: String(r.q40_outras_observacoes ?? ''),
        }));
      }
      if (formType === 'credito' && json.payload) {
        const p = json.payload as Record<string, unknown>;
        setCredito((prev) => ({
          ...prev,
          categoria_profissional: String(p.categoria_profissional ?? ''),
          descricao_atividade: String(p.descricao_atividade ?? ''),
          endividamento_info: String(p.endividamento_info ?? ''),
        }));
      }
      setLoading(false);
    })();
  }, [token, formType]);

  const save = async () => {
    if (!token) return;
    setSaving(true);
    setOkMsg(null);
    setError(null);
    const body =
      formType === 'legal'
        ? { token, respostas_json: legal, arquivos_json: {} }
        : { token, form: credito };
    const res = await fetch(`/api/public/forms/${formType}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as any;
    if (!res.ok || !json?.ok) {
      setError(json?.error ?? 'Erro ao salvar.');
      setSaving(false);
      return;
    }
    setSaving(false);
    setOkMsg('Respostas salvas com sucesso. Elas já estão vinculadas ao card.');
  };

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-white px-4 py-8">
      <h1 className="text-xl font-semibold text-stone-800">{title}</h1>
      <p className="mt-1 text-sm text-stone-500">Este link expira em 5 dias. Após preencher, clique em salvar.</p>

      {loading ? <p className="mt-6 text-sm text-stone-500">Carregando…</p> : null}
      {error ? <div className="mt-6 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      {!loading && !error && formType === 'legal' ? (
        <div className="mt-6 space-y-3">
          {[
            ['Telefone setor aprovações', 'q1_aprov_tel_setor'],
            ['Telefone subprefeitura', 'q2_aprov_tel_subprefeitura'],
            ['Pré-fabricadas / steel frame', 'q3_aprov_pre_fabricadas'],
            ['Taxas e valores', 'q6_aprov_taxas'],
            ['Laudos de sondagem', 'q7_aprov_laud_sondagem'],
            ['Prazo condomínio', 'q10_aprov_prazo_condominio'],
            ['Prazo prefeitura', 'q11_aprov_prazo_prefeitura'],
          ].map(([label, key]) => (
            <label key={key} className="block">
              <span className="text-xs text-stone-500">{label}</span>
              <input
                value={legal[key]}
                onChange={(e) => setLegal((prev) => ({ ...prev, [key]: e.target.value }))}
                className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
              />
            </label>
          ))}
          <label className="block">
            <span className="text-xs text-stone-500">Outras observações</span>
            <textarea
              value={legal.q40_outras_observacoes}
              onChange={(e) => setLegal((prev) => ({ ...prev, q40_outras_observacoes: e.target.value }))}
              rows={4}
              className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
      ) : null}

      {!loading && !error && formType === 'credito' ? (
        <div className="mt-6 space-y-3">
          <label className="block">
            <span className="text-xs text-stone-500">Categoria profissional</span>
            <input
              value={credito.categoria_profissional}
              onChange={(e) => setCredito((prev) => ({ ...prev, categoria_profissional: e.target.value }))}
              className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs text-stone-500">Descrição da atividade</span>
            <textarea
              value={credito.descricao_atividade}
              onChange={(e) => setCredito((prev) => ({ ...prev, descricao_atividade: e.target.value }))}
              rows={4}
              className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs text-stone-500">Endividamento</span>
            <textarea
              value={credito.endividamento_info}
              onChange={(e) => setCredito((prev) => ({ ...prev, endividamento_info: e.target.value }))}
              rows={4}
              className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded bg-moni-primary px-4 py-2 text-sm font-medium text-white hover:bg-moni-secondary disabled:opacity-60"
          >
            {saving ? 'Salvando…' : 'Salvar respostas'}
          </button>
          {okMsg ? <span className="text-sm text-green-700">{okMsg}</span> : null}
        </div>
      ) : null}
    </main>
  );
}

