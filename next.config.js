/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns'],
    serverActions: {
      /** Etapas ZAP / uploads podem enviar payloads maiores que 1 MB (default). */
      bodySizeLimit: '10mb',
    },
  },
  /**
   * Carômetro (Vite) usa VITE_SUPABASE_*; o moni-fly usa NEXT_PUBLIC_*.
   * Se só existirem as variáveis Vite no .env.local, o Next reutiliza-as no cliente.
   */
  env: {
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
  },
  async redirects() {
    return [
      { source: '/onboarding', destination: '/rede-franqueados', permanent: true },
      { source: '/onboarding/:path*', destination: '/rede-franqueados', permanent: true },
      { source: '/sirene/interacoes', destination: '/sirene/chamados', permanent: true },
      { source: '/sirene/interacoes/:path*', destination: '/sirene/chamados', permanent: true },
      { source: '/treinamento-bca/cenarios', destination: '/treinamento-bca/ordem', permanent: true },
      { source: '/treinamento-bca/abas-fluxo', destination: '/treinamento-bca/introducao', permanent: true },
      { source: '/treinamento-bca/aba-resumo', destination: '/treinamento-bca/ordem', permanent: true },
      { source: '/carta-fianca', destination: '/carta-fianca/leitura', permanent: false },
      { source: '/moni-capital', destination: '/moni-capital/leitura', permanent: false },
      { source: '/funil-credito', destination: '/funil-credito-obra', permanent: true },
      { source: '/funil-credito/:path*', destination: '/funil-credito-obra/:path*', permanent: true },
      { source: '/painel-credito', destination: '/funil-credito-obra', permanent: true },
      { source: '/painel-credito/:path*', destination: '/funil-credito-obra/:path*', permanent: true },
    ];
  },
};

module.exports = nextConfig;
