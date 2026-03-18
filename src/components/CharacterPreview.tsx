'use client'

import { Canvas } from '@react-three/fiber'
import { useGLTF, Clone } from '@react-three/drei'
import { Suspense } from 'react'
import { getCharacterFile } from '@/lib/characters'

// Models are ~1.8 units tall at scale 0.4 (same as City3D building characters)
const PREVIEW_SCALE = 0.4

function CharacterModelPreview({ characterId }: { characterId: string }) {
  const filePath = getCharacterFile(characterId)
  const { scene } = useGLTF(filePath)

  return (
    <Clone
      object={scene}
      scale={PREVIEW_SCALE}
      rotation={[0, Math.PI * 0.1, 0]}
      position={[0, -0.35, 0]}
    />
  )
}

function LoadingFallback() {
  return (
    <mesh position={[0, 0, 0]}>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial color="#f7931a" wireframe />
    </mesh>
  )
}

export default function CharacterPreview({
  characterId,
  size = 120,
  className = '',
}: {
  characterId: string
  size?: number
  className?: string
}) {
  return (
    <div
      className={`rounded-lg overflow-hidden ${className}`}
      style={{ width: size, height: size, background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}
    >
      <Canvas
        camera={{ position: [0, 0.3, 2.2], fov: 35 }}
        gl={{ antialias: true, alpha: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <ambientLight intensity={1.2} />
        <directionalLight position={[3, 5, 3]} intensity={1.5} />
        <directionalLight position={[-2, 3, -1]} intensity={0.6} color="#88aaff" />
        <Suspense fallback={<LoadingFallback />}>
          <CharacterModelPreview characterId={characterId} />
        </Suspense>
      </Canvas>
    </div>
  )
}

// Smaller thumbnail version for the picker grid
export function CharacterThumbnail({
  characterId,
  size = 80,
  className = '',
}: {
  characterId: string
  size?: number
  className?: string
}) {
  return (
    <div
      className={`rounded-md overflow-hidden ${className}`}
      style={{ width: size, height: size, background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' }}
    >
      <Canvas
        camera={{ position: [0, 0.3, 2.2], fov: 35 }}
        gl={{ antialias: true, alpha: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <ambientLight intensity={1.2} />
        <directionalLight position={[3, 5, 3]} intensity={1.5} />
        <Suspense fallback={<LoadingFallback />}>
          <CharacterModelPreview characterId={characterId} />
        </Suspense>
      </Canvas>
    </div>
  )
}
