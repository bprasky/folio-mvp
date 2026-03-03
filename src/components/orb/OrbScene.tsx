"use client";

import React from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, Line } from "@react-three/drei";
import { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { MathUtils } from "three";
import { NODES, EDGES, type NodeId, type EdgeId, type SceneState } from "./timeline";

// Semantic node groups:
// - "user": designers, vendors (people/accounts)
// - "page": projects, tags, editorials, discovery, events, products (surfaces/components)
// - "economy": boosts, earnings (monetization + performance)
// - "atelier": the AI brain
type NodeGroup = "user" | "page" | "economy" | "atelier";

const NODE_GROUP_COLORS: Record<NodeGroup, string> = {
  user: "#22d3ee",     // bright cyan – people / accounts
  page: "#fb923c",     // warm orange – pages & surfaces
  economy: "#facc15",  // gold – money / performance
  atelier: "#a855f7",  // electric violet – Folio Atelier
};

function getNodeGroup(nodeId: NodeId): NodeGroup {
  switch (nodeId) {
    // User types
    case "designers":
    case "vendors":
      return "user";

    // Pages / components of the site
    case "projects":
    case "tags":
    case "editorials":
    case "discovery":
    case "events":
    case "products":
      return "page";

    // Economic signals
    case "boosts":
    case "earnings":
      return "economy";

    // AI brain
    case "atelier":
    default:
      return "atelier";
  }
}

function getNodeColor(nodeId: NodeId): string {
  return NODE_GROUP_COLORS[getNodeGroup(nodeId)];
}

// Hand-crafted spherical layout for the orb.
// thetaDeg = rotation around the orb (−180..180, left to right)
// phiDeg   = elevation (0 = top, 90 = equator)
//
// Nodes that are strongly related are grouped in theta/phi space,
// but the whole set covers the visible front hemisphere.
const ORB_NODE_LAYOUT: Partial<
  Record<
    NodeId,
    {
      thetaDeg: number;
      phiDeg: number;
    }
  >
> = {
  // Core brain
  atelier:    { thetaDeg:   0,  phiDeg: 40 }, // central, slightly above midline

  // Designer loop (left → upper)
  designers:  { thetaDeg: -45,  phiDeg: 42 }, // left of center
  projects:   { thetaDeg: -20,  phiDeg: 30 }, // between designers and tags
  editorials: { thetaDeg: -30,  phiDeg: 58 }, // upper-left
  discovery:  { thetaDeg: -5,   phiDeg: 55 }, // upper-mid, near editorials

  // Tag → product → vendor spine (right side, tight)
  tags:       { thetaDeg:  15,  phiDeg: 32 }, // just right of projects
  products:   { thetaDeg:  30,  phiDeg: 35 }, // very close to tags
  vendors:    { thetaDeg:  45,  phiDeg: 42 }, // further right, same band

  // Events (feeding designers & projects)
  events:     { thetaDeg: -10,  phiDeg: 68 }, // upper-mid, closer to designers/projects

  // Economics ring (below Atelier, between users & vendors)
  boosts:     { thetaDeg:  10,  phiDeg: 63 }, // lower-right of Atelier
  earnings:   { thetaDeg: -10,  phiDeg: 63 }, // lower-left of Atelier
};

// Project a node onto the orb surface using the spherical layout above.
// If a node isn't explicitly laid out, we fall back to the old NODES x/y layout.
function projectNodeToOrb(
  nodeId: NodeId,
  coreRadius: number,
  offset = 0.5
): THREE.Vector3 {
  const layout = ORB_NODE_LAYOUT[nodeId];
  let theta: number;
  let phi: number;

  if (layout) {
    // Use explicit spherical layout (degrees → radians)
    theta = MathUtils.degToRad(layout.thetaDeg);
    phi = MathUtils.degToRad(layout.phiDeg);
  } else {
    // Fallback: map original 2D layout into hemisphere
    const node = NODES.find((n) => n.id === nodeId)!;
    const cx = 0.5;
    const cy = 0.5;
    const dx = node.x - cx;
    const dy = node.y - cy;

    const r = Math.min(1, Math.sqrt(dx * dx + dy * dy) / 0.5); // 0..1
    theta = Math.atan2(dy, dx);
    phi = r * (Math.PI / 2); // 0 (top) .. π/2 (equator)
  }

  const R = coreRadius + offset;

  const x = R * Math.cos(phi) * Math.cos(theta);
  const y = R * Math.sin(phi); // front hemisphere (positive y)
  const z = R * Math.cos(phi) * Math.sin(theta);

  return new THREE.Vector3(x, y, z);
}

interface OrbSceneProps {
  state: SceneState;
  time: number;
  selectedNode: NodeId | null;
  selectedEdgeId: EdgeId | null;
  onNodeSelect: (id: NodeId) => void;
  onEdgeSelect: (id: EdgeId) => void;
  mode: "simulation" | "explore" | "present";
}

export function OrbScene(props: OrbSceneProps) {
  const { state, time, selectedNode, selectedEdgeId, onNodeSelect, onEdgeSelect, mode } = props;
  const controlsRef = React.useRef<OrbitControlsImpl | null>(null);

  React.useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    // Whatever the camera sees on load is "front"
    const frontAzimuth = controls.getAzimuthalAngle();
    const frontPolar = controls.getPolarAngle();

    // Horizontal: tight sweep focused on front hemisphere only (content is ~40% of surface)
    const azimuthSpread = Math.PI * 0.25; // ~±45° - very tight to stay on front
    controls.minAzimuthAngle = frontAzimuth - azimuthSpread;
    controls.maxAzimuthAngle = frontAzimuth + azimuthSpread;

    // Vertical: keep us in a front / three-quarter band, not above or underneath
    const polarSpread = Math.PI * 0.15; // ~±27° - slightly tighter
    controls.minPolarAngle = frontPolar - polarSpread;
    controls.maxPolarAngle = frontPolar + polarSpread;
  }, []);

  return (
    <div className="relative w-full h-full min-h-[600px] rounded-[20px] border border-slate-800 bg-slate-950/70 shadow-[0_0_50px_rgba(15,23,42,0.9)]">
      {/* Metrics HUD overlay */}
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
        camera={{ position: [0, 0, 26], fov: 45 }}
        gl={{ antialias: true }}
        className="w-full h-full"
      >
        <color attach="background" args={["#020617"]} />
        <ambientLight intensity={0.4} />
        <pointLight position={[20, 20, 20]} intensity={1.4} />
        <pointLight position={[-20, -10, -10]} intensity={0.8} />

        <OrbRoot
          state={state}
          time={time}
          selectedNode={selectedNode}
          selectedEdgeId={selectedEdgeId}
          onNodeSelect={onNodeSelect}
          onEdgeSelect={onEdgeSelect}
          mode={mode}
        />

        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          enableZoom={true}
          zoomSpeed={0.5}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.4}
          minDistance={16}
          maxDistance={40}
        />
      </Canvas>
    </div>
  );
}

interface OrbRootProps extends OrbSceneProps {}

function OrbRoot({
  state,
  time,
  selectedNode,
  selectedEdgeId,
  onNodeSelect,
  onEdgeSelect,
  mode,
}: OrbRootProps) {
  const groupRef = React.useRef<THREE.Group>(null);

  // Fixed base radius for the orb; nodes and edges will sit on or just above this.
  const coreRadius = 7.5;

  // Global growth based on existing metrics + Atelier intensity.
  const views = state.metrics.discoveryViews ?? 0;
  const atelierSessions = state.metrics.atelierSessions ?? 0;
  const rawGrowth =
    Math.min(1, views / 30000) * 0.7 + Math.min(1, atelierSessions / 500) * 0.3;
  const atelierBoost = 0.4 * (state.nodeIntensity.atelier ?? 0);
  const globalGrowth = 0.6 + Math.pow(rawGrowth, 2) * 0.9 + atelierBoost;

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    // Slow rotation like a holographic orb.
    const rotationSpeed =
      mode === "simulation" || mode === "present" ? 0.12 : 0.04;
    groupRef.current.rotation.y += rotationSpeed * delta;
    groupRef.current.rotation.x += 0.02 * delta;
  });

  return (
    <group ref={groupRef}>
      {/* Central translucent core sphere */}
      <mesh>
        <sphereGeometry args={[coreRadius, 64, 64]} />
        <meshPhysicalMaterial
          transparent
          opacity={0.16}
          roughness={0.2}
          metalness={0.9}
          thickness={2}
          transmission={0.75}
          emissive={new THREE.Color("#38bdf8")}
          emissiveIntensity={0.3 + 0.4 * (state.nodeIntensity.atelier ?? 0)}
          clearcoat={1}
          clearcoatRoughness={0.15}
        />
      </mesh>

      {/* Glow shell */}
      <mesh>
        <sphereGeometry args={[coreRadius * 1.08, 64, 64]} />
        <meshBasicMaterial
          color={"#0ea5e9"}
          transparent
          opacity={0.06}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Edges */}
      {EDGES.map((edge) => (
        <EdgeBeam
          key={edge.id}
          edgeId={edge.id}
          fromId={edge.from}
          toId={edge.to}
          state={state}
          selectedNode={selectedNode}
          selectedEdgeId={selectedEdgeId}
          time={time}
          onEdgeSelect={onEdgeSelect}
          coreRadius={coreRadius}
        />
      ))}

      {/* Nodes */}
      {NODES.map((node) => (
        <NodeSphere
          key={node.id}
          nodeId={node.id}
          label={node.label}
          state={state}
          time={time}
          selectedNode={selectedNode}
          onNodeSelect={onNodeSelect}
          coreRadius={coreRadius}
        />
      ))}
    </group>
  );
}

interface NodeSphereProps {
  nodeId: NodeId;
  label: string;
  state: SceneState;
  time: number;
  selectedNode: NodeId | null;
  onNodeSelect: (id: NodeId) => void;
  coreRadius: number;
}

function NodeSphere({
  nodeId,
  label,
  state,
  time,
  selectedNode,
  onNodeSelect,
  coreRadius,
}: NodeSphereProps) {
  const meshRef = React.useRef<THREE.Mesh>(null);

  // Attach the node to the orb surface using the shared mapping.
  const pos = projectNodeToOrb(nodeId, coreRadius, 0.7);
  const [x, y, z] = [pos.x, pos.y, pos.z];

  const intensity = state.nodeIntensity[nodeId] ?? 0;
  const isSelected = selectedNode === nodeId;

  // Pulsing scale
  const pulse =
    1 +
    0.3 * intensity +
    0.1 * Math.sin(time * 2 + intensity * 3);
  const radius = 0.85 * pulse + (isSelected ? 0.3 : 0);

  // Color logic - use group colors
  const baseColor = getNodeColor(nodeId);
  const emissiveIntensity =
    0.3 + 0.7 * intensity + (isSelected ? 0.4 : 0);

  return (
    <group position={[x, y, z]}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onNodeSelect(nodeId);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "default";
        }}
      >
        <sphereGeometry args={[radius, 32, 32]} />
        <meshStandardMaterial
          color={baseColor}
          emissive={new THREE.Color(baseColor)}
          emissiveIntensity={emissiveIntensity}
          metalness={0.9}
          roughness={0.18}
        />
      </mesh>

      {/* Subtle halo */}
      <mesh scale={[1.45, 1.45, 1.45]}>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshBasicMaterial
          color={baseColor}
          transparent
          opacity={0.06 + 0.12 * intensity}
        />
      </mesh>

      {/* Label anchored to the node */}
      <Html
        center
        distanceFactor={4.2}
        style={{
          pointerEvents: "none",
          fontSize: "18px",
          fontWeight: 600,
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
          color: "#f9fafb",
          whiteSpace: "nowrap",
          textShadow: "0 0 14px rgba(15,23,42,0.95)",
          letterSpacing: "0.02em",
        }}
      >
        {label}
      </Html>
    </group>
  );
}

interface EdgeBeamProps {
  edgeId: EdgeId;
  fromId: NodeId;
  toId: NodeId;
  state: SceneState;
  time: number;
  selectedNode: NodeId | null;
  selectedEdgeId: EdgeId | null;
  onEdgeSelect: (id: EdgeId) => void;
  coreRadius: number;
}

function EdgeBeam({
  edgeId,
  fromId,
  toId,
  state,
  time,
  selectedNode,
  selectedEdgeId,
  onEdgeSelect,
  coreRadius,
}: EdgeBeamProps) {
  const lineRef = React.useRef<THREE.Line>(null);

  // Anchor both endpoints to the orb surface using the same mapping as nodes.
  const a = projectNodeToOrb(fromId, coreRadius, 0.7);
  const b = projectNodeToOrb(toId, coreRadius, 0.7);

  // Create a simple curved path between a and b
  const mid = a.clone().add(b).multiplyScalar(0.5);

  // Direction from the center of the orb out through the midpoint
  const center = new THREE.Vector3(0, 0, 0);
  const outward = mid.clone().sub(center).normalize();

  // Raise the control point slightly beyond the node radius so the curve
  // always stays outside the orb shell.
  const shellRadius = coreRadius + 0.9; // just outside node shell
  const curveHeight = 1.6;              // how much we bow outward

  const control = outward
    .clone()
    .multiplyScalar(shellRadius + curveHeight);

  const curve = new THREE.QuadraticBezierCurve3(a, control, b);
  const points = curve.getPoints(40);

  const pointArray = points.map((p) => [p.x, p.y, p.z]) as [number, number, number][];

  const intensityA = state.nodeIntensity[fromId] ?? 0;
  const intensityB = state.nodeIntensity[toId] ?? 0;
  const avgIntensity = (intensityA + intensityB) / 2;

  const isSelected = selectedEdgeId === edgeId;
  const isNodeHighlighted =
    !!selectedNode && (selectedNode === fromId || selectedNode === toId);

  const baseOpacity = isSelected ? 0.95 : isNodeHighlighted ? 0.75 : 0.5;
  const opacity = baseOpacity + 0.2 * avgIntensity;

  // Thicker defaults so they're easy to grab
  const baseWidth = isSelected ? 9 : isNodeHighlighted ? 7 : 5;
  const lineWidth = baseWidth + 1.2 * avgIntensity;

  const fromColor = new THREE.Color(getNodeColor(fromId));
  const edgeColor = fromColor.clone().lerp(new THREE.Color("#e5e7eb"), 0.3);

  return (
    <Line
      points={pointArray}
      lineWidth={lineWidth}
      color={edgeColor.getStyle()}
      transparent
      opacity={opacity}
      frustumCulled={false}
      onClick={(e) => {
        e.stopPropagation();
        onEdgeSelect(edgeId);
      }}
    />
  );
}
