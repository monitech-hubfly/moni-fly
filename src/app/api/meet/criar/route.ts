import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const runtime = 'nodejs';

export async function POST() {
  const email       = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey      = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const impersonate = process.env.GOOGLE_IMPERSONATE_EMAIL;

  if (!email || !rawKey || !impersonate) {
    return NextResponse.json(
      { error: 'Credenciais Google não configuradas no servidor.' },
      { status: 503 },
    );
  }

  const privateKey = rawKey.replace(/\\n/g, '\n');

  // ── 1. JWT com impersonation (domain-wide delegation) ──────────────────────
  const now = Math.floor(Date.now() / 1000);
  const toB64 = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');

  const header  = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss:   email,
    sub:   impersonate,   // impersona um usuário real do Workspace
    scope: 'https://www.googleapis.com/auth/meetings.space.created',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  };

  const unsigned  = `${toB64(header)}.${toB64(payload)}`;
  const signer    = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const signature = signer.sign(privateKey, 'base64url');
  const jwt       = `${unsigned}.${signature}`;

  // ── 2. Trocar JWT por access token ─────────────────────────────────────────
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt,
    }),
  });

  if (!tokenRes.ok) {
    const txt = await tokenRes.text();
    console.error('[meet/criar] token error:', txt);
    return NextResponse.json(
      { error: `Falha ao autenticar com Google: ${txt}` },
      { status: 502 },
    );
  }

  const { access_token } = (await tokenRes.json()) as { access_token: string };

  // ── 3. Criar sala no Google Meet ───────────────────────────────────────────
  const meetRes = await fetch('https://meet.googleapis.com/v2/spaces', {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${access_token}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });

  if (!meetRes.ok) {
    const txt = await meetRes.text();
    console.error('[meet/criar] meet error:', txt);
    return NextResponse.json(
      { error: `Falha ao criar sala Meet: ${txt}` },
      { status: 502 },
    );
  }

  const { meetingUri } = (await meetRes.json()) as { meetingUri: string };
  return NextResponse.json({ url: meetingUri });
}
