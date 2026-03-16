'use client'

import { Canvas } from '@react-three/fiber'
import { OrbitControls, Text, Environment } from '@react-three/drei'
import { useMemo } from 'react'
import type { Building as BuildingType } from '@/lib/supabase'
import { satoshisToBtc, getBuildingLabel } from '@/lib/bitcoin'

function Building({ data, index, total }: { data: BuildingType; index: number; total: number }) {
  const height = data.height || 1
  const width = Math.max(0.8, Math.min(2, height / 10))

  // Spiral layout for the city
  const angle = index * 0.8
  const radius = 3 + index * 0.6
  const x = data.position_x || Math.cos(angle) * radius
  const z = data.position_z || Math.sin(angle) * radius

  const btc = satoshisToBtc(data.balance_satoshis)
  const label = data.display_name || data.username || 'Anon'
  const btcLabel = btc >= 1 ? `${btc.toFixed(2)} BTC` : `${(btc * 100000000).toFixed(0)} sats`

  return (
    <group position={[x, 0, z]}>
      {/* Building body */}
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, width]} />
        <meshStandardMaterial color={data.color || '#4A90D9'} metalness={0.3} roughness={0.7} />
      </mesh>

      {/* Windows */}
      {Array.from({ length: Math.min(Math.floor(height / 1.5), 20) }).map((_, i) => (
        <mesh key={i} position={[width / 2 + 0.01, 1 + i * 1.5, 0]}>
          <planeGeometry args={[0.3, 0.4]} />
          <meshStandardMaterial color="#ffffaa" emissive="#ffffaa" emissiveIntensity={0.5} />
        </mesh>
      ))}

      {/* Antenna for tall buildings */}
      {height >= 15 && (
        <mesh position={[0, height + 1, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 2]} />
          <meshStandardMaterial color="#888" />
        </mesh>
      )}

      {/* Crown for whale buildings */}
      {height >= 30 && (
        <mesh position={[0, height + 0.3, 0]}>
          <coneGeometry args={[width / 2, 1, 4]} />
          <meshStandardMaterial color="#FFD700" metalness={0.8} roughness={0.2} />
        </mesh>
      )}

      {/* Name label */}
      <Text
        position={[0, height + (height >= 30 ? 2.5 : 1.5), 0]}
        fontSize={0.4}
        color="white"
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.05}
        outlineColor="black"
      >
        {label}
      </Text>

      {/* BTC amount */}
      <Text
        position={[0, height + (height >= 30 ? 2 : 1), 0]}
        fontSize={0.25}
        color="#f7931a"
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.03}
        outlineColor="black"
      >
        {btcLabel}
      </Text>
    </group>
  )
}

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
      <circleGeometry args={[100, 64]} />
      <meshStandardMaterial color="#1a1a2e" />
    </mesh>
  )
}

function Roads() {
  return (
    <group>
      {/* Circular roads */}
      {[8, 16, 24, 32].map((radius) => (
        <mesh key={radius} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <ringGeometry args={[radius - 0.15, radius + 0.15, 64]} />
          <meshStandardMaterial color="#2a2a3e" />
        </mesh>
      ))}
    </group>
  )
}

function CitySign({ count }: { count: number }) {
  return (
    <group position={[0, 3, -5]}>
      <Text
        fontSize={1.2}
        color="#f7931a"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.05}
        outlineColor="black"
      >
        BITCOIN CITY
      </Text>
      <Text
        position={[0, -1.2, 0]}
        fontSize={0.4}
        color="#888"
        anchorX="center"
        anchorY="middle"
      >
        {count} citizen{count !== 1 ? 's' : ''} and counting
      </Text>
    </group>
  )
}

export default function City3D({ buildings }: { buildings: BuildingType[] }) {
  return (
    <div className="w-full h-screen">
      <Canvas
        shadows
        camera={{ position: [20, 15, 20], fov: 60 }}
        style={{ background: '#0a0a1a' }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[20, 30, 10]}
          intensity={1}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <pointLight position={[0, 20, 0]} intensity={0.5} color="#f7931a" />

        <CitySign count={buildings.length} />
        <Ground />
        <Roads />

        {buildings.map((b, i) => (
          <Building key={b.id} data={b} index={i} total={buildings.length} />
        ))}

        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          maxPolarAngle={Math.PI / 2.1}
          minDistance={5}
          maxDistance={80}
          autoRotate
          autoRotateSpeed={0.3}
        />

        <fog attach="fog" args={['#0a0a1a', 30, 100]} />
      </Canvas>
    </div>
  )
}
