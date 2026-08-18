'use client'

import { useMemo } from 'react'
import { BANCOS_BRASIL } from '@/lib/bancos-br'
import {
  maskCpfCnpj,
  maskPixChave,
  maskTelefoneCelular,
  onlyDigits,
  pixInputMode,
  validarCpfCnpjOpcional,
  validarCreciOpcional,
  validarEmailOpcional,
  validarPixChaveOpcional,
  validarTelefoneCelularOpcional,
  type PixTipo,
} from '@/lib/br-docs'
import type { RedeCorretorFichaDraft } from '@/lib/rede-corretor-ficha-draft'
import {
  REDE_CORRETOR_PIX_TIPO_LABEL,
  REDE_CORRETOR_STATUS_LABEL,
  REDE_CORRETOR_TIPO_REGISTRO_LABEL,
  type RedeCorretorTipoRegistro,
} from '@/lib/rede-corretores'
import { UFS_BRASIL } from '@/lib/uf'

const inputCls = 'w-full min-w-0 rounded-md border border-stone-300 px-3 py-2 text-sm'
const labelCls = 'mb-1 block text-xs font-medium text-stone-600'
const hintCls = 'mt-0.5 text-[11px] text-stone-500'
const errCls = 'mt-0.5 text-[11px] text-red-600'
const legendCls = 'text-sm font-semibold text-stone-900'

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string | null
  children: React.ReactNode
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
      {error ? <p className={errCls}>{error}</p> : hint ? <p className={hintCls}>{hint}</p> : null}
    </div>
  )
}

type Props = {
  draft: RedeCorretorFichaDraft
  onChange: (patch: Partial<RedeCorretorFichaDraft>) => void
  showStatus?: boolean
}

export function RedeCorretorFichaForm({ draft, onChange, showStatus = true }: Props) {
  const isPj = onlyDigits(draft.cpf_cnpj).length > 11

  const errCpf = useMemo(() => {
    const r = validarCpfCnpjOpcional(draft.cpf_cnpj)
    return r.ok ? null : r.error
  }, [draft.cpf_cnpj])

  const errCreci = useMemo(() => {
    const r = validarCreciOpcional(draft.creci_numero)
    return r.ok ? null : r.error
  }, [draft.creci_numero])

  const errEmail = useMemo(() => {
    const r = validarEmailOpcional(draft.email)
    return r.ok ? null : r.error
  }, [draft.email])

  const errTel = useMemo(() => {
    const r = validarTelefoneCelularOpcional(draft.telefone)
    return r.ok ? null : r.error
  }, [draft.telefone])

  const errPix = useMemo(() => {
    const r = validarPixChaveOpcional(draft.conta_pix_tipo, draft.conta_pix_chave)
    return r.ok ? null : r.error
  }, [draft.conta_pix_tipo, draft.conta_pix_chave])

  function setNome(nome: string) {
    const patch: Partial<RedeCorretorFichaDraft> = { nome }
    if (!isPj && !draft.conta_titular.trim()) {
      patch.conta_titular = nome
    } else if (!isPj && draft.conta_titular === draft.nome) {
      patch.conta_titular = nome
    }
    onChange(patch)
  }

  return (
    <div className="space-y-5">
      <fieldset className="space-y-3">
        <legend className={legendCls}>Dados pessoais</legend>
        <Field label="Nome completo ou Razão Social">
          <input
            type="text"
            value={draft.nome}
            onChange={(e) => setNome(e.target.value)}
            className={inputCls}
            autoComplete="name"
            required
          />
        </Field>
        <Field
          label="CPF / CNPJ"
          hint="Máscara automática: 11 dígitos = CPF, 14 = CNPJ"
          error={errCpf}
        >
          <input
            type="text"
            inputMode="numeric"
            value={draft.cpf_cnpj}
            onChange={(e) => onChange({ cpf_cnpj: maskCpfCnpj(e.target.value) })}
            className={inputCls}
            placeholder="000.000.000-00 ou 00.000.000/0000-00"
          />
        </Field>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className={legendCls}>Habilitação profissional</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Número de inscrição no CRECI" error={errCreci}>
            <input
              type="text"
              value={draft.creci_numero}
              onChange={(e) =>
                onChange({ creci_numero: e.target.value.replace(/[^A-Za-z0-9./-]/g, '').slice(0, 20) })
              }
              className={inputCls}
              placeholder="Ex.: 12345-F"
            />
          </Field>
          <Field label="UF do CRECI">
            <select
              value={draft.creci_uf}
              onChange={(e) => onChange({ creci_uf: e.target.value })}
              className={inputCls}
            >
              <option value="">Selecione</option>
              {UFS_BRASIL.map((u) => (
                <option key={u.sigla} value={u.sigla}>
                  {u.sigla} — {u.nome}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tipo de registro">
            <select
              value={draft.creci_tipo_registro}
              onChange={(e) =>
                onChange({
                  creci_tipo_registro: e.target.value as RedeCorretorTipoRegistro | '',
                })
              }
              className={inputCls}
            >
              <option value="">Selecione</option>
              {(Object.keys(REDE_CORRETOR_TIPO_REGISTRO_LABEL) as RedeCorretorTipoRegistro[]).map(
                (k) => (
                  <option key={k} value={k}>
                    {REDE_CORRETOR_TIPO_REGISTRO_LABEL[k]}
                  </option>
                ),
              )}
            </select>
          </Field>
          <Field label="Data de validade">
            <input
              type="date"
              value={draft.creci_validade}
              onChange={(e) => onChange({ creci_validade: e.target.value })}
              className={inputCls}
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className={legendCls}>Contato</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="E-mail" error={errEmail}>
            <input
              type="email"
              value={draft.email}
              onChange={(e) => onChange({ email: e.target.value })}
              className={inputCls}
              autoComplete="email"
            />
          </Field>
          <Field label="Telefone celular" hint="(XX) 9XXXX-XXXX" error={errTel}>
            <input
              type="tel"
              inputMode="numeric"
              value={draft.telefone}
              onChange={(e) => onChange({ telefone: maskTelefoneCelular(e.target.value) })}
              className={inputCls}
              placeholder="(11) 91234-5678"
              autoComplete="tel"
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className={legendCls}>Dados bancários</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Banco">
            <select
              value={draft.conta_banco_codigo}
              onChange={(e) => onChange({ conta_banco_codigo: e.target.value })}
              className={inputCls}
            >
              <option value="">Selecione</option>
              {BANCOS_BRASIL.map((b) => (
                <option key={b.codigo} value={b.codigo}>
                  {b.codigo} — {b.nome}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Agência" hint="Com dígito opcional">
            <input
              type="text"
              inputMode="numeric"
              value={draft.conta_agencia}
              onChange={(e) =>
                onChange({ conta_agencia: e.target.value.replace(/[^\d-]/g, '').slice(0, 8) })
              }
              className={inputCls}
              placeholder="0001 ou 0001-0"
            />
          </Field>
          <Field label="Conta" hint="Com dígito verificador">
            <input
              type="text"
              inputMode="numeric"
              value={draft.conta_numero}
              onChange={(e) =>
                onChange({ conta_numero: e.target.value.replace(/[^\d-Xx]/g, '').slice(0, 16) })
              }
              className={inputCls}
              placeholder="12345-6"
            />
          </Field>
          <Field label="Tipo de conta">
            <div className="mt-1 flex flex-wrap gap-4 text-sm text-stone-800">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="conta_tipo"
                  checked={draft.conta_tipo === 'corrente'}
                  onChange={() => onChange({ conta_tipo: 'corrente' })}
                />
                Corrente
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="conta_tipo"
                  checked={draft.conta_tipo === 'poupanca'}
                  onChange={() => onChange({ conta_tipo: 'poupanca' })}
                />
                Poupança
              </label>
            </div>
          </Field>
          <Field
            label="Titular da conta"
            hint={isPj ? 'Editável (PJ)' : 'Pré-preenchido com o nome; editável se necessário'}
          >
            <input
              type="text"
              value={draft.conta_titular}
              onChange={(e) => onChange({ conta_titular: e.target.value })}
              className={inputCls}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tipo da chave Pix">
            <select
              value={draft.conta_pix_tipo}
              onChange={(e) => {
                const tipo = e.target.value as PixTipo | ''
                onChange({
                  conta_pix_tipo: tipo,
                  conta_pix_chave: tipo
                    ? maskPixChave(tipo, draft.conta_pix_chave)
                    : draft.conta_pix_chave,
                })
              }}
              className={inputCls}
            >
              <option value="">Selecione</option>
              {(Object.keys(REDE_CORRETOR_PIX_TIPO_LABEL) as PixTipo[]).map((k) => (
                <option key={k} value={k}>
                  {REDE_CORRETOR_PIX_TIPO_LABEL[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Chave Pix" error={errPix}>
            <input
              type={draft.conta_pix_tipo === 'email' ? 'email' : 'text'}
              inputMode={draft.conta_pix_tipo ? pixInputMode(draft.conta_pix_tipo) : 'text'}
              value={draft.conta_pix_chave}
              onChange={(e) => {
                const tipo = draft.conta_pix_tipo
                onChange({
                  conta_pix_chave: tipo ? maskPixChave(tipo, e.target.value) : e.target.value,
                })
              }}
              className={inputCls}
              placeholder={
                draft.conta_pix_tipo === 'email'
                  ? 'email@exemplo.com'
                  : draft.conta_pix_tipo === 'telefone'
                    ? '(11) 91234-5678'
                    : draft.conta_pix_tipo === 'aleatoria'
                      ? 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
                      : 'CPF, CNPJ, e-mail…'
              }
            />
          </Field>
        </div>
      </fieldset>

      {showStatus ? (
        <fieldset className="space-y-3">
          <legend className={legendCls}>Status</legend>
          <Field label="Status do cadastro">
            <select
              value={draft.status}
              onChange={(e) =>
                onChange({ status: e.target.value as RedeCorretorFichaDraft['status'] })
              }
              className={inputCls}
            >
              {(Object.keys(REDE_CORRETOR_STATUS_LABEL) as Array<keyof typeof REDE_CORRETOR_STATUS_LABEL>).map(
                (k) => (
                  <option key={k} value={k}>
                    {REDE_CORRETOR_STATUS_LABEL[k]}
                  </option>
                ),
              )}
            </select>
          </Field>
          <Field label="Observações">
            <textarea
              rows={3}
              value={draft.observacoes}
              onChange={(e) => onChange({ observacoes: e.target.value })}
              className={`${inputCls} resize-y`}
            />
          </Field>
        </fieldset>
      ) : null}
    </div>
  )
}
