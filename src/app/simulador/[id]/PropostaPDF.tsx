import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { formatarMoeda } from '@/lib/simulador/calcular-oferta';
import type { PropostaPdfPayload } from '@/lib/simulador/proposta-pdf-data';
import {
  dataEmissaoExtenso,
  dataGeracaoCurta,
  FASE_FLUXO_LABEL,
  formatarMoedaProposta,
  refProposta,
} from '@/lib/simulador/fluxo-proposta';

const MARGIN = 71; // 2,5 cm

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#333333',
    paddingTop: MARGIN,
    paddingBottom: MARGIN + 28,
    paddingHorizontal: MARGIN,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  logo: { width: 140 },
  logoFallback: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 18,
    color: '#000000',
    letterSpacing: 2,
  },
  tituloDoc: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 13,
    color: '#000000',
    textAlign: 'right',
  },
  ref: {
    fontSize: 8,
    color: '#333333',
    textAlign: 'right',
    marginTop: 4,
  },
  linha: {
    borderBottomWidth: 0.8,
    borderBottomColor: '#000000',
    marginTop: 10,
    marginBottom: 16,
  },
  secao: { marginBottom: 14 },
  secaoTitulo: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    color: '#000000',
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  label: { width: 160, color: '#333333' },
  valor: { flex: 1, color: '#000000' },
  destaque: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  destaqueLabel: {
    fontSize: 8,
    letterSpacing: 0.6,
    color: '#333333',
    marginBottom: 4,
  },
  destaqueValor: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 16,
    color: '#000000',
  },
  table: {
    borderWidth: 0.6,
    borderColor: '#000000',
  },
  th: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderBottomWidth: 0.6,
    borderBottomColor: '#000000',
  },
  tr: {
    flexDirection: 'row',
    borderBottomWidth: 0.4,
    borderBottomColor: '#CCCCCC',
  },
  td: { paddingVertical: 4, paddingHorizontal: 6, fontSize: 8 },
  tdMes: { width: 40 },
  tdFase: { width: 78 },
  tdEntrada: { flex: 1, textAlign: 'right' },
  tdSaidas: { width: 88, textAlign: 'right' },
  tdValor: { width: 90, textAlign: 'right' },
  tdCompNome: { flex: 1 },
  nota: {
    fontFamily: 'Helvetica-Oblique',
    fontSize: 8,
    color: '#333333',
    marginTop: 8,
    lineHeight: 1.4,
  },
  legal: {
    fontSize: 9,
    color: '#333333',
    lineHeight: 1.45,
    textAlign: 'justify',
  },
  assinaturas: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 36,
  },
  assinaCol: { width: '46%' },
  assinaLinha: {
    borderBottomWidth: 0.6,
    borderBottomColor: '#000000',
    marginBottom: 6,
    height: 28,
  },
  assinaLabel: { fontSize: 8, color: '#333333', marginBottom: 8 },
  footer: {
    position: 'absolute',
    left: MARGIN,
    right: MARGIN,
    bottom: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#333333',
  },
});

function LinhaCampo({ label, valor }: { label: string; valor: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.valor}>{valor || '—'}</Text>
    </View>
  );
}

export function PropostaPDF({
  payload,
  logoSrc,
  emitidoEm,
}: {
  payload: PropostaPdfPayload;
  logoSrc?: string | Buffer;
  emitidoEm?: Date;
}) {
  const agora = emitidoEm ?? new Date();
  const ref = refProposta(payload.simulacaoId, agora);
  const mesParcelaUnica = payload.fluxo.find((l) => l.fase === 'parcela_unica')?.mes;
  const labelParcelaUnica =
    mesParcelaUnica != null ? `Parcela única (mês ${mesParcelaUnica})` : 'Parcela única';

  return (
    <Document
      title={`Proposta de pagamento ${ref}`}
      author="Moní Tech"
      subject="Proposta de pagamento"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {logoSrc ? (
            <Image src={logoSrc} style={styles.logo} />
          ) : (
            <Text style={styles.logoFallback}>MONÍ</Text>
          )}
          <View>
            <Text style={styles.tituloDoc}>PROPOSTA DE PAGAMENTO</Text>
            <Text style={styles.ref}>Ref.: {ref}</Text>
          </View>
        </View>
        <View style={styles.linha} />

        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>1. Dados do cliente</Text>
          <LinhaCampo label="Nome completo:" valor={payload.clienteNome} />
          <LinhaCampo label="Telefone:" valor={payload.clienteTelefone} />
          <LinhaCampo label="E-mail:" valor={payload.clienteEmail} />
          <LinhaCampo label="Data de emissão:" valor={dataEmissaoExtenso(agora)} />
        </View>

        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>2. Identificação do imóvel</Text>
          <LinhaCampo label="Loteamento:" valor={payload.loteamento} />
          <LinhaCampo
            label="Lote:"
            valor={payload.loteCodigo?.trim() || 'Informado pelo corretor'}
          />
          <LinhaCampo label="Valor do lote:" valor={formatarMoedaProposta(payload.valorLote)} />
          <LinhaCampo
            label="Valor da casa:"
            valor={formatarMoedaProposta(payload.valorCasa)}
          />
          <LinhaCampo
            label="Valor da customização:"
            valor={formatarMoedaProposta(payload.valorCustomizacao)}
          />
        </View>

        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>3. Valor total do empreendimento à vista</Text>
          <View style={styles.destaque}>
            <Text style={styles.destaqueLabel}>VALOR TOTAL DO EMPREENDIMENTO À VISTA</Text>
            <Text style={styles.destaqueValor}>
              {formatarMoedaProposta(payload.valorEmpreendimento)}
            </Text>
          </View>
        </View>

        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>4. Condição de pagamento</Text>
          <View style={styles.table}>
            <View style={styles.th}>
              <Text style={[styles.td, styles.tdCompNome, { fontFamily: 'Helvetica-Bold' }]}>
                Componente
              </Text>
              <Text style={[styles.td, styles.tdValor, { fontFamily: 'Helvetica-Bold' }]}>
                Valor Confirmado
              </Text>
            </View>
            <View style={styles.tr}>
              <Text style={[styles.td, styles.tdCompNome]}>Entrada</Text>
              <Text style={[styles.td, styles.tdValor]}>
                {formatarMoedaProposta(payload.entradaConfirmada)}
              </Text>
            </View>
            <View style={styles.tr}>
              <Text style={[styles.td, styles.tdCompNome]}>
                Parcelas mensais ({payload.qtdParcelasMensais}{' '}
                {payload.qtdParcelasMensais === 1 ? 'parcela' : 'parcelas'})
              </Text>
              <Text style={[styles.td, styles.tdValor]}>
                {formatarMoedaProposta(payload.mensalConfirmada)}
              </Text>
            </View>
            <View style={styles.tr}>
              <Text style={[styles.td, styles.tdCompNome]}>{labelParcelaUnica}</Text>
              <Text style={[styles.td, styles.tdValor]}>
                {formatarMoedaProposta(payload.parcelaUnicaConfirmada)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>5. Saldo a financiar</Text>
          <LinhaCampo
            label="Saldo a financiar:"
            valor={formatarMoedaProposta(payload.saldoFinanciar)}
          />
          <LinhaCampo
            label="Prazo de financiamento:"
            valor={`${payload.prazoFinanciamentoAnos} anos`}
          />
          <LinhaCampo
            label="Taxa de juros estimada:"
            valor={`${String(payload.taxaJurosAnualPct).replace('.', ',')}% ao ano`}
          />
          <LinhaCampo
            label="Parcela estimada de financiamento:"
            valor={`${formatarMoedaProposta(payload.parcelaFinanciamento)} / mês`}
          />
          <LinhaCampo
            label="Renda mínima necessária:"
            valor={`${formatarMoedaProposta(payload.rendaMinima)} / mês`}
          />
          <Text style={styles.nota}>
            Os valores de financiamento são estimativas baseadas nas condições vigentes na data de
            emissão e estão sujeitos à aprovação creditícia.
          </Text>
        </View>

        <View style={styles.footer} fixed>
          <Text>
            Gerado em {dataGeracaoCurta(agora)} · Moní Tech · Documento confidencial
          </Text>
          <Text
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>6. Fluxo detalhado de pagamentos</Text>
          <View style={styles.table}>
            <View style={styles.th} wrap={false}>
              <Text style={[styles.td, styles.tdMes, { fontFamily: 'Helvetica-Bold' }]}>Mês</Text>
              <Text style={[styles.td, styles.tdFase, { fontFamily: 'Helvetica-Bold' }]}>Fase</Text>
              <Text style={[styles.td, styles.tdEntrada, { fontFamily: 'Helvetica-Bold' }]}>
                Entradas do cliente
              </Text>
              <Text style={[styles.td, styles.tdSaidas, { fontFamily: 'Helvetica-Bold' }]}>
                Saídas
              </Text>
            </View>
            {payload.fluxo.map((l, idx) => (
              <View
                key={`${l.mes}-${l.fase}-${l.etapa_obra ?? ''}-${idx}`}
                wrap={false}
                style={[styles.tr, idx % 2 === 1 ? { backgroundColor: '#FAFAFA' } : {}]}
              >
                <Text style={[styles.td, styles.tdMes]}>
                  {l.fase === 'pre_contrato' ? '—' : String(l.mes)}
                </Text>
                <Text style={[styles.td, styles.tdFase]}>{FASE_FLUXO_LABEL[l.fase] ?? l.fase}</Text>
                <Text style={[styles.td, styles.tdEntrada]}>{formatarMoeda(l.entrada_cliente)}</Text>
                <Text style={[styles.td, styles.tdSaidas]}>{formatarMoeda(l.saidas_total)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View wrap={false}>
          <View style={styles.secao}>
            <Text style={styles.secaoTitulo}>7. Observações legais</Text>
            <Text style={styles.legal}>
              Este documento constitui proposta de pagamento para fins de negociação e deverá ser
              formalizado em instrumento contratual próprio. Os valores apresentados são válidos por
              30 (trinta) dias corridos a partir da data de emissão. A aprovação da proposta está
              condicionada à análise cadastral e à assinatura do contrato definitivo. Este documento
              não substitui o contrato de compra e venda nem qualquer instrumento jurídico hábil.
            </Text>
          </View>

          <Text style={styles.secaoTitulo}>8. Assinaturas</Text>
          <View style={styles.assinaturas}>
            <View style={styles.assinaCol}>
              <View style={styles.assinaLinha} />
              <Text style={styles.assinaLabel}>Assinatura do Cliente</Text>
              <Text style={styles.assinaLabel}>{payload.clienteNome || 'Nome do cliente'}</Text>
              <Text style={styles.assinaLabel}>CPF: ____________________________</Text>
              <Text style={styles.assinaLabel}>Data: ___________________________</Text>
            </View>
            <View style={styles.assinaCol}>
              <View style={styles.assinaLinha} />
              <Text style={styles.assinaLabel}>Moní Tech</Text>
              <Text style={styles.assinaLabel}>Representante Autorizado</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>
            Gerado em {dataGeracaoCurta(agora)} · Moní Tech · Documento confidencial
          </Text>
          <Text
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
