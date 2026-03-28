'use client';
import { useRef, useEffect, useState, Fragment } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const CLIP = 'polygon(24px 0%, calc(100% - 24px) 0%, 100% 24px, 100% calc(100% - 24px), calc(100% - 24px) 100%, 24px 100%, 0% calc(100% - 24px), 0% 24px)';

const CORNER_BRACKETS = [
  { cls: 'top-0 left-0',    rot: 'rotate-0'   },
  { cls: 'top-0 right-0',   rot: 'rotate-90'  },
  { cls: 'bottom-0 right-0',rot: 'rotate-180' },
  { cls: 'bottom-0 left-0', rot: '-rotate-90' },
];

const FIELDS = [
  { label: 'DESIGNATION', value: 'Ronald Hoang',                  color: 'text-white/95'    },
  { label: 'ROLE',        value: 'Software & Solutions Engineer',  color: 'text-white/95'    },
  { label: 'LOCATION',    value: 'San Francisco Bay Area',         color: 'text-white/95'    },
  { label: 'CLEARANCE',   value: '[REDACTED]',                     color: 'text-red-300/90'  },
  { label: 'STATUS',      value: '● ACTIVE',                       color: 'text-green-400'   },
];

interface SparkParticle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; speed: number;
  size: number;
}

const VIDEO_SRC      = '/assets/Page2_background.mp4';
const PLAYBACK_RATE  = 0.75;
const CROSSFADE_SEC  = 0.35; // video-time seconds before end to begin crossfade (~0.5s real-time)

export default function About() {
  const videoARef      = useRef<HTMLVideoElement>(null);
  const videoBRef      = useRef<HTMLVideoElement>(null);
  const activeVideo    = useRef<'a' | 'b'>('a');
  const xfading        = useRef(false);
  const sectionRef     = useRef<HTMLElement>(null);
  const flashRef       = useRef<HTMLDivElement>(null);
  const hologramRef    = useRef<HTMLDivElement>(null);
  const contentRef     = useRef<HTMLDivElement>(null);
  const cyborgCanvasRef  = useRef<HTMLCanvasElement>(null);
  const scannerCanvasRef = useRef<HTMLCanvasElement>(null);
  const scanProgressRef  = useRef({ value: 0 });
  const scanAnimatingRef = useRef(false);
  const sparkParticlesRef = useRef<SparkParticle[]>([]);
  const startScanRevealRef = useRef<() => void>(() => {});
  const rafPausedRef     = useRef(false);
  const rafIdRef         = useRef<number>(0);
  const smoothTopRef     = useRef<[number,number,number]>([128, 128, 128]);
  const smoothBotRef     = useRef<[number,number,number]>([128, 128, 128]);
  const jumpSmoothingRef = useRef(false);
  const dnaBlurRef       = useRef<HTMLDivElement>(null);
  const dnaStripsRef     = useRef<(HTMLDivElement | null)[]>([]);

  // Pause videos + RAF when section leaves viewport, resume when it returns
  useEffect(() => {
    const section = sectionRef.current;
    const vA = videoARef.current;
    const vB = videoBRef.current;
    if (!section || !vA || !vB) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          rafPausedRef.current = false;
          vA.play().catch(() => {});
          vB.play().catch(() => {});
        } else {
          rafPausedRef.current = true;
          vA.pause();
          vB.pause();
          cancelAnimationFrame(rafIdRef.current);
        }
      },
      { rootMargin: '100px' },
    );
    obs.observe(section);
    return () => obs.disconnect();
  }, []);

  // Typing state — empty strings until the sequence starts
  const [typed, setTyped]             = useState<string[]>(FIELDS.map(() => ''));
  const [activeField, setActiveField] = useState<number>(-1);
  const [cursorOn, setCursorOn]       = useState(true);

  // Chroma-key + dynamic lighting from background video
  useEffect(() => {
    const canvas = cyborgCanvasRef.current;
    const vA     = videoARef.current;
    const vB     = videoBRef.current;
    if (!canvas || !vA || !vB) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Offscreen canvas holds the chroma-keyed image (computed once)
    const keyed  = document.createElement('canvas');
    const kCtx   = keyed.getContext('2d')!;

    // Tiny sampler canvas — read pixels from the video cheaply each frame
    const sampler = document.createElement('canvas');
    sampler.width = sampler.height = 16;
    const sCtx = sampler.getContext('2d', { willReadFrequently: true })!;


    const img = new Image();
    img.src = '/assets/Cyborg+scanner/posing_body.jpg';
    img.onload = () => {
      keyed.width  = canvas.width  = img.naturalWidth;
      keyed.height = canvas.height = img.naturalHeight;

      kCtx.drawImage(img, 0, 0);
      const id = kCtx.getImageData(0, 0, keyed.width, keyed.height);
      const d  = id.data;

      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        if (g > 60 && g - r > 15 && g - b > 15) {
          const gn   = Math.min(1, (g - Math.max(r, b)) / 40);
          d[i + 3]   = Math.round((1 - gn) * 255);
          d[i]       = Math.round(r * (1 - gn) + 255 * gn);
          d[i + 1]   = Math.round(g * (1 - gn) + 180 * gn);
          d[i + 2]   = Math.round(b * (1 - gn) + 180 * gn);
        } else if (g > r && g > b) {
          d[i + 1] = Math.round((r + b) / 2);
        }
      }
      kCtx.putImageData(id, 0, 0);

      const tick = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(keyed, 0, 0);

        const vidA = vA;
        const vidB = vB;
        const primaryVid = activeVideo.current === 'a' ? vidA : vidB;
        const standbyVid = activeVideo.current === 'a' ? vidB : vidA;
        if (primaryVid.readyState >= 2 && primaryVid.videoWidth > 0) {

          // Read the standby video's current CSS opacity to blend samples during crossfade
          const standbyOpacity = parseFloat(standbyVid.style.opacity || '0');
          const primaryWeight  = 1 - standbyOpacity;

          const sampleRegion = (vid: HTMLVideoElement, sx: number, sy: number, sw: number, sh: number) => {
            if (vid.readyState < 2 || vid.videoWidth === 0) return null;
            sCtx.filter = 'saturate(1.3) contrast(1.1)';
            sCtx.drawImage(vid, vid.videoWidth * sx, vid.videoHeight * sy,
              vid.videoWidth * sw, vid.videoHeight * sh, 0, 0, 16, 16);
            sCtx.filter = 'none';
            return sCtx.getImageData(0, 0, 16, 16).data;
          };

          // Sample top and bottom from both videos, blend by crossfade weight
          const blendSamples = (
            sdP: Uint8ClampedArray | null,
            sdS: Uint8ClampedArray | null,
          ): [number, number, number] => {
            const n = 16 * 16;
            let r = 0, g = 0, b = 0;
            if (sdP) for (let i = 0; i < sdP.length; i += 4) {
              r += sdP[i] * primaryWeight; g += sdP[i+1] * primaryWeight; b += sdP[i+2] * primaryWeight;
            }
            if (sdS && standbyOpacity > 0) for (let i = 0; i < sdS.length; i += 4) {
              r += sdS[i] * standbyOpacity; g += sdS[i+1] * standbyOpacity; b += sdS[i+2] * standbyOpacity;
            }
            return [r / n, g / n, b / n];
          };

          // Sample tightly around the cyborg's local position in the video
          // Cyborg sits at ~80% horizontal, spanning ~20–65% vertical
          // Top: just above the cyborg's head
          const sdTopP = sampleRegion(primaryVid, 0.72, 0.18, 0.14, 0.12);
          const sdTopS = standbyOpacity > 0 ? sampleRegion(standbyVid, 0.72, 0.18, 0.14, 0.12) : null;
          // Bottom: platform glow directly under the cyborg's feet
          const sdBotP = sampleRegion(primaryVid, 0.72, 0.58, 0.14, 0.10);
          const sdBotS = standbyOpacity > 0 ? sampleRegion(standbyVid, 0.72, 0.58, 0.14, 0.10) : null;

          const rawTop = blendSamples(sdTopP, sdTopS);
          const rawBot = blendSamples(sdBotP, sdBotS);

          // Low-pass filter — lerp % toward new sample each frame (~60fps → ~230ms to
          // track a sustained change, but rapid flickers get averaged away)
          const LERP = 0.15;
          const s = smoothTopRef.current;
          const sb = smoothBotRef.current;
          s[0]  += (rawTop[0] - s[0])  * LERP;
          s[1]  += (rawTop[1] - s[1])  * LERP;
          s[2]  += (rawTop[2] - s[2])  * LERP;
          sb[0] += (rawBot[0] - sb[0]) * LERP;
          sb[1] += (rawBot[1] - sb[1]) * LERP;
          sb[2] += (rawBot[2] - sb[2]) * LERP;

          const topAvg: [number,number,number] = [s[0],  s[1],  s[2]];
          const botAvg: [number,number,number] = [sb[0], sb[1], sb[2]];

          const applyLayers = (r: number, g: number, b: number, peakTarget: number) => {
            r = r * 0.45; g = g * 0.45; b = b * 0.45;
            r = Math.min(255, r + 140 * 0.08 * (1 - r / 255));
            g = Math.min(255, g + 10  * 0.08 * (1 - g / 255));
            b = Math.min(255, b + 10  * 0.08 * (1 - b / 255));
            const peak  = Math.max(r, g, b, 1);
            const nr = Math.min(255, (r / peak) * peakTarget);
            const ng = Math.min(255, (g / peak) * peakTarget);
            const nb = Math.min(255, (b / peak) * peakTarget);
            const blend = 0.55;
            const grey  = (nr + ng + nb) / 3;
            return [
              Math.round(nr * (1 - blend) + grey * blend),
              Math.round(ng * (1 - blend) + grey * blend),
              Math.round(nb * (1 - blend) + grey * blend),
            ];
          };

          // Top is brighter (higher peak = closer to white = less darkening via multiply)
          const [topR, topG, topB] = applyLayers(...topAvg, 188);
          const [botR, botG, botB] = applyLayers(...botAvg, 160);

          // Vertical gradient tint — top lighting fades to bottom lighting
          const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
          grad.addColorStop(0,   `rgb(${topR},${topG},${topB})`);
          grad.addColorStop(1,   `rgb(${botR},${botG},${botB})`);

          ctx.globalCompositeOperation = 'multiply';
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Screen pass — lifts the cyborg's highlights to match the top light source
          // Screen formula: out = 1-(1-a)(1-b), so bright pixels get boosted toward
          // the top ambient color while dark pixels are barely affected
          ctx.globalCompositeOperation = 'screen';
          ctx.fillStyle = `rgba(${topR},${topG},${topB},0.30)`;
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Re-apply the alpha mask so keyed-out pixels stay transparent
          ctx.globalCompositeOperation = 'destination-in';
          ctx.drawImage(keyed, 0, 0);

          ctx.globalCompositeOperation = 'source-over';
        }

        if (!rafPausedRef.current) {
          rafIdRef.current = requestAnimationFrame(tick);
        }
      };
      tick();
    };

    return () => cancelAnimationFrame(rafIdRef.current);
  }, []);

  // Scanner overlay + spark particles
  useEffect(() => {
    const canvas = scannerCanvasRef.current;
    const cyborgCanvas = cyborgCanvasRef.current;
    if (!canvas || !cyborgCanvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    const particles = sparkParticlesRef.current;

    // Per-column alpha mask of the keyed cyborg, for coverage-based spark emission.
    // coverageW × coverageH stores each pixel's alpha (0–255) after chroma-keying.
    let coverageData: Uint8Array | null = null;
    let coverageW = 0;
    let coverageH = 0;

    // Load the cyborg image to build per-pixel coverage mask
    const coverageImg = new Image();
    coverageImg.src = '/assets/Cyborg+scanner/posing_body.jpg';
    coverageImg.onload = () => {
      const tmp = document.createElement('canvas');
      tmp.width  = coverageImg.naturalWidth;
      tmp.height = coverageImg.naturalHeight;
      const tCtx = tmp.getContext('2d', { willReadFrequently: true })!;
      tCtx.drawImage(coverageImg, 0, 0);
      const id = tCtx.getImageData(0, 0, tmp.width, tmp.height);
      const d  = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        if (g > 60 && g - r > 15 && g - b > 15) {
          const gn = Math.min(1, (g - Math.max(r, b)) / 40);
          d[i + 3] = Math.round((1 - gn) * 255);
        }
      }
      // Store only alpha channel
      coverageW = tmp.width;
      coverageH = tmp.height;
      coverageData = new Uint8Array(coverageW * coverageH);
      for (let i = 0; i < d.length; i += 4) coverageData[i >> 2] = d[i + 3];
    };

    const tick = () => {
      animId = requestAnimationFrame(tick);
      if (rafPausedRef.current) return;

      const cw = cyborgCanvas.width;
      const ch = cyborgCanvas.height;
      if (!cw || !ch) return;
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width  = cw;
        canvas.height = ch;
      }

      const progress  = scanProgressRef.current.value; // 0 = covered, 1 = revealed
      const borderY   = ch * (1 - progress);           // bottom edge of scanner

      // Clip the cyborg canvas so it is only visible below the scan line.
      // Both the cyborg and the scanner are invisible above it — background shows through.
      const cssH = cyborgCanvas.clientHeight;
      if (cssH > 0) {
        const borderYCss = borderY * (cssH / ch);
        cyborgCanvas.style.clipPath = progress >= 1
          ? ''
          : `inset(${borderYCss.toFixed(1)}px 0 0 0)`;
      }

      ctx.clearRect(0, 0, cw, ch);

      // Only draw the laser edge and sparks while the reveal is actively animating
      if (!scanAnimatingRef.current || progress <= 0 || progress >= 1) {
        // Still need to update + draw any lingering particles after animation ends
        drawParticles(ctx);
        return;
      }

      // Emit sparks and draw laser only where the cyborg body has coverage at this scan row
      if (coverageData && coverageW && coverageH) {
        const imgY = Math.min(coverageH - 1, Math.floor((borderY / ch) * coverageH));
        const rowBase = imgY * coverageW;

        // Find leftmost and rightmost covered pixel in this row
        let leftIx = -1, rightIx = -1;
        for (let ix = 0; ix < coverageW; ix++) {
          if (coverageData[rowBase + ix] > 40) { leftIx = ix; break; }
        }
        for (let ix = coverageW - 1; ix >= 0; ix--) {
          if (coverageData[rowBase + ix] > 40) { rightIx = ix; break; }
        }

        if (leftIx !== -1 && rightIx !== -1) {
          const x0 = (leftIx  / coverageW) * cw;
          const x1 = (rightIx / coverageW) * cw;
          const grd = ctx.createLinearGradient(x0, 0, x1, 0);
          grd.addColorStop(0,   'transparent');
          grd.addColorStop(0.08, 'rgba(255,55,0,0.85)');
          grd.addColorStop(0.5,  'rgba(255,215,170,1.0)');
          grd.addColorStop(0.92, 'rgba(255,55,0,0.85)');
          grd.addColorStop(1,   'transparent');
          ctx.save();
          ctx.shadowColor = 'rgba(255,80,0,1)';
          ctx.shadowBlur  = 14;
          ctx.strokeStyle = grd;
          ctx.lineWidth   = 3;
          ctx.beginPath();
          ctx.moveTo(x0, borderY);
          ctx.lineTo(x1, borderY);
          ctx.stroke();
          ctx.shadowBlur  = 5;
          ctx.strokeStyle = 'rgba(255,235,210,0.95)';
          ctx.lineWidth   = 1;
          ctx.beginPath();
          ctx.moveTo(x0, borderY);
          ctx.lineTo(x1, borderY);
          ctx.stroke();
          ctx.restore();
        }

        // Walk every 4 coverage pixels, high spawn chance for dense sparks
        for (let ix = 0; ix < coverageW; ix += 4) {
          if (coverageData[rowBase + ix] > 40 && Math.random() < 0.55) {
            const x = (ix / coverageW) * cw;
            particles.push({
              x,
              y:     borderY + (Math.random() - 0.5) * 4,
              vx:    (Math.random() - 0.5) * 7,
              vy:    -(Math.random() * 2.0 + 0.5),
              life:  1.0,
              speed: 1.6 + Math.random() * 1.2,
              size:  0.5 + Math.random() * 1.5,
            });
          }
        }
      }

      drawParticles(ctx);
    };

    function drawParticles(ctx: CanvasRenderingContext2D) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x  += p.vx;
        p.y  += p.vy;
        p.vy += 0.18;
        p.life -= p.speed / 60;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        const alpha = Math.min(1, p.life * 2);
        const pg    = Math.round(p.life > 0.5 ? 255 * (p.life - 0.5) * 2 : 0);
        ctx.save();
        ctx.shadowColor = `rgba(255,${pg},0,${alpha * 0.8})`;
        ctx.shadowBlur  = p.size * 4;
        ctx.fillStyle   = `rgba(255,${pg},0,${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    animId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animId);
      coverageImg.onload = null;
      if (cyborgCanvas) cyborgCanvas.style.clipPath = '';
    };
  }, []);

  // Blinking cursor via interval
  useEffect(() => {
    const id = setInterval(() => setCursorOn(v => !v), 530);
    return () => clearInterval(id);
  }, []);

  // Exposed so the GSAP timeline can call it via ref after the hologram opens
  const startTypingRef = useRef<() => void>(() => {});

  useEffect(() => {
    startTypingRef.current = () => {
      let fi = 0; // field index
      let ci = 0; // char index

      setTyped(FIELDS.map(() => ''));
      setActiveField(0);

      const tick = () => {
        const field = FIELDS[fi];
        if (!field) {
          // All fields done — hide cursor after a short hold
          setTimeout(() => setActiveField(-1), 900);
          return;
        }

        if (ci < field.value.length) {
          ci++;
          const snapshot = fi; // capture for closure
          setTyped(prev => {
            const next = [...prev];
            next[snapshot] = field.value.slice(0, ci);
            return next;
          });
          setTimeout(tick, 0);
        } else {
          // Field complete — brief pause, then advance
          fi++;
          ci = 0;
          setActiveField(fi < FIELDS.length ? fi : -1);
          setTimeout(tick, fi < FIELDS.length ? 40 : 0);
        }
      };

      tick();
    };
  }, []);

  // Arms the scan-reveal; called after ACCESS GRANTED finishes
  useEffect(() => {
    startScanRevealRef.current = () => {
      sparkParticlesRef.current.length = 0;
      scanProgressRef.current.value    = 0;
      scanAnimatingRef.current         = true;
      gsap.killTweensOf(scanProgressRef.current);
      gsap.to(scanProgressRef.current, {
        value:    1,
        duration: 4,
        ease:     'power1.inOut',
        delay:    0.2,
        onComplete: () => { scanAnimatingRef.current = false; },
      });
    };
  }, []);

  useEffect(() => {
    const vA = videoARef.current;
    const vB = videoBRef.current;
    if (!vA || !vB) return;

    vA.playbackRate = PLAYBACK_RATE;
    vB.playbackRate = PLAYBACK_RATE;
    vB.style.opacity = '0';

    const JUMP_WIN = 0.18; // ±seconds window around the jump

    // Reusable DNA glitch: row-shift jitter for durationMs milliseconds then fades out.
    // delay (seconds) defers the start; onComplete fires after fade-out.
    const triggerDnaGlitch = (delay = 0, durationMs = 390, onComplete?: () => void) => {
      const blurEl = dnaBlurRef.current;
      const strips = dnaStripsRef.current.filter((s): s is HTMLDivElement => s !== null);
      if (!blurEl || strips.length === 0) { onComplete?.(); return; }
      // Quantise to 8 px grid — snappy digital feel instead of smooth drift
      const rndX = () => Math.round((Math.random() - 0.5) * 80 / 8) * 8;
      // Each chunk gets a random blur level: 0 = sharp hard cut (most digital),
      // small = slight corruption, larger = smeared block
      const rndFilter = () => {
        const r = Math.random();
        if (r < 0.40) return 'blur(0px) brightness(1.3)';
        if (r < 0.70) return 'blur(1px) brightness(1.15)';
        return 'blur(3px) brightness(1.05)';
      };
      const chunkedOffsets = () => {
        const out: { x: number; filter: string }[] = [];
        let i = 0;
        while (i < strips.length) {
          const size = 1 + Math.floor(Math.random() * 3);
          const x = rndX();
          const filter = rndFilter();
          for (let j = 0; j < size && i < strips.length; j++, i++) out.push({ x, filter });
        }
        return out;
      };
      // Generate enough frames to fill durationMs
      const frames: number[] = [];
      let total = 0;
      const targetSecs = durationMs / 1000;
      while (total < targetSecs) {
        const dur = 0.03 + Math.random() * 0.04; // 30–70 ms per frame
        frames.push(Math.min(dur, targetSecs - total));
        total += dur;
      }
      let t = 0;
      const tl = gsap.timeline({ delay, onComplete });
      tl.set(blurEl, { opacity: 1 });
      frames.forEach(dur => {
        const chunks = chunkedOffsets();
        strips.forEach((strip, i) => tl.set(strip, { x: chunks[i].x, backdropFilter: chunks[i].filter }, t));
        t += dur;
      });
      strips.forEach(strip => tl.set(strip, { x: 0, backdropFilter: 'blur(2px) brightness(1.15)' }, t));
      tl.to(blurEl, { opacity: 0, duration: 0.18, delay: 0.06, ease: 'power2.in' }, t);
    };

    const handleTimeUpdate = () => {
      // Compute dynamically so it works regardless of video duration
      const JUMP_AT = isFinite(vA.duration) ? vA.duration * 0.48 : null;
      const active  = activeVideo.current === 'a' ? vA : vB;
      const standby = activeVideo.current === 'a' ? vB : vA;
      if (!isFinite(active.duration) || xfading.current) return;

      // Smooth over the DNA jump cut
      if (
        JUMP_AT !== null &&
        !jumpSmoothingRef.current &&
        active.currentTime >= JUMP_AT - JUMP_WIN &&
        active.currentTime <= JUMP_AT + JUMP_WIN
      ) {
        jumpSmoothingRef.current = true;
        triggerDnaGlitch(0.2, 390, () => { jumpSmoothingRef.current = false; });
      }

      const timeLeft = active.duration - active.currentTime;
      if (timeLeft > CROSSFADE_SEC) return;

      xfading.current = true;
      triggerDnaGlitch(); // default 390 ms — covers the seam, not the whole fade

      standby.currentTime = 0;
      standby.play().catch(() => {});

      // Convert remaining video-time to real-time ms for the CSS transition
      const wallMs = (timeLeft / PLAYBACK_RATE) * 1000;
      active.style.transition  = `opacity ${wallMs}ms linear`;
      standby.style.transition = `opacity ${wallMs}ms linear`;
      void active.offsetHeight; // force reflow so transition applies
      active.style.opacity  = '0';
      standby.style.opacity = '1';

      setTimeout(() => {
        active.pause();
        active.style.transition = '';
        standby.style.transition = '';
        activeVideo.current = activeVideo.current === 'a' ? 'b' : 'a';
        xfading.current = false;
      }, wallMs + 50);
    };

    vA.addEventListener('timeupdate', handleTimeUpdate);
    vB.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
      vA.removeEventListener('timeupdate', handleTimeUpdate);
      vB.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, []);

  useEffect(() => {
    const section  = sectionRef.current;
    const flash    = flashRef.current;
    const hologram = hologramRef.current;
    const content  = contentRef.current;
    if (!section || !flash || !hologram || !content) return;

    gsap.set(hologram, { scaleY: 0, opacity: 0 });
    gsap.set(content,  { opacity: 0 });

    const openHologram = () => {
      const tl = gsap.timeline();
      tl.to(hologram, { opacity: 1, duration: 0.08 })
        .to(hologram, { scaleY: 1, duration: 0.10, ease: 'power3.out', transformOrigin: 'center center' })
        .to(hologram, { opacity: 0.5, duration: 0.04 })
        .to(hologram, { opacity: 1,   duration: 0.04 })
        .to(hologram, { opacity: 0.7, duration: 0.03 })
        .to(hologram, { opacity: 1,   duration: 0.05 })
        .to(content,  { opacity: 1, duration: 0.4, ease: 'power2.out' })
        // Start typing as soon as the content is visible
        .call(() => startTypingRef.current());
    };

    const playFlash = () => {
      window.dispatchEvent(new CustomEvent('about-section-enter'));
      gsap.killTweensOf([flash, hologram, content]);
      gsap.killTweensOf(scanProgressRef.current);
      gsap.set(hologram, { scaleY: 0, opacity: 0 });
      gsap.set(content,  { opacity: 0 });
      setTyped(FIELDS.map(() => ''));
      setActiveField(-1);
      scanProgressRef.current.value    = 0;
      scanAnimatingRef.current         = false;
      sparkParticlesRef.current.length = 0;

      const tl = gsap.timeline({ onComplete: () => { openHologram(); startScanRevealRef.current(); } });
      for (let i = 0; i < 3; i++) {
        tl.set(flash, { opacity: 0 }, i === 0 ? 0 : '+=0.12')
          .to(flash,  { opacity: 1, duration: 0.05 })
          .to(flash,  { opacity: 0, duration: i === 2 ? 0.2 : 0.05, delay: i === 2 ? 0.25 : 0.12 });
      }
    };

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: 'top 60%',
      onEnter: playFlash,
    });

    return () => { trigger.kill(); };
  }, []);

  return (
    <section id="about" ref={sectionRef} className="relative min-h-screen overflow-hidden">

      <video ref={videoARef} autoPlay muted playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ filter: 'saturate(1.3) contrast(1.1)' }}
        src={VIDEO_SRC}
      />
      <video ref={videoBRef} muted playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ filter: 'saturate(1.3) contrast(1.1)' }}
        src={VIDEO_SRC}
      />
      <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-black to-transparent pointer-events-none z-[12]" />
      <div className="absolute inset-0 bg-black/55 pointer-events-none z-10" />
      {/* Localised glitch patch over the DNA helix — masks the ~3s jump cut */}
      {/* Container only controls opacity — no mask-image here, as that isolates
          the stacking context and breaks backdrop-filter on child strips */}
      <div
        ref={dnaBlurRef}
        className="absolute pointer-events-none z-[13]"
        style={{ left: '86%', top: '27%', width: '8%', height: '36%', opacity: 0 }}
      >
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            ref={el => { dnaStripsRef.current[i] = el; }}
            className="absolute w-full"
            style={{
              top: `${i * 10}%`,
              height: '10%',
              // mask-image on the same element as backdrop-filter works fine —
              // the blur renders first, then the mask fades its left/right edges
              backdropFilter: 'blur(2px) brightness(1.15)',
              maskImage: 'linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%)',
            }}
          />
        ))}
      </div>

      {/* Red screen overlay — boosts glowing lights without lifting pure black */}
      <div className="absolute inset-0 pointer-events-none z-[11]"
        style={{ backgroundColor: 'rgba(140, 10, 10, 0.08)', mixBlendMode: 'screen' }}
      />

      {/* ACCESS GRANTED flash */}
      <div ref={flashRef} className="absolute inset-0 flex items-center justify-center z-[100] pointer-events-none opacity-0">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-[140%] h-[300%] bg-red-700/50 blur-3xl rounded-full" />
          <span
            className="relative font-bold tracking-[0.25em] text-3xl md:text-5xl text-white select-none"
            style={{ fontFamily: 'var(--font-orbitron)', textShadow: '0 0 8px #ff2222, 0 0 24px #ff0000, 0 0 60px #cc0000' }}
          >
            [ACCESS GRANTED]
          </span>
        </div>
      </div>

      {/* Cyborg image — feet anchored to platform surface */}
      <div
        className="absolute z-30 pointer-events-none"
        style={{ left: '1550px', top: '490px', transform: 'translate(-50%, -50%)' }}
      >
        <canvas
          ref={cyborgCanvasRef}
          style={{ height: '43vh', width: 'auto', display: 'block', filter: 'contrast(1.35)' }}
        />
        {/* Scanner overlay + spark particles */}
        <canvas
          ref={scannerCanvasRef}
          aria-hidden="true"
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        />
      </div>

      {/* Left-half container */}
      <div className="absolute inset-y-0 left-0 w-1/2 flex items-center justify-center z-20">
        <div
          ref={hologramRef}
          className="w-[88%]"
          style={{
            height: '78vh',
            filter: [
              'drop-shadow(0 0 1px rgba(255,60,60,0.9))',
              'drop-shadow(0 0 8px  rgba(200,0,0,0.6))',
              'drop-shadow(0 0 22px rgba(140,0,0,0.4))',
            ].join(' '),
          }}
        >
          {/* Clipped shell */}
          <div className="w-full h-full relative overflow-hidden"
            style={{
              clipPath: CLIP,
              background: 'linear-gradient(155deg, rgba(20,0,0,0.72) 0%, rgba(5,0,0,0.80) 55%, rgba(10,0,0,0.75) 100%)',
            }}
          >
            <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-red-500/90 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-[1.5px] bg-gradient-to-r from-transparent via-red-500/60 to-transparent" />
            <div className="absolute inset-y-0 left-0 w-[1.5px] bg-gradient-to-b from-transparent via-red-500/70 to-transparent" />
            <div className="absolute inset-y-0 right-0 w-[1.5px] bg-gradient-to-b from-transparent via-red-500/40 to-transparent" />
            <div className="absolute inset-0 pointer-events-none opacity-[0.035]"
              style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,80,80,1) 3px, rgba(255,80,80,1) 4px)' }}
            />
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse 80% 60% at 30% 40%, rgba(180,0,0,0.08) 0%, transparent 70%)' }}
            />

            {/* Content */}
            <div ref={contentRef}
              className="relative z-10 h-full flex flex-col p-7 gap-4 overflow-y-auto"
              style={{ fontFamily: 'var(--font-share-tech-mono)' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-red-500/25">
                <span className="text-red-400 text-[13px] tracking-[0.22em]">// SUBJECT_INFO</span>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-red-500/70 text-[12px] tracking-widest">LIVE</span>
                </div>
              </div>

              {/* Identity fields — typed in one by one */}
              <div className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2.5 text-[13px]">
                {FIELDS.map(({ label, color }, i) => (
                  <Fragment key={i}>
                    <span className="text-red-600/60 tracking-widest whitespace-nowrap">{label}</span>
                    <span className={`tracking-wider ${color} min-h-[1em]`}>
                      {typed[i]}
                      {activeField === i && (
                        <span className={`transition-opacity duration-75 ${cursorOn ? 'opacity-100' : 'opacity-0'}`}>▌</span>
                      )}
                    </span>
                  </Fragment>
                ))}
              </div>

              {/* CORE_SKILLS */}
              <div className="flex items-center gap-3 my-1">
                <div className="h-px flex-1 bg-red-500/20" />
                <span className="text-red-600/45 text-[11px] tracking-[0.35em]">CORE_SKILLS</span>
                <div className="h-px flex-1 bg-red-500/20" />
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 items-start">
                {([
                  { cat: 'LANGUAGES',   items: ['C++ (11/14/17)', 'Python', 'SQL'] },
                  { cat: 'CLOUD',       items: ['AWS', 'GCP', 'Terraform'] },
                  { cat: 'DATA',        items: ['Databricks', 'Delta Lake', 'Redis', 'Lakehouse Architecture'] },
                  { cat: 'AI / ML',     items: ['Gemini API', 'Veo', 'Lyria', 'RAG', 'Multi-Agent Orchestration', 'Co-Pilot', 'Claude Codex', 'Windsurf'] },
                  { cat: 'DEV TOOLS',   items: ['GDB', 'Valgrind', 'Git', 'Docker', 'Kubernetes', 'Linux', 'Jenkins', 'CMocka', 'REST/RPC'] },
                  { cat: 'ENGINEERING', items: ['ETL/ELT Pipelines', 'CI/CD', 'Performance Optimization', 'YANG Data Modeling', 'Observability'] },
                ] as { cat: string; items: string[] }[]).map(({ cat, items }) => (
                  <Fragment key={cat}>
                    <span className="text-red-500/45 text-[10px] tracking-[0.25em] whitespace-nowrap pt-0.5">[{cat}]</span>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                      {items.map(item => (
                        <span key={item} className="text-[12px] text-white/85 tracking-wide">
                          <span className="text-red-600/35 mr-1">▸</span>{item}
                        </span>
                      ))}
                    </div>
                  </Fragment>
                ))}
              </div>

              {/* MISSION_LOG */}
              <div className="flex items-center gap-3 my-1">
                <div className="h-px flex-1 bg-red-500/20" />
                <span className="text-red-600/45 text-[11px] tracking-[0.35em]">MISSION_LOG</span>
                <div className="h-px flex-1 bg-red-500/20" />
              </div>
              <p className="text-white/80 text-[12px] leading-relaxed tracking-wide">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque vehicula
                sapien vitae justo facilisis, nec dignissim nulla convallis. Fusce gravida
                orci at diam porttitor. Suspendisse potenti. Vestibulum ante ipsum primis
                in faucibus orci luctus et ultrices posuere cubilia curae.
              </p>

              {/* Footer */}
              <div className="mt-auto flex items-center justify-between text-[11px] text-red-600/35 tracking-widest border-t border-red-500/15 pt-3">
                <span>SYS :: AUTH_OK</span>
                <span>ENCRYPT :: AES-256</span>
                <span className="animate-pulse">▌</span>
              </div>
            </div>
          </div>

          {/* Corner bracket accents */}
          {CORNER_BRACKETS.map(({ cls, rot }, i) => (
            <div key={i} className={`absolute ${cls} w-6 h-6 pointer-events-none`}>
              <svg viewBox="0 0 24 24" fill="none" className={`w-full h-full ${rot}`}>
                <path d="M1 13 L1 1 L13 1" stroke="rgba(255,70,70,0.75)" strokeWidth="1.5" strokeLinecap="square"/>
              </svg>
            </div>
          ))}
        </div>
      </div>

    </section>
  );
}
