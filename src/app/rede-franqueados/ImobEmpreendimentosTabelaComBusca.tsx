'use client';

import { useEffect, useMemo, useState, type ReactNode, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, X, ChevronDown, ChevronRight, Link2, Check, Printer } from 'lucide-react';
import { RedeTabelaToolbarBusca } from '@/app/rede-franqueados/RedeTabelaToolbarBusca';
import { redeTh } from '@/app/rede-franqueados/rede-ui';
import {
  agruparPorCondominio,
  imobEmpreendimentoRowMatchesBusca,
  ordenarImobEmpreendimentosPorNome,
  type ImobEmpreendimentoRow,
} from '@/lib/imob-empreendimentos';
import {
  criarImobEmpreendimento,
  atualizarImobEmpreendimento,
  vincularCorretorEmpreendimento,
  desvincularCorretorEmpreendimento,
  fetchFlyerData,
  type FlyerData,
} from '@/app/rede-franqueados/imob-empreendimentos-actions';
import { MoniTabelaScrollSync } from '@/components/MoniTabelaScrollSync';
import type { CondominioRow } from '@/lib/condominios';
import type { RedeCorretorRow } from '@/lib/rede-corretores';

type Props = {
  rows: ImobEmpreendimentoRow[];
  condominiosRows: CondominioRow[];
  corretoresRows: RedeCorretorRow[];
  children?: ReactNode;
  solicitarCriacao?: number;
};

const td = 'px-3 py-2.5 text-stone-700 text-sm';
const tdNowrap = `${td} whitespace-nowrap`;

function dash(s: string | null | undefined): string {
  return String(s ?? '').trim() || '—';
}

function linkSimulador(row: ImobEmpreendimentoRow): string | null {
  const t = row.share_token?.trim();
  if (!t) return null;
  return `https://moni.casa/corretor?token=${t}`;
}

// ─── Modal de criação/edição ──────────────────────────────────────────────────

type ModalProps = {
  row: ImobEmpreendimentoRow | null; // null = novo
  condominiosRows: CondominioRow[];
  corretoresRows: RedeCorretorRow[];
  onClose: () => void;
};

function EmpreendimentoModal({ row, condominiosRows, corretoresRows, onClose }: ModalProps) {
  const router = useRouter();
  const isNovo = row === null;

  const [nome, setNome] = useState(row?.nome ?? '');
  const [condominioId, setCondominioId] = useState(row?.condominio_id ?? '');
  const [specs, setSpecs] = useState(row?.specs ?? '');
  const [imagemUrl, setImagemUrl] = useState(row?.imagem_url ?? '');
  const [ativo, setAtivo] = useState(row?.ativo ?? true);

  const [vinculados, setVinculados] = useState<Set<string>>(
    new Set(row?.corretor_ids ?? []),
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [vinculandoId, setVinculandoId] = useState<string | null>(null);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    const patch = {
      nome,
      condominio_id: condominioId || null,
      specs: specs || null,
      imagem_url: imagemUrl || null,
      ativo,
    };
    const res = isNovo
      ? await criarImobEmpreendimento(patch)
      : await atualizarImobEmpreendimento(row!.id, patch);
    setSalvando(false);
    if (!res.ok) { setErro(res.error); return; }
    router.refresh();
    onClose();
  }

  async function toggleCorretor(corretorId: string) {
    if (!row) return;
    setVinculandoId(corretorId);
    const isVinculado = vinculados.has(corretorId);
    const res = isVinculado
      ? await desvincularCorretorEmpreendimento(corretorId, row.id)
      : await vincularCorretorEmpreendimento(corretorId, row.id);
    if (res.ok) {
      setVinculados((prev) => {
        const next = new Set(prev);
        if (isVinculado) next.delete(corretorId); else next.add(corretorId);
        return next;
      });
    }
    setVinculandoId(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 py-10">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl ring-1 ring-stone-200 mx-4">
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          <h2 className="text-base font-semibold text-stone-900">
            {isNovo ? 'Novo empreendimento' : 'Editar empreendimento'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={(e) => void salvar(e)} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Nome do empreendimento <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              placeholder="Ex.: Lago Azul II"
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-[var(--moni-navy-800)] focus:outline-none focus:ring-1 focus:ring-[var(--moni-navy-800)]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Condomínio</label>
            <select
              value={condominioId}
              onChange={(e) => setCondominioId(e.target.value)}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-[var(--moni-navy-800)] focus:outline-none"
            >
              <option value="">— Selecionar condomínio —</option>
              {condominiosRows.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                  {c.cidade ? ` · ${c.cidade}` : ''}
                  {c.estado ? `/${c.estado}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Especificações (texto livre para o flyer)
            </label>
            <textarea
              value={specs}
              onChange={(e) => setSpecs(e.target.value)}
              rows={3}
              placeholder="Ex.: 120m² · 3 dorms · 2 vagas"
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-[var(--moni-navy-800)] focus:outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              URL da imagem principal
            </label>
            <input
              type="url"
              value={imagemUrl}
              onChange={(e) => setImagemUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-[var(--moni-navy-800)] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="ativo-check"
              type="checkbox"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
              className="h-4 w-4 rounded border-stone-300 text-[var(--moni-navy-800)]"
            />
            <label htmlFor="ativo-check" className="text-sm text-stone-700">
              Empreendimento ativo
            </label>
          </div>

          {erro ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="rounded-md bg-[var(--moni-navy-800,#0c2633)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {salvando ? 'Salvando…' : isNovo ? 'Criar' : 'Salvar'}
            </button>
          </div>
        </form>

        {!isNovo && corretoresRows.length > 0 ? (
          <div className="border-t border-stone-100 px-6 py-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-500">
              Corretores vinculados
            </h3>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {corretoresRows.map((c) => {
                const linked = vinculados.has(c.id);
                return (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-stone-50"
                  >
                    <input
                      type="checkbox"
                      checked={linked}
                      disabled={vinculandoId === c.id}
                      onChange={() => void toggleCorretor(c.id)}
                      className="h-4 w-4 rounded border-stone-300 text-[var(--moni-navy-800)]"
                    />
                    <span className="text-stone-700">{c.nome}</span>
                    {c.n_corretor ? (
                      <span className="text-stone-400">#{c.n_corretor}</span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Modal Gerar Flyer ────────────────────────────────────────────────────────

type FlyerModalProps = {
  empId: string;
  empNome: string;
  onClose: () => void;
};

function buildFlyerUrl(data: FlyerData, corretorId: string): string {
  const p = new URLSearchParams();

  // Flyer do cadastro de empreendimentos: sem bloco de corretor / asterisco
  p.set('origem', 'cadastro');
  p.set('hide_corretor', '1');

  p.set('emp_id', data.emp.id);
  p.set('emp_nome', data.emp.nome);
  if (data.pipeline) p.set('pipeline', data.pipeline);

  const heroImg = data.hero_imagem_url ?? data.showroom?.imagem_url ?? data.emp.imagem_url;
  if (heroImg) p.set('hero_img', heroImg);
  if (data.preco_a_partir_de) p.set('p_valor', data.preco_a_partir_de);
  if (data.status_imovel) p.set('status_imovel', data.status_imovel);
  if (data.ano_lancamento != null) p.set('ano_lancamento', String(data.ano_lancamento));
  const modeloCasa = data.casa_produto_modelo || data.showroom?.produto_modelo || null;
  if (modeloCasa) p.set('showroom_modelo', modeloCasa);

  if (data.cond?.nome) p.set('cond_nome', data.cond.nome);
  if (data.cond?.cidade) p.set('cond_cidade', data.cond.cidade);
  if (data.cond?.estado) p.set('cond_estado', data.cond.estado);

  p.set('num_cards', String(Math.max(data.units.length, 1)));

  data.units.forEach((u, i) => {
    const n = i + 1;
    if (u.nome) p.set(`c${n}_nome`, u.nome);
    if (u.area) p.set(`c${n}_area`, u.area);
    if (u.quartos) p.set(`c${n}_quartos`, u.quartos);
    if (u.banheiros) p.set(`c${n}_banheiros`, u.banheiros);
    if (u.imagem_url) p.set(`c${n}_img`, u.imagem_url);
    if (u.valor_avista) p.set(`c${n}_avista`, u.valor_avista);
    if (u.entrada) p.set(`c${n}_entrada`, u.entrada);
    if (u.parcelas) p.set(`c${n}_parcelas`, u.parcelas);
  });

  const parcelaBase = data.units.find((u) => u.parcelas)?.parcelas ?? null;
  if (parcelaBase) p.set('p_parcela', `ou parcelas a partir de ${parcelaBase}/mês`);

  // Mantém corretor_id só para o QR/formulário (não exibe dados no flyer)
  const corretor = data.corretores.find((c) => c.id === corretorId) ?? null;
  if (corretor) {
    p.set('corretor_id', corretor.id);
  }

  return '/flyermoniv6.html?' + p.toString();
}

function FlyerModal({ empId, empNome, onClose }: FlyerModalProps) {
  const [data, setData] = useState<FlyerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [corretorId, setCorretorId] = useState('');

  useEffect(() => {
    fetchFlyerData(empId)
      .then((res) => {
        if ('error' in res) {
          setErro(res.error);
        } else {
          setData(res);
          // Pré-seleciona se só há um corretor
          if (res.corretores.length === 1) setCorretorId(res.corretores[0].id);
        }
      })
      .catch(() => setErro('Erro ao carregar dados do flyer.'))
      .finally(() => setLoading(false));
  }, [empId]);

  const flyerUrl = data ? buildFlyerUrl(data, corretorId) : '';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 py-10">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl ring-1 ring-stone-200 mx-4">
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          <h2 className="text-base font-semibold text-stone-900 flex items-center gap-2">
            <Printer className="h-4 w-4 text-stone-500" />
            Gerar Flyer — {empNome}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {loading ? (
            <p className="text-sm text-stone-500">Carregando dados do empreendimento…</p>
          ) : erro ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
          ) : data ? (
            <>
              {/* Resumo */}
              <div className="rounded-md bg-stone-50 px-4 py-3 text-sm space-y-1">
                {data.pipeline ? (
                  <p className="text-stone-600">
                    Pipeline:{' '}
                    <span className="font-medium text-stone-800">{data.pipeline}</span>
                  </p>
                ) : null}
                {data.cond ? (
                  <p className="text-stone-600">
                    Condomínio:{' '}
                    <span className="font-medium text-stone-800">
                      {data.cond.nome}
                      {data.cond.cidade ? ` · ${data.cond.cidade}` : ''}
                      {data.cond.estado ? `/${data.cond.estado}` : ''}
                    </span>
                  </p>
                ) : null}
                <p className="text-stone-600">
                  Tipologias (verso):{' '}
                  <span className="font-medium text-stone-800">
                    {data.units.length === 0 ? 'nenhuma cadastrada' : `${data.units.length} card${data.units.length !== 1 ? 's' : ''}`}
                  </span>
                </p>
              </div>

              {data.units.length === 0 ? (
                <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Nenhuma unidade cadastrada em Modelos e Simulações IMOB. O verso do flyer ficará em branco.
                </p>
              ) : null}

              {/* Seletor de corretor */}
              {data.corretores.length > 0 ? (
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Corretor
                  </label>
                  <select
                    value={corretorId}
                    onChange={(e) => setCorretorId(e.target.value)}
                    className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-[var(--moni-navy-800)] focus:outline-none"
                  >
                    <option value="">— Sem corretor (flyer genérico) —</option>
                    {data.corretores.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome ?? '(sem nome)'}
                        {c.creci ? ` · CRECI ${c.creci}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="text-sm text-stone-500">
                  Nenhum corretor vinculado a este empreendimento.
                </p>
              )}
            </>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 px-6 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
          >
            Cancelar
          </button>
          {!loading && !erro && data ? (
            <a
              href={flyerUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--moni-navy-800,#0c2633)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              <Printer className="h-4 w-4" />
              Abrir Flyer
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function ImobEmpreendimentosTabelaComBusca({
  rows,
  condominiosRows,
  corretoresRows,
  children,
  solicitarCriacao = 0,
}: Props) {
  const [busca, setBusca] = useState('');
  const [modalRow, setModalRow] = useState<ImobEmpreendimentoRow | null | undefined>(undefined);
  const [flyerEmpId, setFlyerEmpId] = useState<string | null>(null);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (solicitarCriacao > 0) setModalRow(null);
  }, [solicitarCriacao]);

  const rowsFiltradas = useMemo(() => {
    const q = busca.trim();
    const base = q
      ? rows.filter((r) => imobEmpreendimentoRowMatchesBusca(r, q))
      : rows;
    return ordenarImobEmpreendimentosPorNome(base);
  }, [rows, busca]);

  const grupos = useMemo(() => agruparPorCondominio(rowsFiltradas), [rowsFiltradas]);

  function toggleGrupo(key: string) {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const flyerRow = flyerEmpId ? rows.find((r) => r.id === flyerEmpId) : undefined;

  return (
    <div className="space-y-4">
      <RedeTabelaToolbarBusca
        value={busca}
        onChange={setBusca}
        placeholder="Pesquisar empreendimentos…"
        ariaLabel="Pesquisar empreendimentos"
      >
        {children}
      </RedeTabelaToolbarBusca>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-stone-200 bg-white px-6 py-10 text-center text-sm text-stone-500 shadow-sm">
          Nenhum empreendimento cadastrado ainda.{' '}
          <button
            type="button"
            onClick={() => setModalRow(null)}
            className="font-medium text-[var(--moni-navy-800)] underline-offset-2 hover:underline"
          >
            Criar o primeiro
          </button>
        </div>
      ) : grupos.length === 0 && busca.trim() ? (
        <div className="rounded-lg border border-stone-200 bg-white px-6 py-10 text-center text-sm text-stone-500 shadow-sm">
          Nenhum empreendimento encontrado para &ldquo;{busca}&rdquo;.
        </div>
      ) : (
        <div className="space-y-3">
          {grupos.map((grupo) => {
            const key = grupo.condominio_id ?? '__sem_condominio__';
            const aberto = !expandidos.has(key);
            return (
              <div
                key={key}
                className="rounded-lg border border-stone-200 bg-white shadow-sm overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleGrupo(key)}
                  className="flex w-full items-center gap-2 border-b border-stone-100 bg-stone-50/70 px-4 py-3 text-left"
                >
                  {aberto ? (
                    <ChevronDown className="h-4 w-4 text-stone-400 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-stone-400 shrink-0" />
                  )}
                  <span className="font-semibold text-stone-800 text-sm">
                    {grupo.condominio_nome}
                  </span>
                  <span className="ml-auto text-xs text-stone-400">
                    {grupo.rows.length} empreendimento{grupo.rows.length !== 1 ? 's' : ''}
                  </span>
                </button>

                {aberto ? (
                  <MoniTabelaScrollSync>
                    <table className="min-w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-stone-100 bg-stone-50/40">
                          <th className={redeTh}>Nome</th>
                          <th className={redeTh}>Card vinculado</th>
                          <th className={redeTh}>Especificações</th>
                          <th className={redeTh}>Corretores</th>
                          <th className={redeTh}>Unidades IMOB</th>
                          <th className={redeTh}>Status</th>
                          <th className={redeTh}>Link simulador</th>
                          <th className={`${redeTh} w-20 text-right`}>
                            <span className="sr-only">Ações</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {grupo.rows.map((row) => {
                          const simLink = linkSimulador(row);
                          return (
                            <tr
                              key={row.id}
                              className="border-b border-stone-100 last:border-0 hover:bg-stone-50/60"
                            >
                              <td className={`${td} font-medium text-stone-900 min-w-[10rem]`}>
                                {row.nome}
                                {!row.ativo ? (
                                  <span className="ml-2 inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-500">
                                    Inativo
                                  </span>
                                ) : null}
                              </td>
                              <td className={`${td} min-w-[10rem]`}>
                                {dash(row.card_titulo)}
                              </td>
                              <td className={`${td} min-w-[14rem] max-w-[20rem]`}>
                                <span className="line-clamp-2">{dash(row.specs)}</span>
                              </td>
                              <td className={tdNowrap}>
                                {row.corretores_count != null ? (
                                  <span
                                    className={
                                      (row.corretores_count ?? 0) > 0
                                        ? 'font-medium text-stone-900'
                                        : 'text-stone-400'
                                    }
                                  >
                                    {row.corretores_count}
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className={tdNowrap}>
                                {row.unidades_count != null ? (
                                  <span
                                    className={
                                      (row.unidades_count ?? 0) > 0
                                        ? 'font-medium text-stone-900'
                                        : 'text-stone-400'
                                    }
                                  >
                                    {row.unidades_count}
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className={tdNowrap}>
                                {row.ativo ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                                    <Check className="h-3 w-3" />
                                    Ativo
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
                                    Inativo
                                  </span>
                                )}
                              </td>
                              <td className={`${td} min-w-[10rem]`}>
                                {simLink ? (
                                  <a
                                    href={simLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[var(--moni-navy-800)] underline-offset-2 hover:underline text-xs"
                                  >
                                    <Link2 className="h-3 w-3 shrink-0" />
                                    {row.share_token}
                                  </a>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className={`${td} text-right whitespace-nowrap`}>
                                <button
                                  type="button"
                                  title="Gerar Flyer"
                                  onClick={() => setFlyerEmpId(row.id)}
                                  className="rounded-md p-1.5 text-stone-500 hover:bg-amber-100/80 hover:text-amber-700 mr-0.5"
                                >
                                  <Printer className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  title="Editar empreendimento"
                                  onClick={() => setModalRow(row)}
                                  className="rounded-md p-1.5 text-stone-500 hover:bg-stone-200/80 hover:text-stone-700"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </MoniTabelaScrollSync>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal edição/criação */}
      {modalRow !== undefined ? (
        <EmpreendimentoModal
          row={modalRow}
          condominiosRows={condominiosRows}
          corretoresRows={corretoresRows}
          onClose={() => setModalRow(undefined)}
        />
      ) : null}

      {/* Modal flyer */}
      {flyerEmpId && flyerRow ? (
        <FlyerModal
          empId={flyerEmpId}
          empNome={flyerRow.nome}
          onClose={() => setFlyerEmpId(null)}
        />
      ) : null}
    </div>
  );
}
