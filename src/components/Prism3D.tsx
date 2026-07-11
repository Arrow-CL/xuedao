"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Line, Text, Html } from "@react-three/drei";
import { useRef, useState, Suspense } from "react";
import * as THREE from "three";

/**
 * 可交互3D直三棱柱组件
 * 
 * 第15题：直三棱柱 ABC-A1B1C1
 * - ∠ACB = 90°, AC = BC
 * - D 为 AB 中点, E 为 A1C1 中点
 * 
 * 支持：旋转、缩放、点击点显示坐标
 */

// 棱柱顶点坐标（a=4, h=2，与题目解答一致）
const A: [number, number, number] = [4, 0, 0];
const B: [number, number, number] = [0, 4, 0];
const C: [number, number, number] = [0, 0, 0];
const A1: [number, number, number] = [4, 0, 2];
const B1: [number, number, number] = [0, 4, 2];
const C1: [number, number, number] = [0, 0, 2];
const D: [number, number, number] = [2, 2, 0];   // AB中点
const E: [number, number, number] = [2, 0, 2];   // A1C1中点

// 所有点
const points = [
  { pos: A, label: "A", color: "#ef4444" },
  { pos: B, label: "B", color: "#3b82f6" },
  { pos: C, label: "C", color: "#10b981" },
  { pos: A1, label: "A₁", color: "#ef4444" },
  { pos: B1, label: "B₁", color: "#3b82f6" },
  { pos: C1, label: "C₁", color: "#10b981" },
  { pos: D, label: "D", color: "#f59e0b" },
  { pos: E, label: "E", color: "#f59e0b" },
];

// 实线边
const solidEdges: [number, number, number][][] = [
  // 下底面
  [A, B], [B, C], [C, A],
  // 上底面
  [A1, B1], [B1, C1], [C1, A1],
  // 侧棱
  [A, A1], [B, B1], [C, C1],
];

// 虚线（DE连线）
const dashedEdges: [number, number, number][][] = [
  [D, E],
];

// 坐标轴
const axisLength = 5.5;

function PointDot({
  position,
  label,
  color,
}: {
  position: [number, number, number];
  label: string;
  color: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <group position={position}>
      <mesh
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <Html
        center
        distanceFactor={10}
        style={{ pointerEvents: "none" }}
      >
        <div
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: color,
            textShadow: "0 0 4px white, 0 0 4px white",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>
      </Html>
      {hovered && (
        <Html center distanceFactor={10} position={[0, -0.4, 0]}>
          <div
            style={{
              background: "rgba(0,0,0,0.8)",
              color: "white",
              padding: "2px 8px",
              borderRadius: "4px",
              fontSize: "11px",
              whiteSpace: "nowrap",
            }}
          >
            ({position[0]}, {position[1]}, {position[2]})
          </div>
        </Html>
      )}
    </group>
  );
}

function Axes() {
  return (
    <group>
      {/* X轴 */}
      <Line points={[[0, 0, 0], [axisLength, 0, 0]]} color="#ef4444" lineWidth={1.5} dashed={false} />
      <Html position={[axisLength + 0.3, 0, 0]} center>
        <span style={{ color: "#ef4444", fontSize: "12px", fontWeight: 600 }}>x</span>
      </Html>
      {/* Y轴 */}
      <Line points={[[0, 0, 0], [0, axisLength, 0]]} color="#3b82f6" lineWidth={1.5} />
      <Html position={[0, axisLength + 0.3, 0]} center>
        <span style={{ color: "#3b82f6", fontSize: "12px", fontWeight: 600 }}>y</span>
      </Html>
      {/* Z轴 */}
      <Line points={[[0, 0, 0], [0, 0, axisLength]]} color="#10b981" lineWidth={1.5} />
      <Html position={[0, 0, axisLength + 0.3]} center>
        <span style={{ color: "#10b981", fontSize: "12px", fontWeight: 600 }}>z</span>
      </Html>
    </group>
  );
}

function PrismScene() {
  const groupRef = useRef<THREE.Group>(null);

  // 初始旋转角度，让棱柱以好的视角呈现
  useFrame(() => {
    if (groupRef.current) {
      // 不自动旋转，由OrbitControls控制
    }
  });

  return (
    <group ref={groupRef} rotation={[0.3, -0.6, 0]}>
      {/* 坐标轴 */}
      <Axes />

      {/* 底面半透明 */}
      <mesh position={[2, 2, 0]}>
        <planeGeometry args={[Math.sqrt(32), Math.sqrt(32)]} />
        <meshStandardMaterial color="#e0e7ff" transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>

      {/* 实线边 */}
      {solidEdges.map((edge, i) => (
        <Line key={i} points={edge} color="#374151" lineWidth={2} />
      ))}

      {/* 虚线（DE） */}
      {dashedEdges.map((edge, i) => (
        <Line key={i} points={edge} color="#f59e0b" lineWidth={2} dashed dashSize={0.15} gapSize={0.1} />
      ))}

      {/* 所有点 */}
      {points.map((p) => (
        <PointDot key={p.label} position={p.pos} label={p.label} color={p.color} />
      ))}
    </group>
  );
}

export default function Prism3D({ height = 400 }: { height?: number }) {
  return (
    <div style={{ width: "100%", height }} className="rounded-xl border border-gray-200 overflow-hidden bg-white">
      <Canvas
        camera={{ position: [8, 6, 8], fov: 45 }}
        style={{ background: "#fafafa" }}
      >
        <Suspense fallback={null}>
          {/* 灯光 */}
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 10, 5]} intensity={0.8} />
          <directionalLight position={[-5, -5, -5]} intensity={0.3} />

          {/* 场景 */}
          <PrismScene />

          {/* 控制器 */}
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={5}
            maxDistance={25}
          />
        </Suspense>
      </Canvas>
      <div className="px-3 py-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
        <span>拖动旋转 | 滚轮缩放 | 悬停点查看坐标</span>
        <span className="text-amber-500">D(2,2,0) E(2,0,2)</span>
      </div>
    </div>
  );
}
