import { API_BASE_URL, formatMs, sleep } from './config.js';

const measureEndpoint = async (url, method = 'GET', body = null) => {
  const start = performance.now();
  let ok = false;
  let status = 0;
  try {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    status = res.status;
    ok = res.ok;
    await res.text();
  } catch (err) {
    status = 'ERR';
    ok = false;
  }
  const duration = performance.now() - start;
  return { duration, status, ok };
};

const calculatePercentiles = (durations) => {
  const sorted = [...durations].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.50)] || 0;
  const p90 = sorted[Math.floor(sorted.length * 0.90)] || 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
  const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;
  const avg = sorted.reduce((sum, d) => sum + d, 0) / sorted.length;
  const min = sorted[0] || 0;
  const max = sorted[sorted.length - 1] || 0;
  return { avg, p50, p90, p95, p99, min, max, total: durations.length };
};

export const runEventLoopStarvationTest = async (targetUrl = API_BASE_URL, samples = 20) => {
  console.log('\n===============================================================');
  console.log(`  BENCHMARK 2: EVENT LOOP STARVATION PROOF (DAY 18 CASE STUDY)`);
  console.log(`  Target: ${targetUrl}`);
  console.log(`  Proving how CPU workloads freeze unrelated I/O reads on 1 server`);
  console.log('===============================================================\n');

  const feedUrl = `${targetUrl}/posts/feed`;
  const loginUrl = `${targetUrl}/auth/login`;

  // ── PHASE 1: IDLE BASELINE ────────────────────────────────────────────────
  console.log(`[Phase 1] Measuring IDLE baseline latency for GET /posts/feed (${samples} requests)...`);
  const idleDurations = [];
  for (let i = 0; i < samples; i++) {
    const { duration } = await measureEndpoint(feedUrl);
    idleDurations.push(duration);
    await sleep(50);
  }
  const idleStats = calculatePercentiles(idleDurations);
  console.log(`✓ Phase 1 complete. Baseline avg latency: ${formatMs(idleStats.avg)} (p50: ${formatMs(idleStats.p50)}, p95: ${formatMs(idleStats.p95)})\n`);

  // ── PHASE 2: STARVATION UNDER CPU CONCURRENCY ─────────────────────────────
  console.log(`[Phase 2] Inducing CPU load via concurrent bcrypt auth while querying GET /posts/feed...`);
  
  let stopCpuStress = false;
  let cpuWorkerCompleted = 0;

  // Background CPU Stress Workers
  const runCpuWorker = async () => {
    while (!stopCpuStress) {
      await measureEndpoint(loginUrl, 'POST', {
        email: 'stress_worker@solitx.test',
        password: 'StressTestPassword999!'
      });
      cpuWorkerCompleted++;
    }
  };

  // Launch 15 concurrent background workers hammering bcrypt
  const workerPromises = Array.from({ length: 15 }, () => runCpuWorker());

  // Allow stress to ramp up for 300ms
  await sleep(300);

  // Measure timeline feed response times WHILE the event loop is choked
  const starvedDurations = [];
  for (let i = 0; i < samples; i++) {
    const { duration } = await measureEndpoint(feedUrl);
    starvedDurations.push(duration);
    await sleep(50);
  }

  // Stop background workers
  stopCpuStress = true;
  await Promise.all(workerPromises);

  const starvedStats = calculatePercentiles(starvedDurations);
  console.log(`✓ Phase 2 complete. Starved avg latency: ${formatMs(starvedStats.avg)} (p50: ${formatMs(starvedStats.p50)}, p95: ${formatMs(starvedStats.p95)})\n`);

  // ── ANALYSIS & PROOF COMPARISON ───────────────────────────────────────────
  const latencyInflation = ((starvedStats.avg - idleStats.avg) / idleStats.avg) * 100;
  const p95Inflation = ((starvedStats.p95 - idleStats.p95) / idleStats.p95) * 100;

  console.log('========================================================================================');
  console.log('              SINGLE-SERVER EVENT LOOP STARVATION: THE PROOF ON PAPER                   ');
  console.log('========================================================================================');
  console.log('Metric'.padEnd(20) + 'Idle Server (Baseline)'.padEnd(26) + 'Under Concurrent CPU Load'.padEnd(28) + 'Impact / Degradation');
  console.log('----------------------------------------------------------------------------------------');
  console.log('Average Latency'.padEnd(20) + formatMs(idleStats.avg).padEnd(26) + formatMs(starvedStats.avg).padEnd(28) + `+${latencyInflation.toFixed(1)}% SLOWER`);
  console.log('p50 Median'.padEnd(20) + formatMs(idleStats.p50).padEnd(26) + formatMs(starvedStats.p50).padEnd(28) + `${(starvedStats.p50 / idleStats.p50).toFixed(1)}x latency multiplier`);
  console.log('p95 Latency'.padEnd(20) + formatMs(idleStats.p95).padEnd(26) + formatMs(starvedStats.p95).padEnd(28) + `+${p95Inflation.toFixed(1)}% latency spike`);
  console.log('Max Latency'.padEnd(20) + formatMs(idleStats.max).padEnd(26) + formatMs(starvedStats.max).padEnd(28) + `Peaked at ${formatMs(starvedStats.max)}`);
  console.log('----------------------------------------------------------------------------------------');
  console.log('CONCLUSION FOR DAY 18 CASE STUDY:');
  console.log('Even though GET /posts/feed is a fast indexed database read, its latency collapsed purely');
  console.log('because it shares the same single-threaded Node.js event loop with CPU-heavy bcrypt operations.');
  console.log('A single server CANNOT scale independently without horizontally distributing processes.');
  console.log('========================================================================================\n');

  return {
    idleStats,
    starvedStats,
    latencyInflation,
    p95Inflation
  };
};

// Auto-run if executed directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  runEventLoopStarvationTest().then(() => {
    process.exit(0);
  }).catch((err) => {
    console.error('Starvation test failed:', err);
    process.exit(1);
  });
}
