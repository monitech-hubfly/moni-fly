import { assertCasosValidacaoConversao } from '../src/lib/kanban/painel-conversao-classify.test-cases';

try {
  assertCasosValidacaoConversao();
  console.log('OK — casos de validação de conversão passaram.');
} catch (e) {
  console.error(e);
  process.exit(1);
}
