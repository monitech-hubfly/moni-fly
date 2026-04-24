/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: '/sirene/interacoes', destination: '/sirene/chamados', permanent: true },
      { source: '/sirene/interacoes/:path*', destination: '/sirene/chamados', permanent: true },
    ];
  },
};

module.exports = nextConfig;
