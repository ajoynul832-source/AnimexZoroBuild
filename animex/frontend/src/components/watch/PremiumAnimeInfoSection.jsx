'use client';

export default function PremiumAnimeInfoSection({
  anime,
  category = 'sub',
}) {
  const animeTitle = anime?.title || anime?.name || 'Anime';

  return (
    <div className="mt-8 grid md:grid-cols-[260px_1fr] gap-6">
      <div>
        <img
          src={anime?.poster || '/no-poster.jpg'}
          alt={animeTitle}
          className="w-full rounded-3xl border border-white/10 object-cover"
        />
      </div>

      <div className="rounded-3xl border border-white/10 bg-[#121218] p-6">
        <h2 className="text-2xl font-semibold mb-3">
          {animeTitle}
        </h2>

        <p className="text-zinc-300 leading-7">
          {anime?.synopsis || 'No synopsis available for this anime.'}
        </p>

        <div className="grid md:grid-cols-2 gap-4 mt-6 text-sm">
          <div>
            <span className="text-zinc-400">Type:</span> {anime?.type || 'TV'}
          </div>

          <div>
            <span className="text-zinc-400">Status:</span> {anime?.status || 'Ongoing'}
          </div>

          <div>
            <span className="text-zinc-400">Release Year:</span> {anime?.year || anime?.released || '—'}
          </div>

          <div>
            <span className="text-zinc-400">Language:</span> {String(category).toUpperCase()}
          </div>

          <div>
            <span className="text-zinc-400">Episodes:</span> {typeof anime?.episodes === 'object' ? anime?.episodes?.sub || anime?.episodes?.dub || '—' : anime?.episodes || '—'}
          </div>

          <div>
            <span className="text-zinc-400">Rating:</span> {anime?.score || '—'}
          </div>
        </div>

        {anime?.genres?.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm text-zinc-400 mb-3">
              Genres
            </h3>

            <div className="flex flex-wrap gap-2">
              {anime.genres.map((genre, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-sm"
                >
                  {typeof genre === 'string' ? genre : genre.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
