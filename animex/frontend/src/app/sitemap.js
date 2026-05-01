// Ported from Zoro: sitemap.php + sitemaps/*.php
// Next.js 14 app-router sitemap — fetches from backend
export default async function sitemap() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://animex-dhhs.onrender.com';
  const api  = process.env.BACKEND_API_URL || 'https://animex-api-vh3e.onrender.com/api';

  const staticRoutes = [
    '/', '/home', '/popular', '/most-favorite', '/new-season',
    '/top-airing', '/movies', '/tv-series', '/completed', '/ongoing',
    '/az-list', '/schedule', '/latest/subbed', '/latest/dubbed',
    '/latest/chinese', '/search', '/dmca', '/donate', '/terms', '/about',
  ].map(r => ({ url: `${base}${r}`, changeFrequency: 'daily', priority: r === '/home' ? 1 : 0.8 }));

  let animeRoutes = [];
  try {
    const res  = await fetch(`${api}/anime/top-airing?page=1`, { next: { revalidate: 3600 } });
    const data = await res.json();
    const list = data?.data?.animes || [];
    animeRoutes = list.map(a => ({
      url: `${base}/anime/${a.id}`,
      changeFrequency: 'weekly',
      priority: 0.7,
    }));
  } catch {}

  return [...staticRoutes, ...animeRoutes];
}
