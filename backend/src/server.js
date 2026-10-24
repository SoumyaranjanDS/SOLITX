import express from "express";
import http from "http";
import dotenv from "dotenv";
import cors from "cors";
import { connectDB } from "./config/db.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { ApiResponse } from "./utils/ApiResponse.js";
import { AppError } from "./utils/AppError.js";
import { initSocket } from "./services/socketService.js";

dotenv.config();

const app = express();
const httpServer = http.createServer(app);
initSocket(httpServer);

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "https://solitx.soumya.site",
  "https://study.soumya.site",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith(".soumya.site") ||
        /^http:\/\/localhost:\d+$/.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  }),
);
app.use(express.json());

const port = process.env.PORT || 5005;

// DAY 22: STATELESSNESS & FAULT INJECTION DRAIN STATE
let isShuttingDown = false;

app.use((req, res, next) => {
  if (isShuttingDown) {
    // Advise client/proxy to close TCP socket and fail over immediately
    res.setHeader("Connection", "close");
    return res.status(503).json(
      new ApiResponse(
        503,
        { port, pid: process.pid, shuttingDown: true },
        "Instance is draining connections for shutdown. Please retry on peer node.",
      ),
    );
  }
  next();
});

import authRoutes from "./modules/auth/auth.routes.js";
import userRoutes from "./modules/users/user.routes.js";
import postRoutes from "./modules/posts/post.routes.js";
import listRoutes from "./modules/lists/list.routes.js";
import communityRoutes from "./modules/communities/community.routes.js";
import mediaRoutes from "./modules/media/media.routes.js";
import pool from "./config/db.js";
import redis from "./config/redis.js";

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/posts", postRoutes);
app.use("/api/v1/lists", listRoutes);
app.use("/api/v1/communities", communityRoutes);
app.use("/api/v1/media", mediaRoutes);

// TEMPORARY ENDPOINT FOR LOAD TESTING (DAY 8) & PAGINATION (DAY 10)
app.get("/api/v1/test/feed/:user_id", async (req, res, next) => {
  try {
    const { user_id } = req.params;
    const cursor = req.query.cursor; // Timestamp from the last fetched post

    let query;
    let params;

    if (cursor) {
      query = `
        SELECT * FROM posts 
        WHERE user_id = $1 AND created_at < $2
        ORDER BY created_at DESC 
        LIMIT 20;
      `;
      params = [user_id, cursor];
    } else {
      query = `
        SELECT * FROM posts 
        WHERE user_id = $1 
        ORDER BY created_at DESC 
        LIMIT 20;
      `;
      params = [user_id];
    }

    const result = await pool.query(query, params);

    // Determine the next cursor to pass to the frontend
    let nextCursor = null;
    if (result.rows.length === 20) {
      nextCursor = result.rows[result.rows.length - 1].created_at;
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { count: result.rowCount, nextCursor, data: result.rows },
          "Feed fetched successfully",
        ),
      );
  } catch (error) {
    next(error);
  }
});

// DAY 13: REDIS CACHING (Repeated Reads)
app.get("/api/v1/test/user/:username", async (req, res, next) => {
  try {
    const { username } = req.params;
    const cacheKey = `user:${username}`;

    // 1. Check Redis Cache
    const cachedUser = await redis.get(cacheKey);
    if (cachedUser) {
      // CACHE HIT! Instant response.
      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            { source: "cache", user: JSON.parse(cachedUser) },
            "User fetched from Redis Cache",
          ),
        );
    }

    // 2. CACHE MISS. Query PostgreSQL
    const query = `SELECT id, username, email, bio, created_at FROM users WHERE username = $1;`;
    const result = await pool.query(query, [username]);

    if (result.rowCount === 0) {
      throw new AppError(404, "User not found");
    }

    const user = result.rows[0];

    // 3. Save to Redis for next time (Expires in 5 minutes)
    await redis.set(cacheKey, JSON.stringify(user), "EX", 300);

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { source: "database", user },
          "User fetched from PostgreSQL",
        ),
      );
  } catch (error) {
    next(error);
  }
});

// DAY 14: CACHE INVALIDATION
app.put("/api/v1/test/user/:username", async (req, res, next) => {
  try {
    const { username } = req.params;
    const { bio } = req.body;
    const cacheKey = `user:${username}`;

    // 1. Update the Source of Truth (Database)
    const updateQuery = `UPDATE users SET bio = $1, updated_at = NOW() WHERE username = $2 RETURNING id, username, email, bio, created_at;`;
    const result = await pool.query(updateQuery, [bio, username]);

    if (result.rowCount === 0) {
      throw new AppError(404, "User not found");
    }

    // 2. INVALIDATE THE CACHE! (Delete stale data)
    await redis.del(cacheKey);

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { user: result.rows[0] },
          "User updated and cache invalidated",
        ),
      );
  } catch (error) {
    next(error);
  }
});

// DAY 22: SIMULATED IN-FLIGHT WORKLOAD FOR FAULT INJECTION & DRAIN AUDITING
app.get("/api/v1/test/workload", async (req, res, next) => {
  try {
    const delay = parseInt(req.query.delay || "1500", 10);
    const start = Date.now();
    await new Promise((resolve) => setTimeout(resolve, delay));
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          port,
          pid: process.pid,
          delayProcessedMs: Date.now() - start,
          isShuttingDown,
        },
        "In-flight workload processed successfully without abrupt termination",
      ),
    );
  } catch (error) {
    next(error);
  }
});

app.get("/api/v1/health", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        status: "healthy",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        port,
        pid: process.pid,
        dbPool: {
          total: pool.totalCount,
          idle: pool.idleCount,
          waiting: pool.waitingCount,
          max: pool.options?.max || 25,
        },
      },
      "Instance health check OK",
    ),
  );
});

app.get("/api/v1", async (req, res, next) => {
  try {
    return res
      .status(200)
      .json(new ApiResponse(200, { port }, "SOLITX API is running smoothly!"));
  } catch (error) {
    next(error); // Explicitly passing errors to the global error handler
  }
});

app.get("/error-test", async (req, res, next) => {
  try {
    throw new AppError(400, "This is a deliberate test error!");
  } catch (error) {
    next(error); // Explicitly passing errors to the global error handler
  }
});

app.use(errorHandler);

let serverInstance = null;

connectDB().then(() => {
  serverInstance = httpServer.listen(port, () =>
    console.log(`Server running on port ${port} (PID: ${process.pid})`),
  );
});

// DAY 22: GRACEFUL SHUTDOWN HANDLER (SIGTERM / SIGINT)
const gracefulShutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n[${signal}] Received termination signal. Initiating graceful shutdown...`);

  // 1. Tell Keep-Alive connections to terminate after current request
  if (serverInstance && typeof serverInstance.closeIdleConnections === "function") {
    serverInstance.closeIdleConnections();
  }

  // 2. Stop accepting new connections while letting in-flight requests finish
  if (serverInstance) {
    serverInstance.close(async (err) => {
      if (err) {
        console.error("[Shutdown] Error closing HTTP server listener:", err);
        process.exit(1);
      }
      console.log("[Shutdown] HTTP listener closed. In-flight requests successfully drained.");

      try {
        // 3. Drain and disconnect database connection pool
        console.log("[Shutdown] Draining database connection pool...");
        await pool.end();
        console.log("[Shutdown] PostgreSQL connection pool drained.");

        // 4. Disconnect Redis client
        console.log("[Shutdown] Closing Redis connection...");
        await redis.quit();
        console.log("[Shutdown] Redis disconnected.");

        console.log("[Shutdown] All resources released cleanly. Exiting with code 0.");
        process.exit(0);
      } catch (cleanupErr) {
        console.error("[Shutdown] Error during cleanup teardown:", cleanupErr);
        process.exit(1);
      }
    });
  } else {
    process.exit(0);
  }

  // 5. Hard failsafe timeout: Force exit after 10 seconds if connections refuse to drain
  const forceExitTimer = setTimeout(() => {
    console.error("[Shutdown] Forced exit: pending connections took longer than 10s grace limit.");
    process.exit(1);
  }, 10000);
  forceExitTimer.unref();
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
