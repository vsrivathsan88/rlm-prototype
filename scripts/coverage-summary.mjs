#!/usr/bin/env node

import { existsSync, readFileSync, appendFileSync } from "node:fs";

const summaryPath = "coverage/coverage-summary.json";
if (!existsSync(summaryPath)) {
  console.error(`[coverage-summary] Missing ${summaryPath}`);
  process.exit(1);
}

const summary = JSON.parse(readFileSync(summaryPath, "utf-8"));
const total = summary.total || {};

function metricLine(name, value) {
  const pct = typeof value?.pct === "number" ? value.pct.toFixed(2) : "0.00";
  const covered = Number(value?.covered ?? 0);
  const count = Number(value?.total ?? 0);
  return `| ${name} | ${pct}% | ${covered}/${count} |`;
}

const table = [
  "| Metric | Coverage | Covered/Total |",
  "|---|---:|---:|",
  metricLine("Lines", total.lines),
  metricLine("Statements", total.statements),
  metricLine("Functions", total.functions),
  metricLine("Branches", total.branches),
].join("\n");

console.log(table);

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `### UI Coverage\n\n${table}\n`,
    "utf-8"
  );
}
