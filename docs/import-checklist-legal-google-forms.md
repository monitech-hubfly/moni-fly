# Importação — Checklist Legal (Google Forms)

Este documento descreve como importar respostas históricas do Google Forms para `checklist_legal_condominio`.

## Fonte

- Formulário público: `1FAIpQLSdj7c7Y8shtqmrNy0ZiR4B2BiHzmiaRxDTG_qBJrt7FxGmCVw`
- ID de edição: `1rplHZJuazcGiC0_NNXcbO-OmDtQV6qj4V4vcQ7vncCQ`

## Abordagem recomendada (MVP)

1. Exportar respostas do Google Forms como **CSV** (Planilhas → Arquivo → Fazer download → CSV).
2. Executar o script stub:

```bash
node scripts/import-checklist-legal-google-forms.mjs --csv caminho/respostas.csv --dry-run
node scripts/import-checklist-legal-google-forms.mjs --csv caminho/respostas.csv
```

3. O script deve:
   - Resolver `condominio_id` pelo nome do condomínio (`condominios.nome`, normalizado).
   - Mapear colunas CSV → chaves em `respostas_json` / `arquivos_json` (ver `src/lib/checklist-legal/form-definition.ts`).
   - Criar versão `concluido` com `card_origem_id` nulo e registrar `checklist_legal_log` (`acao: import_csv`).

## Mapeamento de colunas

Consulte `scripts/import-checklist-legal-google-forms.mjs` para o mapa inicial. Campos com upload no Forms exigem re-upload manual ou migração de arquivos do Drive para `processo-docs/checklist-legal/...`.

## API Google (futuro)

Alternativa automatizada: Google Forms API + Drive API com service account, cron administrativo. Requer credenciais GCP e mapeamento de `fileUploadAnswers`.

## Pós-importação

- Validar amostra no modal do card (Dados do Negócio → Checklist Legal).
- Conferir gate: cards só avançam após versão `concluido` existir para o `condominio_id`.
