'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, FileSpreadsheet, Loader2, ExternalLink, Upload, RefreshCw } from 'lucide-react';
import { atualizarRedeFranqueadosCSV, importarRedeFranqueadosCSV } from './actions';
import {
  redeAlertError,
  redeAlertSuccess,
  redeBtnGhost,
  redeBtnPrimary,
  redePanel,
} from './rede-ui';

const PLANILHA_URL =
  'https://docs.google.com/spreadsheets/d/1ksBuiPbUm_OWh-S6w4j1kWxaI7SG2Q0YlsV3zHxCkuQ/edit?gid=1330850735#gid=1330850735';

type ModoImport = 'inserir' | 'atualizar';

export function ImportarRedeCSVButton() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const modoRef = useRef<ModoImport>('inserir');
  const [loadingModo, setLoadingModo] = useState<ModoImport | null>(null);
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  const abrirArquivo = (modo: ModoImport) => {
    modoRef.current = modo;
    fileRef.current?.click();
  };

  const importFile = async (file: File) => {
    setMensagem(null);
    const modo = modoRef.current;
    setLoadingModo(modo);
    try {
      const text = await file.text();
      const result =
        modo === 'atualizar'
          ? await atualizarRedeFranqueadosCSV(text)
          : await importarRedeFranqueadosCSV(text);
      if (result.ok) {
        setMensagem({ tipo: 'sucesso', texto: result.mensagem });
        router.refresh();
      } else {
        setMensagem({ tipo: 'erro', texto: result.error });
      }
    } finally {
      setLoadingModo(null);
    }
  };

  return (
    <div className={redePanel}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-stone-800">
          <FileSpreadsheet className="h-4 w-4 text-stone-500" aria-hidden />
          Importar CSV
        </div>
        <a
          href={PLANILHA_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-stone-600 hover:text-[#0c2633] hover:underline"
        >
          Abrir planilha
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <p className="mb-2 text-xs leading-relaxed text-stone-600">
        Exporte no Google Sheets (CSV). Use os cabeçalhos da tabela ou o{' '}
        <a className="text-[#0c2633] hover:underline" href="/templates/rede-franqueados-template.csv">
          template
        </a>
        . <strong>Importar</strong> cria linhas e cards; <strong>Atualizar</strong> localiza pelo Nº de Franquia
        (células vazias não apagam dados).
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <a href="/templates/rede-franqueados-template.csv" download className={redeBtnGhost}>
          <Download className="h-4 w-4" />
          Template
        </a>
        <button
          type="button"
          onClick={() => abrirArquivo('inserir')}
          disabled={loadingModo !== null}
          className={redeBtnPrimary}
        >
          {loadingModo === 'inserir' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Importando…
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Importar (novas + cards)
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => abrirArquivo('atualizar')}
          disabled={loadingModo !== null}
          className={redeBtnGhost}
        >
          {loadingModo === 'atualizar' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Atualizando…
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Atualizar existentes
            </>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            void importFile(file);
          }}
        />
      </div>

      {mensagem ? (
        <div className={`mt-3 ${mensagem.tipo === 'sucesso' ? redeAlertSuccess : redeAlertError}`} role="status">
          {mensagem.texto}
        </div>
      ) : null}
    </div>
  );
}
