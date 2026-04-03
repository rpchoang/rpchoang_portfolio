'use client';
import { useRef, useState, useEffect } from 'react';

const INTRO_URL  = '/assets/audio/intro_music.mp3';
const LOOP_URL   = '/assets/audio/intro_music_2.mp3';
const VOLUME_CAP = 0.42;

export default function MusicPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume]       = useState(1.0);
  const [isLoaded, setIsLoaded]   = useState(false);

  const audioCtxRef    = useRef<AudioContext | null>(null);
  const masterGainRef  = useRef<GainNode | null>(null);
  const introBufferRef = useRef<AudioBuffer | null>(null);
  const loopBufferRef  = useRef<AudioBuffer | null>(null);
  const hasStartedRef  = useRef(false);

  // Lazily initialise AudioContext and fetch buffers on first play click.
  const ensureAudio = (): Promise<AudioContext> => {
    if (audioCtxRef.current) return Promise.resolve(audioCtxRef.current);

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    const gain = ctx.createGain();
    gain.gain.value = VOLUME_CAP;
    gain.connect(ctx.destination);
    masterGainRef.current = gain;

    let loaded = 0;
    return new Promise((resolve) => {
      const onLoad = () => { if (++loaded === 2) { setIsLoaded(true); resolve(ctx); } };
      [
        [INTRO_URL, (b: AudioBuffer) => { introBufferRef.current = b; }],
        [LOOP_URL,  (b: AudioBuffer) => { loopBufferRef.current  = b; }],
      ].forEach(([url, set]) => {
        fetch(url as string)
          .then(r => r.arrayBuffer())
          .then(data => ctx.decodeAudioData(data))
          .then(buffer => { (set as (b: AudioBuffer) => void)(buffer); onLoad(); })
          .catch(console.error);
      });
    });
  };

  useEffect(() => {
    return () => { audioCtxRef.current?.close(); };
  }, []);

  // Plays the intro once, then hands off sample-accurately to the looping track.
  // Called exactly once — subsequent play clicks just ctx.resume().
  const startPlayback = () => {
    const ctx   = audioCtxRef.current;
    const intro = introBufferRef.current;
    const loop  = loopBufferRef.current;
    const gain  = masterGainRef.current;
    if (!ctx || !intro || !gain) return;

    const now         = ctx.currentTime;
    const loopStartAt = now + intro.duration;

    const introSrc = ctx.createBufferSource();
    introSrc.buffer = intro;
    introSrc.connect(gain);
    introSrc.start(now);

    if (loop) {
      const loopSrc = ctx.createBufferSource();
      loopSrc.buffer = loop;
      loopSrc.loop   = true; // browser handles seamless looping natively
      loopSrc.connect(gain);
      loopSrc.start(loopStartAt);
    }
  };

  const togglePlay = async () => {
    if (isPlaying) {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      setIsPlaying(false);
      await ctx.suspend();
    } else {
      const ctx = await ensureAudio();
      setIsPlaying(true);
      await ctx.resume();
      // Only start new nodes on the very first play; subsequent clicks just resume.
      if (!hasStartedRef.current) {
        hasStartedRef.current = true;
        startPlayback();
      }
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (masterGainRef.current) masterGainRef.current.gain.value = val * VOLUME_CAP;
  };

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 group">
      {/* Music indicator — always visible, hints this is background music */}
      <div className="flex items-center gap-1 text-white/40 select-none">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9 3v10.55A4 4 0 1 0 11 17V7h4V3H9z"/>
        </svg>
        <span className="text-[10px] uppercase tracking-widest font-light">BGM</span>
      </div>

      {/* Volume slider — slides in from left on hover */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out max-w-0 group-hover:max-w-[96px] opacity-0 group-hover:opacity-100"
      >
        <label className="sr-only" htmlFor="bgm-volume">BGM volume</label>
        <input
          id="bgm-volume"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={handleVolumeChange}
          className="w-24 accent-white/60 cursor-pointer"
          style={{ accentColor: 'rgba(255,255,255,0.6)' }}
        />
      </div>

      {/* Play / Pause button */}
      <button
        onClick={togglePlay}
        disabled={isPlaying && !isLoaded}
        title={isPlaying ? 'Pause music' : 'Play music'}
        className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isPlaying ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="white">
            <rect x="1" y="0" width="4" height="12" rx="1"/>
            <rect x="7" y="0" width="4" height="12" rx="1"/>
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="white">
            <path d="M2 1L11 6L2 11V1Z"/>
          </svg>
        )}
      </button>
    </div>
  );
}
