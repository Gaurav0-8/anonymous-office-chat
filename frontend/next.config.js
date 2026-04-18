/** @type {import('next').NextConfig} */
const nextConfig = {
  // Proxy all API and WebSocket calls to Go backend
  // Browser only ever talks to the Cloudflare domain (port 443)
  async rewrites() {
    return [
      { source: '/auth/:path*',      destination: 'http://localhost:8080/auth/:path*' },
      { source: '/chats/:path*',     destination: 'http://localhost:8080/chats/:path*' },
      { source: '/messages/:path*',  destination: 'http://localhost:8080/messages/:path*' },
      { source: '/images/:path*',    destination: 'http://localhost:8080/images/:path*' },
      { source: '/favorites/:path*', destination: 'http://localhost:8080/favorites/:path*' },
      { source: '/admin/:path*',     destination: 'http://localhost:8080/admin/:path*' },
      { source: '/uploads/:path*',   destination: 'http://localhost:8080/uploads/:path*' },
      { source: '/ws',               destination: 'http://localhost:8080/ws' },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'chat.gauravmathur.in',
        pathname: '/uploads/**',
      },
    ],
  },
};

module.exports = nextConfig;
