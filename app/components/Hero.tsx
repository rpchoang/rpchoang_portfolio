'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap/dist/gsap';
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';
import { AnimationController, AnimState } from './CyclopsLaserDestroyer';

gsap.registerPlugin(ScrollTrigger);

export default function Hero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLHeadingElement>(null);
  const introRef = useRef<HTMLParagraphElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const destructionCanvasRef = useRef<HTMLCanvasElement>(null);
  const animControllerRef = useRef<AnimationController | null>(null);
  const introTlRef = useRef<gsap.core.Timeline | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames] = useState(144); // 6 seconds * 24 fps
  const destructionStartedRef = useRef(false);
  const userScrolledRef = useRef(false);
  const frameBaseUrl = process.env.NEXT_PUBLIC_FRAME_BASE_URL || '/assets/frames';
  const frameFileName = (index: number) => {
    const onePadded = String(index + 1).padStart(3, '0');
    const fourPadded = String(index + 1).padStart(4, '0');
    return {
      primary: `${frameBaseUrl}/ezgif-frame-${onePadded}.png`,
      fallback: `${frameBaseUrl}/ezgif-frame-${fourPadded}.png`
    };
  };

  useEffect(() => {
    const onScroll = () => {
      userScrolledRef.current = true;
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    const initScrollTriggers = () => {
      if (!containerRef.current) {
        setTimeout(initScrollTriggers, 100);
        return;
      }

      // Preload frames for smooth animation
      for (let i = 0; i < totalFrames; i++) {
        const img = new Image();
        img.decoding = 'async';
        img.src = frameFileName(i).primary;
        img.onerror = () => {
          img.src = frameFileName(i).fallback;
        };
      }

      gsap.set([nameRef.current, introRef.current], { opacity: 1 });
      gsap.set(imageRef.current, { opacity: 1 });

      const imageFadeInTl = gsap.timeline();
      const textAnimTl = gsap.timeline();
      introTlRef.current = textAnimTl;

      if (imageRef.current) {
        imageRef.current.src = frameFileName(0).primary;
        imageRef.current.onerror = () => {
          if (imageRef.current) {
            imageRef.current.src = frameFileName(0).fallback;
          }
        };
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
        }
      }, 0.6); // Start precisely when the fall finishes

      // Create a single scroll-bound timeline to sequence the image animation and wind effect
      const scrollTl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: 1, // Smooth scrubbing
        }
      });

      const frameObj = { frame: 0 };

      // 1. Play the image sequence first
      scrollTl.to(frameObj, {
        frame: totalFrames - 1,
        snap: "frame",
        ease: "none",
        duration: 2, // Relative duration in timeline
        onUpdate: () => {
          const frameIndex = Math.round(frameObj.frame);
          if (imageRef.current && frameIndex !== currentFrame) {
            setCurrentFrame(frameIndex);
            imageRef.current.src = frameFileName(frameIndex).primary;
            imageRef.current.onerror = () => {
              if (imageRef.current) {
                imageRef.current.src = frameFileName(frameIndex).fallback;
              }
            };
          }

          if (frameIndex >= totalFrames - 1) {
            if (animControllerRef.current && imageRef.current && destructionCanvasRef.current) {
              animControllerRef.current.showBeam();
              if (!destructionStartedRef.current) {
                destructionStartedRef.current = true;
                const img = imageRef.current;
                const rect = img.getBoundingClientRect();
                const canvasRect = destructionCanvasRef.current.getBoundingClientRect();
                const natW = img.naturalWidth || 500;
                const natH = img.naturalHeight || 500;
                const scaleX = rect.width / natW;
                const scaleY = rect.height / natH;
                const eyeX = (rect.left - canvasRect.left) + (198 * scaleX) - 29;
                const eyeY = (rect.top - canvasRect.top) + (295 * scaleY);
                animControllerRef.current.fireLaser({ x: eyeX, y: eyeY }, scaleX);
              }
            }
          } else if (frameIndex > 0) {
            if (animControllerRef.current) {
              animControllerRef.current.hideBeam();
            }
          } else if (frameIndex === 0) {
            // Rewind state smoothly ONLY when the user scrolls all the way back to the top
            if (animControllerRef.current) {
              animControllerRef.current.reset();
              if (!animControllerRef.current.isTextDestroyed) {
                destructionStartedRef.current = false;
                introTlRef.current?.restart(); // Re-play the text fall animation
              }
            }
          }
        }
      });

      // 2. Add extra scrolling space to watch the laser animation while the section remains pinned
      scrollTl.to({}, { duration: 3 });

      ScrollTrigger.refresh();
    };

    initScrollTriggers();

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('scroll', onScroll);
      }
      ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    };
  }, [totalFrames, frameBaseUrl]);

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

    // --- NEW FIX ---
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

      // Calculate position relative to the exact center of the DOM elements bounding box
      const x = rect.left - containerRect.left + rect.width / 2;
      const y = rect.top - containerRect.top + rect.height / 2;

      // Use textContent to prevent the span elements from injecting newlines which break fillText
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

  // Function to split text into letters for the dust disintegration effect
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

  return (
    <div ref={containerRef} className="relative h-[300vh] bg-black">
      {/* Sticky content container */}
      <div
        ref={stickyRef}
        className="sticky top-0 h-screen flex items-center justify-center"
        style={{ transform: 'translateZ(0)' }}
      >
          {/* Canvas for the new text destruction effect */}
          <canvas
            ref={destructionCanvasRef}
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
                src={frameFileName(0).primary}
                alt="Cyborg animation frame"
                className="w-[500px] h-[500px] md:w-[600px] md:h-[600px] object-cover rounded-lg shadow-2xl"
              />
              {/* Black fade overlay at bottom */}
              <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent rounded-b-lg pointer-events-none" />
              {/* Black fade overlay at left */}
              <div className="absolute top-0 bottom-0 left-0 w-48 bg-gradient-to-r from-black to-transparent rounded-l-lg pointer-events-none" />
              {/* Black fade overlay at right */}
              <div className="absolute top-0 bottom-0 right-0 w-48 bg-gradient-to-l from-black to-transparent rounded-r-lg pointer-events-none" />
            </div>
          </div>
      </div>
    </div>
  );
}