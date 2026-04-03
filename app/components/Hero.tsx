'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { AnimationController } from './CyclopsLaserDestroyer';

gsap.registerPlugin(ScrollTrigger);

// --- Module-level constants and pure functions ---
// These have no dependency on component state or props and must not live inside the component.

const TOTAL_FRAMES = 144; // 6 seconds * 24 fps
const FRAME_BASE_URL = process.env.NEXT_PUBLIC_FRAME_BASE_URL || '/assets/hero_landing_frames_nobg';

const frameFileName = (index: number) => {
  const padded = String(index + 1).padStart(3, '0');
  return `${FRAME_BASE_URL}/ezgif-frame-${padded}.png`;
};

const splitText = (text: string) => {
  const words = text.split(' ');
  return words.map((word, wordIndex) => [
    <span key={`${word}-${wordIndex}`} className="word inline-block whitespace-nowrap">
      {word.split('').map((char, charIndex) => (
        <span key={`${char}-${charIndex}`} className="letter inline-block">
          {char}
        </span>
      ))}
    </span>,
    wordIndex < words.length - 1 ? ' ' : ''
  ]);
};

const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
  e.preventDefault();
  if (targetId === 'home') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  const target = document.getElementById(targetId);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth' });
    return;
  }
  // Element not yet in DOM (lazy-loaded) — scroll past the hero to trigger the
  // IntersectionObserver, then wait for the element to mount before scrolling to it.
  const heroContainer = document.getElementById('home');
  const scrollTarget = heroContainer
    ? heroContainer.offsetTop + heroContainer.offsetHeight
    : window.innerHeight * 3;
  window.scrollTo({ top: scrollTarget, behavior: 'smooth' });
  const poll = setInterval(() => {
    const el = document.getElementById(targetId);
    if (el) {
      clearInterval(poll);
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }, 100);
  setTimeout(() => clearInterval(poll), 3000);
};

const AUDIO_URLS = {
  fallingText:       '/assets/audio/falling_text.m4a',
  textThud:          '/assets/audio/text_thud.m4a',
  laserCharging:     '/assets/audio/laser_charging.m4a',
  laserFiringStart:  '/assets/audio/laser_firing_start.m4a',
  laserFiring:       '/assets/audio/laser_firing.m4a',
} as const;
type AudioKey = keyof typeof AUDIO_URLS;

// -------------------------------------------------

export default function Hero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLHeadingElement>(null);
  const introRef = useRef<HTMLParagraphElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const destructionCanvasRef = useRef<HTMLCanvasElement>(null);
  const animControllerRef = useRef<AnimationController | null>(null);
  const introTlRef = useRef<gsap.core.Timeline | null>(null);
  const scrollTopArrowRef = useRef<HTMLButtonElement>(null);
  const scrollCTARef = useRef<HTMLDivElement>(null);
  const currentFrameRef = useRef(0);
  const hasLeftStartRef = useRef(false);
  const destructionStartedRef = useRef(false);
  const beamWasHiddenRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const buffersRef = useRef<Partial<Record<AudioKey, AudioBuffer>>>({});
  const laserChargingSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const laserFiringStartSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const laserFiringSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const laserFiringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const laserFiringGainRef  = useRef<GainNode | null>(null);
  const isMutedRef = useRef(true);
  const [isMuted, setIsMuted] = useState(true);

  const playAudio = (key: AudioKey, loop = false, sourceRef?: React.RefObject<AudioBufferSourceNode | null>, onEnded?: () => void, _retry = 0) => {
    if (isMutedRef.current) return;
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const buffer = buffersRef.current[key];
    // Buffer may still be decoding on first load — retry up to 10 times (200ms apart = 2s window)
    if (!buffer) {
      if (_retry < 10) setTimeout(() => playAudio(key, loop, sourceRef, onEnded, _retry + 1), 200);
      return;
    }
    const doPlay = () => {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = loop;
      source.connect(ctx.destination);
      if (onEnded) source.onended = onEnded;
      source.start(0);
      if (sourceRef) sourceRef.current = source;
    };
    // Browsers (Safari, Chrome on tab-switch) can auto-suspend the AudioContext.
    // Resume before playing so the call never silently no-ops.
    if (ctx.state === 'suspended') { ctx.resume().then(doPlay); } else { doPlay(); }
  };

  const stopAudio = (sourceRef: React.RefObject<AudioBufferSourceNode | null>) => {
    try { sourceRef.current?.stop(); } catch {}
    sourceRef.current = null;
  };

  const stopLaserSounds = () => {
    stopAudio(laserChargingSourceRef);
    stopAudio(laserFiringStartSourceRef);
    stopAudio(laserFiringSourceRef);
    if (laserFiringTimerRef.current) {
      clearTimeout(laserFiringTimerRef.current);
      laserFiringTimerRef.current = null;
    }
    // Reset master gain immediately so the next sequence isn't silent
    const ctx = audioCtxRef.current;
    const masterGain = laserFiringGainRef.current;
    if (ctx && masterGain) {
      masterGain.gain.cancelScheduledValues(ctx.currentTime);
      masterGain.gain.setValueAtTime(1, ctx.currentTime);
    }
  };

  // Fade the master laser gain to 0 over `duration` seconds, then hard-stop sources.
  // Charging sound stops immediately (it's a brief build-up, not a sustained tone).
  const fadeLaserSounds = (duration = 0.5) => {
    const ctx = audioCtxRef.current;
    const masterGain = laserFiringGainRef.current;
    stopAudio(laserChargingSourceRef); // stop charging immediately — not a sustained tone
    if (laserFiringTimerRef.current) { // cancel next scheduled loop iteration
      clearTimeout(laserFiringTimerRef.current);
      laserFiringTimerRef.current = null;
    }
    if (!ctx || !masterGain) {
      stopAudio(laserFiringStartSourceRef);
      stopAudio(laserFiringSourceRef);
      return;
    }
    masterGain.gain.cancelScheduledValues(ctx.currentTime);
    masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
    setTimeout(() => {
      stopAudio(laserFiringStartSourceRef);
      stopAudio(laserFiringSourceRef);
      masterGain.gain.cancelScheduledValues(ctx.currentTime);
      masterGain.gain.setValueAtTime(1, ctx.currentTime); // reset for next use
    }, duration * 1000 + 50);
  };

  // Schedule laser_firing_start (quiet fade-in) → laser_firing (crossfade loop).
  // Each loop iteration overlaps with the next so the cycle transition is gradual,
  // matching the same crossfade applied at the intro→loop hand-off.
  const scheduleLaserFiringSequence = () => {
    const ctx = audioCtxRef.current;
    const introBuffer = buffersRef.current['laserFiringStart'];
    const loopBuffer = buffersRef.current['laserFiring'];
    if (!ctx || !introBuffer || !loopBuffer || isMutedRef.current) return;

    const INTRO_OVERLAP    = 0.35; // crossfade duration: intro → first loop
    const LOOP_OVERLAP     = 0.45;  // crossfade duration: loop iteration → next
    const INTRO_START_GAIN = 0.25; // intro begins at this volume
    const FADE_IN_DURATION = 1.5;  // intro ramps to full over this many seconds

    // Recursively schedules each loop iteration with a fade-in/fade-out envelope
    // so consecutive instances crossfade smoothly. Uses laserFiringTimerRef to
    // pre-schedule the next iteration; stopLaserSounds() clears it to stop the cycle.
    const scheduleLoop = (startAt: number) => {
      const endAt  = startAt + loopBuffer.duration;
      const nextAt = endAt - LOOP_OVERLAP; // start next before this one ends

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0.0, startAt);
      gainNode.gain.linearRampToValueAtTime(1.0, startAt + LOOP_OVERLAP); // fade in
      gainNode.gain.setValueAtTime(1.0, nextAt);
      gainNode.gain.linearRampToValueAtTime(0.0, endAt);                  // fade out
      gainNode.connect(laserFiringGainRef.current ?? ctx.destination);

      const source = ctx.createBufferSource();
      source.buffer = loopBuffer;
      source.connect(gainNode);
      source.start(startAt);
      laserFiringSourceRef.current = source;

      // Pre-schedule next iteration slightly before crossfade begins
      const delay = Math.max(0, (nextAt - ctx.currentTime) * 1000 - 100);
      laserFiringTimerRef.current = setTimeout(() => scheduleLoop(nextAt), delay);
    };

    const schedule = () => {
      const startAt      = ctx.currentTime;
      const introEndAt   = startAt + introBuffer.duration;
      const firstLoopAt  = introEndAt - INTRO_OVERLAP;

      // Intro: quiet start → ramp up → fade out into first loop
      const introGain = ctx.createGain();
      introGain.gain.setValueAtTime(INTRO_START_GAIN, startAt);
      introGain.gain.linearRampToValueAtTime(1.0, startAt + FADE_IN_DURATION);
      introGain.gain.setValueAtTime(1.0, firstLoopAt);
      introGain.gain.linearRampToValueAtTime(0.0, introEndAt);
      introGain.connect(laserFiringGainRef.current ?? ctx.destination);

      const introSource = ctx.createBufferSource();
      introSource.buffer = introBuffer;
      introSource.connect(introGain);
      introSource.start(startAt);
      laserFiringStartSourceRef.current = introSource;

      // Pre-schedule first loop iteration so it fades in as intro fades out
      const delay = Math.max(0, (firstLoopAt - ctx.currentTime) * 1000 - 100);
      laserFiringTimerRef.current = setTimeout(() => scheduleLoop(firstLoopAt), delay);
    };

    if (ctx.state === 'suspended') { ctx.resume().then(schedule); } else { schedule(); }
  };

  const toggleSound = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    isMutedRef.current = newMuted;
    localStorage.setItem('portfolio-sound-muted', String(newMuted));
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    if (!newMuted) {
      // resume() is called inside a user-gesture stack — this is how AudioContext gets unlocked
      ctx.resume().then(() => {
        if (animControllerRef.current?.isFiring) {
          playAudio('laserFiring', true, laserFiringSourceRef);
        }
      });
    } else {
      stopLaserSounds();
      ctx.suspend();
    }
  };

  // Lazily create AudioContext + load buffers on first user interaction (or immediately
  // if the user previously had sound enabled). This avoids the "AudioContext was not
  // allowed to start" browser warning and keeps it off the critical-path load.
  const initAudio = () => {
    if (audioCtxRef.current) return; // already initialised
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    laserFiringGainRef.current = masterGain;

    (Object.entries(AUDIO_URLS) as [AudioKey, string][]).forEach(([key, url]) => {
      fetch(url)
        .then(r => r.arrayBuffer())
        .then(data => ctx.decodeAudioData(data))
        .then(buffer => { buffersRef.current[key] = buffer; })
        .catch(e => console.error(`Failed to load audio [${key}]:`, e));
    });
  };

  useEffect(() => {
    const stored = localStorage.getItem('portfolio-sound-muted');
    if (stored === 'false') {
      setIsMuted(false);
      isMutedRef.current = false;
      // User previously enabled sound — init eagerly so buffers are ready
      initAudio();
      audioCtxRef.current?.resume().catch(() => {});
    }

    // For new visitors (muted by default), defer init until first gesture
    const UNLOCK_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    const onFirstGesture = () => {
      initAudio();
      UNLOCK_EVENTS.forEach(e => document.removeEventListener(e, onFirstGesture));
    };
    UNLOCK_EVENTS.forEach(e => document.addEventListener(e, onFirstGesture, { passive: true }));

    return () => {
      UNLOCK_EVENTS.forEach(e => document.removeEventListener(e, onFirstGesture));
      audioCtxRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);
    ScrollTrigger.clearScrollMemory("manual");
  }, []);

  // When About section starts: fade audio, pause animation controller, cancel timers
  useEffect(() => {
    const handler = () => {
      fadeLaserSounds(1.0);
      animControllerRef.current?.pause();
      if (laserFiringTimerRef.current) {
        clearTimeout(laserFiringTimerRef.current);
        laserFiringTimerRef.current = null;
      }
    };
    window.addEventListener('about-section-enter', handler);
    return () => window.removeEventListener('about-section-enter', handler);
  }, []);

  useEffect(() => {
    {
      // Preload frames: first 30 eagerly, the rest during idle time
      const preloadFrame = (i: number) => {
        const img = new Image();
        img.decoding = 'async';
        img.src = frameFileName(i);
      };
      for (let i = 0; i < Math.min(30, TOTAL_FRAMES); i++) {
        preloadFrame(i);
      }
      const requestIdle: (cb: () => void) => void =
        typeof window !== 'undefined' && 'requestIdleCallback' in window
          ? (cb) => window.requestIdleCallback(cb)
          : (cb) => setTimeout(cb, 200);
      requestIdle(() => {
        for (let i = 30; i < TOTAL_FRAMES; i++) preloadFrame(i);
      });

      gsap.set([nameRef.current, introRef.current], { opacity: 1 });
      gsap.set(imageRef.current, { opacity: 1 });

      const imageFadeInTl = gsap.timeline();
      const textAnimTl = gsap.timeline();
      introTlRef.current = textAnimTl;

      if (imageRef.current) {
        imageRef.current.src = frameFileName(0);
      }

      // Image fade in
      imageFadeInTl.fromTo(imageRef.current,
        { opacity: 0, filter: 'brightness(0%)' },
        { opacity: 1, filter: 'brightness(100%)', duration: 1.2 },
        0
      );

      // Text falling down from above the screen
      textAnimTl.fromTo([nameRef.current, introRef.current],
        { y: "-100vh", opacity: 1, scaleY: 1 },
        {
          y: 0,
          duration: 0.6,
          ease: "power4.in",
          stagger: 0.1,
          onStart: () => { playAudio('fallingText'); },
        },
        0
      );

      // The Thud (Heavy squash/shake effect)
      textAnimTl.to([nameRef.current, introRef.current], {
        y: 15,
        scaleY: 0.9,
        duration: 0.1,
        yoyo: true,
        repeat: 1,
        ease: "power2.out",
        stagger: 0.1,
        onComplete: () => {
          animControllerRef.current?.triggerLandingDust();
          playAudio('textThud');
        }
      }, 0.6); // Start precisely when the fall finishes

      // Create a single scroll-bound timeline to sequence the image animation and wind effect
      const scrollTl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: 1,
          onLeave: () => {
            gsap.to(scrollCTARef.current, { autoAlpha: 0, duration: 0.4 });
            fadeLaserSounds();
          },
          onEnterBack: () => {
            // This is ONLY called when scrolling UP and returning to the start.
            if (animControllerRef.current) {
              animControllerRef.current.reset();
              destructionStartedRef.current = false;
              introTlRef.current?.restart();
            }
          },
        }
      });

      const frameObj = { frame: 0 };

      // 1. Play the image sequence first
      scrollTl.to(frameObj, {
        frame: TOTAL_FRAMES - 1,
        snap: "frame",
        ease: "none",
        duration: 2, // Relative duration in timeline
        onUpdate: () => {
          const frameIndex = Math.round(frameObj.frame);
          if (frameIndex > 0) {
            hasLeftStartRef.current = true;
          }

          if (imageRef.current && frameIndex !== currentFrameRef.current) {
            currentFrameRef.current = frameIndex;
            imageRef.current.src = frameFileName(frameIndex);
          }

          if (frameIndex >= TOTAL_FRAMES - 1) {
            if (animControllerRef.current && imageRef.current && destructionCanvasRef.current) {
              animControllerRef.current.showBeam();
              // Returning after a scroll-away — showBeam() already restarted the visual
              // charge-up; here we restart the matching audio sequence.
              if (beamWasHiddenRef.current) {
                beamWasHiddenRef.current = false;
                stopLaserSounds();
                playAudio('laserCharging', false, laserChargingSourceRef);
                laserFiringTimerRef.current = setTimeout(() => {
                  stopAudio(laserChargingSourceRef);
                  scheduleLaserFiringSequence();
                }, 650);
              }
              if (!destructionStartedRef.current) {
                destructionStartedRef.current = true;
                const img = imageRef.current;
                const rect = img.getBoundingClientRect();
                const canvasRect = destructionCanvasRef.current.getBoundingClientRect();
                const natW = img.naturalWidth || 500;
                const natH = img.naturalHeight || 500;
                const scaleX = rect.width / natW;
                const scaleY = rect.height / natH;
                const eyeX = (rect.left - canvasRect.left) + (162 * scaleX) - 29;
                const eyeY = (rect.top - canvasRect.top) + (241 * scaleY);
                animControllerRef.current.fireLaser({ x: eyeX, y: eyeY }, scaleX);
                // Play charging sound immediately; fire the looping laser sound after
                // the twinkle (~1s) + charge (~0.2s) phases complete
                playAudio('laserCharging', false, laserChargingSourceRef);
                laserFiringTimerRef.current = setTimeout(() => {
                  stopAudio(laserChargingSourceRef);
                  scheduleLaserFiringSequence();
                }, 650);
                // Independently fade in the arrow and CTA when the laser fires
                gsap.to(scrollTopArrowRef.current, { autoAlpha: 1, duration: 0.5 });
                gsap.to(scrollCTARef.current, { autoAlpha: 1, duration: 0.8, delay: 0.3 });
              }
            }
          } else if (frameIndex > 0) {
            if (animControllerRef.current) {
              animControllerRef.current.hideBeam();
            }
            if (destructionStartedRef.current) beamWasHiddenRef.current = true;
            fadeLaserSounds();
          } else if (frameIndex === 0 && hasLeftStartRef.current) {
            // This is the most reliable way to check for returning to the start of the animation.
            hasLeftStartRef.current = false; // Reset the flag to prevent re-triggering.
            // Fade out the arrow and CTA when returning all the way to the top
            gsap.to(scrollTopArrowRef.current, { autoAlpha: 0, duration: 0.5 });
            gsap.to(scrollCTARef.current, { autoAlpha: 0, duration: 0.5 });
            if (animControllerRef.current) {
              if (animControllerRef.current.isTextDestroyed) {
                animControllerRef.current.reset();
                destructionStartedRef.current = false;
                beamWasHiddenRef.current = false;
                introTlRef.current?.restart();
              }
            }
          }
        }
      });

      // 2. Add extra scrolling space to watch the laser animation while the section remains pinned
      scrollTl.to({}, { duration: 3 });

      ScrollTrigger.refresh();
    }

    return () => {
      ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    };
  }, []);

  // Effect for Text Destruction Canvas
  useEffect(() => {
    const mainCanvas = destructionCanvasRef.current;
    const nameEl = nameRef.current;
    const introEl = introRef.current;
    const stickyContainer = stickyRef.current;

    if (!mainCanvas || !nameEl || !introEl || !stickyContainer) return;

    // 1. Create an offscreen canvas for rasterizing text
    const textCanvas = document.createElement('canvas');
    textCanvas.width = stickyContainer.clientWidth;
    textCanvas.height = stickyContainer.clientHeight;
    const ctx = textCanvas.getContext('2d');

    if (!ctx) return;

    // 1.5 Set explicit dimensions for the main canvas so it matches the container
    mainCanvas.width = stickyContainer.clientWidth;
    mainCanvas.height = stickyContainer.clientHeight;

    // GSAP applies the falling entrance animation (y: "-100vh") immediately on mount.
    // We must temporarily strip these transforms to accurately measure the text's final resting position!
    const resetTransform = (el: HTMLElement) => {
      const prev = el.style.transform;
      el.style.transform = 'none';
      return () => { el.style.transform = prev; };
    };
    const restoreName = resetTransform(nameEl);
    const restoreIntro = resetTransform(introEl);

    // 2. Function to draw an element to the offscreen canvas
    const drawTextElement = (el: HTMLElement, color: string) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const containerRect = stickyContainer.getBoundingClientRect();

      ctx.fillStyle = color;
      ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';

      if ('letterSpacing' in ctx) {
        (ctx as any).letterSpacing = style.letterSpacing !== 'normal' ? style.letterSpacing : '0px';
      }

      // Calculate position relative to the exact center of the DOM element's bounding box
      const x = rect.left - containerRect.left + rect.width / 2;
      const y = rect.top - containerRect.top + rect.height / 2;

      // Use textContent to prevent span elements from injecting newlines which break fillText
      ctx.fillText((el.textContent || '').trim(), x, y);
    };

    // 3. Rasterize the text elements
    drawTextElement(nameEl, 'white');
    introEl.querySelectorAll('span.block').forEach(span => {
      drawTextElement(span as HTMLElement, window.getComputedStyle(span).color);
    });

    // 4. Instantiate the central Animation Controller, passing all individual lines for precise dust spawning
    const textLines = [nameEl, ...Array.from(introEl.querySelectorAll('span.block'))] as HTMLElement[];
    animControllerRef.current = new AnimationController(mainCanvas, textCanvas, textLines);

    // Restore transforms so the GSAP entrance animation plays perfectly
    restoreName();
    restoreIntro();

    return () => {
      animControllerRef.current?.cleanup();
    };
  }, []);

  return (
    <div id="home" ref={containerRef} className="relative h-[300vh] bg-black">
      {/* Background atmosphere: radial glow behind character + grain overlay */}
      <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 70% at 70% 50%, rgba(220,38,38,0.06) 0%, transparent 70%)' }} />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")', backgroundRepeat: 'repeat', backgroundSize: '256px 256px' }} />
      </div>
      {/* Persistent Navigation Bar */}
      <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex gap-4 md:gap-8 px-6 md:px-8 py-3 bg-white/5 backdrop-blur-md rounded-full border border-white/10">
        <a href="#home" onClick={(e) => handleNavClick(e, 'home')} className="nav-link text-white transition-colors text-xs md:text-sm font-medium tracking-wider uppercase">Home</a>
        <a href="#about" onClick={(e) => handleNavClick(e, 'about')} className="nav-link text-white transition-colors text-xs md:text-sm font-medium tracking-wider uppercase">About</a>
      </nav>

      {/* Sticky content container */}
      <div
        ref={stickyRef}
        className="sticky top-0 h-screen flex items-center justify-center"
        style={{ transform: 'translateZ(0)' }}
      >
        {/* Canvas for the new text destruction effect */}
        <canvas
          ref={destructionCanvasRef}
          aria-hidden="true"
          className="absolute inset-0 w-full h-full pointer-events-none z-20"
        />
        {/* Text content - left side */}
        <div className="flex-1 text-center mr-8 relative z-10">
          <h1
            ref={nameRef}
            className="text-8xl md:text-[10rem] lg:text-[12rem] leading-none text-white font-cursive relative z-0 [text-shadow:8px_8px_15px_rgba(0,0,0,0.8)]"
          >
            {splitText("Ronald Hoang")}
          </h1>
          <p
            ref={introRef}
            className="text-lg md:text-xl text-gray-300 max-w-3xl mx-auto leading-tight font-sans text-balance -mt-4 relative z-10 [text-shadow:4px_4px_10px_rgba(0,0,0,0.8)]"
          >
            <span className="block mb-1">{splitText("Software Engineer | Building AI-Native Systems")}</span>
            <span className="block mb-1">{splitText("Multi-Agent Pipelines | Backend Infrastructure")}</span>

            <span className="block text-base md:text-lg text-gray-400 font-medium tracking-widest mt-2">
              {splitText("AWS · GCP · C++ · Python")}
            </span>
          </p>
        </div>

        {/* Image sequence - right side */}
        <div className="flex-1 flex justify-center">
          <div className="relative">
            <img
              ref={imageRef}
              src={frameFileName(0)}
              alt="Cyborg character animation"
              width={600}
              height={500}
              fetchPriority="high"
              className="w-[500px] h-[500px] md:w-[600px] md:h-[600px] object-cover"
              style={{ maskImage: 'linear-gradient(to top, transparent 0%, black 25%), linear-gradient(to right, transparent 0%, black 35%, black 65%, transparent 100%)', maskComposite: 'intersect' }}
            />
          </div>
        </div>
      </div>

      {/* Scroll to see my work CTA */}
      <div
        ref={scrollCTARef}
        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none invisible opacity-0"
      >
        <span className="heartbeat-glow text-red-500 text-sm font-sans font-medium tracking-[0.2em] uppercase">
          Scroll to see my work
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="heartbeat-glow h-5 w-5 text-red-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Bottom-right controls: scroll-to-top + sound toggle in a shared row */}
      <div className="fixed bottom-8 right-8 z-50 flex items-center gap-3">
        <button
          ref={scrollTopArrowRef}
          className="cursor-pointer invisible opacity-0 text-white hover:text-gray-300 transition-colors bg-transparent border-0 p-0"
          tabIndex={-1}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Scroll to top"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button
          onClick={toggleSound}
          className="cursor-pointer text-white hover:text-gray-300 transition-colors"
          title={isMuted ? 'Unmute' : 'Mute'}
          aria-label={isMuted ? 'Unmute sound' : 'Mute sound'}
        >
          {isMuted ? (
            /* Speaker off — body + X */
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707A1 1 0 0112 5v14a1 1 0 01-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          ) : (
            /* Speaker on — body + wave arc */
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707A1 1 0 0112 5v14a1 1 0 01-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072" />
            </svg>
          )}
        </button>
      </div>

    </div>
  );
}
