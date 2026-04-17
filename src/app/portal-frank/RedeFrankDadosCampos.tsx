'use client';

import type {
  RedeFrankCadastroPayload,
  RedeFrankFranquiaSomenteLeitura,
} from '@/lib/portal-frank/rede-cadastro-types';

const inputCls =
  'mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-900 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-400';

const readRowCls = 'mt-1 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800';

function roText(v: string | null | undefined) {
  const t = String(v ?? '').trim();
  return t || '—';
}

type Props = {
  franquiaSomenteLeitura: RedeFrankFranquiaSomenteLeitura;
  value: RedeFrankCadastroPayload;
  onChange: (next: RedeFrankCadastroPayload) => void;
};

export function RedeFrankDadosCampos({ franquiaSomenteLeitura, value, onChange }: Props) {
  function patch<K extends keyof RedeFrankCadastroPayload>(k: K, v: RedeFrankCadastroPayload[K]) {
    onChange({ ...value, [k]: v });
  }

  const ro = franquiaSomenteLeitura;

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-stone-800">Informações da franquia</h3>
        <p className="text-xs text-stone-500">Definidas pela Moní — somente leitura.</p>
        <div className="space-y-3">
          <div>
            <span className="block text-sm font-medium text-stone-700">Nº de Franquia</span>
            <p className={readRowCls}>{roText(ro.n_franquia)}</p>
          </div>
          <div>
            <span className="block text-sm font-medium text-stone-700">Modalidade</span>
            <p className={readRowCls}>{roText(ro.modalidade)}</p>
          </div>
          <div>
            <span className="block text-sm font-medium text-stone-700">Nome completo do franqueado</span>
            <p className={readRowCls}>{roText(ro.nome_completo)}</p>
          </div>
          <div>
            <span className="block text-sm font-medium text-stone-700">Status da franquia</span>
            <p className={readRowCls}>{roText(ro.status_franquia)}</p>
          </div>
          <div>
            <span className="block text-sm font-medium text-stone-700">Regional</span>
            <p className={readRowCls}>{roText(ro.regional)}</p>
          </div>
          <div>
            <span className="block text-sm font-medium text-stone-700">Área de atuação da franquia</span>
            <p className={`${readRowCls} whitespace-pre-wrap`}>{roText(ro.area_atuacao)}</p>
          </div>
          <div>
            <span className="block text-sm font-medium text-stone-700">Responsável comercial</span>
            <p className={readRowCls}>{roText(ro.responsavel_comercial)}</p>
          </div>
        </div>
      </section>

      <section className="space-y-4 border-t border-stone-200 pt-6">
        <h3 className="text-sm font-semibold text-stone-800">Seus dados de contato</h3>
        <p className="text-xs text-stone-500">Você pode atualizar estes campos na rede.</p>

        <label className="block text-sm font-medium text-stone-700">
          E-mail (Frank)
          <input
            type="email"
            autoComplete="email"
            value={value.email_frank}
            onChange={(e) => patch('email_frank', e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="block text-sm font-medium text-stone-700">
          Telefone
          <input
            type="tel"
            value={value.telefone_frank}
            onChange={(e) => patch('telefone_frank', e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="block text-sm font-medium text-stone-700">
          Data de nascimento
          <input
            type="date"
            value={value.data_nasc_frank ?? ''}
            onChange={(e) => patch('data_nasc_frank', e.target.value ? e.target.value : null)}
            className={inputCls}
          />
        </label>
        <label className="block text-sm font-medium text-stone-700">
          CPF
          <input
            type="text"
            autoComplete="off"
            value={value.cpf_frank}
            onChange={(e) => patch('cpf_frank', e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="block text-sm font-medium text-stone-700">
          Endereço (rua)
          <input
            type="text"
            value={value.endereco_casa_frank}
            onChange={(e) => patch('endereco_casa_frank', e.target.value)}
            className={inputCls}
          />
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-stone-700">
            Número
            <input
              type="text"
              value={value.endereco_casa_frank_numero}
              onChange={(e) => patch('endereco_casa_frank_numero', e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block text-sm font-medium text-stone-700">
            Complemento
            <input
              type="text"
              value={value.endereco_casa_frank_complemento}
              onChange={(e) => patch('endereco_casa_frank_complemento', e.target.value)}
              className={inputCls}
            />
          </label>
        </div>
        <label className="block text-sm font-medium text-stone-700">
          CEP
          <input
            type="text"
            inputMode="numeric"
            value={value.cep_casa_frank}
            onChange={(e) => patch('cep_casa_frank', e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="block text-sm font-medium text-stone-700">
          Tamanho da camiseta
          <input
            type="text"
            placeholder="Ex.: M, G, GG"
            value={value.tamanho_camisa_frank}
            onChange={(e) => patch('tamanho_camisa_frank', e.target.value)}
            className={inputCls}
          />
        </label>
      </section>
    </div>
  );
}
