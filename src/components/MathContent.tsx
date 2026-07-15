"use client";
import "katex/dist/katex.min.css";
import katex from "katex";
import React, { useMemo } from "react";

function isMathChar(c: string): boolean {
  var n = c.charCodeAt(0);
  if (n >= 48 && n <= 57) return true;   // 0-9
  if (n >= 65 && n <= 90) return true;   // A-Z
  if (n >= 97 && n <= 122) return true;  // a-z
  if (n === 43 || n === 45 || n === 61) return true; // + - =
  if (n === 42 || n === 47 || n === 94) return true; // * / ^
  if (n === 32) return true;            // space
  if (n === 39 || n === 40 || n === 41 || n === 46) return true; // ' ( ) .
  if (n === 44 || n === 58 || n === 92 || n === 95) return true; // , : \ _
  if (n === 123 || n === 125) return true; // { }
  if (n === 91 || n === 93 || n === 124) return true; // [ ] |
  if (n === 60 || n === 62) return true; // < >
  if (n === 38) return true;             // &
  if (n >= 178 && n <= 179) return true;
  if (n === 185) return true;
  if (n >= 880 && n <= 1023) return true;
  if (n >= 8304 && n <= 8351) return true;
  if (n >= 8704 && n <= 8959) return true;
  if (n === 215 || n === 247 || n === 177) return true;
  // 希腊字母
  if (n >= 0x03B1 && n <= 0x03C9) return true;
  if (n >= 0x0391 && n <= 0x03A9) return true;
  // ⩴ 等 KaTeX 扩展
  if (n >= 0x27E8 && n <= 0x27FF) return true;
  // 不再包含 CJK/全角标点 — 中文归为普通文本
  return false;
}

function segText(t: string): { isMath: boolean; text: string }[] {
  var r: { isMath: boolean; text: string }[] = [];
  var cur = "", mode = false;
  var braceDepth = 0;

  for (var i = 0; i < t.length; i++) {
    var ch = t[i];

    // $ 作为行内数学公式分隔符
    if (ch === "$") {
      if (cur.length > 0) {
        r.push({ isMath: mode, text: cur });
        cur = "";
      }
      mode = !mode;      // 切换模式
      braceDepth = 0;    // 重置花括号深度
      continue;          // $ 本身不加入 cur
    }

    // 在 $...$ 内部，跟踪花括号深度（保护 \text{中文} 等）
    if (mode) {
      var prev = cur.length >= 2 ? cur[cur.length - 2] : null;
      if (ch === "{" && prev !== "\\") braceDepth++;
      else if (ch === "}" && prev !== "\\") braceDepth = Math.max(0, braceDepth - 1);
    }

    cur += ch;
  }
  if (cur) r.push({ isMath: mode, text: cur });
  return r;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");
}

// **加粗** 占位符（零宽字符，不在 isMathChar 中）
var BOLD_OPEN = "\u200b\u200c";
var BOLD_CLOSE = "\u200d\u200e";

export default function MathContent(props: { text: string; className?: string }) {
  var html = useMemo(function () {
    if (!props.text) return "";

    // 1. **text** → 占位符
    var text = props.text.replace(/\*\*(.+?)\*\*/g, BOLD_OPEN + "$1" + BOLD_CLOSE);

    // 2. 分词 + 渲染
    var rendered = segText(text).map(function (p) {
      if (p.isMath) {
        try {
          return katex.renderToString(p.text, {
            displayMode: false,
            throwOnError: false,
          });
        } catch {
          return esc(p.text);
        }
      }
      return esc(p.text);
    }).join("");

    // 3. 还原加粗占位符
    rendered = rendered.split(BOLD_OPEN).join("<strong>").split(BOLD_CLOSE).join("</strong>");

    // 4. 段落间距
    rendered = rendered.replace(/<br\/>(\s*)(\d+\.)/g, '<br/><div style="height:0.5em"></div>$1$2');
    rendered = rendered.replace(/<br\/>\s*<br\/>/g, '<br/><div style="height:0.6em"></div><br/>');

    return rendered;
  }, [props.text]);

  return React.createElement("div", {
    className: "prose prose-sm max-w-none " + (props.className || ""),
    dangerouslySetInnerHTML: { __html: html },
  });
}
