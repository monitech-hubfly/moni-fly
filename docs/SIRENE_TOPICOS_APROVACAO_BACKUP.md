# Backup: Fluxo de Aprovação Bombeiro nos Tópicos do Sirene

Desativado na migration `118_subinteracoes.sql`.
As colunas `aprovado_bombeiro` e `motivo_reprovacao` permanecem na tabela — apenas o fluxo de UI/actions foi desativado.

---

## Fluxo original

1. Time responsável conclui o tópico via `concluirTopico()`, preenchendo `resolucao_time` e mudando `status → concluido`.
2. Bombeiro revisa e chama `aprovarTopico()` ou `reprovarTopico()`.
   - **Aprovação**: `status → aprovado`, `aprovado_bombeiro = true`, `motivo_reprovacao = null`.
   - **Reprovação**: `status → em_andamento`, `aprovado_bombeiro = false`, `motivo_reprovacao = <texto>`.
3. `fecharChamado()` só avança quando **todos** os tópicos estão `status = 'aprovado'`.

O `TopicoStatus` em `src/types/sirene.ts` incluía o valor `'aprovado'` exatamente por esse motivo.

---

## Colunas afetadas em `public.sirene_topicos`

| Coluna | Tipo | Papel no fluxo |
|---|---|---|
| `aprovado_bombeiro` | `BOOLEAN` | `true` = aprovado, `false` = reprovado, `NULL` = pendente |
| `motivo_reprovacao` | `TEXT` | Preenchido pelo Bombeiro ao reprovar |

---

## Actions em `src/app/sirene/actions.ts`

### `aprovarTopico(topicoId: number)`
- **Linha ~697**
- Permissão: `canActAsBombeiro` (Bombeiro ou time HDM responsável)
- Efeito: `status = 'aprovado'`, `aprovado_bombeiro = true`, `motivo_reprovacao = null`
- Notifica: usuários do `time_responsavel` do tópico com tipo `'topico_aprovado'`

### `reprovarTopico(topicoId: number, motivo: string)`
- **Linha ~748**
- Permissão: `canActAsBombeiro`
- Efeito: `status = 'em_andamento'`, `aprovado_bombeiro = false`, `motivo_reprovacao = motivo`
- Notifica: usuários do `time_responsavel` com tipo `'topico_reprovado'` + criador do chamado

### Dependência em `fecharChamado()` (~linha 811)
```ts
const todosAprovados = lista.every((t) => t.status === 'aprovado');
if (!todosAprovados)
  return { ok: false, error: 'Todos os tópicos precisam estar aprovados...' };
```
Se reativar o fluxo, essa guarda precisa continuar presente.

### Dependência em `getDashboardData()` (~linha 1362)
```ts
const { data: todosTopicos } = await queryClient
  .from('sirene_topicos')
  .select('chamado_id, status, aprovado_bombeiro');
// ...
if (t.status === 'aprovado' || t.aprovado_bombeiro === true) cur.aprovados++;
```
Lê `aprovado_bombeiro` para contabilizar tópicos aprovados no dashboard do Bombeiro.

---

## Como reativar

1. Remover os `COMMENT ON COLUMN ... DESATIVADO` adicionados na migration 118 (ou criar nova migration revertendo).
2. Reexpor os botões "Aprovar" / "Reprovar" no componente `DetalheChamadoConteudo.tsx`.
3. Garantir que `fecharChamado()` continua exigindo `todos os tópicos aprovados`.
4. Atualizar `TopicoStatus` em `src/types/sirene.ts` se o valor `'aprovado'` tiver sido removido.
5. Não é necessária nenhuma migration de dados — as colunas e os dados existentes foram preservados.
