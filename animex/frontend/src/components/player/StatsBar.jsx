'use client';

export default function StatsBar({
  stats = {},
  reacted,
  onReact,
  inList,
  onToggleList,
  animeTitle,
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#121218] p-5">
      <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
        <div>
          <h3 className="text-lg font-semibold">{animeTitle}</h3>
          <p className="text-sm text-zinc-400 mt-1">
            {stats.views || 0} views • {stats.likes || 0} likes • {stats.comments || 0} comments
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => onReact?.('like')}
            className={`px-4 py-2 rounded-xl border transition ${
              reacted === 'like'
                ? 'border-lime-300 bg-lime-300 text-black font-semibold'
                : 'border-white/10 bg-white/5 hover:bg-white/10'
            }`}
          >
            👍 Like
          </button>

          <button
            onClick={() => onReact?.('dislike')}
            className={`px-4 py-2 rounded-xl border transition ${
              reacted === 'dislike'
                ? 'border-red-400 bg-red-400 text-black font-semibold'
                : 'border-white/10 bg-white/5 hover:bg-white/10'
            }`}
          >
            👎 Dislike
          </button>

          <button
            onClick={onToggleList}
            className={`px-4 py-2 rounded-xl border transition ${
              inList
                ? 'border-lime-300 bg-lime-300 text-black font-semibold'
                : 'border-white/10 bg-white/5 hover:bg-white/10'
            }`}
          >
            {inList ? '✓ In Watchlist' : '+ Add to List'}
          </button>

          <button
            className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10"
            onClick={() => {
              if (navigator?.share) {
                navigator.share({
                  title: animeTitle,
                  text: `Watch ${animeTitle}`,
                  url: window.location.href,
                });
              }
            }}
          >
            Share
          </button>
        </div>
      </div>
    </div>
  );
}
