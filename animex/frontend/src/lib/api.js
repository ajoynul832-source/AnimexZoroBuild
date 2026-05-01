// UPDATED TO proxy to backend
const API = process.env.NEXT_PUBLIC_API_URL || '/backend-api';

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function req(path, opts = {}) {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('animex_token')
      : null;

  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token
        ? {
            Authorization: `Bearer ${token}`
          }
        : {}),
      ...opts.headers
    }
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(
      data.error || 'Request failed',
      res.status
    );
  }

  return data;
}

const post = (p, b, o) =>
  req(p, {
    method: 'POST',
    body: JSON.stringify(b),
    ...o
  });

const put = (p, b, o) =>
  req(p, {
    method: 'PUT',
    body: JSON.stringify(b),
    ...o
  });

const del = (p, o) =>
  req(p, {
    method: 'DELETE',
    ...o
  });

export const animeApi = {
  getHome: () => req('/anime/home'),

  // ADDED THIS FOR THE NEW WIDGET
  getTop10: () => req('/anime/top10'),
  getTop100: (p = 1) => req(`/anime/top100?page=${p}`),

  getSchedule: (date) =>
    req(`/anime/schedule${date ? `?date=${date}` : ''}`),

  getInfo: (id) => req(`/anime/info/${id}`),

  getEpisodes: (id) => req(`/anime/episodes/${id}`),

  // getSources — routing logic: ALWAYS USE BACKEND
  // (Vercel routes were removed)
  getSources: async ({ animeId, epNum, title, category = 'sub', server = 'hd-1' }) => {
    try {
      const backendParams = new URLSearchParams({
        animeId:   String(animeId),
        epNum:     String(epNum),
        title:     title || '',
        category:  category,
        server:    server
      });
      const r = await fetch(`${API}/anime/v2/sources?${backendParams}`, { signal: AbortSignal.timeout(25000) });
      if (r.ok) {
        const d = await r.json();
        if (d?.sources?.length || d?.data?.sources?.length || d?.provider === 'vibeplayer-iframe') {
          if (d.error) throw new ApiError(d.error, 503);
          return d;
        }
      }
    } catch (backendErr) {
      console.warn('[getSources] V2 Backend failed:', backendErr.message);
    }

    throw new ApiError('No sources found or backend failed.', 503);
  },

  getTopAiring: (p = 1) => req(`/anime/top-airing?page=${p}`),

  getMostPopular: (p = 1) => req(`/anime/most-popular?page=${p}`),

  getMostFavorite: (p = 1) => req(`/anime/most-favorite?page=${p}`),

  getMovies: (p = 1) => req(`/anime/movies?page=${p}`),

  getTvSeries: (p = 1) => req(`/anime/tv-series?page=${p}`),

  getNewSeason: (p = 1) => req(`/anime/new-season?page=${p}`),

  getCompleted: (p = 1) => req(`/anime/completed?page=${p}`),

  getOngoing: (p = 1) => req(`/anime/ongoing?page=${p}`),

  getByGenre: (g, p = 1) =>
    req(`/anime/genre/${encodeURIComponent(g)}?page=${p}`),

  getAzList: (l = 'all', p = 1) =>
    req(`/anime/az-list?letter=${l}&page=${p}`),

  getStats: (pid) => req(`/anime/stats/${pid}`),

  incrementView: (pid, aid) =>
    post(`/anime/stats/${pid}/view`, { animeId: aid }),

  setReaction: (pid, r, aid) =>
    post(`/anime/stats/${pid}/react`, { reaction: r, animeId: aid })
};

export const searchApi = {
  search: (kw, p = 1, filters = {}) =>
    req(`/search?keyword=${encodeURIComponent(kw)}&page=${p}&${new URLSearchParams(filters)}`),

  getSuggestions: (kw) =>
    req(`/search/suggestions?keyword=${encodeURIComponent(kw)}`)
};

export const authApi = {
  register: (d) => post('/auth/register', d),
  login: (d) => post('/auth/login', d),
  getMe: () => req('/auth/me'),
  changePassword: (d) => put('/auth/change-password', d)
};

export const userApi = {
  getProfile: () => req('/user/profile'),
  getHistory: () => req('/user/history'),
  addToHistory: (d) => post('/user/history', d),
  removeFromHistory: (id) => del(`/user/history/${id}`),
  clearHistory: () => del('/user/history'),
  getWatchlist: () => req('/user/watchlist'),
  addToWatchlist: (d) => post('/user/watchlist', d),
  removeFromWatchlist: (id) => del(`/user/watchlist/${id}`),
  checkWatchlist: (id) => req(`/user/watchlist/check/${id}`)
};

Object.assign(animeApi, {
  getLatestSubbed: (p = 1) => req(`/anime/latest/subbed?page=${p}`),
  getLatestDubbed: (p = 1) => req(`/anime/latest/dubbed?page=${p}`),
  getLatestChinese: (p = 1) => req(`/anime/latest/chinese?page=${p}`),
  getSubCategory: (id, p = 1) => req(`/anime/sub-category/${encodeURIComponent(id)}?page=${p}`),
});

export { ApiError };
