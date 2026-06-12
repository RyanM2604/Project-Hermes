"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas, ThreeEvent, useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface GlobeUniforms {
  uTime: { value: number };
  uColor: { value: THREE.Color };
  uFrequency: { value: number };
  [key: string]: THREE.IUniform<unknown>;
}

interface NetworkGlobeProps {
  nodeCount?: number;
  connectionDistance?: number;
}

const continentOutlines = [
  [
    [-168, 72], [-140, 70], [-125, 55], [-115, 50], [-105, 30], [-95, 18],
    [-82, 24], [-75, 40], [-60, 48], [-52, 60], [-75, 72], [-110, 72],
    [-140, 60], [-168, 72],
  ],
  [
    [-82, 12], [-74, 4], [-68, -15], [-58, -35], [-50, -55], [-38, -22],
    [-35, 0], [-50, 10], [-68, 12], [-82, 12],
  ],
  [
    [-18, 36], [0, 45], [28, 40], [40, 30], [50, 12], [43, -12],
    [28, -34], [12, -35], [2, -12], [-10, 5], [-18, 20], [-18, 36],
  ],
  [
    [-10, 36], [5, 52], [28, 60], [55, 58], [80, 70], [120, 62],
    [160, 55], [150, 38], [120, 25], [105, 5], [75, 8], [58, 25],
    [40, 30], [28, 40], [5, 45], [-10, 36],
  ],
  [
    [112, -11], [130, -12], [151, -24], [145, -42], [120, -35], [112, -11],
  ],
  [
    [-52, 60], [-42, 74], [-22, 80], [-18, 65], [-35, 58], [-52, 60],
  ],
] as const;

function latLonToVector(longitude: number, latitude: number, radius = 2.025) {
  const phi = THREE.MathUtils.degToRad(90 - latitude);
  const theta = THREE.MathUtils.degToRad(longitude + 180);

  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

const nodeShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color("#72ddff") },
    uFrequency: { value: 2.2 },
  } as GlobeUniforms,
  vertexShader: `
    varying float vBlink;
    uniform float uTime;
    uniform float uFrequency;
    attribute float aOffset;

    void main() {
      vBlink = 0.45 + abs(sin((uTime * uFrequency) + aOffset)) * 0.55;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = (14.0 + (vBlink * 18.0)) * (1.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform vec3 uColor;
    varying float vBlink;

    void main() {
      float distanceFromCenter = distance(gl_PointCoord, vec2(0.5));
      if (distanceFromCenter > 0.5) discard;
      float glow = smoothstep(0.5, 0.0, distanceFromCenter);
      gl_FragColor = vec4(uColor, glow * vBlink);
    }
  `,
};

function NetworkGlobe({
  nodeCount = 520,
  connectionDistance = 0.52,
}: NetworkGlobeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const nodeMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const targetRotation = useRef({ x: 0, y: 0 });
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const { pointsGeometry, highlightGeometry, linesGeometry } = useMemo(() => {
    const radius = 2;
    const nodes: THREE.Vector3[] = [];
    const offsets = new Float32Array(nodeCount);

    for (let index = 0; index < nodeCount; index++) {
      const phi = Math.acos(-1 + (2 * index) / nodeCount);
      const theta = Math.sqrt(nodeCount * Math.PI) * phi;

      nodes.push(
        new THREE.Vector3(
          radius * Math.cos(theta) * Math.sin(phi),
          radius * Math.sin(theta) * Math.sin(phi),
          radius * Math.cos(phi),
        ),
      );
      offsets[index] = (index / nodeCount) * Math.PI * 2;
    }

    const linePositions: number[] = [];
    const lineColors: number[] = [];
    const lineColor = new THREE.Color("#3bbcff");

    for (let left = 0; left < nodes.length; left++) {
      for (let right = left + 1; right < nodes.length; right++) {
        const distance = nodes[left].distanceTo(nodes[right]);
        if (distance < connectionDistance) {
          linePositions.push(
            nodes[left].x,
            nodes[left].y,
            nodes[left].z,
            nodes[right].x,
            nodes[right].y,
            nodes[right].z,
          );

          const intensity = 1 - distance / connectionDistance;
          lineColors.push(
            lineColor.r,
            lineColor.g,
            lineColor.b,
            intensity * 0.8,
            lineColor.r,
            lineColor.g,
            lineColor.b,
            intensity * 0.8,
          );
        }
      }
    }

    const points = new THREE.BufferGeometry().setFromPoints(nodes);
    points.setAttribute("aOffset", new THREE.BufferAttribute(offsets, 1));

    const highlights = new THREE.BufferGeometry().setFromPoints(
      nodes.filter((_, index) => index % 17 === 0),
    );

    const lines = new THREE.BufferGeometry();
    lines.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(linePositions, 3),
    );
    lines.setAttribute("color", new THREE.Float32BufferAttribute(lineColors, 4));

    return {
      pointsGeometry: points,
      highlightGeometry: highlights,
      linesGeometry: lines,
    };
  }, [connectionDistance, nodeCount]);

  const continentGeometries = useMemo(
    () =>
      continentOutlines.map((outline) =>
        new THREE.BufferGeometry().setFromPoints(
          outline.map(([longitude, latitude]) =>
            latLonToVector(longitude, latitude),
          ),
        ),
      ),
    [],
  );

  useFrame(({ clock, pointer }) => {
    const elapsed = clock.getElapsedTime();

    if (!isDragging) {
      targetRotation.current.x = pointer.y * 0.22;
      targetRotation.current.y += 0.0025;
    }

    if (groupRef.current) {
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        targetRotation.current.x,
        0.035,
      );
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        targetRotation.current.y,
        0.035,
      );
      groupRef.current.rotation.z = Math.sin(elapsed * 0.18) * 0.04;
      const pulse = 1 + Math.sin(elapsed * 0.55) * 0.018;
      groupRef.current.scale.setScalar(pulse);
    }

    if (nodeMaterialRef.current) {
      nodeMaterialRef.current.uniforms.uTime.value = elapsed;
    }
  });

  function handlePointerDown(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    dragStart.current = { x: event.clientX, y: event.clientY };
    setIsDragging(true);
  }

  function handlePointerMove(event: ThreeEvent<PointerEvent>) {
    if (!isDragging || !dragStart.current) return;

    targetRotation.current.y += (event.clientX - dragStart.current.x) * 0.006;
    targetRotation.current.x += (event.clientY - dragStart.current.y) * 0.006;
    dragStart.current = { x: event.clientX, y: event.clientY };
  }

  function handlePointerUp() {
    dragStart.current = null;
    setIsDragging(false);
  }

  return (
    <group
      ref={groupRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <mesh>
        <sphereGeometry args={[1.97, 48, 48]} />
        <meshBasicMaterial
          color="#0b4f78"
          transparent
          opacity={0.12}
          wireframe
        />
      </mesh>

      {[0.72, 1.22].map((rotation) => (
        <mesh key={rotation} rotation={[rotation, 0.35, rotation / 2]}>
          <torusGeometry args={[2.08, 0.006, 8, 180]} />
          <meshBasicMaterial
            color="#71dcff"
            transparent
            opacity={0.32}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}

      {continentGeometries.map((geometry, index) => (
        <primitive
          key={index}
          object={
            new THREE.Line(
              geometry,
              new THREE.LineBasicMaterial({
                color: "#b8efff",
                transparent: true,
                opacity: 0.7,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
              }),
            )
          }
        />
      ))}

      <points geometry={pointsGeometry}>
        <shaderMaterial
          ref={nodeMaterialRef}
          args={[nodeShader]}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      <points geometry={highlightGeometry}>
        <pointsMaterial
          color="#ffffff"
          size={0.045}
          transparent
          opacity={0.95}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      <lineSegments geometry={linesGeometry}>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.75}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
    </group>
  );
}

export default function BackgroundGlobe() {
  return (
    <div className="globe-zoom-stage absolute inset-0 bg-[#050505]">
      <Canvas
        camera={{ fov: 43, position: [0, 0, 6] }}
        dpr={[1, 1.6]}
        gl={{ antialias: true, alpha: false }}
      >
        <NetworkGlobe />
      </Canvas>
    </div>
  );
}
