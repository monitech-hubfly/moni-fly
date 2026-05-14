/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
    ];
  },
};

module.exports = nextConfig;
