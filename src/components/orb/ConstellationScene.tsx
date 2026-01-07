"use client";

import { useRef, useEffect, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, Line, Points, PointMaterial } from "@react-three/drei";
import { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { NODES, EDGES, type NodeId, type EdgeId, type SceneState } from "./timeline";

// Star colors based on stellar types
type NodeGroup = "user" | "page" | "economy" | "atelier";

const NODE_GROUP_COLORS: Record<NodeGroup, string> = {
  user: "#bfdbfe",     // pale blue-white star (A-type)
  page: "#fde68a",     // soft yellow-white star (G-type)
  economy: "#fb923c",  // warm orange star (K-type)
  atelier: "#f9fafb",  // very bright white/blue-white (O/B-type "big star")
};

function getNodeGroup(nodeId: NodeId): NodeGroup {
  switch (nodeId) {
    case "designers":
    case "vendors":
      return "user";
    case "projects":
    case "tags":
    case "editorials":
    case "discovery":
    case "events":
    case "products":
      return "page";
    case "boosts":
    case "earnings":
      return "economy";
    case "atelier":
    default:
      return "atelier";
  }
}

function getNodeColor(nodeId: NodeId): string {
  return NODE_GROUP_COLORS[getNodeGroup(nodeId)];
}

// Hand-authored 3D positions with real depth (Z values)
const NODE_POSITIONS: Record<NodeId, [number, number, number]> = {
  // Core star – Folio Atelier at the center, slightly toward the viewer
  atelier: [0, 0, 0],

  // Designer loop (left/front cluster)
  designers:  [-7,  0.5,  3],
  projects:   [-4, -1.0,  2],
  editorials: [-5,  2.5,  1],
  discovery:  [-2,  3.0,  3],

  // Tag → product → vendor spine (right, a bit behind)
  tags:       [ 2, -1.0, -1],
  products:   [ 5, -0.5, -2],
  vendors:    [ 8,  0.5, -1],

  // Events (higher, slight depth)
  events:     [-1,  5.0,  1],

  // Economics ring (below, wrapping Atelier, more depth)
  boosts:     [ 2.5, -3.5,  2],
  earnings:   [-2.5, -3.5, -2],
};

interface ConstellationSceneProps {
  state: SceneState;
  time: number;
  selectedNode: NodeId | null;
  selectedEdge: EdgeId | null;
  onNodeSelect: (id: NodeId) => void;
  onEdgeSelect: (id: EdgeId) => void;
  mode: "simulation" | "explore" | "present";
}

export function ConstellationScene({
  state,
  time,
  selectedNode,
  selectedEdge,
  onNodeSelect,
  onEdgeSelect,
  mode,
}: ConstellationSceneProps) {
  return (
    <div className="relative w-full h-full">
      {/* Metrics HUD */}
      <div className="absolute top-4 left-4 z-10 text-[11px] text-slate-400 space-y-1">
        <div className="font-semibold text-slate-200 text-xs tracking-[0.16em] uppercase">
          System Snapshot
        </div>
        <div className="font-mono text-[11px]">
          Designers:{" "}
          <span className="text-slate-100">
            {state.metrics.designers.toLocaleString()}
          </span>
        </div>
        <div className="font-mono text-[11px]">
          Editorials:{" "}
          <span className="text-slate-100">
            {state.metrics.editorials.toLocaleString()}
          </span>
        </div>
        <div className="font-mono text-[11px]">
          Vendors:{" "}
          <span className="text-slate-100">
            {state.metrics.vendors.toLocaleString()}
          </span>
        </div>
        <div className="font-mono text-[11px]">
          Earnings:{" "}
          <span className="text-slate-100">
            ${state.metrics.earningsUsd.toLocaleString()}
          </span>
        </div>
      </div>

      <Canvas
        camera={{ position: [0, 8, 28], fov: 40, near: 0.1, far: 200 }}
        className="w-full h-full"
      >
        <color attach="background" args={["#020617"]} />
        
        <ambientLight intensity={0.3} />
        <pointLight position={[10, 10, 10]} intensity={0.5} />
        <pointLight position={[-10, -10, -10]} intensity={0.2} />

        {/* Starfield background */}
        <Starfield />

        <ConstellationRoot
          state={state}
          time={time}
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          onNodeSelect={onNodeSelect}
          onEdgeSelect={onEdgeSelect}
          mode={mode}
        />

        <OrbitControlsWrapper mode={mode} />
      </Canvas>
    </div>
  );
}

// Faint starfield background
function Starfield() {
  const points = useMemo(() => {
    const positions = new Float32Array(1500 * 3);
    for (let i = 0; i < 1500; i++) {
      const radius = 80 + Math.random() * 40;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);
      positions.set([x, y, z], i * 3);
    }
    return positions;
  }, []);

  return (
    <Points positions={points} stride={3}>
      <PointMaterial
        transparent
        size={0.7}
        sizeAttenuation
        depthWrite={false}
        color="#e5e7eb"
        opacity={0.35}
      />
    </Points>
  );
}

// Root group that rotates the entire constellation
function ConstellationRoot({
  state,
  time,
  selectedNode,
  selectedEdge,
  onNodeSelect,
  onEdgeSelect,
  mode,
}: {
  state: SceneState;
  time: number;
  selectedNode: NodeId | null;
  selectedEdge: EdgeId | null;
  onNodeSelect: (id: NodeId) => void;
  onEdgeSelect: (id: EdgeId) => void;
  mode: "simulation" | "explore" | "present";
}) {
  const graphRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (graphRef.current && mode !== "present") {
      // Gentle rotation in explore/simulation modes
      graphRef.current.rotation.y += delta * 0.06;
    }
  });

  return (
    <group ref={graphRef}>
      {/* Render all edges */}
      {EDGES.map((edge) => (
        <ConstellationEdge
          key={edge.id}
          edge={edge}
          selectedEdge={selectedEdge}
          selectedNode={selectedNode}
          state={state}
          onEdgeSelect={onEdgeSelect}
        />
      ))}

      {/* Render all nodes */}
      {NODES.map((node) => (
        <ConstellationNode
          key={node.id}
          nodeId={node.id}
          label={node.label}
          state={state}
          time={time}
          selectedNode={selectedNode}
          onNodeSelect={onNodeSelect}
        />
      ))}
    </group>
  );
}

// Individual star/node component
function ConstellationNode({
  nodeId,
  label,
  state,
  time,
  selectedNode,
  onNodeSelect,
}: {
  nodeId: NodeId;
  label: string;
  state: SceneState;
  time: number;
  selectedNode: NodeId | null;
  onNodeSelect: (id: NodeId) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const position = NODE_POSITIONS[nodeId] ?? [0, 0, 0];
  const intensity = state.nodeIntensity[nodeId] ?? 0;
  const isSelected = selectedNode === nodeId;
  const baseColor = getNodeColor(nodeId);
  const color = new THREE.Color(baseColor);
  const isAtelier = nodeId === "atelier";

  // Subtle, gentle breathing animation
  const pulse =
    1 +
    0.15 * intensity +         // keep a bit of size difference for "bigger" nodes
    0.03 * Math.sin(time * 1.5 + intensity * 2); // very gentle breathing

  const radiusBase = isAtelier ? 1.4 : 0.9;
  const radius = radiusBase * pulse + (isSelected ? 0.3 : 0);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group position={position}>
      {/* Very subtle halo */}
      <mesh scale={isAtelier ? [1.6, 1.6, 1.6] : [1.3, 1.3, 1.3]}>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshBasicMaterial
          color={baseColor}
          transparent
          opacity={isAtelier ? 0.25 : 0.12}
        />
      </mesh>

      {/* Core star */}
      <mesh
        ref={meshRef}
        onClick={() => onNodeSelect(nodeId)}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
      >
        <sphereGeometry args={[radius * 0.7, 32, 32]} />
        <meshStandardMaterial
          emissive={baseColor}
          emissiveIntensity={isAtelier ? 1.3 : 0.7}
          color="#020617"
          roughness={0.5}
          metalness={0.1}
        />
      </mesh>

      {/* Selection ring */}
      {isSelected && (
        <mesh>
          <ringGeometry args={[radius * 1.1, radius * 1.15, 32]} />
          <meshBasicMaterial
            color="#e5e7eb"
            transparent
            opacity={0.8}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Label */}
      <Html
        center
        distanceFactor={4.2}
        style={{
          pointerEvents: "none",
          fontSize: "24px",
          fontWeight: 600,
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
          color: "#020617",
          whiteSpace: "nowrap",
          textShadow:
            "0 0 4px rgba(248,250,252,0.9), 0 0 8px rgba(15,23,42,0.4)",
          letterSpacing: "0.02em",
        }}
      >
        {label}
      </Html>
    </group>
  );
}

// Individual edge component
function ConstellationEdge({
  edge,
  selectedEdge,
  selectedNode,
  state,
  onEdgeSelect,
}: {
  edge: { id: EdgeId; from: NodeId; to: NodeId };
  selectedEdge: EdgeId | null;
  selectedNode: NodeId | null;
  state: SceneState;
  onEdgeSelect: (id: EdgeId) => void;
}) {
  const fromPos = new THREE.Vector3(...NODE_POSITIONS[edge.from]);
  const toPos = new THREE.Vector3(...NODE_POSITIONS[edge.to]);
  const mid = fromPos.clone().add(toPos).multiplyScalar(0.5);
  const control = mid.clone().add(new THREE.Vector3(0, 1.5, 0)); // arc upward

  const curve = new THREE.QuadraticBezierCurve3(fromPos, control, toPos);
  const points = curve.getPoints(50);
  const positions = points.map((p) => [p.x, p.y, p.z]).flat();

  const intensityFrom = state.nodeIntensity[edge.from] ?? 0;
  const intensityTo = state.nodeIntensity[edge.to] ?? 0;
  const avgIntensity = (intensityFrom + intensityTo) / 2;

  const edgeSelected = selectedEdge === edge.id;
  const nodeHighlighted =
    !!selectedNode &&
    (edge.from === selectedNode || edge.to === selectedNode);
  const isHighlighted = edgeSelected || nodeHighlighted;

  const fromColor = new THREE.Color(getNodeColor(edge.from));
  const edgeColor = fromColor.clone().lerp(new THREE.Color("#e5e7eb"), 0.3);

  const baseWidth = edgeSelected ? 9 : isHighlighted ? 7 : 5;
  const lineWidth = baseWidth + 1.2 * avgIntensity;

  const baseOpacity = edgeSelected ? 0.95 : isHighlighted ? 0.75 : 0.5;
  const opacity = baseOpacity + 0.2 * avgIntensity;

  return (
    <Line
      points={positions}
      color={edgeColor.getHex()}
      lineWidth={lineWidth}
      transparent
      opacity={opacity}
      frustumCulled={false}
      onClick={(e) => {
        e.stopPropagation();
        onEdgeSelect(edge.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    />
  );
}

// Camera controls with limits for 3D feel
function OrbitControlsWrapper({
  mode,
}: {
  mode: "simulation" | "explore" | "present";
}) {
  const controlsRef = useRef<OrbitControlsImpl>(null);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const frontAz = controls.getAzimuthalAngle();
    const frontPol = controls.getPolarAngle();

    const azSpread = Math.PI * 0.5;   // ±90°
    const polSpread = Math.PI * 0.2;  // ± ~36°

    controls.minAzimuthAngle = frontAz - azSpread;
    controls.maxAzimuthAngle = frontAz + azSpread;

    controls.minPolarAngle = frontPol - polSpread;
    controls.maxPolarAngle = frontPol + polSpread;
  }, []);

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.45}
      enableZoom={true}
      enableRotate={mode !== "present"}
      autoRotate={false}
      minDistance={18}
      maxDistance={40}
    />
  );
}

