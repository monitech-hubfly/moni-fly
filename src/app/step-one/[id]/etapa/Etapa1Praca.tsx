'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { saveEtapa1Praca, type AnexoEtapa1 } from './actions';
import { createClient } from '@/lib/supabase/client';
import { ProspeccaoCidadePDFContent } from './ProspeccaoCidadePDFContent';

const MapaPraca = dynamic(() => import('./MapaPraca').then((m) => m.MapaPraca), { ssr: false });

const BUCKET = 'processo-docs';
const ACCEPT_IMAGES = 'image/jpeg,image/png,image/webp';

type DadosCidade = {
  populacao: string | null;
  pibPerCapita: string | null;
  rendaMedia: string | null;
  areaTerritorial: string | null;
  densidade: string | null;
};

export function Etapa1Praca(props: {
  processoId: string;
  cidade: string;
  estado: string | null;
  initialObservacoes: string;
  initialAnexos: AnexoEtapa1[];
  pdfUrlEtapa1: string | null;
}) {
  const { processoId, cidade, estado, initialObservacoes, initialAnexos, pdfUrlEtapa1 } = props;
  const [observacoes, setObservacoes] = useState(initialObservacoes);
  const [anexos, setAnexos] = useState<AnexoEtapa1[]>(initialAnexos);
  const [dadosCidade, setDadosCidade] = useState<DadosCidade | null>(null);
  const [loadingDados, setLoadingDados] = useState(true);
  const [errorDados, setErrorDados] = useState('');
  const [savingObs, setSavingObs] = useState(false);
  const [savedObs, setSavedObs] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!cidade.trim()) {
      setLoadingDados(false);
      return;
    }
    setLoadingDados(true);
    setErrorDados('');
    const params = new URLSearchParams({ cidade: cidade.trim() });
    if (estado?.trim()) params.set('estado', estado.trim());
    fetch(`/api/etapa1/dados-cidade?${params.toString()}`)
      .then((res) => res.json())
      .then((data: DadosCidade & { error?: string }) => {
        if (data.error) {
          setErrorDados(data.error);
          setDadosCidade(null);
        } else {
          setDadosCidade({
            populacao: data.populacao ?? null,
            pibPerCapita: data.pibPerCapita ?? null,
            rendaMedia: data.rendaMedia ?? null,
            areaTerritorial: data.areaTerritorial ?? null,
            densidade: data.densidade ?? null,
          });
        }
      })
      .catch(() => {
        setErrorDados('Erro ao carregar dados da cidade.');
        setDadosCidade(null);
      })
      .finally(() => setLoadingDados(false));
  }, [cidade, estado]);

  const handleSalvarObservacoes = async () => {
    setSavingObs(true);
    const result = await saveEtapa1Praca(processoId, { observacoes_praca: observacoes || null });
    setSavingObs(false);
    if (result.ok) {
      setSavedObs(true);
      setTimeout(() => setSavedObs(false), 3000);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploadingFile(true);
    const supabase = createClient();
    const newAnexos: AnexoEtapa1[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;
      const path = `${processoId}/etapa1/${crypto.randomUUID()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: '3600', upsert: false });
      if (error) continue;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      newAnexos.push({ url: data.publicUrl, nome: file.name });
    }
    if (newAnexos.length > 0) {
      const next = [...anexos, ...newAnexos];
      setAnexos(next);
      await saveEtapa1Praca(processoId, { anexos_etapa1: next });
    }
    setUploadingFile(false);
    e.target.value = '';
  };

  const handleRemoverAnexo = async (index: number) => {
    const next = anexos.filter((_, i) => i !== index);
    setAnexos(next);
    await saveEtapa1Praca(processoId, { anexos_etapa1: next });
  };

  const handleGerarPdf = () => setGerandoPdf(true);

  useEffect(() => {
    if (!gerandoPdf || !pdfRef.current) return;
    const el = pdfRef.current;
    const run = async () => {
      try {
        const html2pdf = (await import('html2pdf.js')).default;
        const blob = await html2pdf()
          .set({
            margin: 10,
            filename: 'prospeccao-cidade.pdf',
            image: { type: 'jpeg', quality: 0.92 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          })
          .from(el)
          .outputPdf('blob');
        const supabase = createClient();
        const path = `${processoId}/etapa1-prospeccao.pdf`;
        const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
          contentType: 'application/pdf',
          upsert: true,
        });
        if (uploadErr) {
          alert('Erro ao enviar o PDF: ' + uploadErr.message);
        } else {
          const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
          const result = await saveEtapa1Praca(processoId, { pdf_url_etapa1: urlData.publicUrl });
          if (result.ok) window.location.reload();
          else alert(result.error);
        }
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Erro ao gerar o PDF.');
      } finally {
        setGerandoPdf(false);
      }
    };
    const t = setTimeout(run, 400);
    return () => clearTimeout(t);
  }, [gerandoPdf, processoId]);

  return (
    <div className="mt-6 space-y-8">
      <p className="text-sm text-stone-600">
        Praça:{' '}
        <strong>
          {cidade}
          {estado ? `, ${estado}` : ''}
        </strong>
      </p>

      {/* Seção 1 — Dados da cidade */}
      <section className="rounded-xl border border-stone-200 bg-stone-50/80 p-4">
        <h2 className="text-lg font-semibold text-stone-800">Seção 1 — Dados da cidade</h2>
        {errorDados && <p className="mt-3 text-sm text-red-600">{errorDados}</p>}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
            <p className="text-xs font-medium uppercase text-stone-500">População</p>
            <p className="mt-1 text-xl font-semibold text-stone-800">
              {loadingDados
                ? 'Carregando...'
                : dadosCidade?.populacao?.trim() || 'Dado não disponível'}
            </p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
            <p className="text-xs font-medium uppercase text-stone-500">PIB per capita</p>
            <p className="mt-1 text-xl font-semibold text-stone-800">
              {loadingDados
                ? 'Carregando...'
                : dadosCidade?.pibPerCapita?.trim() || 'Dado não disponível'}
            </p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
            <p className="text-xs font-medium uppercase text-stone-500">Renda média domiciliar</p>
            <p className="mt-1 text-xl font-semibold text-stone-800">
              {loadingDados
                ? 'Carregando...'
                : dadosCidade?.rendaMedia?.trim() || 'Dado não disponível'}
            </p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
            <p className="text-xs font-medium uppercase text-stone-500">Área territorial</p>
            <p className="mt-1 text-xl font-semibold text-stone-800">
              {loadingDados
                ? 'Carregando...'
                : dadosCidade?.areaTerritorial?.trim() || 'Dado não disponível'}
            </p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
            <p className="text-xs font-medium uppercase text-stone-500">Densidade demográfica</p>
            <p className="mt-1 text-xl font-semibold text-stone-800">
              {loadingDados
                ? 'Carregando...'
                : dadosCidade?.densidade?.trim() || 'Dado não disponível'}
            </p>
          </div>
        </div>
      </section>

      {/* Seção 2 — Mapa interativo */}
      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-stone-800">Seção 2 — Mapa interativo</h2>
        <p className="mt-1 text-sm text-stone-500">
          OpenStreetMap + Leaflet + Overpass: escolas, hospitais, UBS, shoppings, supermercados,
          parques, praças, bancos, farmácias.
        </p>
        <div className="mt-4">
          <MapaPraca cidade={cidade} estado={estado} />
        </div>
      </section>

      {/* Seção 3 — Observações e anexos */}
      <section className="rounded-xl border border-stone-200 bg-stone-50/80 p-4">
        <h2 className="text-lg font-semibold text-stone-800">Seção 3 — Observações</h2>
        <p className="mt-1 text-sm text-stone-500">
          Campo livre para o Frank registrar observações sobre a praça. Você pode importar imagens
          (JPG, PNG, WebP); texto e imagens compõem o PDF de prospecção.
        </p>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={5}
          className="mt-3 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          placeholder="Observações sobre a praça…"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSalvarObservacoes}
            disabled={savingObs}
            className="btn-primary text-sm"
          >
            {savingObs ? 'Salvando…' : 'Salvar observações'}
          </button>
          {savedObs && <span className="text-sm text-green-600">Salvo.</span>}
        </div>

        <div className="mt-6 border-t border-stone-200 pt-4">
          <p className="mb-2 text-sm font-medium text-stone-700">Anexos (imagens para o PDF)</p>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_IMAGES}
            multiple
            onChange={handleFileSelect}
            disabled={uploadingFile}
            className="block w-full text-sm text-stone-600 file:mr-2 file:rounded-lg file:border-0 file:bg-moni-light file:px-3 file:py-1.5 file:font-medium file:text-moni-accent"
          />
          {uploadingFile && <p className="mt-1 text-sm text-stone-500">Enviando…</p>}
          {anexos.length > 0 && (
            <ul className="mt-3 space-y-1">
              {anexos.map((a, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded border border-stone-200 bg-white px-3 py-2 text-sm"
                >
                  <span className="truncate">{a.nome}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoverAnexo(i)}
                    className="ml-2 shrink-0 text-red-600 hover:underline"
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6 border-t border-stone-200 pt-4">
          <p className="mb-2 text-sm font-medium text-stone-700">PDF de prospecção cidade</p>
          {pdfUrlEtapa1 ? (
            <p className="text-sm">
              <a
                href={pdfUrlEtapa1}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-moni-accent hover:underline"
              >
                Baixar PDF armazenado
              </a>
            </p>
          ) : null}
          <button
            type="button"
            onClick={handleGerarPdf}
            disabled={gerandoPdf}
            className="btn-primary mt-2 text-sm"
          >
            {gerandoPdf ? 'Gerando PDF…' : 'Gerar e guardar PDF'}
          </button>
        </div>

        {gerandoPdf && (
          <div className="fixed inset-0 z-[9999] overflow-auto bg-white p-4" aria-hidden>
            <div ref={pdfRef} style={{ width: '210mm' }} className="bg-white">
              <ProspeccaoCidadePDFContent
                titulo={cidade.trim() || 'Cidade'}
                texto={observacoes}
                imagens={anexos.map((a) => a.url)}
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
