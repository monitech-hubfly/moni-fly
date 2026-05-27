'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, FileSpreadsheet, Loader2, ExternalLink, Upload, RefreshCw } from 'lucide-react';
import { atualizarRedeFranqueadosCSV, importarRedeFranqueadosCSV } from './actions';

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
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-stone-700">
          <FileSpreadsheet className="h-4 w-4" />
          Importar CSV da planilha
        </div>
        <a
          href={PLANILHA_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-moni-primary hover:underline"
        >
          Abrir planilha
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <p className="mb-3 text-xs text-stone-600">
        Exporte no Google Sheets (Arquivo → Fazer download → Valores separados por vírgula .csv). Use os mesmos
        cabeçalhos da tabela (ou o{' '}
        <a className="text-moni-primary hover:underline" href="/templates/rede-franqueados-template.csv">
          template CSV
        </a>
        ).
      </p>
      <ul className="mb-3 list-inside list-disc space-y-1 text-xs text-stone-600">
        <li>
          <strong>Importar (novas linhas)</strong> — adiciona franqueados e pode criar cards no Step 1.
        </li>
        <li>
          <strong>Atualizar existentes</strong> — localiza cada linha pelo <strong>Nº de Franquia</strong> e preenche
          só os campos com valor no CSV (células vazias não apagam o que já está salvo).
        </li>
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <a
          href="/templates/rede-franqueados-template.csv"
          download
          className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
        >
          <Download className="h-4 w-4" />
          Baixar template
        </a>
        <button
          type="button"
          onClick={() => abrirArquivo('inserir')}
          disabled={loadingModo !== null}
          className="inline-flex items-center gap-2 rounded-lg bg-moni-primary px-4 py-2 text-sm font-medium text-white hover:bg-moni-secondary disabled:opacity-50"
        >
          {loadingModo === 'inserir' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Importando…
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Importar (novas linhas + cards)
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => abrirArquivo('atualizar')}
          disabled={loadingModo !== null}
          className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50 disabled:opacity-50"
        >
          {loadingModo === 'atualizar' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Atualizando…
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Atualizar linhas existentes
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
        <p className={`mt-3 text-sm ${mensagem.tipo === 'sucesso' ? 'text-green-700' : 'text-red-600'}`}>
          {mensagem.texto}
        </p>
      ) : null}
    </div>
  );
}
