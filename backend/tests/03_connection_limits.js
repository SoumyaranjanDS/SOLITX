import pool from '../src/config/db.js';

async function checkDbConnectionStats() {
  console.log("=================================================");
  console.log("  DAY 21: POSTGRESQL CONNECTION STATS & LIMITS   ");
  console.log("=================================================");
  
  try {
    const client = await pool.connect();
    
    // 1. Check max_connections configured in Postgres
    const maxConnRes = await client.query("SHOW max_connections;");
    const maxConnections = maxConnRes.rows[0].max_connections;
    console.log(`[1] Postgres max_connections: ${maxConnections}`);

    // 2. Check current active connections in pg_stat_activity
    const activeConnRes = await client.query(`
      SELECT 
        count(*) as total_connections,
        count(*) FILTER (WHERE state = 'active') as active_queries,
        count(*) FILTER (WHERE state = 'idle') as idle_connections,
        count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
      FROM pg_stat_activity;
    `);
    console.log("[2] Current Connection Distribution:");
    console.log(`    Total Open Connections:     ${activeConnRes.rows[0].total_connections}`);
    console.log(`    Active Queries Running:     ${activeConnRes.rows[0].active_queries}`);
    console.log(`    Idle Connections (Sleeping): ${activeConnRes.rows[0].idle_connections}`);
    console.log(`    Idle in Transaction (Risk): ${activeConnRes.rows[0].idle_in_transaction}`);

    // 3. Check client applications connected
    const appsRes = await client.query(`
      SELECT application_name, client_addr, count(*) 
      FROM pg_stat_activity 
      GROUP BY application_name, client_addr 
      ORDER BY count DESC 
      LIMIT 5;
    `);
    console.log("[3] Top Connected Clients:");
    appsRes.rows.forEach(r => {
      console.log(`    App: ${r.application_name || 'unnamed'} | IP: ${r.client_addr || 'local/pooler'} | Count: ${r.count}`);
    });

    // 4. Inspect current pg.Pool stats in this Node process
    console.log("[4] Node.js pg.Pool In-Memory State:");
    console.log(`    Total connections in pool:  ${pool.totalCount}`);
    console.log(`    Idle connections in pool:   ${pool.idleCount}`);
    console.log(`    Waiting requests in queue:  ${pool.waitingCount}`);

    client.release();
    await pool.end();
    console.log("=================================================");
  } catch (err) {
    console.error("Failed to query database stats:", err.message);
    process.exit(1);
  }
}

checkDbConnectionStats();
