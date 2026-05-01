'use client';

export default function PremiumServerSwitcher({
  servers = [],
  activeServer,
  onChange,
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#121218] p-5 mt-6">
      <h3 className="text-lg font-semibold mb-4">
        Streaming Servers
      </h3>

      <div className="flex flex-wrap gap-3">
        {servers.map((server) => {
          const active = activeServer === server.value;

          return (
            <button
              key={server.value}
              onClick={() => onChange?.(server.value)}
              className={`px-5 py-3 rounded-2xl border transition-all ${
                active
                  ? 'border-lime-300 bg-lime-300 text-black font-semibold shadow-lg'
                  : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
              }`}
            >
              {server.label}
            </button>
          );
        })}
      </div>

      <p className="text-sm text-zinc-400 mt-4">
        If one server fails, switch to another server for smoother playback.
      </p>
    </div>
  );
}
