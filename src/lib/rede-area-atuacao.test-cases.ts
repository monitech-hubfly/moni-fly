import assert from 'node:assert/strict';
import { areaAtuacaoParaLinhasExibicao } from './rede-area-atuacao';

const casos: Array<{ nome: string; input: string; expected: string[] }> = [
  {
    nome: 'quebra formato canonico separado por ponto e virgula',
    input: 'SP - Salto; SP - Porto Feliz; SP - Itu',
    expected: ['SP - Salto', 'SP - Porto Feliz', 'SP - Itu'],
  },
  {
    nome: 'quebra formato canonico separado por linhas',
    input: 'MT - Cuiaba\nMT - Chapada dos Guimaraes\nMT - Varzea Grande',
    expected: ['MT - Cuiaba', 'MT - Chapada dos Guimaraes', 'MT - Varzea Grande'],
  },
  {
    nome: 'mantem fallback por segmentos quando ha texto misto',
    input: 'SP - Salto; SP - Porto Feliz\nMT - Cuiaba',
    expected: ['SP - Salto', 'SP - Porto Feliz', 'MT - Cuiaba'],
  },
  {
    nome: 'interpreta legado em prosa',
    input: 'Belo Horizonte, Nova Lima e Brumadinho, estado de Minas Gerais',
    expected: ['MG - Belo Horizonte', 'MG - Nova Lima', 'MG - Brumadinho'],
  },
  {
    nome: 'quebra varias UFs canônicas (ex. screenshot Curitiba)',
    input: 'PR - Curitiba; PR - São José dos Pinhais; PR - Colombo',
    expected: ['PR - Curitiba', 'PR - São José dos Pinhais', 'PR - Colombo'],
  },
  {
    nome: 'prosa com estado do',
    input: 'Curitiba e Colombo, estado do Paraná',
    expected: ['PR - Curitiba', 'PR - Colombo'],
  },
];

for (const caso of casos) {
  assert.deepEqual(areaAtuacaoParaLinhasExibicao(caso.input), caso.expected, caso.nome);
}

console.log('rede-area-atuacao: ok');
