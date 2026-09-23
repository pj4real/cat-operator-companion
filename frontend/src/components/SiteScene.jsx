import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls, Line } from '@react-three/drei'
import * as THREE from 'three'
import { truckPhase, logEvent } from '../lib/sim'

const YELLOW = '#f2b705'
const DARK = '#2b2f35'

// Excavator dig -> lift -> swing -> dump -> return cycle (radians)
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

function Excavator({ parts }) {
  return (
    <group>
      {/* tracks */}
      {[-1.1, 1.1].map((z) => (
        <mesh key={z} position={[0, 0.45, z]} castShadow>
          <boxGeometry args={[4.6, 0.9, 0.75]} />
          <meshStandardMaterial color="#1c1f23" roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, 0.95, 0]} castShadow>
        <boxGeometry args={[2.2, 0.35, 1.6]} />
        <meshStandardMaterial color={DARK} />
      </mesh>
      {/* upper house: swings */}
      <group ref={parts.house} position={[0, 1.15, 0]}>
        <mesh position={[-0.2, 0.55, 0]} castShadow>
          <boxGeometry args={[3.0, 1.1, 2.5]} />
          <meshStandardMaterial color={YELLOW} roughness={0.5} />
        </mesh>
        <mesh position={[-1.95, 0.5, 0]} castShadow>
          <boxGeometry args={[0.8, 1.05, 2.5]} />
          <meshStandardMaterial color="#3a3f46" />
        </mesh>
        {/* cab */}
        <mesh position={[0.75, 1.75, 0.75]} castShadow>
          <boxGeometry args={[1.0, 1.4, 0.95]} />
          <meshStandardMaterial color="#9fb7c9" transparent opacity={0.55} metalness={0.3} />
        </mesh>
        <mesh position={[0.75, 2.47, 0.75]}>
          <boxGeometry args={[1.05, 0.06, 1.0]} />
          <meshStandardMaterial color={YELLOW} />
        </mesh>
        {/* boom -> stick -> bucket */}
        <group ref={parts.boom} position={[1.2, 1.0, -0.25]}>
          <mesh position={[2.8, 0, 0]} castShadow>
            <boxGeometry args={[5.6, 0.55, 0.5]} />
            <meshStandardMaterial color={YELLOW} roughness={0.5} />
          </mesh>
          <group ref={parts.stick} position={[5.6, 0, 0]}>
            <mesh position={[1.5, 0, 0]} castShadow>
              <boxGeometry args={[3.0, 0.4, 0.38]} />
              <meshStandardMaterial color={YELLOW} roughness={0.5} />
            </mesh>
            <group ref={parts.bucket} position={[3.0, 0, 0]}>
              <mesh position={[0.35, -0.25, 0]} castShadow>
                <boxGeometry args={[0.8, 0.85, 1.1]} />
                <meshStandardMaterial color="#30343a" metalness={0.4} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}

function Truck({ truckRef }) {
  return (
    <group ref={truckRef} position={[-60, 0, -7.6]}>
      <mesh position={[0, 1.1, 0]} castShadow>
        <boxGeometry args={[7.2, 0.5, 2.5]} />
        <meshStandardMaterial color="#25282d" />
      </mesh>
      <mesh position={[3.0, 2.2, 0]} castShadow>
        <boxGeometry args={[1.5, 1.7, 2.5]} />
        <meshStandardMaterial color="#e0e4e8" />
      </mesh>
      <mesh position={[-0.8, 2.1, 0]} castShadow>
        <boxGeometry args={[4.8, 1.5, 2.6]} />
        <meshStandardMaterial color="#d9822b" />
      </mesh>
      {[-2.5, -1.2, 2.8].map((x) =>
        [-1.2, 1.2].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.55, z]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.55, 0.55, 0.4, 16]} />
            <meshStandardMaterial color="#111" />
          </mesh>
        )),
      )}
      <Html position={[0, 4.2, 0]} center distanceFactor={28}>
        <div className="rounded bg-black/70 px-2 py-0.5 text-[11px] text-white whitespace-nowrap">Dumper T-07</div>
      </Html>
    </group>
  )
}

function Worker({ workerRef, isNew, label, position }) {
  const ring = useRef()
  useFrame(({ clock }) => {
    if (!ring.current) return
    const s = 1 + (clock.elapsedTime % 1.2) * 0.6
    ring.current.scale.set(s, s, s)
    ring.current.material.opacity = 0.9 - (clock.elapsedTime % 1.2) * 0.7
  })
  return (
    <group ref={workerRef} position={position}>
      <mesh position={[0, 0.75, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.28, 1.3, 12]} />
        <meshStandardMaterial color="#ff7a00" emissive="#ff7a00" emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[0, 1.6, 0]}>
        <sphereGeometry args={[0.22, 12, 12]} />
        <meshStandardMaterial color={isNew ? '#22c55e' : '#f5f5f5'} />
      </mesh>
      {isNew && (
        <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, 0.05, 0]}>
          <ringGeometry args={[0.7, 0.9, 32]} />
          <meshBasicMaterial color="#22c55e" transparent />
        </mesh>
      )}
      <Html position={[0, 2.3, 0]} center distanceFactor={26}>
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
        <meshStandardMaterial color="#3b3328" roughness={1} />
      </mesh>
      <gridHelper args={[220, 110, '#4a4034', '#433a2f']} position={[0, 0.01, 0]} />
      {/* haul road */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.015, -7.6]}>
        <planeGeometry args={[140, 5]} />
        <meshStandardMaterial color="#56493a" />
      </mesh>
      {/* trench being dug */}
      <mesh position={[9, -0.2, 0]}>
        <boxGeometry args={[9, 0.5, 1.6]} />
        <meshStandardMaterial color="#1f1a14" />
      </mesh>
      {/* spoil pile */}
      <mesh position={[9, 0.5, 3.4]} scale={[3.5, 1, 1.3]}>
        <sphereGeometry args={[1, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#5a4a36" />
      </mesh>
      {/* buried fibre route from Call Before u Dig */}
      <Line points={fibre} color="#fb923c" lineWidth={3} dashed dashSize={0.8} gapSize={0.5} />
      <Html position={[16, 0.3, 0.9]} center distanceFactor={30}>
        <div className="rounded border border-orange-400/60 bg-black/75 px-2 py-1 text-[11px] text-orange-300 whitespace-nowrap">Fibre route · 1.2 m deep · E-floor 0.9 m</div>
      </Html>
      {/* power line */}
      {[-25, 0, 25].map((x) => (
        <mesh key={x} position={[x, 4.5, -22]}>
          <cylinderGeometry args={[0.18, 0.25, 9, 8]} />
          <meshStandardMaterial color="#6b6f75" />
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
      <mesh position={[-22, 1.5, 8]} castShadow>
        <boxGeometry args={[6, 3, 3]} />
        <meshStandardMaterial color="#4b5563" />
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
    <Canvas shadows camera={{ position: [-20, 17, 22], fov: 42 }} dpr={[1, 2]}>
      <color attach="background" args={['#0f1216']} />
      <fog attach="fog" args={['#0f1216', 45, 120]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[20, 30, 10]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-40} shadow-camera-right={40} shadow-camera-top={40} shadow-camera-bottom={-40} />
      <SiteDressing />
      <Excavator parts={parts} />
      <ZoneRing sim={sim} />
      <Truck truckRef={truckRef} />
      <Worker workerRef={workerRef} position={[15, 0, 9]} isNew label="Day 3 · Suresh" />
      <Worker workerRef={worker2} position={[-20, 0, 4]} label="Spotter · Anbu" />
      <Controller sim={sim} parts={parts} truckRef={truckRef} workerRef={workerRef} onZone={onZone} />
      <OrbitControls target={[2, 0, -1]} maxPolarAngle={1.35} minDistance={12} maxDistance={70} />
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
