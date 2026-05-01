'use client';

import {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
  useCallback
} from 'react';

const VideoPlayer = forwardRef(function VideoPlayer(
  {
    src,
    subtitleTracks = [],
    intro = null,
    outro = null,
    onReady,
    onError,
    onTimeUpdate,
    onEnded,
    autoPlay = true
  },
  ref
) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const wrapRef = useRef(null);

  const [state, setState] = useState('loading'); // loading | ready | error
  const [errMsg, setErrMsg] = useState('');
  const [qualities, setQualities] = useState([]);
  const [curQ, setCurQ] = useState(-1);
  const [lightOff, setLightOff] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // NEW
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [showSkipOutro, setShowSkipOutro] = useState(false);

  useImperativeHandle(ref, () => videoRef.current);

  /*
  ─────────────────────────────
  INIT HLS / SOURCE
  ─────────────────────────────
  */

  useEffect(() => {
    if (!src) {
      setState('loading');
      return;
    }

    let mounted = true;

    const init = async () => {
      setState('loading');
      setErrMsg('');
      setQualities([]);
      setCurQ(-1);
      setShowSkipIntro(false);
      setShowSkipOutro(false);

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      const video = videoRef.current;
      if (!video) return;

      video.pause();
      video.removeAttribute('src');
      video.load();

      const isHLS = /\.m3u8|mux\.dev|m3u/i.test(src);

      if (isHLS) {
        const Hls = (await import('hls.js')).default;

        if (Hls.isSupported()) {
          const hls = new Hls({
            startLevel: -1,
            enableWorker: true,
            maxBufferLength: 60,
            backBufferLength: 90
          });

          hls.loadSource(src);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
            if (!mounted) return;

            setQualities(
              (data?.levels || []).map((level, index) => ({
                index,
                label: level?.height
                  ? `${level.height}p`
                  : `Level ${index + 1}`
              }))
            );

            setState('ready');
            onReady?.();

            if (autoPlay) {
              video.play().catch(() => {});
            }
          });

          hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
            setCurQ(data.level);
          });

          hls.on(Hls.Events.ERROR, (_, data) => {
            if (!data?.fatal) return;

            setState('error');
            setErrMsg('Stream unavailable. Try another server.');
            onError?.();
          });

          hlsRef.current = hls;
          return;
        }

        if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = src;
          setState('ready');
          onReady?.();

          if (autoPlay) {
            video.play().catch(() => {});
          }

          return;
        }
      }

      video.src = src;
      setState('ready');
      onReady?.();

      if (autoPlay) {
        video.play().catch(() => {});
      }
    };

    init().catch(() => {
      setState('error');
      setErrMsg('Failed to load stream.');
      onError?.();
    });

    return () => {
      mounted = false;

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src]);

  /*
  ─────────────────────────────
  QUALITY
  ─────────────────────────────
  */

  const setLevel = (level) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = level;
    }

    setCurQ(level);
  };

  /*
  ─────────────────────────────
  SKIP ±10s
  ─────────────────────────────
  */

  const skip = useCallback((sec) => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = Math.max(
      0,
      Math.min(
        video.duration || 0,
        video.currentTime + sec
      )
    );
  }, []);

  /*
  ─────────────────────────────
  LIGHT MODE
  ─────────────────────────────
  */

  useEffect(() => {
    if (wrapRef.current) {
      wrapRef.current.closest?.('.watch-wrap') &&
        document.body.classList.toggle(
          'lights-off',
          lightOff
        );
    }

    return () => {
      document.body.classList.remove('lights-off');
    };
  }, [lightOff]);

  /*
  ─────────────────────────────
  EXPAND
  ─────────────────────────────
  */

  const handleExpand = () => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    setExpanded((prev) => {
      const next = !prev;

      wrap.style.position = next ? 'fixed' : '';
      wrap.style.inset = next ? '0' : '';
      wrap.style.zIndex = next ? '9999' : '';
      wrap.style.background = next ? '#000' : '';

      return next;
    });
  };

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 420,
        background: '#000',
        borderRadius: 8,
        overflow: 'hidden'
      }}
    >
      {/* Loading */}
      {state === 'loading' && (
        <div style={overlay}>
          <div className="zoro-spinner" />
          <span
            style={{
              fontSize: 12,
              color: 'var(--text-3)',
              marginTop: 10
            }}
          >
            Loading stream...
          </span>
        </div>
      )}

      {/* Error */}
      {state === 'error' && (
        <div
          style={{
            ...overlay,
            flexDirection: 'column',
            gap: 10,
            padding: 20,
            textAlign: 'center'
          }}
        >
          <span style={{ fontSize: 28 }}>
            ⚠️
          </span>

          <p
            style={{
              fontSize: 13,
              color: 'var(--error)'
            }}
          >
            {errMsg}
          </p>
        </div>
      )}

      {/* Video */}
      <video
        ref={videoRef}
        controls
        playsInline
        preload="auto"
        onTimeUpdate={(e) => {
          const current = e.target.currentTime;
          const duration = e.target.duration;

          if (intro) {
            setShowSkipIntro(
              current >= intro.start &&
                current <= intro.end
            );
          }

          if (outro) {
            setShowSkipOutro(
              current >= outro.start &&
                current <= outro.end
            );
          }

          onTimeUpdate?.(current, duration);
        }}
        onEnded={onEnded}
        style={{
          width: '100%',
          height: '100%',
          display:
            state === 'ready'
              ? 'block'
              : 'none',
          background: '#000'
        }}
      >
        {subtitleTracks.map((track, i) => (
          <track
            key={i}
            kind="subtitles"
            label={track.label}
            srcLang={track.lang}
            src={track.src}
            default={i === 0}
          />
        ))}
      </video>

      {/* Skip Intro */}
      {showSkipIntro && intro && (
        <button
          onClick={() => {
            if (videoRef.current) {
              videoRef.current.currentTime =
                intro.end;
            }
            setShowSkipIntro(false);
          }}
          style={{
            position: 'absolute',
            bottom: 80,
            right: 20,
            zIndex: 20,
            padding: '10px 16px',
            borderRadius: 10,
            border: 'none',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          Skip Intro
        </button>
      )}

      {/* Skip Outro */}
      {showSkipOutro && outro && (
        <button
          onClick={() => {
            if (videoRef.current) {
              videoRef.current.currentTime =
                outro.end;
            }
            setShowSkipOutro(false);
          }}
          style={{
            position: 'absolute',
            bottom: 20,
            right: 20,
            zIndex: 20,
            padding: '10px 16px',
            borderRadius: 10,
            border: 'none',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          Skip Outro
        </button>
      )}

      {/* Controls */}
      {state === 'ready' && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            display: 'flex',
            gap: 6,
            zIndex: 10,
            alignItems: 'center'
          }}
        >
          {qualities.length > 1 && (
            <select
              value={curQ}
              onChange={(e) =>
                setLevel(
                  parseInt(
                    e.target.value
                  )
                )
              }
              style={overlaySelect}
            >
              <option value={-1}>
                Auto
              </option>

              {qualities.map((q) => (
                <option
                  key={q.index}
                  value={q.index}
                >
                  {q.label}
                </option>
              ))}
            </select>
          )}

          <button
            style={iconBtn}
            onClick={() => skip(-10)}
          >
            ⏪ 10
          </button>

          <button
            style={iconBtn}
            onClick={() => skip(10)}
          >
            10 ⏩
          </button>

          <button
            style={{
              ...iconBtn,
              background: lightOff
                ? 'var(--accent)'
                : 'rgba(0,0,0,0.65)',
              color: lightOff
                ? '#111'
                : '#fff'
            }}
            onClick={() =>
              setLightOff((v) => !v)
            }
          >
            💡
          </button>

          <button
            style={iconBtn}
            onClick={handleExpand}
          >
            ⛶
          </button>
        </div>
      )}

      <style>{`
        .zoro-spinner {
          width: 36px;
          height: 36px;
          border: 3px solid rgba(255,255,255,.15);
          border-top-color: var(--accent, #cae962);
          border-radius: 50%;
          animation: zoro-spin .7s linear infinite;
        }

        @keyframes zoro-spin {
          to {
            transform: rotate(360deg);
          }
        }

        body.lights-off::after {
          content: '';
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,.85);
          z-index: 998;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
});

const overlay = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'column',
  background: '#050507',
  zIndex: 5
};

const overlaySelect = {
  background: 'rgba(0,0,0,0.75)',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 5,
  color: '#fff',
  fontSize: 11,
  padding: '3px 7px',
  cursor: 'pointer'
};

const iconBtn = {
  background: 'rgba(0,0,0,0.65)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 5,
  color: '#fff',
  fontSize: 11,
  padding: '3px 8px',
  cursor: 'pointer',
  fontWeight: 600
};

export default VideoPlayer;
