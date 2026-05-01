/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // In production (Vercel) API_URL must be set in dashboard (e.g. backend url)
    // In development it falls back to localhost:5000
    const apiUrl = process.env.BACKEND_API_URL || 'http://localhost:5000/api';
    return [
      {
        source: '/backend-api/:path*',
        destination: `${apiUrl}/:path*`,
      },
    ];
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.noitatnemucod.net' },
      { protocol: 'https', hostname: 'myanimelist.net' },
      { protocol: 'https', hostname: '**.gogoanime.run' },
      { protocol: 'https', hostname: 'gogocdn.net' },
      { protocol: 'https', hostname: '**.akamaized.net' },
      { protocol: 'https', hostname: 'cdn.myanimelist.net' },
      { protocol: 'https', hostname: 's4.anilist.co' },
      { protocol: 'https', hostname: '**.anilist.co' },
      { protocol: 'https', hostname: 'media.kitsu.io' },
      { protocol: 'https', hostname: '**.zorores.com' },
    ],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // ⚠️  Do NOT hardcode env vars here — they override Vercel dashboard values
  // Set NEXT_PUBLIC_API_URL and NEXT_PUBLIC_SITE_NAME in Vercel → Settings → Env Variables

  reactStrictMode: true,

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options',        value: 'DENY' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
