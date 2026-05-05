import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// --- Types & Interfaces ---

interface GlobeUniforms {
    uTime: { value: number };
    uColor: { value: THREE.Color };
    uFrequency: { value: number };
    // Add this index signature:
    [key: string]: THREE.IUniform<any>; 
  }

interface NetworkGlobeProps {
  nodeCount?: number;
  frequency?: number;
  connectionDistance?: number;
  color?: string;
}

// --- Shader Definition ---

const GlobeShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color("#00ffff") },
    uFrequency: { value: 2.0 },
  } as GlobeUniforms,
  vertexShader: `
    varying float vBlink;
    uniform float uTime;
    uniform float uFrequency;
    attribute float aOffset;
    
    void main() {
      // Different timing for each node via aOffset
      vBlink = abs(sin((uTime * uFrequency) + aOffset));
      
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      
      // Points pulse in size along with the alpha blink
      gl_PointSize = (10.0 + (vBlink * 12.0)) * (1.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform vec3 uColor;
    varying float vBlink;
    
    void main() {
      // Circular masking for the points
      float d = distance(gl_PointCoord, vec2(0.5));
      if (d > 0.5) discard;
      
      gl_FragColor = vec4(uColor, vBlink * 0.8);
    }
  `,
};

// --- Component ---

const NetworkGlobe: React.FC<NetworkGlobeProps> = ({ 
  nodeCount = 300, 
  frequency = 0.5,
  connectionDistance = 0.7,
  color = "#00ffff"
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const { pointsGeometry, linesGeometry } = useMemo(() => {
    const radius = 2;
    const nodes: THREE.Vector3[] = [];
    const offsets = new Float32Array(nodeCount);

    // 1. Distribute nodes using Fibonacci Sphere algorithm
    for (let i = 0; i < nodeCount; i++) {
      const phi = Math.acos(-1 + (2 * i) / nodeCount);
      const theta = Math.sqrt(nodeCount * Math.PI) * phi;
      
      nodes.push(new THREE.Vector3(
        radius * Math.cos(theta) * Math.sin(phi),
        radius * Math.sin(theta) * Math.sin(phi),
        radius * Math.cos(phi)
      ));
      
      // Random phase offset for the pulsating effect
      offsets[i] = Math.random() * Math.PI * 2;
    }

    // 2. Generate Edges
    const linePositions: number[] = [];
    const lineColors: number[] = [];
    const threeColor = new THREE.Color(color);

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dist = nodes[i].distanceTo(nodes[j]);
        if (dist < connectionDistance) {
          linePositions.push(nodes[i].x, nodes[i].y, nodes[i].z, nodes[j].x, nodes[j].y, nodes[j].z);
          
          // Shorter lines = higher opacity (simulating varied size/weight)
          const intensity = 1 - (dist / connectionDistance);
          lineColors.push(threeColor.r, threeColor.g, threeColor.b, intensity * 0.4);
          lineColors.push(threeColor.r, threeColor.g, threeColor.b, intensity * 0.4);
        }
      }
    }

    const pGeo = new THREE.BufferGeometry().setFromPoints(nodes);
    pGeo.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 1));
    
    const lGeo = new THREE.BufferGeometry();
    lGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    lGeo.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 4));

    return { pointsGeometry: pGeo, linesGeometry: lGeo };
  }, [nodeCount, connectionDistance, color]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    
    // Constant Y-Axis rotation
    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.1;
    }

    // Update Shader Uniforms
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = t;
      materialRef.current.uniforms.uFrequency.value = frequency;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Pulsating Nodes */}
      <points geometry={pointsGeometry}>
        <shaderMaterial 
          ref={materialRef}
          args={[GlobeShader]} 
          transparent 
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      
      {/* Connected Edges */}
      <lineSegments geometry={linesGeometry}>
        <lineBasicMaterial 
          vertexColors 
          transparent 
          depthWrite={false}
          blending={THREE.AdditiveBlending} 
        />
      </lineSegments>
    </group>
  );
};

export default function BackgroundGlobe() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#050505', position: 'fixed', top: 0, left: 0 }}>
      <Canvas camera={{ fov: 45 }}>
        <NetworkGlobe nodeCount={350} frequency={2.0} />
      </Canvas>
    </div>
  );
}