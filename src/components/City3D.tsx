'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Text, useGLTF, useAnimations } from '@react-three/drei'
import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import * as THREE from 'three'
import type { Building as BuildingType } from '@/lib/supabase'
import { satoshisToBtc } from '@/lib/bitcoin'
import { getCharacterFile, CHARACTER_LIST } from '@/lib/characters'

// Height tiers: start at 5, +2 per level
// tier 1=5, 2=7, 3=9, 4=11, 5=13, 6=15, 7=17, 8=19
function tierToHeight(tier: number): number {
  return 3 + tier * 2 // 5,7,9,11,13,15,17,19
}

const BUILDING_WIDTH = 1.4 // compact width (3 windows per side)
const FLOOR_HEIGHT = 0.55 // each visual floor height
const WINDOW_COLS = 3 // 3 windows per side (was 5, reduced to fit between roads)
const CITY_BOUNDARY_RADIUS = 90 // invisible wall radius
const GUARDRAIL_RADIUS = 85 // visible guardrail radius
const ALL_ROAD_RADII = [8, 16, 24, 32, 40, 50, 62, 75]
const SPOKE_COUNT = 12

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

// ==================== STARRY SKY (lightweight) ====================

function StarrySky() {
  const starsRef = useRef<THREE.Points>(null)
  const count = 600

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      // Distribute on a large sphere shell
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(1 - Math.random() * 1.2) // mostly upper hemisphere
      const r = 160 + Math.random() * 40
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 20 // always above horizon
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
    }
    return pos
  }, [])

  const sizes = useMemo(() => {
    const s = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      s[i] = 0.3 + Math.random() * 0.7
    }
    return s
  }, [])

  // Subtle twinkle
  useFrame((state) => {
    if (!starsRef.current) return
    const mat = starsRef.current.material as THREE.PointsMaterial
    mat.opacity = 0.7 + Math.sin(state.clock.elapsedTime * 0.5) * 0.15
  })

  return (
    <points ref={starsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-size" count={count} array={sizes} itemSize={1} />
      </bufferGeometry>
      <pointsMaterial
        color="#ffffff"
        size={0.5}
        transparent
        opacity={0.8}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

// ==================== TIERED CAR STYLES ====================

function getTierCarStyle(tier: number) {
  const styles: Record<number, { body: string; cabin: string; accent: string; name: string }> = {
    1: { body: '#8B7355', cabin: '#555', accent: '#aa9966', name: 'Rusty Buggy' },
    2: { body: '#B87333', cabin: '#444', accent: '#cc9955', name: 'Copper Cruiser' },
    3: { body: '#2E8B57', cabin: '#333', accent: '#3CB371', name: 'Emerald Runner' },
    4: { body: '#4169E1', cabin: '#222', accent: '#5B8DEF', name: 'Blue Streak' },
    5: { body: '#1E90FF', cabin: '#1a1a2a', accent: '#00BFFF', name: 'Plasma Jet' },
    6: { body: '#6A0DAD', cabin: '#111', accent: '#9B30FF', name: 'Neon Phantom' },
    7: { body: '#C0C0C0', cabin: '#0a0a0a', accent: '#E8E8E8', name: 'Chrome Falcon' },
    8: { body: '#FFD700', cabin: '#111', accent: '#FFA500', name: 'Golden Phoenix' },
  }
  return styles[tier] || styles[1]
}

// ==================== VERIFIED AURA (Golden Treasure) ====================

function GoldenSparkles({ height }: { height: number }) {
  const particlesRef = useRef<THREE.Points>(null)
  const count = 15 // reduced from 40 for performance

  const [positions, velocities] = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const vel = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const r = BUILDING_WIDTH * 0.5 + Math.random() * 0.6
      pos[i * 3] = Math.cos(angle) * r
      pos[i * 3 + 1] = Math.random() * height
      pos[i * 3 + 2] = Math.sin(angle) * r
      vel[i * 3] = (Math.random() - 0.5) * 0.01
      vel[i * 3 + 1] = 0.005 + Math.random() * 0.015
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.01
    }
    return [pos, vel]
  }, [height])

  useFrame(() => {
    if (!particlesRef.current) return
    const posAttr = particlesRef.current.geometry.attributes.position as THREE.BufferAttribute
    const arr = posAttr.array as Float32Array
    for (let i = 0; i < count; i++) {
      arr[i * 3] += velocities[i * 3]
      arr[i * 3 + 1] += velocities[i * 3 + 1]
      arr[i * 3 + 2] += velocities[i * 3 + 2]
      if (arr[i * 3 + 1] > height + 2) {
        const angle = Math.random() * Math.PI * 2
        const r = BUILDING_WIDTH * 0.5 + Math.random() * 0.6
        arr[i * 3] = Math.cos(angle) * r
        arr[i * 3 + 1] = 0
        arr[i * 3 + 2] = Math.sin(angle) * r
      }
    }
    posAttr.needsUpdate = true
  })

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#FFD700"
        size={0.15}
        transparent
        opacity={0.9}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}

function VerifiedAura({ height }: { height: number }) {
  const outerRef = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    if (outerRef.current) {
      outerRef.current.rotation.y += 0.005
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 1.5) * 0.06
      outerRef.current.scale.set(pulse, 1, pulse)
    }
  })
  return (
    <>
      {/* Single smooth golden aura cylinder (was 3 meshes + sphere, now 1) */}
      <mesh ref={outerRef} position={[0, height / 2, 0]}>
        <cylinderGeometry args={[BUILDING_WIDTH * 1.05, BUILDING_WIDTH * 0.95, height + 2, 24, 1, true]} />
        <meshStandardMaterial
          color="#FFD700"
          transparent
          opacity={0.1}
          side={THREE.DoubleSide}
          emissive="#FFD700"
          emissiveIntensity={0.8}
          depthWrite={false}
        />
      </mesh>
      {/* Single point light at top only (was 3 lights, now 1) */}
      <pointLight position={[0, height + 1, 0]} intensity={1.5} distance={8} color="#FFD700" />
      {/* Sparkle particles (reduced count) */}
      <GoldenSparkles height={height} />
      {/* Ground glow ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[BUILDING_WIDTH * 0.3, BUILDING_WIDTH * 1.3, 24]} />
        <meshStandardMaterial
          color="#FFD700"
          transparent
          opacity={0.2}
          emissive="#FFD700"
          emissiveIntensity={1.0}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </>
  )
}

function ModernWindows({ height, tier }: { height: number; tier: number }) {
  const style = getTierStyle(tier)
  const totalFloors = Math.floor(height / FLOOR_HEIGHT)
  const maxWindows = 40 // max window rows to render for performance
  const displayFloors = Math.min(totalFloors, 50)
  const w = BUILDING_WIDTH
  const windowW = 0.22
  const windowH = 0.32
  const spacing = w / (WINDOW_COLS + 1)
  const offset = 0.02 // offset from building surface to avoid z-fighting

  const windowGeom = useMemo(() => new THREE.PlaneGeometry(windowW, windowH), [])
  const windowMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: style.glass,
        emissive: style.emissive,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
    [style]
  )

  const instances = useMemo(() => {
    const arr: { pos: [number, number, number]; rot: [number, number, number] }[] = []
    // Evenly distribute window rows across building height
    const step = displayFloors > maxWindows ? displayFloors / maxWindows : 1
    for (let i = 0; i < Math.min(displayFloors - 1, maxWindows); i++) {
      const f = Math.floor(1 + i * step)
      const y = f * FLOOR_HEIGHT + 0.15
      for (let c = 0; c < WINDOW_COLS; c++) {
        const off = spacing * (c + 1) - w / 2
        arr.push({ pos: [off, y, w / 2 + offset], rot: [0, 0, 0] })
        arr.push({ pos: [off, y, -(w / 2 + offset)], rot: [0, Math.PI, 0] })
        arr.push({ pos: [-(w / 2 + offset), y, off], rot: [0, -Math.PI / 2, 0] })
        arr.push({ pos: [w / 2 + offset, y, off], rot: [0, Math.PI / 2, 0] })
      }
    }
    return arr
  }, [displayFloors, spacing, w, offset])

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
          <meshStandardMaterial color="#000000" transparent opacity={0.15} />
        </mesh>
      ))}
    </>
  )
}

const LOD_DISTANCE = 30 // effects only render within this distance from camera

// 3D Character model displayed in front of each building
// NOTE: GLB models have internal scale of 100, so we use 0.005 to normalize to ~0.5 units tall
const CHARACTER_SCALE_BASE = 0.005
function CharacterModel({ characterId, scale = 1.0 }: { characterId: string; scale?: number }) {
  const filePath = getCharacterFile(characterId)
  const { scene } = useGLTF(filePath)
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((child: any) => {
      if (child.isMesh && child.material) {
        // Clone material so each instance is independent
        const mat = child.material.clone()
        // Brighten base color (models are very dark in linear space)
        if (mat.color) {
          mat.color.multiplyScalar(2.5)
        }
        // Add emissive so characters are visible in the dark city scene
        mat.emissive = new THREE.Color(0x444444)
        mat.emissiveIntensity = 0.5
        mat.needsUpdate = true
        child.material = mat
        child.castShadow = true
        child.receiveShadow = true
      }
    })
    return clone
  }, [scene])

  return (
    <primitive
      object={clonedScene}
      scale={CHARACTER_SCALE_BASE * scale}
      rotation={[0, Math.PI, 0]}
    />
  )
}

function Building({ data, onClick }: { data: BuildingType; onClick: (b: BuildingType) => void }) {
  const isAdmin = data.is_admin || false
  const tier = isAdmin ? 8 : (data.height || 1) // Admin always max tier (gold)
  const height = tierToHeight(tier)
  const x = data.position_x || 0
  const z = data.position_z || 0
  const verified = data.verified || isAdmin // Admin always shows as verified
  const style = getTierStyle(tier)
  const bodyColor = isAdmin ? '#8B7500' : (data.color || style.body) // Admin = gold body
  const [hovered, setHovered] = useState(false)
  const [isNear, setIsNear] = useState(false)
  const groupRef = useRef<THREE.Group>(null)
  const frameCounter = useRef(0)
  const w = BUILDING_WIDTH

  // Check distance from camera every few frames for LOD
  useFrame(({ camera }) => {
    if (!groupRef.current) return
    // Check every 15 frames to save CPU
    frameCounter.current++
    if (frameCounter.current % 15 !== 0 && !isNear) return
    const dx = camera.position.x - x
    const dz = camera.position.z - z
    const dist = Math.sqrt(dx * dx + dz * dz)
    const near = dist < LOD_DISTANCE
    if (near !== isNear) setIsNear(near)
  })

  return (
    <group ref={groupRef} position={[x, 0, z]}>
      {/* Verified golden aura - only when camera is near */}
      {verified && isNear && <VerifiedAura height={height} />}

      {/* Foundation */}
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <boxGeometry args={[w + 0.3, 0.16, w + 0.3]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>

      {/* Main body */}
      <mesh
        position={[0, height / 2 + 0.16, 0]}
                      onClick={(e) => { e.stopPropagation(); onClick(data) }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[w, height, w]} />
        <meshStandardMaterial
          color={hovered ? '#aabbcc' : bodyColor}
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

      {/* Character model in front of building */}
      {data.character && isNear && (
        <group position={[0, 0.16, w / 2 + 0.8]}>
          <CharacterModel characterId={data.character} scale={1.4} />
        </group>
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
        {isAdmin ? '\u2605 ' : verified ? '\u2713 ' : ''}{data.display_name || data.username || 'Anon'}
      </Text>
    </group>
  )
}

function BuildingPopup({ building, onClose }: { building: BuildingType; onClose: () => void }) {
  const btc = satoshisToBtc(building.balance_satoshis)
  const btcLabel = btc >= 0.001 ? `${btc.toFixed(8)} BTC` : `${building.balance_satoshis.toLocaleString()} sats`
  const verified = building.verified || false
  const isAdmin = building.is_admin || false
  const message = building.message || ''
  const characterName = building.character ? CHARACTER_LIST.find(c => c.id === building.character)?.name || 'Unknown' : 'None'

  return (
    <div
      className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-gray-900/95 backdrop-blur-md border border-gray-700 rounded-xl p-5 max-w-sm w-full mx-4 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <button onClick={onClose} className="absolute top-3 right-3 text-gray-500 hover:text-white text-xl">&times;</button>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-lg font-bold text-white">{building.display_name || building.username}</h3>
        {isAdmin && (
          <span className="bg-orange-500/20 text-orange-400 text-xs px-2 py-0.5 rounded-full border border-orange-500/50 font-semibold">
            ADMIN
          </span>
        )}
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
        <div>
          <span className="text-gray-500">Character</span>
          <p className="text-gray-300">{characterName}</p>
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
      {/* Main ground - dark grass */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <circleGeometry args={[120, 64]} />
        <meshStandardMaterial color="#1a2e1a" />
      </mesh>
    </>
  )
}

// (Ramps removed)

// ==================== GUARDRAILS ====================

function Guardrails() {
  const segments = 48
  const posts = useMemo(() => {
    const arr: { x: number; z: number; angle: number }[] = []
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2
      arr.push({
        x: Math.cos(angle) * GUARDRAIL_RADIUS,
        z: Math.sin(angle) * GUARDRAIL_RADIUS,
        angle,
      })
    }
    return arr
  }, [])

  return (
    <group>
      {/* Guardrail ring (continuous wall) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.3, 0]}>
        <ringGeometry args={[GUARDRAIL_RADIUS - 0.15, GUARDRAIL_RADIUS + 0.15, 64]} />
        <meshStandardMaterial color="#444" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.6, 0]}>
        <ringGeometry args={[GUARDRAIL_RADIUS - 0.1, GUARDRAIL_RADIUS + 0.1, 64]} />
        <meshStandardMaterial color="#666" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Vertical posts */}
      {posts.map((post, i) => (
        <mesh key={`post-${i}`} position={[post.x, 0.4, post.z]}>
          <boxGeometry args={[0.12, 0.8, 0.12]} />
          <meshStandardMaterial color="#555" metalness={0.5} />
        </mesh>
      ))}
      {/* Reflective strips (orange BTC themed) */}
      {posts.filter((_, i) => i % 3 === 0).map((post, i) => (
        <mesh key={`refl-${i}`} position={[post.x, 0.6, post.z]}>
          <boxGeometry args={[0.15, 0.08, 0.15]} />
          <meshStandardMaterial color="#f7931a" emissive="#f7931a" emissiveIntensity={0.5} />
        </mesh>
      ))}
    </group>
  )
}

// ==================== CAR WITH NITRO ====================

function NitroFlame({ active }: { active: boolean }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(() => {
    if (!ref.current) return
    ref.current.visible = active
    if (active) {
      const flicker = 0.8 + Math.random() * 0.4
      ref.current.scale.set(flicker, flicker + Math.random() * 0.5, flicker)
    }
  })

  return (
    <group ref={ref} visible={false}>
      {/* Blue core flames - pointing backward (rotated so cone tip faces -Z) */}
      <mesh position={[-0.08, 0, -0.6]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.06, 0.5, 6]} />
        <meshStandardMaterial
          color="#0066ff"
          emissive="#0088ff"
          emissiveIntensity={3}
          transparent
          opacity={0.9}
        />
      </mesh>
      <mesh position={[0.08, 0, -0.6]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.06, 0.5, 6]} />
        <meshStandardMaterial
          color="#0066ff"
          emissive="#0088ff"
          emissiveIntensity={3}
          transparent
          opacity={0.9}
        />
      </mesh>
      {/* Orange outer flames - pointing backward */}
      <mesh position={[-0.08, 0, -0.8]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.1, 0.6, 6]} />
        <meshStandardMaterial
          color="#ff6600"
          emissive="#ff4400"
          emissiveIntensity={2}
          transparent
          opacity={0.6}
        />
      </mesh>
      <mesh position={[0.08, 0, -0.8]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.1, 0.6, 6]} />
        <meshStandardMaterial
          color="#ff6600"
          emissive="#ff4400"
          emissiveIntensity={2}
          transparent
          opacity={0.6}
        />
      </mesh>
      {/* Glow light behind */}
      <pointLight position={[0, 0, -0.9]} intensity={2} distance={4} color="#4488ff" />
    </group>
  )
}

// ==================== TIERED CAR BODY ====================

function TieredCarBody({ tier }: { tier: number }) {
  const style = getTierCarStyle(tier)
  const scale = 0.9 + tier * 0.05 // slightly bigger for higher tiers

  return (
    <group scale={[scale, scale, scale]}>
      {/* Main body */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.45, 0.14, 0.9]} />
        <meshStandardMaterial color={style.body} metalness={tier >= 5 ? 0.9 : 0.6} roughness={tier >= 5 ? 0.1 : 0.3} />
      </mesh>
      {/* Hood - sleeker for higher tiers */}
      <mesh position={[0, 0.02, 0.35]}>
        <boxGeometry args={[tier >= 5 ? 0.38 : 0.4, 0.08, tier >= 5 ? 0.3 : 0.25]} />
        <meshStandardMaterial color={style.body} metalness={tier >= 5 ? 0.9 : 0.6} roughness={0.2} />
      </mesh>
      {/* Cabin */}
      <mesh position={[0, 0.12, -0.05]}>
        <boxGeometry args={[tier >= 6 ? 0.34 : 0.38, 0.12, 0.35]} />
        <meshStandardMaterial color={style.cabin} metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Spoiler for tier 5+ */}
      {tier >= 5 && (
        <mesh position={[0, 0.16, -0.4]}>
          <boxGeometry args={[0.42, 0.02, 0.12]} />
          <meshStandardMaterial color={style.accent} metalness={0.8} />
        </mesh>
      )}
      {/* Side skirts for tier 4+ */}
      {tier >= 4 && (
        <>
          <mesh position={[-0.24, -0.04, 0]}>
            <boxGeometry args={[0.03, 0.06, 0.7]} />
            <meshStandardMaterial color={style.accent} metalness={0.7} />
          </mesh>
          <mesh position={[0.24, -0.04, 0]}>
            <boxGeometry args={[0.03, 0.06, 0.7]} />
            <meshStandardMaterial color={style.accent} metalness={0.7} />
          </mesh>
        </>
      )}
      {/* Accent stripe for tier 3+ */}
      {tier >= 3 && (
        <mesh position={[0, 0.08, 0]}>
          <boxGeometry args={[0.46, 0.01, 0.92]} />
          <meshStandardMaterial color={style.accent} emissive={style.accent} emissiveIntensity={0.3} />
        </mesh>
      )}
      {/* Wheels with jets */}
      {([[-0.24, -0.12, 0.3], [0.24, -0.12, 0.3], [-0.24, -0.12, -0.3], [0.24, -0.12, -0.3]] as [number, number, number][]).map((wpos, i) => (
        <group key={i} position={wpos}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.055, 0.055, 0.04]} />
            <meshStandardMaterial color="#222" metalness={0.6} />
          </mesh>
          <mesh position={[0, -0.08, 0]}>
            <coneGeometry args={[0.04, 0.15, 8]} />
            <meshStandardMaterial color={tier >= 6 ? '#ff4400' : '#0088ff'} emissive={tier >= 6 ? '#ff2200' : '#0066ff'} emissiveIntensity={2} transparent opacity={0.7} />
          </mesh>
        </group>
      ))}
      <pointLight position={[0, -0.2, 0]} intensity={1.0} distance={3} color={tier >= 6 ? '#ff4422' : '#4488ff'} />
      {/* Headlights */}
      <mesh position={[-0.13, 0, 0.46]}>
        <sphereGeometry args={[0.03]} />
        <meshStandardMaterial emissive={tier >= 7 ? '#ffdd00' : 'white'} emissiveIntensity={2} />
      </mesh>
      <mesh position={[0.13, 0, 0.46]}>
        <sphereGeometry args={[0.03]} />
        <meshStandardMaterial emissive={tier >= 7 ? '#ffdd00' : 'white'} emissiveIntensity={2} />
      </mesh>
      {/* Taillights */}
      <mesh position={[-0.16, 0, -0.46]}>
        <sphereGeometry args={[0.025]} />
        <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[0.16, 0, -0.46]}>
        <sphereGeometry args={[0.025]} />
        <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={1.5} />
      </mesh>
      {/* Tier 8 golden glow */}
      {tier >= 8 && (
        <pointLight position={[0, 0.3, 0]} intensity={1.5} distance={4} color="#FFD700" />
      )}
    </group>
  )
}

// ==================== WALKING CHARACTER ====================

function Character({ walking, running, moveSpeed = 0 }: { walking: boolean; running: boolean; moveSpeed?: number }) {
  const groupRef = useRef<THREE.Group>(null)
  const { scene: glbScene, animations } = useGLTF('/models/satoshi.glb')
  const { actions } = useAnimations(animations, groupRef)
  const currentAction = useRef<string>('')

  // Clone model for independent instances
  const model = useMemo(() => {
    const clone = glbScene.clone(true)
    clone.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        mesh.castShadow = true
        mesh.receiveShadow = true
        // Brighten dark materials so character is visible in the dark city
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          mats.forEach(mat => {
            if (mat instanceof THREE.MeshStandardMaterial) {
              // Add subtle emissive so character doesn't disappear in dark scene
              const lum = mat.color.r * 0.299 + mat.color.g * 0.587 + mat.color.b * 0.114
              if (lum < 0.1) {
                mat.emissive = new THREE.Color(0x222222)
                mat.emissiveIntensity = 0.3
              }
              // Boost metallic look
              mat.metalness = Math.max(mat.metalness, 0.15)
            }
          })
        }
      }
    })
    return clone
  }, [glbScene])

  // Switch animations based on state
  useEffect(() => {
    let targetAnim = 'CharacterArmature|Idle'
    if (running) targetAnim = 'CharacterArmature|Run'
    else if (walking) targetAnim = 'CharacterArmature|Walk'

    if (currentAction.current === targetAnim) return
    currentAction.current = targetAnim

    // Fade out all, fade in target
    Object.values(actions).forEach(action => {
      if (action) action.fadeOut(0.3)
    })
    const next = actions[targetAnim]
    if (next) {
      next.reset().fadeIn(0.3).play()
    }
  }, [walking, running, actions])

  // Start idle animation on mount
  useEffect(() => {
    const idle = actions['CharacterArmature|Idle']
    if (idle) {
      idle.reset().play()
      currentAction.current = 'CharacterArmature|Idle'
    }
  }, [actions])

  return (
    <group ref={groupRef} scale={[0.005, 0.005, 0.005]}>
      <primitive object={model} />
    </group>
  )
}

// ==================== WALKER (Walking Mode) ====================

function Walker({ active, driverName, onPositionUpdate }: { active: boolean; driverName?: string; onPositionUpdate?: (x: number, y: number, z: number, rot: number, mode: string) => void }) {
  const walkerRef = useRef<THREE.Group>(null)
  const posRef = useRef<[number, number, number]>([0, 0.25, 8])
  const playerRotRef = useRef(0) // player facing direction
  const cameraAngle = useRef(0) // horizontal orbit angle around player
  const cameraPitch = useRef(0.3) // vertical angle (0 = level, positive = looking down)
  const keys = useRef<Set<string>>(new Set())
  const broadcastTimer = useRef(0)
  const isDragging = useRef(false)
  const lastMouseX = useRef(0)
  const lastMouseY = useRef(0)
  const actualSpeed = useRef(0)
  const [isWalking, setIsWalking] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [moveSpeedState, setMoveSpeedState] = useState(0)

  useEffect(() => {
    if (!active) {
      keys.current.clear()
      actualSpeed.current = 0
      isDragging.current = false
      return
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      keys.current.add(key)
      if (key === ' ') e.preventDefault()
    }
    const handleKeyUp = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase())

    // Mouse drag to orbit camera (GTA style)
    const handleMouseDown = (e: MouseEvent) => {
      isDragging.current = true
      lastMouseX.current = e.clientX
      lastMouseY.current = e.clientY
    }
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const dx = e.clientX - lastMouseX.current
      const dy = e.clientY - lastMouseY.current
      cameraAngle.current -= dx * 0.005
      cameraPitch.current = Math.max(0.05, Math.min(1.2, cameraPitch.current + dy * 0.003))
      lastMouseX.current = e.clientX
      lastMouseY.current = e.clientY
    }
    const handleMouseUp = () => { isDragging.current = false }

    // Touch drag for mobile camera orbit
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging.current = true
        lastMouseX.current = e.touches[0].clientX
        lastMouseY.current = e.touches[0].clientY
      }
    }
    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current || e.touches.length !== 1) return
      const dx = e.touches[0].clientX - lastMouseX.current
      const dy = e.touches[0].clientY - lastMouseY.current
      cameraAngle.current -= dx * 0.005
      cameraPitch.current = Math.max(0.05, Math.min(1.2, cameraPitch.current + dy * 0.003))
      lastMouseX.current = e.touches[0].clientX
      lastMouseY.current = e.touches[0].clientY
    }
    const handleTouchEnd = () => { isDragging.current = false }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
      keys.current.clear()
    }
  }, [active])

  useFrame((state, delta) => {
    if (!active || !walkerRef.current) return
    const k = keys.current
    const dt = Math.min(delta, 0.05)

    const running = k.has(' ')
    const maxSpeed = running ? 0.25 : 0.12
    const accel = running ? 0.015 : 0.008

    // Movement direction relative to camera angle
    // W = forward from camera's perspective, S = back, A = strafe left, D = strafe right
    let moveX = 0
    let moveZ = 0
    const camAngle = cameraAngle.current

    if (k.has('w') || k.has('arrowup')) {
      moveX += Math.sin(camAngle)
      moveZ += Math.cos(camAngle)
    }
    if (k.has('s') || k.has('arrowdown')) {
      moveX -= Math.sin(camAngle)
      moveZ -= Math.cos(camAngle)
    }
    if (k.has('a') || k.has('arrowleft')) {
      moveX += Math.cos(camAngle)
      moveZ -= Math.sin(camAngle)
    }
    if (k.has('d') || k.has('arrowright')) {
      moveX -= Math.cos(camAngle)
      moveZ += Math.sin(camAngle)
    }

    // Normalize movement direction
    const moveMag = Math.sqrt(moveX * moveX + moveZ * moveZ)
    const isMoving = moveMag > 0.01

    if (isMoving) {
      moveX /= moveMag
      moveZ /= moveMag
      actualSpeed.current = Math.min(actualSpeed.current + accel, maxSpeed)

      // Player faces movement direction (smooth rotation)
      const targetRot = Math.atan2(moveX, moveZ)
      let rotDiff = targetRot - playerRotRef.current
      if (rotDiff > Math.PI) rotDiff -= Math.PI * 2
      if (rotDiff < -Math.PI) rotDiff += Math.PI * 2
      playerRotRef.current += rotDiff * 0.15 // smooth turn
    } else {
      actualSpeed.current *= 0.8
    }

    let newX = posRef.current[0] + moveX * actualSpeed.current
    const newY = 0.25
    let newZ = posRef.current[2] + moveZ * actualSpeed.current

    // Boundary
    const dist = Math.sqrt(newX * newX + newZ * newZ)
    if (dist > CITY_BOUNDARY_RADIUS) {
      const f = CITY_BOUNDARY_RADIUS / dist
      newX *= f
      newZ *= f
      actualSpeed.current *= 0.5
    }

    posRef.current = [newX, newY, newZ]
    walkerRef.current.position.set(newX, newY, newZ)
    walkerRef.current.rotation.y = playerRotRef.current

    const walking = actualSpeed.current > 0.008
    setIsWalking(walking)
    setIsRunning(walking && running)
    setMoveSpeedState(actualSpeed.current)

    // GTA-style camera: orbits around player
    const camDist = 2.5
    const camHeight = newY + 0.8 + Math.sin(cameraPitch.current) * 2.0
    const camHDist = camDist * Math.cos(cameraPitch.current * 0.7)
    const targetCam = new THREE.Vector3(
      newX - Math.sin(cameraAngle.current) * camHDist,
      camHeight,
      newZ - Math.cos(cameraAngle.current) * camHDist
    )
    state.camera.position.lerp(targetCam, 0.1)
    state.camera.lookAt(newX, newY + 0.5, newZ)

    // Broadcast
    broadcastTimer.current += dt
    if (broadcastTimer.current > 0.05) {
      broadcastTimer.current = 0
      onPositionUpdate?.(newX, newY, newZ, playerRotRef.current, 'walking')
    }
  })

  if (!active) return null

  return (
    <group ref={walkerRef} position={[0, 0.25, 8]}>
      <Character walking={isWalking} running={isRunning} moveSpeed={moveSpeedState} />
      {driverName && (
        <Text
          position={[0, 1.15, 0]}
          fontSize={0.12}
          color="#00ff88"
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {driverName}
        </Text>
      )}
    </group>
  )
}

// ==================== GHOST CARS (OTHER PLAYERS) ====================

type GhostCarData = {
  id: string
  name: string
  x: number
  y: number
  z: number
  rot: number
  nitro: boolean
  mode: 'flying' | 'walking'
  tier: number
}

function GhostCar({ data, myCarPos }: { data: GhostCarData; myCarPos: React.MutableRefObject<[number, number, number]> }) {
  const ref = useRef<THREE.Group>(null)
  const targetPos = useRef(new THREE.Vector3(data.x, data.y, data.z))
  const targetRot = useRef(data.rot)
  const bumpVelocity = useRef(new THREE.Vector3(0, 0, 0))
  const bumpCooldown = useRef(0)

  useEffect(() => {
    targetPos.current.set(data.x, data.y, data.z)
    targetRot.current = data.rot
  }, [data.x, data.y, data.z, data.rot])

  useFrame((_, delta) => {
    if (!ref.current) return
    const dt = Math.min(delta, 0.05)

    // Check collision with my car
    const myX = myCarPos.current[0]
    const myZ = myCarPos.current[2]
    const dx = ref.current.position.x - myX
    const dz = ref.current.position.z - myZ
    const dist = Math.sqrt(dx * dx + dz * dz)

    if (dist < 1.2 && dist > 0.01 && bumpCooldown.current <= 0) {
      // BUMP! Ghost car pushed forward horizontally (no upward launch)
      const force = 0.5
      bumpVelocity.current.set(
        (dx / dist) * force,
        0, // NO upward launch - horizontal only
        (dz / dist) * force
      )
      bumpCooldown.current = 1.0 // 1s cooldown between bumps
      // Small spin
      targetRot.current += Math.PI * 0.5
    }

    bumpCooldown.current = Math.max(0, bumpCooldown.current - dt)

    // Apply bump physics (horizontal only)
    if (bumpVelocity.current.length() > 0.001) {
      ref.current.position.x += bumpVelocity.current.x
      ref.current.position.z += bumpVelocity.current.z
      // Friction on XZ - decays quickly
      bumpVelocity.current.x *= 0.9
      bumpVelocity.current.z *= 0.9
      if (bumpVelocity.current.length() < 0.005) {
        bumpVelocity.current.set(0, 0, 0)
      }
      ref.current.position.y = data.y
    } else {
      // Smooth interpolation to target position - faster lerp for less "slow motion"
      ref.current.position.lerp(targetPos.current, 0.35)
    }
    // Smooth rotation
    const diff = targetRot.current - ref.current.rotation.y
    ref.current.rotation.y += diff * 0.3
  })

  // Detect if this ghost is walking based on stored walking state
  const ghostWalking = useRef(false)
  const prevY = useRef(data.y)
  useEffect(() => {
    ghostWalking.current = Math.abs(data.y - prevY.current) > 0.01
    prevY.current = data.y
  }, [data.y])

  if (data.mode === 'walking') {
    return (
      <group ref={ref} position={[data.x, data.y, data.z]} rotation={[0, data.rot, 0]}>
        <Character walking={true} running={false} />
        <Text
          position={[0, 1.15, 0]}
          fontSize={0.12}
          color="#00ff88"
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {data.name}
        </Text>
      </group>
    )
  }

  return (
    <group ref={ref} position={[data.x, data.y, data.z]} rotation={[0, data.rot, 0]}>
      <TieredCarBody tier={data.tier || 1} />
      {/* Nitro rear flame for ghost */}
      {data.nitro && (
        <group>
          <mesh position={[0, 0, -0.6]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.08, 0.4, 6]} />
            <meshStandardMaterial color="#0066ff" emissive="#0088ff" emissiveIntensity={3} transparent opacity={0.8} />
          </mesh>
        </group>
      )}
      {/* Name above ghost car */}
      <Text
        position={[0, 0.45, 0]}
        fontSize={0.15}
        color="#ffcc00"
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {data.name}
      </Text>
    </group>
  )
}

function GhostCars({ ghosts, myCarPos }: { ghosts: GhostCarData[]; myCarPos: React.MutableRefObject<[number, number, number]> }) {
  return (
    <>
      {ghosts.map((g) => (
        <GhostCar key={g.id} data={g} myCarPos={myCarPos} />
      ))}
    </>
  )
}

// ==================== CAR WITH NITRO ====================

function Car({ active, driverName, userTier, ghostCarsRef, onNitroUpdate, onPositionUpdate }: { active: boolean; driverName?: string; userTier?: number; ghostCarsRef?: React.MutableRefObject<GhostCarData[]>; onNitroUpdate?: (charges: number, recharging: boolean) => void; onPositionUpdate?: (x: number, y: number, z: number, rot: number, nitro: boolean) => void }) {
  const carRef = useRef<THREE.Group>(null)
  const posRef = useRef<[number, number, number]>([0, 5, 8])
  const rotRef = useRef(0)
  const speed = useRef(0)
  const verticalSpeed = useRef(0)
  const keys = useRef<Set<string>>(new Set())
  const broadcastTimer = useRef(0)

  // Nitro state
  const nitroCharges = useRef(2)
  const nitroActive = useRef(false)
  const nitroTimer = useRef(0)
  const nitroRechargeTimer = useRef(0)
  const nitroRecharging = useRef(false)
  const [nitroFlameActive, setNitroFlameActive] = useState(false)

  // Mobile touch state
  const touchActive = useRef(false)
  const touchStartX = useRef(0)
  const touchSteerAmount = useRef(0)

  const activateNitro = useCallback(() => {
    if (nitroCharges.current > 0 && !nitroActive.current) {
      nitroCharges.current -= 1
      nitroActive.current = true
      nitroTimer.current = 1.5
      setNitroFlameActive(true)
      if (!nitroRecharging.current) {
        nitroRecharging.current = true
        nitroRechargeTimer.current = 10.0
      }
      onNitroUpdate?.(nitroCharges.current, true)
    }
  }, [onNitroUpdate])

  useEffect(() => {
    if (!active) {
      keys.current.clear()
      speed.current = 0
      verticalSpeed.current = 0
      touchActive.current = false
      touchSteerAmount.current = 0
      return
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      keys.current.add(key)
      if (key === ' ') { e.preventDefault(); activateNitro() }
    }
    const handleKeyUp = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase())

    // Mobile touch handlers
    const handleTouchStart = (e: TouchEvent) => {
      if (!active) return
      const touch = e.touches[0]
      touchActive.current = true
      touchStartX.current = touch.clientX
      touchSteerAmount.current = 0
    }
    const handleTouchMove = (e: TouchEvent) => {
      if (!touchActive.current) return
      e.preventDefault()
      const touch = e.touches[0]
      const screenW = window.innerWidth
      const dx = touch.clientX - touchStartX.current
      touchSteerAmount.current = Math.max(-1, Math.min(1, dx / (screenW * 0.2)))
    }
    const handleTouchEnd = () => {
      touchActive.current = false
      touchSteerAmount.current = 0
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
      keys.current.clear()
    }
  }, [active, activateNitro])

  useFrame((state, delta) => {
    if (!active || !carRef.current) return
    const k = keys.current
    const dt = Math.min(delta, 0.05)

    // Nitro timer
    if (nitroActive.current) {
      nitroTimer.current -= dt
      if (nitroTimer.current <= 0) {
        nitroActive.current = false
        nitroTimer.current = 0
        setNitroFlameActive(false)
      }
    }

    // Nitro recharge
    if (nitroRecharging.current) {
      nitroRechargeTimer.current -= dt
      if (nitroRechargeTimer.current <= 0) {
        nitroCharges.current = 2
        nitroRecharging.current = false
        nitroRechargeTimer.current = 0
        onNitroUpdate?.(2, false)
      }
    }

    const maxSpeed = nitroActive.current ? 1.5 : 0.2
    const accel = nitroActive.current ? 0.02 : 0.003

    // Forward/back: Shift/W = forward, S = reverse
    const wantForward = k.has('shift') || k.has('w') || touchActive.current
    const wantReverse = k.has('s')

    if (wantForward) speed.current = Math.min(speed.current + accel, maxSpeed)
    else if (wantReverse) speed.current = Math.max(speed.current - 0.003, -0.1)
    else speed.current *= 0.95

    // Steering: A/D or Left/Right arrows
    if (Math.abs(speed.current) > 0.001) {
      const steerSpeed = nitroActive.current ? 0.02 : 0.03
      if (k.has('a') || k.has('arrowleft')) rotRef.current += steerSpeed
      if (k.has('d') || k.has('arrowright')) rotRef.current -= steerSpeed
      if (touchActive.current && Math.abs(touchSteerAmount.current) > 0.05) {
        rotRef.current -= touchSteerAmount.current * steerSpeed * 1.5
      }
    }

    // Altitude control: Arrow Up/Down or Q/E
    const wantUp = k.has('arrowup') || k.has('q')
    const wantDown = k.has('arrowdown') || k.has('e')
    if (wantUp) verticalSpeed.current = Math.min(verticalSpeed.current + 0.003, 0.12)
    else if (wantDown) verticalSpeed.current = Math.max(verticalSpeed.current - 0.003, -0.12)
    else verticalSpeed.current *= 0.9

    let newX = posRef.current[0] + Math.sin(rotRef.current) * speed.current
    let newY = posRef.current[1] + verticalSpeed.current
    let newZ = posRef.current[2] + Math.cos(rotRef.current) * speed.current

    // Clamp altitude
    newY = Math.max(2, Math.min(25, newY))

    // City boundary clamp
    const distFromCenter = Math.sqrt(newX * newX + newZ * newZ)
    if (distFromCenter > CITY_BOUNDARY_RADIUS) {
      const clampFactor = CITY_BOUNDARY_RADIUS / distFromCenter
      newX *= clampFactor
      newZ *= clampFactor
      speed.current *= 0.5
    }

    posRef.current = [newX, newY, newZ]

    carRef.current.position.set(newX, newY, newZ)
    carRef.current.rotation.y = rotRef.current

    // Airplane-style tilt
    // Pitch: nose down when accelerating, nose up when reversing/climbing
    const pitchFromSpeed = -speed.current * 1.5 // forward = nose dips
    const pitchFromVertical = -verticalSpeed.current * 4 // climbing = nose up, descending = nose down
    carRef.current.rotation.x = pitchFromSpeed + pitchFromVertical

    // Roll: bank when steering (check current steer input)
    const steerInput = (k.has('a') || k.has('arrowleft') ? 1 : 0) - (k.has('d') || k.has('arrowright') ? 1 : 0)
    const touchSteer = touchActive.current ? -touchSteerAmount.current : 0
    const targetRoll = (steerInput + touchSteer) * 0.4
    carRef.current.rotation.z += (targetRoll - carRef.current.rotation.z) * 0.1 // smooth lerp

    // Camera follows behind and above
    const camDist = nitroActive.current ? 7 : 5
    const camHeight = newY + (nitroActive.current ? 3 : 2)
    const targetCamPos = new THREE.Vector3(
      newX - Math.sin(rotRef.current) * camDist,
      camHeight,
      newZ - Math.cos(rotRef.current) * camDist
    )
    state.camera.position.lerp(targetCamPos, nitroActive.current ? 0.08 : 0.05)
    state.camera.lookAt(newX, newY, newZ)

    // Broadcast position
    broadcastTimer.current += dt
    if (broadcastTimer.current > 0.05) {
      broadcastTimer.current = 0
      onPositionUpdate?.(newX, newY, newZ, rotRef.current, nitroActive.current)
    }
  })

  if (!active) return null

  return (
    <group ref={carRef} position={[0, 5, 8]}>
      <TieredCarBody tier={userTier || 1} />

      {/* Nitro rear flames (when boosting) */}
      <NitroFlame active={nitroFlameActive} />

      {/* Driver name above car */}
      {driverName && (
        <Text
          position={[0, 0.5, 0]}
          fontSize={0.15}
          color="#f7931a"
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {driverName}
        </Text>
      )}
    </group>
  )
}

function Roads() {
  const roadMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1e1e2a' }), [])
  const laneMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#444455' }), [])

  return (
    <group>
      {/* Circular roads - all rings */}
      {ALL_ROAD_RADII.map((radius) => (
        <group key={radius}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
            <ringGeometry args={[radius - 0.6, radius + 0.6, 48]} />
            <primitive object={roadMat} attach="material" />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
            <ringGeometry args={[radius - 0.04, radius + 0.04, 48]} />
            <primitive object={laneMat} attach="material" />
          </mesh>
        </group>
      ))}
      {/* Radial spokes removed - only circular roads remain */}
    </group>
  )
}

// ==================== STREET LIGHT POLES ====================

function Streetlights() {
  // Shared geometries and materials for performance
  const poleGeo = useMemo(() => new THREE.CylinderGeometry(0.03, 0.05, 3.0), [])
  const armGeo = useMemo(() => new THREE.CylinderGeometry(0.02, 0.02, 0.7), [])
  const fixtureGeo = useMemo(() => new THREE.BoxGeometry(0.12, 0.04, 0.2), [])
  const poleMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#555', metalness: 0.7, roughness: 0.3 }), [])
  const fixtureMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffcc', emissive: new THREE.Color('#ffffaa'), emissiveIntensity: 1.5 }), [])

  const positions = useMemo(() => {
    const arr: [number, number][] = []
    // Only place poles along spokes (16 spokes x 3 per spoke = 48 poles, NO pointLights)
    const radii = [10, 25, 42]
    for (let s = 0; s < 16; s++) {
      const angle = (s / 16) * Math.PI * 2
      for (const r of radii) {
        arr.push([Math.cos(angle) * r, Math.sin(angle) * r])
      }
    }
    return arr
  }, [])

  return (
    <>
      {positions.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh geometry={poleGeo} material={poleMat} position={[0, 1.5, 0]} />
          <mesh geometry={armGeo} material={poleMat} position={[0, 2.9, -0.3]} rotation={[0.3, 0, 0]} />
          <mesh geometry={fixtureGeo} material={fixtureMat} position={[0, 2.85, -0.55]} />
        </group>
      ))}
    </>
  )
}

// ==================== FLYING CARS (Hover around the city) ====================

type FlyingCarConfig = {
  speed: number
  flyHeight: number
  color: string
  startX: number
  startZ: number
  startAngle: number
}

function FlyingCar({ config, index, onClickCar, positionsRef }: { config: FlyingCarConfig; index: number; onClickCar?: (idx: number) => void; positionsRef?: React.MutableRefObject<{ x: number; y: number; z: number; rot: number }[]> }) {
  const ref = useRef<THREE.Group>(null)
  const bannerRef = useRef<THREE.Mesh>(null)

  // Free-roam state
  const pos = useRef(new THREE.Vector3(config.startX, config.flyHeight, config.startZ))
  const target = useRef(new THREE.Vector3())
  const rotY = useRef(config.startAngle)
  const targetRotY = useRef(config.startAngle)
  const bobOffset = useRef(Math.random() * Math.PI * 2)

  // Pick a new random target within the city
  const pickTarget = useCallback(() => {
    const angle = Math.random() * Math.PI * 2
    const r = 5 + Math.random() * 75 // full city radius
    const h = 3 + Math.random() * 15 // fly between 3 and 18 height
    target.current.set(Math.cos(angle) * r, h, Math.sin(angle) * r)
  }, [])

  // Initial target
  useMemo(() => pickTarget(), [pickTarget])

  useFrame((state, delta) => {
    if (!ref.current) return
    const dt = Math.min(delta, 0.05)

    // Move toward target
    const dx = target.current.x - pos.current.x
    const dy = target.current.y - pos.current.y
    const dz = target.current.z - pos.current.z
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

    if (dist < 2) {
      pickTarget()
    } else {
      const step = config.speed * dt
      pos.current.x += (dx / dist) * step
      pos.current.y += (dy / dist) * step
      pos.current.z += (dz / dist) * step
    }

    // Gentle bobbing
    const bob = Math.sin(state.clock.elapsedTime * 1.5 + bobOffset.current) * 0.15

    ref.current.position.set(pos.current.x, pos.current.y + bob, pos.current.z)

    // Face movement direction (horizontal only)
    const desiredRot = Math.atan2(dx, dz)
    targetRotY.current = desiredRot
    let rotDiff = targetRotY.current - rotY.current
    if (rotDiff > Math.PI) rotDiff -= Math.PI * 2
    if (rotDiff < -Math.PI) rotDiff += Math.PI * 2
    rotY.current += rotDiff * 0.04
    ref.current.rotation.y = rotY.current

    // Airplane-style tilt for NPCs
    ref.current.rotation.z = -rotDiff * 0.5 // bank when turning
    const vertDir = target.current.y - pos.current.y
    ref.current.rotation.x = Math.max(-0.3, Math.min(0.3, -vertDir * 0.05 + (dist > 2 ? 0.08 : 0))) // pitch based on climb/dive

    // Store position for camera follow
    if (positionsRef?.current) {
      positionsRef.current[index] = { x: pos.current.x, y: pos.current.y + bob, z: pos.current.z, rot: rotY.current }
    }

    // Rotate banner
    if (bannerRef.current) {
      bannerRef.current.rotation.y += dt * 2.5
    }
  })

  return (
    <group ref={ref} onClick={(e) => { e.stopPropagation(); onClickCar?.(index) }}>
      {/* Car body - sleek */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.4, 0.12, 0.9]} />
        <meshStandardMaterial color={config.color} metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Hood */}
      <mesh position={[0, 0.02, 0.35]}>
        <boxGeometry args={[0.35, 0.08, 0.25]} />
        <meshStandardMaterial color={config.color} metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Cabin */}
      <mesh position={[0, 0.1, -0.05]}>
        <boxGeometry args={[0.32, 0.1, 0.32]} />
        <meshStandardMaterial color="#111" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Wheels pointing DOWN (hover style) */}
      {([[-0.22, -0.1, 0.28], [0.22, -0.1, 0.28], [-0.22, -0.1, -0.28], [0.22, -0.1, -0.28]] as [number, number, number][]).map((wpos, i) => (
        <group key={i} position={wpos}>
          {/* Wheel rotated downward */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.05, 0.05, 0.04]} />
            <meshStandardMaterial color="#222" metalness={0.6} />
          </mesh>
          {/* Small blue jet glow under each wheel */}
          <mesh position={[0, -0.08, 0]}>
            <coneGeometry args={[0.04, 0.15, 8]} />
            <meshStandardMaterial
              color="#0088ff"
              emissive="#0066ff"
              emissiveIntensity={2}
              transparent
              opacity={0.7}
            />
          </mesh>
        </group>
      ))}

      {/* Glow light under NPC car */}
      <pointLight position={[0, -0.15, 0]} intensity={0.8} distance={2.5} color="#4488ff" />

      {/* Headlights */}
      <mesh position={[-0.1, 0, 0.46]}>
        <sphereGeometry args={[0.025]} />
        <meshStandardMaterial emissive="#ffffff" emissiveIntensity={2} />
      </mesh>
      <mesh position={[0.1, 0, 0.46]}>
        <sphereGeometry args={[0.025]} />
        <meshStandardMaterial emissive="#ffffff" emissiveIntensity={2} />
      </mesh>
      {/* Taillights */}
      <mesh position={[-0.14, 0, -0.46]}>
        <sphereGeometry args={[0.02]} />
        <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={2} />
      </mesh>
      <mesh position={[0.14, 0, -0.46]}>
        <sphereGeometry args={[0.02]} />
        <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={2} />
      </mesh>

      {/* Rotating Bitcoin City Banner */}
      <group position={[0, 0.4, 0]}>
        <mesh position={[0, -0.1, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.2]} />
          <meshStandardMaterial color="#666" metalness={0.8} />
        </mesh>
        <mesh ref={bannerRef} position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 0.36, 12, 1, true]} />
          <meshStandardMaterial
            color="#f7931a"
            emissive="#f7931a"
            emissiveIntensity={0.5}
            transparent
            opacity={0.7}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh position={[0, 0.08, 0.31]}>
          <sphereGeometry args={[0.06]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.6} />
        </mesh>
      </group>
    </group>
  )
}

function NPCCars({ onClickCar, positionsRef }: { onClickCar?: (idx: number) => void; positionsRef?: React.MutableRefObject<{ x: number; y: number; z: number; rot: number }[]> }) {
  const configs = useMemo<FlyingCarConfig[]>(() => {
    const colors = ['#FF2800', '#FFD700', '#1E90FF', '#FF4500', '#00FF7F', '#FF1493', '#00CED1', '#8B00FF', '#FF6347', '#C0C0C0']
    const arr: FlyingCarConfig[] = []
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2
      const r = 5 + Math.random() * 75 // spread across entire city
      arr.push({
        speed: 1.5 + Math.random() * 2.5, // 1.5-4 units/sec (slow cruising)
        flyHeight: 3 + Math.random() * 10, // 3-13 height
        color: colors[i % colors.length],
        startX: Math.cos(angle) * r,
        startZ: Math.sin(angle) * r,
        startAngle: Math.random() * Math.PI * 2,
      })
    }
    return arr
  }, [])

  return (
    <>
      {configs.map((config, i) => (
        <FlyingCar key={`npc-${i}`} config={config} index={i} onClickCar={onClickCar} positionsRef={positionsRef} />
      ))}
    </>
  )
}

// ==================== NPC CAMERA FOLLOWER ====================

function NPCCameraFollower({ positionsRef, followIndex }: { positionsRef: React.MutableRefObject<{ x: number; y: number; z: number; rot: number }[]>; followIndex: number }) {
  const { camera } = useThree()

  useFrame(() => {
    const pos = positionsRef.current[followIndex]
    if (!pos) return

    const camDist = 6
    const camHeight = pos.y + 2
    const behindX = pos.x - Math.sin(pos.rot) * camDist
    const behindZ = pos.z - Math.cos(pos.rot) * camDist

    const targetCamPos = new THREE.Vector3(behindX, camHeight, behindZ)
    camera.position.lerp(targetCamPos, 0.06)
    camera.lookAt(pos.x, pos.y, pos.z)
  })

  return null
}

// WarmCityLights removed for performance - ambient/directional lights provide enough warmth

// ==================== MEGA BUILDING (City HQ) ====================

function NeonSign({ text, position, rotation }: { text: string; position: [number, number, number]; rotation?: [number, number, number] }) {
  const glowRef = useRef<any>(null)
  const textRef = useRef<any>(null)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    // Neon flicker: mostly steady with occasional subtle dips
    const base = 0.85 + Math.sin(t * 2.3) * 0.1
    const flicker = Math.random() > 0.97 ? 0.5 + Math.random() * 0.3 : 1.0
    const intensity = base * flicker
    if (glowRef.current) {
      glowRef.current.fillOpacity = intensity * 0.35
    }
  })

  return (
    <group position={position} rotation={rotation || [0, 0, 0]}>
      {/* Dark sign board */}
      <mesh position={[0, 0, -0.08]}>
        <boxGeometry args={[6.5, 1.6, 0.12]} />
        <meshStandardMaterial color="#0a0a0a" metalness={0.3} roughness={0.8} />
      </mesh>
      {/* Metal frame */}
      <mesh position={[0, 0, -0.06]}>
        <boxGeometry args={[6.8, 1.8, 0.04]} />
        <meshStandardMaterial color="#333" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Main neon text */}
      <Text
        ref={textRef}
        fontSize={0.85}
        color="#ff6600"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.03}
        outlineColor="#ff3300"
      >
        {text}
      </Text>
      {/* Glow text behind (slightly larger, transparent) */}
      <Text
        ref={glowRef}
        fontSize={0.9}
        color="#ff4400"
        anchorX="center"
        anchorY="middle"
        position={[0, 0, -0.02]}
        fillOpacity={0.35}
      >
        {text}
      </Text>
    </group>
  )
}

function MegaBuilding({ count }: { count: number }) {
  const MEGA_HEIGHT = 28
  const MEGA_WIDTH = 3.8

  return (
    <group position={[0, 0, 0]}>
      {/* Grand foundation */}
      <mesh position={[0, 0.15, 0]} receiveShadow>
        <boxGeometry args={[MEGA_WIDTH + 1, 0.3, MEGA_WIDTH + 1]} />
        <meshStandardMaterial color="#111" metalness={0.5} />
      </mesh>
      {/* Steps */}
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <boxGeometry args={[MEGA_WIDTH + 1.8, 0.1, MEGA_WIDTH + 1.8]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>

      {/* Main tower body */}
      <mesh position={[0, MEGA_HEIGHT / 2 + 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[MEGA_WIDTH, MEGA_HEIGHT, MEGA_WIDTH]} />
        <meshStandardMaterial color="#0d1117" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Gold accent stripes - 4 sides */}
      {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((rot, i) => (
        <mesh key={`stripe-${i}`} position={[
          Math.sin(rot) * (MEGA_WIDTH / 2 + 0.01),
          MEGA_HEIGHT / 2 + 0.3,
          Math.cos(rot) * (MEGA_WIDTH / 2 + 0.01)
        ]} rotation={[0, rot, 0]}>
          <planeGeometry args={[0.12, MEGA_HEIGHT]} />
          <meshStandardMaterial color="#f7931a" emissive="#f7931a" emissiveIntensity={0.4} />
        </mesh>
      ))}

      {/* Windows for mega building - using shared geometry */}
      {useMemo(() => {
        const windows: JSX.Element[] = []
        const step = 2
        for (let floor = 1; floor < MEGA_HEIGHT / FLOOR_HEIGHT; floor += step) {
          const y = floor * FLOOR_HEIGHT + 0.3
          for (let c = 0; c < 7; c++) {
            const off = (c + 1) * (MEGA_WIDTH / 8) - MEGA_WIDTH / 2
            // Front and back
            windows.push(
              <mesh key={`fw-${floor}-${c}`} position={[off, y, MEGA_WIDTH / 2 + 0.01]}>
                <planeGeometry args={[0.28, 0.38]} />
                <meshStandardMaterial color="#1a3a5c" emissive="#2255aa" emissiveIntensity={0.3} transparent opacity={0.9} />
              </mesh>
            )
            windows.push(
              <mesh key={`bw-${floor}-${c}`} position={[off, y, -(MEGA_WIDTH / 2 + 0.01)]} rotation={[0, Math.PI, 0]}>
                <planeGeometry args={[0.28, 0.38]} />
                <meshStandardMaterial color="#1a3a5c" emissive="#2255aa" emissiveIntensity={0.3} transparent opacity={0.9} />
              </mesh>
            )
          }
        }
        return windows
      }, [])}

      {/* Roof */}
      <mesh position={[0, MEGA_HEIGHT + 0.5, 0]}>
        <boxGeometry args={[MEGA_WIDTH + 0.2, 0.2, MEGA_WIDTH + 0.2]} />
        <meshStandardMaterial color="#111" metalness={0.6} />
      </mesh>

      {/* Rooftop structure */}
      <mesh position={[0, MEGA_HEIGHT + 1.3, 0]}>
        <boxGeometry args={[2, 1.4, 2]} />
        <meshStandardMaterial color="#0a0a0a" metalness={0.5} />
      </mesh>

      {/* Antenna */}
      <mesh position={[0, MEGA_HEIGHT + 3.5, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 3]} />
        <meshStandardMaterial color="#888" metalness={0.8} />
      </mesh>
      <mesh position={[0, MEGA_HEIGHT + 5, 0]}>
        <sphereGeometry args={[0.1]} />
        <meshStandardMaterial color="#ff3333" emissive="#ff0000" emissiveIntensity={1} />
      </mesh>

      {/* BTC logo on building (emissive orange circle) */}
      {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((rot, i) => (
        <mesh key={`btc-${i}`} position={[
          Math.sin(rot) * (MEGA_WIDTH / 2 + 0.02),
          MEGA_HEIGHT * 0.75 + 0.3,
          Math.cos(rot) * (MEGA_WIDTH / 2 + 0.02)
        ]} rotation={[0, rot, 0]}>
          <circleGeometry args={[0.8, 32]} />
          <meshStandardMaterial color="#f7931a" emissive="#f7931a" emissiveIntensity={0.6} />
        </mesh>
      ))}

      {/* NEON SIGNS on top - 4 sides */}
      <NeonSign text="BITCOIN CITY" position={[0, MEGA_HEIGHT + 2, MEGA_WIDTH / 2 + 0.2]} />
      <NeonSign text="BITCOIN CITY" position={[0, MEGA_HEIGHT + 2, -(MEGA_WIDTH / 2 + 0.2)]} rotation={[0, Math.PI, 0]} />
      <NeonSign text="BITCOIN CITY" position={[MEGA_WIDTH / 2 + 0.2, MEGA_HEIGHT + 2, 0]} rotation={[0, Math.PI / 2, 0]} />
      <NeonSign text="BITCOIN CITY" position={[-(MEGA_WIDTH / 2 + 0.2), MEGA_HEIGHT + 2, 0]} rotation={[0, -Math.PI / 2, 0]} />

      {/* Citizen count under the neon sign */}
      <Text
        position={[0, MEGA_HEIGHT + 0.9, MEGA_WIDTH / 2 + 0.15]}
        fontSize={0.3}
        color="#888"
        anchorX="center"
        anchorY="middle"
      >
        {count} citizen{count !== 1 ? 's' : ''} and counting
      </Text>
    </group>
  )
}

// ==================== NITRO UI ====================

function NitroUI({ charges, recharging }: { charges: number; recharging: boolean }) {
  return (
    <div className="fixed bottom-16 right-6 z-20 bg-black/80 backdrop-blur-sm rounded-lg px-4 py-3 text-center">
      <p className="text-xs text-gray-400 mb-1 font-semibold">NITRO [SPACE]</p>
      <div className="flex gap-2 justify-center">
        {[0, 1].map((i) => (
          <div
            key={i}
            className={`w-6 h-6 rounded-md border-2 flex items-center justify-center text-xs font-bold transition-all ${
              i < charges
                ? 'border-blue-400 bg-blue-500/30 text-blue-300 shadow-[0_0_8px_rgba(59,130,246,0.5)]'
                : 'border-gray-600 bg-gray-800/50 text-gray-600'
            }`}
          >
            {i < charges ? '\u26A1' : ''}
          </div>
        ))}
      </div>
      {recharging && charges < 2 && (
        <p className="text-[10px] text-orange-400 mt-1 animate-pulse">Recharging...</p>
      )}
    </div>
  )
}

// ==================== MAIN COMPONENT ====================

export default function City3D({ buildings, drivingMode = false, walkingMode = false, driverName = '', userTier = 1, supabaseClient }: { buildings: BuildingType[]; drivingMode?: boolean; walkingMode?: boolean; driverName?: string; userTier?: number; supabaseClient?: any }) {
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingType | null>(null)
  const [nitroCharges, setNitroCharges] = useState(2)
  const [nitroRecharging, setNitroRecharging] = useState(false)
  const [ghostCars, setGhostCars] = useState<GhostCarData[]>([])
  const ghostCarsRef = useRef<GhostCarData[]>([])
  const myCarPosRef = useRef<[number, number, number]>([0, 0.15, 8])
  const [onlineCount, setOnlineCount] = useState(0)
  const channelRef = useRef<any>(null)
  const myIdRef = useRef<string>(Math.random().toString(36).substring(2, 10))
  const [followingNPC, setFollowingNPC] = useState<number | null>(null)
  const npcPositionsRef = useRef<{ x: number; y: number; z: number; rot: number }[]>([])

  // Keep ghostCarsRef in sync
  useEffect(() => {
    ghostCarsRef.current = ghostCars
  }, [ghostCars])

  // Supabase Realtime Presence for multiplayer (works for both flying and walking)
  useEffect(() => {
    const activeMode = drivingMode || walkingMode
    if (!supabaseClient || !activeMode || !driverName) {
      if (channelRef.current) {
        channelRef.current.unsubscribe()
        channelRef.current = null
      }
      setGhostCars([])
      setOnlineCount(0)
      return
    }

    const channel = supabaseClient.channel('city-players', {
      config: { presence: { key: myIdRef.current } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const ghosts: GhostCarData[] = []
        let count = 0
        for (const [key, presences] of Object.entries(state)) {
          count++
          if (key === myIdRef.current) continue
          const p = (presences as any[])[0]
          if (p && typeof p.x === 'number') {
            ghosts.push({
              id: key,
              name: p.name || 'Anon',
              x: p.x,
              y: p.y || 0.15,
              z: p.z,
              rot: p.rot || 0,
              nitro: p.nitro || false,
              mode: p.mode || 'flying',
              tier: p.tier || 1,
            })
          }
        }
        setGhostCars(ghosts)
        setOnlineCount(count)
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            name: driverName,
            x: 0,
            y: walkingMode ? 0.45 : 5,
            z: 8,
            rot: 0,
            nitro: false,
            mode: walkingMode ? 'walking' : 'flying',
            tier: userTier,
          })
        }
      })

    channelRef.current = channel

    return () => {
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [supabaseClient, drivingMode, walkingMode, driverName, userTier])

  // NPC spectator mode
  const handleNPCClick = useCallback((idx: number) => {
    if (!drivingMode) {
      setFollowingNPC(idx)
      setSelectedBuilding(null)
    }
  }, [drivingMode])

  // ESC to exit spectator mode
  useEffect(() => {
    if (followingNPC === null) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFollowingNPC(null)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [followingNPC])

  // Exit spectator when entering driving mode
  useEffect(() => {
    if (drivingMode) setFollowingNPC(null)
  }, [drivingMode])

  const handleBuildingClick = useCallback((b: BuildingType) => {
    setSelectedBuilding(b)
  }, [])

  const handleNitroUpdate = useCallback((charges: number, recharging: boolean) => {
    setNitroCharges(charges)
    setNitroRecharging(recharging)
  }, [])

  const handlePositionUpdate = useCallback((x: number, y: number, z: number, rot: number, nitroOrMode: boolean | string) => {
    myCarPosRef.current = [x, y, z]
    if (channelRef.current) {
      const isWalking = typeof nitroOrMode === 'string' && nitroOrMode === 'walking'
      channelRef.current.track({
        name: driverName,
        x, y, z, rot,
        nitro: typeof nitroOrMode === 'boolean' ? nitroOrMode : false,
        mode: isWalking ? 'walking' : 'flying',
        tier: userTier,
      })
    }
  }, [driverName, userTier])

  return (
    <div className="w-full h-screen relative">
      {selectedBuilding && (
        <BuildingPopup building={selectedBuilding} onClose={() => setSelectedBuilding(null)} />
      )}

      {/* Nitro UI overlay when driving */}
      {drivingMode && (
        <NitroUI charges={nitroCharges} recharging={nitroRecharging} />
      )}

      {/* Online players counter */}
      {(drivingMode || walkingMode) && onlineCount > 0 && (
        <div className="fixed top-20 right-6 z-20 bg-black/80 backdrop-blur-sm rounded-lg px-3 py-2 text-center">
          <p className="text-xs text-green-400 font-bold">{onlineCount} online</p>
        </div>
      )}

      {/* Spectator mode UI */}
      {followingNPC !== null && !drivingMode && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-20 bg-black/80 backdrop-blur-sm rounded-lg px-5 py-3 text-center">
          <p className="text-sm text-[#f7931a] font-bold">🏎️ Spectating Ferrari #{followingNPC + 1}</p>
          <p className="text-[10px] text-gray-400 mt-1">Click elsewhere or press ESC to exit</p>
          <button
            onClick={() => setFollowingNPC(null)}
            className="mt-2 text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded"
          >
            Exit Spectator
          </button>
        </div>
      )}

      <Canvas
        shadows
        camera={{ position: [25, 18, 25], fov: 55 }}
        style={{ background: 'linear-gradient(180deg, #2d1a0a 0%, #3d2210 40%, #2a1808 100%)' }}
        onPointerMissed={() => { setSelectedBuilding(null); setFollowingNPC(null) }}
      >
        <ambientLight intensity={1.2} color="#ffddaa" />
        <directionalLight
          position={[30, 40, 20]}
          intensity={1.6}
                   shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          color="#ffeedd"
        />
        <pointLight position={[0, 30, 0]} intensity={0.8} color="#f7931a" />
        <hemisphereLight args={['#5a4020', '#1a1210', 1.0]} />

        <MegaBuilding count={buildings.length} />
        <Ground />
        <Roads />
        <Streetlights />
        <NPCCars onClickCar={handleNPCClick} positionsRef={npcPositionsRef} />
        {followingNPC !== null && !drivingMode && (
          <NPCCameraFollower positionsRef={npcPositionsRef} followIndex={followingNPC} />
        )}
        <Guardrails />

        {buildings.map((b) => (
          <Building key={b.id} data={b} onClick={handleBuildingClick} />
        ))}

        <Car active={drivingMode} driverName={driverName} userTier={userTier} ghostCarsRef={ghostCarsRef} onNitroUpdate={handleNitroUpdate} onPositionUpdate={handlePositionUpdate} />
        <Walker active={walkingMode} driverName={driverName} onPositionUpdate={handlePositionUpdate} />
        <GhostCars ghosts={ghostCars} myCarPos={myCarPosRef} />

        {!drivingMode && !walkingMode && followingNPC === null && (
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
        )}

        <StarrySky />
        <fog attach="fog" args={['#2d1a0a', 80, 200]} />
      </Canvas>
    </div>
  )
}

// Preload the Satoshi GLB model
useGLTF.preload('/models/satoshi.glb')

// Preload all character models
CHARACTER_LIST.forEach(char => {
  useGLTF.preload(`/models/characters/${char.file}`)
})
