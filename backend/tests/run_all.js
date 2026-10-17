import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { API_BASE_URL, formatMs } from "./config.js";
import { runFunctionalTests } from "./01_functional_suite.js";
import { runCpuBottleneckBenchmark } from "./02_cpu_bottleneck_test.js";
import { runEventLoopStarvationTest } from "./03_eventloop_starvation.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const generateMarkdownReport = (
  functionalResults,
  cpuResults,
  starvationResults,
) => {
  const dateStr = new Date().toISOString();
  let md = `# SOLITX Day 18 Benchmark & Bottleneck Proof Report\n\n`;
  md += `**Date:** ${dateStr}  \n`;
  md += `**Target Host:** \`${API_BASE_URL}\`  \n`;
  md += `**Roadmap Reference:** Day 18 — One Server Becomes the Bottleneck  \n\n`;
  md += `---\n\n`;

  // Section 1: Functional Verification
  md += `## 1. Functional Endpoint Verification\n\n`;
  md += `| Status | Method | Endpoint | Latency | Details |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- |\n`;
  for (const r of functionalResults) {
    const statusEmoji = r.success ? "✅ PASS" : "❌ FAIL";
    md += `| ${statusEmoji} | \`${r.method}\` | \`${r.path}\` | ${formatMs(r.duration)} | ${r.details || ""} |\n`;
  }
  md += `\n---\n\n`;

  // Section 2: CPU Bottleneck
  md += `## 2. Benchmark 1: The CPU Bottleneck (Bcrypt Hashing at Scale)\n\n`;
  md += `Testing \`POST /api/v1/auth/login\` with increasing concurrent connections reveals how CPU-intensive operations saturate the single Node.js event loop thread:\n\n`;
  md += `| Concurrent Clients | Requests/sec (RPS) | Avg Latency | p50 Median | p95 / p99 | Max Latency | Timeouts |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;
  for (const r of cpuResults) {
    md += `| **${r.connections} clients** | **${r.rps.toFixed(1)} req/s** | ${formatMs(r.avgLatency)} | ${formatMs(r.p50)} | ${formatMs(r.p90)} / ${formatMs(r.p99)} | ${formatMs(r.maxLatency)} | ${r.timeouts} |\n`;
  }
  md += `\n**Key Finding:** As concurrency increases, throughput flattens because a single core cannot compute hashes in parallel without queueing.\n\n`;
  md += `---\n\n`;

  // Section 3: Event Loop Starvation
  md += `## 3. Benchmark 2: Event Loop Starvation (The "One Server" Bottleneck)\n\n`;
  md += `The most critical architectural vulnerability of a single server: **unrelated I/O requests are starved by CPU-heavy requests sharing the same process.**\n\n`;
  md += `We measured \`GET /api/v1/posts/feed\` (a fast indexed database read) under two conditions:\n\n`;
  md += `| State | Avg Latency | p50 Median | p95 Latency | Max Latency |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- |\n`;
  md += `| **Idle Server (Baseline)** | ${formatMs(starvationResults.idleStats.avg)} | ${formatMs(starvationResults.idleStats.p50)} | ${formatMs(starvationResults.idleStats.p95)} | ${formatMs(starvationResults.idleStats.max)} |\n`;
  md += `| **Under Concurrent Auth CPU Load** | **${formatMs(starvationResults.starvedStats.avg)}** | **${formatMs(starvationResults.starvedStats.p50)}** | **${formatMs(starvationResults.starvedStats.p95)}** | **${formatMs(starvationResults.starvedStats.max)}** |\n`;
  md += `| **Degradation Factor** | **+${starvationResults.latencyInflation.toFixed(1)}% slower** | **${(starvationResults.starvedStats.p50 / starvationResults.idleStats.p50).toFixed(1)}x multiplier** | **+${starvationResults.p95Inflation.toFixed(1)}% spike** | **Severe tail latency** |\n\n`;

  md += `### Why Vertical Scaling Fails Here:\n`;
  md += `Upgrading to an 8-core CPU VM does NOT solve this problem for a single Node.js process because Node runs on a single event loop thread. Only 1 core will run at 100% while the remaining 7 cores sit idle.\n\n`;

  md += `### Bridge to Day 19 Solution:\n`;
  md += `To overcome this physical bottleneck, we must **scale horizontally**: run multiple Node.js instances behind an NGINX / reverse proxy load balancer distributing traffic via Round Robin.\n`;

  return md;
};

const runAll = async () => {
  console.log("Starting Master Test & Benchmark Suite for Day 18...");

  // Step 1: Functional Tests
  const functionalResults = await runFunctionalTests();

  // Step 2: CPU Bottleneck Benchmark
  const cpuResults = await runCpuBottleneckBenchmark(API_BASE_URL, 6);

  // Step 3: Event Loop Starvation Benchmark
  const starvationResults = await runEventLoopStarvationTest(API_BASE_URL, 15);

  // Step 4: Write Output Markdown
  const reportMd = generateMarkdownReport(
    functionalResults,
    cpuResults,
    starvationResults,
  );
  const reportPath = path.join(__dirname, "BENCHMARK_REPORT.md");
  fs.writeFileSync(reportPath, reportMd, "utf8");

  console.log(
    `\n===============================================================`,
  );
  console.log(`✓ Master benchmark suite completed successfully!`);
  console.log(`📄 Formatted report written to: ${reportPath}`);
  console.log(
    `===============================================================\n`,
  );
};

runAll().catch((err) => {
  console.error("Fatal execution error:", err);
  process.exit(1);
});
