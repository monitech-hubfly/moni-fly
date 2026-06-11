'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getRedeEmpresaDocSlotValues,
  getRedeEmpresaDocSlots,
  REDE_EMPRESAS_SUBSECOES,
  type RedeEmpresaDocsRow,
} from '@/lib/rede-documentos-empresas';
import {
  getRedeDocFranqueadoSlotValues,
  REDE_DOCS_FRANQUEADO_SLOTS,
  type RedeFranqueadoDocsRow,
} from '@/lib/rede-documentos-franqueado';
import {
  isRedeDocSlotCompleto,
  REDE_DOCS_FRANQUIA_SLOTS,
  REDE_SECAO_DOCS_EMPRESAS,
  REDE_SECAO_DOCS_FRANQUEADO,
  REDE_SECAO_DOCS_FRANQUIA,
} from '@/lib/rede-documentos-franquia';
import {
  getSignedUrlRedeAnexo,
  prepararSchemaAnexoNumeroFranquia,
  salvarJustificativaRedeAnexo,
  uploadRedeFranqueadoAssinado,
} from '../actions';
import { RedeDocsSecaoColapsavel, RedeDocsSubsecaoColapsavel } from './rede-docs-secao-colapsavel';
import type { FranqueadoSpeRow } from '@/lib/franqueado-spe';
import { RedeFranqueadoSpeSection } from './RedeFranqueadoSpeSection';

function nomeDoPath(path: string) {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] || path;
}

type DocCardConfig = {
  tipo: string;
  titulo: string;
  path: string | null;
  justificativa: string | null;
  permiteJustificativa: boolean;
  contaPendencia: boolean;
};

type Props = {
  redeId: string;
  pathCof: string | null;
  pathContrato: string | null;
  pathNumeroFranquia: string | null;
  justificativaCof: string | null;
  justificativaContrato: string | null;
  justificativaNumeroFranquia: string | null;
  franqueadoDocs: RedeFranqueadoDocsRow;
  empresaDocs: RedeEmpresaDocsRow;
  spes?: FranqueadoSpeRow[];
};

function DocUploadCard({
  config,
  redeId,
  uploading,
  onUpload,
  onDownload,
  onJustificativaSaved,
}: {
  config: DocCardConfig;
  redeId: string;
  uploading: string | null;
  onUpload: (tipo: string, e: React.ChangeEvent<HTMLInputElement>) => void;
  onDownload: (path: string) => void;
  onJustificativaSaved: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { tipo, titulo, path, justificativa, permiteJustificativa, contaPendencia } = config;
  const [saving, setSaving] = useState(false);
  const busy = uploading !== null || saving;
  const sending = uploading === tipo;
  const completo =
    !contaPendencia || isRedeDocSlotCompleto(path, permiteJustificativa ? justificativa : null);
  const [textoJustificativa, setTextoJustificativa] = useState(justificativa ?? '');
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  useEffect(() => {
    setTextoJustificativa(justificativa ?? '');
  }, [justificativa]);

  async function salvarJustificativa() {
    setErroLocal(null);
    setSaving(true);
    const fd = new FormData();
    fd.set('tipo', tipo);
    fd.set('redeId', redeId);
    fd.set('justificativa', textoJustificativa);
    const r = await salvarJustificativaRedeAnexo(fd);
    setSaving(false);
    if (!r.ok) {
      setErroLocal(r.error);
      return;
    }
    onJustificativaSaved();
  }

  const borderClass = completo ? 'border-stone-200 bg-white' : 'border-amber-200 bg-amber-50/40';

  return (
    <div className={`rounded-xl border p-4 shadow-sm ${borderClass}`}>
      <h3 className="text-sm font-semibold text-stone-800">{titulo}</h3>
      {contaPendencia && !completo ? (
        <p className="mt-1 text-[11px] text-amber-800">
          {permiteJustificativa
            ? 'Pendente: envie o arquivo ou registre uma justificativa (conta como cadastro incompleto no dashboard).'
            : 'Pendente: envie o arquivo (conta como cadastro incompleto no dashboard).'}
        </p>
      ) : null}
      {!contaPendencia ? (
        <p className="mt-1 text-[11px] text-stone-500">Opcional — envie o anexo se aplicável à atividade.</p>
      ) : null}
      {path ? (
        <p className="mt-2 truncate text-xs text-stone-600" title={path}>
          {nomeDoPath(path)}
        </p>
      ) : justificativa ? (
        <div className="mt-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-stone-500">Justificativa registrada</p>
          <p className="mt-1 whitespace-pre-wrap text-xs text-stone-700">{justificativa}</p>
        </div>
      ) : (
        <p className="mt-2 text-xs text-stone-500">Nenhum arquivo cadastrado.</p>
      )}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(ev) => void onUpload(tipo, ev)}
      />
      <div className="mt-3 flex items-stretch gap-2">
        {path ? (
          <button
            type="button"
            onClick={() => void onDownload(path)}
            className="inline-flex min-h-[2.25rem] shrink-0 items-center justify-center rounded-lg border border-stone-300 bg-stone-50 px-4 py-1.5 text-xs font-medium text-stone-800 hover:bg-stone-100"
          >
            Baixar
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className={`inline-flex min-h-[2.25rem] items-center justify-center rounded-lg bg-moni-primary px-4 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 ${
            path ? 'min-w-0 flex-1' : 'w-full'
          }`}
        >
          {sending ? 'Enviando…' : path ? 'Substituir arquivo' : 'Enviar arquivo'}
        </button>
      </div>
      <p className="mt-1 text-[10px] text-stone-400">Até 10 MB · qualquer tipo</p>

      {permiteJustificativa && !path ? (
        <div className="mt-4 border-t border-stone-200/80 pt-3">
          <label className="block text-[11px] font-medium text-stone-600" htmlFor={`just-${tipo}`}>
            Justificativa (sem anexo)
          </label>
          <textarea
            id={`just-${tipo}`}
            rows={3}
            value={textoJustificativa}
            onChange={(e) => setTextoJustificativa(e.target.value)}
            placeholder="Ex.: aguardando assinatura do franqueado…"
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-xs text-stone-800"
            disabled={busy}
          />
          {erroLocal ? <p className="mt-1 text-xs text-red-600">{erroLocal}</p> : null}
          <button
            type="button"
            disabled={busy || !textoJustificativa.trim()}
            onClick={() => void salvarJustificativa()}
            className="mt-2 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-800 hover:bg-stone-50 disabled:opacity-50"
          >
            {saving ? 'Salvando…' : 'Salvar justificativa'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function RedeFranqueadoDetalheDocs({
  redeId,
  pathCof,
  pathContrato,
  pathNumeroFranquia,
  justificativaCof,
  justificativaContrato,
  justificativaNumeroFranquia,
  franqueadoDocs,
  empresaDocs,
  spes = [],
}: Props) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [up, setUp] = useState<string | null>(null);
  const [abrirSecaoEmpresas, setAbrirSecaoEmpresas] = useState(false);

  useEffect(() => {
    void prepararSchemaAnexoNumeroFranquia();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash !== '#empresas') return;
    setAbrirSecaoEmpresas(true);
    const t = window.setTimeout(() => {
      document.getElementById('empresas')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
    return () => window.clearTimeout(t);
  }, []);

  const cardsFranqueado: DocCardConfig[] = REDE_DOCS_FRANQUEADO_SLOTS.map((slot) => {
    const { path, justificativa } = getRedeDocFranqueadoSlotValues(franqueadoDocs, slot);
    return {
      tipo: slot.tipo,
      titulo: slot.titulo,
      path,
      justificativa,
      permiteJustificativa: slot.justificativaKey !== null,
      contaPendencia: true,
    };
  });

  const cardsFranquia: DocCardConfig[] = REDE_DOCS_FRANQUIA_SLOTS.map((slot) => {
    const paths = {
      cof: pathCof,
      contrato: pathContrato,
      numero_franquia: pathNumeroFranquia,
    };
    const justs = {
      cof: justificativaCof,
      contrato: justificativaContrato,
      numero_franquia: justificativaNumeroFranquia,
    };
    return {
      tipo: slot.tipo,
      titulo: slot.titulo,
      path: paths[slot.tipo],
      justificativa: justs[slot.tipo],
      permiteJustificativa: true,
      contaPendencia: true,
    };
  });

  function empresaCards(subsecao: (typeof REDE_EMPRESAS_SUBSECOES)[number]['id']): DocCardConfig[] {
    return getRedeEmpresaDocSlots(subsecao).map((slot) => {
      const { path, justificativa } = getRedeEmpresaDocSlotValues(empresaDocs, slot);
      return {
        tipo: slot.tipo,
        titulo: slot.titulo,
        path,
        justificativa,
        permiteJustificativa: slot.justificativaKey !== null,
        contaPendencia: slot.obrigatorioParaCadastroCompleto,
      };
    });
  }

  async function download(path: string) {
    setMsg(null);
    const r = await getSignedUrlRedeAnexo(path);
    if (!r.ok) {
      setMsg({ tipo: 'erro', texto: r.error });
      return;
    }
    const a = document.createElement('a');
    a.href = r.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function onFile(tipo: string, e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setUp(tipo);
    setMsg(null);
    const fd = new FormData();
    fd.set('tipo', tipo);
    fd.set('redeId', redeId);
    fd.set('file', f);
    const r = await uploadRedeFranqueadoAssinado(fd);
    setUp(null);
    if (!r.ok) {
      setMsg({ tipo: 'erro', texto: r.error });
      return;
    }
    setMsg({ tipo: 'ok', texto: 'Arquivo enviado com sucesso.' });
    router.refresh();
  }

  const cardProps = {
    redeId,
    uploading: up,
    onUpload: onFile,
    onDownload: download,
    onJustificativaSaved: () => {
      setMsg({ tipo: 'ok', texto: 'Justificativa registrada.' });
      router.refresh();
    },
  };

  return (
    <div className="space-y-6">
      {msg ? (
        <div
          className={`rounded-lg border p-3 text-sm ${
            msg.tipo === 'ok' ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {msg.texto}
        </div>
      ) : null}

      <RedeDocsSecaoColapsavel
        titulo={REDE_SECAO_DOCS_FRANQUEADO.titulo}
        sectionId={REDE_SECAO_DOCS_FRANQUEADO.id}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cardsFranqueado.map((config) => (
            <DocUploadCard key={config.tipo} config={config} {...cardProps} />
          ))}
        </div>
      </RedeDocsSecaoColapsavel>

      <RedeDocsSecaoColapsavel titulo={REDE_SECAO_DOCS_FRANQUIA.titulo} sectionId={REDE_SECAO_DOCS_FRANQUIA.id}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cardsFranquia.map((config) => (
            <DocUploadCard key={config.tipo} config={config} {...cardProps} />
          ))}
        </div>
      </RedeDocsSecaoColapsavel>

      <div id="empresas" className="scroll-mt-24">
        <RedeDocsSecaoColapsavel
          titulo={REDE_SECAO_DOCS_EMPRESAS.titulo}
          sectionId={REDE_SECAO_DOCS_EMPRESAS.id}
          defaultOpen={abrirSecaoEmpresas}
        >
        <div className="space-y-4">
          {REDE_EMPRESAS_SUBSECOES.map((sub) => (
            <RedeDocsSubsecaoColapsavel key={sub.id} titulo={sub.titulo} sectionId={`empresas-${sub.id}`}>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {empresaCards(sub.id).map((config) => (
                  <DocUploadCard key={config.tipo} config={config} {...cardProps} />
                ))}
              </div>
            </RedeDocsSubsecaoColapsavel>
          ))}
          <RedeFranqueadoSpeSection redeId={redeId} spes={spes} />
        </div>
        </RedeDocsSecaoColapsavel>
      </div>
    </div>
  );
}
