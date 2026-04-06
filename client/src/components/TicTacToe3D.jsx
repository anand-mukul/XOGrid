import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const CELL = 0.55;

function XPiece({ position, delay = 0 }) {
    const ref = useRef();
    const startY = position[1] + 4;
    const targetY = position[1];
    const elapsed = useRef(0);
    const landed = useRef(false);

    useFrame((_, delta) => {
        if (!ref.current) return;
        elapsed.current += delta;
        const t = Math.max(0, elapsed.current - delay);

        if (!landed.current) {
            const progress = Math.min(1, t / 0.7);
            const ease = 1 - Math.pow(1 - progress, 3);
            const bounce = progress > 0.85 ? Math.sin((progress - 0.85) * 20) * 0.06 * (1 - progress) : 0;
            ref.current.position.y = startY + (targetY - startY) * ease + bounce;
            ref.current.rotation.y = (1 - ease) * Math.PI * 1.5;
            if (progress >= 1) landed.current = true;
        } else {
            ref.current.position.y = targetY + Math.sin(elapsed.current * 1.2) * 0.015;
        }
    });

    return (
        <group ref={ref} position={[position[0], startY, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
            <mesh rotation={[0, 0, Math.PI / 4]}>
                <boxGeometry args={[0.65, 0.1, 0.1]} />
                <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.5} roughness={0.25} metalness={0.8} />
            </mesh>
            <mesh rotation={[0, 0, -Math.PI / 4]}>
                <boxGeometry args={[0.65, 0.1, 0.1]} />
                <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.5} roughness={0.25} metalness={0.8} />
            </mesh>
        </group>
    );
}

function OPiece({ position, delay = 0 }) {
    const ref = useRef();
    const startY = position[1] + 4;
    const targetY = position[1];
    const elapsed = useRef(0);
    const landed = useRef(false);

    useFrame((_, delta) => {
        if (!ref.current) return;
        elapsed.current += delta;
        const t = Math.max(0, elapsed.current - delay);

        if (!landed.current) {
            const progress = Math.min(1, t / 0.8);
            const ease = 1 - Math.pow(1 - progress, 3);
            const bounce = progress > 0.85 ? Math.sin((progress - 0.85) * 18) * 0.08 * (1 - progress) : 0;
            ref.current.position.y = startY + (targetY - startY) * ease + bounce;
            ref.current.rotation.z = (1 - ease) * Math.PI * 1.2;
            if (progress >= 1) landed.current = true;
        } else {
            ref.current.position.y = targetY + Math.sin(elapsed.current * 1.5 + 1) * 0.015;
        }
    });

    return (
        <mesh ref={ref} position={[position[0], startY, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.22, 0.07, 24, 48]} />
            <meshStandardMaterial color="#fb7185" emissive="#fb7185" emissiveIntensity={0.5} roughness={0.25} metalness={0.8} />
        </mesh>
    );
}

function GridBoard() {
    const extent = CELL * 1.5 + 0.15;
    const lines = useMemo(() => {
        const material = new THREE.LineBasicMaterial({ color: '#475569', transparent: true, opacity: 0.5 });
        const geometries = [];
        const half = CELL * 0.5;
        [-half, half].forEach(x => {
            const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 0.01, -extent), new THREE.Vector3(x, 0.01, extent)]);
            geometries.push({ geo, mat: material });
        });
        [-half, half].forEach(z => {
            const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-extent, 0.01, z), new THREE.Vector3(extent, 0.01, z)]);
            geometries.push({ geo, mat: material });
        });
        return geometries;
    }, []);

    const boardSize = extent * 2 + 0.2;

    return (
        <group>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
                <planeGeometry args={[boardSize, boardSize]} />
                <meshStandardMaterial color="#0f172a" transparent opacity={0.45} roughness={1} />
            </mesh>
            {lines.map((l, i) => <lineSegments key={i} geometry={l.geo} material={l.mat} />)}
        </group>
    );
}

function Particles() {
    const ref = useRef();
    const count = 20;
    const positions = useMemo(() => {
        const pos = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 4;
            pos[i * 3 + 1] = Math.random() * 2.5 - 0.3;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 4;
        }
        return pos;
    }, []);

    useFrame((state) => {
        if (!ref.current) return;
        const arr = ref.current.geometry.attributes.position.array;
        for (let i = 0; i < count; i++) {
            arr[i * 3 + 1] += Math.sin(state.clock.elapsedTime * 0.5 + i) * 0.001;
        }
        ref.current.geometry.attributes.position.needsUpdate = true;
    });

    return (
        <points ref={ref}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
            </bufferGeometry>
            <pointsMaterial size={0.02} color="#22d3ee" transparent opacity={0.3} sizeAttenuation />
        </points>
    );
}

function Scene() {
    const groupRef = useRef();
    useFrame((state) => {
        if (!groupRef.current) return;
        groupRef.current.rotation.y = state.clock.elapsedTime * 0.06;
    });

    return (
        <>
            <ambientLight intensity={0.35} />
            <directionalLight position={[5, 8, 5]} intensity={0.7} color="#e2e8f0" />
            <pointLight position={[-3, 3, -2]} intensity={0.4} color="#22d3ee" />
            <pointLight position={[3, 3, 2]} intensity={0.25} color="#fb7185" />
            <group ref={groupRef} position={[0, -0.2, 0]}>
                <GridBoard />
                <XPiece position={[-CELL, 0.08, -CELL]} delay={0.4} />
                <OPiece position={[0, 0.08, 0]} delay={0.9} />
                <XPiece position={[CELL, 0.08, -CELL]} delay={1.4} />
                <OPiece position={[-CELL, 0.08, CELL]} delay={1.9} />
                <XPiece position={[0, 0.08, -CELL]} delay={2.3} />
                <OPiece position={[CELL, 0.08, 0]} delay={2.8} />
                <XPiece position={[CELL, 0.08, CELL]} delay={3.2} />
            </group>
            <Particles />
        </>
    );
}

export default function TicTacToe3D() {
    return (
        <div className="w-full h-full absolute inset-0 pointer-events-none overflow-hidden">
            <Canvas
                camera={{ position: [3.2, 3.8, 3.2], fov: 28 }}
                gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
                style={{ background: 'transparent' }}
                dpr={[1, Math.min(window.devicePixelRatio, 1.5)]}
            >
                <Scene />
            </Canvas>
        </div>
    );
}
