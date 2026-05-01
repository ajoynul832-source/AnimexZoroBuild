'use client';

export default function AutoNextModal({
  nextEpisode,
  countdown,
  onCancel,
  onPlayNext,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#121218] p-6 shadow-2xl">
        <h3 className="text-xl font-semibold mb-2">
          Next Episode Ready
        </h3>

        <p className="text-zinc-400 text-sm mb-5">
          Episode {nextEpisode} starts automatically in {countdown}s
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-white/10 py-3 bg-white/5"
          >
            Cancel
          </button>

          <button
            onClick={onPlayNext}
            className="flex-1 rounded-xl py-3 bg-lime-300 text-black font-semibold"
          >
            Play Next
          </button>
        </div>
      </div>
    </div>
  );
}
