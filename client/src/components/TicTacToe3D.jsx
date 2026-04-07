import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const CELL = 0.65;

function XPiece({ position, delay = 0 }) {
    const ref = useRef();
    const startY = position[1] + 4;
    const targetY = position[1];
    const elapsed = useRef(0);

    useFrame((_, delta) => {
        if (!ref.current) return;
        elapsed.current += delta;
        const t = Math.max(0, elapsed.current - delay);

        if (t < 0.7) {
            const progress = t / 0.7;
            const ease = 1 - Math.pow(1 - progress, 3);
            const bounce = progress > 0.85 ? Math.sin((progress - 0.85) * 20) * 0.06 * (1 - progress) : 0;
            ref.current.position.y = startY + (targetY - startY) * ease + bounce;
            ref.current.rotation.y = (1 - ease) * Math.PI * 1.5;
        } else {
            ref.current.position.y = targetY + Math.sin((t - 0.7) * 2) * 0.02;
            ref.current.rotation.y = 0;
        }
    });

    return (
        <group ref={ref} position={[position[0], startY, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
            <mesh rotation={[0, 0, Math.PI / 4]}>
                <boxGeometry args={[0.75, 0.12, 0.12]} />
                <meshStandardMaterial color="#22d3ee" emissive="#0891b2" emissiveIntensity={0.6} roughness={0.15} metalness={0.9} />
            </mesh>
            <mesh rotation={[0, 0, -Math.PI / 4]}>
                <boxGeometry args={[0.75, 0.12, 0.12]} />
                <meshStandardMaterial color="#22d3ee" emissive="#0891b2" emissiveIntensity={0.6} roughness={0.15} metalness={0.9} />
            </mesh>
        </group>
    );
}

function OPiece({ position, delay = 0 }) {
    const ref = useRef();
    const startY = position[1] + 4;
    const targetY = position[1];
    const elapsed = useRef(0);

    useFrame((_, delta) => {
        if (!ref.current) return;
        elapsed.current += delta;
        const t = Math.max(0, elapsed.current - delay);

        if (t < 0.8) {
            const progress = t / 0.8;
            const ease = 1 - Math.pow(1 - progress, 3);
            const bounce = progress > 0.85 ? Math.sin((progress - 0.85) * 18) * 0.08 * (1 - progress) : 0;
            ref.current.position.y = startY + (targetY - startY) * ease + bounce;
            ref.current.rotation.z = (1 - ease) * Math.PI * 1.2;
        } else {
            ref.current.position.y = targetY + Math.sin((t - 0.8) * 2) * 0.02;
            ref.current.rotation.z = 0;
        }
    });

    return (
        <mesh ref={ref} position={[position[0], startY, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.26, 0.08, 32, 64]} />
            <meshStandardMaterial color="#fb7185" emissive="#e11d48" emissiveIntensity={0.6} roughness={0.15} metalness={0.9} />
        </mesh>
    );
}

function GridBoard() {
    const extent = CELL * 1.5 + 0.15;
    const lines = useMemo(() => {
        const material = new THREE.LineBasicMaterial({ color: '#475569', transparent: true, opacity: 0.8 });
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
                <meshStandardMaterial color="#0f172a" transparent opacity={0.6} roughness={0.5} />
            </mesh>
            {lines.map((l, i) => <lineSegments key={i} geometry={l.geo} material={l.mat} />)}
        </group>
    );
}

function Particles({ color, count = 20 }) {
    const ref = useRef();
    const time = useRef(0);
    const positions = useMemo(() => {
        const pos = new Float32Array(count * 3);
        const seeds = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 5;
            pos[i * 3 + 1] = Math.random() * 3 - 0.5;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 5;
            seeds[i * 3] = Math.random() * 100;
            seeds[i * 3 + 1] = Math.random() * 100;
            seeds[i * 3 + 2] = Math.random() * 100;
        }
        return { pos, seeds };
    }, [count]);

    useFrame((_, delta) => {
        if (!ref.current) return;
        time.current += delta;
        const arr = ref.current.geometry.attributes.position.array;
        for (let i = 0; i < count; i++) {
            arr[i * 3] += Math.sin(time.current * 0.3 + positions.seeds[i * 3]) * 0.001;
            arr[i * 3 + 1] += Math.cos(time.current * 0.4 + positions.seeds[i * 3 + 1]) * 0.0015;
            arr[i * 3 + 2] += Math.sin(time.current * 0.2 + positions.seeds[i * 3 + 2]) * 0.001;
        }
        ref.current.geometry.attributes.position.needsUpdate = true;
    });

    return (
        <points ref={ref}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" count={count} array={positions.pos} itemSize={3} />
            </bufferGeometry>
            <pointsMaterial size={0.03} color={color} transparent opacity={0.4} sizeAttenuation />
        </points>
    );
}

function Scene() {
    const groupRef = useRef();
    const time = useRef(0);
    const mouse = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const handleMouseMove = (e) => {
            mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    useFrame((_, delta) => {
        if (!groupRef.current) return;
        time.current += delta;
        
        const targetY = Math.sin(time.current * 0.1) * 0.15 + mouse.current.x * 0.4;
        const targetX = mouse.current.y * 0.2;
        const targetZ = Math.cos(time.current * 0.08) * 0.05;

        groupRef.current.rotation.y += (targetY - groupRef.current.rotation.y) * 4 * delta;
        groupRef.current.rotation.x += (targetX - groupRef.current.rotation.x) * 4 * delta;
        groupRef.current.rotation.z += (targetZ - groupRef.current.rotation.z) * 4 * delta;
        
        groupRef.current.position.y = -0.2 + Math.sin(time.current * 0.2) * 0.05;
    });

    return (
        <>
            <ambientLight intensity={0.4} />
            <directionalLight position={[4, 6, 2]} intensity={0.8} color="#ffffff" />
            <pointLight position={[-3, 3, -2]} intensity={0.6} color="#22d3ee" />
            <pointLight position={[3, 3, 2]} intensity={0.6} color="#fb7185" />
            
            <group ref={groupRef}>
                <GridBoard />
                <XPiece position={[-CELL, 0.08, -CELL]} delay={0.4} />
                <OPiece position={[0, 0.08, 0]} delay={0.9} />
                <XPiece position={[CELL, 0.08, -CELL]} delay={1.4} />
                <OPiece position={[-CELL, 0.08, CELL]} delay={1.9} />
                <XPiece position={[0, 0.08, -CELL]} delay={2.3} />
                <OPiece position={[CELL, 0.08, 0]} delay={2.8} />
                <XPiece position={[CELL, 0.08, CELL]} delay={3.2} />
            </group>
            
            <Particles color="#22d3ee" count={25} />
            <Particles color="#fb7185" count={25} />
        </>
    );
}

export default function TicTacToe3D() {
    return (
        <div className="w-full h-full absolute inset-0 pointer-events-none overflow-hidden">
            <Canvas
                camera={{ position: [3.4, 4.1, 3.4], fov: 32 }}
                gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
                style={{ background: 'transparent' }}
                dpr={[1, Math.min(window.devicePixelRatio, 2)]}
            >
                <Scene />
            </Canvas>
        </div>
    );
}
