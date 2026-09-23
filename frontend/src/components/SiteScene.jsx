import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import {
  Html,
  OrbitControls,
  Line,
  Environment,
  ContactShadows,
  RoundedBox,
  Outlines,
  useGLTF,
  useAnimations,
} from '@react-three/drei'
import * as THREE from 'three'
import { truckPhase, logEvent } from '../lib/sim'

const YELLOW = '#f2b705'
const DARK = '#2b2f35'
const STEEL = '#3a3f46'
const TRACK = '#15171a'

// Third-party model assets (see THIRD_PARTY_ASSETS.md at repo root for full license text):
//  - dumptruck.glb: "Dump truck" by jeremy, poly.pizza, CC BY 3.0
//  - worker-d.glb / worker-e.glb: Kenney "Blocky Characters", CC0 1.0
useGLTF.preload('/models/dumptruck.glb')
useGLTF.preload('/models/worker-d.glb')
useGLTF.preload('/models/worker-e.glb')

// Excavator dig -> lift -> swing -> dump -> return cycle (radians)
// NOTE: keyed against the pivot offsets used inside <Excavator>, do not change
// those offsets without re-tuning these angles (see Controller below).
const KEYS = [
  { swing: 0, boom: 0.45, stick: -1.75, bucket: -0.7 },
  { swing: 0, boom: -0.05, stick: -1.05, bucket: -0.2 },
  { swing: 0, boom: 0.55, stick: -1.9, bucket: -1.9 },
  { swing: 1.57, boom: 0.6, stick: -1.7, bucket: -1.9 },
  { swing: 1.57, boom: 0.5, stick: -1.35, bucket: 0.5 },
  { swing: 0, boom: 0.45, stick: -1.75, bucket: -0.7 },
]
const SEG = 1.2 // seconds per keyframe segment

function lerpPose(t) {
  const total = SEG * (KEYS.length - 1)
  const u = (t % total) / SEG
  const i = Math.floor(u)
  const f = u - i
  const e = f * f * (3 - 2 * f) // smoothstep
  const a = KEYS[i], b = KEYS[i + 1]
  const out = {}
  for (const k of Object.keys(a)) out[k] = a[k] + (b[k] - a[k]) * e
  return out
}

// A slim decorative hydraulic ram (sleeve + rod). Purely cosmetic, local to
// whatever group it's nested in, so it always tracks its parent's rotation.
function Hydraulic({ position = [0, 0, 0], rotation = [0, 0, 0], length = 1.6 }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.09, 0.1, length, 8]} />
        <meshStandardMaterial color="#4b5157" roughness={0.4} metalness={0.7} />
      </mesh>
      <mesh castShadow position={[length * 0.32, 0, 0]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.045, 0.045, length * 0.72, 8]} />
        <meshStandardMaterial color="#d8dce0" roughness={0.15} metalness={0.9} />
      </mesh>
    </group>
  )
}

function BeaconLight({ position }) {
  const mat = useRef()
  useFrame(({ clock }) => {
    if (!mat.current) return
    mat.current.emissiveIntensity = 1.6 + Math.max(0, Math.sin(clock.elapsedTime * 6)) * 3
  })
  return (
    <mesh position={position} castShadow>
      <sphereGeometry args={[0.09, 10, 10]} />
      <meshStandardMaterial ref={mat} color="#ffb020" emissive="#ffb020" emissiveIntensity={2} toneMapped={false} />
    </mesh>
  )
}

function toothRow(count, spread, y, z) {
  return Array.from({ length: count }, (_, i) => spread * (i / (count - 1) - 0.5)).map((x) => (
    <mesh key={x} position={[0.02, y, z + x]} rotation-z={Math.PI} castShadow>
      <coneGeometry args={[0.09, 0.28, 6]} />
      <meshStandardMaterial color="#1c1e21" roughness={0.55} metalness={0.75} />
    </mesh>
  ))
}

// Premium-leaning procedural Cat-style excavator. Kept fully procedural (zero
// third-party asset / licensing risk) but rebuilt with rounded panels, glazed
// cab, worn-metal bucket and cosmetic hydraulics instead of flat boxes.
// The four pivot groups (house/boom/stick/bucket) keep the exact same local
// offsets as the original mesh so the Controller's keyframed rotations below
// produce the same dig-swing-dump motion as before.
function Excavator({ parts }) {
  // clearcoat (meshPhysicalMaterial) is reserved for the one big hero panel;
  // everywhere else uses a plain meshStandardMaterial with the same look,
  // which is much cheaper per-pixel across many small parts.
  const paintPhysical = { color: YELLOW, roughness: 0.35, metalness: 0.2, clearcoat: 0.55, clearcoatRoughness: 0.25 }
  const paintStd = { color: YELLOW, roughness: 0.35, metalness: 0.2 }
  return (
    <group>
      {/* undercarriage */}
      <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.1, 0.5, 2.85]} />
        <meshStandardMaterial color="#22262b" roughness={0.6} metalness={0.55} />
      </mesh>
      {/* tracks: rounded rubber body + rollers + sprockets */}
      {[-1.15, 1.15].map((z) => (
        <group key={z} position={[0, 0.42, z]}>
          <RoundedBox args={[4.7, 0.82, 0.62]} radius={0.2} smoothness={2} castShadow receiveShadow>
            <meshStandardMaterial color={TRACK} roughness={0.95} metalness={0.05} />
          </RoundedBox>
          {[-1.7, -0.85, 0, 0.85, 1.7].map((x) => (
            <mesh key={x} position={[x, -0.02, 0]} rotation-z={Math.PI / 2} castShadow>
              <cylinderGeometry args={[0.32, 0.32, 0.66, 10]} />
              <meshStandardMaterial color="#2a2d31" roughness={0.6} metalness={0.4} />
            </mesh>
          ))}
          {[-2.15, 2.15].map((x) => (
            <mesh key={x} position={[x, 0.05, 0]} rotation-z={Math.PI / 2} castShadow>
              <cylinderGeometry args={[0.4, 0.4, 0.7, 10]} />
              <meshStandardMaterial color={STEEL} roughness={0.5} metalness={0.6} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[0, 0.95, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 0.35, 1.6]} />
        <meshStandardMaterial color={DARK} roughness={0.6} metalness={0.4} />
      </mesh>

      {/* upper house: swings */}
      <group ref={parts.house} position={[0, 1.15, 0]}>
        <RoundedBox args={[3.0, 1.1, 2.5]} radius={0.14} smoothness={2} position={[-0.2, 0.55, 0]} castShadow receiveShadow>
          <meshPhysicalMaterial {...paintPhysical} />
        </RoundedBox>
        <RoundedBox args={[0.85, 1.05, 2.5]} radius={0.14} smoothness={2} position={[-1.95, 0.5, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={STEEL} roughness={0.5} metalness={0.55} />
        </RoundedBox>
        {/* engine hatch vents */}
        {[-1.7, -2.2].map((x) => (
          <mesh key={x} position={[x, 1.15, 0]} castShadow>
            <boxGeometry args={[0.35, 0.06, 2.2]} />
            <meshStandardMaterial color="#14161a" roughness={0.8} />
          </mesh>
        ))}
        {/* cab: mostly-glass greenhouse with thin yellow pillars */}
        <mesh position={[0.85, 1.78, 0.75]} castShadow>
          <boxGeometry args={[0.95, 1.25, 0.92]} />
          <meshPhysicalMaterial
            color="#9fd0e8"
            transparent
            opacity={0.4}
            roughness={0.04}
            metalness={0.05}
            clearcoat={1}
            clearcoatRoughness={0.06}
            ior={1.5}
          />
        </mesh>
        {[
          [0.4, 0.32], [0.4, -0.32], [-0.4, 0.32], [-0.4, -0.32],
        ].map(([dx, dz]) => (
          <mesh key={`${dx}${dz}`} position={[0.85 + dx, 1.78, 0.75 + dz]} castShadow>
            <boxGeometry args={[0.08, 1.3, 0.08]} />
            <meshStandardMaterial {...paintStd} />
          </mesh>
        ))}
        <mesh position={[0.85, 2.44, 0.75]}>
          <boxGeometry args={[1.05, 0.08, 1.0]} />
          <meshStandardMaterial {...paintStd} />
        </mesh>
        <BeaconLight position={[0.85, 2.6, 0.75]} />

        {/* boom -> stick -> bucket */}
        <group ref={parts.boom} position={[1.2, 1.0, -0.25]}>
          <RoundedBox args={[3.4, 0.62, 0.56]} radius={0.12} smoothness={2} position={[1.6, 0, 0]} castShadow receiveShadow>
            <meshStandardMaterial {...paintStd} />
          </RoundedBox>
          <RoundedBox args={[2.7, 0.46, 0.42]} radius={0.1} smoothness={2} position={[4.4, 0.02, 0]} castShadow receiveShadow>
            <meshStandardMaterial {...paintStd} />
          </RoundedBox>
          <Hydraulic position={[1.1, -0.55, 0.32]} rotation={[0, 0, 0.3]} length={2.1} />
          <Hydraulic position={[1.1, -0.55, -0.32]} rotation={[0, 0, 0.3]} length={2.1} />

          <group ref={parts.stick} position={[5.6, 0, 0]}>
            <RoundedBox args={[3.0, 0.4, 0.38]} radius={0.09} smoothness={2} position={[1.5, 0, 0]} castShadow receiveShadow>
              <meshStandardMaterial {...paintStd} />
            </RoundedBox>
            <Hydraulic position={[0.4, 0.42, 0]} rotation={[0, 0, -0.5]} length={1.5} />

            <group ref={parts.bucket} position={[3.0, 0, 0]}>
              <RoundedBox args={[0.8, 0.85, 1.1]} radius={0.08} smoothness={2} position={[0.35, -0.25, 0]} castShadow receiveShadow>
                <meshStandardMaterial color="#2c3036" roughness={0.55} metalness={0.75} />
              </RoundedBox>
              {toothRow(5, 0.9, -0.67, 0.35)}
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}

function useFitScale(scene, targetSize, mode = 'height') {
  return useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene)
    const size = new THREE.Vector3()
    box.getSize(size)
    const dim = mode === 'height' ? size.y : Math.max(size.x, size.z)
    return dim > 0.0001 ? targetSize / dim : 1
  }, [scene, targetSize, mode])
}

function prepMaterials(scene, tune) {
  scene.traverse((o) => {
    if (!o.isMesh) return
    o.castShadow = true
    o.receiveShadow = true
    const mats = Array.isArray(o.material) ? o.material : [o.material]
    mats.forEach((m) => {
      if (!m || !m.color) return
      const hex = `#${m.color.getHexString()}`
      const t = tune(hex)
      if (t) Object.assign(m, t)
      m.envMapIntensity = 1
    })
  })
}

function Truck({ truckRef }) {
  const { scene } = useGLTF('/models/dumptruck.glb')
  useEffect(() => {
    prepMaterials(scene, (hex) => {
      if (hex === '#1a1a1a') return { roughness: 0.9, metalness: 0.1 } // tyres
      if (hex === '#ffffff') return { roughness: 0.15, metalness: 0.1 } // lights/glass
      if (hex === '#455a64') return { roughness: 0.45, metalness: 0.6 } // chassis
      return { roughness: 0.4, metalness: 0.35 } // painted bed/cab panels
    })
  }, [scene])
  const scale = useFitScale(scene, 7.6, 'length')

  return (
    <group ref={truckRef} position={[-60, 0, -7.6]}>
      <primitive object={scene} scale={scale} rotation-y={Math.PI / 2} />
      <Html position={[0, 4.2, 0]} center distanceFactor={28}>
        <div className="rounded bg-black/70 px-2 py-0.5 text-[11px] text-white whitespace-nowrap">Dumper T-07</div>
      </Html>
    </group>
  )
}

function Worker({ workerRef, isNew, label, position, url }) {
  const ring = useRef()
  const { scene, animations } = useGLTF(url)
  const { actions } = useAnimations(animations, scene)
  useEffect(() => {
    prepMaterials(scene, () => null)
    const clip = actions.idle || actions.static || Object.values(actions)[0]
    clip?.reset().fadeIn(0.2).play()
    return () => clip?.fadeOut(0.2)
  }, [actions, scene])
  const scale = useFitScale(scene, 1.75, 'height')

  useFrame(({ clock }) => {
    if (!ring.current) return
    const s = 1 + (clock.elapsedTime % 1.2) * 0.6
    ring.current.scale.set(s, s, s)
    ring.current.material.opacity = 0.9 - (clock.elapsedTime % 1.2) * 0.7
  })
  return (
    <group ref={workerRef} position={position}>
      <group scale={scale}>
        <primitive object={scene} />
        {isNew && <Outlines thickness={2} color="#22c55e" />}
      </group>
      {isNew && (
        <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, 0.05, 0]}>
          <ringGeometry args={[0.7, 0.9, 32]} />
          <meshBasicMaterial color="#22c55e" transparent />
        </mesh>
      )}
      <Html position={[0, 2.15, 0]} center distanceFactor={26}>
        <div className={`rounded px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap ${isNew ? 'bg-green-500 text-black' : 'bg-black/70 text-white'}`}>{label}</div>
      </Html>
    </group>
  )
}

function SiteDressing() {
  const fibre = useMemo(() => [[-2, 0.06, 0.9], [30, 0.06, 0.9]].map((p) => new THREE.Vector3(...p)), [])
  return (
    <group>
      {/* ground */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[220, 220]} />
        <meshStandardMaterial color="#3b3328" roughness={0.98} metalness={0.02} />
      </mesh>
      <gridHelper args={[220, 110, '#4a4034', '#433a2f']} position={[0, 0.01, 0]} />
      {/* haul road */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.015, -7.6]} receiveShadow>
        <planeGeometry args={[140, 5]} />
        <meshStandardMaterial color="#56493a" roughness={0.9} />
      </mesh>
      {/* trench being dug */}
      <mesh position={[9, -0.2, 0]}>
        <boxGeometry args={[9, 0.5, 1.6]} />
        <meshStandardMaterial color="#1f1a14" roughness={1} />
      </mesh>
      {/* spoil pile */}
      <mesh position={[9, 0.5, 3.4]} scale={[3.5, 1, 1.3]} castShadow receiveShadow>
        <sphereGeometry args={[1, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#5a4a36" roughness={0.95} />
      </mesh>
      {/* buried fibre route from Call Before u Dig */}
      <Line points={fibre} color="#fb923c" lineWidth={3} dashed dashSize={0.8} gapSize={0.5} />
      <Html position={[16, 0.3, 0.9]} center distanceFactor={30}>
        <div className="rounded border border-orange-400/60 bg-black/75 px-2 py-1 text-[11px] text-orange-300 whitespace-nowrap">Fibre route · 1.2 m deep · E-floor 0.9 m</div>
      </Html>
      {/* power line */}
      {[-25, 0, 25].map((x) => (
        <mesh key={x} position={[x, 4.5, -22]} castShadow>
          <cylinderGeometry args={[0.18, 0.25, 9, 8]} />
          <meshStandardMaterial color="#6b6f75" roughness={0.6} metalness={0.5} />
        </mesh>
      ))}
      {[-0.6, 0.6].map((dz) => (
        <Line key={dz} points={[[-25, 8.8, -22 + dz], [0, 8.4, -22 + dz], [25, 8.8, -22 + dz]]} color="#cbd5e1" lineWidth={1.5} />
      ))}
      <mesh position={[0, 6, -20]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[60, 7]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={0.1} side={THREE.DoubleSide} />
      </mesh>
      <Html position={[-12, 6.4, -20]} center distanceFactor={30}>
        <div className="rounded border border-red-400/60 bg-black/75 px-2 py-1 text-[11px] text-red-300 whitespace-nowrap">11 kV line · E-ceiling 6 m</div>
      </Html>
      {/* site office / shade */}
      <mesh position={[-22, 1.5, 8]} castShadow receiveShadow>
        <boxGeometry args={[6, 3, 3]} />
        <meshStandardMaterial color="#4b5563" roughness={0.8} metalness={0.1} />
      </mesh>
    </group>
  )
}

function Controller({ sim, parts, truckRef, workerRef, onZone }) {
  const cycleT = useRef(0)
  const prevWorking = useRef(false)
  const lastZone = useRef('clear')
  const home = new THREE.Vector3(15, 0, 9)
  const target = new THREE.Vector3(4.2, 0, 3.2)

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1)
    sim.t += dt

    // trucks
    const tp = truckPhase(sim.t)
    sim.truckPresent = tp.present
    sim.nextTruckEtaSec = tp.eta
    if (truckRef.current) truckRef.current.position.x = tp.x

    // worker walking into the swing zone when the scenario is on
    if (workerRef.current) {
      const goal = sim.workerIntrude ? target : home
      workerRef.current.position.lerp(goal, 1 - Math.exp(-dt * 0.35))
      sim.workerDist = workerRef.current.position.length()
    }
    const zone = sim.workerDist < 7 ? 'danger' : sim.workerDist < 11 ? 'caution' : 'clear'
    sim.zone = zone
    if (zone !== lastZone.current) {
      if (zone === 'danger') logEvent(sim, 'danger', 'New worker (Day 3) inside swing radius. Swing stopped.')
      if (zone === 'caution') logEvent(sim, 'warn', 'Worker approaching swing radius, 4 s to conflict')
      lastZone.current = zone
      onZone(zone)
    }

    // interlocks
    let halted = false, reason = null
    if (zone === 'danger') { halted = true; reason = 'person' }
    else if (sim.beltScenario && !sim.seatbelt && tp.present && sim.engineOn) { halted = true; reason = 'seatbelt' }
    sim.halted = halted
    sim.haltReason = reason

    sim.working = tp.present && sim.engineOn && !halted
    if (sim.working && !prevWorking.current) logEvent(sim, 'ok', 'Loading started: dumper at Bay 2')
    if (!sim.working && prevWorking.current && !tp.present && sim.engineOn) logEvent(sim, 'warn', 'Idle started: engine on, no truck')
    prevWorking.current = sim.working

    // idle accounting (site time)
    if (sim.engineOn && !sim.working) {
      sim.idleSec += dt * 15
      sim.idleFuelL += (3.8 * dt * 15) / 3600
    }

    // excavator pose
    if (sim.working) {
      const before = Math.floor(cycleT.current / (SEG * (KEYS.length - 1)))
      cycleT.current += dt
      const after = Math.floor(cycleT.current / (SEG * (KEYS.length - 1)))
      if (after > before) sim.cycles += 1
    }
    const pose = lerpPose(cycleT.current)
    if (parts.house.current) {
      parts.house.current.rotation.y = pose.swing
      parts.boom.current.rotation.z = pose.boom
      parts.stick.current.rotation.z = pose.stick
      parts.bucket.current.rotation.z = pose.bucket
    }
  })
  return null
}

export default function SiteScene({ sim, onZone = () => {} }) {
  const parts = { house: useRef(), boom: useRef(), stick: useRef(), bucket: useRef() }
  const truckRef = useRef()
  const workerRef = useRef()
  const worker2 = useRef()

  return (
    <Canvas
      shadows
      camera={{ position: [-12.5, 8.5, 14], fov: 34 }}
      dpr={[1, 1.5]}
      gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
    >
      <color attach="background" args={['#0f1216']} />
      <fog attach="fog" args={['#0f1216', 40, 110]} />
      <ambientLight intensity={0.28} />
      <hemisphereLight args={['#cfe4ff', '#2a2620', 0.35]} />
      <directionalLight position={[20, 30, 10]} intensity={2.1} castShadow shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-40} shadow-camera-right={40} shadow-camera-top={40} shadow-camera-bottom={-40} />
      <directionalLight position={[-16, 12, -10]} intensity={0.35} color="#8fb3ff" />
      <Environment preset="city" background={false} environmentIntensity={0.6} resolution={64} />
      <SiteDressing />
      <Excavator parts={parts} />
      <ZoneRing sim={sim} />
      <ContactShadows position={[0, 0.02, 0]} opacity={0.55} scale={22} blur={2.2} far={9} resolution={512} color="#000000" frames={1} />
      <Suspense fallback={null}>
        <Truck truckRef={truckRef} />
        <Worker workerRef={workerRef} url="/models/worker-d.glb" position={[15, 0, 9]} isNew label="Day 3 · Suresh" />
        <Worker workerRef={worker2} url="/models/worker-e.glb" position={[-20, 0, 4]} label="Spotter · Anbu" />
      </Suspense>
      <Controller sim={sim} parts={parts} truckRef={truckRef} workerRef={workerRef} onZone={onZone} />
      <OrbitControls target={[1.4, 1.1, 0.4]} maxPolarAngle={1.35} minDistance={9} maxDistance={55} />
    </Canvas>
  )
}

// recolours the swing ring every frame from sim.zone (cheaper than re-rendering React)
function ZoneRing({ sim }) {
  const ring = useRef()
  const fill = useRef()
  const colors = { clear: new THREE.Color('#22c55e'), caution: new THREE.Color('#f59e0b'), danger: new THREE.Color('#ef4444') }
  useFrame(() => {
    if (!ring.current) return
    ring.current.material.color.copy(colors[sim.zone])
    fill.current.material.color.copy(colors[sim.zone])
    fill.current.material.opacity = sim.zone === 'clear' ? 0.05 : 0.16
  })
  return (
    <group>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, 0.05, 0]}>
        <ringGeometry args={[9.6, 10, 96]} />
        <meshBasicMaterial transparent opacity={0.85} />
      </mesh>
      <mesh ref={fill} rotation-x={-Math.PI / 2} position={[0, 0.04, 0]}>
        <circleGeometry args={[9.6, 96]} />
        <meshBasicMaterial transparent opacity={0.05} />
      </mesh>
    </group>
  )
}
