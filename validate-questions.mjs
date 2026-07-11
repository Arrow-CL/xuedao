#!/usr/bin/env node
// Run: node validate-questions.mjs
// Checks all Gaokao JSON questions for common data issues

import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const dir = "src/data/gaokao-questions";
const issues = [];
const CRITICAL = ["﹔", "﹕", "﹑", "﹒"];  // corrupt punctuation

function walk(d) {
  for (const item of readdirSync(d, { withFileTypes: true })) {
    const fp = join(d, item.name);
    if (item.isDirectory()) walk(fp);
    else if (item.name.endsWith(".json")) check(fp);
  }
}

function check(fp) {
  const d = JSON.parse(readFileSync(fp, "utf-8"));
  if (!d.questions) return;
  for (const q of d.questions) {
    const p = q.prompt || "";
    const name = fp.split(/[\\/]/).slice(-2).join("/") + " Q" + q.number;
    
    // Critical: corrupt characters
    for (const c of CRITICAL) {
      if (p.includes(c)) issues.push({ file: name, issue: "Corrupt char: " + c.charCodeAt(0).toString(16), preview: p.slice(0, 60) });
    }
    
    // Critical: formula placeholder without content
    if (/[设已]\u002c/.test(p) || (p.includes("函数") && p.includes("（    ）") && !p.includes("\\("))) {
      issues.push({ file: name, issue: "Missing formula content (extraction failed)", preview: p.slice(0, 60) });
    }
    
    // Warning: unmatched parentheses (may be truncation)
    const openCnt = (p.match(/\\\(/g) || []).length;
    const closeCnt = (p.match(/\\\)/g) || []).length;
    if (openCnt !== closeCnt && p.length > 30) {
      issues.push({ file: name, issue: "Unmatched LaTeX parens ("+openCnt+" vs "+closeCnt+")", preview: p.slice(0, 60) });
    }
    
    // Warning: very short prompt (< 20 chars)
    if (p.length < 20 && p.trim()) {
      issues.push({ file: name, issue: "Very short prompt ("+p.length+" chars)", preview: p.slice(0, 60) });
    }
  }
}

walk(dir);
if (issues.length > 0) {
  console.log("\nFound " + issues.length + " data issues:");
  for (const i of issues) {
    console.log("  [" + i.issue + "] " + i.file);
    console.log("    " + i.preview);
  }
} else {
  console.log("\nAll questions passed validation!");
}
