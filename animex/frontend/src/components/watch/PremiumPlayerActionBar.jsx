'use client';

export default function PremiumPlayerActionBar({
  onPrev,
  onNext,
  onToggleLight,
  onExpand,
  onDownload,
  lightOff = false,
}) {
  return (
    <div className="mt-4 rounded-3xl border border-white/10 bg-[#121218] p-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={onPrev}
            className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10"
          >
            ← Prev Episode
          </button>

          <button
            onClick={onNext}
            className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10"
          >
            Next Episode →
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={onToggleLight}
            className={`px-4 py-2 rounded-xl border transition ${
              lightOff
                ? 'border-lime-300 bg-lime-300 text-black font-semibold'
                : 'border-white/10 bg-white/5 hover:bg-white/10'
            }`}
          >
            💡 Light
          </button>

          <button
            onClick={onExpand}
            className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10"
          >
            ⛶ Expand
          </button>

          <button
            onClick={onDownload}
            className="px-4 py-2 rounded-xl bg-lime-300 text-black font-semibold"
          >
            ⬇ Download
          </button>
        </div>
      </div>
    </div>
  );
}
