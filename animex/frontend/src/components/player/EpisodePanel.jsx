'use client';

export default function EpisodePanel({
  episodes = [],
  currentEpId,
  onSelect,
  watchedIds = new Set(),
}) {
  return (
    <div className="mt-8 rounded-3xl border border-white/10 bg-[#121218] p-5">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-semibold">List of Episodes</h2>
        <span className="text-sm text-zinc-400">
          {episodes.length} Episodes
        </span>
      </div>

      <div className="max-h-[520px] overflow-y-auto pr-2 space-y-3">
        {episodes.map((ep) => {
          const epId = ep?.mal_id || ep?.episode_id || ep?.number;
          const isActive = String(epId) === String(currentEpId);
          const isWatched = watchedIds?.has?.(epId);

          return (
            <button
              key={epId}
              onClick={() => onSelect?.(ep)}
              className={`w-full text-left rounded-2xl border transition-all p-4 ${
                isActive
                  ? 'border-lime-300 bg-lime-300/10'
                  : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm ${
                    isActive
                      ? 'bg-lime-300 text-black'
                      : 'bg-white/5 text-white'
                  }`}
                >
                  {ep.number || epId}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    Episode {ep.number || epId}
                  </div>
                  <div className="text-sm text-zinc-400 truncate mt-1">
                    {ep.title || 'Now Streaming'}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isWatched && (
                    <span className="text-xs px-2 py-1 rounded-lg bg-white/5 text-zinc-300">
                      Watched
                    </span>
                  )}

                  {isActive && (
                    <span className="text-xs px-3 py-1 rounded-lg bg-lime-300 text-black font-semibold">
                      Playing
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
