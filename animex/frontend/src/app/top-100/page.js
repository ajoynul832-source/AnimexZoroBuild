'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { animeApi } from '@/lib/api';

export default function Top100Page() {
  const [tab, setTab] = useState('today');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ today: [], week: [], month: [], yearly: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    animeApi.getTop10()
      .then(d => {
        setData(d?.data?.top10Animes || { today: [], week: [], month: [], yearly: [] });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleTabChange = (newTab) => {
    setTab(newTab);
    setPage(1);
  };

  const handlePage = (nextPage) => {
    if (nextPage < 1 || nextPage > totalPages) return;
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const allItemsForTab = data[tab] || [];
  const itemsPerPage = 10;
  const totalPages = Math.ceil(allItemsForTab.length / itemsPerPage) || 1;
  const currentItems = allItemsForTab.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const getPages = () => {
    const items = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);

    if (start > 1) {
      items.push(1);
      if (start > 2) items.push('...');
    }
    for (let i = start; i <= end; i++) {
      items.push(i);
    }
    if (end < totalPages) {
      if (end < totalPages - 1) items.push('...');
      items.push(totalPages);
    }
    return items;
  };

  return (
    <div className="page-inner" style={{ maxWidth: 1000, margin: '0 auto', padding: '20px 0' }}>
      
      {/* Header & Tabs */}
      <div className="block_area-header" style={{ marginBottom: 22, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 15 }}>
        <h1 className="cat-heading" style={{ margin: 0, fontSize: 26, display: 'flex', alignItems: 'center', gap: 10 }}>
          Top 100 Anime
        </h1>
        
        <div style={{ display: 'flex', gap: 5, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {['today', 'week', 'month', 'yearly'].map(t => (
            <button key={t} onClick={() => handleTabChange(t)} style={{
              padding: '6px 16px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
              borderRadius: 4, border: 'none', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif',
              background: tab === t ? 'var(--accent)' : 'var(--bg-card-alt)',
              color: tab === t ? '#111' : 'var(--text-3)',
              transition: 'all .15s',
            }}>
              {t === 'today' ? 'Today' : t === 'week' ? 'Weekly' : t === 'month' ? 'Monthly' : 'Yearly'}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ marginBottom: 26 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px', color: 'var(--text-3)' }}>Loading...</div>
        ) : currentItems.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">No anime found.</p>
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {currentItems.map((anime, index) => {
              const actualRank = (page - 1) * itemsPerPage + index + 1;
              const isTop3 = actualRank <= 3;

              return (
                <li key={anime.id || index} style={{
                  display: 'flex', alignItems: 'center', gap: 15,
                  padding: '12px 16px', borderBottom: '1px solid var(--border)',
                  background: 'var(--bg-card)', marginBottom: 8, borderRadius: 6,
                  transition: 'background .15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-alt)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
                >
                  <div style={{
                    minWidth: 40, textAlign: 'center',
                    fontFamily: 'Rajdhani, sans-serif', fontSize: isTop3 ? 28 : 22,
                    fontWeight: 700, lineHeight: 1,
                    color: actualRank === 1 ? 'var(--accent)' : actualRank === 2 ? '#c8c8c8' : actualRank === 3 ? '#cd7f32' : 'var(--text-4)',
                  }}>
                    {String(actualRank).padStart(2, '0')}
                  </div>

                  <img
                    src={anime.poster || '/no-poster.svg'}
                    alt={anime.name}
                    style={{ width: 50, height: 70, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                    loading="lazy"
                    onError={e => { e.currentTarget.src = '/no-poster.svg'; }}
                  />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link href={`/anime/${anime.id}`} style={{
                      fontSize: 16, fontWeight: 600, color: 'var(--text-1)',
                      display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
                      overflow: 'hidden', textDecoration: 'none', transition: 'color .15s',
                    }}
                      onMouseEnter={e => e.target.style.color = 'var(--accent)'}
                      onMouseLeave={e => e.target.style.color = 'var(--text-1)'}
                    >
                      {anime.name}
                    </Link>
                    
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {anime.type && <span style={{ background: 'var(--bg-card-alt)', padding: '2px 6px', borderRadius: 3 }}>{anime.type}</span>}
                      
                      {anime.episodes?.sub != null && (
                        <span style={{ color: 'var(--sub-color)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
                          <span style={{ background: 'var(--sub-color)', color: '#111', padding: '1px 4px', borderRadius: 2, fontSize: 10 }}>SUB</span> 
                          {anime.episodes.sub}
                        </span>
                      )}
                      {anime.episodes?.dub != null && (
                        <span style={{ color: 'var(--dub-color)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
                          <span style={{ background: 'var(--dub-color)', color: '#111', padding: '1px 4px', borderRadius: 2, fontSize: 10 }}>DUB</span> 
                          {anime.episodes.dub}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="pagination">
          <button className="page-btn" onClick={() => handlePage(page - 1)} disabled={page <= 1}>
            <ChevronLeft size={13} />
          </button>

          {getPages().map((p, i) =>
            p === '...' ? (
              <span key={`ellipsis-${i}`} style={{ color: 'var(--text-3)', padding: '0 6px', fontSize: 14 }}>...</span>
            ) : (
              <button key={p} className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => handlePage(p)}>
                {p}
              </button>
            )
          )}

          <button className="page-btn" onClick={() => handlePage(page + 1)} disabled={page >= totalPages}>
            <ChevronRight size={13} />
          </button>
        </div>
      )}

    </div>
  );
}
