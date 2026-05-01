'use client';

export default function ContinueWatchingModal({
  currentTime,
  duration,
  onResume,
  onRestart,
}) {
  const progress = duration
    ? Math.min(100, Math.round((currentTime / duration) * 100))
    : 0;

  const formatTime = (sec = 0) => {
    const minutes = Math.floor(sec / 60);
    const seconds = Math.floor(sec % 60);
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#121218] p-6 shadow-2xl">
        <h2 className="text-2xl font-semibold mb-2">
          Continue Watching
        </h2>

        <p className="text-zinc-400 text-sm mb-5">
          You previously watched this episode. Resume where you left off?
        </p>

        <div className="mb-5">
          <div className="w-full h-3 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-lime-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex justify-between text-xs text-zinc-400 mt-2">
            <span>{formatTime(currentTime)}</span>
            <span>{progress}% watched</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onRestart}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 py-3"
          >
            Start From Beginning
          </button>

          <button
            onClick={onResume}
            className="flex-1 rounded-xl bg-lime-300 text-black font-semibold py-3"
          >
            Resume Watching
          </button>
        </div>
      </div>
    </div>
  );
}
