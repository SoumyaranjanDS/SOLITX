import dotenv from "dotenv";
dotenv.config();

export const API_BASE_URL =
  process.env.API_URL || "https://apisolitx.soumya.site/api/v1";

export const TEST_CONFIG = {
  baseUrl: API_BASE_URL,
  timeoutMs: 15000,
  testUser: {
    username: process.env.TEST_USERNAME || "benchmark_user",
    email: process.env.TEST_EMAIL || "benchmark@solitx.test",
    password: process.env.TEST_PASSWORD || "BenchmarkPass123!",
  },
};

export const formatMs = (ms) => {
  if (ms === undefined || ms === null || isNaN(ms)) return "N/A";
  return `${Number(ms).toFixed(2)} ms`;
};

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
