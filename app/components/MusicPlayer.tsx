'use client';
import { useRef, useState, useEffect } from 'react';

const INTRO_URL = '/assets/audio/intro_music.mp3';
const LOOP_URL  = '/assets/audio/intro_music_2.mp3';

const LOOP_CROSSFADE = 0.05; // 50ms seam crossfade, only for intro_music_2 looping itself
const VOLUME_CAP     = 0.42; // max output — 40% then 30% reduction from full

export default function MusicPlayer() {
  const [isPlaying, setIsPlaying]   = useState(false);
  const [volume, setVolume]         = useState(1.0);
  const [isLoaded, setIsLoaded]     = useState(false);

  const audioCtxRef    = useRef<AudioContext | null>(null);
  const masterGainRef  = useRef<GainNode | null>(null);
  const introBufferRef = useRef<AudioBuffer | null>(null);
  const loopBufferRef  = useRef<AudioBuffer | null>(null);
  const loopTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPlayingRef   = useRef(false);

  // Lazily initialise AudioContext and fetch buffers on first play click.
  // Avoids creating an AudioContext (and fetching 1.5 MB of audio) on every page load.
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

  const cancelLoop = () => {
    if (loopTimerRef.current) {
      clearTimeout(loopTimerRef.current);
      loopTimerRef.current = null;
    }
  };

  // Schedules one iteration of intro_music_2 with 50ms crossfade at both seams,
  // then pre-schedules the next iteration before this one ends.
  const scheduleLoopIteration = (startAt: number) => {
    if (!isPlayingRef.current) return;
    const ctx    = audioCtxRef.current;
    const buffer = loopBufferRef.current;
    const gain   = masterGainRef.current;
    if (!ctx || !buffer || !gain) return;

    const endAt  = startAt + buffer.duration;
    const nextAt = endAt - LOOP_CROSSFADE;

    const fadeGain = ctx.createGain();
    fadeGain.gain.setValueAtTime(0,   startAt);
    fadeGain.gain.linearRampToValueAtTime(1, startAt + LOOP_CROSSFADE); // fade in
    fadeGain.gain.setValueAtTime(1,   nextAt);
    fadeGain.gain.linearRampToValueAtTime(0, endAt);                    // fade out
    fadeGain.connect(gain);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(fadeGain);
    source.start(startAt);

    // Pre-schedule next iteration
    const delay = Math.max(0, (nextAt - ctx.currentTime) * 1000 - 50);
    loopTimerRef.current = setTimeout(() => scheduleLoopIteration(nextAt), delay);
  };

  // Plays intro_music once, then hands off sample-accurately to intro_music_2 loop.
  const startPlayback = () => {
    const ctx    = audioCtxRef.current;
    const intro  = introBufferRef.current;
    const loop   = loopBufferRef.current;
    const gain   = masterGainRef.current;
    if (!ctx || !intro || !gain) return;

    const startAt    = ctx.currentTime;
    const loopStartAt = startAt + intro.duration; // exact sample-accurate hand-off

    const source = ctx.createBufferSource();
    source.buffer = intro;
    source.connect(gain);
    source.start(startAt);

    if (loop) {
      // Pre-schedule first loop iteration 50ms before intro ends so timer fires in time
      const delay = Math.max(0, (loopStartAt - ctx.currentTime) * 1000 - 50);
      loopTimerRef.current = setTimeout(() => scheduleLoopIteration(loopStartAt), delay);
    }
  };

  const togglePlay = async () => {
    if (isPlaying) {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      isPlayingRef.current = false;
      setIsPlaying(false);
      cancelLoop();
      await ctx.suspend();
    } else {
      const ctx = await ensureAudio();
      isPlayingRef.current = true;
      setIsPlaying(true);
      await ctx.resume();
      startPlayback();
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
