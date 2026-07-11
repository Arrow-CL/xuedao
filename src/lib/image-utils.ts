/**
 * 图片压缩工具
 * 将用户上传/拍照的图片压缩到适合OCR识别的尺寸
 * - 最大宽度 1200px（数学手写题不需要更高分辨率）
 * - JPEG 质量 85（清晰度和体积的平衡点）
 * - 自动去除EXIF元数据（减少体积，保护隐私）
 */

const MAX_WIDTH = 1200;
const JPEG_QUALITY = 0.85;

export interface CompressResult {
  base64: string;
  width: number;
  height: number;
  originalSize: number; // bytes
  compressedSize: number; // bytes
  ratio: string; // e.g. "12.3%"
}

/**
 * 压缩图片，返回 base64
 */
export function compressImage(file: File): Promise<CompressResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const { base64, width, height } = resizeImage(img);
          const compressedSize = Math.round((base64.length * 3) / 4);
          const originalSize = file.size;

          resolve({
            base64,
            width,
            height,
            originalSize,
            compressedSize,
            ratio: ((compressedSize / originalSize) * 100).toFixed(1) + "%",
          });
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error("图片加载失败"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });
}

/**
 * 从 base64 字符串压缩（服务端用）
 */
export function compressBase64(inputBase64: string, maxWidth = MAX_WIDTH, quality = JPEG_QUALITY): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof window !== "undefined") {
      // 浏览器环境
      const img = new Image();
      img.onload = () => {
        try {
          const { base64 } = resizeImage(img, maxWidth, quality);
          resolve(base64);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error("图片加载失败"));
      img.src = inputBase64.startsWith("data:") ? inputBase64 : `data:image/jpeg;base64,${inputBase64}`;
    } else {
      // 服务端环境 — 返回原始 base64（服务端压缩需要 sharp 等库）
      // 对于 API 路由，建议在前端已经压缩过
      resolve(inputBase64);
    }
  });
}

function resizeImage(
  img: HTMLImageElement,
  maxWidth = MAX_WIDTH,
  quality = JPEG_QUALITY
): { base64: string; width: number; height: number } {
  let { width, height } = img;

  // 只在超过最大宽度时缩放
  if (width > maxWidth) {
    const ratio = maxWidth / width;
    width = maxWidth;
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context 不可用");

  // 白色背景（避免透明区域变黑）
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.drawImage(img, 0, 0, width, height);

  const base64 = canvas.toDataURL("image/jpeg", quality);
  return { base64, width, height };
}
