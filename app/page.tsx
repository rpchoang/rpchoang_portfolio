'use client';
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Hero from './components/Hero';

const About = dynamic(() => import('./components/About'), { ssr: false });

export default function Home() {
  const [showAbout, setShowAbout] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setShowAbout(true); },
      { rootMargin: '300px' },
    );
    if (triggerRef.current) obs.observe(triggerRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <main>
      <Hero />
      <div ref={triggerRef}>
        {showAbout && <About />}
      </div>
    </main>
  );
}
