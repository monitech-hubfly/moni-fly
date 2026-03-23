'use client';

import { useState, useTransition, useEffect, useRef, useCallback } from 'react';
import { ModalRedirecionarHDM } from './ModalRedirecionarHDM';
import type { Chamado } from '@/types/sirene';
import type { SireneUserContext } from '@/lib/sirene';
import {
  definirPrioridade,
  fecharChamado,
  concluirChamadoCriador,
  getTopicosChamado,
  getTimesParaTopicos,
  salvarResolucaoComTopicos,
  concluirTopico,
  aprovarTopico,
  reprovarTopico,
  listAnexosChamado,
  uploadAnexoChamado,
  getAnexoChamadoDownloadUrl,
  getPericiaDoChamado,
  listMensagensChamado,
  getParticipantesChamado,
  enviarMensagemChamado,
  type TopicoInput,
  type AnexoOrigem,
} from './actions';

type Props = {
  chamado: Chamado;
  userContext: SireneUserContext;
  podeActuarComoBombeiro: boolean;
  podePreencherTemaMapeamento: boolean;
  mostrarControlesBombeiro: boolean;
  mostrarRedirecionarHDM: boolean;
  isCriador?: boolean;
};

type TopicoSalvo = {
  id: number;
  ordem: number;
  descricao: string;
  time_responsavel: string;
  status: string;
  resolucao_time: string | null;
  motivo_reprovacao: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  trava: boolean;
};

type AnexoUploadOption = { tipo: 'criador' } | { tipo: 'fechamento_bombeiro' } | { tipo: 'topico'; topicoId: number; label: string };

function AnexoUploadInline({
  chamadoId,
  isCriador,
  podeUploadFechamento,
  topicosList,
  podeActuarComoBombeiro,
  userTime,
  onSuccess,
  onError,
  isPending,
  setPending,
}: {
  chamadoId: number;
  isCriador: boolean;
  podeUploadFechamento: boolean;
  topicosList: TopicoSalvo[];
  podeActuarComoBombeiro: boolean;
  userTime: string | null;
  onSuccess: () => void;
  onError: (e: string) => void;
  isPending: boolean;
  setPending: (v: boolean) => void;
}) {
  const [opcao, setOpcao] = useState<AnexoUploadOption | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const opcoes: AnexoUploadOption[] = [];
  if (isCriador) opcoes.push({ tipo: 'criador' });
  if (podeUploadFechamento) opcoes.push({ tipo: 'fechamento_bombeiro' });
  topicosList.forEach((t) => {
    if (podeActuarComoBombeiro || t.time_responsavel === userTime)
      opcoes.push({ tipo: 'topico', topicoId: t.id, label: `${t.time_responsavel}: ${t.descricao.slice(0, 40)}` });
  });
  if (opcoes.length === 0) return null;

  const handleUpload = async () => {
    if (!opcao || !fileRef.current?.files?.length) {
      onError('Selecione o tipo e um arquivo.');
      return;
    }
    const file = fileRef.current.files[0];
    const formData = new FormData();
    formData.set('file', file);
    let origem: AnexoOrigem;
    let topicoId: number | undefined;
    if (opcao.tipo === 'criador') origem = 'criador';
    else if (opcao.tipo === 'fechamento_bombeiro') origem = 'fechamento_bombeiro';
    else {
      origem = 'topico';
      topicoId = opcao.topicoId;
    }
    setPending(true);
    onError('');
    const result = await uploadAnexoChamado(chamadoId, origem, formData, topicoId);
    setPending(false);
    if (!result.ok) onError(result.error);
    else {
      onSuccess();
      fileRef.current.value = '';
      setOpcao(null);
    }
  };

  return (
    <div className="mt-2 flex flex-wrap items-end gap-2">
      <select
        value={opcao ? (opcao.tipo === 'topico' ? `topico_${opcao.topicoId}` : opcao.tipo) : ''}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) setOpcao(null);
          else if (v === 'criador') setOpcao({ tipo: 'criador' });
          else if (v === 'fechamento_bombeiro') setOpcao({ tipo: 'fechamento_bombeiro' });
          else if (v.startsWith('topico_')) {
            const t = topicosList.find((x) => x.id === parseInt(v.replace('topico_', ''), 10));
            if (t) setOpcao({ tipo: 'topico', topicoId: t.id, label: t.descricao });
          }
        }}
        className="rounded-md border border-stone-600 bg-stone-800 px-2 py-1.5 text-sm text-stone-100"
      >
        <option value="">Tipo do anexo</option>
        {opcoes.map((o) =>
          o.tipo === 'topico' ? (
            <option key={`topico_${o.topicoId}`} value={`topico_${o.topicoId}`}>
              Tópico: {o.label}
            </option>
          ) : (
            <option key={o.tipo} value={o.tipo}>
              {o.tipo === 'criador' ? 'Abertura (criador)' : 'Fechamento (Bombeiro)'}
            </option>
          ),
        )}
      </select>
      <input
        ref={fileRef}
        type="file"
        className="rounded border border-stone-600 bg-stone-800 text-sm text-stone-200 file:mr-2 file:rounded file:border-0 file:bg-stone-600 file:px-2 file:py-1 file:text-stone-200"
      />
      <button
        type="button"
        onClick={handleUpload}
        disabled={isPending || !opcao}
        className="rounded-md bg-stone-600 px-3 py-1.5 text-sm text-stone-200 hover:bg-stone-500 disabled:opacity-50"
      >
        {isPending ? 'Enviando…' : 'Enviar anexo'}
      </button>
    </div>
  );
}

export function DetalheChamadoConteudo({
  chamado,
  userContext,
  podeActuarComoBombeiro,
  podePreencherTemaMapeamento,
  mostrarControlesBombeiro,
  mostrarRedirecionarHDM,
  isCriador = false,
}: Props) {
  const [modalRedirecionar, setModalRedirecionar] = useState(false);
  const [topicosList, setTopicosList] = useState<TopicoSalvo[]>([]);
  const [resolucaoPorTopico, setResolucaoPorTopico] = useState<Record<number, string>>({});
  const [reprovarTopicoId, setReprovarTopicoId] = useState<number | null>(null);
  const [motivoReprovar, setMotivoReprovar] = useState('');
  const [motivoInsuficiente, setMotivoInsuficiente] = useState('');
  const [anexosList, setAnexosList] = useState<Array<{
    id: number;
    topico_id: number | null;
    uploader_nome: string | null;
    nome_original: string | null;
    origem: string | null;
    created_at: string;
  }>>([]);
  const [uploadAnexoPending, setUploadAnexoPending] = useState(false);
  const [periciaChamado, setPericiaChamado] = useState<{
    id: number;
    nome_pericia: string;
    time_responsavel: string | null;
    responsavel_nome: string | null;
    data_inicio: string | null;
    status: string;
  } | null>(null);
  const [mensagensList, setMensagensList] = useState<Array<{
    id: number;
    autor_nome: string | null;
    autor_time: string | null;
    texto: string;
    created_at: string;
  }>>([]);
  const [novoComentario, setNovoComentario] = useState('');
  const [participantes, setParticipantes] = useState<Array<{ id: string; nome: string }>>([]);
  const [comentarioPending, setComentarioPending] = useState(false);

  const [prioridade, setPrioridade] = useState(chamado.prioridade ?? 'Média');
  const [topicos, setTopicos] = useState<TopicoInput[]>([]);
  const [times, setTimes] = useState<string[]>([]);
  const [fechamentoParecer, setFechamentoParecer] = useState(chamado.parecer_final ?? '');
  const [fechamentoTema, setFechamentoTema] = useState(chamado.tema ?? '');
  const [fechamentoMapeamento, setFechamentoMapeamento] = useState(
    chamado.mapeamento_pericia ?? '',
  );

  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!chamado.id) return;
    getTopicosChamado(chamado.id).then((r) => {
      if (r.ok) setTopicosList(r.topicos);
    });
  }, [chamado.id]);

  const carregarAnexos = useCallback(() => {
    if (!chamado.id) return;
    listAnexosChamado(chamado.id).then((r) => {
      if (r.ok) setAnexosList(r.anexos);
    });
  }, [chamado.id]);
  useEffect(() => {
    carregarAnexos();
  }, [carregarAnexos]);

  const carregarPericia = useCallback(() => {
    getPericiaDoChamado(chamado.id).then((r) => r.ok && setPericiaChamado(r.pericia));
  }, [chamado.id]);
  const carregarMensagens = useCallback(() => {
    listMensagensChamado(chamado.id).then((r) => r.ok && setMensagensList(r.mensagens));
  }, [chamado.id]);
  const carregarParticipantes = useCallback(() => {
    getParticipantesChamado(chamado.id).then((r) => r.ok && setParticipantes(r.participantes));
  }, [chamado.id]);
  useEffect(() => {
    carregarPericia();
    carregarMensagens();
    carregarParticipantes();
  }, [carregarPericia, carregarMensagens, carregarParticipantes]);

  const handleEnviarComentario = () => {
    if (!novoComentario.trim()) return;
    setComentarioPending(true);
    enviarMensagemChamado(chamado.id, novoComentario).then((r) => {
      setComentarioPending(false);
      if (r.ok) {
        setNovoComentario('');
        carregarMensagens();
      } else setErro(r.error);
    });
  };

  useEffect(() => {
    if (!mostrarControlesBombeiro || !chamado.id) return;
    getTimesParaTopicos().then((r) => {
      if (r.ok) setTimes(r.times);
    });
    getTopicosChamado(chamado.id).then((r) => {
      if (r.ok && r.topicos.length > 0)
        setTopicos(
          r.topicos.map((t) => ({
            descricao: t.descricao,
            time_responsavel: t.time_responsavel,
            data_inicio: t.data_inicio ?? '',
            data_fim: t.data_fim ?? '',
            trava: t.trava,
          })),
        );
      else setTopicos([{ descricao: '', time_responsavel: '', data_inicio: '', data_fim: '', trava: false }]);
    });
  }, [mostrarControlesBombeiro, chamado.id]);

  const adicionarTopico = () => {
    setTopicos((prev) => [...prev, { descricao: '', time_responsavel: times[0] ?? '', data_inicio: '', data_fim: '', trava: false }]);
  };

  const atualizarTopico = (idx: number, campo: keyof TopicoInput, valor: string | boolean) => {
    setTopicos((prev) => {
      const next = [...prev];
      if (!next[idx]) return prev;
      (next[idx] as Record<string, unknown>)[campo] = valor;
      return next;
    });
  };

  const removerTopico = (idx: number) => {
    setTopicos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSalvarTopicos = () => {
    setMensagem(null);
    setErro(null);
    startTransition(async () => {
      const result = await salvarResolucaoComTopicos(chamado.id, topicos);
      if (!result.ok && 'error' in result) {
        setErro(result.error);
      } else {
        setMensagem('Tópicos salvos. Atendimento iniciado (status em andamento).');
        window.location.reload();
      }
    });
  };

  const handleSalvarPrioridade = () => {
    setMensagem(null);
    setErro(null);
    startTransition(async () => {
      const result = await definirPrioridade(chamado.id, prioridade);
      if (!result.ok && 'error' in result) {
        setErro(result.error);
      } else {
        setMensagem('Prioridade atualizada com sucesso.');
      }
    });
  };

  const handleFecharChamado = () => {
    setMensagem(null);
    setErro(null);
    startTransition(async () => {
      const result = await fecharChamado(
        chamado.id,
        fechamentoParecer,
        fechamentoTema,
        fechamentoMapeamento,
      );
      if (!result.ok && 'error' in result) {
        setErro(result.error);
      } else {
        setMensagem('Fechamento enviado ao criador. Aguardando aprovação.');
        window.location.reload();
      }
    });
  };

  const handleConcluirChamadoCriador = (suficiente: boolean) => {
    setMensagem(null);
    setErro(null);
    if (!suficiente && !motivoInsuficiente.trim()) {
      setErro('Informe o motivo da insuficiência para reabrir o chamado.');
      return;
    }
    startTransition(async () => {
      const result = await concluirChamadoCriador(
        chamado.id,
        suficiente,
        suficiente ? undefined : motivoInsuficiente.trim(),
      );
      if (!result.ok && 'error' in result) setErro(result.error);
      else {
        setMensagem(suficiente ? 'Chamado concluído.' : 'Chamado reaberto. O processo com Bombeiro e times segue.');
        window.location.reload();
      }
    });
  };

  const podeConcluirTopico = (timeResponsavel: string) =>
    userContext.papel === 'bombeiro' || userContext.time === timeResponsavel;
  const isBombeiro = userContext.papel === 'bombeiro';

  const handleConcluirTopico = (topicoId: number) => {
    const texto = resolucaoPorTopico[topicoId] ?? '';
    setMensagem(null);
    setErro(null);
    startTransition(async () => {
      const result = await concluirTopico(topicoId, texto);
      if (!result.ok && 'error' in result) setErro(result.error);
      else {
        setMensagem('Tópico concluído.');
        getTopicosChamado(chamado.id).then((r) => r.ok && setTopicosList(r.topicos));
      }
    });
  };

  const handleAprovarTopico = (topicoId: number) => {
    setMensagem(null);
    setErro(null);
    startTransition(async () => {
      const result = await aprovarTopico(topicoId);
      if (!result.ok && 'error' in result) setErro(result.error);
      else {
        setMensagem('Tópico aprovado.');
        getTopicosChamado(chamado.id).then((r) => r.ok && setTopicosList(r.topicos));
      }
    });
  };

  const handleReprovarTopico = (topicoId: number) => {
    setMensagem(null);
    setErro(null);
    startTransition(async () => {
      const result = await reprovarTopico(topicoId, motivoReprovar);
      if (!result.ok && 'error' in result) setErro(result.error);
      else {
        setMensagem('Tópico reprovado.');
        setReprovarTopicoId(null);
        setMotivoReprovar('');
        getTopicosChamado(chamado.id).then((r) => r.ok && setTopicosList(r.topicos));
      }
    });
  };

  const statusTopicoLabel: Record<string, string> = {
    nao_iniciado: 'Não iniciado',
    em_andamento: 'Em andamento',
    concluido: 'Concluído (aguardando aprovação)',
    aprovado: 'Aprovado',
  };

  return (
    <>
      <div className="mt-8 space-y-6">
        {mostrarRedirecionarHDM && (
          <section className="rounded-xl border border-stone-700 bg-stone-800/80 p-4">
            <h2 className="text-sm font-semibold text-stone-200">Ações Bombeiro</h2>
            <button
              type="button"
              onClick={() => setModalRedirecionar(true)}
              className="mt-2 rounded-lg border border-[#1e3a5f] bg-[#1e3a5f]/20 px-4 py-2 text-sm font-medium text-blue-300 hover:bg-[#1e3a5f]/30"
            >
              Redirecionar para HDM
            </button>
          </section>
        )}

        {topicosList.length > 0 && (
          <section className="rounded-xl border border-stone-700 bg-stone-800/80 p-4">
            <h2 className="text-sm font-semibold text-stone-200">Tópicos do chamado</h2>
            <p className="mt-1 text-xs text-stone-400">
              Conclua o tópico (time responsável ou Bombeiro). Bombeiro aprova ou reprova tópicos
              concluídos.
            </p>
            <ul className="mt-4 space-y-4">
              {topicosList.map((t) => (
                <li
                  key={t.id}
                  className="rounded-lg border border-stone-600 bg-stone-900/80 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-stone-400">
                      {t.time_responsavel}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs ${
                        t.status === 'aprovado'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : t.status === 'concluido'
                            ? 'bg-amber-500/20 text-amber-400'
                            : t.status === 'em_andamento'
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-stone-600 text-stone-300'
                      }`}
                    >
                      {statusTopicoLabel[t.status] ?? t.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-stone-200">{t.descricao}</p>
                  {t.resolucao_time && (
                    <p className="mt-1 rounded bg-stone-800 p-2 text-xs text-stone-300">
                      <strong>Resolução do time:</strong> {t.resolucao_time}
                    </p>
                  )}
                  {t.motivo_reprovacao && (
                    <p className="mt-1 rounded bg-red-900/30 border border-red-800/50 p-2 text-xs text-red-200">
                      <strong>Motivo da reprovação:</strong> {t.motivo_reprovacao}
                    </p>
                  )}

                  {t.status !== 'aprovado' && t.status !== 'concluido' && podeConcluirTopico(t.time_responsavel) && (
                    <div className="mt-3">
                      <textarea
                        value={resolucaoPorTopico[t.id] ?? ''}
                        onChange={(e) =>
                          setResolucaoPorTopico((prev) => ({ ...prev, [t.id]: e.target.value }))
                        }
                        placeholder="Resolução do tópico (time ou Bombeiro)"
                        rows={2}
                        className="w-full rounded-md border border-stone-600 bg-stone-800 px-2 py-1.5 text-sm text-stone-100"
                        disabled={isPending}
                      />
                      <button
                        type="button"
                        onClick={() => handleConcluirTopico(t.id)}
                        disabled={isPending}
                        className="mt-2 rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-stone-900 hover:bg-emerald-400 disabled:opacity-60"
                      >
                        {isPending ? 'Salvando…' : 'Concluir tópico'}
                      </button>
                    </div>
                  )}

                  {t.status === 'concluido' && isBombeiro && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAprovarTopico(t.id)}
                        disabled={isPending}
                        className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-stone-900 hover:bg-emerald-400 disabled:opacity-60"
                      >
                        Aprovar
                      </button>
                      {reprovarTopicoId === t.id ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={motivoReprovar}
                            onChange={(e) => setMotivoReprovar(e.target.value)}
                            placeholder="Motivo da reprovação"
                            className="rounded-md border border-stone-600 bg-stone-800 px-2 py-1.5 text-sm text-stone-100"
                            disabled={isPending}
                          />
                          <button
                            type="button"
                            onClick={() => handleReprovarTopico(t.id)}
                            disabled={isPending}
                            className="rounded-md bg-red-500/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-60"
                          >
                            Enviar reprovação
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setReprovarTopicoId(null);
                              setMotivoReprovar('');
                            }}
                            className="text-xs text-stone-400 hover:text-stone-200"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setReprovarTopicoId(t.id)}
                          className="rounded-md border border-red-500/50 bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/30"
                        >
                          Reprovar
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-xl border border-stone-700 bg-stone-800/80 p-4">
          <h2 className="text-sm font-semibold text-stone-200">Anexos do chamado</h2>
          <p className="mt-1 text-xs text-stone-400">
            Todos os anexos ficam visíveis para quem participa do chamado (criador, times, Bombeiro).
          </p>
          {anexosList.length === 0 ? (
            <p className="mt-2 text-sm text-stone-500">Nenhum anexo ainda.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {anexosList.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded bg-stone-700 px-1.5 py-0.5 text-xs text-stone-400">
                    {a.origem === 'criador'
                      ? 'Abertura'
                      : a.origem === 'fechamento_bombeiro'
                        ? 'Fechamento'
                        : `Tópico`}
                    {a.topico_id != null &&
                      topicosList.find((t) => t.id === a.topico_id) &&
                      ` — ${topicosList.find((t) => t.id === a.topico_id)?.descricao?.slice(0, 30) ?? a.topico_id}`}
                  </span>
                  <span className="text-stone-300">{a.nome_original ?? 'Arquivo'}</span>
                  {a.uploader_nome && (
                    <span className="text-xs text-stone-500">({a.uploader_nome})</span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      getAnexoChamadoDownloadUrl(a.id).then((r) => {
                        if (r.ok) window.open(r.url, '_blank');
                        else setErro(r.error);
                      });
                    }}
                    className="text-xs text-emerald-400 hover:text-emerald-300"
                  >
                    Baixar
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 rounded-lg border border-stone-600 bg-stone-900/80 p-3">
            <p className="text-xs font-medium text-stone-400">Adicionar anexo</p>
            <AnexoUploadInline
              chamadoId={chamado.id}
              isCriador={isCriador}
              podeUploadFechamento={podePreencherTemaMapeamento}
              topicosList={topicosList}
              podeActuarComoBombeiro={podeActuarComoBombeiro}
              userTime={userContext.time}
              onSuccess={carregarAnexos}
              onError={setErro}
              isPending={uploadAnexoPending}
              setPending={setUploadAnexoPending}
            />
          </div>
        </section>

        {mostrarControlesBombeiro && (
          <section className="rounded-xl border border-stone-700 bg-stone-800/80 p-4">
            <h2 className="text-sm font-semibold text-stone-200">Resolução e tópicos</h2>
            <p className="mt-1 text-xs text-stone-400">
              Quebre a resolução em tópicos e vincule cada um a um time. Ao salvar, o atendimento é
              iniciado e os tópicos vão para a lista de tarefas dos times.
            </p>

            <div className="mt-3">
              <label className="block text-xs font-medium text-stone-300">Prioridade</label>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <select
                  value={prioridade}
                  onChange={(e) => setPrioridade(e.target.value)}
                  className="rounded-md border border-stone-600 bg-stone-900 px-2 py-1 text-sm text-stone-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  disabled={isPending}
                >
                  <option value="Baixa">Baixa</option>
                  <option value="Média">Média</option>
                  <option value="Alta">Alta</option>
                  <option value="Urgente">Urgente</option>
                </select>
                <button
                  type="button"
                  onClick={handleSalvarPrioridade}
                  disabled={isPending}
                  className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-stone-900 hover:bg-emerald-400 disabled:opacity-60"
                >
                  {isPending ? 'Salvando…' : 'Salvar prioridade'}
                </button>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-stone-300">Tópicos (descrição, time, datas, trava)</span>
                <button
                  type="button"
                  onClick={adicionarTopico}
                  className="rounded-md border border-stone-600 bg-stone-700 px-2 py-1 text-xs text-stone-200 hover:bg-stone-600"
                >
                  + Adicionar tópico
                </button>
              </div>
              <ul className="mt-2 space-y-3">
                {topicos.map((t, idx) => (
                  <li
                    key={idx}
                    className="rounded-lg border border-stone-600 bg-stone-900/80 p-3"
                  >
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                      <div className="sm:col-span-2">
                        <input
                          type="text"
                          value={t.descricao}
                          onChange={(e) => atualizarTopico(idx, 'descricao', e.target.value)}
                          placeholder="Descrição do tópico"
                          className="w-full rounded-md border border-stone-600 bg-stone-800 px-2 py-1.5 text-sm text-stone-100"
                          disabled={isPending}
                        />
                      </div>
                      <div>
                        <select
                          value={t.time_responsavel}
                          onChange={(e) => atualizarTopico(idx, 'time_responsavel', e.target.value)}
                          className="w-full rounded-md border border-stone-600 bg-stone-800 px-2 py-1.5 text-sm text-stone-100"
                          disabled={isPending}
                        >
                          <option value="">Time</option>
                          {times.map((time) => (
                            <option key={time} value={time}>
                              {time}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="date"
                          value={t.data_inicio ?? ''}
                          onChange={(e) => atualizarTopico(idx, 'data_inicio', e.target.value)}
                          className="rounded-md border border-stone-600 bg-stone-800 px-2 py-1.5 text-sm text-stone-100"
                          disabled={isPending}
                        />
                        <input
                          type="date"
                          value={t.data_fim ?? ''}
                          onChange={(e) => atualizarTopico(idx, 'data_fim', e.target.value)}
                          className="rounded-md border border-stone-600 bg-stone-800 px-2 py-1.5 text-sm text-stone-100"
                          disabled={isPending}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-1.5 text-xs text-stone-400">
                          <input
                            type="checkbox"
                            checked={t.trava ?? false}
                            onChange={(e) => atualizarTopico(idx, 'trava', e.target.checked)}
                            className="rounded border-stone-500"
                            disabled={isPending}
                          />
                          Trava
                        </label>
                        <button
                          type="button"
                          onClick={() => removerTopico(idx)}
                          className="text-xs text-red-400 hover:text-red-300"
                          disabled={isPending || topicos.length <= 1}
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={handleSalvarTopicos}
                disabled={isPending}
                className="mt-3 rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-stone-900 hover:bg-emerald-400 disabled:opacity-60"
              >
                {isPending ? 'Salvando…' : 'Salvar tópicos e iniciar atendimento'}
              </button>
            </div>
          </section>
        )}

        {chamado.status === 'aguardando_aprovacao_criador' && isCriador && (
          <section className="rounded-xl border-2 border-amber-500/50 bg-amber-500/10 p-4">
            <h2 className="text-sm font-semibold text-amber-200">
              Sua avaliação — O Bombeiro enviou o fechamento
            </h2>
            <p className="mt-1 text-sm text-stone-300">
              Revise as resoluções dos tópicos acima, o parecer, tema e mapeamento abaixo. A resolução
              foi suficiente?
            </p>
            {chamado.parecer_final && (
              <div className="mt-3 rounded bg-stone-800/80 p-2 text-sm text-stone-200">
                <strong>Parecer do Bombeiro:</strong> {chamado.parecer_final}
              </div>
            )}
            {chamado.tema && (
              <p className="mt-1 text-sm text-stone-300">
                <strong>Tema:</strong> {chamado.tema}
              </p>
            )}
            {chamado.mapeamento_pericia && (
              <p className="mt-1 text-sm text-stone-300">
                <strong>Mapeamento de perícia:</strong> {chamado.mapeamento_pericia}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => handleConcluirChamadoCriador(true)}
                disabled={isPending}
                className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-stone-900 hover:bg-emerald-400 disabled:opacity-60"
              >
                {isPending ? 'Salvando…' : 'Sim, aprovar e concluir chamado'}
              </button>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="block text-xs text-stone-400">Não foi suficiente — informe o motivo:</label>
                  <textarea
                    value={motivoInsuficiente}
                    onChange={(e) => setMotivoInsuficiente(e.target.value)}
                    placeholder="Por que a resolução não foi suficiente?"
                    rows={2}
                    className="mt-1 w-80 rounded-md border border-stone-600 bg-stone-800 px-2 py-1.5 text-sm text-stone-100"
                    disabled={isPending}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleConcluirChamadoCriador(false)}
                  disabled={isPending || !motivoInsuficiente.trim()}
                  className="rounded-md border border-red-500/50 bg-red-500/20 px-4 py-2 text-sm font-medium text-red-200 hover:bg-red-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isPending ? 'Enviando…' : 'Não, reabrir chamado'}
                </button>
              </div>
            </div>
          </section>
        )}

        <section className="rounded-xl border border-stone-700 bg-stone-800/80 p-4">
          <h2 className="text-sm font-semibold text-stone-200">
            Fechamento — Tema e mapeamento de perícia
          </h2>
          {podePreencherTemaMapeamento ? (
            <>
              {topicosList.length > 0 && topicosList.every((t) => t.status === 'aprovado') && (
                <div className="mt-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                  Todos os tópicos foram aprovados. Preencha o parecer, tema e mapeamento abaixo e
                  clique em &quot;Salvar fechamento&quot; para enviar ao criador do chamado.
                </div>
              )}
              <p className="mt-2 text-sm text-stone-300">
                Preenchimento exclusivo do Bombeiro. Use estes campos quando o chamado já passou por
                todos os times e você for registrar o parecer final.
              </p>

              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <label className="block text-xs font-medium text-stone-300">
                    Parecer final
                    <textarea
                      value={fechamentoParecer}
                      onChange={(e) => setFechamentoParecer(e.target.value)}
                      rows={3}
                      className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-2 py-1 text-sm text-stone-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      placeholder="Resumo final da atuação e aprendizados."
                      disabled={isPending}
                    />
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-300">
                    Tema
                    <input
                      type="text"
                      value={fechamentoTema}
                      onChange={(e) => setFechamentoTema(e.target.value)}
                      className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-2 py-1 text-sm text-stone-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      placeholder="Tema principal (ex.: Comunicação, Processo, Sistema etc.)"
                      disabled={isPending}
                    />
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-300">
                    Mapeamento de perícia
                    <textarea
                      value={fechamentoMapeamento}
                      onChange={(e) => setFechamentoMapeamento(e.target.value)}
                      rows={3}
                      className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-2 py-1 text-sm text-stone-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      placeholder="Descreva como este caso se conecta ao mapa de perícias."
                      disabled={isPending}
                    />
                  </label>
                </div>

                <button
                  type="button"
                  onClick={handleFecharChamado}
                  disabled={isPending}
                  className="mt-1 rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold text-stone-900 hover:bg-emerald-400 disabled:opacity-60"
                >
                  {isPending ? 'Salvando…' : 'Salvar fechamento'}
                </button>
              </div>
            </>
          ) : (
            <p className="mt-1 text-sm italic text-stone-500">
              {chamado.tipo === 'hdm' && chamado.resolucao_suficiente !== true
                ? 'Em chamados HDM, o Bombeiro preenche tema e mapeamento após o criador aprovar a resolução.'
                : 'Apenas o Bombeiro pode preencher tema e mapeamento de perícia.'}
            </p>
          )}
          {chamado.parecer_final && (
            <div className="mt-3 rounded bg-stone-700/80 p-2 text-sm text-stone-200">
              <strong>Parecer salvo:</strong> {chamado.parecer_final}
            </div>
          )}
          {chamado.tema && (
            <p className="mt-1 text-sm text-stone-300">
              <strong>Tema salvo:</strong> {chamado.tema}
            </p>
          )}
          {chamado.mapeamento_pericia && (
            <p className="mt-1 text-sm text-stone-300">
              <strong>Mapeamento salvo:</strong> {chamado.mapeamento_pericia}
            </p>
          )}
        </section>

        {periciaChamado && (
          <section className="rounded-xl border border-emerald-800/50 bg-emerald-900/20 p-4">
            <h2 className="text-sm font-semibold text-emerald-200">Perícia vinculada</h2>
            <p className="mt-1 text-sm text-stone-300">
              Dados preenchidos pelo Time de Caneta Verde a partir do planejamento.
            </p>
            <dl className="mt-3 space-y-1 text-sm">
              <div>
                <dt className="text-stone-500">Nome da perícia</dt>
                <dd className="font-medium text-stone-200">{periciaChamado.nome_pericia}</dd>
              </div>
              {periciaChamado.time_responsavel && (
                <div>
                  <dt className="text-stone-500">Time responsável</dt>
                  <dd className="text-stone-200">{periciaChamado.time_responsavel}</dd>
                </div>
              )}
              {periciaChamado.responsavel_nome && (
                <div>
                  <dt className="text-stone-500">Responsável</dt>
                  <dd className="text-stone-200">{periciaChamado.responsavel_nome}</dd>
                </div>
              )}
              {periciaChamado.data_inicio && (
                <div>
                  <dt className="text-stone-500">Início planejado</dt>
                  <dd className="text-stone-200">{periciaChamado.data_inicio}</dd>
                </div>
              )}
              <div>
                <dt className="text-stone-500">Status da perícia</dt>
                <dd className="text-stone-200">{periciaChamado.status}</dd>
              </div>
            </dl>
          </section>
        )}

        <section className="rounded-xl border border-stone-700 bg-stone-800/80 p-4">
          <h2 className="text-sm font-semibold text-stone-200">Comentários</h2>
          <p className="mt-1 text-xs text-stone-400">
            Use @nome para mencionar alguém (criador, Bombeiro ou times do chamado). Quem for
            mencionado receberá notificação.
          </p>
          <ul className="mt-3 space-y-2 max-h-60 overflow-y-auto">
            {mensagensList.length === 0 ? (
              <li className="text-sm text-stone-500">Nenhum comentário ainda.</li>
            ) : (
              mensagensList.map((m) => (
                <li key={m.id} className="rounded-lg bg-stone-900/80 p-2 text-sm">
                  <span className="font-medium text-stone-300">
                    {m.autor_nome ?? 'Sistema'}
                    {m.autor_time && (
                      <span className="ml-1 text-xs text-stone-500">({m.autor_time})</span>
                    )}
                  </span>
                  <span className="ml-2 text-xs text-stone-500">
                    {new Date(m.created_at).toLocaleString('pt-BR')}
                  </span>
                  <p className="mt-0.5 whitespace-pre-wrap text-stone-200">{m.texto}</p>
                </li>
              ))
            )}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <textarea
              value={novoComentario}
              onChange={(e) => setNovoComentario(e.target.value)}
              placeholder="Escreva um comentário… Use @nome para mencionar."
              rows={2}
              className="min-w-[200px] flex-1 rounded-md border border-stone-600 bg-stone-800 px-2 py-1.5 text-sm text-stone-100"
              disabled={comentarioPending}
            />
            <button
              type="button"
              onClick={handleEnviarComentario}
              disabled={comentarioPending || !novoComentario.trim()}
              className="rounded-md bg-stone-600 px-4 py-2 text-sm font-medium text-stone-200 hover:bg-stone-500 disabled:opacity-50"
            >
              {comentarioPending ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
          {participantes.length > 0 && (
            <p className="mt-1 text-xs text-stone-500">
              Pode mencionar: {participantes.map((p) => p.nome).join(', ')}
            </p>
          )}
        </section>

        {(mensagem || erro) && (
          <div className="text-xs">
            {mensagem && <p className="text-emerald-400">{mensagem}</p>}
            {erro && <p className="text-red-400">{erro}</p>}
          </div>
        )}
      </div>

      {modalRedirecionar && (
        <ModalRedirecionarHDM
          chamadoId={chamado.id}
          onClose={() => setModalRedirecionar(false)}
          onSuccess={() => window.location.reload()}
        />
      )}
    </>
  );
}
