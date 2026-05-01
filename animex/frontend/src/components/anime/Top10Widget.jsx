'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { animeApi } from '@/lib/api';

export default function Top10Widget() {
  const [tab, setTab] = useState('today');
  const [data, setData] = useState({ today: [], week: [], month: [], yearly: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    animeApi.getTop10()
      .then(d => setData(d?.data?.top10Animes || { today: [], week: [], month: [], yearly: [] }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const items = data[tab] || [];

  return (
    <div className="anif-block" style={{ marginBottom: 18 }}>
      
      {/* Header section separated into TWO rows for mobile */}
      <div style={{ padding: '10px 14px 0', borderBottom: '1px solid var(--border)' }}>
        
        {/* ROW 1: Title & "Full >" Link (Matches Schedule exactly) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 16, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.03em', margin: 0 }}>
            Top 100 Anime
          </h3>
          <Link href="/top-100" style={{ fontSize: 12, color: 'var(--text-3)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, transition: 'color .15s' }}>
            Full <span style={{ fontSize: 10 }}>&gt;</span>
          </Link>
        </div>

        {/* ROW 2: The Tabs (Scrollable on small screens so Yearly isn't cut off) */}
        <div style={{ 
          display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 10, 
          scrollbarWidth: 'none', msOverflowStyle: 'none' 
        }}>
          {['today', 'week', 'month', 'yearly'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '4px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              borderRadius: 4, border: 'none', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif',
              background: tab === t ? 'var(--accent)' : 'var(--bg-card-alt)',
              color: tab === t ? '#111' : 'var(--text-3)',
              transition: 'all .15s',
              flexShrink: 0
            }}>
              {t === 'today' ? 'Today' : t === 'week' ? 'Week' : t === 'month' ? 'Month' : 'Yearly'}
            </button>
          ))}
        </div>
        
      </div>

      {/* List - shows 5 items */}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
              <div className="skeleton" style={{ width: 28, height: 20, borderRadius: 3, flexShrink: 0 }} />
              <div className="skeleton" style={{ width: 36, height: 50, borderRadius: 3, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ height: 11, borderRadius: 3, marginBottom: 5, width: '80%' }} />
                <div className="skeleton" style={{ height: 10, borderRadius: 3, width: '50%' }} />
              </div>
            </li>
          ))
        ) : items.slice(0, 5).map((anime, i) => {
          const isTop3 = i < 3;
          return (
            <li key={`${anime.id || 'top10'}-${i}`} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderBottom: '1px solid var(--border)',
              transition: 'background .15s',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-alt)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{
                minWidth: 26, textAlign: 'center',
                fontFamily: 'Rajdhani, sans-serif', fontSize: isTop3 ? 22 : 18,
                fontWeight: 700, lineHeight: 1,
                color: i === 0 ? 'var(--accent)' : i === 1 ? '#c8c8c8' : i === 2 ? '#cd7f32' : 'var(--text-4)',
              }}>
                {String(i + 1).padStart(2, '0')}
              </div>

              <img
                src={anime.poster || '/no-poster.svg'}
                alt={anime.name}
                style={{ width: 36, height: 50, objectFit: 'cover', borderRadius: 3, flexShrink: 0 }}
                loading="lazy"
                onError={e => { e.currentTarget.src = '/no-poster.svg'; }}
              />

              <div style={{ flex: 1, minWidth: 0 }}>
                <Link href={`/anime/${anime.id}`} style={{
                  fontSize: 12, fontWeight: 500, color: 'var(--text-2)',
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  overflow: 'hidden', lineHeight: 1.35, textDecoration: 'none', transition: 'color .15s',
                }}
                  onMouseEnter={e => e.target.style.color = 'var(--accent)'}
                  onMouseLeave={e => e.target.style.color = 'var(--text-2)'}
                >
                  {anime.name}
                </Link>
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3, display: 'flex', gap: 4 }}>
                  {anime.episodes?.sub != null && (
                    <span style={{ color: 'var(--sub-color)', fontWeight: 700 }}>SUB {anime.episodes.sub}</span>
                  )}
                  {anime.episodes?.dub != null && (
                    <span style={{ color: 'var(--dub-color)', fontWeight: 700 }}>DUB {anime.episodes.dub}</span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
