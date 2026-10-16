'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { criarCardVCL } from '@/lib/actions/loteadores-novo-card';
import type { KanbanNomeDisplay } from '@/components/kanban-shared/types';

type Fase = { id: string; nome: string; ordem: number };

const F = {
  input: {
    height: 40,
    borderRadius: 'var(--moni-radius-md)',
    border: '0.5px solid var(--moni-border-default)',
    padding: '0 12px',
    color: 'var(--moni-text-primary)',
    fontFamily: 'var(--moni-font-sans)',
    fontSize: '0.8125rem',
    width: '100%',
    background: 'var(--moni-surface-0)',
    outline: 'none',
  } as React.CSSProperties,
  textarea: {
    borderRadius: 'var(--moni-radius-md)',
    border: '0.5px solid var(--moni-border-default)',
    padding: '10px 12px',
    color: 'var(--moni-text-primary)',
    fontFamily: 'var(--moni-font-sans)',
    fontSize: '0.8125rem',
    width: '100%',
    background: 'var(--moni-surface-0)',
    outline: 'none',
    resize: 'vertical' as const,
    minHeight: 72,
  } as React.CSSProperties,
  label: {
    display: 'block',
    fontSize: '0.6875rem',
    fontWeight: 600,
    color: 'var(--moni-text-secondary)',
    fontFamily: 'var(--moni-font-sans)',
    marginBottom: 4,
  } as React.CSSProperties,
  section: {
    fontSize: '0.625rem',
    fontWeight: 800,
    color: 'var(--moni-text-tertiary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.6px',
    padding: '10px 0 6px',
    borderTop: '0.5px solid var(--moni-border-default)',
    marginTop: 4,
    fontFamily: 'var(--moni-font-sans)',
  } as React.CSSProperties,
};

function Campo({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label style={F.label}>
        {label}
        {required && <span style={{ color: 'var(--moni-status-danger)', marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{children}</div>
  );
}

function Grid3({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>{children}</div>
  );
}

export function NovoCardVCLModal({
  kanbanId,
  kanbanNome,
  basePath,
  onClose,
}: {
  kanbanId: string;
  kanbanNome: KanbanNomeDisplay;
  basePath: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [fases, setFases] = useState<Fase[]>([]);

  const [faseId, setFaseId] = useState('');
  const [nomeCondominio, setNomeCondominio] = useState('');
  const [loteador, setLoteador] = useState('');
  const [donoTerreno, setDonoTerreno] = useState('');
  const [cpf, setCpf] = useState('');
  const [rg, setRg] = useState('');
  const [terrenoQuitado, setTerrenoQuitado] = useState(false);
  const [lote, setLote] = useState('');
  const [quadra, setQuadra] = useState('');
  const [metragem, setMetragem] = useState('');
  const [frente, setFrente] = useState('');
  const [fundo, setFundo] = useState('');
  const [valorTerreno, setValorTerreno] = useState('');
  const [saldoDevedor, setSaldoDevedor] = useState('');
  const [valorParcela, setValorParcela] = useState('');
  const [qtdParcelas, setQtdParcelas] = useState('');
  const [juros, setJuros] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [observacao, setObservacao] = useState('');

  useEffect(() => {
    void (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('kanban_fases')
        .select('id, nome, ordem')
        .eq('kanban_id', kanbanId)
        .eq('ativo', true)
        .order('ordem');
      const list = (data ?? []) as Fase[];
      setFases(list);
      if (list[0]?.id) setFaseId(list[0].id);
    })();
  }, [kanbanId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    try {
      const res = await criarCardVCL({
        kanban_nome: kanbanNome,
        fase_id: faseId,
        basePath,
        nome_condominio: nomeCondominio,
        vc_loteador: loteador,
        vc_dono_terreno: donoTerreno,
        vc_cpf: cpf,
        vc_rg: rg,
        vc_lote: lote,
        vc_quadra: quadra,
        vc_metragem: metragem,
        vc_frente: frente,
        vc_fundo: fundo,
        vc_terreno_quitado: terrenoQuitado,
        vc_valor_terreno: valorTerreno,
        vc_saldo_devedor: saldoDevedor,
        vc_valor_parcela: valorParcela,
        vc_qtd_parcelas: qtdParcelas,
        vc_juros: juros,
        vc_email: email,
        vc_telefone: telefone,
        vc_observacao: observacao,
      });
      if (!res.ok) throw new Error(res.error);
      router.refresh();
      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar card.');
      setLoading(false);
    }
  }

  const canSubmit = nomeCondominio.trim() && loteador.trim() && donoTerreno.trim() && faseId;
  const tituloPreview = [donoTerreno.trim(), nomeCondominio.trim()].filter(Boolean).join(' — ');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'color-mix(in srgb, var(--moni-navy-900) 45%, transparent)' }}
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full bg-[var(--moni-surface-0)]"
        style={{
          maxWidth: 560,
          maxHeight: '90vh',
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
            Novo Card
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--moni-radius-md)]"
            style={{ color: 'var(--moni-text-tertiary)', flexShrink: 0 }}
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Corpo */}
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {/* Fase inicial */}
          <Campo label="Fase inicial" required>
            <select
              value={faseId}
              onChange={(e) => setFaseId(e.target.value)}
              required
              disabled={loading}
              style={{ ...F.input, cursor: 'pointer' }}
            >
              {fases.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </Campo>

          {/* Dados do Imóvel */}
          <div style={F.section}>Dados do Imóvel</div>

          <Campo label="Nome do condomínio" required>
            <input
              type="text"
              value={nomeCondominio}
              onChange={(e) => setNomeCondominio(e.target.value)}
              placeholder="Ex: Botanic Residence"
              required
              disabled={loading}
              style={F.input}
            />
          </Campo>

          <Campo label="Loteador" required>
            <input
              type="text"
              value={loteador}
              onChange={(e) => setLoteador(e.target.value)}
              placeholder="Nome do loteador"
              required
              disabled={loading}
              style={F.input}
            />
          </Campo>

          <Campo label="Dono do terreno" required>
            <input
              type="text"
              value={donoTerreno}
              onChange={(e) => setDonoTerreno(e.target.value)}
              placeholder="Nome completo"
              required
              disabled={loading}
              style={F.input}
            />
          </Campo>

          <Grid2>
            <Campo label="CPF">
              <input
                type="text"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                placeholder="000.000.000-00"
                disabled={loading}
                style={F.input}
              />
            </Campo>
            <Campo label="RG">
              <input
                type="text"
                value={rg}
                onChange={(e) => setRg(e.target.value)}
                placeholder="00.000.000-0"
                disabled={loading}
                style={F.input}
              />
            </Campo>
          </Grid2>

          {/* Toggle quitado */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ ...F.label, marginBottom: 0 }}>Terreno quitado?</span>
            <button
              type="button"
              role="switch"
              aria-checked={terrenoQuitado}
              onClick={() => setTerrenoQuitado((v) => !v)}
              disabled={loading}
              style={{
                width: 40,
                height: 22,
                borderRadius: 11,
                border: 'none',
                background: terrenoQuitado
                  ? 'var(--moni-kanban-portfolio)'
                  : 'var(--moni-surface-200)',
                cursor: 'pointer',
                position: 'relative',
                transition: 'background 0.2s',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: 3,
                  left: terrenoQuitado ? 21 : 3,
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: '#fff',
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                }}
              />
            </button>
            <span
              style={{
                fontSize: '0.75rem',
                fontFamily: 'var(--moni-font-sans)',
                fontWeight: 600,
                color: terrenoQuitado
                  ? 'var(--moni-kanban-portfolio)'
                  : 'var(--moni-text-tertiary)',
              }}
            >
              {terrenoQuitado ? 'Sim' : 'Não'}
            </span>
          </div>

          {/* Localização */}
          <div style={F.section}>Localização</div>

          <Grid3>
            <Campo label="Número do lote">
              <input
                type="text"
                value={lote}
                onChange={(e) => setLote(e.target.value)}
                placeholder="Ex: 1"
                disabled={loading}
                style={F.input}
              />
            </Campo>
            <Campo label="Número da quadra">
              <input
                type="text"
                value={quadra}
                onChange={(e) => setQuadra(e.target.value)}
                placeholder="Ex: 15"
                disabled={loading}
                style={F.input}
              />
            </Campo>
            <Campo label="Metragem total (m²)">
              <input
                type="text"
                value={metragem}
                onChange={(e) => setMetragem(e.target.value)}
                placeholder="Ex: 401,92"
                disabled={loading}
                style={F.input}
              />
            </Campo>
          </Grid3>

          <Grid2>
            <Campo label="Frente (m)">
              <input
                type="text"
                value={frente}
                onChange={(e) => setFrente(e.target.value)}
                placeholder="Ex: 15,00"
                disabled={loading}
                style={F.input}
              />
            </Campo>
            <Campo label="Fundo (m)">
              <input
                type="text"
                value={fundo}
                onChange={(e) => setFundo(e.target.value)}
                placeholder="Ex: 26,80"
                disabled={loading}
                style={F.input}
              />
            </Campo>
          </Grid2>

          {/* Financeiro */}
          <div style={F.section}>Financeiro</div>

          <Grid2>
            <Campo label="Valor do terreno (R$)">
              <input
                type="text"
                value={valorTerreno}
                onChange={(e) => setValorTerreno(e.target.value)}
                placeholder="Ex: 3.500.000,00"
                disabled={loading}
                style={F.input}
              />
            </Campo>
            <Campo label="Saldo devedor (R$)">
              <input
                type="text"
                value={saldoDevedor}
                onChange={(e) => setSaldoDevedor(e.target.value)}
                placeholder="Ex: 850.000,00"
                disabled={loading}
                style={F.input}
              />
            </Campo>
          </Grid2>

          <Grid3>
            <Campo label="Valor das parcelas (R$)">
              <input
                type="text"
                value={valorParcela}
                onChange={(e) => setValorParcela(e.target.value)}
                placeholder="Ex: 12.500,00"
                disabled={loading}
                style={F.input}
              />
            </Campo>
            <Campo label="Qtd. de parcelas">
              <input
                type="text"
                value={qtdParcelas}
                onChange={(e) => setQtdParcelas(e.target.value)}
                placeholder="Ex: 48"
                disabled={loading}
                style={F.input}
              />
            </Campo>
            <Campo label="Juros (% a.m.)">
              <input
                type="text"
                value={juros}
                onChange={(e) => setJuros(e.target.value)}
                placeholder="Ex: 0,80"
                disabled={loading}
                style={F.input}
              />
            </Campo>
          </Grid3>

          {/* Contato */}
          <div style={F.section}>Contato</div>

          <Grid2>
            <Campo label="E-mail para contato">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
                disabled={loading}
                style={F.input}
              />
            </Campo>
            <Campo label="Telefone para contato">
              <input
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(11) 9 0000-0000"
                disabled={loading}
                style={F.input}
              />
            </Campo>
          </Grid2>

          <Campo label="Observação">
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Informações adicionais sobre o lote ou proprietário..."
              disabled={loading}
              style={F.textarea}
            />
          </Campo>

          {/* Preview título */}
          {tituloPreview && (
            <div
              style={{
                background: 'var(--moni-surface-100)',
                border: '0.5px solid var(--moni-border-default)',
                borderRadius: 'var(--moni-radius-md)',
                padding: '10px 14px',
              }}
            >
              <p
                style={{
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'var(--moni-text-tertiary)',
                  fontFamily: 'var(--moni-font-sans)',
                  marginBottom: 4,
                }}
              >
                Preview do título
              </p>
              <p
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--moni-text-primary)',
                  fontFamily: 'var(--moni-font-sans)',
                  margin: 0,
                }}
              >
                {tituloPreview}
              </p>
            </div>
          )}

          {erro && (
            <p
              style={{
                fontSize: '0.75rem',
                color: 'var(--moni-status-danger)',
                fontFamily: 'var(--moni-font-sans)',
                margin: 0,
              }}
            >
              {erro}
            </p>
          )}

          {/* Footer (dentro do form para o submit funcionar) */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              paddingTop: 8,
              borderTop: '0.5px solid var(--moni-border-default)',
              marginTop: 4,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
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
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !canSubmit}
              style={{
                height: 36,
                padding: '0 20px',
                borderRadius: 'var(--moni-radius-md)',
                border: 'none',
                background: loading || !canSubmit ? 'var(--moni-surface-200)' : 'var(--moni-navy-800)',
                color: loading || !canSubmit ? 'var(--moni-text-tertiary)' : '#fff',
                fontFamily: 'var(--moni-font-sans)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: loading || !canSubmit ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
              }}
            >
              {loading ? 'Criando…' : 'Criar Card'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
