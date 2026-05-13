/**
 * Integração com Autentique Sign API (GraphQL + multipart para upload).
 * Docs: https://docs.autentique.com.br/api
 */

const AUTENTIQUE_GRAPHQL = 'https://api.autentique.com.br/v2/graphql';

export type AutentiqueSignerInput = {
  email?: string;
  name?: string;
  phone?: string;
  delivery_method?: 'DELIVERY_METHOD_WHATSAPP' | 'DELIVERY_METHOD_SMS';
  action: 'SIGN' | 'APPROVE' | 'SIGN_AS_A_WITNESS' | 'RECOGNIZE';
};

export type CreateDocumentResult = {
  id: string;
  name: string;
  signatures?: Array<{ public_id: string; link?: { short_link?: string } }>;
};

/**
 * Cria um documento no Autentique e envia para assinatura.
 * @param apiKey - Bearer token (chave API do painel Autentique)
 * @param fileBuffer - Conteúdo do arquivo (PDF ou DOCX)
 * @param fileName - Nome do arquivo (ex: contrato.pdf)
 * @param documentName - Nome do documento no Autentique
 * @param signers - Lista de signatários (email obrigatório para envio por e-mail)
 */
export async function createDocument(
  apiKey: string,
  fileBuffer: Buffer,
  fileName: string,
  documentName: string,
  signers: AutentiqueSignerInput[],
): Promise<{ ok: true; document: CreateDocumentResult } | { ok: false; error: string }> {
  if (!signers.length) {
    return { ok: false, error: 'Informe ao menos um signatário (email).' };
  }

  const operations = JSON.stringify({
    query: `mutation CreateDocumentMutation($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) {
      createDocument(document: $document, signers: $signers, file: $file) {
        id
        name
        refusable
        sortable
        created_at
        signatures {
          public_id
          name
          email
          action { name }
          link { short_link }
        }
      }
    }`,
    variables: {
      document: { name: documentName },
      signers: signers.map((s) => ({
        email: s.email ?? undefined,
        name: s.name ?? undefined,
        phone: s.phone ?? undefined,
        delivery_method: s.delivery_method ?? undefined,
        action: s.action || 'SIGN',
      })),
      file: null,
    },
  });

  const map = JSON.stringify({ file: ['variables.file'] });

  const formData = new FormData();
  formData.append('operations', operations);
  formData.append('map', map);
  const blob = new Blob([new Uint8Array(fileBuffer)], {
    type: fileName.toLowerCase().endsWith('.pdf')
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  formData.append('file', blob, fileName);

  const response = await fetch(AUTENTIQUE_GRAPHQL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    return { ok: false, error: `Autentique API: ${response.status} ${text.slice(0, 300)}` };
  }

  const json = (await response.json()) as {
    data?: { createDocument?: CreateDocumentResult };
    errors?: Array<{ message?: string }>;
  };
  if (json.errors?.length) {
    return {
      ok: false,
      error: json.errors.map((e) => e.message).join(' ') || 'Erro na API Autentique.',
    };
  }

  const doc = json.data?.createDocument;
  if (!doc?.id) {
    return { ok: false, error: 'Resposta da Autentique sem id do documento.' };
  }

  return {
    ok: true,
    document: {
      id: doc.id,
      name: doc.name ?? documentName,
      signatures: doc.signatures,
    },
  };
}
