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

      // Split text into word units for disintegration effect (avoid breaking inside words)
      const nameWords = nameRef.current?.querySelectorAll('.word');
      const introWords = introRef.current?.querySelectorAll('.word');

      // Initial visuals
      gsap.set([nameRef.current, introRef.current], { opacity: 1 });
      gsap.set(imageRef.current, { opacity: 1 });
      if (nameWords) gsap.set(nameWords, { y: 0, rotation: 0, opacity: 1 });
      if (introWords) gsap.set(introWords, { y: 0, rotation: 0, opacity: 1 });

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

      ScrollTrigger.create({
        trigger: containerRef.current,
        start: 'top top',
        end: 'bottom top',
        scrub: 0.5,
        onUpdate: (self) => {
          const progress = self.progress;
          if (nameWords) {
            gsap.set(nameWords, {
              y: progress * gsap.utils.random(-50, 50),
              rotation: progress * gsap.utils.random(-45, 45),
              opacity: 1 - progress
            });
          }
          if (introWords) {
            gsap.set(introWords, {
              y: progress * gsap.utils.random(-30, 30),
              rotation: progress * gsap.utils.random(-30, 30),
              opacity: 1 - progress
            });
          }
        }
      });

      ScrollTrigger.create({
        trigger: containerRef.current,
        start: 'top top',
        end: 'bottom top',
        scrub: true,
        onUpdate: (self) => {
          const progress = self.progress;
          if (nameWords) {
            gsap.set(nameWords, {
              y: progress * gsap.utils.random(-50, 50),
              rotation: progress * gsap.utils.random(-45, 45),
              opacity: 1 - progress
            });
          }
          if (introWords) {
            gsap.set(introWords, {
              y: progress * gsap.utils.random(-30, 30),
              rotation: progress * gsap.utils.random(-30, 30),
              opacity: 1 - progress
            });
          }
        }
      });

      ScrollTrigger.create({
        trigger: containerRef.current,
        start: 'top top',
        end: 'bottom top',
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const frameIndex = Math.round(self.progress * (totalFrames - 1));
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

  // Function to split text into words (avoid truncating the middle of words when the scroll effect runs)
  const splitText = (text: string) => {
    const words = text.split(' ');
    return words.map((word, index) => (
      <span key={`${word}-${index}`} className="word inline-block whitespace-nowrap">
        {word}
        {index < words.length - 1 ? '\u00A0' : ''}
      </span>
    ));
  };

  return (
    <div>
      <div
        ref={containerRef}
        className="relative h-[200vh] bg-black"
      >
        {/* Sticky content container */}
        <div className="sticky top-0 h-screen flex items-center justify-center">
          {/* Text content - left side */}
          <div className="flex-1 text-center mr-8">
            <h1
              ref={nameRef}
              className="text-6xl md:text-8xl font-bold text-white mb-6 font-mono tracking-wider"
            >
              {splitText("RONALD HOANG")}
            </h1>
            <p
              ref={introRef}
              className="text-xl md:text-2xl text-gray-300 max-w-2xl mx-auto leading-relaxed"
            >
              {splitText("Software Engineer specializing in high-performance C++ systems, AI orchestration, and distributed platforms. Building the backbone of networks trusted by Meta and Verizon.")}
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
              <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent rounded-b-lg" />
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