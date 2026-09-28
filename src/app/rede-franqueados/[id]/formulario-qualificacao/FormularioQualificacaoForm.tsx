'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, ClipboardList, Info, Loader2 } from 'lucide-react';
import {
  salvarFormularioQualificacao,
  type FormularioQualificacaoRow,
} from '@/lib/actions/formulario-qualificacao';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const anoAtual = new Date().getFullYear();
const ANOS = Array.from({ length: 6 }, (_, i) => anoAtual - i);

function formatarPeriodo(mes: number, ano: number) {
  return `${MESES[mes - 1]} / ${ano}`;
}

function formatarData(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const inputCls =
  'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 placeholder-stone-400 focus:border-[color:var(--moni-navy-800,#0C2633)] focus:outline-none focus:ring-1 focus:ring-[color:var(--moni-navy-800,#0C2633)]';

const labelCls = 'mb-1.5 block text-xs font-medium text-stone-600';

type Props = {
  redeId: string;
  nFranquia: string;
  nomeCompleto: string;
  historico: FormularioQualificacaoRow[];
};

export function FormularioQualificacaoForm({ redeId, nFranquia, nomeCompleto, historico }: Props) {
  const router = useRouter();

  const mesAtual = new Date().getMonth() + 1;
  const [periodoMes, setPeriodoMes] = useState(mesAtual);
  const [periodoAno, setPeriodoAno] = useState(anoAtual);
  const [nomeConfirmado, setNomeConfirmado] = useState('');
  const [temPonto, setTemPonto] = useState<string>('');
  const [enderecoPonto, setEnderecoPonto] = useState('');
  const [colaboradores, setColaboradores] = useState('');
  const [contratosRealizados, setContratosRealizados] = useState('');
  const [contratosMeta, setContratosMeta] = useState('');
  const [desafios, setDesafios] = useState('');
  const [apoio, setApoio] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!nomeConfirmado.trim()) {
      setErro('Confirme seu nome completo antes de enviar.');
      return;
    }
    if (!temPonto) {
      setErro('Informe se possui ponto comercial ativo.');
      return;
    }
    if (temPonto === 'sim' && !enderecoPonto.trim()) {
      setErro('Informe o endereço do ponto comercial.');
      return;
    }
    if (colaboradores === '') {
      setErro('Informe o número de colaboradores ativos.');
      return;
    }
    if (contratosRealizados === '') {
      setErro('Informe o número de contratos realizados no trimestre.');
      return;
    }
    if (contratosMeta === '') {
      setErro('Informe a meta de contratos do trimestre.');
      return;
    }
    if (!desafios.trim()) {
      setErro('Descreva os principais desafios enfrentados no período.');
      return;
    }
    if (!apoio.trim()) {
      setErro('Informe o apoio necessário da equipe.');
      return;
    }
    if (!observacoes.trim()) {
      setErro('Preencha o campo de observações adicionais.');
      return;
    }

    setEnviando(true);
    try {
      const result = await salvarFormularioQualificacao({
        rede_franqueado_id: redeId,
        n_franquia: nFranquia,
        nome_franqueado_confirmado: nomeConfirmado.trim(),
        periodo_mes: periodoMes,
        periodo_ano: periodoAno,
        tem_ponto_comercial: temPonto === 'sim',
        endereco_ponto_comercial: temPonto === 'sim' ? enderecoPonto.trim() : null,
        numero_colaboradores: Number(colaboradores),
        contratos_realizados_trimestre: Number(contratosRealizados),
        meta_contratos_trimestre: Number(contratosMeta),
        principais_desafios: desafios.trim(),
        apoio_necessario: apoio.trim(),
        observacoes_adicionais: observacoes.trim(),
      });

      if (!result.ok) {
        setErro(result.error ?? 'Erro desconhecido.');
      } else {
        setSucesso(true);
        router.refresh();
      }
    } catch {
      setErro('Erro inesperado. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  function resetForm() {
    setSucesso(false);
    setNomeConfirmado('');
    setTemPonto('');
    setEnderecoPonto('');
    setColaboradores('');
    setContratosRealizados('');
    setContratosMeta('');
    setDesafios('');
    setApoio('');
    setObservacoes('');
    setErro(null);
  }

  return (
    <div className="space-y-10">
      {/* Aviso sobre número de franquia */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <Info size={16} className="mt-0.5 shrink-0 text-amber-600" />
        <span>
          Caso não saiba o número da sua franquia, entre em contato com seu consultor antes de
          preencher este formulário.
        </span>
      </div>

      {/* Formulário */}
      {!sucesso ? (
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Identificação */}
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
            <div className="border-b border-stone-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-stone-700">Identificação</h2>
            </div>
            <div className="grid gap-5 p-5 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Número de franquia</label>
                <input
                  type="text"
                  value={nFranquia}
                  readOnly
                  className="w-full cursor-not-allowed rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-500"
                />
              </div>
              <div>
                <label htmlFor="nome-confirmado" className={labelCls}>
                  Confirme seu nome completo <span className="text-red-500">*</span>
                </label>
                <input
                  id="nome-confirmado"
                  type="text"
                  value={nomeConfirmado}
                  onChange={(e) => setNomeConfirmado(e.target.value)}
                  placeholder={nomeCompleto || 'Seu nome completo'}
                  required
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Período de referência */}
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
            <div className="border-b border-stone-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-stone-700">Período de referência</h2>
            </div>
            <div className="grid gap-5 p-5 sm:grid-cols-2">
              <div>
                <label htmlFor="periodo-mes" className={labelCls}>
                  Mês <span className="text-red-500">*</span>
                </label>
                <select
                  id="periodo-mes"
                  value={periodoMes}
                  onChange={(e) => setPeriodoMes(Number(e.target.value))}
                  required
                  className={inputCls}
                >
                  {MESES.map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="periodo-ano" className={labelCls}>
                  Ano <span className="text-red-500">*</span>
                </label>
                <select
                  id="periodo-ano"
                  value={periodoAno}
                  onChange={(e) => setPeriodoAno(Number(e.target.value))}
                  required
                  className={inputCls}
                >
                  {ANOS.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Situação operacional */}
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
            <div className="border-b border-stone-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-stone-700">Situação operacional</h2>
            </div>
            <div className="space-y-5 p-5">
              <div>
                <p className="mb-2 text-xs font-medium text-stone-600">
                  Possui ponto comercial ativo? <span className="text-red-500">*</span>
                </p>
                <div className="flex gap-4">
                  {[
                    { value: 'sim', label: 'Sim' },
                    { value: 'nao', label: 'Não' },
                  ].map((opt) => (
                    <label key={opt.value} className="flex cursor-pointer items-center gap-2 text-sm text-stone-700">
                      <input
                        type="radio"
                        name="tem-ponto"
                        value={opt.value}
                        checked={temPonto === opt.value}
                        onChange={(e) => setTemPonto(e.target.value)}
                        className="accent-[color:var(--moni-navy-800,#0C2633)]"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              {temPonto === 'sim' && (
                <div>
                  <label htmlFor="endereco-ponto" className={labelCls}>
                    Endereço do ponto comercial <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="endereco-ponto"
                    type="text"
                    value={enderecoPonto}
                    onChange={(e) => setEnderecoPonto(e.target.value)}
                    placeholder="Rua, número, bairro, cidade, estado"
                    required
                    className={inputCls}
                  />
                </div>
              )}

              <div>
                <label htmlFor="colaboradores" className={labelCls}>
                  Número de colaboradores ativos <span className="text-red-500">*</span>
                </label>
                <input
                  id="colaboradores"
                  type="number"
                  min="0"
                  value={colaboradores}
                  onChange={(e) => setColaboradores(e.target.value)}
                  placeholder="0"
                  required
                  className="w-full max-w-[160px] rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 placeholder-stone-400 focus:border-[color:var(--moni-navy-800,#0C2633)] focus:outline-none focus:ring-1 focus:ring-[color:var(--moni-navy-800,#0C2633)]"
                />
              </div>
            </div>
          </div>

          {/* Indicadores de negócio */}
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
            <div className="border-b border-stone-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-stone-700">Indicadores de negócio</h2>
            </div>
            <div className="grid gap-5 p-5 sm:grid-cols-2">
              <div>
                <label htmlFor="contratos-realizados" className={labelCls}>
                  Contratos realizados no trimestre <span className="text-red-500">*</span>
                </label>
                <input
                  id="contratos-realizados"
                  type="number"
                  min="0"
                  value={contratosRealizados}
                  onChange={(e) => setContratosRealizados(e.target.value)}
                  placeholder="0"
                  required
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="contratos-meta" className={labelCls}>
                  Meta de contratos do trimestre <span className="text-red-500">*</span>
                </label>
                <input
                  id="contratos-meta"
                  type="number"
                  min="0"
                  value={contratosMeta}
                  onChange={(e) => setContratosMeta(e.target.value)}
                  placeholder="0"
                  required
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Avaliação qualitativa */}
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
            <div className="border-b border-stone-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-stone-700">Avaliação qualitativa</h2>
            </div>
            <div className="space-y-5 p-5">
              <div>
                <label htmlFor="desafios" className={labelCls}>
                  Principais desafios enfrentados no período <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="desafios"
                  value={desafios}
                  onChange={(e) => setDesafios(e.target.value)}
                  rows={3}
                  required
                  placeholder="Descreva os principais obstáculos ou dificuldades..."
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="apoio" className={labelCls}>
                  Apoio necessário da equipe <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="apoio"
                  value={apoio}
                  onChange={(e) => setApoio(e.target.value)}
                  rows={3}
                  required
                  placeholder="Que tipo de suporte ou recurso seria mais útil agora?"
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="observacoes" className={labelCls}>
                  Observações adicionais <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="observacoes"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={3}
                  required
                  placeholder="Qualquer outra informação relevante..."
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {erro && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-500" />
              {erro}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={enviando}
              className="inline-flex items-center gap-2 rounded-lg bg-[color:var(--moni-navy-800,#0C2633)] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#163d4d] disabled:opacity-50"
            >
              {enviando && <Loader2 size={14} className="animate-spin" />}
              {enviando ? 'Enviando...' : 'Enviar formulário'}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-green-200 bg-green-50 px-6 py-10 text-center">
          <CheckCircle2 size={40} className="text-green-600" />
          <div>
            <p className="text-base font-semibold text-green-800">Formulário enviado com sucesso!</p>
            <p className="mt-1 text-sm text-green-700">
              Seu formulário de qualificação referente a{' '}
              <strong>{formatarPeriodo(periodoMes, periodoAno)}</strong> foi registrado.
            </p>
          </div>
          <button
            type="button"
            onClick={resetForm}
            className="mt-2 rounded-lg border border-green-300 bg-white px-4 py-2 text-sm font-medium text-green-800 hover:bg-green-50"
          >
            Preencher novo formulário
          </button>
        </div>
      )}

      {/* Histórico */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-stone-700">
          <ClipboardList size={15} className="text-stone-400" />
          Histórico de formulários preenchidos
        </h2>

        {historico.length === 0 ? (
          <div className="rounded-xl border border-stone-200 bg-stone-50 px-5 py-8 text-center text-sm text-stone-400">
            Nenhum formulário preenchido ainda.
          </div>
        ) : (
          <div className="space-y-3">
            {historico.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-stone-200 bg-white px-5 py-4 shadow-sm"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-stone-800">
                    {formatarPeriodo(item.periodo_mes, item.periodo_ano)}
                  </span>
                  <span className="text-[11px] text-stone-400">
                    Enviado em {formatarData(item.criado_em)}
                  </span>
                </div>

                <dl className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
                  {item.tem_ponto_comercial !== null && (
                    <div>
                      <dt className="font-medium text-stone-500">Ponto comercial</dt>
                      <dd className="text-stone-700">{item.tem_ponto_comercial ? 'Sim' : 'Não'}</dd>
                    </div>
                  )}
                  {item.endereco_ponto_comercial && (
                    <div>
                      <dt className="font-medium text-stone-500">Endereço</dt>
                      <dd className="text-stone-700">{item.endereco_ponto_comercial}</dd>
                    </div>
                  )}
                  {item.numero_colaboradores !== null && (
                    <div>
                      <dt className="font-medium text-stone-500">Colaboradores</dt>
                      <dd className="text-stone-700">{item.numero_colaboradores}</dd>
                    </div>
                  )}
                  {item.contratos_realizados_trimestre !== null && (
                    <div>
                      <dt className="font-medium text-stone-500">Contratos realizados</dt>
                      <dd className="text-stone-700">{item.contratos_realizados_trimestre}</dd>
                    </div>
                  )}
                  {item.meta_contratos_trimestre !== null && (
                    <div>
                      <dt className="font-medium text-stone-500">Meta de contratos</dt>
                      <dd className="text-stone-700">{item.meta_contratos_trimestre}</dd>
                    </div>
                  )}
                  {item.principais_desafios && (
                    <div className="sm:col-span-2">
                      <dt className="font-medium text-stone-500">Principais desafios</dt>
                      <dd className="whitespace-pre-wrap text-stone-700">{item.principais_desafios}</dd>
                    </div>
                  )}
                  {item.apoio_necessario && (
                    <div className="sm:col-span-2">
                      <dt className="font-medium text-stone-500">Apoio necessário</dt>
                      <dd className="whitespace-pre-wrap text-stone-700">{item.apoio_necessario}</dd>
                    </div>
                  )}
                  {item.observacoes_adicionais && (
                    <div className="sm:col-span-2">
                      <dt className="font-medium text-stone-500">Observações</dt>
                      <dd className="whitespace-pre-wrap text-stone-700">{item.observacoes_adicionais}</dd>
                    </div>
                  )}
                </dl>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
