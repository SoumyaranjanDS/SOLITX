import autocannon from 'autocannon';
import { API_BASE_URL, formatMs } from './config.js';

export const runCpuBottleneckBenchmark = async (targetUrl = API_BASE_URL, durationSec = 10) => {
  console.log('\n===============================================================');
  console.log(`  BENCHMARK 1: CPU-BOUND BOTTLENECK ANALYSIS (BCRYPT HASHING)`);
  console.log(`  Target: ${targetUrl}/auth/login`);
  console.log(`  Duration: ${durationSec}s per concurrency step`);
  console.log('===============================================================\n');

  const concurrencyLevels = [1, 5, 15, 30];
  const summaryRows = [];

  for (const connections of concurrencyLevels) {
    process.stdout.write(`Testing concurrency level: ${connections} concurrent connection(s)... `);

    const instance = autocannon({
      url: `${targetUrl}/auth/login`,
      connections,
      duration: durationSec,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'test_load_benchmark@solitx.test',
        password: 'PasswordStressTest2026!'
      }),
      timeout: 15
    });

    // Run benchmark synchronously via Promise
    const result = await new Promise((resolve, reject) => {
      autocannon.track(instance, { renderProgressBar: false, renderResultsTable: false });
      instance.on('done', resolve);
      instance.on('error', reject);
    });

    console.log('Done.');

    summaryRows.push({
      connections,
      totalRequests: result.requests.total,
      rps: result.requests.average,
      avgLatency: result.latency.average,
      p50: result.latency.p50,
      p90: result.latency.p90,
      p99: result.latency.p99,
      maxLatency: result.latency.max,
      timeouts: result.timeouts,
      errors: result.errors,
      non2xx: result.non2xx
    });
  }

  console.log('\n========================================================================================');
  console.log('                 CPU BOTTLENECK (BCRYPT) BENCHMARK SUMMARY                              ');
  console.log('========================================================================================');
  console.log(
    'Concurrency'.padEnd(14) +
    'Req/Sec (RPS)'.padEnd(16) +
    'Avg Latency'.padEnd(14) +
    'p50'.padEnd(12) +
    'p95/p99'.padEnd(16) +
    'Max Latency'.padEnd(14) +
    'Timeouts'
  );
  console.log('----------------------------------------------------------------------------------------');

  for (const row of summaryRows) {
    console.log(
      `${row.connections} client(s)`.padEnd(14) +
      `${row.rps.toFixed(1)} req/s`.padEnd(16) +
      formatMs(row.avgLatency).padEnd(14) +
      formatMs(row.p50).padEnd(12) +
      `${formatMs(row.p90)} / ${formatMs(row.p99)}`.padEnd(16) +
      formatMs(row.maxLatency).padEnd(14) +
      `${row.timeouts}`
    );
  }

  console.log('========================================================================================\n');
  return summaryRows;
};

// Auto-run if executed directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  runCpuBottleneckBenchmark().then(() => {
    process.exit(0);
  }).catch((err) => {
    console.error('Benchmark failed:', err);
    process.exit(1);
  });
}
