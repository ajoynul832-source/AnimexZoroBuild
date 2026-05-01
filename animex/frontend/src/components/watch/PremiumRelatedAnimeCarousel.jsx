'use client';

import Link from 'next/link';

export default function PremiumRelatedAnimeCarousel({
  related = [],
}) {
  if (!related.length) return null;

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-2xl font-semibold">
          You May Also Like
        </h2>

        <span className="text-sm text-zinc-400">
          {related.length} titles
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {related.map((item) => (
          <Link
            key={item.id}
            href={`/anime/${item.id}`}
            className="group"
          >
            <div className="rounded-3xl overflow-hidden border border-white/10 bg-[#121218] hover:border-lime-300/40 transition-all">
              <div className="overflow-hidden">
                <img
                  src={item.poster || '/no-poster.jpg'}
                  alt={item.name}
                  className="w-full aspect-[2/3] object-cover group-hover:scale-[1.04] transition duration-300"
                />
              </div>

              <div className="p-3">
                <p className="text-sm font-medium line-clamp-2 min-h-[40px]">
                  {item.name}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
