'use client';

export type PipelineFunilRedeVisao = 'mes' | 'provisionado';

type Props = {
  value: PipelineFunilRedeVisao;
  onChange: (value: PipelineFunilRedeVisao) => void;
};

export function PipelineFunilRedeVisaoToggle({ value, onChange }: Props) {
  const tab = (id: PipelineFunilRedeVisao, label: string) => {
    const active = value === id;
    return (
      <button
        type="button"
        onClick={() => onChange(id)}
        className={`moni-pipeline-funil-underline-tab${active ? ' moni-pipeline-funil-underline-tab--active' : ''}`}
        aria-pressed={active}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="moni-pipeline-funil-underline-tabs" role="group" aria-label="Tipo de funil">
      {tab('mes', 'Funil mês')}
      {tab('provisionado', 'Provisionado')}
    </div>
  );
}
