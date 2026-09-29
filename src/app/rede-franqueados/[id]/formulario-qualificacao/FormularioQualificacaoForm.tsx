'use client';

import { useState } from 'react';
import { salvarFormularioEni, type FormularioQualificacaoRow } from '@/lib/actions/formulario-qualificacao';
import { salvarFormularioPublico, buscarRespostaPublicaDetalhe } from '@/lib/actions/formulario-publico';
import type { FormularioQualificacaoRow } from '@/lib/actions/formulario-qualificacao';

// Design tokens
const NAVY  = '#0F1E33';
const GOLD  = '#B8965A';
const CREAM = '#F7F3EE';
const CREAM2 = '#EDE8E1';
const GREEN = '#2F6B4A';
const RED   = '#8B2020';

// Scoring map - used only for internal DB save, not displayed to Frank
const SCORE_MAP: Record<string, Record<string, number>> = {
  capital_faixa:        { nao_tenho: 0, abaixo_260k: 0, '260_400k': 1, '400_600k': 2, acima_600k: 2 },
  conhecimento_mercado: { alto: 2, medio: 1, baixo: 0 },
  conhecimento_imob:    { sim_inc: 2, sim_compra: 1, nao: 0 },
  conhecimento_moni:    { fluente: 2, basico: 1, pouco: 0 },
  tempo_horas:          { '10+': 2, '5-10': 2, '2-5': 1, '<2': 0 },
  tempo_resposta:       { mesmo_dia: 2, '24h': 2, '2-3d': 1, semana: 0 },
  tempo_agenda:         { sim_tudo: 2, sim_online: 2, parcial: 0 },
  workshops:            { sim_ja: 2, sim_pode: 1, nao: 0 },
};

// Derive capital_gate from capital_faixa for backward compat with DB column
function derivarCapitalGate(faixa: string): string {
  if (faixa === 'nao_tenho' || faixa === 'abaixo_260k') return 'nao';
  if (faixa === 'acima_600k') return 'sim_plus';
  return 'sim';
}

function RadioOption({ name, value, label, selected, onChange, sub }: {
  name: string; value: string; label: string; selected: boolean;
  onChange: (v: string) => void; sub?: string;
}) {
  return (
    <label
      onClick={() => onChange(value)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px',
        borderRadius: 8, cursor: 'pointer',
        background: selected ? NAVY : 'white',
        border: `1.5px solid ${selected ? GOLD : '#D5CFC8'}`,
        transition: 'all .15s',
      }}
    >
      <span style={{
        flexShrink: 0, marginTop: 2, width: 16, height: 16, borderRadius: '50%',
        border: `2px solid ${selected ? GOLD : '#999'}`,
        background: selected ? GOLD : 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {selected && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'white' }} />}
      </span>
      <span>
        <span style={{ display: 'block', fontSize: 13.5, color: selected ? 'white' : '#222', fontWeight: selected ? 600 : 400 }}>{label}</span>
        {sub && <span style={{ display: 'block', fontSize: 11.5, color: selected ? '#C8B88A' : '#888', marginTop: 2 }}>{sub}</span>}
      </span>
    </label>
  );
}

function SectionHeader({ number, title, icon }: { number: number; title: string; icon: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%', background: GOLD,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'white', fontWeight: 700, fontSize: 15, flexShrink: 0,
      }}>{number}</div>
      <div>
        <div style={{ fontSize: 11, color: GOLD, letterSpacing: 1.5, fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>{icon}</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: NAVY }}>{title}</div>
      </div>
    </div>
  );
}

function SectionCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'white', borderRadius: 12, padding: '24px 28px',
      border: `1px solid ${CREAM2}`, marginBottom: 20, ...style,
    }}>
      {children}
    </div>
  );
}

function QuestionGroup({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: '#333', marginBottom: 10 }}>
        {label}{required && <span style={{ color: RED, marginLeft: 4 }}>*</span>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  );
}

type Props = {
  cidadeInicial?: string;
  estadoInicial?: string;
  redeId: string;
  nFranquia: string;
  nomeCompleto: string;
  historico: Pick<FormularioQualificacaoRow, 'id' | 'criado_em' | 'resultado_tipo'>[];
  publicToken?: string;
};

function DetalheRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 13 }}>
      <span style={{ color: '#888', flexShrink: 0, minWidth: 160 }}>{label}:</span>
      <span style={{ color: '#222', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

export default function FormularioQualificacaoForm({ redeId, nFranquia, nomeCompleto, cidadeInicial = '', estadoInicial = '', historico, publicToken }: Props) {
  const [nome, setNome]                               = useState(nomeCompleto || '');
  const [cidade, setCidade]                           = useState(cidadeInicial);
  const [estado, setEstado]                           = useState(estadoInicial);
  const [capitalFaixa, setCapitalFaixa]               = useState('');
  const [capitalValorDeclarado, setCapitalValorDeclarado] = useState('');
  const [conhecMercado, setConhecMercado]             = useState('');
  const [conhecImob, setConhecImob]                   = useState('');
  const [conhecMoni, setConhecMoni]                   = useState('');
  const [tempoHoras, setTempoHoras]                   = useState('');
  const [tempoResposta, setTempoResposta]             = useState('');
  const [tempoAgenda, setTempoAgenda]                 = useState('');
  const [workshops, setWorkshops]                     = useState('');
  const [motivacao, setMotivacao]                     = useState('');

  const [enviado, setEnviado]       = useState(false);
  const [erroForm, setErroForm]     = useState('');
  const [salvando, setSalvando]     = useState(false);
  const [erroSalvar, setErroSalvar] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detalhes, setDetalhes] = useState<Record<string, FormularioQualificacaoRow | null>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const totalQ = capitalFaixa === 'abaixo_260k' ? 10 : 9;
  const answered = [
    capitalFaixa, conhecMercado, conhecImob, conhecMoni,
    tempoHoras, tempoResposta, tempoAgenda, workshops, motivacao,
  ].filter(Boolean).length
    + (capitalFaixa === 'abaixo_260k' && capitalValorDeclarado.trim() ? 1 : 0);
  const progress = Math.min(100, Math.round((answered / totalQ) * 100));

  function score(field: string, val: string | null): number {
    if (!val) return 0;
    return SCORE_MAP[field]?.[val] ?? 0;
  }

  function formatarData(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  async function toggleDetalhe(id: string) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (detalhes[id] !== undefined) return; // ja carregado
    setLoadingId(id);
    const res = await buscarRespostaPublicaDetalhe(publicToken!, id);
    setDetalhes(prev => ({ ...prev, [id]: res.data }));
    setLoadingId(null);
  }

  const LABEL_MAP: Record<string, Record<string, string>> = {
    capital_faixa: {
      nao_tenho:   'Nao tenho capital para aporte inicial',
      abaixo_260k: 'Abaixo de R$ 260.000',
      '260_400k':  'R$ 260.000 a R$ 400.000',
      '400_600k':  'R$ 400.000 a R$ 600.000',
      acima_600k:  'Acima de R$ 600.000',
    },
    conhecimento_mercado: {
      alto:  'Alto: conheco corretores, loteadoras e precos praticados',
      medio: 'Medio: conheco a cidade, mas nao tenho rede no mercado',
      baixo: 'Baixo: sou novo no mercado',
    },
    conhecimento_imob: {
      sim_inc:    'Sim: ja participei de incorporacao ou desenvolvimento',
      sim_compra: 'Sim: ja comprei/vendi imoveis ou acompanhei obras',
      nao:        'Nao: meu background e em outra area',
    },
    conhecimento_moni: {
      fluente: 'Fluente: uso as ferramentas regularmente',
      basico:  'Basico: tenho os links mas nao opero sozinho',
      pouco:   'Pouco: ainda nao abri os links na Area do Franqueado',
    },
    tempo_horas: {
      '10+':  '10h ou mais por semana',
      '5-10': '5 a 10h por semana',
      '2-5':  '2 a 5h por semana',
      '<2':   'Menos de 2h por semana',
    },
    tempo_resposta: {
      mesmo_dia: 'No mesmo dia, sempre',
      '24h':     'Em ate 24h na maioria das vezes',
      '2-3d':    'Em 2 a 3 dias',
      semana:    'Depende: as vezes demoro mais de 3 dias',
    },
    tempo_agenda: {
      sim_tudo:   'Sim: agenda disponivel para reunioes e visitas de campo',
      sim_online: 'Reunioes sim, visita ao terreno com aviso previo de 3+ dias',
      parcial:    'Agenda apertada: 1 semana de antecedencia',
    },
    workshops: {
      sim_ja:   'Sim: ja participei de workshops',
      sim_pode: 'Ainda nao, mas tenho como participar',
      nao:      'Nao tenho como participar no momento',
    },
    resultado_tipo: {
      qualificado:     'Qualificado',
      parcial:         'Qualificado parcial',
      nao_qualificado: 'Nao qualificado',
    },
  };

  function lbl(field: string, val: string | null): string {
    if (!val) return '-';
    return LABEL_MAP[field]?.[val] ?? val;
  }

  async function enviarRespostas() {
    setErroForm('');
    if (!nome.trim()) return setErroForm('Informe seu nome completo.');
    if (!cidade.trim()) return setErroForm('Informe a cidade de atuação.');
    if (!estado.trim()) return setErroForm('Informe o estado.');
    if (!capitalFaixa) return setErroForm('Selecione a faixa de capital disponível.');
    if (capitalFaixa === 'abaixo_260k' && !capitalValorDeclarado.trim())
      return setErroForm('Informe o valor de capital disponível.');
    if (!conhecMercado) return setErroForm('Responda sobre conhecimento do mercado imobiliário.');
    if (!conhecImob) return setErroForm('Responda sobre experiência imobiliária.');
    if (!conhecMoni) return setErroForm('Responda sobre conhecimento do modelo Moní.');
    if (!tempoHoras) return setErroForm('Responda sobre horas disponíveis por semana.');
    if (!tempoResposta) return setErroForm('Responda sobre tempo de resposta a demandas.');
    if (!tempoAgenda) return setErroForm('Responda sobre disponibilidade de agenda presencial.');
    if (!workshops) return setErroForm('Responda sobre participação em workshops.');
    if (!motivacao.trim()) return setErroForm('Preencha o campo de contexto / motivação.');

    // Internal scoring - saved to DB only, not shown to Frank
    // Capital: direct map from capital_faixa (max 2)
    const capRaw = score('capital_faixa', capitalFaixa);
    const capPct = Math.round((capRaw / 2) * 100);

    // Conhecimento: 3 questions x max 2 = max 6; normalize to 0-2
    const conhecRaw = score('conhecimento_mercado', conhecMercado)
      + score('conhecimento_imob', conhecImob)
      + score('conhecimento_moni', conhecMoni);
    const conhecPct = Math.round((conhecRaw / 6) * 100);

    // Disponibilidade: 4 questions x max 2 = max 8; normalize to 0-2
    const tempoRaw = score('tempo_horas', tempoHoras)
      + score('tempo_resposta', tempoResposta)
      + score('tempo_agenda', tempoAgenda)
      + score('workshops', workshops);
    const tempoPct = Math.round((tempoRaw / 8) * 100);

    const totalRaw = capRaw + conhecRaw + tempoRaw;
    const totalPct = Math.round((totalRaw / 16) * 100);

    // Normalized scores for rede_franqueados (0-2 scale)
    const diagD = capRaw;                               // capital max 2, already in range
    const diagK = Math.round((conhecRaw / 6) * 2);     // conhecimento max 6
    const diagC = Math.round((tempoRaw / 8) * 2);      // disponibilidade max 8

    const semCapital = capitalFaixa === 'nao_tenho' || capitalFaixa === 'abaixo_260k';
    const lowFlags = (capPct < 50 ? 1 : 0) + (conhecPct < 34 ? 1 : 0) + (tempoPct < 34 ? 1 : 0);
    let tipo: string;
    if (semCapital) {
      tipo = 'nao_qualificado';
    } else if (totalPct >= 70 && lowFlags === 0) {
      tipo = 'qualificado';
    } else if (totalPct >= 45 && lowFlags <= 1) {
      tipo = 'parcial';
    } else {
      tipo = 'nao_qualificado';
    }

    setSalvando(true);
    const formData = {
      nome_franqueado_confirmado: nome,
      cidade_atuacao: cidade,
      estado_atuacao: estado,
      capital_gate: derivarCapitalGate(capitalFaixa),
      capital_faixa: capitalFaixa || null,
      capital_timing: null,
      capital_valor_declarado: capitalFaixa === 'abaixo_260k' ? capitalValorDeclarado.trim() || null : null,
      conhecimento_mercado: conhecMercado || null,
      conhecimento_imob: conhecImob || null,
      conhecimento_moni: conhecMoni || null,
      tempo_horas: tempoHoras || null,
      tempo_resposta: tempoResposta || null,
      tempo_agenda: tempoAgenda || null,
      workshops: workshops || null,
      motivacao: motivacao || null,
      score_capital_pct: capPct,
      score_conhecimento_pct: conhecPct,
      score_tempo_pct: tempoPct,
      resultado_tipo: tipo,
      diag_d: diagD,
      diag_k: diagK,
      diag_c: diagC,
      texto_gerado: null,
    };
    const res = publicToken
      ? await salvarFormularioPublico(publicToken, formData)
      : await salvarFormularioEni({ rede_franqueado_id: redeId, n_franquia: nFranquia, ...formData });
    setSalvando(false);

    if (!res.ok) {
      setErroSalvar(res.error || 'Erro ao salvar. Tente novamente.');
      return;
    }

    setEnviado(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => window.location.reload(), 1500);
  }

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: CREAM, minHeight: '100vh', paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ background: NAVY, padding: '28px 24px 24px', marginBottom: 24 }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div style={{ fontSize: 11, color: GOLD, letterSpacing: 2, fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>
            Plano Permuteiro
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', margin: 0, lineHeight: 1.3 }}>
            Formulário de Qualificação
          </h1>
          <p style={{ fontSize: 13, color: '#94A3B8', margin: '6px 0 0', lineHeight: 1.5 }}>
            Avaliação em 3 eixos: Capital, Conhecimento e Disponibilidade
          </p>
          {!enviado && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: '#94A3B8' }}>Progresso</span>
                <span style={{ fontSize: 11, color: GOLD, fontWeight: 600 }}>{progress}%</span>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,.1)', borderRadius: 2 }}>
                <div style={{ height: '100%', width: `${progress}%`, background: GOLD, borderRadius: 2, transition: 'width .3s' }} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 16px' }}>

        {/* Confirmation panel - shown after submission */}
        {enviado && (
          <div style={{
            background: 'white', borderRadius: 14, padding: '36px 28px', marginBottom: 24,
            border: `2px solid ${GREEN}`, textAlign: 'center',
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', background: GREEN,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 700, fontSize: 26, margin: '0 auto 16px',
            }}>
              &#10003;
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: NAVY, marginBottom: 8 }}>
              Respostas enviadas com sucesso!
            </div>
            <div style={{ fontSize: 14, color: '#666', lineHeight: 1.6 }}>
              Obrigado pelo preenchimento. Suas respostas foram registradas e serão analisadas pela equipe Moní.
            </div>
          </div>
        )}

        {/* Form sections - hidden after submission */}
        {!enviado && (
          <>
            {/* Sec 0: Identificação */}
            <SectionCard>
              <SectionHeader number={0} title="Identificação" icon="Contexto" />
              <QuestionGroup label="Nome completo" required>
                <input
                  value={nome} onChange={e => setNome(e.target.value)}
                  placeholder="Nome completo"
                  style={{
                    width: '100%', borderRadius: 8, border: `1.5px solid ${CREAM2}`,
                    padding: '9px 12px', fontSize: 13.5, color: '#222',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </QuestionGroup>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <QuestionGroup label="Cidade(s) de atuação" required>
                  <input
                    value={cidade} onChange={e => setCidade(e.target.value)}
                    placeholder="Ex: São Paulo, Campinas"
                    style={{
                      width: '100%', borderRadius: 8, border: `1.5px solid ${CREAM2}`,
                      padding: '9px 12px', fontSize: 13.5, color: '#222',
                      outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </QuestionGroup>
                <QuestionGroup label="Estado" required>
                  <input
                    value={estado} onChange={e => setEstado(e.target.value)}
                    placeholder="Ex: SP"
                    style={{
                      width: '100%', borderRadius: 8, border: `1.5px solid ${CREAM2}`,
                      padding: '9px 12px', fontSize: 13.5, color: '#222',
                      outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </QuestionGroup>
              </div>
            </SectionCard>

            {/* Sec 1: Capital */}
            <SectionCard>
              <SectionHeader number={1} title="Capital" icon="Eixo 1 de 3" />
              <QuestionGroup label="Qual a faixa de capital próprio disponível para investir?" required>
                {[
                  { value: 'nao_tenho',    label: 'Não tenho Capital para Aporte Inicial',  sub: '' },
                  { value: 'abaixo_260k',  label: 'Abaixo de R$ 260.000',                   sub: 'Abaixo do aporte mínimo' },
                  { value: '260_400k',     label: 'R$ 260.000 a R$ 400.000',                sub: '' },
                  { value: '400_600k',     label: 'R$ 400.000 a R$ 600.000',                sub: '' },
                  { value: 'acima_600k',   label: 'Acima de R$ 600.000',                    sub: '' },
                ].map(o => (
                  <RadioOption key={o.value} name="capital_faixa" value={o.value} label={o.label} sub={o.sub || undefined}
                    selected={capitalFaixa === o.value} onChange={v => { setCapitalFaixa(v); setCapitalValorDeclarado(''); }} />
                ))}
              </QuestionGroup>

              {capitalFaixa === 'abaixo_260k' && (
                <QuestionGroup label="Qual o valor aproximado disponível para investimento?" required>
                  <input
                    value={capitalValorDeclarado}
                    onChange={e => setCapitalValorDeclarado(e.target.value)}
                    placeholder="Ex: R$ 150.000"
                    style={{
                      width: '100%', borderRadius: 8, border: `1.5px solid ${CREAM2}`,
                      padding: '9px 12px', fontSize: 13.5, color: '#222',
                      outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </QuestionGroup>
              )}

              {(capitalFaixa === 'nao_tenho' || capitalFaixa === 'abaixo_260k') && (
                <div style={{
                  background: '#FFF8F0', border: '1px solid #F0C080', borderRadius: 8,
                  padding: '12px 14px', fontSize: 13, color: '#7A5020', marginTop: 4,
                }}>
                  O capital mínimo para iniciar uma operação Moní é R$ 260.000. Você pode preencher e enviar o formulário para registro, e retomar quando o capital estiver disponível.
                </div>
              )}
            </SectionCard>

            {/* Sec 2: Conhecimento */}
            <SectionCard>
              <SectionHeader number={2} title="Conhecimento" icon="Eixo 2 de 3" />
              <QuestionGroup label="Como você classifica seu conhecimento do mercado imobiliário da sua cidade?" required>
                {[
                  { value: 'alto',  label: 'Alto: conheço corretores, loteadoras e preços praticados' },
                  { value: 'medio', label: 'Médio: conheço a cidade, mas não tenho rede no mercado imobiliário' },
                  { value: 'baixo', label: 'Baixo: sou novo no mercado' },
                ].map(o => (
                  <RadioOption key={o.value} name="conhec_mercado" value={o.value} label={o.label}
                    selected={conhecMercado === o.value} onChange={setConhecMercado} />
                ))}
              </QuestionGroup>
              <QuestionGroup label="Você já fez ou acompanhou algum negócio imobiliário (compra, venda, incorporação)?" required>
                {[
                  { value: 'sim_inc',    label: 'Sim: já participei de incorporação ou desenvolvimento' },
                  { value: 'sim_compra', label: 'Sim: já comprei/vendi imóveis ou acompanhei obras' },
                  { value: 'nao',        label: 'Não: meu background é em outra área' },
                ].map(o => (
                  <RadioOption key={o.value} name="conhec_imob" value={o.value} label={o.label}
                    selected={conhecImob === o.value} onChange={setConhecImob} />
                ))}
              </QuestionGroup>
              <QuestionGroup label="Qual é o seu grau de familiaridade com o processo Moní (Step One, BCA, funil de negócios)?" required>
                {[
                  { value: 'fluente', label: 'Fluente: uso as ferramentas regularmente, negocio terrenos e consigo ser autônoma' },
                  { value: 'basico',  label: 'Básico: tenho todos os links, porém não consigo operar sozinho ou ainda não passei por muitas etapas ainda.' },
                  { value: 'pouco',   label: 'Pouco: ainda não abri os links na Área do Franqueado e não leio o Canal dos Franqueados no Whatsapp' },
                ].map(o => (
                  <RadioOption key={o.value} name="conhec_moni" value={o.value} label={o.label}
                    selected={conhecMoni === o.value} onChange={setConhecMoni} />
                ))}
              </QuestionGroup>
            </SectionCard>

            {/* Sec 3: Disponibilidade */}
            <SectionCard>
              <SectionHeader number={3} title="Disponibilidade" icon="Eixo 3 de 3" />
              <QuestionGroup label="Quantas horas por semana você consegue dedicar ao negócio Moní (reuniões, análise, decisões)?" required>
                {[
                  { value: '10+',  label: '10h ou mais por semana',   sub: 'Operação como prioridade principal.' },
                  { value: '5-10', label: '5 a 10h por semana',       sub: 'Operação como foco secundário mas consistente.' },
                  { value: '2-5',  label: '2 a 5h por semana',        sub: 'Suficiente para checkpoints e decisões rápidas.' },
                  { value: '<2',   label: 'Menos de 2h por semana',   sub: 'Pode comprometer resposta ágil nos checkpoints.' },
                ].map(o => (
                  <RadioOption key={o.value} name="tempo_horas" value={o.value} label={o.label} sub={o.sub}
                    selected={tempoHoras === o.value} onChange={setTempoHoras} />
                ))}
              </QuestionGroup>
              <QuestionGroup label="Como você responde a documentos e decisões urgentes (e-mail, WhatsApp)?" required>
                {[
                  { value: 'mesmo_dia', label: 'No mesmo dia, sempre' },
                  { value: '24h',       label: 'Em até 24h na maioria das vezes' },
                  { value: '2-3d',      label: 'Em 2 a 3 dias' },
                  { value: 'semana',    label: 'Depende: às vezes demoro mais de 3 dias' },
                ].map(o => (
                  <RadioOption key={o.value} name="tempo_resposta" value={o.value} label={o.label}
                    selected={tempoResposta === o.value} onChange={setTempoResposta} />
                ))}
              </QuestionGroup>
              <QuestionGroup label="Você tem agenda para reuniões de 30 minutos com terrenistas (online) e disponibilidade para ir ao terreno quando necessário?" required>
                {[
                  { value: 'sim_tudo',   label: 'Sim: agenda disponível para reuniões com terrenistas e visitas de campo' },
                  { value: 'sim_online', label: 'Reuniões com terrenistas sim, visita ao terreno com aviso prévio de 3+ dias' },
                  { value: 'parcial',    label: 'Agenda apertada: precisaria planejar com pelo menos 1 semana de antecedência' },
                ].map(o => (
                  <RadioOption key={o.value} name="tempo_agenda" value={o.value} label={o.label}
                    selected={tempoAgenda === o.value} onChange={setTempoAgenda} />
                ))}
              </QuestionGroup>
              <QuestionGroup label="Você já participou ou tem como participar dos Workshops da Companhia?" required>
                {[
                  { value: 'sim_ja',   label: 'Sim: já participei de workshops da Companhia' },
                  { value: 'sim_pode', label: 'Ainda não, mas tenho como participar' },
                  { value: 'nao',      label: 'Não tenho como participar no momento' },
                ].map(o => (
                  <RadioOption key={o.value} name="workshops" value={o.value} label={o.label}
                    selected={workshops === o.value} onChange={setWorkshops} />
                ))}
              </QuestionGroup>
            </SectionCard>

            {/* Sec 4: Contexto */}
            <SectionCard>
              <SectionHeader number={4} title="Contexto" icon="Informações adicionais" />
              <QuestionGroup label="Algo mais que queira compartilhar?" required>
                <textarea
                  value={motivacao} onChange={e => setMotivacao(e.target.value)}
                  placeholder="Ex: Sobre meu aporte, ainda preciso de 2 meses para fechar o valor. Em relação ao tempo, consigo dedicar umas 8h por semana e minha agenda com terrenistas é bastante flexível..."
                  rows={5}
                  style={{
                    width: '100%', borderRadius: 8, border: `1.5px solid ${CREAM2}`,
                    padding: '10px 12px', fontSize: 13.5, color: '#222', resize: 'vertical',
                    outline: 'none', fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box',
                  }}
                />
              </QuestionGroup>
            </SectionCard>

            {erroForm && (
              <div style={{
                background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
                padding: '12px 14px', fontSize: 13, color: RED, marginBottom: 16,
              }}>
                {erroForm}
              </div>
            )}

            {erroSalvar && (
              <div style={{
                background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
                padding: '12px 14px', fontSize: 13, color: RED, marginBottom: 16,
              }}>
                {erroSalvar}
              </div>
            )}

            <button
              onClick={enviarRespostas}
              disabled={salvando}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 10, border: 'none',
                background: salvando ? '#888' : GOLD, color: 'white', fontSize: 15,
                fontWeight: 700, cursor: salvando ? 'not-allowed' : 'pointer',
                letterSpacing: .5, marginBottom: 24,
              }}
            >
              {salvando ? 'Enviando...' : 'Enviar Respostas'}
            </button>
          </>
        )}

        {historico && historico.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
              Historico de respostas
            </div>
            {historico.map(h => {
              const isOpen = expandedId === h.id;
              const det = detalhes[h.id];
              const isLoading = loadingId === h.id;
              const tipoLabel = lbl('resultado_tipo', h.resultado_tipo ?? null);
              const tipoColor = h.resultado_tipo === 'qualificado' ? GREEN : h.resultado_tipo === 'parcial' ? '#A07820' : RED;
              return (
                <div key={h.id} style={{
                  background: 'white', borderRadius: 10, marginBottom: 10,
                  border: `1px solid ${isOpen ? GOLD : CREAM2}`,
                  overflow: 'hidden', transition: 'border-color .15s',
                }}>
                  {/* Row header - clickable */}
                  <button
                    onClick={() => publicToken && toggleDetalhe(h.id)}
                    style={{
                      width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '14px 18px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>Respondido</span>
                        <span style={{ fontSize: 11, color: tipoColor, fontWeight: 600, background: tipoColor + '18', borderRadius: 4, padding: '1px 7px' }}>
                          {tipoLabel}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{formatarData(h.criado_em)}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 18, fontWeight: 700, color: GREEN }}>&#10003;</span>
                      <span style={{
                        fontSize: 12, color: '#888', transform: isOpen ? 'rotate(180deg)' : 'none',
                        transition: 'transform .2s', display: 'inline-block', lineHeight: 1,
                      }}>&#9660;</span>
                    </div>
                  </button>

                  {/* Expanded details */}
                  {isOpen && (
                    <div style={{ borderTop: `1px solid ${CREAM2}`, padding: '18px 18px 20px' }}>
                      {isLoading && (
                        <div style={{ fontSize: 13, color: '#888', textAlign: 'center', padding: '12px 0' }}>Carregando...</div>
                      )}
                      {!isLoading && !det && (
                        <div style={{ fontSize: 13, color: RED }}>Nao foi possivel carregar os detalhes.</div>
                      )}
                      {!isLoading && det && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                          {/* Identificacao */}
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Identificacao</div>
                            <DetalheRow label="Nome" value={det.nome_franqueado_confirmado} />
                            <DetalheRow label="Cidade" value={det.cidade_atuacao} />
                            <DetalheRow label="Estado" value={det.estado_atuacao} />
                          </div>
                          {/* Capital */}
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Capital</div>
                            <DetalheRow label="Faixa de capital" value={lbl('capital_faixa', det.capital_faixa)} />
                            {det.capital_valor_declarado && <DetalheRow label="Valor declarado" value={det.capital_valor_declarado} />}
                            {det.score_capital_pct !== null && <DetalheRow label="Score capital" value={`${det.score_capital_pct}%`} />}
                          </div>
                          {/* Conhecimento */}
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Conhecimento</div>
                            <DetalheRow label="Mercado imobiliario" value={lbl('conhecimento_mercado', det.conhecimento_mercado)} />
                            <DetalheRow label="Experiencia imobiliaria" value={lbl('conhecimento_imob', det.conhecimento_imob)} />
                            <DetalheRow label="Familiaridade Moni" value={lbl('conhecimento_moni', det.conhecimento_moni)} />
                            {det.score_conhecimento_pct !== null && <DetalheRow label="Score conhecimento" value={`${det.score_conhecimento_pct}%`} />}
                          </div>
                          {/* Disponibilidade */}
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Disponibilidade</div>
                            <DetalheRow label="Horas por semana" value={lbl('tempo_horas', det.tempo_horas)} />
                            <DetalheRow label="Tempo de resposta" value={lbl('tempo_resposta', det.tempo_resposta)} />
                            <DetalheRow label="Agenda presencial" value={lbl('tempo_agenda', det.tempo_agenda)} />
                            <DetalheRow label="Workshops" value={lbl('workshops', det.workshops)} />
                            {det.score_tempo_pct !== null && <DetalheRow label="Score disponibilidade" value={`${det.score_tempo_pct}%`} />}
                          </div>
                          {/* Contexto */}
                          {det.motivacao && (
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Contexto / Motivacao</div>
                              <div style={{ fontSize: 13, color: '#444', lineHeight: 1.6, background: CREAM, borderRadius: 8, padding: '10px 12px' }}>
                                {det.motivacao}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
