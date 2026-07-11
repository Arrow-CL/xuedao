"use client";

import { useState, useRef, useCallback } from "react";
import { compressImage, CompressResult } from "@/lib/image-utils";

export default function OcrPage() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [compressInfo, setCompressInfo] = useState<CompressResult | null>(null);
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    setError("");
    setResult("");
    setCopied(false);
    setCompressInfo(null);

    // 显示预览
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    try {
      // 压缩图片
      const compressed = await compressImage(file);
      setCompressInfo(compressed);

      // 调用 OCR API
      setLoading(true);
      const res = await fetch("/api/vision-qwen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: compressed.base64,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "识别失败");
      }

      setResult(data.result || "");
    } catch (err: any) {
      setError(err?.message || "处理图片时出错");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      processFile(file);
      // 重置 input，允许重复选择同一文件
      e.target.value = "";
    },
    [processFile]
  );

  const handleCopy = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("复制失败，请手动复制");
    }
  }, [result]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">📷 拍照识题</h1>
      <p className="text-sm text-gray-500 mb-6">
        拍照或上传图片，自动识别数学题目和公式
      </p>

      {/* 操作按钮 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <button
          onClick={() => cameraInputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 py-8 text-gray-600 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
        >
          <span className="text-3xl">📷</span>
          <span className="text-sm font-medium">拍照</span>
          <span className="text-xs text-gray-400">调用相机</span>
        </button>

        <button
          onClick={() => galleryInputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 py-8 text-gray-600 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
        >
          <span className="text-3xl">🖼️</span>
          <span className="text-sm font-medium">从相册选择</span>
          <span className="text-xs text-gray-400">选择已有图片</span>
        </button>
      </div>

      {/* 隐藏的文件输入 */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* 图片预览 */}
      {previewUrl && (
        <div className="mb-6 rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
          <div className="p-3 border-b border-gray-200 bg-white flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">图片预览</span>
            <button
              onClick={() => {
                setPreviewUrl(null);
                setCompressInfo(null);
                setResult("");
                setError("");
              }}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              清除
            </button>
          </div>
          <div className="p-4 flex justify-center">
            <img
              src={previewUrl}
              alt="预览"
              className="max-h-64 max-w-full rounded-lg object-contain"
            />
          </div>
          {compressInfo && (
            <div className="px-4 pb-4">
              <div className="text-xs text-gray-500 space-y-1 bg-white rounded-lg p-3 border border-gray-100">
                <div className="flex justify-between">
                  <span>原始大小</span>
                  <span>{formatSize(compressInfo.originalSize)}</span>
                </div>
                <div className="flex justify-between">
                  <span>压缩后</span>
                  <span>{formatSize(compressInfo.compressedSize)}</span>
                </div>
                <div className="flex justify-between text-blue-600 font-medium">
                  <span>压缩比例</span>
                  <span>{compressInfo.ratio}</span>
                </div>
                <div className="flex justify-between">
                  <span>尺寸</span>
                  <span>
                    {compressInfo.width} × {compressInfo.height}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 加载状态 */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">正在识别题目内容…</p>
        </div>
      )}

      {/* 错误信息 */}
      {error && (
        <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <div className="flex items-start gap-2">
            <span className="mt-0.5">⚠️</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* 识别结果 */}
      {result && !loading && (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-3 border-b border-gray-200 bg-white flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">识别结果</span>
            <button
              onClick={handleCopy}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                copied
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {copied ? "✅ 已复制" : "📋 复制结果"}
            </button>
          </div>
          <div className="p-4 bg-gray-50">
            <pre className="text-sm text-gray-800 whitespace-pre-wrap break-words font-mono leading-relaxed">
              {result}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
