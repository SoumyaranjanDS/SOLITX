import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { connectDB } from "./config/db.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { ApiResponse } from "./utils/ApiResponse.js";
import { AppError } from "./utils/AppError.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 5005;

import authRoutes from "./modules/auth/auth.routes.js";
import pool from "./config/db.js";

app.use("/api/v1/auth", authRoutes);

// TEMPORARY ENDPOINT FOR LOAD TESTING (DAY 8)
app.get("/api/v1/test/feed/:user_id", async (req, res, next) => {
  try {
    const { user_id } = req.params;
    const query = `
      SELECT * FROM posts 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT 20;
    `;
    const result = await pool.query(query, [user_id]);
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { count: result.rowCount, data: result.rows },
          "Load test feed returned",
        ),
      );
  } catch (error) {
    next(error);
  }
});

app.get("/", async (req, res, next) => {
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

connectDB().then(() => {
  app.listen(port, () => console.log(`Server running on port ${port}`));
});
