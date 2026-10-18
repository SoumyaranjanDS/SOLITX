import http from 'http';
import https from 'https';
import pool from '../src/config/db.js';

// Configuration
const TARGET_URL = process.env.TEST_TARGET_URL || 'https://apisolitx.soumya.site/api/v1';
const CONCURRENT_REQUESTS = 60;
const TEST_ENDPOINT = `${TARGET_URL}/posts/feed`;

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const client = isHttps ? https : http;
    const startTime = process.hrtime();

    const req = client.get(url, { timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        const diff = process.hrtime(startTime);
        const latencyMs = (diff[0] * 1000 + diff[1] / 1e6).toFixed(2);
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, latencyMs: parseFloat(latencyMs), data: parsed });
        } catch {
          resolve({ status: res.statusCode, latencyMs: parseFloat(latencyMs), raw: data });
        }
      });
    });

    req.on('error', (err) => {
      const diff = process.hrtime(startTime);
      const latencyMs = (diff[0] * 1000 + diff[1] / 1e6).toFixed(2);
      reject({ error: err.message, latencyMs: parseFloat(latencyMs) });
    });

    req.on('timeout', () => {
      req.destroy();
      reject({ error: 'Request Timeout (10000ms)' });
    });
  });
}

async function getPgConnectionStats() {
  try {
    const res = await pool.query(`
      SELECT 
        count(*) as total_connections,
        count(*) FILTER (WHERE state = 'active') as active_queries,
        count(*) FILTER (WHERE state = 'idle') as idle_connections,
        count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
      FROM pg_stat_activity;
    `);
    return res.rows[0];
  } catch (err) {
    return { error: err.message };
  }
}

async function runConnectionPoolTest() {
  console.log("================================================================================");
  console.log("  DAY 21: CONNECTION POOLING UNDER MULTIPLE INSTANCES BENCHMARK");
  console.log(`  Target: ${TEST_ENDPOINT}`);
  console.log(`  Concurrency: ${CONCURRENT_REQUESTS} parallel queries across dual instances`);
  console.log("================================================================================\n");

  // Step 1: Baseline Stats
  console.log("[Phase 1] Collecting Baseline PostgreSQL Connection Stats...");
  const baselineStats = await getPgConnectionStats();
  console.log(`  -> Total DB Connections Before Surge: ${baselineStats.total_connections}`);
  console.log(`  -> Idle Connections:                  ${baselineStats.idle_connections}`);
  console.log(`  -> Active Queries:                    ${baselineStats.active_queries}\n`);

  // Step 2: Fire concurrent surge hitting both load-balanced instances
  console.log(`[Phase 2] Firing ${CONCURRENT_REQUESTS} Concurrent Read Requests through NGINX Load Balancer...`);
  const startTime = Date.now();
  
  const promises = [];
  for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
    promises.push(
      fetchJson(TEST_ENDPOINT).catch(err => ({ error: err.error || 'Failed', latencyMs: 0, status: 500 }))
    );
  }

  // Mid-flight snapshot
  await new Promise(r => setTimeout(r, 150));
  const midStats = await getPgConnectionStats();

  const results = await Promise.all(promises);
  const totalDuration = Date.now() - startTime;

  // Step 3: Analysis
  const successful = results.filter(r => r.status === 200);
  const failed = results.filter(r => r.status !== 200);
  const latencies = successful.map(r => r.latencyMs).sort((a, b) => a - b);

  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
  const avg = (latencies.reduce((sum, val) => sum + val, 0) / (latencies.length || 1)).toFixed(2);

  // Step 4: After Surge Stats
  console.log("\n[Phase 3] Collecting Post-Surge PostgreSQL Connection Stats...");
  const postStats = await getPgConnectionStats();

  console.log("\n================================================================================");
  console.log("                           BENCHMARK RESULTS                                    ");
  console.log("================================================================================");
  console.log(`Total Requests Sent:        ${CONCURRENT_REQUESTS}`);
  console.log(`Successful Responses (200): ${successful.length}`);
  console.log(`Failed / Dropped:           ${failed.length}`);
  console.log(`Total Batch Duration:       ${totalDuration} ms`);
  console.log(`Average Latency:            ${avg} ms`);
  console.log(`Median Latency (p50):       ${p50} ms`);
  console.log(`95th Percentile (p95):      ${p95} ms`);
  console.log(`99th Percentile (p99):      ${p99} ms`);
  console.log("--------------------------------------------------------------------------------");
  console.log("PostgreSQL Connection Multiplier Observation:");
  console.log(`  Baseline DB Connections:   ${baselineStats.total_connections}`);
  console.log(`  Mid-Surge Active Queries:  ${midStats.active_queries || 'N/A'}`);
  console.log(`  Post-Surge DB Connections: ${postStats.total_connections}`);
  console.log("================================================================================");

  await pool.end();
}

runConnectionPoolTest();
