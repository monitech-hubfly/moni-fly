'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, FileSpreadsheet, Loader2, ExternalLink, Upload } from 'lucide-react';
import { importarRedeFranqueadosCSV } from './actions';

const PLANILHA_URL =
  'https://docs.google.com/spreadsheets/d/1ksBuiPbUm_OWh-S6w4j1kWxaI7SG2Q0YlsV3zHxCkuQ/edit?gid=1330850735#gid=1330850735';

export function ImportarRedeCSVButton() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  const importFile = async (file: File) => {
    setMensagem(null);
    setLoading(true);
    try {
      const text = await file.text();
      const result = await importarRedeFranqueadosCSV(text);
      if (result.ok) {
        setMensagem({ tipo: 'sucesso', texto: result.mensagem });
        router.refresh();
      } else {
        setMensagem({ tipo: 'erro', texto: result.error });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-stone-700">
          <FileSpreadsheet className="h-4 w-4" />
          Importar CSV (gera cards Step 1)
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
        Exporte no Google Sheets (Arquivo → Fazer download → Valores separados por vírgula .csv) e selecione o arquivo abaixo.
        Para começar, baixe o modelo: <a className="text-moni-primary hover:underline" href="/templates/rede-franqueados-template.csv">template CSV</a>.
      </p>

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
          onClick={() => fileRef.current?.click()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-moni-primary px-4 py-2 text-sm font-medium text-white hover:bg-moni-secondary disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Importando…
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Selecionar CSV e importar (cria cards)
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

      {mensagem && (
        <p className={`mt-3 text-sm ${mensagem.tipo === 'sucesso' ? 'text-green-700' : 'text-red-600'}`}>
          {mensagem.texto}
        </p>
      )}
    </div>
  );
}

