'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Text } from '@react-three/drei'
import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
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
const CITY_BOUNDARY_RADIUS = 57 // invisible wall radius
const GUARDRAIL_RADIUS = 55 // visible guardrail radius

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

// ==================== VERIFIED AURA (Golden Treasure) ====================

function GoldenSparkles({ height }: { height: number }) {
  const particlesRef = useRef<THREE.Points>(null)
  const count = 40

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
    const geo = particlesRef.current.geometry
    const posAttr = geo.attributes.position as THREE.BufferAttribute
    const arr = posAttr.array as Float32Array
    for (let i = 0; i < count; i++) {
      arr[i * 3] += velocities[i * 3]
      arr[i * 3 + 1] += velocities[i * 3 + 1]
      arr[i * 3 + 2] += velocities[i * 3 + 2]
      // Reset particle when it goes above building
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
        size={0.12}
        transparent
        opacity={0.9}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}

function VerifiedAura({ height }: { height: number }) {
  const ref = useRef<THREE.Mesh>(null)
  const innerRef = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y += 0.012
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.06
      ref.current.scale.set(pulse, 1, pulse)
    }
    if (innerRef.current) {
      innerRef.current.rotation.y -= 0.008
      const pulse2 = 1 + Math.cos(state.clock.elapsedTime * 3) * 0.04
      innerRef.current.scale.set(pulse2, 1, pulse2)
    }
  })
  return (
    <>
      {/* Outer golden aura */}
      <mesh ref={ref} position={[0, height / 2, 0]}>
        <cylinderGeometry args={[BUILDING_WIDTH * 0.95, BUILDING_WIDTH * 0.95, height + 2, 8, 1, true]} />
        <meshStandardMaterial
          color="#FFD700"
          transparent
          opacity={0.12}
          side={THREE.DoubleSide}
          emissive="#FFD700"
          emissiveIntensity={0.8}
        />
      </mesh>
      {/* Inner brighter glow */}
      <mesh ref={innerRef} position={[0, height / 2, 0]}>
        <cylinderGeometry args={[BUILDING_WIDTH * 0.75, BUILDING_WIDTH * 0.75, height + 1, 6, 1, true]} />
        <meshStandardMaterial
          color="#FFA500"
          transparent
          opacity={0.08}
          side={THREE.DoubleSide}
          emissive="#FFA500"
          emissiveIntensity={1.0}
        />
      </mesh>
      {/* Golden point light at top */}
      <pointLight position={[0, height + 1, 0]} intensity={1.5} distance={8} color="#FFD700" />
      {/* Golden point light at base */}
      <pointLight position={[0, 0.5, 0]} intensity={0.8} distance={5} color="#FFA500" />
      {/* Rising golden sparkle particles */}
      <GoldenSparkles height={height} />
      {/* Ground glow ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[BUILDING_WIDTH * 0.5, BUILDING_WIDTH * 1.2, 32]} />
        <meshStandardMaterial
          color="#FFD700"
          transparent
          opacity={0.25}
          emissive="#FFD700"
          emissiveIntensity={1.2}
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
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
  const bodyColor = data.color || style.body // Use user's chosen color for building body
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
      {/* Main ground - warm lighter gray */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <circleGeometry args={[120, 64]} />
        <meshStandardMaterial color="#2e2820" />
      </mesh>
      {/* Grass/park areas */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <ringGeometry args={[4, 5.5, 64]} />
        <meshStandardMaterial color="#2a3a2a" />
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
  useFrame((state) => {
    if (!ref.current) return
    ref.current.visible = active
    if (active) {
      const flicker = 0.8 + Math.random() * 0.4
      ref.current.scale.set(flicker, flicker + Math.random() * 0.5, flicker)
    }
  })

  return (
    <group ref={ref} visible={false}>
      {/* Blue core flame */}
      <mesh position={[-0.08, 0.12, -0.6]}>
        <coneGeometry args={[0.06, 0.4, 6]} />
        <meshStandardMaterial
          color="#0066ff"
          emissive="#0088ff"
          emissiveIntensity={3}
          transparent
          opacity={0.9}
        />
      </mesh>
      <mesh position={[0.08, 0.12, -0.6]}>
        <coneGeometry args={[0.06, 0.4, 6]} />
        <meshStandardMaterial
          color="#0066ff"
          emissive="#0088ff"
          emissiveIntensity={3}
          transparent
          opacity={0.9}
        />
      </mesh>
      {/* Orange outer flame */}
      <mesh position={[-0.08, 0.12, -0.75]}>
        <coneGeometry args={[0.09, 0.5, 6]} />
        <meshStandardMaterial
          color="#ff6600"
          emissive="#ff4400"
          emissiveIntensity={2}
          transparent
          opacity={0.6}
        />
      </mesh>
      <mesh position={[0.08, 0.12, -0.75]}>
        <coneGeometry args={[0.09, 0.5, 6]} />
        <meshStandardMaterial
          color="#ff6600"
          emissive="#ff4400"
          emissiveIntensity={2}
          transparent
          opacity={0.6}
        />
      </mesh>
      {/* Glow light */}
      <pointLight position={[0, 0.12, -0.8]} intensity={2} distance={3} color="#4488ff" />
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

  return (
    <group ref={ref} position={[data.x, data.y, data.z]} rotation={[0, data.rot, 0]}>
      {/* Ghost car body - slightly transparent */}
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[0.4, 0.15, 0.8]} />
        <meshStandardMaterial color="#f7931a" metalness={0.6} roughness={0.3} transparent opacity={0.85} />
      </mesh>
      <mesh position={[0, 0.24, -0.05]}>
        <boxGeometry args={[0.35, 0.12, 0.4]} />
        <meshStandardMaterial color="#222" metalness={0.8} roughness={0.2} transparent opacity={0.85} />
      </mesh>
      {/* Wheels */}
      {([[-0.2, 0.05, 0.25], [0.2, 0.05, 0.25], [-0.2, 0.05, -0.25], [0.2, 0.05, -0.25]] as [number, number, number][]).map((pos, i) => (
        <mesh key={i} position={pos} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.06, 0.06, 0.05]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      ))}
      {/* Headlights */}
      <mesh position={[-0.12, 0.12, 0.41]}>
        <sphereGeometry args={[0.03]} />
        <meshStandardMaterial emissive="#ffcc00" emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[0.12, 0.12, 0.41]}>
        <sphereGeometry args={[0.03]} />
        <meshStandardMaterial emissive="#ffcc00" emissiveIntensity={1.5} />
      </mesh>
      {/* Taillights */}
      <mesh position={[-0.15, 0.12, -0.41]}>
        <sphereGeometry args={[0.025]} />
        <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[0.15, 0.12, -0.41]}>
        <sphereGeometry args={[0.025]} />
        <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={1.5} />
      </mesh>
      {/* Nitro flame for ghost */}
      {data.nitro && (
        <group>
          <mesh position={[0, 0.12, -0.65]}>
            <coneGeometry args={[0.08, 0.4, 6]} />
            <meshStandardMaterial color="#0066ff" emissive="#0088ff" emissiveIntensity={3} transparent opacity={0.8} />
          </mesh>
          <pointLight position={[0, 0.12, -0.7]} intensity={1.5} distance={2} color="#4488ff" />
        </group>
      )}
      {/* Name above ghost car */}
      <Text
        position={[0, 0.55, 0]}
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

function Car({ active, driverName, ghostCarsRef, onNitroUpdate, onPositionUpdate }: { active: boolean; driverName?: string; ghostCarsRef?: React.MutableRefObject<GhostCarData[]>; onNitroUpdate?: (charges: number, recharging: boolean) => void; onPositionUpdate?: (x: number, y: number, z: number, rot: number, nitro: boolean) => void }) {
  const carRef = useRef<THREE.Group>(null)
  const posRef = useRef<[number, number, number]>([0, 0.15, 8])
  const rotRef = useRef(0)
  const speed = useRef(0)
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
  const touchSteerAmount = useRef(0) // -1 to 1

  const activateNitro = useCallback(() => {
    if (nitroCharges.current > 0 && !nitroActive.current) {
      nitroCharges.current -= 1
      nitroActive.current = true
      nitroTimer.current = 1.0
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
      // Normalize: full screen width = full steer
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
    const dt = Math.min(delta, 0.05) // cap delta

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

    // Speed multiplier from nitro - HUGE boost (10x)
    const maxSpeed = nitroActive.current ? 1.5 : 0.15
    const accel = nitroActive.current ? 0.02 : 0.002

    // Keyboard OR touch for acceleration
    const wantForward = k.has('w') || k.has('arrowup') || touchActive.current
    const wantReverse = k.has('s') || k.has('arrowdown')

    if (wantForward) speed.current = Math.min(speed.current + accel, maxSpeed)
    else if (wantReverse) speed.current = Math.max(speed.current - 0.002, -0.08)
    else speed.current *= 0.95

    if (Math.abs(speed.current) > 0.001) {
      const steerSpeed = nitroActive.current ? 0.02 : 0.03
      // Keyboard steering
      if (k.has('a') || k.has('arrowleft')) rotRef.current += steerSpeed
      if (k.has('d') || k.has('arrowright')) rotRef.current -= steerSpeed
      // Touch steering
      if (touchActive.current && Math.abs(touchSteerAmount.current) > 0.05) {
        rotRef.current -= touchSteerAmount.current * steerSpeed * 1.5
      }
    }

    let newX = posRef.current[0] + Math.sin(rotRef.current) * speed.current
    let newZ = posRef.current[2] + Math.cos(rotRef.current) * speed.current
    const newY = 0.15

    // Collision with ghost cars - symmetrical horizontal push
    if (ghostCarsRef?.current) {
      for (const ghost of ghostCarsRef.current) {
        const gx = ghost.x - newX
        const gz = ghost.z - newZ
        const dist = Math.sqrt(gx * gx + gz * gz)
        if (dist < 1.2 && dist > 0.01) {
          // Push MY car backward (away from ghost)
          const pushForce = 0.15
          newX -= (gx / dist) * pushForce
          newZ -= (gz / dist) * pushForce
          speed.current *= 0.3 // strong brake on collision
        }
      }
    }

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

    const camDist = nitroActive.current ? 6 : 4
    const camHeight = nitroActive.current ? 3 : 2
    const targetCamPos = new THREE.Vector3(
      newX - Math.sin(rotRef.current) * camDist,
      camHeight,
      newZ - Math.cos(rotRef.current) * camDist
    )
    state.camera.position.lerp(targetCamPos, nitroActive.current ? 0.08 : 0.05)
    state.camera.lookAt(newX, 0.5, newZ)

    // Broadcast position every ~50ms for smoother multiplayer
    broadcastTimer.current += dt
    if (broadcastTimer.current > 0.05) {
      broadcastTimer.current = 0
      onPositionUpdate?.(newX, newY, newZ, rotRef.current, nitroActive.current)
    }
  })

  if (!active) return null

  return (
    <group ref={carRef} position={[0, 0.15, 8]}>
      {/* Car body */}
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[0.4, 0.15, 0.8]} />
        <meshStandardMaterial color="white" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Cabin */}
      <mesh position={[0, 0.24, -0.05]}>
        <boxGeometry args={[0.35, 0.12, 0.4]} />
        <meshStandardMaterial color="#333" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Wheels */}
      {([[-0.2, 0.05, 0.25], [0.2, 0.05, 0.25], [-0.2, 0.05, -0.25], [0.2, 0.05, -0.25]] as [number, number, number][]).map((pos, i) => (
        <mesh key={i} position={pos} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.06, 0.06, 0.05]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      ))}
      {/* Headlights */}
      <mesh position={[-0.12, 0.12, 0.41]}>
        <sphereGeometry args={[0.03]} />
        <meshStandardMaterial emissive="white" emissiveIntensity={2} />
      </mesh>
      <mesh position={[0.12, 0.12, 0.41]}>
        <sphereGeometry args={[0.03]} />
        <meshStandardMaterial emissive="white" emissiveIntensity={2} />
      </mesh>
      {/* Taillights */}
      <mesh position={[-0.15, 0.12, -0.41]}>
        <sphereGeometry args={[0.025]} />
        <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[0.15, 0.12, -0.41]}>
        <sphereGeometry args={[0.025]} />
        <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={1.5} />
      </mesh>
      {/* Nitro flames */}
      <NitroFlame active={nitroFlameActive} />
      {/* Driver name above car */}
      {driverName && (
        <Text
          position={[0, 0.55, 0]}
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
      {/* Radial roads - 12 spokes for proper street grid between buildings */}
      {Array.from({ length: 12 }, (_, i) => (i / 12) * Math.PI * 2).map((angle, i) => (
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

// ==================== WARM CITY LIGHTS ====================

function WarmCityLights() {
  const lights = useMemo(() => {
    const arr: [number, number][] = []
    // Additional warm lights around the city at various radii
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2
      arr.push([Math.cos(angle) * 25, Math.sin(angle) * 25])
    }
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + 0.3
      arr.push([Math.cos(angle) * 40, Math.sin(angle) * 40])
    }
    return arr
  }, [])

  return (
    <>
      {lights.map(([x, z], i) => (
        <pointLight key={`warm-${i}`} position={[x, 3, z]} intensity={0.7} distance={15} color="#ff9933" />
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

export default function City3D({ buildings, drivingMode = false, driverName = '', supabaseClient }: { buildings: BuildingType[]; drivingMode?: boolean; driverName?: string; supabaseClient?: any }) {
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingType | null>(null)
  const [nitroCharges, setNitroCharges] = useState(2)
  const [nitroRecharging, setNitroRecharging] = useState(false)
  const [ghostCars, setGhostCars] = useState<GhostCarData[]>([])
  const ghostCarsRef = useRef<GhostCarData[]>([])
  const myCarPosRef = useRef<[number, number, number]>([0, 0.15, 8])
  const [onlineCount, setOnlineCount] = useState(0)
  const channelRef = useRef<any>(null)
  const myIdRef = useRef<string>(Math.random().toString(36).substring(2, 10))

  // Keep ghostCarsRef in sync
  useEffect(() => {
    ghostCarsRef.current = ghostCars
  }, [ghostCars])

  // Supabase Realtime Presence for multiplayer
  useEffect(() => {
    if (!supabaseClient || !drivingMode || !driverName) {
      // Clean up when leaving driving mode
      if (channelRef.current) {
        channelRef.current.unsubscribe()
        channelRef.current = null
      }
      setGhostCars([])
      setOnlineCount(0)
      return
    }

    const channel = supabaseClient.channel('city-drivers', {
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
            y: 0.15,
            z: 8,
            rot: 0,
            nitro: false,
          })
        }
      })

    channelRef.current = channel

    return () => {
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [supabaseClient, drivingMode, driverName])

  const handleBuildingClick = useCallback((b: BuildingType) => {
    setSelectedBuilding(b)
  }, [])

  const handleNitroUpdate = useCallback((charges: number, recharging: boolean) => {
    setNitroCharges(charges)
    setNitroRecharging(recharging)
  }, [])

  const handlePositionUpdate = useCallback((x: number, y: number, z: number, rot: number, nitro: boolean) => {
    myCarPosRef.current = [x, y, z]
    if (channelRef.current) {
      channelRef.current.track({
        name: driverName,
        x, y, z, rot, nitro,
      })
    }
  }, [driverName])

  return (
    <div className="w-full h-screen relative">
      {selectedBuilding && (
        <BuildingPopup building={selectedBuilding} onClose={() => setSelectedBuilding(null)} />
      )}

      {/* Nitro UI overlay when driving */}
      {drivingMode && (
        <NitroUI charges={nitroCharges} recharging={nitroRecharging} />
      )}

      {/* Online drivers counter */}
      {drivingMode && onlineCount > 0 && (
        <div className="fixed top-20 right-6 z-20 bg-black/80 backdrop-blur-sm rounded-lg px-3 py-2 text-center">
          <p className="text-xs text-green-400 font-bold">{onlineCount} driving</p>
        </div>
      )}

      <Canvas
        shadows
        camera={{ position: [25, 18, 25], fov: 55 }}
        style={{ background: 'linear-gradient(180deg, #2d1a0a 0%, #3d2210 40%, #2a1808 100%)' }}
        onPointerMissed={() => setSelectedBuilding(null)}
      >
        <ambientLight intensity={1.0} color="#ffddaa" />
        <directionalLight
          position={[30, 40, 20]}
          intensity={1.4}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          color="#ffeedd"
        />
        <pointLight position={[0, 30, 0]} intensity={1.0} color="#f7931a" />
        <pointLight position={[15, 15, 15]} intensity={0.5} color="#ff8800" />
        <pointLight position={[-15, 15, -15]} intensity={0.5} color="#ffaa33" />
        <hemisphereLight args={['#4a3018', '#1a1210', 0.8]} />

        <WarmCityLights />
        <CitySign count={buildings.length} />
        <Ground />
        <Roads />
        <Streetlights />
        <Guardrails />

        {buildings.map((b) => (
          <Building key={b.id} data={b} onClick={handleBuildingClick} />
        ))}

        <Car active={drivingMode} driverName={driverName} ghostCarsRef={ghostCarsRef} onNitroUpdate={handleNitroUpdate} onPositionUpdate={handlePositionUpdate} />
        <GhostCars ghosts={ghostCars} myCarPos={myCarPosRef} />

        {!drivingMode && (
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

        <fog attach="fog" args={['#2d1a0a', 60, 150]} />
      </Canvas>
    </div>
  )
}
