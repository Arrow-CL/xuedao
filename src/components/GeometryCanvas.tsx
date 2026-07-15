"use client";

import React, { useMemo, useRef, useEffect } from "react";
import type { StepGeometry } from "@/lib/presolve";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface GeometryAnnotation {
  type: "axis" | "point" | "vector" | "clear";
  params: Record<string, string>;
}

export interface GeometryDiagram {
  shape: "parallelogram" | "triangle" | "circle" | "polygon" | "coordinate";
  points: Record<string, { x: number; y: number }>;
  labels?: string[];
  annotations?: string[];
}

export interface GeometryCanvasProps {
  /** 初始几何体的 SVG path 数据 */
  initialPaths?: Array<{
    d: string;
    stroke?: string;
    dash?: boolean;
  }>;
  /** 初始标注的点（题目已有的点） */
  initialPoints?: Array<{
    label: string;
    x: number;
    y: number;
  }>;
  /** AI 动态添加的标注 */
  annotations?: GeometryAnnotation[];
  /** 几何图形描述（用于 Canvas 绘制） */
  diagram?: GeometryDiagram;
  /** 单步图形数据（数形结合） */
  stepGeometry?: StepGeometry;
  /** 图形宽度 */
  width?: number;
  /** 图形高度 */
  height?: number;
  /** 题目配图 URL，作为背景图叠加AI标注 */
  backgroundImageUrl?: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const VIEWBOX_SIZE = 200;
const AXIS_LENGTH = 70;
const TICK_SIZE = 3;
const ARROW_SIZE = 6;
const POINT_RADIUS = 3.5;
const LABEL_FONT_SIZE = 14;
const COORD_FONT_SIZE = 11;
const AXIS_TICK_COUNT = 5;
const AXIS_TICK_STEP = AXIS_LENGTH / AXIS_TICK_COUNT;

/* ------------------------------------------------------------------ */
/*  Helper: parse comma-separated numbers                              */
/* ------------------------------------------------------------------ */

function parseNums(s: string): number[] {
  return s.split(",").map((v) => parseFloat(v.trim()));
}

/* ------------------------------------------------------------------ */
/*  Sub-component: Step Diagram Canvas (数形结合——板书单步图形)        */
/*  支持逐步渲染：基础图形 → 标注点 → 向量 → 坐标系等                */
/* ------------------------------------------------------------------ */

function StepDiagramCanvas({ geo, compact = false }: { geo: StepGeometry; compact?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = compact ? 280 : 240;
    const H = compact ? 200 : 200;
    canvas.width = W;
    canvas.height = H;
    const scale = Math.min(W, H) / 120;

    ctx.clearRect(0, 0, W, H);

    const pts = geo.points || {};
    const keys = Object.keys(pts);

    // 1. 绘制坐标系（如果这一步要建立坐标系）
    if (geo.type === "coordinate-system" && geo.axis) {
      const ox = geo.axis.originX * scale;
      const oy = geo.axis.originY * scale;
      ctx.strokeStyle = "#666";
      ctx.lineWidth = 1;
      ctx.fillStyle = "#666";
      // x 轴
      ctx.beginPath();
      ctx.moveTo(ox - 5, oy);
      ctx.lineTo(ox + 60, oy);
      ctx.stroke();
      // 箭头
      ctx.beginPath();
      ctx.moveTo(ox + 60, oy);
      ctx.lineTo(ox + 55, oy - 3);
      ctx.lineTo(ox + 55, oy + 3);
      ctx.fill();
      // y 轴
      ctx.beginPath();
      ctx.moveTo(ox, oy + 5);
      ctx.lineTo(ox, oy - 60);
      ctx.stroke();
      // 箭头
      ctx.beginPath();
      ctx.moveTo(ox, oy - 60);
      ctx.lineTo(ox - 3, oy - 55);
      ctx.lineTo(ox + 3, oy - 55);
      ctx.fill();
      // 原点 O
      ctx.font = "10px sans-serif";
      ctx.textAlign = "right";
      ctx.fillText("O", ox - 4, oy + 12);
      // x, y 标签
      ctx.textAlign = "left";
      ctx.fillText("x", ox + 62, oy + 4);
      ctx.textAlign = "center";
      ctx.fillText("y", ox + 6, oy - 62);
      // 刻度
      const xTicks = geo.axis.xMax || 5;
      for (let i = 1; i <= xTicks; i++) {
        const tx = ox + i * (50 / xTicks);
        ctx.beginPath();
        ctx.moveTo(tx, oy - 2);
        ctx.lineTo(tx, oy + 2);
        ctx.stroke();
      }
      const yTicks = geo.axis.yMax || 5;
      for (let i = 1; i <= yTicks; i++) {
        const ty = oy - i * (50 / yTicks);
        ctx.beginPath();
        ctx.moveTo(ox - 2, ty);
        ctx.lineTo(ox + 2, ty);
        ctx.stroke();
      }
    }

    // 2. 绘制边/线段
    if (geo.edges && geo.edges.length > 0) {
      ctx.lineWidth = 2;
      for (const edge of geo.edges) {
        const from = pts[edge.from];
        const to = pts[edge.to];
        if (!from || !to) continue;

        ctx.strokeStyle = edge.style === "dashed" ? "#999"
          : edge.style === "bold" ? "#dc2626"
          : "#2563eb";

        if (edge.style === "dashed") ctx.setLineDash([4, 3]);
        else ctx.setLineDash([]);

        ctx.beginPath();
        ctx.moveTo(from.x * scale, from.y * scale);
        ctx.lineTo(to.x * scale, to.y * scale);
        ctx.stroke();

        // 标注边长（如果在 labels 中）
        if (geo.labels) {
          const edgeLabel = geo.labels.find(l =>
            l.includes(edge.from) && l.includes(edge.to)
          );
          if (edgeLabel) {
            const mx = (from.x + to.x) / 2 * scale;
            const my = (from.y + to.y) / 2 * scale;
            ctx.setLineDash([]);
            ctx.fillStyle = "#dc2626";
            ctx.font = "bold 11px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(edgeLabel, mx, my - 6);
          }
        }
      }
      ctx.setLineDash([]);
    }

    // 3. 绘制图形填充（没有 edges 时自动连接所有点）
    if (keys.length >= 3 && (!geo.edges || geo.edges.length === 0)) {
      ctx.fillStyle = "rgba(37,99,235,0.08)";
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2;
      ctx.beginPath();
      keys.forEach((k, i) => {
        const p = pts[k];
        if (i === 0) ctx.moveTo(p.x * scale, p.y * scale);
        else ctx.lineTo(p.x * scale, p.y * scale);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (keys.length >= 2 && (!geo.edges || geo.edges.length === 0)) {
      // 只有两个点，画线段
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2;
      ctx.beginPath();
      const a = pts[keys[0]], b = pts[keys[1]];
      ctx.moveTo(a.x * scale, a.y * scale);
      ctx.lineTo(b.x * scale, b.y * scale);
      ctx.stroke();
    }

    // 4. 绘制向量箭头
    if (geo.vectors && geo.vectors.length > 0) {
      for (const vec of geo.vectors) {
        const from = pts[vec.from];
        const to = pts[vec.to];
        if (!from || !to) continue;

        const fx = from.x * scale, fy = from.y * scale;
        const tx = to.x * scale, ty = to.y * scale;
        const dx = tx - fx, dy = ty - fy;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) continue;

        ctx.strokeStyle = "#e03131";
        ctx.fillStyle = "#e03131";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(tx, ty);
        ctx.stroke();

        // 箭头
        const angle = Math.atan2(dy, dx);
        const aSize = 8;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx - aSize * Math.cos(angle - Math.PI / 6), ty - aSize * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(tx - aSize * Math.cos(angle + Math.PI / 6), ty - aSize * Math.sin(angle + Math.PI / 6));
        ctx.fill();

        // 向量标签
        const mx = (fx + tx) / 2, my = (fy + ty) / 2;
        const nx = (-dy / len) * 12, ny = (dx / len) * 12;
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(vec.label, mx + nx, my + ny);
      }
    }

    // 5. 绘制顶点
    ctx.fillStyle = "#1e40af";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const k of keys) {
      const p = pts[k];
      const px = p.x * scale, py = p.y * scale;

      // 白色背景
      const tw = ctx.measureText(k).width;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillRect(px - tw / 2 - 3, py - 9, tw + 6, 18);

      // 点
      ctx.fillStyle = "#1e40af";
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();

      // 标签
      ctx.fillText(k, px, py);
    }

    // 6. 额外标注文字（非边长标注）
    if (geo.labels) {
      ctx.fillStyle = "#6b7280";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "left";
      let labelY = H - 10;
      const edgeLabels = new Set<string>();
      if (geo.edges) {
        for (const edge of geo.edges) {
          const l = geo.labels.find(l => l.includes(edge.from) && l.includes(edge.to));
          if (l) edgeLabels.add(l);
        }
      }
      for (const label of geo.labels) {
        if (edgeLabels.has(label)) continue;
        ctx.fillText(label, 6, labelY);
        labelY -= 13;
      }
    }

    // 7. caption（步骤说明）
    if (geo.caption) {
      ctx.fillStyle = "#9ca3af";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(geo.caption, W - 6, H - 6);
    }
  }, [geo, compact]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "100%",
        maxWidth: 280,
        height: "auto",
        borderRadius: 8,
        background: "white",
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-component: Diagram Canvas (基于 presolve diagram 数据绘制)     */
/* ------------------------------------------------------------------ */

function DiagramCanvas({ diagram }: { diagram: GeometryDiagram }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 设置画布大小
    const size = 240;
    canvas.width = size;
    canvas.height = size;
    const scale = size / 120; // 0-100 坐标映射到画布

    // 清空
    ctx.clearRect(0, 0, size, size);

    // 绘制图形
    const pts = diagram.points;
    const keys = Object.keys(pts);

    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2;
    ctx.fillStyle = "#dbeafe";

    if (diagram.shape === "parallelogram" && keys.length >= 4) {
      // 按 A-B-C-D 顺序绘制
      const order = ["A", "B", "C", "D"];
      ctx.beginPath();
      order.forEach((k, i) => {
        const p = pts[k];
        if (!p) return;
        const x = p.x * scale;
        const y = p.y * scale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (diagram.shape === "triangle" && keys.length >= 3) {
      const order = keys.slice(0, 3);
      ctx.beginPath();
      order.forEach((k, i) => {
        const p = pts[k];
        const x = p.x * scale;
        const y = p.y * scale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // 通用多边形
      ctx.beginPath();
      keys.forEach((k, i) => {
        const p = pts[k];
        const x = p.x * scale;
        const y = p.y * scale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      if (keys.length > 2) ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 绘制顶点标签
    ctx.fillStyle = "#1e40af";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    keys.forEach((k) => {
      const p = pts[k];
      const x = p.x * scale;
      const y = p.y * scale;
      // 标签背景
      const textWidth = ctx.measureText(k).width;
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.fillRect(x - textWidth / 2 - 3, y - 9, textWidth + 6, 18);
      // 标签文字
      ctx.fillStyle = "#1e40af";
      ctx.fillText(k, x, y);
    });

    // 绘制条件标注
    if (diagram.labels) {
      ctx.fillStyle = "#dc2626";
      ctx.font = "11px sans-serif";
      diagram.labels.forEach((label, i) => {
        ctx.fillText(label, 8, size - 8 - i * 14);
      });
    }
  }, [diagram]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", maxWidth: 240, height: "auto", borderRadius: 8 }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-component: SVG Canvas (原有标注模式)                           */
/* ------------------------------------------------------------------ */

function SvgCanvas({
  initialPaths = [],
  initialPoints = [],
  annotations = [],
  width = 300,
  height = 300,
  backgroundImageUrl,
}: Omit<GeometryCanvasProps, "diagram" | "stepGeometry">) {
  /**
   * 从 annotations 中提取动态标注，并处理 CLEAR 指令。
   * CLEAR 会清除它之前所有的动态标注。
   */
  const dynamicAnnotations = useMemo(() => {
    const result: GeometryAnnotation[] = [];
    for (const ann of annotations) {
      if (ann.type === "clear") {
        result.length = 0; // 清除所有已收集的动态标注
      } else {
        result.push(ann);
      }
    }
    return result;
  }, [annotations]);

  /** 提取 AXIS 注释（取最新的一个） */
  const axisAnnotation = useMemo(() => {
    for (let i = dynamicAnnotations.length - 1; i >= 0; i--) {
      if (dynamicAnnotations[i].type === "axis") return dynamicAnnotations[i];
    }
    return null;
  }, [dynamicAnnotations]);

  /** 提取 POINT 注释 */
  const pointAnnotations = useMemo(
    () => dynamicAnnotations.filter((a) => a.type === "point"),
    [dynamicAnnotations]
  );

  /** 提取 VECTOR 注释 */
  const vectorAnnotations = useMemo(
    () => dynamicAnnotations.filter((a) => a.type === "vector"),
    [dynamicAnnotations]
  );

  /** 坐标系原点位置（SVG 坐标） */
  const originX = axisAnnotation
    ? parseNums(axisAnnotation.params.origin || "100,100")[0]
    : 0;
  const originY = axisAnnotation
    ? parseNums(axisAnnotation.params.origin || "100,100")[1]
    : 0;

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
      width={width}
      height={height}
      className="block"
      style={{ background: "white" }}
    >
      {/* ---- 背景配图（题目原始图形） ---- */}
      {backgroundImageUrl && (
        <image
          href={backgroundImageUrl}
          x={0}
          y={0}
          width={VIEWBOX_SIZE}
          height={VIEWBOX_SIZE}
          preserveAspectRatio="xMidYMid meet"
          opacity={0.85}
        />
      )}

      {/* ---- 初始几何体 ---- */}
      {initialPaths.map((path, i) => (
        <path
          key={`init-path-${i}`}
          d={path.d}
          fill="none"
          stroke={path.stroke || "#1a1a1a"}
          strokeWidth={1.5}
          strokeDasharray={path.dash ? "4 3" : undefined}
        />
      ))}

      {/* ---- 初始点 ---- */}
      {initialPoints.map((pt) => (
        <g key={`init-pt-${pt.label}`}>
          <circle cx={pt.x} cy={pt.y} r={POINT_RADIUS} fill="#1a1a1a" />
          <text
            x={pt.x + 5}
            y={pt.y - 5}
            fontSize={LABEL_FONT_SIZE}
            fill="#1a1a1a"
            fontWeight={600}
          >
            {pt.label}
          </text>
        </g>
      ))}

      {/* ---- 坐标轴 ---- */}
      {axisAnnotation && (
        <g>
          {/* X 轴 */}
          <line
            x1={originX - 5}
            y1={originY}
            x2={originX + AXIS_LENGTH + ARROW_SIZE}
            y2={originY}
            stroke="#333"
            strokeWidth={1.2}
          />
          {/* X 轴箭头 */}
          <polygon
            points={`${originX + AXIS_LENGTH + ARROW_SIZE},${originY} ${originX + AXIS_LENGTH},${originY - ARROW_SIZE / 2} ${originX + AXIS_LENGTH},${originY + ARROW_SIZE / 2}`}
            fill="#333"
          />
          {/* X 轴标签 x */}
          <text
            x={originX + AXIS_LENGTH + ARROW_SIZE + 3}
            y={originY + 4}
            fontSize={COORD_FONT_SIZE}
            fill="#333"
            fontStyle="italic"
          >
            x
          </text>

          {/* Y 轴 */}
          <line
            x1={originX}
            y1={originY + 5}
            x2={originX}
            y2={originY - AXIS_LENGTH - ARROW_SIZE}
            stroke="#333"
            strokeWidth={1.2}
          />
          {/* Y 轴箭头 */}
          <polygon
            points={`${originX},${originY - AXIS_LENGTH - ARROW_SIZE} ${originX - ARROW_SIZE / 2},${originY - AXIS_LENGTH} ${originX + ARROW_SIZE / 2},${originY - AXIS_LENGTH}`}
            fill="#333"
          />
          {/* Y 轴标签 y */}
          <text
            x={originX + 4}
            y={originY - AXIS_LENGTH - ARROW_SIZE - 2}
            fontSize={COORD_FONT_SIZE}
            fill="#333"
            fontStyle="italic"
          >
            y
          </text>

          {/* 原点 O */}
          <text
            x={originX - 3}
            y={originY + LABEL_FONT_SIZE + 2}
            fontSize={COORD_FONT_SIZE}
            fill="#333"
            fontWeight={600}
          >
            O
          </text>

          {/* X 轴刻度 */}
          {Array.from({ length: AXIS_TICK_COUNT + 1 }, (_, i) => {
            if (i === 0) return null; // 跳过原点
            const x = originX + i * AXIS_TICK_STEP;
            return (
              <g key={`tick-x-${i}`}>
                <line
                  x1={x}
                  y1={originY - TICK_SIZE / 2}
                  x2={x}
                  y2={originY + TICK_SIZE / 2}
                  stroke="#666"
                  strokeWidth={0.8}
                />
              </g>
            );
          })}

          {/* Y 轴刻度 */}
          {Array.from({ length: AXIS_TICK_COUNT + 1 }, (_, i) => {
            if (i === 0) return null;
            const y = originY - i * AXIS_TICK_STEP;
            return (
              <g key={`tick-y-${i}`}>
                <line
                  x1={originX - TICK_SIZE / 2}
                  y1={y}
                  x2={originX + TICK_SIZE / 2}
                  y2={y}
                  stroke="#666"
                  strokeWidth={0.8}
                />
              </g>
            );
          })}
        </g>
      )}

      {/* ---- 动态点标注 ---- */}
      {pointAnnotations.map((ann, i) => {
        const coords = parseNums(ann.params.label || "0,0");
        const label = ann.params.label?.split(",")[0]?.trim() || `P${i}`;
        const px = coords[0] || 0;
        const py = coords[1] || 0;

        return (
          <g key={`dyn-pt-${i}`}>
            <circle cx={px} cy={py} r={POINT_RADIUS} fill="#e03131" />
            <text
              x={px + 5}
              y={py - 5}
              fontSize={LABEL_FONT_SIZE}
              fill="#c92a2a"
              fontWeight={600}
            >
              {label}
            </text>
            {/* 坐标文字 */}
            <text
              x={px + 5}
              y={py + LABEL_FONT_SIZE + 2}
              fontSize={COORD_FONT_SIZE}
              fill="#666"
            >
              ({px}, {py})
            </text>
          </g>
        );
      })}

      {/* ---- 动态向量标注 ---- */}
      {vectorAnnotations.map((ann, i) => {
        const fromCoords = parseNums(ann.params.from || "0,0");
        const toCoords = parseNums(ann.params.to || "0,0");
        const label = ann.params.label || `v${i}`;
        const x1 = fromCoords[0] || 0;
        const y1 = fromCoords[1] || 0;
        const x2 = toCoords[0] || 0;
        const y2 = toCoords[1] || 0;

        // 计算箭头方向
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) return null;

        // 箭头尖端
        const tipX = x2;
        const tipY = y2;

        // 箭头两翼
        const angle = Math.atan2(dy, dx);
        const aSize = ARROW_SIZE;
        const wingAngle = Math.PI / 6; // 30 degrees
        const wing1X = tipX - aSize * Math.cos(angle - wingAngle);
        const wing1Y = tipY - aSize * Math.sin(angle - wingAngle);
        const wing2X = tipX - aSize * Math.cos(angle + wingAngle);
        const wing2Y = tipY - aSize * Math.sin(angle + wingAngle);

        // 标签位置：向量中点偏移
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        // 法线方向偏移
        const nx = (-dy / len) * 10;
        const ny = (dx / len) * 10;

        return (
          <g key={`dyn-vec-${i}`}>
            {/* 向量线 */}
            <line
              x1={x1}
              y1={y1}
              x2={tipX}
              y2={tipY}
              stroke="#1971c2"
              strokeWidth={1.5}
            />
            {/* 箭头 */}
            <polygon
              points={`${tipX},${tipY} ${wing1X},${wing1Y} ${wing2X},${wing2Y}`}
              fill="#1971c2"
            />
            {/* 标签 */}
            <text
              x={midX + nx}
              y={midY + ny}
              fontSize={LABEL_FONT_SIZE}
              fill="#1864ab"
              fontWeight={600}
              textAnchor="middle"
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function GeometryCanvas({
  initialPaths = [],
  initialPoints = [],
  annotations = [],
  diagram,
  stepGeometry,
  width = 300,
  height = 300,
  backgroundImageUrl,
}: GeometryCanvasProps) {
  // 优先级：stepGeometry > diagram > SVG annotations
  if (stepGeometry) {
    return <StepDiagramCanvas geo={stepGeometry} />;
  }
  if (diagram) {
    return <DiagramCanvas diagram={diagram} />;
  }

  return (
    <SvgCanvas
      initialPaths={initialPaths}
      initialPoints={initialPoints}
      annotations={annotations}
      width={width}
      height={height}
      backgroundImageUrl={backgroundImageUrl}
    />
  );
}
