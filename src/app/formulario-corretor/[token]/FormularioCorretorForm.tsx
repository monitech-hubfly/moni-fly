'use client';

import { useState, useTransition } from 'react';
import { submeterFormularioCorretorLead } from '@/lib/actions/corretor-lead-actions';

const TIPOLOGIAS = [
  'Casa Térrea',
  'Sobrado',
  'Casa de Campo',
  'Casa de Praia',
  'Outro',
] as const;

type Props = {
  token: string;
  nomeCorretor: string;
  imobiliaria: string;
};

export function FormularioCorretorForm({ token, nomeCorretor, imobiliaria }: Props) {
  const [nomeCliente, setNomeCliente] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [empreendimento, setEmpreendimento] = useState('');
  const [tipologia, setTipologia] = useState('');
  const [orcamento, setOrcamento] = useState('');
  const [cidade, setCidade] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    startTransition(async () => {
      const res = await submeterFormularioCorretorLead({
        token,
        nome_cliente: nomeCliente,
        telefone,
        email: email || null,
        empreendimento_interesse: empreendimento || null,
        tipologia_interesse: tipologia || null,
        orcamento_estimado: orcamento || null,
        cidade_interesse: cidade || null,
        mensagem_livre: mensagem || null,
      });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      setOk(true);
    });
  }

  if (ok) {
    return (
      <div className="space-y-3 text-center">
        <p
          className="text-xl font-semibold"
          style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-display)' }}
        >
          Lead enviado com sucesso
        </p>
        <p className="text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
          A equipe Moní recebeu os dados e entrará em contato. Obrigado, {nomeCorretor}!
        </p>
      </div>
    );
  }

  const fieldCls =
    'mt-1 w-full rounded-[var(--moni-radius-md)] px-3 py-2 text-sm min-h-[44px]';
  const fieldStyle = {
    border: '0.5px solid var(--moni-border-default)',
    color: 'var(--moni-text-primary)',
    background: 'var(--moni-surface-0)',
  } as const;

  return (
    <form onSubmit={submit} className="space-y-4">
      <div
        className="rounded-[var(--moni-radius-md)] px-3 py-2 text-sm"
        style={{
          background: 'var(--moni-kanban-corretores-light)',
          color: 'var(--moni-kanban-corretores)',
          border: '0.5px solid var(--moni-kanban-corretores-accent)',
        }}
      >
        Corretor: <strong>{nomeCorretor}</strong>
        {imobiliaria ? <> · {imobiliaria}</> : null}
      </div>

      <label className="block text-sm">
        <span style={{ color: 'var(--moni-text-primary)' }}>Nome do cliente *</span>
        <input
          required
          value={nomeCliente}
          onChange={(e) => setNomeCliente(e.target.value)}
          className={fieldCls}
          style={fieldStyle}
        />
      </label>

      <label className="block text-sm">
        <span style={{ color: 'var(--moni-text-primary)' }}>Telefone *</span>
        <input
          required
          type="tel"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          className={fieldCls}
          style={fieldStyle}
        />
      </label>

      <label className="block text-sm">
        <span style={{ color: 'var(--moni-text-primary)' }}>E-mail</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={fieldCls}
          style={fieldStyle}
        />
      </label>

      <label className="block text-sm">
        <span style={{ color: 'var(--moni-text-primary)' }}>Empreendimento de interesse</span>
        <input
          value={empreendimento}
          onChange={(e) => setEmpreendimento(e.target.value)}
          className={fieldCls}
          style={fieldStyle}
        />
      </label>

      <label className="block text-sm">
        <span style={{ color: 'var(--moni-text-primary)' }}>Tipologia de interesse</span>
        <select
          value={tipologia}
          onChange={(e) => setTipologia(e.target.value)}
          className={fieldCls}
          style={fieldStyle}
        >
          <option value="">Selecione</option>
          {TIPOLOGIAS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span style={{ color: 'var(--moni-text-primary)' }}>Orçamento estimado</span>
        <input
          value={orcamento}
          onChange={(e) => setOrcamento(e.target.value)}
          placeholder="Ex.: 850000"
          className={fieldCls}
          style={fieldStyle}
        />
      </label>

      <label className="block text-sm">
        <span style={{ color: 'var(--moni-text-primary)' }}>Cidade de interesse</span>
        <input
          value={cidade}
          onChange={(e) => setCidade(e.target.value)}
          className={fieldCls}
          style={fieldStyle}
        />
      </label>

      <label className="block text-sm">
        <span style={{ color: 'var(--moni-text-primary)' }}>Mensagem</span>
        <textarea
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-[var(--moni-radius-md)] px-3 py-2 text-sm"
          style={fieldStyle}
        />
      </label>

      {erro ? (
        <p className="text-sm" style={{ color: 'var(--moni-danger-600, #9b2c2c)' }}>
          {erro}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full min-h-[44px] rounded-[var(--moni-radius-md)] text-sm font-medium text-white disabled:opacity-60"
        style={{ background: 'var(--moni-navy-800)' }}
      >
        {pending ? 'Enviando…' : 'Enviar lead'}
      </button>
    </form>
  );
}
