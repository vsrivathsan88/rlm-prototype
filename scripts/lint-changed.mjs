#!/usr/bin/env node

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

function run(command, args) {
  return spawnSync(command, args, { encoding: "utf-8" });
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--base") out.base = argv[i + 1];
    if (token === "--head") out.head = argv[i + 1];
  }
  return out;
}

function changedFiles(base, head) {
  const args = ["diff", "--name-only", "--diff-filter=ACMR"];
  if (base && head) {
    args.push(`${base}...${head}`);
  }
  const result = run("git", args);
  if (result.status !== 0) {
    const stderr = (result.stderr || "").trim();
    throw new Error(stderr || "git diff failed");
  }
  return (result.stdout || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

const { base, head } = parseArgs(process.argv.slice(2));

function normalizePath(file) {
  if (existsSync(file)) return file;
  if (file.startsWith("ui/")) {
    const stripped = file.slice(3);
    if (existsSync(stripped)) return stripped;
  }
  return null;
}

let files = [];
try {
  files = changedFiles(base, head);
} catch (err) {
  const message = err instanceof Error ? err.message : "Unknown error";
  console.error(`[lint:changed] Could not compute changed files: ${message}`);
  process.exit(2);
}

const eslintTargets = files
  .filter((file) => /\.(cjs|mjs|js|jsx|ts|tsx)$/.test(file))
  .filter((file) => !file.startsWith("node_modules/"))
  .map((file) => normalizePath(file))
  .filter((file) => file !== null);

if (eslintTargets.length === 0) {
  console.log("[lint:changed] No changed lintable files.");
  process.exit(0);
}

console.log(`[lint:changed] Linting ${eslintTargets.length} changed file(s).`);

const lint = run("npx", ["eslint", ...eslintTargets]);
if (lint.stdout) process.stdout.write(lint.stdout);
if (lint.stderr) process.stderr.write(lint.stderr);
process.exit(lint.status ?? 1);
