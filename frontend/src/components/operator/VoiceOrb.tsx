import { useRef, type ComponentRef, type MutableRefObject } from 'react'
import type { Mesh } from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { MeshDistortMaterial, Sphere } from '@react-three/drei'

// amplitude is a ref (0..1), updated per animation frame from real playback
// data (see lib/voice.js) -- not a canned loop, so the orb genuinely tracks
// what's being said.
type Amp = MutableRefObject<number>

function OrbMesh({ amplitude, active }: { amplitude: Amp; active: boolean }) {
  const mat = useRef<ComponentRef<typeof MeshDistortMaterial>>(null)
  const mesh = useRef<Mesh>(null)
  useFrame((state, dt) => {
    const amp = amplitude.current
    const targetDistort = active ? 0.18 + amp * 0.55 : 0.08
    if (mat.current) mat.current.distort += (targetDistort - mat.current.distort) * Math.min(1, dt * 6)
    if (mesh.current) {
      const breathe = active ? 1 + amp * 0.14 : 1 + Math.sin(state.clock.elapsedTime * 1.4) * 0.02
      mesh.current.scale.setScalar(breathe)
      mesh.current.rotation.y += dt * (active ? 0.25 : 0.08)
    }
  })
  return (
    <Sphere ref={mesh} args={[1, 64, 64]}>
      <MeshDistortMaterial
        ref={mat}
        color="#ffc400"
        speed={active ? 3.2 : 0.8}
        distort={0.1}
        roughness={0.2}
        metalness={0.1}
      />
    </Sphere>
  )
}

export default function VoiceOrb({ active = false, amplitude, size = 140 }: { active?: boolean; amplitude: Amp; size?: number }) {
  return (
    <div style={{ width: size, height: size }}>
      <Canvas camera={{ position: [0, 0, 2.6] }} gl={{ alpha: true, antialias: true }}>
        <ambientLight intensity={1} />
        <directionalLight position={[2, 3, 4]} intensity={1.2} />
        <directionalLight position={[-2, -1, -3]} intensity={0.4} color="#fff4d6" />
        <OrbMesh amplitude={amplitude} active={active} />
      </Canvas>
    </div>
  )
}
