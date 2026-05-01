'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Star, Bookmark, BookmarkCheck, Share2, ChevronDown, ChevronUp, Layers } from 'lucide-react';

import DisqusComments        from '@/components/ui/DisqusComments';
import VideoPlayer           from '@/components/player/VideoPlayer';
import EpisodePanel          from '@/components/player/EpisodePanel';
import StatsBar              from '@/components/player/StatsBar';
import AnimeRow              from '@/components/anime/AnimeRow';
import ContinueWatchingModal from '@/components/watch/ContinueWatchingModal';
import AutoNextModal         from '@/components/watch/AutoNextModal';

import { animeApi, userApi } from '@/lib/api';
import { useAuth }           from '@/lib/AuthContext';
import { useToast }          from '@/components/ui/Toast';
import { useWatchProgress }  from '@/hooks/useWatchProgress';
import { useLocalStorage }   from '@/hooks/useLocalStorage';
import { useKeyboard }       from '@/hooks/useKeyboard';

const SERVERS = ['hd-1', 'hd-2', 'hd-3', 'StreamSB', 'StreamTape'];
const CATS    = ['sub', 'dub'];
const BASE_API = process.env.NEXT_PUBLIC_API_URL || '/backend-api';

// seasonCounter = how many sequels/prequels we have seen so far (1-based for current)
function getSeasonLabel(relation, type, seasonCounter) {
  const r = (relation || '').toLowerCase();
  if (r.includes('sequel'))      return `Season ${seasonCounter + 1}`;
  if (r.includes('prequel'))     return seasonCounter > 1 ? `Season ${seasonCounter - 1}` : 'Prequel';
  if (type === 'Movie')          return 'Movie';
  if (r.includes('side story'))  return 'Side Story';
  if (r.includes('spin'))        return 'Spin-off';
  if (r.includes('alternative')) return 'Alt Version';
  return relation || 'Related';
}

export default function WatchPage() {
  const { id }       = useParams();
  const searchParams = useSearchParams();
  const router       = useRouter();
  const { user }     = useAuth();
  const toast        = useToast();
  const { save: saveProgress } = useWatchProgress();
  const videoRef     = useRef(null);

  const [defaultCat] = useLocalStorage('animex_default_cat', 'sub');
  const [defaultSrv] = useLocalStorage('animex_default_srv', 'hd-1');

  const epId = searchParams.get('ep');

  const [anime,            setAnime]           = useState(null);
  const [episodes,         setEpisodes]        = useState([]);
  const [currentEp,        setCurrentEp]       = useState(null);
  const [relations,        setRelations]       = useState([]);
  const [streamUrl,        setStreamUrl]       = useState(null);
  const [subtitles,        setSubtitles]       = useState([]);
  const [intro,            setIntro]           = useState(null);
  const [outro,            setOutro]           = useState(null);

  const [server,           setServer]          = useState(defaultSrv);
  const [category,         setCategory]        = useState(searchParams.get('category') || defaultCat);
  const [loading,          setLoading]         = useState(true);
  const [sourceError,      setSourceError]     = useState(false);
  const [stats,            setStats]           = useState({});
  const [reacted,          setReacted]         = useState(null);
  const [inList,           setInList]          = useState(false);
  const [savedProgress,    setSavedProgress]   = useState(null);
  const [showResumeModal,  setShowResumeModal] = useState(false);
  const [autoNextEnabled]                      = useState(true);
  const [showAutoNext,     setShowAutoNext]    = useState(false);
  const [countdown,        setCountdown]       = useState(5);
  const [navigation,       setNavigation]      = useState({ previous: null, current: Number(epId) || 1, next: null });
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [showSeasons,      setShowSeasons]     = useState(false);
  const [activeProvider,   setActiveProvider]   = useState(null);

  /* 1. Navigation — fire-and-forget, never blocks page load */
  useEffect(() => {
    if (!id) return;
    const apiBase = process.env.NEXT_PUBLIC_API_URL || BASE_API;
    const ctrl = new AbortController();
    fetch(`${apiBase}/anime/${id}/episode/${Number(epId) || 1}/navigation`, {
      signal: ctrl.signal,
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setNavigation({ previous: d.previous, current: d.current, next: d.next }); })
      .catch(() => {}); // silently ignore — Render may be sleeping
    return () => ctrl.abort();
  }, [id, epId]);

  /* 2. Resume progress */
  useEffect(() => {
    if (!id || !user) return;
    const apiBase = process.env.NEXT_PUBLIC_API_URL || BASE_API;
    fetch(`${apiBase}/user/watch-progress/${id}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.progress?.currentTime > 60) {
          setSavedProgress(d.progress.currentTime);
          setShowResumeModal(true);
        }
      }).catch(() => {});
  }, [id, user]);

  /* 3. Load anime + episodes */
  useEffect(() => {
    if (!id) return;
    setAnime(null);        // clear stale season data before fetching new one
    setCurrentEp(null);   // prevent Effect 5 firing with old episode + new id
    setEpisodes([]);
    setLoading(true);
    Promise.all([animeApi.getInfo(id), animeApi.getEpisodes(id)])
      .then(([infoRes, epRes]) => {
        const animeData = infoRes?.data || infoRes || null;
        const epsData   = epRes?.episodes || epRes?.data?.episodes || epRes?.data || [];
        const epNumWanted = Number(epId) || 1;
        const selected  = epId
          ? epsData.find(ep => Number(ep.number) === epNumWanted)
            || epsData[0]
          : epsData[0];

        setAnime(animeData);
        setEpisodes(Array.isArray(epsData) ? epsData : []);
        setCurrentEp(selected || null);

        const rawRelations = animeData?.relations || [];
        const seasonTypes  = ['sequel', 'prequel', 'side story', 'alternative version', 'spin-off'];
        // Count only sequel/prequel relations for proper season numbering
        let sequelCount = 1; // current show is season 1
        const seasonsData = rawRelations
          .filter(r => seasonTypes.some(t => (r.relation || '').toLowerCase().includes(t)))
          .flatMap((r) => {
            const rel = (r.relation || '').toLowerCase();
            const isSequel  = rel.includes('sequel');
            const isPrequel = rel.includes('prequel');
            if (isSequel) sequelCount++;
            return (r.entry || []).map((e) => ({
              id:       e.mal_id,
              name:     e.name,
              type:     e.type,
              relation: r.relation,
              label:    getSeasonLabel(r.relation, e.type, isSequel ? sequelCount : isPrequel ? 1 : sequelCount),
            }));
          });
        setRelations(seasonsData);
      })
      .catch(err => { console.error(err); toast.error('Could not load anime data.'); })
      .finally(() => setLoading(false));
  }, [id, epId]);

  /* 4. Stats & Watchlist */
  useEffect(() => {
    if (!id) return;
    animeApi.getStats?.(id)
      .then(r => setStats(r?.data?.stats || r?.data || r?.stats || r || {}))
      .catch(() => setStats({}));
    if (user) userApi.checkWatchlist?.(id).then(r => setInList(r?.inWatchlist || false)).catch(() => {});
  }, [id, user]);

  /* 5. Load stream */
  useEffect(() => {
    if (!currentEp || !anime) return;
    // Guard: skip if anime data is from a different season (stale state during navigation)
    if (String(anime.mal_id || anime.id) !== String(id)) return;
    setStreamUrl(null);
    setActiveProvider(null);
    setSourceError(false);
    setSubtitles([]);
    setIntro(null);
    setOutro(null);

    const epNum = currentEp.number || 1;

    const titleForSources = anime?.title_romaji || anime?.title_english || anime?.name || anime?.title || '';

    animeApi.getSources({
      animeId: id,
      epNum: epNum,
      title: titleForSources,
      category: category,
      server: server
    })
      .then(res => {
        const sources = res?.sources || res?.data?.sources || [];
        const source  = sources[0]?.url || null;

        if (!source) {
          console.warn('[Watch] No source URL:', JSON.stringify(res).slice(0, 300));
          setSourceError(true);
          return;
        }

        setStreamUrl(source);
        setActiveProvider(res?.provider || null);
        setSubtitles(res?.tracks  || res?.data?.tracks  || []);
        setIntro(    res?.intro   || res?.data?.intro   || null);
        setOutro(    res?.outro   || res?.data?.outro   || null);

        if (user && anime) {
          userApi.addToHistory({
            animeId:       id,
            animeTitle:    anime?.name || anime?.title,
            animeImage:    anime?.poster || anime?.images?.jpg?.large_image_url || '/no-poster.svg',
            episode:       `episode-${epNum}`,
            episodeNumber: currentEp.number,
            dubOrSub:      category,
            animeType:     anime?.type || 'TV',
          }).catch(() => {});
        }
      })
      .catch(err => {
        console.error('[Watch] getSources error:', err);
        setSourceError(true);
      });
  }, [currentEp, server, category, user, anime, id]);

  /* 6. Handlers */
  const currentIndex = episodes.findIndex(ep =>
    Number(ep.number) === Number(currentEp?.number)
  );

  const goEpisode = useCallback((ep) => {
    // Always use sequential episode number in URL — never raw mal_id (e.g. 625241)
    const nextId = ep.number;
    setCurrentEp(ep);
    router.replace(`/watch/${id}?ep=${nextId}&category=${category}`, { scroll: false });
  }, [id, category, router]);

  const navigate = useCallback((dir) => {
    const next = episodes[currentIndex + dir];
    if (next) goEpisode(next);
    else toast.info(dir > 0 ? 'No next episode' : 'No previous episode');
  }, [episodes, currentIndex, goEpisode, toast]);

  const handleEnded = useCallback(() => {
    if (!navigation.next || !autoNextEnabled) return;
    setShowAutoNext(true);
    setCountdown(5);
  }, [navigation.next, autoNextEnabled]);

  const handleToggleList = async () => {
    try {
      if (inList) {
        await userApi.removeFromWatchlist(id);
        setInList(false);
        toast.success('Removed from watchlist');
      } else {
        await userApi.addToWatchlist({
          animeId:    id,
          animeName:  anime?.name || anime?.title,
          animeImage: anime?.poster || anime?.images?.jpg?.large_image_url || '/no-poster.jpg',
          animeType:  anime?.type || 'TV',
        });
        setInList(true);
        toast.success('Added to watchlist!');
      }
    } catch { toast.error('Failed to update watchlist'); }
  };

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) await navigator.share({ title: animeTitle, url });
    else { await navigator.clipboard.writeText(url); toast.success('Link copied!'); }
  };

  useKeyboard({ ArrowLeft: () => navigate(-1), ArrowRight: () => navigate(1) });

  if (loading) return (
    <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>Loading...</div>
  );

  const animeTitle  = anime?.title || anime?.name || 'Unknown Anime';
  const animePoster = anime?.images?.jpg?.large_image_url || anime?.images?.jpg?.image_url || anime?.poster || '/no-poster.svg';
  const synopsis    = anime?.synopsis || anime?.description || '';
  const genres      = anime?.genres?.map(g => g.name) || [];
  const studios     = anime?.studios?.map(s => s.name) || [];
  const score       = anime?.score || null;
  const status      = anime?.status || '';
  const airedStr    = anime?.aired?.string || '';
  const premiered   = anime?.season && anime?.year ? `${anime.season} ${anime.year}` : '';
  const animeType   = anime?.type || '';
  const duration    = anime?.duration || '';
  const rating      = anime?.rating || '';
  const japTitle    = anime?.title_japanese || '';
  const totalEps    = anime?.episodes?.sub != null ? anime.episodes.sub
                      : typeof anime?.episodes === 'number' ? anime.episodes : null;

  // Determine which season the current show is.
  // If there are prequels, current show is NOT season 1 — it's after them.
  const prequelCount = (anime?.relations || []).filter(r =>
    (r.relation || '').toLowerCase().includes('prequel')
  ).length;
  const currentSeasonNum = prequelCount + 1;
  const currentSeasonLabel = currentSeasonNum === 1 ? 'Season 1' : `Season ${currentSeasonNum}`;

  const allSeasons = relations.length > 0
    ? [{ id, name: animeTitle, type: animeType, label: currentSeasonLabel, isCurrent: true }, ...relations]
    : [];

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh', color: 'var(--text-1)' }}>

      {showResumeModal && savedProgress && (
        <ContinueWatchingModal
          currentTime={savedProgress}
          duration={videoRef.current?.duration || 0}
          onResume={() => setShowResumeModal(false)}
          onRestart={() => setShowResumeModal(false)}
        />
      )}

      {showAutoNext && navigation.next && (
        <AutoNextModal
          nextEpisode={navigation.next}
          countdown={countdown}
          onCancel={() => setShowAutoNext(false)}
          onPlayNext={() => router.push(`/watch/${id}?ep=${navigation.next}&category=${category}`)}
        />
      )}

      {/* Hero banner */}
      <div style={{ position: 'relative', height: 200, overflow: 'hidden' }}>
        <img
          src={animePoster}
          alt={animeTitle}
          style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(6px) brightness(0.3)', transform: 'scale(1.08)' }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 30%, var(--bg-base))' }} />
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 16px 60px', marginTop: -80, position: 'relative', zIndex: 10 }}>

        {/* Breadcrumb */}
        <div style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          <Link href="/home" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>Home</Link>
          <span>/</span>
          <Link href={`/anime/${id}`} style={{ color: 'var(--text-3)', textDecoration: 'none' }}>{animeTitle}</Link>
          <span>/</span>
          <span style={{ color: 'var(--text-1)' }}>Episode {currentEp?.number || 1}</span>
        </div>

        {/* Video player */}
        <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', background: '#000', boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}>
          <div style={{ aspectRatio: '16/9' }}>
            {sourceError ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#f87171' }}>
                Stream unavailable — try another server
              </div>
            ) : !streamUrl ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'var(--text-3)' }}>
                Loading stream...
              </div>
            ) : (
              <VideoPlayer
                ref={videoRef}
                src={streamUrl}
                subtitleTracks={subtitles}
                intro={intro}
                outro={outro}
                onEnded={handleEnded}
                onTimeUpdate={(pos, dur) => {
                  if (currentEp) saveProgress(id, currentEp.number, currentEp.number, pos, dur);
                }}
              />
            )}
          </div>
        </div>

        {/* Controls bar */}
        <div style={{ marginTop: 10, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <button onClick={() => navigate(-1)} style={{ padding: '6px 14px', borderRadius: 6, background: 'var(--bg-card-alt)', border: '1px solid var(--border)', color: 'var(--text-1)', fontSize: 12, cursor: 'pointer' }}>
            ← Prev
          </button>
          <button onClick={() => navigate(1)} style={{ padding: '6px 14px', borderRadius: 6, background: 'var(--bg-card-alt)', border: '1px solid var(--border)', color: 'var(--text-1)', fontSize: 12, cursor: 'pointer' }}>
            Next →
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {CATS.map(c => (
              <button key={c} onClick={() => setCategory(c)} style={{
                padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                background: category === c ? 'var(--accent)' : 'var(--bg-card-alt)',
                color: category === c ? '#111' : 'var(--text-3)',
              }}>
                {c.toUpperCase()}
              </button>
            ))}
            <select
              value={server}
              onChange={e => setServer(e.target.value)}
              style={{ background: 'var(--bg-card-alt)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', fontSize: 11, color: 'var(--text-1)', cursor: 'pointer' }}
            >
              {SERVERS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Main layout */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 20 }} className="watch-main-grid">
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', fontFamily: 'Rajdhani, sans-serif', color: 'var(--text-1)' }}>
              {animeTitle}
            </h1>
            {japTitle && <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 6px' }}>{japTitle}</p>}
            {currentEp?.title && (
              <p style={{ fontSize: 13, color: 'var(--accent)', margin: '0 0 14px', fontWeight: 600 }}>
                Episode {currentEp.number}: {currentEp.title}
              </p>
            )}

            {/* Anime info card */}
            <div style={{ marginTop: 16, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'flex', gap: 16, padding: 16 }}>
                <Link href={`/anime/${id}`}>
                  <img
                    src={animePoster}
                    alt={animeTitle}
                    style={{ width: 90, minWidth: 90, height: 128, objectFit: 'cover', borderRadius: 7, display: 'block' }}
                    onError={e => { e.currentTarget.src = '/no-poster.svg'; }}
                  />
                </Link>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    {score && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--accent)', color: '#111', fontWeight: 800, fontSize: 11, padding: '3px 8px', borderRadius: 4 }}>
                        <Star size={10} fill="#111" strokeWidth={0} /> {score}
                      </span>
                    )}
                    {animeType && <span style={{ fontSize: 11, background: 'var(--bg-card-alt)', border: '1px solid var(--border)', padding: '3px 8px', borderRadius: 4, color: 'var(--text-2)' }}>{animeType}</span>}
                    {status && <span style={{ fontSize: 11, background: 'var(--bg-card-alt)', border: '1px solid var(--border)', padding: '3px 8px', borderRadius: 4, color: status === 'Currently Airing' ? 'var(--accent)' : 'var(--text-2)' }}>{status}</span>}
                    {totalEps && <span style={{ fontSize: 11, background: 'var(--bg-card-alt)', border: '1px solid var(--border)', padding: '3px 8px', borderRadius: 4, color: 'var(--text-2)' }}>{totalEps} eps</span>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
                    {airedStr   && <InfoRow label="Aired"     value={airedStr} />}
                    {premiered  && <InfoRow label="Premiered" value={premiered} />}
                    {studios.length > 0 && <InfoRow label="Studio" value={studios.join(', ')} />}
                    {duration   && <InfoRow label="Duration"  value={duration} />}
                    {rating     && <InfoRow label="Rating"    value={rating} />}
                    {allSeasons.length > 0 && <InfoRow label="Total Seasons" value={allSeasons.length} />}
                  </div>
                </div>
              </div>

              {genres.length > 0 && (
                <div style={{ padding: '0 16px 12px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {genres.map(g => (
                    <Link key={g} href={`/genre/${g.toLowerCase().replace(/ /g, '-')}`}
                      style={{ fontSize: 11, background: 'var(--bg-card-alt)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 9px', color: 'var(--text-3)', textDecoration: 'none' }}>
                      {g}
                    </Link>
                  ))}
                </div>
              )}

              {synopsis && (
                <div style={{ padding: '0 16px 14px', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <p style={{ fontSize: 13, lineHeight: 1.75, color: 'var(--text-2)', margin: 0 }}>
                    {synopsisExpanded ? synopsis : `${synopsis.slice(0, 280)}${synopsis.length > 280 ? '...' : ''}`}
                  </p>
                  {synopsis.length > 280 && (
                    <button onClick={() => setSynopsisExpanded(!synopsisExpanded)}
                      style={{ marginTop: 6, background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}>
                      {synopsisExpanded ? <><ChevronUp size={12} /> Less</> : <><ChevronDown size={12} /> More</>}
                    </button>
                  )}
                </div>
              )}

              <div style={{ padding: '10px 16px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={handleToggleList}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 6, border: '1px solid var(--border)', background: inList ? 'var(--accent)' : 'var(--bg-card-alt)', color: inList ? '#111' : 'var(--text-1)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {inList ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
                  {inList ? 'Saved' : 'Save'}
                </button>
                <button onClick={share}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card-alt)', color: 'var(--text-1)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  <Share2 size={13} /> Share
                </button>
                <Link href={`/anime/${id}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card-alt)', color: 'var(--text-1)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                  Full Info →
                </Link>
              </div>
            </div>

            {/* Season switcher */}
            {allSeasons.length > 1 && (
              <div style={{ marginTop: 16 }}>
                <button
                  onClick={() => setShowSeasons(!showSeasons)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: showSeasons ? '10px 10px 0 0' : 10, cursor: 'pointer', color: 'var(--text-1)', fontSize: 13, fontWeight: 700 }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Layers size={15} color="var(--accent)" />
                    Seasons & Related
                  </span>
                  {showSeasons ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>
                {showSeasons && (
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
                    {allSeasons.map((s, i) => (
                      <Link key={s.id || i} href={s.isCurrent ? '#' : `/watch/${s.id}?ep=1&category=${category}`}
                        onClick={e => { if (s.isCurrent) e.preventDefault(); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px',
                          borderBottom: i < allSeasons.length - 1 ? '1px solid var(--border)' : 'none',
                          textDecoration: 'none', background: s.isCurrent ? 'var(--accent-dim, rgba(180,255,60,0.08))' : 'transparent',
                        }}
                        onMouseEnter={e => { if (!s.isCurrent) e.currentTarget.style.background = 'var(--bg-card-alt)'; }}
                        onMouseLeave={e => { if (!s.isCurrent) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <span style={{
                          minWidth: 72, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em',
                          padding: '3px 8px', borderRadius: 4, textAlign: 'center',
                          background: s.isCurrent ? 'var(--accent)' : 'var(--bg-card-alt)',
                          color: s.isCurrent ? '#111' : 'var(--text-3)',
                          border: s.isCurrent ? 'none' : '1px solid var(--border)',
                        }}>
                          {s.label}
                        </span>
                        <span style={{ fontSize: 13, color: s.isCurrent ? 'var(--accent)' : 'var(--text-2)', fontWeight: s.isCurrent ? 700 : 400, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.name}
                        </span>
                        {s.type && <span style={{ fontSize: 10, color: 'var(--text-4)', flexShrink: 0 }}>{s.type}</span>}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Episode Panel */}
            <div style={{ marginTop: 20 }}>
              <EpisodePanel
                episodes={episodes}
                currentEpId={currentEp?.number}
                onSelect={goEpisode}
                watchedIds={new Set()}
              />
            </div>

            {/* Comments */}
            <div style={{ marginTop: 20 }}>
              <DisqusComments
                pageId={`anime-${id}-ep-${epId || 1}`}
                pageTitle={animeTitle}
              />
            </div>

            {/* Recommendations */}
            {(() => {
              const recs = [
                ...(anime?.relations || []).flatMap(r => (r.entry || []).map(e => ({
                  id: e.mal_id, name: e.name, poster: e.images?.jpg?.image_url || '/no-poster.svg',
                }))),
                ...(anime?.recommendations || []).map(r => {
                  const e = r.entry || r;
                  return { id: e.mal_id || e.id, name: e.title || e.name, poster: e.images?.jpg?.image_url || '/no-poster.svg' };
                }),
              ].filter((a, i, arr) => a.id && arr.findIndex(x => x.id === a.id) === i).slice(0, 12);

              return recs.length > 0 ? (
                <div style={{ marginTop: 20 }}>
                  <AnimeRow title="Recommended for You" animes={recs} loading={false} />
                </div>
              ) : null;
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--text-4)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  );
}
