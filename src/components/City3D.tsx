'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Text } from '@react-three/drei'
import { useState, useRef, useCallback, useMemo } from 'react'
import * as THREE from 'three'
import type { Building as BuildingType } from '@/lib/supabase'
import { satoshisToBtc } from '@/lib/bitcoin'

// Height tiers: start at 5, +2 per level
// tier 1=5, 2=7, 3=9, 4=11, 5=13, 6=15, 7=17, 8=19
function tierToHeight(tier: number): number {
  return 3 + tier * 2 // 5,7,9,11,13,15,17,19
}

const BUILDING_WIDTH = 2.2 // fixed width for all buildings
const FLOOR_HEIGHT = 0.55 // each visual floor height
const WINDOW_COLS = 5 // exactly 5 windows per side

// Modern glass/steel color palette per tier
function getTierStyle(tier: number) {
  const styles: Record<number, { body: string; accent: string; glass: string; emissive: string }> = {
    1: { body: '#6B5B4F', accent: '#8B7355', glass: '#ffffcc', emissive: '#aa9944' },
    2: { body: '#7A6855', accent: '#D4A574', glass: '#ffffdd', emissive: '#bbaa55' },
    3: { body: '#3D7A4A', accent: '#50C878', glass: '#ccffdd', emissive: '#55cc77' },
    4: { body: '#3A6B8C', accent: '#5B8DEF', glass: '#ccddff', emissive: '#5588cc' },
    5: { body: '#2E5A8C', accent: '#4A90D9', glass: '#bbccff', emissive: '#4488cc' },
    6: { body: '#2B4A8C', accent: '#4169E1', glass: '#aabbff', emissive: '#4466dd' },
    7: { body: '#505560', accent: '#C0C0C0', glass: '#ddeeff', emissive: '#8899bb' },
    8: { body: '#8B7500', accent: '#FFD700', glass: '#ffffdd', emissive: '#ccaa33' },
  }
  return styles[tier] || styles[1]
}

function VerifiedAura({ height }: { height: number }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y += 0.008
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 1.5) * 0.03
      ref.current.scale.set(pulse, 1, pulse)
    }
  })
  return (
    <mesh ref={ref} position={[0, height / 2, 0]}>
      <cylinderGeometry args={[BUILDING_WIDTH * 0.85, BUILDING_WIDTH * 0.85, height + 1, 8, 1, true]} />
      <meshStandardMaterial
        color="#FFD700"
        transparent
        opacity={0.08}
        side={THREE.DoubleSide}
        emissive="#FFD700"
        emissiveIntensity={0.4}
      />
    </mesh>
  )
}

function ModernWindows({ height, tier }: { height: number; tier: number }) {
  const style = getTierStyle(tier)
  const totalFloors = Math.floor(height / FLOOR_HEIGHT)
  const displayFloors = Math.min(totalFloors, 30)
  const w = BUILDING_WIDTH
  const windowW = 0.22
  const windowH = 0.32
  const spacing = w / (WINDOW_COLS + 1)

  const windowGeom = useMemo(() => new THREE.PlaneGeometry(windowW, windowH), [])
  const windowMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: style.glass,
        emissive: style.emissive,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.9,
      }),
    [style]
  )

  const instances = useMemo(() => {
    const arr: { pos: [number, number, number]; rot: [number, number, number] }[] = []
    const step = Math.max(1, Math.floor(displayFloors / 20))
    for (let f = 1; f < displayFloors; f += step) {
      const y = f * FLOOR_HEIGHT + 0.15
      for (let c = 0; c < WINDOW_COLS; c++) {
        const off = spacing * (c + 1) - w / 2
        arr.push({ pos: [off, y, w / 2 + 0.01], rot: [0, 0, 0] })
        arr.push({ pos: [off, y, -(w / 2 + 0.01)], rot: [0, Math.PI, 0] })
        arr.push({ pos: [-(w / 2 + 0.01), y, off], rot: [0, -Math.PI / 2, 0] })
        arr.push({ pos: [w / 2 + 0.01, y, off], rot: [0, Math.PI / 2, 0] })
      }
    }
    return arr
  }, [displayFloors, spacing, w])

  return (
    <>
      {instances.map((inst, i) => (
        <mesh key={i} geometry={windowGeom} material={windowMat} position={inst.pos} rotation={inst.rot} />
      ))}
    </>
  )
}

function FloorLines({ height }: { height: number }) {
  const lines = useMemo(() => {
    const arr: number[] = []
    const total = Math.floor(height / FLOOR_HEIGHT)
    const step = Math.max(1, Math.floor(total / 15))
    for (let f = 1; f < total; f += step) {
      arr.push(f * FLOOR_HEIGHT)
    }
    return arr
  }, [height])

  const w = BUILDING_WIDTH
  return (
    <>
      {lines.map((y, i) => (
        <mesh key={i} position={[0, y, 0]}>
          <boxGeometry args={[w + 0.02, 0.02, w + 0.02]} />
          <meshStandardMaterial color="#00000033" transparent opacity={0.15} />
        </mesh>
      ))}
    </>
  )
}

function Building({ data, onClick }: { data: BuildingType; onClick: (b: BuildingType) => void }) {
  const tier = data.height || 1
  const height = tierToHeight(tier)
  const x = data.position_x || 0
  const z = data.position_z || 0
  const verified = data.verified || false
  const style = getTierStyle(tier)
  const [hovered, setHovered] = useState(false)
  const w = BUILDING_WIDTH

  return (
    <group position={[x, 0, z]}>
      {/* Verified golden aura */}
      {verified && <VerifiedAura height={height} />}

      {/* Foundation */}
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <boxGeometry args={[w + 0.3, 0.16, w + 0.3]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>

      {/* Main body */}
      <mesh
        position={[0, height / 2 + 0.16, 0]}
        castShadow
        receiveShadow
        onClick={(e) => { e.stopPropagation(); onClick(data) }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[w, height, w]} />
        <meshStandardMaterial
          color={hovered ? '#aabbcc' : style.body}
          metalness={tier >= 7 ? 0.6 : 0.15}
          roughness={tier >= 7 ? 0.3 : 0.7}
        />
      </mesh>

      {/* Accent stripe (vertical) */}
      <mesh position={[w / 2 + 0.01, height / 2 + 0.16, 0]}>
        <planeGeometry args={[0.08, height]} />
        <meshStandardMaterial color={style.accent} emissive={style.accent} emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[-(w / 2 + 0.01), height / 2 + 0.16, 0]}>
        <planeGeometry args={[0.08, height]} />
        <meshStandardMaterial color={style.accent} emissive={style.accent} emissiveIntensity={0.2} />
      </mesh>

      {/* Windows */}
      <ModernWindows height={height} tier={tier} />

      {/* Floor separator lines */}
      <FloorLines height={height} />

      {/* Door */}
      <mesh position={[0, 0.35, w / 2 + 0.015]}>
        <planeGeometry args={[0.5, 0.5]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      {/* Door frame */}
      <mesh position={[0, 0.35, w / 2 + 0.02]}>
        <planeGeometry args={[0.56, 0.56]} />
        <meshStandardMaterial color={style.accent} />
      </mesh>

      {/* Roof structure */}
      <mesh position={[0, height + 0.26, 0]}>
        <boxGeometry args={[w + 0.1, 0.12, w + 0.1]} />
        <meshStandardMaterial color="#222" metalness={0.4} />
      </mesh>

      {/* Rooftop equipment for taller buildings */}
      {tier >= 4 && (
        <>
          <mesh position={[0.5, height + 0.55, 0.5]}>
            <boxGeometry args={[0.4, 0.5, 0.4]} />
            <meshStandardMaterial color="#333" />
          </mesh>
          <mesh position={[-0.5, height + 0.45, -0.3]}>
            <boxGeometry args={[0.3, 0.3, 0.3]} />
            <meshStandardMaterial color="#2a2a2a" />
          </mesh>
        </>
      )}

      {/* Antenna for tier 6+ */}
      {tier >= 6 && (
        <>
          <mesh position={[0, height + 0.9, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 1.2]} />
            <meshStandardMaterial color="#666" metalness={0.8} />
          </mesh>
          <mesh position={[0, height + 1.5, 0]}>
            <sphereGeometry args={[0.06]} />
            <meshStandardMaterial color="#ff3333" emissive="#ff0000" emissiveIntensity={0.8} />
          </mesh>
        </>
      )}

      {/* Crown for tier 8 (gold) */}
      {tier >= 8 && (
        <mesh position={[0, height + 0.5, 0]}>
          <coneGeometry args={[0.6, 0.6, 4]} />
          <meshStandardMaterial color="#FFD700" metalness={0.8} roughness={0.2} emissive="#FFD700" emissiveIntensity={0.15} />
        </mesh>
      )}

      {/* Name label */}
      <Text
        position={[0, height + (tier >= 6 ? 2.2 : 0.8), 0]}
        fontSize={0.35}
        color="white"
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.04}
        outlineColor="#000000"
      >
        {verified ? '\u2713 ' : ''}{data.display_name || data.username || 'Anon'}
      </Text>
    </group>
  )
}

function BuildingPopup({ building, onClose }: { building: BuildingType; onClose: () => void }) {
  const btc = satoshisToBtc(building.balance_satoshis)
  const btcLabel = btc >= 0.001 ? `${btc.toFixed(8)} BTC` : `${building.balance_satoshis.toLocaleString()} sats`
  const verified = building.verified || false
  const message = building.message || ''

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
        <div>
          <span className="text-gray-500">Tier</span>
          <p className="text-gray-300">{building.height} of 8</p>
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
    <>
      {/* Main ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <circleGeometry args={[120, 64]} />
        <meshStandardMaterial color="#111118" />
      </mesh>
      {/* Grass/park areas */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <ringGeometry args={[4, 5.5, 64]} />
        <meshStandardMaterial color="#1a2a1a" />
      </mesh>
    </>
  )
}

function Roads() {
  return (
    <group>
      {/* Circular roads with lane markings */}
      {[10, 20, 32, 45].map((radius) => (
        <group key={radius}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
            <ringGeometry args={[radius - 0.4, radius + 0.4, 64]} />
            <meshStandardMaterial color="#1e1e2a" />
          </mesh>
          {/* Lane line */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
            <ringGeometry args={[radius - 0.03, radius + 0.03, 64]} />
            <meshStandardMaterial color="#333340" />
          </mesh>
        </group>
      ))}
      {/* Radial roads */}
      {[0, Math.PI / 3, (2 * Math.PI) / 3, Math.PI, (4 * Math.PI) / 3, (5 * Math.PI) / 3].map((angle, i) => (
        <mesh
          key={`r-${i}`}
          rotation={[-Math.PI / 2, 0, angle]}
          position={[Math.cos(angle) * 27, 0.006, Math.sin(angle) * 27]}
        >
          <planeGeometry args={[0.6, 54]} />
          <meshStandardMaterial color="#1e1e2a" />
        </mesh>
      ))}
    </group>
  )
}

function Streetlights() {
  const lights = useMemo(() => {
    const arr: [number, number][] = []
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2
      arr.push([Math.cos(angle) * 10, Math.sin(angle) * 10])
    }
    return arr
  }, [])

  return (
    <>
      {lights.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 1.2, 0]}>
            <cylinderGeometry args={[0.03, 0.04, 2.4]} />
            <meshStandardMaterial color="#444" metalness={0.6} />
          </mesh>
          <pointLight position={[0, 2.3, 0]} intensity={0.3} distance={6} color="#ffeecc" />
          <mesh position={[0, 2.4, 0]}>
            <sphereGeometry args={[0.08]} />
            <meshStandardMaterial color="#ffffcc" emissive="#ffffaa" emissiveIntensity={1} />
          </mesh>
        </group>
      ))}
    </>
  )
}

function CitySign({ count }: { count: number }) {
  return (
    <group position={[0, 4, -6]}>
      <Text
        fontSize={1.5}
        color="#f7931a"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.06}
        outlineColor="black"
        font={undefined}
      >
        BITCOIN CITY
      </Text>
      <Text
        position={[0, -1.5, 0]}
        fontSize={0.45}
        color="#666"
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
        camera={{ position: [25, 18, 25], fov: 55 }}
        style={{ background: 'linear-gradient(180deg, #0a0a1a 0%, #0d0d24 100%)' }}
        onPointerMissed={() => setSelectedBuilding(null)}
      >
        <ambientLight intensity={0.35} />
        <directionalLight
          position={[30, 40, 20]}
          intensity={0.9}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <pointLight position={[0, 30, 0]} intensity={0.3} color="#f7931a" />
        <hemisphereLight args={['#1a1a3a', '#0a0a0a', 0.4]} />

        <CitySign count={buildings.length} />
        <Ground />
        <Roads />
        <Streetlights />

        {buildings.map((b) => (
          <Building key={b.id} data={b} onClick={handleBuildingClick} />
        ))}

        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          maxPolarAngle={Math.PI / 2.2}
          minDistance={8}
          maxDistance={100}
          autoRotate
          autoRotateSpeed={0.2}
        />

        <fog attach="fog" args={['#0a0a1a', 40, 120]} />
      </Canvas>
    </div>
  )
}
