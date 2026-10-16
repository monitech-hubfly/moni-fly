'use client';

import { useRef, useState } from 'react';
import { X, Download, Upload, CheckCircle2 } from 'lucide-react';
import { importarCardsVCL } from '@/lib/actions/loteadores-novo-card';
import type { VclSubfunil } from './VendaCasasSubfunilTabs';

// ─── Mapeamento sub-funil → nome do kanban ────────────────────────────────────

const SUBFUNIL_NOME: Record<VclSubfunil, string> = {
  'nao-vendidos': 'Venda Casas Loteadores - Lotes Não Vendidos',
  vendidos: 'Venda Casas Loteadores - Lotes Vendidos',
  showroom: 'Venda Casas Loteadores - Showroom',
};

const SUBFUNIL_LABELS: Record<VclSubfunil, string> = {
  'nao-vendidos': 'Lotes Não Vendidos',
  vendidos: 'Lotes Vendidos',
  showroom: 'Showroom',
};

// ─── Colunas do template ──────────────────────────────────────────────────────

const TEMPLATE_COLS = [
  'Nome do Condomínio',
  'Loteador',
  'Dono do Terreno',
  'CPF',
  'RG',
  'Lote',
  'Quadra',
  'Metragem (m²)',
  'Frente (m)',
  'Fundo (m)',
  'Terreno Quitado (S/N)',
  'Valor do Terreno',
  'Saldo Devedor',
  'Valor da Parcela',
  'Qtd. Parcelas',
  'Juros (% a.m.)',
  'E-mail',
  'Telefone',
  'Observação',
  'Fase Inicial',
] as const;

// ─── Tipos ────────────────────────────────────────────────────────────────────

type PreviewRow = Record<string, string>;

type Passo = 1 | 2 | 3 | 4;

// ─── Geração do template XLSX client-side ─────────────────────────────────────

async function baixarTemplate() {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    TEMPLATE_COLS as unknown as string[],
    // Exemplo de linha
    [
      'Botanic Residence',
      'Nome do Loteador',
      'Nome do Dono',
      '000.000.000-00',
      '00.000.000-0',
      '1',
      '15',
      '401,92',
      '15,00',
      '26,80',
      'S',
      '3.500.000,00',
      '',
      '',
      '',
      '',
      'email@exemplo.com',
      '(11) 9 0000-0000',
      '',
      'Leads',
    ],
  ]);
  // Largura automática das colunas
  ws['!cols'] = TEMPLATE_COLS.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, ws, 'Loteadores');
  XLSX.writeFile(wb, 'template_importacao_loteadores.xlsx');
}

// ─── Parse do arquivo XLSX/CSV ────────────────────────────────────────────────

async function parseArquivo(file: File): Promise<PreviewRow[]> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<PreviewRow>(ws, { defval: '' });
  return rows;
}

// ─── Normaliza row bruta → input do server action ─────────────────────────────

function normalizarRow(
  row: PreviewRow,
  kanbanNome: string,
  faseIdFixo: string,
  fases: { id: string; nome: string }[],
) {
  // Tenta usar a Fase Inicial da linha, senão usa o faseIdFixo do dropdown
  const faseNomeLinha = (row['Fase Inicial'] ?? '').toString().trim();
  const faseMatch = fases.find(
    (f) => f.nome.toLowerCase() === faseNomeLinha.toLowerCase(),
  );
  const faseId = faseMatch?.id ?? faseIdFixo;

  return {
    kanban_nome: kanbanNome,
    fase_id: faseId,
    nome_condominio: String(row['Nome do Condomínio'] ?? '').trim(),
    vc_loteador: String(row['Loteador'] ?? '').trim(),
    vc_dono_terreno: String(row['Dono do Terreno'] ?? '').trim(),
    vc_cpf: String(row['CPF'] ?? '').trim(),
    vc_rg: String(row['RG'] ?? '').trim(),
    vc_lote: String(row['Lote'] ?? '').trim(),
    vc_quadra: String(row['Quadra'] ?? '').trim(),
    vc_metragem: String(row['Metragem (m²)'] ?? '').trim(),
    vc_frente: String(row['Frente (m)'] ?? '').trim(),
    vc_fundo: String(row['Fundo (m)'] ?? '').trim(),
    vc_terreno_quitado:
      String(row['Terreno Quitado (S/N)'] ?? '').trim().toLowerCase() === 's',
    vc_valor_terreno: String(row['Valor do Terreno'] ?? '').trim(),
    vc_saldo_devedor: String(row['Saldo Devedor'] ?? '').trim(),
    vc_valor_parcela: String(row['Valor da Parcela'] ?? '').trim(),
    vc_qtd_parcelas: String(row['Qtd. Parcelas'] ?? '').trim(),
    vc_juros: String(row['Juros (% a.m.)'] ?? '').trim(),
    vc_email: String(row['E-mail'] ?? '').trim(),
    vc_telefone: String(row['Telefone'] ?? '').trim(),
    vc_observacao: String(row['Observação'] ?? '').trim(),
  };
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

const PASSOS = [
  { n: 1 as Passo, label: 'Template' },
  { n: 2 as Passo, label: 'Upload' },
  { n: 3 as Passo, label: 'Prévia' },
  { n: 4 as Passo, label: 'Importar' },
];

function Stepper({ atual }: { atual: Passo }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '14px 24px',
        borderBottom: '0.5px solid var(--moni-border-default)',
        gap: 0,
      }}
    >
      {PASSOS.map((p, i) => {
        const done = p.n < atual;
        const active = p.n === atual;
        return (
          <div key={p.n} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 800,
                  fontFamily: 'var(--moni-font-sans)',
                  border: '0.5px solid',
                  background: done
                    ? 'var(--moni-kanban-portfolio-light)'
                    : active
                      ? 'var(--moni-navy-800)'
                      : 'var(--moni-surface-100)',
                  borderColor: done
                    ? 'var(--moni-kanban-portfolio)'
                    : active
                      ? 'var(--moni-navy-800)'
                      : 'var(--moni-border-default)',
                  color: done
                    ? 'var(--moni-kanban-portfolio)'
                    : active
                      ? '#fff'
                      : 'var(--moni-text-tertiary)',
                  transition: 'all 0.2s',
                }}
              >
                {done ? '✓' : p.n}
              </div>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  fontFamily: 'var(--moni-font-sans)',
                  color: done
                    ? 'var(--moni-kanban-portfolio)'
                    : active
                      ? 'var(--moni-navy-800)'
                      : 'var(--moni-text-tertiary)',
                  whiteSpace: 'nowrap',
                }}
              >
                {p.label}
              </span>
            </div>
            {i < PASSOS.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: '0.5px',
                  background: 'var(--moni-border-default)',
                  margin: '0 10px',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function ImportarVCLModal({
  subfunilAtual,
  basePath,
  onClose,
}: {
  subfunilAtual: VclSubfunil;
  basePath: string;
  onClose: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [passo, setPasso] = useState<Passo>(1);
  const [subfunil, setSubfunil] = useState<VclSubfunil>(subfunilAtual);
  const [faseIdFixo, setFaseIdFixo] = useState('');
  const [fases, setFases] = useState<{ id: string; nome: string }[]>([]);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [drag, setDrag] = useState(false);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<{
    criados: number;
    erros: string[];
  } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Carrega fases ao mudar sub-funil
  async function carregarFases(sf: VclSubfunil) {
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const kanbanNome = SUBFUNIL_NOME[sf];
      const { data: kb } = await supabase
        .from('kanbans')
        .select('id')
        .eq('nome', kanbanNome)
        .eq('ativo', true)
        .maybeSingle();
      if (!kb?.id) return;
      const { data } = await supabase
        .from('kanban_fases')
        .select('id, nome, ordem')
        .eq('kanban_id', kb.id)
        .eq('ativo', true)
        .order('ordem');
      const list = (data ?? []) as { id: string; nome: string; ordem: number }[];
      setFases(list);
      if (list[0]?.id) setFaseIdFixo(list[0].id);
    } catch {
      // falha silenciosa
    }
  }

  function handleSubfunilChange(sf: VclSubfunil) {
    setSubfunil(sf);
    setFases([]);
    setFaseIdFixo('');
    void carregarFases(sf);
  }

  async function handleFile(f: File) {
    setArquivo(f);
    setErro(null);
    try {
      const rows = await parseArquivo(f);
      setPreviewRows(rows);
      if (fases.length === 0) await carregarFases(subfunil);
      setPasso(3);
    } catch {
      setErro('Não foi possível ler o arquivo. Verifique se é .xlsx ou .csv válido.');
    }
  }

  async function handleImportar() {
    if (previewRows.length === 0) return;
    setImportando(true);
    setErro(null);
    const kanbanNome = SUBFUNIL_NOME[subfunil];
    const rows = previewRows.map((r) => normalizarRow(r, kanbanNome, faseIdFixo, fases));
    const res = await importarCardsVCL(rows, basePath);
    setResultado({ criados: res.criados, erros: res.erros });
    setImportando(false);
    setPasso(4);
  }

  const inputStyle: React.CSSProperties = {
    height: 36,
    borderRadius: 'var(--moni-radius-md)',
    border: '0.5px solid var(--moni-border-default)',
    padding: '0 10px',
    color: 'var(--moni-text-primary)',
    fontFamily: 'var(--moni-font-sans)',
    fontSize: '0.8125rem',
    background: 'var(--moni-surface-0)',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'color-mix(in srgb, var(--moni-navy-900) 45%, transparent)' }}
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full bg-[var(--moni-surface-0)]"
        style={{
          maxWidth: 580,
          maxHeight: '88vh',
          borderRadius: 'var(--moni-radius-lg)',
          border: '0.5px solid var(--moni-border-default)',
          boxShadow: 'var(--moni-shadow-card)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '0.5px solid var(--moni-border-default)' }}
        >
          <h2
            style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--moni-text-primary)',
              fontFamily: 'var(--moni-font-display)',
              margin: 0,
            }}
          >
            Importar Cards em Massa
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--moni-radius-md)]"
            style={{ color: 'var(--moni-text-tertiary)', flexShrink: 0 }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Stepper */}
        <Stepper atual={passo} />

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {/* ── Passo 1: Template ── */}
          {passo === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p
                style={{
                  fontSize: '0.8125rem',
                  color: 'var(--moni-text-secondary)',
                  lineHeight: 1.6,
                  fontFamily: 'var(--moni-font-sans)',
                  margin: 0,
                }}
              >
                Baixe o nosso template, preencha os dados e importe. Cada linha do arquivo
                corresponde a um card criado no funil.
              </p>

              {/* Lista de colunas */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 6,
                }}
              >
                {TEMPLATE_COLS.map((col) => (
                  <div
                    key={col}
                    style={{
                      background: 'var(--moni-surface-100)',
                      border: '0.5px solid var(--moni-border-default)',
                      borderRadius: 'var(--moni-radius-sm)',
                      padding: '6px 10px',
                      fontSize: '0.6875rem',
                      color: 'var(--moni-text-secondary)',
                      fontFamily: 'var(--moni-font-sans)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: 'var(--moni-kanban-corretores)',
                        flexShrink: 0,
                      }}
                    />
                    {col}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => void baixarTemplate()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  height: 38,
                  padding: '0 16px',
                  borderRadius: 'var(--moni-radius-md)',
                  border: '0.5px solid var(--moni-kanban-corretores)',
                  background: 'var(--moni-surface-0)',
                  color: 'var(--moni-navy-800)',
                  fontFamily: 'var(--moni-font-sans)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Download className="h-4 w-4" />
                Baixar template_importacao_loteadores.xlsx
              </button>

              <div
                style={{
                  background: 'var(--moni-surface-100)',
                  border: '0.5px solid var(--moni-border-default)',
                  borderRadius: 'var(--moni-radius-md)',
                  padding: '12px 14px',
                  fontSize: '0.75rem',
                  color: 'var(--moni-text-secondary)',
                  lineHeight: 1.6,
                  fontFamily: 'var(--moni-font-sans)',
                }}
              >
                <strong style={{ color: 'var(--moni-earth-800)' }}>
                  Recebeu um arquivo do cliente em outro formato?
                </strong>
                <br />
                Encaminhe o arquivo aqui no chat do Hub Fly — o consultor Moní converte
                automaticamente para o nosso template e devolve pronto para importar.
              </div>
            </div>
          )}

          {/* ── Passo 2: Upload ── */}
          {passo === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Seleção de sub-funil e fase */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      color: 'var(--moni-text-secondary)',
                      fontFamily: 'var(--moni-font-sans)',
                      marginBottom: 4,
                    }}
                  >
                    Sub-funil de destino
                  </label>
                  <select
                    value={subfunil}
                    onChange={(e) => handleSubfunilChange(e.target.value as VclSubfunil)}
                    style={{ ...inputStyle, width: '100%', cursor: 'pointer' }}
                  >
                    {(Object.keys(SUBFUNIL_LABELS) as VclSubfunil[]).map((sf) => (
                      <option key={sf} value={sf}>
                        {SUBFUNIL_LABELS[sf]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      color: 'var(--moni-text-secondary)',
                      fontFamily: 'var(--moni-font-sans)',
                      marginBottom: 4,
                    }}
                  >
                    Fase padrão (quando não informada)
                  </label>
                  <select
                    value={faseIdFixo}
                    onChange={(e) => setFaseIdFixo(e.target.value)}
                    style={{ ...inputStyle, width: '100%', cursor: 'pointer' }}
                  >
                    {fases.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Zona de upload */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={async (e) => {
                  e.preventDefault();
                  setDrag(false);
                  const f = e.dataTransfer.files[0];
                  if (f) await handleFile(f);
                }}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `0.5px dashed ${drag ? 'var(--moni-navy-800)' : 'var(--moni-kanban-corretores)'}`,
                  borderRadius: 'var(--moni-radius-lg)',
                  padding: '36px 24px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: drag ? 'var(--moni-surface-100)' : 'var(--moni-surface-50)',
                  transition: 'all 0.2s',
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: 'var(--moni-surface-0)',
                    border: '0.5px solid var(--moni-border-default)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px',
                    color: 'var(--moni-navy-800)',
                  }}
                >
                  <Upload className="h-5 w-5" />
                </div>
                <p
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    color: 'var(--moni-navy-800)',
                    fontFamily: 'var(--moni-font-sans)',
                    marginBottom: 4,
                  }}
                >
                  Clique para selecionar o arquivo
                </p>
                <p
                  style={{
                    fontSize: '0.6875rem',
                    color: 'var(--moni-text-secondary)',
                    fontFamily: 'var(--moni-font-sans)',
                    marginBottom: 6,
                  }}
                >
                  ou arraste e solte aqui
                </p>
                <p
                  style={{
                    fontSize: '0.625rem',
                    fontWeight: 700,
                    letterSpacing: '0.3px',
                    color: 'var(--moni-text-tertiary)',
                    fontFamily: 'var(--moni-font-sans)',
                    textTransform: 'uppercase',
                  }}
                >
                  Aceita: .xlsx · .csv
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.csv"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) await handleFile(f);
                }}
              />
              {erro && (
                <p
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--moni-status-danger)',
                    fontFamily: 'var(--moni-font-sans)',
                  }}
                >
                  {erro}
                </p>
              )}
              <p
                style={{
                  fontSize: '0.6875rem',
                  color: 'var(--moni-text-tertiary)',
                  fontFamily: 'var(--moni-font-sans)',
                  textAlign: 'center',
                }}
              >
                Use o arquivo do nosso template preenchido ou gerado pelo consultor Moní.
              </p>
            </div>
          )}

          {/* ── Passo 3: Prévia ── */}
          {passo === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}
              >
                <span
                  style={{
                    background: 'var(--moni-kanban-portfolio-light)',
                    border: '0.5px solid var(--moni-kanban-portfolio)',
                    color: 'var(--moni-kanban-portfolio)',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    padding: '3px 12px',
                    borderRadius: 20,
                    fontFamily: 'var(--moni-font-sans)',
                  }}
                >
                  {previewRows.length} card{previewRows.length !== 1 ? 's' : ''} encontrado{previewRows.length !== 1 ? 's' : ''}
                </span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--moni-text-tertiary)',
                    fontFamily: 'var(--moni-font-sans)',
                  }}
                >
                  {arquivo?.name}
                </span>
              </div>

              {/* Tabela de prévia */}
              <div style={{ overflowX: 'auto', border: '0.5px solid var(--moni-border-default)', borderRadius: 'var(--moni-radius-md)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.6875rem' }}>
                  <thead>
                    <tr>
                      {['Condomínio', 'Loteador', 'Dono do Terreno', 'Lote/Quadra', 'Fase'].map((h) => (
                        <th
                          key={h}
                          style={{
                            background: 'var(--moni-surface-100)',
                            padding: '7px 10px',
                            textAlign: 'left',
                            fontWeight: 700,
                            color: 'var(--moni-text-tertiary)',
                            borderBottom: '0.5px solid var(--moni-border-default)',
                            fontSize: '0.625rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.3px',
                            whiteSpace: 'nowrap',
                            fontFamily: 'var(--moni-font-sans)',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.slice(0, 8).map((row, i) => (
                      <tr key={i}>
                        {[
                          row['Nome do Condomínio'],
                          row['Loteador'],
                          row['Dono do Terreno'],
                          [row['Lote'], row['Quadra']].filter(Boolean).join(' / ') || '—',
                          row['Fase Inicial'] || 'Leads',
                        ].map((v, j) => (
                          <td
                            key={j}
                            style={{
                              padding: '7px 10px',
                              borderBottom:
                                i < Math.min(previewRows.length, 8) - 1
                                  ? '0.5px solid var(--moni-border-default)'
                                  : 'none',
                              color: 'var(--moni-text-primary)',
                              fontFamily: 'var(--moni-font-sans)',
                              maxWidth: 140,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {String(v ?? '—')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {previewRows.length > 8 && (
                <p
                  style={{
                    fontSize: '0.6875rem',
                    color: 'var(--moni-text-tertiary)',
                    fontFamily: 'var(--moni-font-sans)',
                    textAlign: 'center',
                  }}
                >
                  Mostrando 8 de {previewRows.length} linhas
                </p>
              )}
            </div>
          )}

          {/* ── Passo 4: Resultado ── */}
          {passo === 4 && resultado && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
                padding: '24px 0',
                textAlign: 'center',
              }}
            >
              <CheckCircle2
                className="h-12 w-12"
                style={{ color: 'var(--moni-kanban-portfolio)' }}
              />
              <div>
                <p
                  style={{
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: 'var(--moni-text-primary)',
                    fontFamily: 'var(--moni-font-display)',
                    marginBottom: 6,
                  }}
                >
                  {resultado.criados} card{resultado.criados !== 1 ? 's' : ''} importado{resultado.criados !== 1 ? 's' : ''} com sucesso!
                </p>
                {resultado.erros.length > 0 && (
                  <div style={{ marginTop: 8, textAlign: 'left' }}>
                    <p
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--moni-status-danger)',
                        fontFamily: 'var(--moni-font-sans)',
                        marginBottom: 6,
                      }}
                    >
                      {resultado.erros.length} erro{resultado.erros.length !== 1 ? 's' : ''}:
                    </p>
                    {resultado.erros.slice(0, 5).map((e, i) => (
                      <p
                        key={i}
                        style={{
                          fontSize: '0.6875rem',
                          color: 'var(--moni-text-secondary)',
                          fontFamily: 'var(--moni-font-sans)',
                          marginBottom: 2,
                        }}
                      >
                        {e}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 24px',
            borderTop: '0.5px solid var(--moni-border-default)',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={passo === 1 ? onClose : () => setPasso((p) => Math.max(1, p - 1) as Passo)}
            style={{
              height: 36,
              padding: '0 16px',
              borderRadius: 'var(--moni-radius-md)',
              border: '0.5px solid var(--moni-border-default)',
              background: 'transparent',
              color: 'var(--moni-text-secondary)',
              fontFamily: 'var(--moni-font-sans)',
              fontSize: '0.8125rem',
              cursor: 'pointer',
            }}
          >
            {passo === 1 ? 'Cancelar' : 'Voltar'}
          </button>

          {passo === 4 ? (
            <button
              type="button"
              onClick={onClose}
              style={{
                height: 36,
                padding: '0 20px',
                borderRadius: 'var(--moni-radius-md)',
                border: 'none',
                background: 'var(--moni-navy-800)',
                color: '#fff',
                fontFamily: 'var(--moni-font-sans)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Fechar
            </button>
          ) : passo === 3 ? (
            <button
              type="button"
              disabled={importando || previewRows.length === 0}
              onClick={() => void handleImportar()}
              style={{
                height: 36,
                padding: '0 20px',
                borderRadius: 'var(--moni-radius-md)',
                border: 'none',
                background: importando ? 'var(--moni-surface-200)' : 'var(--moni-navy-800)',
                color: importando ? 'var(--moni-text-tertiary)' : '#fff',
                fontFamily: 'var(--moni-font-sans)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: importando ? 'not-allowed' : 'pointer',
              }}
            >
              {importando ? 'Importando…' : `Importar ${previewRows.length} card${previewRows.length !== 1 ? 's' : ''}`}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (passo === 1) { void carregarFases(subfunil); }
                setPasso((p) => Math.min(4, p + 1) as Passo);
              }}
              style={{
                height: 36,
                padding: '0 20px',
                borderRadius: 'var(--moni-radius-md)',
                border: 'none',
                background: 'var(--moni-navy-800)',
                color: '#fff',
                fontFamily: 'var(--moni-font-sans)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Próximo →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
