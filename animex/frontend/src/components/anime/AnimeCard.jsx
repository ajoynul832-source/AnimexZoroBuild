'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Play, Star, Clock } from 'lucide-react';
import clsx from 'clsx';

export default function AnimeCard({
  anime,
  view = 'grid',
  rank = null,
  compact = false,
  progress = null // e.g. { ep: 3, percent: 85 }
}) {
  if (!anime) return null;

  const title = anime.name || anime.title || 'Unknown Anime';
  const id = anime.id || anime.mal_id;
  const image = anime.poster || anime.images?.jpg?.large_image_url || '/no-poster.svg';
  const type = anime.type || 'TV';
  const rating = anime.rating || anime.score || null;
  
  // Clean up episodes safely
  let subCount = null;
  let dubCount = null;
  if (typeof anime.episodes === 'object' && anime.episodes !== null) {
      subCount = anime.episodes.sub || null;
      dubCount = anime.episodes.dub || null;
  } else {
      subCount = typeof anime.episodes === 'number' || typeof anime.episodes === 'string' ? anime.episodes : null;
  }

  if (view === 'list') {
    return (
      <div
        className="group relative flex gap-4 p-3 rounded-lg bg-surface hover:bg-surface-light border border-border/50 hover:border-primary/30 transition-all cursor-pointer h-28"
      >
        {/* RANK INDICATOR */}
        {rank !== null && (
          <div className="flex-shrink-0 w-8 flex items-center justify-center">
            <span className={clsx(
              "text-3xl font-black italic shadow-text",
              rank <= 3 ? "text-primary" : "text-text-muted/30"
            )}>
              {rank}
            </span>
          </div>
        )}

        {/* POSTER */}
        <div className="relative w-16 md:w-20 rounded-md overflow-hidden bg-surface-dark flex-shrink-0">
          <Image
            src={image}
            alt={title}
            fill
            sizes="80px"
            className="object-cover group-hover:scale-110 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
             <Play className="w-8 h-8 text-white fill-white shadow-drop" />
          </div>
        </div>

        {/* INFO */}
        <div className="flex flex-col justify-center min-w-0 pr-2 pb-1">
           <h3 className="text-sm font-semibold text-text-primary line-clamp-2 leading-tight group-hover:text-primary transition-colors">
              {title}
           </h3>
           <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
              {type && <span>{type}</span>}
              {rating && (
                <div className="flex items-center gap-1 text-yellow-400 font-medium">
                   <Star className="w-3 h-3 fill-current" />
                   {rating}
                </div>
              )}
           </div>
        </div>

        <Link href={`/anime/${id}`} className="absolute inset-0 z-10" aria-label={`View ${title}`} />
      </div>
    );
  }

  // DEFAULT: GRID VIEW
  return (
    <div className="group relative flex flex-col h-full cursor-pointer">
      {/* POSTER WRAPPER */}
      <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-surface mb-2 shadow-md">
        
        {/* IMAGE */}
        <Image
          src={image}
          alt={title}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
          className="object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
        />

        {/* OVERLAY */}
         <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

        {/* PLAY BUTTON ON HOVER */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 scale-90 group-hover:scale-100 z-20">
          <div className="bg-primary hover:bg-primary-hover text-white rounded-full p-4 shadow-glow transition-colors transform">
             <Play className="w-8 h-8 fill-current ml-1" />
          </div>
        </div>

        {/* BADGES (Top Left) */}
        {!compact && (
          <div className="absolute top-2 left-2 flex gap-1 z-10">
             {type && (
               <span className="px-1.5 py-0.5 rounded bg-surface-dark/90 text-text-primary text-[10px] font-bold tracking-wider backdrop-blur-sm border border-white/10 uppercase">
                 {type}
               </span>
             )}
             {rating && (
                <span className="px-1.5 py-0.5 rounded bg-surface-dark/90 flex items-center gap-0.5 text-yellow-500 text-[10px] font-bold tracking-wider backdrop-blur-sm border border-white/10">
                  <Star className="w-2.5 h-2.5 fill-current" />
                  {rating}
               </span>
             )}
          </div>
        )}

        {/* EPISODE BADGES (Bottom Right) */}
        {!compact && (subCount || dubCount) && (
          <div className="absolute bottom-2 right-2 flex gap-1 z-10 shadow-drop">
             {subCount && (
               <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#e8eef0] text-[#111] text-[10px] font-bold border border-white/80">
                 <span className="w-1.5 h-1.5 rounded-full bg-[#111] opacity-70" />
                 {subCount}
               </span>
             )}
             {dubCount && (
               <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#b0a4e3] text-[#111] text-[10px] font-bold border border-white/80">
                 <span className="w-1.5 h-1.5 rounded-full bg-[#111] border border-[#111] opacity-70" />
                 {dubCount}
               </span>
             )}
          </div>
        )}

        {/* WATCH PROGRESS BAR (if available) */}
        {progress && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/50 z-20 overflow-hidden">
             <div 
               className="h-full bg-primary" 
               style={{ width: `${Math.min(100, progress.percent || 0)}%` }} 
             />
          </div>
        )}
      </div>

      {/* METADATA */}
      <h3 className="text-sm font-semibold text-text-primary leading-tight line-clamp-2 mt-1 mb-0.5 group-hover:text-primary transition-colors pr-4">
        {title}
      </h3>
      
      {progress ? (
         <div className="flex items-center gap-1.5 text-[11px] text-primary/80 font-medium">
             <Clock className="w-3 h-3" />
             Ep {progress.ep}
         </div>
      ) : (
        <p className="text-[11px] text-text-muted mt-auto">
          {type === 'Movie' ? 'Movie' : 'Series'}
        </p>
      )}

      {/* FULL CLICK TARGET */}
      <Link href={`/anime/${id}`} className="absolute inset-0 z-30" aria-label={`Watch ${title}`} />
    </div>
  );
}

export function AnimeCardSkeleton({ view = 'grid' }) {
  if (view === 'list') {
    return (
      <div className="flex gap-4 p-3 rounded-lg bg-surface border border-border/50 h-28 animate-pulse">
        <div className="w-16 md:w-20 rounded-md bg-white/10 shrink-0" />
        <div className="flex flex-col justify-center gap-2 flex-grow">
          <div className="h-4 bg-white/10 rounded w-3/4" />
          <div className="h-3 bg-white/10 rounded w-1/4 mt-2" />
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col h-full animate-pulse">
      <div className="aspect-[3/4] rounded-lg bg-white/10 mb-2" />
      <div className="h-4 bg-white/10 rounded w-3/4 mt-1 mb-0.5" />
      <div className="h-3 bg-white/10 rounded w-1/2 mt-auto" />
    </div>
  );
}
