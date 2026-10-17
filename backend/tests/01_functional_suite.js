import { API_BASE_URL, TEST_CONFIG, formatMs } from './config.js';

const results = [];

const runTest = async (category, name, method, path, body = null, headers = {}) => {
  const url = `${API_BASE_URL}${path}`;
  const startTime = performance.now();
  let status = 0;
  let success = false;
  let details = '';
  let data = null;

  try {
    const fetchOptions = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    if (body) {
      fetchOptions.body = JSON.stringify(body);
    }

    const res = await fetch(url, fetchOptions);
    const endTime = performance.now();
    const duration = endTime - startTime;
    status = res.status;

    try {
      data = await res.json();
    } catch (_) {
      data = null;
    }

    if (res.ok || (status === 400 && name.includes('Validation')) || (status === 401 && name.includes('Invalid Login'))) {
      success = true;
      details = data?.message || `HTTP ${status}`;
    } else {
      success = false;
      details = data?.message || `HTTP ${status} unexpected error`;
    }

    const testItem = {
      category,
      name,
      method,
      path,
      status,
      duration,
      success,
      details,
      data
    };
    results.push(testItem);
    return testItem;
  } catch (err) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    const testItem = {
      category,
      name,
      method,
      path,
      status: 'ERR',
      duration,
      success: false,
      details: err.message,
      data: null
    };
    results.push(testItem);
    return testItem;
  }
};

export const runFunctionalTests = async () => {
  console.log('\n===============================================================');
  console.log(`  SOLITX COMPREHENSIVE FUNCTIONAL TEST SUITE`);
  console.log(`  Target: ${API_BASE_URL}`);
  console.log(`  Timestamp: ${new Date().toISOString()}`);
  console.log('===============================================================\n');

  // ── 1. System Health ───────────────────────────────────────────────────────
  console.log('[1/6] Testing System & Health Endpoints...');
  await runTest('System', 'Health Check', 'GET', '');

  // ── 2. Auth Endpoints ─────────────────────────────────────────────────────
  console.log('[2/6] Testing Authentication Endpoints...');
  await runTest('Auth', 'Check Existing Username', 'GET', '/auth/check-username?username=soumya_');
  await runTest('Auth', 'Check Available Username', 'GET', `/auth/check-username?username=avail_${Date.now()}`);
  await runTest('Auth', 'Invalid Login Expected 401', 'POST', '/auth/login', {
    email: 'nonexistent@solitx.test',
    password: 'WrongPassword999!'
  });

  // ── 3. Feed & Posts Endpoints ──────────────────────────────────────────────
  console.log('[3/6] Testing Posts & Feed Endpoints...');
  const feedTest = await runTest('Posts', 'Get Public Timeline Feed', 'GET', '/posts/feed');
  await runTest('Posts', 'Get Trending Topics', 'GET', '/posts/trending');

  let samplePostId = null;
  if (feedTest.data?.data?.posts?.length > 0) {
    samplePostId = feedTest.data.data.posts[0].id;
    await runTest('Posts', 'Get Single Post Details', 'GET', `/posts/${samplePostId}`);
    await runTest('Posts', 'Get Post Comments', 'GET', `/posts/${samplePostId}/comments`);
  }

  // ── 4. Users & Social Graph ────────────────────────────────────────────────
  console.log('[4/6] Testing Users & Social Graph Endpoints...');
  const suggestionsTest = await runTest('Users', 'Get Suggested Users', 'GET', '/users/suggestions');
  await runTest('Users', 'Get Online Status', 'GET', '/users/online-status');

  let sampleUsername = 'soumya_';
  if (suggestionsTest.data?.data?.users?.length > 0) {
    sampleUsername = suggestionsTest.data.data.users[0].username;
  }
  await runTest('Users', 'Get User Profile (Redis/DB)', 'GET', `/users/${sampleUsername}`);
  await runTest('Users', 'Get User Followers', 'GET', `/users/${sampleUsername}/followers`);
  await runTest('Users', 'Get User Following', 'GET', `/users/${sampleUsername}/following`);

  // ── 5. Communities Endpoints ───────────────────────────────────────────────
  console.log('[5/6] Testing Communities Endpoints...');
  const commListTest = await runTest('Communities', 'Get Public Communities', 'GET', '/communities');

  if (commListTest.data?.data?.communities?.length > 0) {
    const sampleComm = commListTest.data.data.communities[0];
    const commKey = sampleComm.slug || sampleComm.id;
    await runTest('Communities', 'Get Community Details', 'GET', `/communities/${commKey}`);
    await runTest('Communities', 'Get Community Feed', 'GET', `/communities/${commKey}/feed`);
    await runTest('Communities', 'Get Community Members', 'GET', `/communities/${commKey}/members`);
  }

  // ── 6. Lists Endpoints ─────────────────────────────────────────────────────
  console.log('[6/6] Testing Lists Endpoints...');
  const listsTest = await runTest('Lists', 'Get User Lists', 'GET', '/lists');
  if (listsTest.data?.data?.lists?.length > 0) {
    const sampleListId = listsTest.data.data.lists[0].id;
    await runTest('Lists', 'Get List Details', 'GET', `/lists/${sampleListId}`);
    await runTest('Lists', 'Get List Feed', 'GET', `/lists/${sampleListId}/feed`);
    await runTest('Lists', 'Get List Members', 'GET', `/lists/${sampleListId}/members`);
  }

  // ── PRINT FORMATTED RESULTS TABLE ──────────────────────────────────────────
  console.log('\n========================================================================================');
  console.log('                           FUNCTIONAL TEST SUITE SUMMARY                                ');
  console.log('========================================================================================');
  console.log(
    'Status'.padEnd(8) +
    'Method'.padEnd(8) +
    'Latency'.padEnd(14) +
    'Endpoint'.padEnd(35) +
    'Details'
  );
  console.log('----------------------------------------------------------------------------------------');

  let passCount = 0;
  let failCount = 0;

  for (const r of results) {
    const statusSymbol = r.success ? '✓ PASS' : '✗ FAIL';
    const latencyStr = formatMs(r.duration);
    const endpointStr = r.path.length > 32 ? r.path.slice(0, 32) + '...' : r.path;

    if (r.success) passCount++;
    else failCount++;

    console.log(
      statusSymbol.padEnd(8) +
      r.method.padEnd(8) +
      latencyStr.padEnd(14) +
      endpointStr.padEnd(35) +
      (r.details || '').slice(0, 30)
    );
  }

  console.log('----------------------------------------------------------------------------------------');
  console.log(`Total: ${results.length} | Passed: ${passCount} | Failed: ${failCount}`);
  console.log('========================================================================================\n');

  return results;
};

// Auto-run if executed directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  runFunctionalTests().then(() => {
    process.exit(0);
  }).catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
}
