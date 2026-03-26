'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function Hero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLHeadingElement>(null);
  const introRef = useRef<HTMLParagraphElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames] = useState(144); // 6 seconds * 24 fps
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

      // Split text into letters for disintegration effect
      const nameLetters = nameRef.current?.querySelectorAll('.letter');
      const introLetters = introRef.current?.querySelectorAll('.letter');

      // Initial visuals
      gsap.set([nameRef.current, introRef.current], { opacity: 1 });
      gsap.set(imageRef.current, { opacity: 1 });
      if (nameLetters) gsap.set(nameLetters, { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1, filter: 'blur(0px)' });
      if (introLetters) gsap.set(introLetters, { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1, filter: 'blur(0px)' });

      if (imageRef.current) {
        imageRef.current.src = frameFileName(0).primary;
        imageRef.current.onerror = () => {
          if (imageRef.current) {
            imageRef.current.src = frameFileName(0).fallback;
          }
        };
      }

      const introTl = gsap.timeline({
        defaults: { duration: 0.75, ease: 'power3.out' }
      });

      introTl.from(nameRef.current, { y: -80, opacity: 0, stagger: 0.03 });
      introTl.from(introRef.current, { y: 30, opacity: 0 }, '-=0.35');
      introTl.fromTo(imageRef.current,
        { opacity: 0, filter: 'brightness(0%)' },
        { opacity: 1, filter: 'brightness(100%)', duration: 0.8 },
        '-=0.55');

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
          const frameIndex = frameObj.frame;
          if (imageRef.current && frameIndex !== currentFrame) {
            setCurrentFrame(frameIndex);
            imageRef.current.src = frameFileName(frameIndex).primary;
            imageRef.current.onerror = () => {
              if (imageRef.current) {
                imageRef.current.src = frameFileName(frameIndex).fallback;
              }
            };
          }
        }
      });

      // 2. Disintegrate letters after image sequence completes
      if (nameLetters && nameLetters.length > 0) {
        scrollTl.to(nameLetters, {
          x: () => gsap.utils.random(-1500, -800), // Blow far left
          y: () => gsap.utils.random(-500, 500),   // Spread out vertically
          rotation: () => gsap.utils.random(-90, 90), // Spin around
          scale: () => gsap.utils.random(0.1, 0.5), // Shrink like dust
          opacity: 0,
          filter: 'blur(16px)', // Disintegrate into dust
          ease: 'power2.inOut',
          stagger: { amount: 1.5, from: 'end' }, // Gust of wind hits the right side first
          duration: 2
        }, "disintegrate"); // Label ensures both texts blow away together
      }

      if (introLetters && introLetters.length > 0) {
        scrollTl.to(introLetters, {
          x: () => gsap.utils.random(-1500, -800),
          y: () => gsap.utils.random(-500, 500),
          rotation: () => gsap.utils.random(-90, 90),
          scale: () => gsap.utils.random(0.1, 0.5),
          opacity: 0,
          filter: 'blur(16px)',
          ease: 'power2.inOut',
          stagger: { amount: 1.5, from: 'end' },
          duration: 2
        }, "disintegrate");
      }

      ScrollTrigger.refresh();
    };

    initScrollTriggers();

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('scroll', onScroll);
      }
      ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    };
  }, [totalFrames]);

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
    <div>
      <div
        ref={containerRef}
        className="relative h-[300vh] bg-black"
      >
        {/* Sticky content container */}
        <div className="sticky top-0 h-screen flex items-center justify-center">
          {/* Text content - left side */}
          <div className="flex-1 text-center mr-8">
            <h1
              ref={nameRef}
              className="text-8xl md:text-[10rem] lg:text-[12rem] leading-none text-white font-cursive relative z-0"
            >
              {splitText("Ronald Hoang")}
            </h1>
            <p
              ref={introRef}
              className="text-lg md:text-xl text-gray-300 max-w-3xl mx-auto leading-tight font-sans text-balance -mt-4 relative z-10"
            >
              <span className="block mb-1">{splitText("Software Engineer | Building AI-Native Systems")}</span>
              <span className="block mb-1">{splitText("Multi-Agent Pipelines | Backend Infrastructure")}</span>
              <span className="block mb-1">{splitText("Almost failed the Turing Test")}</span>
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

      {/* Filler content to ensure scrolling */}
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-4xl">Scroll Test Section 1</div>
      </div>
      <div className="min-h-screen bg-blue-900 flex items-center justify-center">
        <div className="text-white text-4xl">Scroll Test Section 2</div>
      </div>
      <div className="min-h-screen bg-green-900 flex items-center justify-center">
        <div className="text-white text-4xl">Scroll Test Section 3</div>
      </div>
    </div>
  );
}