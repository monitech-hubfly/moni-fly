/** Máscaras e validação de documentos/contato BR (CPF, CNPJ, telefone, Pix). */

export function onlyDigits(s: string | null | undefined): string {
  return String(s ?? '').replace(/\D/g, '')
}

/** Máscara dinâmica: CPF (11) ou CNPJ (14). */
export function maskCpfCnpj(value: string): string {
  const n = onlyDigits(value).slice(0, 14)
  if (n.length <= 11) {
    return n
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2')
  }
  return n
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

export function validarCPF(cpf: string): boolean {
  const nums = onlyDigits(cpf)
  if (nums.length !== 11) return false
  if (/^(\d)\1+$/.test(nums)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(nums[i]!, 10) * (10 - i)
  let rest = (sum * 10) % 11
  if (rest === 10) rest = 0
  if (rest !== parseInt(nums[9]!, 10)) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(nums[i]!, 10) * (11 - i)
  rest = (sum * 10) % 11
  if (rest === 10) rest = 0
  return rest === parseInt(nums[10]!, 10)
}

export function validarCNPJ(cnpj: string): boolean {
  const nums = onlyDigits(cnpj)
  if (nums.length !== 14) return false
  if (/^(\d)\1+$/.test(nums)) return false
  const calc = (n: string, len: number) => {
    let sum = 0
    let pos = len - 7
    for (let i = len; i >= 1; i--) {
      sum += parseInt(n[len - i]!, 10) * pos--
      if (pos < 2) pos = 9
    }
    return sum % 11 < 2 ? 0 : 11 - (sum % 11)
  }
  return calc(nums, 12) === parseInt(nums[12]!, 10) && calc(nums, 13) === parseInt(nums[13]!, 10)
}

/** Vazio = ok (campo opcional); preenchido exige dígitos e DV. */
export function validarCpfCnpjOpcional(value: string): { ok: true } | { ok: false; error: string } {
  const n = onlyDigits(value)
  if (!n) return { ok: true }
  if (n.length <= 11) {
    if (n.length !== 11) return { ok: false, error: 'CPF incompleto.' }
    return validarCPF(n) ? { ok: true } : { ok: false, error: 'CPF inválido.' }
  }
  if (n.length !== 14) return { ok: false, error: 'CNPJ incompleto.' }
  return validarCNPJ(n) ? { ok: true } : { ok: false, error: 'CNPJ inválido.' }
}

/** (XX) 9XXXX-XXXX — celular BR. */
export function maskTelefoneCelular(value: string): string {
  const n = onlyDigits(value).slice(0, 11)
  if (n.length <= 2) return n.length ? `(${n}` : ''
  if (n.length <= 7) return `(${n.slice(0, 2)}) ${n.slice(2)}`
  return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`
}

export function validarTelefoneCelularOpcional(
  value: string,
): { ok: true } | { ok: false; error: string } {
  const n = onlyDigits(value)
  if (!n) return { ok: true }
  if (n.length !== 11) return { ok: false, error: 'Celular deve ter DDD + 9 dígitos.' }
  if (n[2] !== '9') return { ok: false, error: 'Celular deve iniciar com 9 após o DDD.' }
  return { ok: true }
}

export function validarEmailOpcional(value: string): { ok: true } | { ok: false; error: string } {
  const v = value.trim()
  if (!v) return { ok: true }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { ok: false, error: 'E-mail inválido.' }
  return { ok: true }
}

/** CRECI: alfanumérico, 3–20 chars quando preenchido. */
export function validarCreciOpcional(value: string): { ok: true } | { ok: false; error: string } {
  const v = value.trim()
  if (!v) return { ok: true }
  if (!/^[A-Za-z0-9./-]{3,20}$/.test(v)) {
    return { ok: false, error: 'CRECI inválido (use letras, números, . / -).' }
  }
  return { ok: true }
}

export type PixTipo = 'cpf_cnpj' | 'email' | 'telefone' | 'aleatoria'

export function maskPixChave(tipo: PixTipo, value: string): string {
  if (tipo === 'cpf_cnpj') return maskCpfCnpj(value)
  if (tipo === 'telefone') return maskTelefoneCelular(value)
  if (tipo === 'aleatoria') {
    return value.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 36)
  }
  return value.trim()
}

export function pixInputMode(tipo: PixTipo): 'numeric' | 'email' | 'text' {
  if (tipo === 'cpf_cnpj' || tipo === 'telefone') return 'numeric'
  if (tipo === 'email') return 'email'
  return 'text'
}

export function validarPixChaveOpcional(
  tipo: PixTipo | '',
  chave: string,
): { ok: true } | { ok: false; error: string } {
  const v = chave.trim()
  if (!v) return { ok: true }
  if (!tipo) return { ok: false, error: 'Selecione o tipo da chave Pix.' }
  if (tipo === 'cpf_cnpj') return validarCpfCnpjOpcional(v)
  if (tipo === 'email') return validarEmailOpcional(v)
  if (tipo === 'telefone') return validarTelefoneCelularOpcional(v)
  if (tipo === 'aleatoria') {
    if (v.length < 8) return { ok: false, error: 'Chave aleatória muito curta.' }
    return { ok: true }
  }
  return { ok: true }
}
