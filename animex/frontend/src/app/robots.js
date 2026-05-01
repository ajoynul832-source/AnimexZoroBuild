// Ported from Zoro: robots.txt
export default function robots() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://animex-dhhs.onrender.com';
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/user/'] },
    sitemap: `${base}/sitemap.xml`,
  };
}
