-- Migration 509: adimplência financeira na rede de franqueados
-- true = adimplente | false = inadimplente | NULL = não aferido

ALTER TABLE rede_franqueados
  ADD COLUMN IF NOT EXISTS diag_adimplente boolean;

COMMENT ON COLUMN rede_franqueados.diag_adimplente IS 'Adimplência financeira: true=adimplente, false=inadimplente, NULL=não aferido';

NOTIFY pgrst, 'reload schema';
