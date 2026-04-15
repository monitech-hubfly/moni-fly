// Script de teste: Verificar SUPABASE_SERVICE_ROLE_KEY
// Execute: node test-env.js

require('dotenv').config({ path: '.env.local' });

console.log('');
console.log('═══════════════════════════════════════════════════');
console.log('  VERIFICAÇÃO: SUPABASE_SERVICE_ROLE_KEY');
console.log('═══════════════════════════════════════════════════');
console.log('');

// 1. Verificar se as variáveis existem
console.log('📋 VARIÁVEIS DE AMBIENTE:');
console.log('  NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL || '❌ NÃO DEFINIDA');
console.log('  SUPABASE_SERVICE_ROLE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ SIM' : '❌ NÃO');

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('');
  console.log('❌ ERRO: SUPABASE_SERVICE_ROLE_KEY não está definida!');
  console.log('');
  console.log('📝 COMO CORRIGIR:');
  console.log('  1. Abra o arquivo .env.local na raiz do projeto');
  console.log('  2. Adicione ou edite a linha:');
  console.log('     SUPABASE_SERVICE_ROLE_KEY=<sua-key-aqui>');
  console.log('  3. Pegue a key no Supabase Dashboard → Settings → API');
  console.log('  4. Copie a chave "service_role" (marcada como secret)');
  console.log('');
  process.exit(1);
}

const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('  Key length:', key.length, key.length >= 100 ? '✅' : '⚠️ Muito curta');
console.log('  Key starts with:', key.substring(0, 20) + '...');
console.log('');

// 2. Verificar se é um JWT válido
console.log('🔍 VALIDAÇÃO DE JWT:');

if (key === 'COLE_AQUI_A_SERVICE_ROLE_KEY_DO_DEV' || key.includes('COLE_AQUI')) {
  console.log('  ❌ A key é um PLACEHOLDER!');
  console.log('');
  console.log('📝 COMO CORRIGIR:');
  console.log('  1. Abra: https://supabase.com/dashboard/project/bgaadvfucnrkpimaszjv/settings/api');
  console.log('  2. Copie a chave "service_role" (NÃO a "anon")');
  console.log('  3. Cole no .env.local substituindo "COLE_AQUI..."');
  console.log('');
  process.exit(1);
}

const parts = key.split('.');
console.log('  JWT parts:', parts.length, parts.length === 3 ? '✅ Correto' : '❌ Incorreto (esperado: 3)');

if (parts.length !== 3) {
  console.log('');
  console.log('❌ ERRO: A key não parece ser um JWT válido!');
  console.log('  JWT deve ter 3 partes separadas por ponto: header.payload.signature');
  console.log('');
  console.log('📝 VERIFIQUE:');
  console.log('  - A key foi copiada completamente do Supabase?');
  console.log('  - Não há espaços ou quebras de linha na key?');
  console.log('');
  process.exit(1);
}

// 3. Decodificar e validar
console.log('');
console.log('🔐 DECODIFICANDO JWT:');

try {
  // Header
  const headerRaw = Buffer.from(parts[0], 'base64').toString();
  const header = JSON.parse(headerRaw);
  console.log('  Header:', JSON.stringify(header));
  
  // Payload
  const payloadRaw = Buffer.from(parts[1], 'base64').toString();
  const payload = JSON.parse(payloadRaw);
  console.log('  Issuer:', payload.iss || '❌ não definido');
  console.log('  Role:', payload.role || '❌ não definido');
  console.log('  Ref:', payload.ref || '❌ não definido');
  
  // Verificar role
  console.log('');
  console.log('✅ VERIFICAÇÃO FINAL:');
  
  if (payload.role === 'service_role') {
    console.log('  ✅✅✅ SUPABASE_SERVICE_ROLE_KEY É VÁLIDA!');
    console.log('');
    console.log('📝 PRÓXIMOS PASSOS:');
    console.log('  1. Reinicie o servidor Next.js (Ctrl+C e npm run dev)');
    console.log('  2. Acesse: http://localhost:3000/painel-novos-negocios/tarefas');
    console.log('  3. Abra o Console (F12) e veja os logs');
    console.log('  4. Deve aparecer: "✅ Admin client criado com sucesso!"');
    console.log('');
  } else {
    console.log('  ❌ ROLE INCORRETO!');
    console.log('     Esperado: "service_role"');
    console.log('     Recebido: "' + payload.role + '"');
    console.log('');
    console.log('📝 COMO CORRIGIR:');
    console.log('  Você copiou a chave "anon" ao invés de "service_role"!');
    console.log('  1. Volte ao Supabase Dashboard → Settings → API');
    console.log('  2. Copie a chave marcada como "service_role" (🔒 secret)');
    console.log('  3. Substitua no .env.local');
    console.log('');
    process.exit(1);
  }
  
  // Verificar se está expirada
  if (payload.exp) {
    const expDate = new Date(payload.exp * 1000);
    const now = new Date();
    console.log('  Expira em:', expDate.toLocaleDateString('pt-BR'));
    
    if (expDate < now) {
      console.log('  ⚠️  A KEY ESTÁ EXPIRADA!');
      console.log('     Gere uma nova no Supabase Dashboard');
    }
  }
  
} catch (err) {
  console.log('');
  console.log('❌ ERRO ao decodificar JWT:', err.message);
  console.log('');
  console.log('📝 POSSÍVEIS CAUSAS:');
  console.log('  - A key foi copiada incorretamente');
  console.log('  - A key está corrompida');
  console.log('  - A key não é um JWT válido');
  console.log('');
  console.log('🔄 SOLUÇÃO:');
  console.log('  Copie a key novamente do Supabase Dashboard');
  console.log('');
  process.exit(1);
}

console.log('═══════════════════════════════════════════════════');
console.log('');
