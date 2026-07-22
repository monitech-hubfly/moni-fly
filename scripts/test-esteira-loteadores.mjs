/**
 * Valida botão Pré Obra e Obra para Funil Loteadores (lógica espelhada do módulo TS).
 * Uso: node scripts/test-esteira-loteadores.mjs
 */
import assert from 'node:assert/strict';

const KANBAN_IDS = {
  STEP_ONE: '4d89f111-cef6-48aa-93ff-72d6406f0a32',
  LOTEADORES: '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c',
  ACOPLAMENTO: '15847602-231d-4937-a06f-82027eb87ef3',
  OPERACOES: 'f6bba1de-a7a1-4b14-89d1-10c2f7bba636',
  CREDITO_OBRA: '6463af1d-850d-4958-b74c-404f8d668e21',
  JURIDICO: '35fb5c8d-50c0-4999-bc16-89d53c2e758f',
};

const KANBANS_VINCULO_MANUAL_LIVRE = [
  KANBAN_IDS.STEP_ONE,
  'c57120a0-991c-422b-8def-4d16a9411d45',
  KANBAN_IDS.LOTEADORES,
  KANBAN_IDS.OPERACOES,
];
const KANBANS_COM_CHAMADO_JURIDICO = [
  'c57120a0-991c-422b-8def-4d16a9411d45',
  KANBAN_IDS.LOTEADORES,
  KANBAN_IDS.OPERACOES,
];
const KANBAN_NOME_FUNIL_LOTEADORES = 'Funil Loteadores';

function resolverKanbanOrigemIdParaEsteiraManual(kanbanId, kanbanNome) {
  const nome = String(kanbanNome ?? '').trim();
  if (nome === KANBAN_NOME_FUNIL_LOTEADORES) return KANBAN_IDS.LOTEADORES;
  const id = String(kanbanId ?? '').trim();
  if (KANBANS_VINCULO_MANUAL_LIVRE.includes(id)) return id;
  if (KANBANS_COM_CHAMADO_JURIDICO.includes(id)) return id;
  return id;
}

function kanbanEhLoteadoresOuStepOne(kanbanOrigemId, kanbanNome) {
  const nome = String(kanbanNome ?? '').trim();
  if (nome === KANBAN_NOME_FUNIL_LOTEADORES) return true;
  if (nome.toLowerCase().includes('loteador')) return true;
  const kid = String(kanbanOrigemId ?? '').trim();
  return kid === KANBAN_IDS.LOTEADORES || kid === KANBAN_IDS.STEP_ONE;
}

function basePathEhFunilLoteadores(basePath) {
  const p = String(basePath ?? '')
    .trim()
    .replace(/\/+$/, '')
    .toLowerCase();
  return p === '/loteadores' || p === '/funil-moni-inc';
}

function deveExibirBotaoPreObraObraLoteadores(kanbanId, kanbanNome, basePath) {
  const origemId = resolverKanbanOrigemIdParaEsteiraManual(kanbanId, kanbanNome);
  return (
    kanbanEhLoteadoresOuStepOne(origemId, kanbanNome) ||
    kanbanEhLoteadoresOuStepOne(kanbanId, kanbanNome) ||
    basePathEhFunilLoteadores(basePath)
  );
}

assert.equal(deveExibirBotaoPreObraObraLoteadores(KANBAN_IDS.LOTEADORES, 'Funil Loteadores', '/loteadores'), true);
assert.equal(deveExibirBotaoPreObraObraLoteadores(null, 'Funil Loteadores', '/loteadores'), true);
assert.equal(deveExibirBotaoPreObraObraLoteadores(KANBAN_IDS.ACOPLAMENTO, null, '/loteadores'), true);
assert.equal(deveExibirBotaoPreObraObraLoteadores(KANBAN_IDS.ACOPLAMENTO, null, '/portfolio'), false);

console.log('OK test-esteira-loteadores — deveExibirBotaoPreObraObraLoteadores');
