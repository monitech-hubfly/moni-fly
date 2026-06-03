'use client';

import { useCallback, useEffect, useState } from 'react';
import { Copy, ExternalLink, Loader2, Check, FileText } from 'lucide-react';
import { ChecklistLegalFormWizard } from '@/components/checklist-legal/ChecklistLegalFormWizard';
import { computeChecklistLegalProgresso } from '@/lib/checklist-legal/compute-completo';
import {
  concluirChecklistLegalCondominio,
  getChecklistLegalForKanbanCard,
  getOrCreateChecklistLegalPublicLink,
  saveChecklistLegalCondominioDraft,
} from '@/lib/actions/checklist-legal-condominio';
import {
  EMPTY_CHECKLIST_LEGAL_ARQUIVOS,
  EMPTY_CHECKLIST_LEGAL_RESPOSTAS,
  type ChecklistLegalArquivos,
  type ChecklistLegalFileMeta,
  type ChecklistLegalRespostas,
} from '@/lib/checklist-legal/types';

type Props = {
  cardId: string;
  basePath?: string;
  condominioId?: string | null;
  modoCompacto?: boolean;
  exibirLinkPublico?: boolean;
};

export function ChecklistLegalCondominioCard({
  cardId,
  basePath = '/',
  condominioId,
  modoCompacto = false,
  exibirLinkPublico = true,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [respostas, setRespostas] = useState<ChecklistLegalRespostas>(EMPTY_CHECKLIST_LEGAL_RESPOSTAS);
  const [arquivos, setArquivos] = useState<ChecklistLegalArquivos>(EMPTY_CHECKLIST_LEGAL_ARQUIVOS);
  const [status, setStatus] = useState<'ausente' | 'rascunho' | 'concluido' | 'revisao'>('ausente');
  const [erro, setErro] = useState<string | null>(null);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [gerandoLink, setGerandoLink] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(!modoCompacto);
  const [condominioIdResolvido, setCondominioIdResolvido] = useState<string | null>(
    condominioId?.trim() ? condominioId.trim() : null,
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setErro(null);
    const r = await getChecklistLegalForKanbanCard(cardId);
    if (!r.ok) {
      setErro(r.error);
      setLoading(false);
      return;
    }
    const cid =
      r.condominioId?.trim() ||
      condominioId?.trim() ||
      null;
    setCondominioIdResolvido(cid);
    if (!cid) {
      setStatus('ausente');
      setLoading(false);
      return;
    }
    if (r.record) {
      setRespostas({ ...EMPTY_CHECKLIST_LEGAL_RESPOSTAS, ...r.record.respostas_json });
      setArquivos({ ...EMPTY_CHECKLIST_LEGAL_ARQUIVOS, ...r.record.arquivos_json });
      if (r.record.status === 'concluido') setStatus('concluido');
      else if (r.hasOwnDraft) setStatus('rascunho');
      else if (r.canonical) setStatus('revisao');
      else setStatus('rascunho');
    } else {
      setRespostas(EMPTY_CHECKLIST_LEGAL_RESPOSTAS);
      setArquivos(EMPTY_CHECKLIST_LEGAL_ARQUIVOS);
      setStatus(r.canonical ? 'revisao' : 'ausente');
    }
    setLoading(false);
  }, [cardId, condominioId]);

  useEffect(() => {
    if (condominioId?.trim()) setCondominioIdResolvido(condominioId.trim());
  }, [condominioId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const progresso = computeChecklistLegalProgresso(respostas, arquivos);

  async function uploadFiles(fieldKey: string, files: File[]): Promise<ChecklistLegalFileMeta[]> {
    const fd = new FormData();
    fd.set('cardId', cardId);
    fd.set('fieldKey', fieldKey);
    for (const f of files) fd.append('files', f);
    const res = await fetch('/api/checklist-legal-condominio/upload', { method: 'POST', body: fd });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; files?: ChecklistLegalFileMeta[] };
    if (!res.ok || !json?.ok || !json.files?.length) {
      throw new Error(json?.error ?? 'Falha no upload.');
    }
    return json.files;
  }

  async function salvarDraft() {
    const r = await saveChecklistLegalCondominioDraft({
      cardId,
      respostas_json: respostas,
      arquivos_json: arquivos,
      basePath,
    });
    if (!r.ok) throw new Error(r.error);
    await reload();
  }

  async function concluir() {
    const r = await concluirChecklistLegalCondominio({
      cardId,
      respostas_json: respostas,
      arquivos_json: arquivos,
      basePath,
    });
    if (!r.ok) throw new Error(r.error);
    await reload();
  }

  async function gerarLink() {
    setGerandoLink(true);
    const r = await getOrCreateChecklistLegalPublicLink(cardId);
    setGerandoLink(false);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    setPublicUrl(r.url);
  }

  async function copiarLink() {
    let url = publicUrl;
    if (!url) {
      setGerandoLink(true);
      const r = await getOrCreateChecklistLegalPublicLink(cardId);
      setGerandoLink(false);
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      url = r.url;
      setPublicUrl(url);
    }
    await navigator.clipboard.writeText(url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-stone-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando Checklist Legal…
      </div>
    );
  }

  if (!condominioIdResolvido && status === 'ausente' && !respostas.cadastro_condominio) {
    return (
      <p className="text-xs text-stone-500">
        Vincule um condomínio ao card para habilitar o Checklist Legal.
      </p>
    );
  }

  const statusLabel =
    status === 'concluido'
      ? 'Concluído'
      : status === 'revisao'
        ? 'Revisar versão anterior'
        : status === 'rascunho'
          ? 'Rascunho'
          : 'Não iniciado';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-800">
            <FileText className="h-4 w-4 text-moni-primary" />
            Checklist Legal
          </p>
          <p className="text-xs text-stone-500">
            {statusLabel} · {progresso.preenchidos}/{progresso.total} obrigatórios
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {modoCompacto ? (
            <button
              type="button"
              onClick={() => setDrawerOpen((v) => !v)}
              className="rounded border border-stone-300 bg-white px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-50"
            >
              {drawerOpen ? 'Recolher' : 'Preencher / revisar'}
            </button>
          ) : null}
          {exibirLinkPublico ? (
            <>
              <button
                type="button"
                disabled={gerandoLink}
                onClick={() => void copiarLink()}
                className="inline-flex items-center gap-1 rounded border border-stone-300 bg-white px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
              >
                {copiado ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copiado ? 'Copiado' : 'Copiar link público'}
              </button>
              {publicUrl ? (
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded border border-stone-300 bg-white px-2 py-1 text-[11px] font-medium text-moni-primary hover:bg-stone-50"
                >
                  <ExternalLink className="h-3 w-3" /> Abrir
                </a>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {status === 'revisao' ? (
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Este condomínio já possui checklist concluído. Revise, edite se necessário e conclua novamente para registrar
          uma nova versão.
        </p>
      ) : null}

      {erro ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</div> : null}

      {drawerOpen ? (
        <ChecklistLegalFormWizard
          respostas={respostas}
          arquivos={arquivos}
          onChangeRespostas={setRespostas}
          onChangeArquivos={setArquivos}
          onSaveDraft={salvarDraft}
          onConcluir={concluir}
          onUploadFiles={uploadFiles}
          compact={modoCompacto}
        />
      ) : null}
    </div>
  );
}
