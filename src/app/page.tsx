'use client';

import dynamic from 'next/dynamic';

// Dynamic import to avoid SSR issues with Canvas
const GameCanvas = dynamic(() => import('@/components/GameCanvas'), { ssr: false });

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #1a0030 0%, #3d0026 50%, #1a0030 100%)' }}>
      <GameCanvas />
    </main>
  );
}
