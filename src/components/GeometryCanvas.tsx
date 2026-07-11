"use client";

import React, { useMemo } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface GeometryAnnotation {
  type: "axis" | "point" | "vector" | "clear";
  params: Record<string, string>;
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
  annotations: GeometryAnnotation[];
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
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function GeometryCanvas({
  initialPaths = [],
  initialPoints = [],
  annotations = [],
  width = 300,
  height = 300,
  backgroundImageUrl,
}: GeometryCanvasProps) {
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
        const nx = -dy / len * 10;
        const ny = dx / len * 10;

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
