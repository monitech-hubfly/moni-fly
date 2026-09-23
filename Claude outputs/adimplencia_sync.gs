// ============================================================
// Moní Casa — Sync Adimplência → Hub Fly
// Planilha: "Controle de Franquias", aba "Franqueados"
// Coluna A: código FK (ex: FK0001)
// Coluna O: status adimplência ("Em dia", "Em atraso", "Transferência")
// ============================================================

var SYNC_URL    = "https://moni-fly.vercel.app/api/sheets/adimplencia-sync";
var SYNC_SECRET = "06e33b791b6600a17c55f5ade9e057e8ca1007ce9fbfd45b0b5c55f1334cebd0";
var ABA_NOME    = "Franqueados";
var COL_FK      = 1;  // Coluna A
var COL_STATUS  = 15; // Coluna O
var LINHA_INICIO = 2; // Pular cabeçalho

// ============================================================
// TRIGGER AUTOMÁTICO — instalar via: Extensões > Apps Script
// > Acionadores > Adicionar acionador > onEdit (evento: ao editar)
// ============================================================
function onEdit(e) {
  var range = e.range;

  // Ignorar se não for a aba correta
  if (range.getSheet().getName() !== ABA_NOME) return;

  // Ignorar se não for a coluna O
  if (range.getColumn() !== COL_STATUS) return;

  // Ignorar se for cabeçalho
  if (range.getRow() < LINHA_INICIO) return;

  var linha  = range.getRow();
  var sheet  = range.getSheet();
  var fk     = sheet.getRange(linha, COL_FK).getValue();
  var status = range.getValue();

  if (!fk || !status) return;

  var payload = [{ fk: fk.toString().trim(), status: status.toString().trim() }];
  _enviarParaHubFly(payload);
}

// ============================================================
// BULK SYNC MANUAL — rodar uma vez para sincronizar tudo
// ============================================================
function syncAdimplenciaCompleto() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(ABA_NOME);

  if (!sheet) {
    Logger.log("Aba '" + ABA_NOME + "' não encontrada.");
    return;
  }

  var ultima = sheet.getLastRow();
  var dados  = sheet.getRange(LINHA_INICIO, COL_FK, ultima - LINHA_INICIO + 1, COL_STATUS).getValues();

  var payload = [];

  for (var i = 0; i < dados.length; i++) {
    var fk     = dados[i][COL_FK - 1];
    var status = dados[i][COL_STATUS - 1];

    if (!fk || !status) continue;

    fk     = fk.toString().trim();
    status = status.toString().trim();

    if (!fk || !status) continue;

    payload.push({ fk: fk, status: status });
  }

  if (payload.length === 0) {
    Logger.log("Nenhum registro com FK + status encontrado.");
    return;
  }

  Logger.log("Enviando " + payload.length + " registros...");
  var resultado = _enviarParaHubFly(payload);
  Logger.log("Resultado: " + JSON.stringify(resultado));
}

// ============================================================
// INTERNO — envia payload para o Hub Fly
// ============================================================
function _enviarParaHubFly(payload) {
  var opcoes = {
    method:      "post",
    contentType: "application/json",
    headers:     { "x-sync-secret": SYNC_SECRET },
    payload:     JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    var resposta = UrlFetchApp.fetch(SYNC_URL, opcoes);
    var codigo   = resposta.getResponseCode();
    var corpo    = resposta.getContentText();

    Logger.log("HTTP " + codigo + " — " + corpo);
    return JSON.parse(corpo);
  } catch (err) {
    Logger.log("Erro ao chamar Hub Fly: " + err.toString());
    return null;
  }
}
