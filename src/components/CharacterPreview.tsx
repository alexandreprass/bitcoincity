'use client'

import { Canvas } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { useMemo, Suspense } from 'react'
import * as THREE from 'three'
import { getCharacterFile } from '@/lib/characters'

// Models are ~1.8 units tall with internal transforms. Scale to fit preview canvas.
const PREVIEW_SCALE = 0.7 // ~1.26 units tall, fits in preview canvas
function CharacterModelPreview({ characterId }: { characterId: string }) {
  const filePath = getCharacterFile(characterId)
  const { scene } = useGLTF(filePath)
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true)
    // Brighten materials for better preview
    clone.traverse((child: any) => {
      if (child.isMesh && child.material) {
        const mat = child.material.clone()
        // Brighten the dark linear-space colors
        if (mat.color) {
          mat.color.multiplyScalar(2.5)
        }
        mat.emissive = new THREE.Color(0x444444)
        mat.emissiveIntensity = 0.4
        child.material = mat
      }
    })
    return clone
  }, [scene])

  return (
    <primitive
      object={clonedScene}
      scale={PREVIEW_SCALE}
      position={[0, -0.65, 0]}
      rotation={[0, Math.PI * 0.1, 0]}
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
        camera={{ position: [0, 0.5, 3], fov: 35 }}
        gl={{ antialias: true, alpha: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[3, 5, 3]} intensity={1.2} />
        <directionalLight position={[-2, 3, -1]} intensity={0.5} color="#88aaff" />
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
        camera={{ position: [0, 0.3, 3.2], fov: 30 }}
        gl={{ antialias: true, alpha: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[3, 5, 3]} intensity={1.0} />
        <Suspense fallback={<LoadingFallback />}>
          <CharacterModelPreview characterId={characterId} />
        </Suspense>
      </Canvas>
    </div>
  )
}
