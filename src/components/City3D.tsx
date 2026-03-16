'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Text, Html } from '@react-three/drei'
import { useState, useRef, useCallback } from 'react'
import * as THREE from 'three'
import type { Building as BuildingType } from '@/lib/supabase'
import { satoshisToBtc } from '@/lib/bitcoin'

function VerifiedAura({ width, height }: { width: number; height: number }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y += 0.01
      const scale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.05
      ref.current.scale.set(scale, 1, scale)
    }
  })
  return (
    <mesh ref={ref} position={[0, height / 2, 0]}>
      <cylinderGeometry args={[width * 0.9, width * 0.9, height + 0.5, 6, 1, true]} />
      <meshStandardMaterial
        color="#FFD700"
        transparent
        opacity={0.12}
        side={THREE.DoubleSide}
        emissive="#FFD700"
        emissiveIntensity={0.3}
      />
    </mesh>
  )
}

function BuildingWindows({ width, height, floors }: { width: number; height: number; floors: number }) {
  const windows = []
  const floorHeight = height / Math.max(floors, 1)

  for (let floor = 0; floor < floors; floor++) {
    const y = floorHeight * 0.5 + floor * floorHeight
    const windowsPerSide = Math.max(1, Math.min(3, Math.floor(width / 0.4)))
    const spacing = width / (windowsPerSide + 1)

    for (let w = 0; w < windowsPerSide; w++) {
      const xOff = spacing * (w + 1) - width / 2
      // Front
      windows.push(
        <mesh key={`f-${floor}-${w}`} position={[xOff, y, width / 2 + 0.01]}>
          <planeGeometry args={[0.2, 0.25]} />
          <meshStandardMaterial color="#ffffcc" emissive="#ffffaa" emissiveIntensity={0.6} />
        </mesh>
      )
      // Back
      windows.push(
        <mesh key={`b-${floor}-${w}`} position={[xOff, y, -(width / 2 + 0.01)]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[0.2, 0.25]} />
          <meshStandardMaterial color="#ffffcc" emissive="#ffffaa" emissiveIntensity={0.6} />
        </mesh>
      )
      // Left
      windows.push(
        <mesh key={`l-${floor}-${w}`} position={[-(width / 2 + 0.01), y, xOff]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[0.2, 0.25]} />
          <meshStandardMaterial color="#ffffcc" emissive="#ffffaa" emissiveIntensity={0.6} />
        </mesh>
      )
      // Right
      windows.push(
        <mesh key={`r-${floor}-${w}`} position={[width / 2 + 0.01, y, xOff]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.2, 0.25]} />
          <meshStandardMaterial color="#ffffcc" emissive="#ffffaa" emissiveIntensity={0.6} />
        </mesh>
      )
    }
  }
  return <>{windows}</>
}

function BuildingDoor({ width }: { width: number }) {
  return (
    <mesh position={[0, 0.2, width / 2 + 0.01]}>
      <planeGeometry args={[0.3, 0.4]} />
      <meshStandardMaterial color="#4a3520" />
    </mesh>
  )
}

function Building({ data, onClick }: { data: BuildingType; onClick: (b: BuildingType) => void }) {
  const height = data.height || 1
  const width = 0.6 + height * 0.15
  const x = data.position_x || 0
  const z = data.position_z || 0
  const floors = height
  const verified = (data as any).verified || false
  const [hovered, setHovered] = useState(false)

  return (
    <group position={[x, 0, z]}>
      {/* Verified golden aura */}
      {verified && <VerifiedAura width={width} height={height} />}

      {/* Building base/foundation */}
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <boxGeometry args={[width + 0.15, 0.1, width + 0.15]} />
        <meshStandardMaterial color="#333" />
      </mesh>

      {/* Main building body */}
      <mesh
        position={[0, height / 2 + 0.1, 0]}
        castShadow
        receiveShadow
        onClick={() => onClick(data)}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[width, height, width]} />
        <meshStandardMaterial
          color={hovered ? '#ffffff' : (data.color || '#4A90D9')}
          metalness={0.2}
          roughness={0.8}
        />
      </mesh>

      {/* Roof */}
      {height <= 3 ? (
        // Peaked roof for small buildings
        <mesh position={[0, height + 0.1 + 0.2, 0]}>
          <coneGeometry args={[width * 0.7, 0.4, 4]} />
          <meshStandardMaterial color="#5a3a1a" roughness={0.9} />
        </mesh>
      ) : (
        // Flat top with edge for tall buildings
        <mesh position={[0, height + 0.15, 0]}>
          <boxGeometry args={[width + 0.05, 0.1, width + 0.05]} />
          <meshStandardMaterial color="#555" metalness={0.5} />
        </mesh>
      )}

      {/* Antenna for tall buildings */}
      {height >= 6 && (
        <>
          <mesh position={[0, height + 0.5, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.7]} />
            <meshStandardMaterial color="#888" metalness={0.8} />
          </mesh>
          <mesh position={[0, height + 0.85, 0]}>
            <sphereGeometry args={[0.05]} />
            <meshStandardMaterial color="red" emissive="red" emissiveIntensity={0.8} />
          </mesh>
        </>
      )}

      {/* Windows */}
      <BuildingWindows width={width} height={height} floors={floors} />

      {/* Door */}
      <BuildingDoor width={width} />

      {/* Name label */}
      <Text
        position={[0, height + (height >= 6 ? 1.5 : 0.8), 0]}
        fontSize={0.3}
        color="white"
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.04}
        outlineColor="black"
      >
        {verified ? '✓ ' : ''}{data.display_name || data.username || 'Anon'}
      </Text>
    </group>
  )
}

function BuildingPopup({ building, onClose }: { building: BuildingType; onClose: () => void }) {
  const btc = satoshisToBtc(building.balance_satoshis)
  const btcLabel = btc >= 0.001 ? `${btc.toFixed(8)} BTC` : `${building.balance_satoshis.toLocaleString()} sats`
  const verified = (building as any).verified || false
  const message = (building as any).message || ''

  return (
    <div
      className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-gray-900/95 backdrop-blur-md border border-gray-700 rounded-xl p-5 max-w-sm w-full mx-4 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <button onClick={onClose} className="absolute top-3 right-3 text-gray-500 hover:text-white text-xl">&times;</button>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-lg font-bold text-white">{building.display_name || building.username}</h3>
        {verified && (
          <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-0.5 rounded-full border border-yellow-500/50 font-semibold">
            VERIFIED
          </span>
        )}
      </div>
      <div className="space-y-2 text-sm">
        <div>
          <span className="text-gray-500">Balance</span>
          <p className="text-[#f7931a] font-bold text-lg">{btcLabel}</p>
        </div>
        <div>
          <span className="text-gray-500">Address</span>
          <p className="text-gray-300 font-mono text-xs break-all">{building.btc_address}</p>
        </div>
        {message && (
          <div className="mt-3 bg-gray-800 rounded-lg p-3">
            <span className="text-gray-500 text-xs">Message</span>
            <p className="text-gray-200 text-sm mt-1">&ldquo;{message}&rdquo;</p>
          </div>
        )}
      </div>
    </div>
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
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingType | null>(null)

  const handleBuildingClick = useCallback((b: BuildingType) => {
    setSelectedBuilding(b)
  }, [])

  return (
    <div className="w-full h-screen relative">
      {selectedBuilding && (
        <BuildingPopup building={selectedBuilding} onClose={() => setSelectedBuilding(null)} />
      )}

      <Canvas
        shadows
        camera={{ position: [15, 10, 15], fov: 60 }}
        style={{ background: '#0a0a1a' }}
        onClick={() => setSelectedBuilding(null)}
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

        {buildings.map((b) => (
          <Building key={b.id} data={b} onClick={handleBuildingClick} />
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
