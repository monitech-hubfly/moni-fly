'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { criarChamado, getDadosNovoChamado } from './actions';
import type { HdmTime } from '@/types/sirene';
import { TIMES_MONI, responsaveisDoTimeMoni } from '@/lib/times-responsaveis';

const HDM_OPCOES: { value: HdmTime; label: string }[] = [
  { value: 'Homologações', label: 'Homologações' },
  { value: 'Produto', label: 'Produto' },
  { value: 'Modelo Virtual', label: 'Modelo Virtual' },
];

type FranqueadoItem = { id: string; n_franquia: string | null; nome_completo: string | null };

type Props = { onClose: () => void; onSuccess?: () => void };

export function ModalNovoChamado({ onClose, onSuccess }: Props) {
  const [dados, setDados] = useState<{
    isFrank: boolean;
    franqueados: FranqueadoItem[];
  } | null>(null);
  const [incendio, setIncendio] = useState('');
  const [timeAbertura, setTimeAbertura] = useState('');
  const [responsavelAbertura, setResponsavelAbertura] = useState('');
  const [frankId, setFrankId] = useState('');
  const [frankNome, setFrankNome] = useState('');
  const [buscaFrank, setBuscaFrank] = useState('');
  const [abertoBuscaFrank, setAbertoBuscaFrank] = useState(false);
  const [teTrata, setTeTrata] = useState<'sim' | 'nao' | ''>('');
  const [ehHdm, setEhHdm] = useState(false);
  const [hdmResponsavel, setHdmResponsavel] = useState<HdmTime | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const buscaFrankRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getDadosNovoChamado().then((r) => {
      if (r.ok) setDados({ isFrank: r.isFrank, franqueados: r.franqueados });
    });
  }, []);

  const responsaveisDoTime = useMemo(() => responsaveisDoTimeMoni(timeAbertura), [timeAbertura]);

  useEffect(() => {
    if (!responsavelAbertura) return;
    if (!responsaveisDoTime.includes(responsavelAbertura)) setResponsavelAbertura('');
  }, [timeAbertura, responsaveisDoTime, responsavelAbertura]);

  const frankFiltrados = useMemo(() => {
    if (!dados?.franqueados.length) return [];
    const q = buscaFrank.trim().toLowerCase();
    if (!q) return dados.franqueados.slice(0, 15);
    return dados.franqueados
      .filter(
        (f) =>
          (f.nome_completo?.toLowerCase().includes(q) ?? false) ||
          (f.n_franquia?.toLowerCase().includes(q) ?? false),
      )
      .slice(0, 15);
  }, [dados?.franqueados, buscaFrank]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (buscaFrankRef.current && !buscaFrankRef.current.contains(e.target as Node))
        setAbertoBuscaFrank(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const formData = new FormData();
    formData.set('incendio', incendio.trim());
    formData.set('time_abertura', timeAbertura.trim());
    if (responsavelAbertura.trim()) {
      formData.set('abertura_responsavel_nome', responsavelAbertura.trim());
    }
    formData.set('frank_id', frankId.trim());
    formData.set('frank_nome', frankNome.trim());
    if (teTrata === 'sim' || teTrata === 'nao') formData.set('te_trata', teTrata);
    formData.set('tipo', ehHdm ? 'hdm' : 'padrao');
    if (ehHdm && hdmResponsavel) formData.set('hdm_responsavel', hdmResponsavel);

    const result = await criarChamado(formData);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSuccess?.();
    if (result.chamadoId) window.location.href = `/sirene/${result.chamadoId}`;
    else onClose();
  }

  const isFrank = dados?.isFrank ?? false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="border-b border-stone-200 px-4 py-3">
          <h2 className="text-lg font-semibold text-stone-800">Novo chamado</h2>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">
              Esse incêndio te trava? *
            </label>
            <div className="flex gap-4">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="te_trata"
                  checked={teTrata === 'sim'}
                  onChange={() => setTeTrata('sim')}
                  className="h-4 w-4 border-stone-300 text-moni-primary"
                />
                <span className="text-sm text-stone-700">Sim</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="te_trata"
                  checked={teTrata === 'nao'}
                  onChange={() => setTeTrata('nao')}
                  className="h-4 w-4 border-stone-300 text-moni-primary"
                />
                <span className="text-sm text-stone-700">Não</span>
              </label>
            </div>
            <p className="mt-0.5 text-xs text-stone-500">
              Os chamados são priorizados por essa resposta.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">
              Incêndio (descrição do chamado) *
            </label>
            <input
              type="text"
              value={incendio}
              onChange={(e) => setIncendio(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-800"
              required
              placeholder="Breve descrição do problema"
            />
          </div>

          {!isFrank && dados && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700">
                  Time que está abrindo o chamado
                </label>
                <select
                  value={timeAbertura}
                  onChange={(e) => setTimeAbertura(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-800"
                >
                  <option value="">Selecione</option>
                  {TIMES_MONI.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700">
                  Responsável pelo time (opcional)
                </label>
                <select
                  value={responsavelAbertura}
                  onChange={(e) => setResponsavelAbertura(e.target.value)}
                  disabled={!timeAbertura}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-800 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-500"
                >
                  <option value="">
                    {timeAbertura ? 'Selecione' : 'Selecione um time primeiro'}
                  </option>
                  {responsaveisDoTime.map((nome) => (
                    <option key={nome} value={nome}>
                      {nome}
                    </option>
                  ))}
                </select>
              </div>

              <div ref={buscaFrankRef} className="relative">
                <label className="mb-1 block text-sm font-medium text-stone-700">
                  Franqueado conectado ao ticket (opcional)
                </label>
                <input
                  type="text"
                  value={abertoBuscaFrank ? buscaFrank : frankNome}
                  onChange={(e) => {
                    setBuscaFrank(e.target.value);
                    setAbertoBuscaFrank(true);
                    if (!abertoBuscaFrank) setFrankNome('');
                  }}
                  onFocus={() => setAbertoBuscaFrank(true)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-800"
                  placeholder="Pesquise pelo nome ou Nº da franquia"
                />
                {abertoBuscaFrank && frankFiltrados.length > 0 && (
                  <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-stone-200 bg-white py-1 shadow-lg">
                    {frankFiltrados.map((f) => (
                      <li key={f.id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm text-stone-800 hover:bg-stone-100"
                          onClick={() => {
                            setFrankId(f.id);
                            setFrankNome(f.nome_completo ?? f.n_franquia ?? '');
                            setBuscaFrank('');
                            setAbertoBuscaFrank(false);
                          }}
                        >
                          {f.nome_completo ?? f.n_franquia ?? f.id}
                          {f.n_franquia && f.nome_completo && (
                            <span className="ml-1 text-stone-500">({f.n_franquia})</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {abertoBuscaFrank && buscaFrank.trim() && frankFiltrados.length === 0 && (
                  <p className="absolute z-10 mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-500 shadow-lg">
                    Nenhum franqueado encontrado.
                  </p>
                )}
              </div>
            </>
          )}

          <p className="text-xs text-stone-500">
            Aberto por: preenchido automaticamente com seu login.
          </p>

          <div className="border-t border-stone-200 pt-3">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={ehHdm}
                onChange={(e) => {
                  setEhHdm(e.target.checked);
                  if (!e.target.checked) setHdmResponsavel('');
                }}
                className="h-4 w-4 rounded border-stone-300"
              />
              <span className="text-sm font-medium text-stone-700">Este chamado é HDM?</span>
            </label>
            {ehHdm && (
              <div className="mt-3">
                <label className="mb-1 block text-sm font-medium text-stone-700">
                  Time HDM responsável (opcional)
                </label>
                <select
                  value={hdmResponsavel}
                  onChange={(e) => setHdmResponsavel((e.target.value || '') as HdmTime | '')}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-800"
                >
                  <option value="">Selecione</option>
                  {HDM_OPCOES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-stone-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !incendio.trim() || teTrata === ''}
              className="rounded-lg bg-moni-primary px-4 py-2 text-sm font-medium text-white hover:bg-moni-secondary disabled:opacity-50"
            >
              {loading ? 'Abrindo…' : 'Abrir chamado'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
