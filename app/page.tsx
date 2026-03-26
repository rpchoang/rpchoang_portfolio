import Hero from './components/Hero';

export default function Home() {
  return (
    <main>
      <Hero />
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
    </main>
  );
}
