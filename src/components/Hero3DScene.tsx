import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Sphere, TorusKnot, Icosahedron, MeshDistortMaterial, Float } from '@react-three/drei';
import { useRef } from 'react';
import * as THREE from 'three';
import { useTheme } from '../contexts/ThemeContext';

function AnimatedBlob() {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.2;
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.3;
    }
  });

  return (
    <Sphere args={[1.5, 64, 64]} ref={meshRef}>
      <MeshDistortMaterial
        color="#00ff87"
        attach="material"
        distort={0.4}
        speed={2}
        roughness={0}
        metalness={0.8}
        wireframe
      />
    </Sphere>
  );
}

function FloatingShapes() {
  return (
    <>
      <Float speed={2} rotationIntensity={2} floatIntensity={3} position={[-4, 2, -2]}>
        <Icosahedron args={[0.8, 0]}>
          <meshStandardMaterial color="#00b8ff" wireframe opacity={0.5} transparent />
        </Icosahedron>
      </Float>
      
      <Float speed={1.5} rotationIntensity={1.5} floatIntensity={2} position={[4, -2, -3]}>
        <TorusKnot args={[0.6, 0.2, 64, 16]}>
          <meshStandardMaterial color="#a855f7" wireframe opacity={0.6} transparent />
        </TorusKnot>
      </Float>

      <Float speed={3} rotationIntensity={1} floatIntensity={4} position={[3, 3, -4]}>
        <Sphere args={[0.5, 16, 16]}>
          <meshStandardMaterial color="#ffbf00" wireframe opacity={0.4} transparent />
        </Sphere>
      </Float>
    </>
  );
}

export function Hero3DScene() {
  return (
    <div className="absolute inset-0 z-0 opacity-40 dark:opacity-60">
      <Canvas camera={{ position: [0, 0, 6], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        
        <AnimatedBlob />
        <FloatingShapes />
        
        <Stars 
          radius={50} 
          depth={50} 
          count={5000} 
          factor={4} 
          saturation={0} 
          fade 
          speed={1} 
        />
        <OrbitControls 
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.5}
        />
      </Canvas>
    </div>
  );
}
